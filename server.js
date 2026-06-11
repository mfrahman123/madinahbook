const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = __dirname;
const dataRoot = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, "data");
const dataPath = path.join(dataRoot, "curriculum.json");
const progressPath = path.join(dataRoot, "progress.json");
const usersPath = path.join(dataRoot, "users.json");
const progressUsersPath = path.join(dataRoot, "progress-users.json");

loadLocalEnv(path.join(root, ".env"));

const port = Number(process.env.PORT || 4173);
const sessions = new Map();
const authAttempts = new Map();
const sessionCookieName = "madinah_session";
const sessionTtlMs = Number(process.env.SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000);
const authWindowMs = Number(process.env.AUTH_RATE_WINDOW_MS || 15 * 60 * 1000);
const authMaxByIdentity = Number(process.env.AUTH_RATE_MAX_IDENTITY || 8);
const authMaxByIp = Number(process.env.AUTH_RATE_MAX_IP || 40);
const maxXpIncreasePerSave = Number(process.env.MAX_XP_INCREASE_PER_SAVE || 100);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

const publicStaticFiles = new Set([
  "/index.html",
  "/app.js",
  "/styles.css",
  "/design/font-comparison-home.svg",
  "/design/font-comparison-home.svg.png"
]);

const baseSecurityHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "x-frame-options": "DENY",
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
};

const planEntitlements = {
  free: {
    books: ["book-1"]
  },
  paid: {
    books: ["book-1", "book-2", "book-3"]
  }
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;

    let value = trimmed.slice(separator + 1).trim();
    const quoted = (value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requestError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120_000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expected] = String(storedHash || "").split(":");
  if (!salt || !expected) return false;
  const actual = hashPassword(password, salt).split(":")[1];
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    userId: user.userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + sessionTtlMs
  });
  return token;
}

function parseCookies(header = "") {
  return Object.fromEntries(
    String(header)
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        if (separator === -1) return [part, ""];
        return [decodeURIComponent(part.slice(0, separator)), decodeURIComponent(part.slice(separator + 1))];
      })
  );
}

function sessionTokenFromRequest(request) {
  const headerToken = String(request.headers["x-session-token"] || "").trim();
  if (headerToken) return headerToken;
  return parseCookies(request.headers.cookie)[sessionCookieName] || "";
}

function sessionFromToken(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Number(session.expiresAt || 0) <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function isSecureRequest(request) {
  return request.socket.encrypted || request.headers["x-forwarded-proto"] === "https" || process.env.COOKIE_SECURE === "true";
}

function sessionCookie(token, request) {
  const attributes = [
    `${sessionCookieName}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(sessionTtlMs / 1000)}`
  ];
  if (isSecureRequest(request)) attributes.push("Secure");
  return attributes.join("; ");
}

function clearSessionCookie(request) {
  const attributes = [
    `${sessionCookieName}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0"
  ];
  if (isSecureRequest(request)) attributes.push("Secure");
  return attributes.join("; ");
}

function userFromRequest(request) {
  return sessionFromToken(sessionTokenFromRequest(request))?.userId || "demo-user";
}

function authenticatedUserFromRequest(request) {
  return sessionFromToken(sessionTokenFromRequest(request))?.userId || "";
}

function clientIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.socket.remoteAddress || "unknown";
}

function touchRateLimit(key, maxAttempts) {
  const now = Date.now();
  const recent = (authAttempts.get(key) || []).filter((time) => now - time < authWindowMs);
  if (recent.length >= maxAttempts) {
    authAttempts.set(key, recent);
    throw requestError("Too many attempts. Please wait before trying again.", 429);
  }
  recent.push(now);
  authAttempts.set(key, recent);
}

function enforceAuthRateLimit(request, purpose, email) {
  const ip = clientIp(request);
  const normalizedEmail = normalizeEmail(email) || "unknown";
  touchRateLimit(`${purpose}:ip:${ip}`, authMaxByIp);
  touchRateLimit(`${purpose}:identity:${ip}:${normalizedEmail}`, authMaxByIdentity);
}

function clearAuthRateLimit(request, purpose, email) {
  const ip = clientIp(request);
  const normalizedEmail = normalizeEmail(email) || "unknown";
  authAttempts.delete(`${purpose}:identity:${ip}:${normalizedEmail}`);
}

function normalizeSubscriptionPlan(plan) {
  return plan === "paid" ? "paid" : "free";
}

function normalizeSubscriptionStatus(status) {
  return ["active", "past_due", "cancelled"].includes(status) ? status : "active";
}

function publicUser(userId, displayName = "Fahima", email = "", subscriptionPlan = "free", subscriptionStatus = "active", subscriptionEndsAt = null) {
  return {
    userId,
    displayName,
    email,
    isDemo: userId === "demo-user",
    subscriptionPlan: normalizeSubscriptionPlan(subscriptionPlan),
    subscriptionStatus: normalizeSubscriptionStatus(subscriptionStatus),
    subscriptionEndsAt: subscriptionEndsAt || null
  };
}

function publicUserFromRecord(user) {
  return publicUser(
    user.userId,
    user.displayName,
    user.email,
    user.subscriptionPlan,
    user.subscriptionStatus,
    user.subscriptionEndsAt
  );
}

function planKeyForUser(user) {
  return user && !user.isDemo && user.subscriptionPlan === "paid" && user.subscriptionStatus === "active" ? "paid" : "free";
}

function accessibleBookSlugs(user) {
  return new Set((planEntitlements[planKeyForUser(user)] || planEntitlements.free).books);
}

function bookScoped(item, allowedBookSlugs) {
  return !item.bookSlug || allowedBookSlugs.has(item.bookSlug);
}

function resourceAllowed(resource, allowedBookSlugs) {
  const text = `${resource.id || ""} ${resource.title || ""} ${resource.description || ""}`.toLowerCase();
  if (text.includes("book-2") || text.includes("book 2")) return allowedBookSlugs.has("book-2");
  if (text.includes("book-3") || text.includes("book 3")) return allowedBookSlugs.has("book-3");
  if (text.includes("all lesson")) return allowedBookSlugs.has("book-2") && allowedBookSlugs.has("book-3");
  return true;
}

function filteredBooks(books, allowedBookSlugs) {
  return books.map((book) => {
    if (allowedBookSlugs.has(book.slug)) return book;
    return {
      ...book,
      status: "locked",
      premiumRequired: true
    };
  });
}

function entitlementContext(curriculum, user) {
  const allowedBookSlugs = accessibleBookSlugs(user);
  const lessons = curriculum.lessons.filter((lesson) => allowedBookSlugs.has(lesson.bookSlug));
  const vocabulary = curriculum.vocabulary.filter((word) => allowedBookSlugs.has(word.bookSlug));
  const grammar = curriculum.grammar.filter((rule) => bookScoped(rule, allowedBookSlugs));
  const exercises = curriculum.exercises.filter((exercise) => allowedBookSlugs.has(exercise.bookSlug));

  return {
    allowedBookSlugs,
    lessons,
    vocabulary,
    grammar,
    exercises,
    lessonIds: new Set(lessons.map((lesson) => lesson.id)),
    vocabularyIds: new Set(vocabulary.map((word) => word.id)),
    exerciseIds: new Set(exercises.map((exercise) => exercise.id))
  };
}

function filterProgressForUser(progress, curriculum, user) {
  const context = entitlementContext(curriculum, user);
  const lessonIds = context.lessonIds;
  const vocabularyIds = context.vocabularyIds;
  const currentLessonId = lessonIds.has(progress.currentLessonId)
    ? progress.currentLessonId
    : context.lessons[0]?.id || "lesson-1";

  return {
    ...progress,
    currentLessonId,
    activeBookSlug: context.allowedBookSlugs.has(progress.activeBookSlug) ? progress.activeBookSlug : "book-1",
    completedLessonIds: (progress.completedLessonIds || []).filter((id) => lessonIds.has(id)),
    learnedVocabularyIds: (progress.learnedVocabularyIds || []).filter((id) => vocabularyIds.has(id)),
    exerciseAttempts: filterProgressMap(progress.exerciseAttempts, (key) => progressKeyAllowed(key, context)),
    vocabularyStats: filterProgressMap(progress.vocabularyStats, (key) => vocabularyIds.has(key)),
    mistakes: filterProgressMap(progress.mistakes, (key, mistake) => mistakeAllowed(key, mistake, context)),
    writingAttempts: filterProgressMap(progress.writingAttempts, (key) => progressKeyAllowed(key, context)),
    exerciseAnswers: filterProgressMap(progress.exerciseAnswers, (key) => progressKeyAllowed(key, context))
  };
}

function filterProgressMap(map, predicate) {
  return Object.fromEntries(
    Object.entries(map || {}).filter(([key, value]) => predicate(key, value))
  );
}

function progressKeyAllowed(key, context) {
  const normalized = String(key || "");
  if (context.exerciseIds.has(normalized)) return true;
  if (Array.from(context.vocabularyIds).some((id) => normalized.includes(id))) return true;
  return context.lessons.some((lesson) =>
    normalized === `vocab-${lesson.id}` ||
    normalized.startsWith(`vocab-${lesson.id}-`) ||
    normalized.startsWith(`book-${lesson.id}-`) ||
    normalized.startsWith(`write-book-${lesson.id}-`)
  );
}

function mistakeAllowed(key, mistake, context) {
  if (mistake?.lessonId && !context.lessonIds.has(mistake.lessonId)) return false;
  if (mistake?.wordId && !context.vocabularyIds.has(mistake.wordId)) return false;
  return progressKeyAllowed(key, context);
}

function filterBootstrapPayload(payload, curriculum, user) {
  const context = entitlementContext(curriculum, user);
  const progress = filterProgressForUser(payload.progress, curriculum, user);
  return {
    ...payload,
    books: filteredBooks(payload.books, context.allowedBookSlugs),
    lessons: payload.lessons.filter((lesson) => context.allowedBookSlugs.has(lesson.bookSlug)),
    vocabulary: payload.vocabulary.filter((word) => context.allowedBookSlugs.has(word.bookSlug)),
    grammar: payload.grammar.filter((rule) => bookScoped(rule, context.allowedBookSlugs)),
    exercises: payload.exercises.filter((exercise) => context.allowedBookSlugs.has(exercise.bookSlug)),
    resources: payload.resources.filter((resource) => resourceAllowed(resource, context.allowedBookSlugs)),
    progress
  };
}

function sanitizeProgressPatch(patch, current, curriculum, user) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw requestError("Progress update must be an object.", 400);
  }

  const context = entitlementContext(curriculum, user);
  const sanitized = {};

  if (context.allowedBookSlugs.has(patch.activeBookSlug)) {
    sanitized.activeBookSlug = patch.activeBookSlug;
  }

  if (context.lessonIds.has(patch.currentLessonId)) {
    sanitized.currentLessonId = patch.currentLessonId;
  }

  if (Array.isArray(patch.completedLessonIds)) {
    sanitized.completedLessonIds = unique(patch.completedLessonIds.filter((id) => context.lessonIds.has(id)));
  }

  if (Array.isArray(patch.learnedVocabularyIds)) {
    sanitized.learnedVocabularyIds = unique(patch.learnedVocabularyIds.filter((id) => context.vocabularyIds.has(id)));
  }

  if (patch.weeklyGoalCompleted !== undefined) {
    const goal = Number(current.weeklyGoalTarget || 0);
    const value = Number(patch.weeklyGoalCompleted);
    if (Number.isFinite(value)) sanitized.weeklyGoalCompleted = Math.max(0, Math.min(goal, Math.floor(value)));
  }

  if (patch.xp !== undefined) {
    const currentXp = Number(current.xp || 0);
    const requestedXp = Number(patch.xp);
    if (!Number.isFinite(requestedXp) || requestedXp < currentXp || requestedXp - currentXp > maxXpIncreasePerSave) {
      throw requestError("Progress XP increase is outside the allowed range.", 400);
    }
    sanitized.xp = Math.floor(requestedXp);
  }

  const statusValues = new Set(["correct", "incorrect", "complete"]);
  sanitized.exerciseAttempts = sanitizeStatusMap(patch.exerciseAttempts, context, statusValues);
  sanitized.writingAttempts = sanitizeStatusMap(patch.writingAttempts, context, new Set(["correct", "incorrect"]));
  sanitized.exerciseAnswers = sanitizeStatusMap(patch.exerciseAnswers, context, new Set(["correct", "incorrect"]));
  sanitized.vocabularyStats = sanitizeVocabularyStats(patch.vocabularyStats, context);
  sanitized.mistakes = sanitizeMistakes(patch.mistakes, context);

  return Object.fromEntries(
    Object.entries(sanitized).filter(([, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) return Object.keys(value).length > 0;
      return value !== undefined;
    })
  );
}

function sanitizeStatusMap(map, context, allowedValues) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return {};
  return Object.fromEntries(
    Object.entries(map)
      .filter(([key, value]) => progressKeyAllowed(key, context) && allowedValues.has(value))
      .slice(0, 200)
  );
}

function sanitizeVocabularyStats(map, context) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return {};
  return Object.fromEntries(
    Object.entries(map)
      .filter(([wordId]) => context.vocabularyIds.has(wordId))
      .slice(0, 200)
      .map(([wordId, value]) => [wordId, sanitizeVocabularyStat(value)])
  );
}

function sanitizeVocabularyStat(value = {}) {
  const level = boundedInteger(value.level, 0, 5);
  return {
    level,
    correct: boundedInteger(value.correct, 0, 10_000),
    incorrect: boundedInteger(value.incorrect, 0, 10_000),
    attempts: boundedInteger(value.attempts, 0, 10_000),
    lastReviewedAt: safeIsoDate(value.lastReviewedAt),
    dueAt: safeIsoDate(value.dueAt)
  };
}

function sanitizeMistakes(map, context) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return {};
  return Object.fromEntries(
    Object.entries(map)
      .filter(([key, value]) => value && typeof value === "object" && !Array.isArray(value) && mistakeAllowed(key, value, context))
      .slice(0, 200)
      .map(([key, value]) => [key, {
        id: boundedString(value.id || key, 120),
        type: boundedString(value.type, 80),
        prompt: boundedString(value.prompt, 300),
        arabic: boundedString(value.arabic, 300),
        given: boundedString(value.given, 300),
        expected: boundedString(value.expected, 300),
        lessonId: context.lessonIds.has(value.lessonId) ? value.lessonId : "",
        wordId: context.vocabularyIds.has(value.wordId) ? value.wordId : "",
        resolved: Boolean(value.resolved),
        createdAt: safeIsoDate(value.createdAt),
        resolvedAt: value.resolved ? safeIsoDate(value.resolvedAt) : ""
      }])
  );
}

function boundedInteger(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function boundedString(value, maxLength) {
  return String(value || "").slice(0, maxLength);
}

function safeIsoDate(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function defaultProgressForUser(curriculum, user) {
  const base = clone(curriculum.defaultProgress);
  if (user.userId !== "demo-user") {
    base.currentLessonId = curriculum.lessons[0]?.id || "lesson-1";
    base.completedLessonIds = [];
    base.learnedVocabularyIds = [];
    base.exerciseAttempts = {};
    base.dailyStreakDays = 0;
    base.xp = 0;
    base.weeklyGoalCompleted = 0;
  }

  return {
    ...base,
    userId: user.userId,
    displayName: user.displayName || "Student",
    vocabularyStats: {},
    mistakes: {},
    writingAttempts: {},
    exerciseAnswers: {}
  };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(requestError("Request body is too large.", 413));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(requestError("Invalid JSON body.", 400));
      }
    });
    request.on("error", reject);
  });
}

async function createStore() {
  const curriculum = readJson(dataPath);

  if (process.env.MONGODB_URI) {
    try {
      const { MongoClient } = require("mongodb");
      const client = new MongoClient(process.env.MONGODB_URI);
      await client.connect();
      const database = client.db(process.env.MONGODB_DB || "madinah_arabic");
      await syncMongoCurriculum(database, curriculum);
      await seedMongoUsersFromLocalFiles(database, curriculum);
      return createMongoStore(database, curriculum);
    } catch (error) {
      console.warn(`MongoDB unavailable, using local JSON persistence: ${error.message}`);
    }
  }

  return createJsonStore(curriculum);
}

async function syncMongoCurriculum(database, curriculum) {
  await syncStaticCollection(database, "books", curriculum.books, "slug");
  await syncStaticCollection(database, "lessons", curriculum.lessons, "id");
  await syncStaticCollection(database, "vocabulary", curriculum.vocabulary, "id");
  await syncStaticCollection(database, "grammar", curriculum.grammar, "id");
  await syncStaticCollection(database, "exercises", curriculum.exercises, "id");
  await syncStaticCollection(database, "resources", curriculum.resources, "id");

  await database.collection("userProgress").updateOne(
    { userId: "demo-user" },
    { $setOnInsert: { ...curriculum.defaultProgress, updatedAt: new Date() } },
    { upsert: true }
  );
}

async function syncStaticCollection(database, collectionName, docs, key) {
  const collection = database.collection(collectionName);
  const keyedDocs = docs.filter((doc) => doc[key]);

  if (keyedDocs.length) {
    await collection.bulkWrite(
      keyedDocs.map((doc) => ({
        replaceOne: {
          filter: { [key]: doc[key] },
          replacement: doc,
          upsert: true
        }
      })),
      { ordered: false }
    );
  }

  await collection.deleteMany({ [key]: { $nin: keyedDocs.map((doc) => doc[key]) } });
}

async function seedMongoUsersFromLocalFiles(database, curriculum) {
  if (!fs.existsSync(usersPath)) return;

  const users = readJson(usersPath).users || [];
  const savedProgress = fs.existsSync(progressUsersPath) ? readJson(progressUsersPath) : {};

  for (const user of users) {
    const email = normalizeEmail(user.email);
    if (!email || !user.passwordHash) continue;

    const seededUser = {
      ...user,
      email,
      displayName: user.displayName || "Student",
      subscriptionPlan: normalizeSubscriptionPlan(user.subscriptionPlan),
      subscriptionStatus: normalizeSubscriptionStatus(user.subscriptionStatus),
      subscriptionEndsAt: user.subscriptionEndsAt || null
    };

    await database.collection("users").updateOne(
      { email },
      { $setOnInsert: seededUser },
      { upsert: true }
    );

    const progress = mergeProgress(defaultProgressForUser(curriculum, seededUser), savedProgress[user.userId] || {});
    await database.collection("userProgress").updateOne(
      { userId: user.userId },
      { $setOnInsert: progress },
      { upsert: true }
    );
  }
}

function createMongoStore(database, fallbackCurriculum) {
  async function getProgress(userId) {
    const progress = await database.collection("userProgress").findOne({ userId }, { projection: { _id: 0 } });
    if (progress) return mergeProgress(defaultProgressForUser(fallbackCurriculum, publicUser(userId)), progress);
    return defaultProgressForUser(fallbackCurriculum, publicUser(userId));
  }

  return {
    mode: "mongodb",
    async bootstrap(userId = "demo-user") {
      const [books, lessons, vocabulary, grammar, exercises, resources, progress, user] = await Promise.all([
        database.collection("books").find({}, { projection: { _id: 0 } }).toArray(),
        database.collection("lessons").find({}, { projection: { _id: 0 } }).sort({ bookSlug: 1, sequence: 1 }).toArray(),
        database.collection("vocabulary").find({}, { projection: { _id: 0 } }).sort({ bookSlug: 1, sequence: 1, id: 1 }).toArray(),
        database.collection("grammar").find({}, { projection: { _id: 0 } }).sort({ bookSlug: 1, sequence: 1 }).toArray(),
        database.collection("exercises").find({}, { projection: { _id: 0 } }).sort({ bookSlug: 1, sequence: 1 }).toArray(),
        database.collection("resources").find({}, { projection: { _id: 0 } }).toArray(),
        getProgress(userId),
        database.collection("users").findOne({ userId }, { projection: { _id: 0, passwordHash: 0 } })
      ]);

      const publicRecord = user ? publicUserFromRecord(user) : publicUser("demo-user", progress.displayName);
      return filterBootstrapPayload({
        books,
        lessons,
        vocabulary,
        grammar,
        exercises,
        resources,
        progress,
        user: publicRecord,
        databaseMode: "mongodb"
      }, fallbackCurriculum, publicRecord);
    },
    async updateProgress(userId, patch) {
      const current = await getProgress(userId);
      const userRecord = await database.collection("users").findOne({ userId }, { projection: { _id: 0, passwordHash: 0 } });
      const user = userRecord ? publicUserFromRecord(userRecord) : publicUser(userId);
      const sanitizedPatch = sanitizeProgressPatch(patch, current, fallbackCurriculum, user);
      const progress = mergeProgress(current, sanitizedPatch);
      await database.collection("userProgress").updateOne(
        { userId },
        { $set: { ...progress, updatedAt: new Date() } },
        { upsert: true }
      );
      return filterProgressForUser(progress, fallbackCurriculum, user);
    },
    async register({ displayName, email, password }) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail || !password) throw requestError("Email and password are required.", 400);
      const existing = await database.collection("users").findOne({ email: normalizedEmail });
      if (existing) throw requestError("An account with that email already exists.", 409);
      const user = {
        userId: `user-${crypto.randomUUID()}`,
        displayName: String(displayName || "Student").trim() || "Student",
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        subscriptionPlan: "free",
        subscriptionStatus: "active",
        subscriptionEndsAt: null,
        createdAt: new Date()
      };
      await database.collection("users").insertOne(user);
      await database.collection("userProgress").insertOne(defaultProgressForUser(fallbackCurriculum, user));
      return publicUserFromRecord(user);
    },
    async login({ email, password }) {
      const normalizedEmail = normalizeEmail(email);
      const user = await database.collection("users").findOne({ email: normalizedEmail });
      if (!user || !verifyPassword(password, user.passwordHash)) throw requestError("Invalid email or password.", 401);
      return publicUserFromRecord(user);
    }
  };
}

function createJsonStore(curriculum) {
  if (!fs.existsSync(progressPath)) {
    writeJson(progressPath, curriculum.defaultProgress);
  }
  if (!fs.existsSync(usersPath)) {
    writeJson(usersPath, { users: [] });
  }
  if (!fs.existsSync(progressUsersPath)) {
    writeJson(progressUsersPath, {});
  }

  function readUsers() {
    return readJson(usersPath).users || [];
  }

  function writeUsers(users) {
    writeJson(usersPath, { users });
  }

  function getJsonProgress(user) {
    if (user.userId === "demo-user") {
      return mergeProgress(defaultProgressForUser(curriculum, user), readJson(progressPath));
    }

    const allProgress = readJson(progressUsersPath);
    return mergeProgress(defaultProgressForUser(curriculum, user), allProgress[user.userId] || {});
  }

  function writeJsonProgress(userId, progress) {
    if (userId === "demo-user") {
      writeJson(progressPath, progress);
      return;
    }

    const allProgress = readJson(progressUsersPath);
    allProgress[userId] = progress;
    writeJson(progressUsersPath, allProgress);
  }

  function findUser(userId) {
    if (userId === "demo-user") return publicUser("demo-user", readJson(progressPath).displayName);
    const user = readUsers().find((item) => item.userId === userId);
    return user ? publicUserFromRecord(user) : publicUser("demo-user", readJson(progressPath).displayName);
  }

  return {
    mode: "json",
    async bootstrap(userId = "demo-user") {
      const user = findUser(userId);
      return filterBootstrapPayload({
        books: curriculum.books,
        lessons: curriculum.lessons,
        vocabulary: curriculum.vocabulary,
        grammar: curriculum.grammar,
        exercises: curriculum.exercises,
        resources: curriculum.resources,
        progress: getJsonProgress(user),
        user,
        databaseMode: "local-json"
      }, curriculum, user);
    },
    async updateProgress(userId, patch) {
      const user = findUser(userId);
      const current = getJsonProgress(user);
      const sanitizedPatch = sanitizeProgressPatch(patch, current, curriculum, user);
      const progress = mergeProgress(current, sanitizedPatch);
      writeJsonProgress(user.userId, progress);
      return filterProgressForUser(progress, curriculum, user);
    },
    async register({ displayName, email, password }) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail || !password) throw requestError("Email and password are required.", 400);
      const users = readUsers();
      if (users.some((user) => user.email === normalizedEmail)) throw requestError("An account with that email already exists.", 409);
      const user = {
        userId: `user-${crypto.randomUUID()}`,
        displayName: String(displayName || "Student").trim() || "Student",
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        subscriptionPlan: "free",
        subscriptionStatus: "active",
        subscriptionEndsAt: null,
        createdAt: new Date().toISOString()
      };
      users.push(user);
      writeUsers(users);
      writeJsonProgress(user.userId, defaultProgressForUser(curriculum, user));
      return publicUserFromRecord(user);
    },
    async login({ email, password }) {
      const normalizedEmail = normalizeEmail(email);
      const user = readUsers().find((item) => item.email === normalizedEmail);
      if (!user || !verifyPassword(password, user.passwordHash)) throw requestError("Invalid email or password.", 401);
      return publicUserFromRecord(user);
    }
  };
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function mergeProgress(current, patch) {
  const completedLessonIds = unique([...(current.completedLessonIds || []), ...(patch.completedLessonIds || [])]);
  const learnedVocabularyIds = unique([...(current.learnedVocabularyIds || []), ...(patch.learnedVocabularyIds || [])]);
  const exerciseAttempts = {
    ...(current.exerciseAttempts || {}),
    ...(patch.exerciseAttempts || {})
  };
  const vocabularyStats = {
    ...(current.vocabularyStats || {}),
    ...(patch.vocabularyStats || {})
  };
  const mistakes = {
    ...(current.mistakes || {}),
    ...(patch.mistakes || {})
  };
  const writingAttempts = {
    ...(current.writingAttempts || {}),
    ...(patch.writingAttempts || {})
  };
  const exerciseAnswers = {
    ...(current.exerciseAnswers || {}),
    ...(patch.exerciseAnswers || {})
  };

  return {
    ...current,
    ...patch,
    completedLessonIds,
    learnedVocabularyIds,
    exerciseAttempts,
    vocabularyStats,
    mistakes,
    writingAttempts,
    exerciseAnswers,
    xp: Math.max(Number(current.xp || 0), Number(patch.xp || current.xp || 0)),
    updatedAt: new Date().toISOString()
  };
}

function responseHeaders(headers = {}) {
  return { ...baseSecurityHeaders, ...headers };
}

function sendJson(response, statusCode, value, headers = {}) {
  response.writeHead(statusCode, responseHeaders({ "content-type": "application/json; charset=utf-8", ...headers }));
  response.end(JSON.stringify(value));
}

function sendStatic(request, response) {
  const parsedUrl = new URL(request.url, "http://localhost");
  const pathname = parsedUrl.pathname === "/" ? "/index.html" : parsedUrl.pathname;
  const filePath = path.normalize(path.join(root, pathname));
  const relativePath = path.relative(root, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    response.writeHead(403, responseHeaders());
    response.end("Forbidden");
    return;
  }

  if (!publicStaticFiles.has(pathname)) {
    response.writeHead(404, responseHeaders());
    response.end("Not found");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, responseHeaders());
      response.end("Not found");
      return;
    }

    const extension = path.extname(filePath);
    response.writeHead(200, responseHeaders({
      "content-type": contentTypes[extension] || "application/octet-stream",
      "cache-control": "no-store"
    }));
    response.end(data);
  });
}

async function start() {
  const store = await createStore();

  const server = http.createServer(async (request, response) => {
    try {
      const parsedUrl = new URL(request.url, "http://localhost");

      if (request.method === "GET" && parsedUrl.pathname === "/api/bootstrap") {
        sendJson(response, 200, await store.bootstrap(userFromRequest(request)));
        return;
      }

      if (request.method === "PATCH" && parsedUrl.pathname === "/api/progress") {
        const userId = authenticatedUserFromRequest(request);
        if (!userId) {
          sendJson(response, 401, { error: "Sign in required to save progress." });
          return;
        }

        sendJson(response, 200, { progress: await store.updateProgress(userId, await readBody(request)) });
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/auth/register") {
        const body = await readBody(request);
        enforceAuthRateLimit(request, "register", body.email);
        const user = await store.register(body);
        const sessionToken = createSession(user);
        clearAuthRateLimit(request, "register", body.email);
        sendJson(
          response,
          200,
          { user, progress: (await store.bootstrap(user.userId)).progress },
          { "set-cookie": sessionCookie(sessionToken, request) }
        );
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/auth/login") {
        const body = await readBody(request);
        enforceAuthRateLimit(request, "login", body.email);
        const user = await store.login(body);
        const sessionToken = createSession(user);
        clearAuthRateLimit(request, "login", body.email);
        sendJson(
          response,
          200,
          { user, progress: (await store.bootstrap(user.userId)).progress },
          { "set-cookie": sessionCookie(sessionToken, request) }
        );
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/auth/logout") {
        const token = sessionTokenFromRequest(request);
        if (token) sessions.delete(token);
        sendJson(response, 200, { ok: true }, { "set-cookie": clearSessionCookie(request) });
        return;
      }

      if (parsedUrl.pathname.startsWith("/api/")) {
        sendJson(response, 404, { error: "API endpoint not found." });
        return;
      }

      sendStatic(request, response);
    } catch (error) {
      sendJson(response, error.statusCode || 500, { error: error.message });
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Madinah Arabic is running at http://localhost:${port}`);
    console.log(`Database mode: ${store.mode}`);
    console.log(`Workspace: ${pathToFileURL(root).href}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
