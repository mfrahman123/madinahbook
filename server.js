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
  sessions.set(token, { userId: user.userId, createdAt: new Date().toISOString() });
  return token;
}

function userFromRequest(request) {
  const token = request.headers["x-session-token"];
  return sessions.get(token)?.userId || "demo-user";
}

function authenticatedUserFromRequest(request) {
  const token = request.headers["x-session-token"];
  return sessions.get(token)?.userId || "";
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

      return {
        books,
        lessons,
        vocabulary,
        grammar,
        exercises,
        resources,
        progress,
        user: user ? publicUserFromRecord(user) : publicUser("demo-user", progress.displayName),
        databaseMode: "mongodb"
      };
    },
    async updateProgress(userId, patch) {
      const current = await getProgress(userId);
      const progress = mergeProgress(current, patch);
      await database.collection("userProgress").updateOne(
        { userId },
        { $set: { ...progress, updatedAt: new Date() } },
        { upsert: true }
      );
      return progress;
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
      return {
        books: curriculum.books,
        lessons: curriculum.lessons,
        vocabulary: curriculum.vocabulary,
        grammar: curriculum.grammar,
        exercises: curriculum.exercises,
        resources: curriculum.resources,
        progress: getJsonProgress(user),
        user,
        databaseMode: "local-json"
      };
    },
    async updateProgress(userId, patch) {
      const user = findUser(userId);
      const progress = mergeProgress(getJsonProgress(user), patch);
      writeJsonProgress(user.userId, progress);
      return progress;
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

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function sendStatic(request, response) {
  const parsedUrl = new URL(request.url, "http://localhost");
  const pathname = parsedUrl.pathname === "/" ? "/index.html" : parsedUrl.pathname;
  const filePath = path.normalize(path.join(root, pathname));
  const relativePath = path.relative(root, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!publicStaticFiles.has(pathname)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const extension = path.extname(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[extension] || "application/octet-stream",
      "cache-control": "no-store"
    });
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
        const user = await store.register(await readBody(request));
        const sessionToken = createSession(user);
        sendJson(response, 200, { user, sessionToken, progress: (await store.bootstrap(user.userId)).progress });
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/auth/login") {
        const user = await store.login(await readBody(request));
        const sessionToken = createSession(user);
        sendJson(response, 200, { user, sessionToken, progress: (await store.bootstrap(user.userId)).progress });
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/auth/logout") {
        const token = request.headers["x-session-token"];
        if (token) sessions.delete(token);
        sendJson(response, 200, { ok: true });
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
