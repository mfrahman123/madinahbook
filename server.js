const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
let StripeSdk = null;

try {
  StripeSdk = require("stripe");
} catch {
  StripeSdk = null;
}

const root = __dirname;
const dataRoot = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, "data");
const dataPath = path.join(dataRoot, "curriculum.json");
const progressPath = path.join(dataRoot, "progress.json");
const usersPath = path.join(dataRoot, "users.json");
const progressUsersPath = path.join(dataRoot, "progress-users.json");

loadLocalEnv(path.join(root, ".env"));

const port = Number(process.env.PORT || 4173);
let authStateStore = createMemoryAuthStateStore();
const jwksCache = new Map();
const sessionCookieName = "madinah_session";
const sessionTtlMs = Number(process.env.SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000);
const authWindowMs = Number(process.env.AUTH_RATE_WINDOW_MS || 15 * 60 * 1000);
const authMaxByIdentity = Number(process.env.AUTH_RATE_MAX_IDENTITY || 8);
const authMaxByIp = Number(process.env.AUTH_RATE_MAX_IP || 40);
const maxXpIncreasePerSave = Number(process.env.MAX_XP_INCREASE_PER_SAVE || 100);
const tokenTtlMs = Number(process.env.AUTH_TOKEN_TTL_MS || 30 * 60 * 1000);
const oauthStateTtlMs = Number(process.env.OAUTH_STATE_TTL_MS || 10 * 60 * 1000);
const isProduction = process.env.NODE_ENV === "production";
const host = process.env.HOST || (isProduction ? "0.0.0.0" : "127.0.0.1");
const allowUnsafeProductionJsonFallback = process.env.ALLOW_UNSAFE_PRODUCTION_JSON_FALLBACK === "true";
const serviceName = process.env.OBSERVABILITY_SERVICE_NAME || "madinah-arabic";
const observabilityWebhookUrl = process.env.OBSERVABILITY_WEBHOOK_URL || "";
const observabilityWebhookSecret = process.env.OBSERVABILITY_WEBHOOK_SECRET || "";
const observabilitySampleRate = boundedNumber(process.env.OBSERVABILITY_SAMPLE_RATE, 1, 0, 1);
const observabilityTimeoutMs = boundedNumber(process.env.OBSERVABILITY_TIMEOUT_MS, 2500, 250, 10_000);
const logForwarder = createLogForwarder();
const stripeApiVersion = "2026-02-25.clover";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripePremiumPriceId = process.env.STRIPE_PREMIUM_PRICE_ID || "";
const stripePremiumPriceLabel = process.env.STRIPE_PREMIUM_PRICE_LABEL || "Premium subscription";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const stripeClient = createStripeClient();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

const publicStaticFiles = new Set([
  "/index.html",
  "/learning-core.js",
  "/app.js",
  "/styles.css",
  "/manifest.webmanifest",
  "/service-worker.js",
  "/assets/madinah-icon.svg",
  "/design/font-comparison-home.svg",
  "/design/font-comparison-home.svg.png"
]);

const baseSecurityHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "x-frame-options": "DENY",
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
};

const emailService = createEmailService();

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

function structuredLog(level, event, details = {}) {
  if (!shouldLogEvent(level, event)) return null;

  const entry = sanitizeLogEntry({
    level,
    event,
    timestamp: new Date().toISOString(),
    service: serviceName,
    environment: process.env.NODE_ENV || "development",
    release: process.env.HEROKU_SLUG_COMMIT || process.env.SOURCE_VERSION || "",
    ...details
  });

  console.log(JSON.stringify(entry));
  logForwarder.forward(entry);
  return entry;
}

function shouldLogEvent(level, event) {
  if (observabilitySampleRate >= 1) return true;
  if (level === "error" || level === "warn") return true;
  if (event !== "http.request") return true;
  return Math.random() < observabilitySampleRate;
}

function sanitizeLogEntry(entry) {
  return Object.fromEntries(
    Object.entries(entry)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, sanitizeLogValue(key, value, 0)])
  );
}

function sanitizeLogValue(key, value, depth) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalizedKey = String(key).toLowerCase();
  if (/(authorization|cookie|password|secret|token|private.?key|api.?key|session)/i.test(normalizedKey)) {
    return "[redacted]";
  }

  if (typeof value === "string") {
    if (normalizedKey.includes("email") || ["to", "from", "replyto", "reply_to"].includes(normalizedKey)) {
      return redactEmail(value);
    }
    return redactSensitiveUrlParams(boundedString(value, 1500));
  }

  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return depth >= 3 ? `[array:${value.length}]` : value.slice(0, 25).map((item) => sanitizeLogValue(key, item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= 3) return "[object]";
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .filter(([, itemValue]) => itemValue !== undefined)
        .map(([itemKey, itemValue]) => [itemKey, sanitizeLogValue(itemKey, itemValue, depth + 1)])
    );
  }

  return String(value);
}

function redactSensitiveUrlParams(value) {
  return String(value || "").replace(/([?&](?:token|code|state|session|secret|api_key|apikey|key)=)[^&#\s"']+/gi, "$1[redacted]");
}

function redactEmail(value) {
  const email = normalizeEmail(value);
  if (!email || !email.includes("@")) return boundedString(value, 120);
  const [local, domain] = email.split("@");
  const digest = crypto.createHash("sha256").update(email).digest("hex").slice(0, 12);
  return `${local.slice(0, 2)}***@${domain}#${digest}`;
}

function createLogForwarder() {
  let failureCount = 0;

  return {
    forward(entry) {
      if (!observabilityWebhookUrl) return;
      if (!/^https?:\/\//i.test(observabilityWebhookUrl)) return;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), observabilityTimeoutMs);
      fetch(observabilityWebhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(observabilityWebhookSecret ? { "x-observability-secret": observabilityWebhookSecret } : {})
        },
        body: JSON.stringify(entry),
        signal: controller.signal
      })
        .then((response) => {
          clearTimeout(timeout);
          if (!response.ok && failureCount < 3) {
            failureCount += 1;
            console.warn(JSON.stringify({
              level: "warn",
              event: "observability.forward_failed",
              timestamp: new Date().toISOString(),
              service: serviceName,
              statusCode: response.status
            }));
          }
        })
        .catch((error) => {
          clearTimeout(timeout);
          if (failureCount < 3) {
            failureCount += 1;
            console.warn(JSON.stringify({
              level: "warn",
              event: "observability.forward_failed",
              timestamp: new Date().toISOString(),
              service: serviceName,
              message: boundedString(error.message, 180)
            }));
          }
        });
    }
  };
}

function createStripeClient() {
  if (!stripeSecretKey || !StripeSdk) return null;
  return new StripeSdk(stripeSecretKey, {
    apiVersion: stripeApiVersion,
    appInfo: {
      name: "Madinah Arabic",
      version: "1.0.0"
    }
  });
}

function publicBillingConfig() {
  return {
    provider: "stripe",
    checkoutConfigured: Boolean(stripeClient && stripePremiumPriceId),
    portalConfigured: Boolean(stripeClient),
    priceLabel: stripePremiumPriceLabel
  };
}

function requireStripeCheckoutConfigured() {
  if (!StripeSdk) throw requestError("Stripe SDK is not installed.", 503);
  if (!stripeClient || !stripePremiumPriceId) {
    throw requestError("Stripe checkout is not configured.", 503);
  }
}

function requireStripeClientConfigured() {
  if (!StripeSdk) throw requestError("Stripe SDK is not installed.", 503);
  if (!stripeClient) throw requestError("Stripe billing is not configured.", 503);
}

function requireStripeWebhookConfigured() {
  if (!StripeSdk) throw requestError("Stripe SDK is not installed.", 503);
  if (!stripeClient || !stripeWebhookSecret) {
    throw requestError("Stripe webhook verification is not configured.", 503);
  }
}

function billingReturnUrl(request, billingState = "") {
  const url = new URL(requestOrigin(request));
  url.searchParams.set("route", "subscription");
  if (billingState) url.searchParams.set("billing", billingState);
  return url.toString();
}

function stripeStringId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.id || "";
}

function stripeTimestampToIso(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? new Date(number * 1000).toISOString() : null;
}

function mapStripeSubscriptionStatus(status) {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  return "cancelled";
}

function billingPatchFromStripeSubscription(subscription) {
  const subscriptionStatus = mapStripeSubscriptionStatus(subscription.status);
  const priceId = subscription.items?.data?.[0]?.price?.id || stripePremiumPriceId || "";
  return sanitizeBillingPatch({
    billingProvider: "stripe",
    stripeCustomerId: stripeStringId(subscription.customer),
    stripeSubscriptionId: stripeStringId(subscription.id),
    stripePriceId: priceId,
    stripeSubscriptionStatus: subscription.status || "",
    stripeCancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    subscriptionPlan: subscriptionStatus === "active" ? "paid" : "free",
    subscriptionStatus,
    subscriptionEndsAt: stripeTimestampToIso(subscription.current_period_end || subscription.cancel_at)
  });
}

function billingPatchFromCheckoutSession(session) {
  return sanitizeBillingPatch({
    billingProvider: "stripe",
    stripeCustomerId: stripeStringId(session.customer),
    stripeSubscriptionId: stripeStringId(session.subscription),
    stripePriceId: stripePremiumPriceId
  });
}

function sanitizeBillingPatch(patch = {}) {
  const sanitized = {};
  if (patch.billingProvider !== undefined) sanitized.billingProvider = patch.billingProvider === "stripe" ? "stripe" : "";
  if (patch.stripeCustomerId !== undefined) sanitized.stripeCustomerId = boundedString(patch.stripeCustomerId, 255);
  if (patch.stripeSubscriptionId !== undefined) sanitized.stripeSubscriptionId = boundedString(patch.stripeSubscriptionId, 255);
  if (patch.stripePriceId !== undefined) sanitized.stripePriceId = boundedString(patch.stripePriceId, 255);
  if (patch.stripeSubscriptionStatus !== undefined) sanitized.stripeSubscriptionStatus = boundedString(patch.stripeSubscriptionStatus, 80);
  if (patch.stripeCancelAtPeriodEnd !== undefined) sanitized.stripeCancelAtPeriodEnd = Boolean(patch.stripeCancelAtPeriodEnd);
  if (patch.subscriptionPlan !== undefined) sanitized.subscriptionPlan = normalizeSubscriptionPlan(patch.subscriptionPlan);
  if (patch.subscriptionStatus !== undefined) sanitized.subscriptionStatus = normalizeSubscriptionStatus(patch.subscriptionStatus);
  if (patch.subscriptionEndsAt !== undefined) sanitized.subscriptionEndsAt = patch.subscriptionEndsAt || null;
  return sanitized;
}

async function ensureStripeCustomerForUser(store, request, userId) {
  requireStripeCheckoutConfigured();
  const user = await store.billingUser(userId);
  if (!user || user.isDemo) throw requestError("Sign in required.", 401);
  if (user.stripeCustomerId) return user.stripeCustomerId;

  try {
    const customer = await stripeClient.customers.create({
      email: user.email,
      name: user.displayName,
      metadata: {
        userId,
        app: "madinah-arabic"
      }
    });
    await store.updateBillingUser(userId, {
      billingProvider: "stripe",
      stripeCustomerId: customer.id
    });
    structuredLog("info", "stripe.customer_created", { requestId: request.requestId, userId, stripeCustomerId: customer.id });
    return customer.id;
  } catch (error) {
    structuredLog("error", "stripe.customer_create_failed", {
      requestId: request.requestId,
      userId,
      message: error.message
    });
    throw requestError("Unable to prepare Stripe customer.", 502);
  }
}

async function createStripeCheckoutSession(request, store, userId) {
  const user = await store.billingUser(userId);
  if (!user || user.isDemo) throw requestError("Sign in required.", 401);
  const customerId = await ensureStripeCustomerForUser(store, request, userId);

  try {
    const session = await stripeClient.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: stripePremiumPriceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: billingReturnUrl(request, "success"),
      cancel_url: billingReturnUrl(request, "cancelled"),
      metadata: {
        userId,
        app: "madinah-arabic"
      },
      subscription_data: {
        metadata: {
          userId,
          app: "madinah-arabic"
        }
      }
    });
    structuredLog("info", "stripe.checkout_session_created", {
      requestId: request.requestId,
      userId,
      stripeCustomerId: customerId,
      checkoutSessionId: session.id
    });
    return session;
  } catch (error) {
    structuredLog("error", "stripe.checkout_session_failed", {
      requestId: request.requestId,
      userId,
      message: error.message
    });
    throw requestError("Unable to start Stripe checkout.", 502);
  }
}

async function createStripePortalSession(request, store, userId) {
  requireStripeClientConfigured();
  const user = await store.billingUser(userId);
  if (!user || user.isDemo) throw requestError("Sign in required.", 401);
  if (!user.stripeCustomerId) throw requestError("No Stripe customer is linked to this account yet.", 400);

  try {
    const session = await stripeClient.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: billingReturnUrl(request)
    });
    structuredLog("info", "stripe.portal_session_created", {
      requestId: request.requestId,
      userId,
      stripeCustomerId: user.stripeCustomerId
    });
    return session;
  } catch (error) {
    structuredLog("error", "stripe.portal_session_failed", {
      requestId: request.requestId,
      userId,
      message: error.message
    });
    throw requestError("Unable to open Stripe billing portal.", 502);
  }
}

function verifyStripeWebhook(rawBody, signature) {
  requireStripeWebhookConfigured();
  try {
    return stripeClient.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
  } catch {
    throw requestError("Stripe webhook signature verification failed.", 400);
  }
}

async function handleStripeWebhook(store, event) {
  const object = event.data?.object || {};

  if (event.type === "checkout.session.completed") {
    await syncStripeCheckoutSession(store, object);
    return;
  }

  if (event.type?.startsWith("customer.subscription.")) {
    await syncStripeSubscription(store, object);
    return;
  }

  structuredLog("info", "stripe.webhook_ignored", {
    stripeEventId: event.id,
    stripeEventType: event.type
  });
}

async function syncStripeCheckoutSession(store, session) {
  const userId = session.client_reference_id || session.metadata?.userId || "";
  if (!userId) {
    structuredLog("warn", "stripe.checkout_missing_user", { checkoutSessionId: session.id });
    return;
  }

  await store.updateBillingUser(userId, billingPatchFromCheckoutSession(session));
  structuredLog("info", "stripe.checkout_completed", {
    userId,
    stripeCustomerId: stripeStringId(session.customer),
    stripeSubscriptionId: stripeStringId(session.subscription)
  });
}

async function syncStripeSubscription(store, subscription) {
  const customerId = stripeStringId(subscription.customer);
  const metadataUserId = subscription.metadata?.userId || "";
  const existingUser = metadataUserId ? null : await store.billingUserByStripeCustomer(customerId);
  const userId = metadataUserId || existingUser?.userId || "";

  if (!userId) {
    structuredLog("warn", "stripe.subscription_missing_user", {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionStatus: subscription.status
    });
    return;
  }

  await store.updateBillingUser(userId, billingPatchFromStripeSubscription(subscription));
  structuredLog("info", "stripe.subscription_synced", {
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripeSubscriptionStatus: subscription.status
  });
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

async function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  await authStateStore.createSession({
    token,
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

async function sessionFromToken(token) {
  if (!token) return null;
  const session = await authStateStore.getSession(token);
  if (!session) return null;
  if (Number(session.expiresAt || 0) <= Date.now()) {
    await authStateStore.deleteSession(token);
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

async function userFromRequest(request) {
  return (await sessionFromToken(sessionTokenFromRequest(request)))?.userId || "demo-user";
}

async function authenticatedUserFromRequest(request) {
  return (await sessionFromToken(sessionTokenFromRequest(request)))?.userId || "";
}

function clientIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.socket.remoteAddress || "unknown";
}

function requestIdFromRequest(request) {
  const headerValue = String(request.headers["x-request-id"] || "").trim();
  if (/^[A-Za-z0-9._:-]{8,120}$/.test(headerValue)) return headerValue;
  return crypto.randomUUID();
}

function hashIdentifier(value) {
  return crypto.createHash("sha256").update(String(value || "unknown")).digest("hex").slice(0, 16);
}

async function enforceAuthRateLimit(request, purpose, email) {
  const ip = clientIp(request);
  const normalizedEmail = normalizeEmail(email) || "unknown";
  await authStateStore.touchRateLimit(`${purpose}:ip:${ip}`, authWindowMs, authMaxByIp);
  await authStateStore.touchRateLimit(`${purpose}:identity:${ip}:${normalizedEmail}`, authWindowMs, authMaxByIdentity);
}

async function clearAuthRateLimit(request, purpose, email) {
  const ip = clientIp(request);
  const normalizedEmail = normalizeEmail(email) || "unknown";
  await authStateStore.clearRateLimit(`${purpose}:identity:${ip}:${normalizedEmail}`);
}

function createMemoryAuthStateStore() {
  const sessions = new Map();
  const authAttempts = new Map();
  const oauthStates = new Map();

  function cleanupOAuthStates() {
    const now = Date.now();
    for (const [state, record] of oauthStates.entries()) {
      if (!record || Number(record.expiresAt || 0) <= now) oauthStates.delete(state);
    }
  }

  return {
    mode: "memory",
    async createSession(session) {
      sessions.set(session.token, session);
    },
    async getSession(token) {
      return sessions.get(token) || null;
    },
    async deleteSession(token) {
      sessions.delete(token);
    },
    async touchRateLimit(key, windowMs, maxAttempts) {
      const now = Date.now();
      const recent = (authAttempts.get(key) || []).filter((time) => now - time < windowMs);
      if (recent.length >= maxAttempts) {
        authAttempts.set(key, recent);
        throw requestError("Too many attempts. Please wait before trying again.", 429);
      }
      recent.push(now);
      authAttempts.set(key, recent);
    },
    async clearRateLimit(key) {
      authAttempts.delete(key);
    },
    async createOAuthState(record) {
      cleanupOAuthStates();
      oauthStates.set(record.state, record);
    },
    async consumeOAuthState(state) {
      cleanupOAuthStates();
      const record = oauthStates.get(state) || null;
      oauthStates.delete(state);
      return record;
    }
  };
}

async function createMongoAuthStateStore(database) {
  const sessionsCollection = database.collection("authSessions");
  const rateLimitsCollection = database.collection("authRateLimits");
  const oauthStatesCollection = database.collection("oauthStates");

  await Promise.all([
    sessionsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    rateLimitsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    oauthStatesCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  ]);

  function resultDocument(result) {
    return result?.value || result || null;
  }

  return {
    mode: "mongodb",
    async createSession(session) {
      await sessionsCollection.replaceOne(
        { _id: session.token },
        {
          _id: session.token,
          userId: session.userId,
          createdAt: new Date(session.createdAt),
          expiresAt: new Date(session.expiresAt)
        },
        { upsert: true }
      );
    },
    async getSession(token) {
      const session = await sessionsCollection.findOne({ _id: token });
      if (!session) return null;
      return {
        userId: session.userId,
        createdAt: Date.parse(session.createdAt),
        expiresAt: Date.parse(session.expiresAt)
      };
    },
    async deleteSession(token) {
      await sessionsCollection.deleteOne({ _id: token });
    },
    async touchRateLimit(key, windowMs, maxAttempts) {
      const now = Date.now();
      const cutoff = now - windowMs;
      const result = await rateLimitsCollection.findOneAndUpdate(
        { _id: key },
        [
          {
            $set: {
              attempts: {
                $filter: {
                  input: { $ifNull: ["$attempts", []] },
                  as: "time",
                  cond: { $gte: ["$$time", cutoff] }
                }
              }
            }
          },
          { $set: { limited: { $gte: [{ $size: "$attempts" }, maxAttempts] } } },
          {
            $set: {
              attempts: {
                $cond: [
                  "$limited",
                  "$attempts",
                  { $concatArrays: ["$attempts", [now]] }
                ]
              },
              expiresAt: new Date(now + windowMs),
              updatedAt: new Date(now)
            }
          }
        ],
        { upsert: true, returnDocument: "after" }
      );
      const record = resultDocument(result);
      if (record?.limited) throw requestError("Too many attempts. Please wait before trying again.", 429);
    },
    async clearRateLimit(key) {
      await rateLimitsCollection.deleteOne({ _id: key });
    },
    async createOAuthState(record) {
      await oauthStatesCollection.replaceOne(
        { _id: record.state },
        {
          _id: record.state,
          provider: record.provider,
          nonce: record.nonce,
          codeVerifier: record.codeVerifier,
          expiresAt: new Date(record.expiresAt)
        },
        { upsert: true }
      );
    },
    async consumeOAuthState(state) {
      const result = await oauthStatesCollection.findOneAndDelete({ _id: state });
      const record = resultDocument(result);
      if (!record) return null;
      return {
        provider: record.provider,
        nonce: record.nonce,
        codeVerifier: record.codeVerifier,
        expiresAt: Date.parse(record.expiresAt)
      };
    }
  };
}

function createOneTimeToken() {
  const token = crypto.randomBytes(24).toString("hex");
  return {
    token,
    tokenHash: hashOneTimeToken(token),
    expiresAt: new Date(Date.now() + tokenTtlMs).toISOString()
  };
}

function hashOneTimeToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function devTokenPayload(token) {
  return isProduction ? {} : { devToken: token };
}

function isTokenActive(record, hashField, expiryField, token) {
  return record?.[hashField] === hashOneTimeToken(token) && Date.parse(record?.[expiryField] || 0) > Date.now();
}

function normalizeSubscriptionPlan(plan) {
  return plan === "paid" ? "paid" : "free";
}

function normalizeSubscriptionStatus(status) {
  return ["active", "past_due", "cancelled"].includes(status) ? status : "active";
}

function publicUser(
  userId,
  displayName = "Fahima",
  email = "",
  subscriptionPlan = "free",
  subscriptionStatus = "active",
  subscriptionEndsAt = null,
  role = "student",
  emailVerified = false
) {
  return {
    userId,
    displayName,
    email,
    isDemo: userId === "demo-user",
    subscriptionPlan: normalizeSubscriptionPlan(subscriptionPlan),
    subscriptionStatus: normalizeSubscriptionStatus(subscriptionStatus),
    subscriptionEndsAt: subscriptionEndsAt || null,
    role: role === "admin" ? "admin" : "student",
    emailVerified: Boolean(emailVerified)
  };
}

function publicUserFromRecord(user) {
  return {
    ...publicUser(
      user.userId,
      user.displayName,
      user.email,
      user.subscriptionPlan,
      user.subscriptionStatus,
      user.subscriptionEndsAt,
      user.role,
      user.emailVerified
    ),
    billingProvider: user.billingProvider || (user.stripeCustomerId ? "stripe" : ""),
    billingPortalAvailable: Boolean(user.stripeCustomerId)
  };
}

function providerDisplayName(provider) {
  return {
    google: "Google",
    microsoft: "Microsoft",
    apple: "Apple"
  }[provider] || provider;
}

function oauthProviderConfig(provider) {
  const base = {
    google: {
      provider: "google",
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
      scope: "openid email profile",
      issuer: "https://accounts.google.com"
    },
    microsoft: {
      provider: "microsoft",
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      tenant: process.env.MICROSOFT_TENANT || "common",
      scope: "openid email profile"
    },
    apple: {
      provider: "apple",
      clientId: process.env.APPLE_CLIENT_ID,
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKey: normalizePrivateKey(process.env.APPLE_PRIVATE_KEY),
      authorizationUrl: "https://appleid.apple.com/auth/authorize",
      tokenUrl: "https://appleid.apple.com/auth/token",
      jwksUrl: "https://appleid.apple.com/auth/keys",
      scope: "openid email name",
      issuer: "https://appleid.apple.com"
    }
  }[provider];

  if (!base) return null;
  if (provider === "microsoft") {
    base.authorizationUrl = `https://login.microsoftonline.com/${encodeURIComponent(base.tenant)}/oauth2/v2.0/authorize`;
    base.tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(base.tenant)}/oauth2/v2.0/token`;
    base.jwksUrl = `https://login.microsoftonline.com/${encodeURIComponent(base.tenant)}/discovery/v2.0/keys`;
  }
  return base;
}

function isOAuthProviderConfigured(provider) {
  const config = oauthProviderConfig(provider);
  if (!config?.clientId) return false;
  if (provider === "apple") return Boolean(config.teamId && config.keyId && config.privateKey);
  return Boolean(config.clientSecret);
}

function availableOAuthProviderIds() {
  return ["google", "microsoft", "apple"].filter(isOAuthProviderConfigured);
}

function requestOrigin(request) {
  if (process.env.AUTH_BASE_URL) return process.env.AUTH_BASE_URL.replace(/\/$/, "");
  const proto = request.headers["x-forwarded-proto"] || (request.socket.encrypted ? "https" : "http");
  return `${proto}://${request.headers.host}`;
}

function createEmailService() {
  const provider = String(process.env.EMAIL_PROVIDER || inferEmailProvider()).trim().toLowerCase();
  if (!provider) return null;

  const from = String(process.env.EMAIL_FROM || "").trim();
  const fromName = String(process.env.EMAIL_FROM_NAME || "Madinah Arabic").trim();
  const replyTo = String(process.env.EMAIL_REPLY_TO || "").trim();

  if (provider === "sendgrid") {
    const apiKey = String(process.env.SENDGRID_API_KEY || "").trim();
    if (!apiKey || !from) return unavailableEmailService(provider, "SENDGRID_API_KEY and EMAIL_FROM are required.");
    return {
      provider,
      async send(message) {
        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: message.to }], subject: message.subject }],
            from: { email: from, name: fromName },
            ...(replyTo ? { reply_to: { email: replyTo } } : {}),
            content: [
              { type: "text/plain", value: message.text },
              { type: "text/html", value: message.html }
            ]
          })
        });
        if (!response.ok) throw requestError("Email provider rejected the message.", 502);
      }
    };
  }

  if (provider === "resend") {
    const apiKey = String(process.env.RESEND_API_KEY || "").trim();
    if (!apiKey || !from) return unavailableEmailService(provider, "RESEND_API_KEY and EMAIL_FROM are required.");
    return {
      provider,
      async send(message) {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            from: fromName ? `${fromName} <${from}>` : from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
            ...(replyTo ? { reply_to: replyTo } : {})
          })
        });
        if (!response.ok) throw requestError("Email provider rejected the message.", 502);
      }
    };
  }

  if (provider === "webhook") {
    const webhookUrl = String(process.env.EMAIL_WEBHOOK_URL || "").trim();
    const webhookSecret = String(process.env.EMAIL_WEBHOOK_SECRET || "").trim();
    if (!webhookUrl || !from) return unavailableEmailService(provider, "EMAIL_WEBHOOK_URL and EMAIL_FROM are required.");
    return {
      provider,
      async send(message) {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(webhookSecret ? { authorization: `Bearer ${webhookSecret}` } : {})
          },
          body: JSON.stringify({
            provider: "madinah-webhook",
            from,
            fromName,
            replyTo: replyTo || undefined,
            ...message
          })
        });
        if (!response.ok) throw requestError("Email webhook rejected the message.", 502);
      }
    };
  }

  if (provider === "log" && !isProduction) {
    return {
      provider,
      async send(message) {
        structuredLog("info", "email.dev_message", {
          type: message.type,
          to: message.to,
          subject: message.subject,
          actionUrl: message.actionUrl
        });
      }
    };
  }

  return unavailableEmailService(provider, `Unsupported EMAIL_PROVIDER "${provider}".`);
}

function inferEmailProvider() {
  if (process.env.SENDGRID_API_KEY) return "sendgrid";
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.EMAIL_WEBHOOK_URL) return "webhook";
  return "";
}

function unavailableEmailService(provider, reason) {
  return {
    provider,
    unavailable: true,
    reason,
    async send() {
      throw requestError("Email delivery is not configured.", 503);
    }
  };
}

function requireEmailDeliveryConfigured(type) {
  if (!emailService || emailService.unavailable) {
    structuredLog("error", "email.delivery_unconfigured", {
      type,
      provider: emailService?.provider || "none",
      reason: emailService?.reason
    });
    throw requestError("Email delivery is not configured.", 503);
  }
}

async function sendAuthEmail(request, type, tokenRecord) {
  if (!tokenRecord?.email) return false;
  if (!emailService || emailService.unavailable) {
    if (isProduction) requireEmailDeliveryConfigured(type);
    structuredLog("info", "email.delivery_skipped_dev", {
      type,
      to: tokenRecord.email,
      provider: emailService?.provider || "none",
      reason: emailService?.reason
    });
    return false;
  }

  const message = authEmailMessage(request, type, tokenRecord);
  await emailService.send(message);
  structuredLog("info", "email.sent", {
    type,
    provider: emailService.provider,
    to: tokenRecord.email
  });
  return true;
}

function authEmailMessage(request, type, tokenRecord) {
  const config = {
    reset: {
      subject: "Reset your Madinah Arabic password",
      heading: "Reset your password",
      intro: "Use the secure link below to reset your Madinah Arabic password.",
      cta: "Reset password",
      fallback: "If you did not request a password reset, you can ignore this email."
    },
    verify: {
      subject: "Verify your Madinah Arabic email",
      heading: "Verify your email",
      intro: "Confirm this email address so your Madinah Arabic account stays protected.",
      cta: "Verify email",
      fallback: "If you did not create this account, you can ignore this email."
    }
  }[type];

  const actionUrl = authActionUrl(request, type, tokenRecord.token);
  const expiry = new Date(tokenRecord.expiresAt).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London"
  });
  const text = [
    config.heading,
    "",
    config.intro,
    "",
    actionUrl,
    "",
    `This link expires at ${expiry}.`,
    config.fallback,
    "",
    "Madinah Arabic"
  ].join("\n");
  const html = [
    `<p>${escapeHtml(config.intro)}</p>`,
    `<p><a href="${escapeHtml(actionUrl)}">${escapeHtml(config.cta)}</a></p>`,
    `<p>This link expires at ${escapeHtml(expiry)}.</p>`,
    `<p>${escapeHtml(config.fallback)}</p>`
  ].join("");

  return {
    type,
    to: tokenRecord.email,
    subject: config.subject,
    text,
    html,
    actionUrl,
    expiresAt: tokenRecord.expiresAt
  };
}

function authActionUrl(request, type, token) {
  const url = new URL(requestOrigin(request));
  url.searchParams.set("auth", type === "verify" ? "verify" : "reset");
  url.searchParams.set("token", token);
  return url.toString();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function oauthRedirectUri(request, provider) {
  return `${requestOrigin(request)}/api/auth/${provider}/callback`;
}

function redirect(response, location, statusCode = 302, headers = {}) {
  response.writeHead(statusCode, responseHeaders({ location, ...headers }));
  response.end();
}

function normalizePrivateKey(value = "") {
  return String(value || "").replace(/\\n/g, "\n").trim();
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64");
}

function parseJwt(token) {
  const [encodedHeader, encodedPayload, encodedSignature] = String(token || "").split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw requestError("Identity token is malformed.", 401);
  return {
    encodedHeader,
    encodedPayload,
    encodedSignature,
    header: JSON.parse(base64UrlDecode(encodedHeader).toString("utf8")),
    payload: JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")),
    signature: base64UrlDecode(encodedSignature)
  };
}

async function fetchJwks(jwksUrl) {
  const cached = jwksCache.get(jwksUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  const response = await fetch(jwksUrl);
  if (!response.ok) throw requestError("Unable to load identity provider keys.", 502);
  const body = await response.json();
  const keys = body.keys || [];
  jwksCache.set(jwksUrl, { keys, expiresAt: Date.now() + 60 * 60 * 1000 });
  return keys;
}

async function verifyOidcToken(provider, idToken, expectedNonce) {
  const config = oauthProviderConfig(provider);
  if (!config) throw requestError("Unsupported identity provider.", 404);
  const token = parseJwt(idToken);
  if (token.header.alg !== "RS256") throw requestError("Unsupported identity token algorithm.", 401);

  const keys = await fetchJwks(config.jwksUrl);
  const jwk = keys.find((key) => key.kid === token.header.kid);
  if (!jwk) throw requestError("Identity provider key was not found.", 401);

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${token.encodedHeader}.${token.encodedPayload}`);
  verifier.end();
  const validSignature = verifier.verify(crypto.createPublicKey({ key: jwk, format: "jwk" }), token.signature);
  if (!validSignature) throw requestError("Identity token signature is invalid.", 401);

  validateOidcClaims(provider, config, token.payload, expectedNonce);
  return token.payload;
}

function validateOidcClaims(provider, config, payload, expectedNonce) {
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(config.clientId)) throw requestError("Identity token audience is invalid.", 401);
  if (payload.nonce !== expectedNonce) throw requestError("Identity token nonce is invalid.", 401);
  if (Number(payload.exp || 0) * 1000 <= Date.now()) throw requestError("Identity token is expired.", 401);

  if (provider === "google" && payload.iss !== config.issuer && payload.iss !== "accounts.google.com") {
    throw requestError("Google identity token issuer is invalid.", 401);
  }
  if (provider === "apple" && payload.iss !== config.issuer) {
    throw requestError("Apple identity token issuer is invalid.", 401);
  }
  if (provider === "microsoft" && !String(payload.iss || "").match(/^https:\/\/login\.microsoftonline\.com\/[^/]+\/v2\.0$/)) {
    throw requestError("Microsoft identity token issuer is invalid.", 401);
  }
}

function oauthProfileFromClaims(provider, claims, appleName = null) {
  const email = normalizeEmail(claims.email || claims.preferred_username || claims.upn || "");
  const displayName = String(
    claims.name ||
    [appleName?.firstName, appleName?.lastName].filter(Boolean).join(" ") ||
    email.split("@")[0] ||
    providerDisplayName(provider)
  ).trim();
  const emailVerified = provider === "microsoft" ? Boolean(email) : claims.email_verified === true || claims.email_verified === "true";
  return {
    provider,
    subject: String(claims.sub || ""),
    email,
    displayName,
    emailVerified
  };
}

function createPkceChallenge(verifier) {
  return base64UrlEncode(crypto.createHash("sha256").update(verifier).digest());
}

async function createOAuthState(provider) {
  const state = crypto.randomBytes(24).toString("hex");
  const nonce = crypto.randomBytes(24).toString("hex");
  const codeVerifier = base64UrlEncode(crypto.randomBytes(48));
  await authStateStore.createOAuthState({
    state,
    provider,
    nonce,
    codeVerifier,
    expiresAt: Date.now() + oauthStateTtlMs
  });
  return { state, nonce, codeVerifier };
}

async function consumeOAuthState(provider, state) {
  const record = await authStateStore.consumeOAuthState(state);
  if (!record || record.provider !== provider || record.expiresAt <= Date.now()) {
    throw requestError("Sign-in state is invalid or expired. Please try again.", 400);
  }
  return record;
}

function appleClientSecret(config) {
  const header = {
    alg: "ES256",
    kid: config.keyId
  };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.teamId,
    iat: now,
    exp: now + 60 * 60 * 24 * 180,
    aud: "https://appleid.apple.com",
    sub: config.clientId
  };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: config.privateKey,
    dsaEncoding: "ieee-p1363"
  });
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function oauthAuthorizationUrl(request, provider) {
  const config = oauthProviderConfig(provider);
  if (!config || !isOAuthProviderConfigured(provider)) throw requestError(`${providerDisplayName(provider)} sign-in is not configured.`, 503);
  const state = await createOAuthState(provider);
  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", oauthRedirectUri(request, provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state.state);
  url.searchParams.set("nonce", state.nonce);
  url.searchParams.set("code_challenge", createPkceChallenge(state.codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  if (provider === "google") url.searchParams.set("prompt", "select_account");
  if (provider === "apple") url.searchParams.set("response_mode", "form_post");
  return url.toString();
}

async function exchangeOAuthCode(request, provider, code, stateRecord) {
  const config = oauthProviderConfig(provider);
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: oauthRedirectUri(request, provider),
    client_id: config.clientId,
    code_verifier: stateRecord.codeVerifier
  });
  if (provider === "apple") {
    params.set("client_secret", appleClientSecret(config));
  } else {
    params.set("client_secret", config.clientSecret);
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.id_token) {
    structuredLog("error", "oauth.token_exchange_failed", {
      provider,
      statusCode: response.status,
      error: boundedString(body.error || body.error_description || "token exchange failed", 180)
    });
    throw requestError(`${providerDisplayName(provider)} sign-in could not be completed.`, 502);
  }
  return body;
}

async function completeOAuthCallback(request, response, store, provider, params) {
  if (params.get("error")) throw requestError(params.get("error_description") || params.get("error"), 400);
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) throw requestError("OAuth callback is missing required parameters.", 400);

  const stateRecord = await consumeOAuthState(provider, state);
  const tokenSet = await exchangeOAuthCode(request, provider, code, stateRecord);
  const claims = await verifyOidcToken(provider, tokenSet.id_token, stateRecord.nonce);
  let appleName = null;
  if (provider === "apple" && params.get("user")) {
    try {
      appleName = JSON.parse(params.get("user"))?.name || null;
    } catch {
      appleName = null;
    }
  }
  const profile = oauthProfileFromClaims(provider, claims, appleName);
  const user = await store.loginWithOAuth(profile);
  const sessionToken = await createSession(user);
  structuredLog("info", "oauth.login_completed", { provider, userId: user.userId });
  redirect(response, "/", 302, { "set-cookie": sessionCookie(sessionToken, request) });
}

function isAdminUser(user) {
  return user && !user.isDemo && user.role === "admin";
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
    normalized.startsWith(`write-book-${lesson.id}-`) ||
    normalized === `sentence-${lesson.id}` ||
    normalized.startsWith(`morphology-morph-${lesson.id}-`) ||
    normalized.startsWith(`cumulative-cumulative-`) ||
    normalized.startsWith(`cumulative-${lesson.id}-`)
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

function boundedNumber(value, fallback, min, max) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
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

const adminCollectionConfig = {
  vocabulary: {
    idField: "id",
    fields: new Set(["arabic", "english", "transliteration", "audioKey", "audioNote"])
  },
  lessons: {
    idField: "id",
    fields: new Set(["title", "focus", "arabic", "translation", "notes", "examples", "grammarExplanation", "morphologyCards", "exercisePrompts", "contentStatus", "sourceRef"])
  },
  exercises: {
    idField: "id",
    fields: new Set(["prompt", "arabic", "options", "answer"])
  }
};

function requireAdmin(user) {
  if (!isAdminUser(user)) throw requestError("Admin access is required.", 403);
}

function sanitizeContentPatch(collectionName, patch) {
  const config = adminCollectionConfig[collectionName];
  if (!config) throw requestError("Unsupported content collection.", 404);
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw requestError("Content patch must be an object.", 400);
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!config.fields.has(key)) continue;
    if (Array.isArray(value)) {
      sanitized[key] = value
        .filter((item) => typeof item === "string" || (item && typeof item === "object" && !Array.isArray(item)))
        .slice(0, 40);
      continue;
    }
    sanitized[key] = boundedString(value, key === "arabic" ? 600 : 1200).trim();
  }

  if (!Object.keys(sanitized).length) throw requestError("No supported content fields were provided.", 400);
  return sanitized;
}

function patchContentArray(items, id, patch) {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) throw requestError("Content item not found.", 404);
  items[index] = { ...items[index], ...patch, updatedAt: new Date().toISOString() };
  return items[index];
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

function readTextBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(requestError("Request body is too large.", 413));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function createStore() {
  const curriculum = readJson(dataPath);
  const summary = contentSummary(curriculum);
  structuredLog("info", "content.loaded", summary);

  if (isProduction && !process.env.MONGODB_URI && !allowUnsafeProductionJsonFallback) {
    throw new Error("MONGODB_URI is required in production; local JSON fallback is disabled.");
  }

  if (isProduction && allowUnsafeProductionJsonFallback) {
    structuredLog("warn", "database.unsafe_json_fallback_enabled", {
      reason: "ALLOW_UNSAFE_PRODUCTION_JSON_FALLBACK is set"
    });
  }

  if (process.env.MONGODB_URI) {
    try {
      const { MongoClient } = require("mongodb");
      const client = new MongoClient(process.env.MONGODB_URI);
      await client.connect();
      const database = client.db(process.env.MONGODB_DB || "madinah_arabic");
      await syncMongoCurriculum(database, curriculum);
      await seedMongoUsersFromLocalFiles(database, curriculum);
      authStateStore = await createMongoAuthStateStore(database);
      structuredLog("info", "auth_state_store.ready", { mode: authStateStore.mode });
      return { ...createMongoStore(database, curriculum), contentSummary: summary };
    } catch (error) {
      if (isProduction && !allowUnsafeProductionJsonFallback) {
        throw new Error(`MongoDB is required in production and could not be initialized: ${error.message}`);
      }
      console.warn(`MongoDB unavailable, using local JSON persistence: ${error.message}`);
    }
  }

  authStateStore = createMemoryAuthStateStore();
  structuredLog("info", "auth_state_store.ready", { mode: authStateStore.mode });
  return { ...createJsonStore(curriculum), contentSummary: summary };
}

function contentSummary(curriculum) {
  return {
    books: curriculum.books?.length || 0,
    lessons: curriculum.lessons?.length || 0,
    vocabulary: curriculum.vocabulary?.length || 0,
    exercises: curriculum.exercises?.length || 0,
    grammar: curriculum.grammar?.length || 0
  };
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
      subscriptionEndsAt: user.subscriptionEndsAt || null,
      role: user.role === "admin" ? "admin" : "student",
      emailVerified: Boolean(user.emailVerified)
    };

    await database.collection("users").updateOne(
      { email },
      {
        $set: {
          displayName: seededUser.displayName,
          subscriptionPlan: seededUser.subscriptionPlan,
          subscriptionStatus: seededUser.subscriptionStatus,
          subscriptionEndsAt: seededUser.subscriptionEndsAt,
          role: seededUser.role,
          emailVerified: seededUser.emailVerified
        },
        $setOnInsert: {
          userId: seededUser.userId,
          email: seededUser.email,
          passwordHash: seededUser.passwordHash,
          createdAt: seededUser.createdAt || new Date().toISOString()
        }
      },
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

  async function getUserRecord(userId) {
    return database.collection("users").findOne({ userId }, { projection: { _id: 0, passwordHash: 0 } });
  }

  async function requireAdminRecord(userId) {
    const user = await getUserRecord(userId);
    const publicRecord = user ? publicUserFromRecord(user) : null;
    requireAdmin(publicRecord);
    return publicRecord;
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
        billing: publicBillingConfig(),
        authProviders: availableOAuthProviderIds(),
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
        role: "student",
        emailVerified: false,
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
    },
    async loginWithOAuth(profile) {
      if (!profile?.provider || !profile.subject) throw requestError("OAuth profile is incomplete.", 400);
      if (!profile.email && !profile.subject) throw requestError("OAuth account did not provide an email address.", 400);
      const providerRecord = { provider: profile.provider, subject: profile.subject };
      const byProvider = await database.collection("users").findOne({
        authProviders: { $elemMatch: providerRecord }
      });
      if (byProvider) return publicUserFromRecord(byProvider);

      const byEmail = profile.email && profile.emailVerified
        ? await database.collection("users").findOne({ email: profile.email })
        : null;
      if (byEmail) {
        await database.collection("users").updateOne(
          { userId: byEmail.userId },
          {
            $addToSet: { authProviders: providerRecord },
            $set: {
              emailVerified: Boolean(byEmail.emailVerified || profile.emailVerified),
              updatedAt: new Date()
            }
          }
        );
        return publicUserFromRecord({ ...byEmail, emailVerified: Boolean(byEmail.emailVerified || profile.emailVerified) });
      }

      if (!profile.email) throw requestError("OAuth account did not provide an email address.", 400);
      if (!profile.emailVerified) throw requestError("OAuth account email is not verified.", 401);
      const user = {
        userId: `user-${crypto.randomUUID()}`,
        displayName: profile.displayName || "Student",
        email: profile.email,
        passwordHash: "",
        subscriptionPlan: "free",
        subscriptionStatus: "active",
        subscriptionEndsAt: null,
        role: "student",
        emailVerified: Boolean(profile.emailVerified),
        authProviders: [providerRecord],
        createdAt: new Date()
      };
      await database.collection("users").insertOne(user);
      await database.collection("userProgress").insertOne(defaultProgressForUser(fallbackCurriculum, user));
      return publicUserFromRecord(user);
    },
    async requestPasswordReset(email) {
      const normalizedEmail = normalizeEmail(email);
      const user = await database.collection("users").findOne({ email: normalizedEmail });
      structuredLog("info", "auth.password_reset_requested", { email: normalizedEmail, found: Boolean(user) });
      if (!user) return null;
      const token = createOneTimeToken();
      await database.collection("users").updateOne(
        { userId: user.userId },
        { $set: { resetTokenHash: token.tokenHash, resetTokenExpiresAt: token.expiresAt } }
      );
      return { email: normalizedEmail, token: token.token, expiresAt: token.expiresAt };
    },
    async resetPassword({ token, password }) {
      if (!token || !password) throw requestError("Reset token and password are required.", 400);
      const tokenHash = hashOneTimeToken(token);
      const user = await database.collection("users").findOne({ resetTokenHash: tokenHash });
      if (!isTokenActive(user, "resetTokenHash", "resetTokenExpiresAt", token)) {
        throw requestError("Reset token is invalid or expired.", 400);
      }
      await database.collection("users").updateOne(
        { userId: user.userId },
        {
          $set: { passwordHash: hashPassword(password) },
          $unset: { resetTokenHash: "", resetTokenExpiresAt: "" }
        }
      );
      structuredLog("info", "auth.password_reset_completed", { userId: user.userId });
      return publicUserFromRecord(user);
    },
    async requestEmailVerification(userId) {
      const user = await getUserRecord(userId);
      if (!user || user.isDemo) throw requestError("Sign in required.", 401);
      const token = createOneTimeToken();
      await database.collection("users").updateOne(
        { userId },
        { $set: { verificationTokenHash: token.tokenHash, verificationTokenExpiresAt: token.expiresAt } }
      );
      structuredLog("info", "auth.email_verification_requested", { userId, email: user.email });
      return { email: user.email, token: token.token, expiresAt: token.expiresAt };
    },
    async verifyEmail({ token }) {
      if (!token) throw requestError("Verification token is required.", 400);
      const tokenHash = hashOneTimeToken(token);
      const user = await database.collection("users").findOne({ verificationTokenHash: tokenHash });
      if (!isTokenActive(user, "verificationTokenHash", "verificationTokenExpiresAt", token)) {
        throw requestError("Verification token is invalid or expired.", 400);
      }
      await database.collection("users").updateOne(
        { userId: user.userId },
        {
          $set: { emailVerified: true },
          $unset: { verificationTokenHash: "", verificationTokenExpiresAt: "" }
        }
      );
      structuredLog("info", "auth.email_verified", { userId: user.userId });
      return publicUserFromRecord({ ...user, emailVerified: true });
    },
    async billingUser(userId) {
      return database.collection("users").findOne({ userId }, { projection: { _id: 0, passwordHash: 0 } });
    },
    async billingUserByStripeCustomer(stripeCustomerId) {
      if (!stripeCustomerId) return null;
      return database.collection("users").findOne({ stripeCustomerId }, { projection: { _id: 0, passwordHash: 0 } });
    },
    async updateBillingUser(userId, patch) {
      const sanitized = sanitizeBillingPatch(patch);
      if (!Object.keys(sanitized).length) {
        return database.collection("users").findOne({ userId }, { projection: { _id: 0, passwordHash: 0 } });
      }
      const result = await database.collection("users").findOneAndUpdate(
        { userId },
        { $set: { ...sanitized, updatedAt: new Date() } },
        { projection: { _id: 0, passwordHash: 0 }, returnDocument: "after" }
      );
      const updated = result?.value || result;
      if (!updated) throw requestError("Billing account not found.", 404);
      return updated;
    },
    async adminContent(userId) {
      await requireAdminRecord(userId);
      const [books, lessons, vocabulary, grammar, exercises, resources] = await Promise.all([
        database.collection("books").find({}, { projection: { _id: 0 } }).sort({ slug: 1 }).toArray(),
        database.collection("lessons").find({}, { projection: { _id: 0 } }).sort({ bookSlug: 1, sequence: 1 }).toArray(),
        database.collection("vocabulary").find({}, { projection: { _id: 0 } }).sort({ bookSlug: 1, sequence: 1, id: 1 }).toArray(),
        database.collection("grammar").find({}, { projection: { _id: 0 } }).sort({ bookSlug: 1, sequence: 1 }).toArray(),
        database.collection("exercises").find({}, { projection: { _id: 0 } }).sort({ bookSlug: 1, sequence: 1 }).toArray(),
        database.collection("resources").find({}, { projection: { _id: 0 } }).toArray()
      ]);
      return { books, lessons, vocabulary, grammar, exercises, resources };
    },
    async patchContent(userId, collectionName, id, patch) {
      await requireAdminRecord(userId);
      const sanitized = sanitizeContentPatch(collectionName, patch);
      const result = await database.collection(collectionName).findOneAndUpdate(
        { id },
        { $set: { ...sanitized, updatedAt: new Date().toISOString() } },
        { projection: { _id: 0 }, returnDocument: "after" }
      );
      const updated = result?.value || result;
      if (!updated) throw requestError("Content item not found.", 404);
      structuredLog("info", "admin.content_updated", { userId, collectionName, id });
      return updated;
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

  function findUserRecord(userId) {
    return readUsers().find((item) => item.userId === userId) || null;
  }

  function updateUserRecord(userId, update) {
    const users = readUsers();
    const index = users.findIndex((item) => item.userId === userId);
    if (index === -1) return null;
    users[index] = { ...users[index], ...update, updatedAt: new Date().toISOString() };
    writeUsers(users);
    return users[index];
  }

  function updateUserRecordByEmail(email, update) {
    const users = readUsers();
    const index = users.findIndex((item) => item.email === email);
    if (index === -1) return null;
    users[index] = { ...users[index], ...update, updatedAt: new Date().toISOString() };
    writeUsers(users);
    return users[index];
  }

  function requireJsonAdmin(userId) {
    const user = findUser(userId);
    requireAdmin(user);
    return user;
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
        billing: publicBillingConfig(),
        authProviders: availableOAuthProviderIds(),
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
        role: "student",
        emailVerified: false,
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
    },
    async loginWithOAuth(profile) {
      if (!profile?.provider || !profile.subject) throw requestError("OAuth profile is incomplete.", 400);
      const providerRecord = { provider: profile.provider, subject: profile.subject };
      const users = readUsers();
      const byProvider = users.find((user) =>
        (user.authProviders || []).some((item) => item.provider === providerRecord.provider && item.subject === providerRecord.subject)
      );
      if (byProvider) return publicUserFromRecord(byProvider);

      const email = normalizeEmail(profile.email);
      const emailIndex = email && profile.emailVerified ? users.findIndex((user) => user.email === email) : -1;
      if (emailIndex >= 0) {
        users[emailIndex] = {
          ...users[emailIndex],
          emailVerified: Boolean(users[emailIndex].emailVerified || profile.emailVerified),
          authProviders: [
            ...(users[emailIndex].authProviders || []),
            providerRecord
          ],
          updatedAt: new Date().toISOString()
        };
        users[emailIndex].authProviders = Array.from(
          new Map(users[emailIndex].authProviders.map((item) => [`${item.provider}:${item.subject}`, item])).values()
        );
        writeUsers(users);
        return publicUserFromRecord(users[emailIndex]);
      }

      if (!email) throw requestError("OAuth account did not provide an email address.", 400);
      if (!profile.emailVerified) throw requestError("OAuth account email is not verified.", 401);
      const user = {
        userId: `user-${crypto.randomUUID()}`,
        displayName: profile.displayName || "Student",
        email,
        passwordHash: "",
        subscriptionPlan: "free",
        subscriptionStatus: "active",
        subscriptionEndsAt: null,
        role: "student",
        emailVerified: Boolean(profile.emailVerified),
        authProviders: [providerRecord],
        createdAt: new Date().toISOString()
      };
      users.push(user);
      writeUsers(users);
      writeJsonProgress(user.userId, defaultProgressForUser(curriculum, user));
      return publicUserFromRecord(user);
    },
    async requestPasswordReset(email) {
      const normalizedEmail = normalizeEmail(email);
      const user = readUsers().find((item) => item.email === normalizedEmail);
      structuredLog("info", "auth.password_reset_requested", { email: normalizedEmail, found: Boolean(user) });
      if (!user) return null;
      const token = createOneTimeToken();
      updateUserRecordByEmail(normalizedEmail, {
        resetTokenHash: token.tokenHash,
        resetTokenExpiresAt: token.expiresAt
      });
      return { email: normalizedEmail, token: token.token, expiresAt: token.expiresAt };
    },
    async resetPassword({ token, password }) {
      if (!token || !password) throw requestError("Reset token and password are required.", 400);
      const user = readUsers().find((item) => isTokenActive(item, "resetTokenHash", "resetTokenExpiresAt", token));
      if (!user) throw requestError("Reset token is invalid or expired.", 400);
      const updated = updateUserRecord(user.userId, {
        passwordHash: hashPassword(password),
        resetTokenHash: "",
        resetTokenExpiresAt: ""
      });
      structuredLog("info", "auth.password_reset_completed", { userId: user.userId });
      return publicUserFromRecord(updated);
    },
    async requestEmailVerification(userId) {
      const user = findUserRecord(userId);
      if (!user) throw requestError("Sign in required.", 401);
      const token = createOneTimeToken();
      updateUserRecord(userId, {
        verificationTokenHash: token.tokenHash,
        verificationTokenExpiresAt: token.expiresAt
      });
      structuredLog("info", "auth.email_verification_requested", { userId, email: user.email });
      return { email: user.email, token: token.token, expiresAt: token.expiresAt };
    },
    async verifyEmail({ token }) {
      if (!token) throw requestError("Verification token is required.", 400);
      const user = readUsers().find((item) => isTokenActive(item, "verificationTokenHash", "verificationTokenExpiresAt", token));
      if (!user) throw requestError("Verification token is invalid or expired.", 400);
      const updated = updateUserRecord(user.userId, {
        emailVerified: true,
        verificationTokenHash: "",
        verificationTokenExpiresAt: ""
      });
      structuredLog("info", "auth.email_verified", { userId: user.userId });
      return publicUserFromRecord(updated);
    },
    async billingUser(userId) {
      const user = findUserRecord(userId);
      if (!user) return null;
      const { passwordHash, ...safeUser } = user;
      return safeUser;
    },
    async billingUserByStripeCustomer(stripeCustomerId) {
      if (!stripeCustomerId) return null;
      const user = readUsers().find((item) => item.stripeCustomerId === stripeCustomerId);
      if (!user) return null;
      const { passwordHash, ...safeUser } = user;
      return safeUser;
    },
    async updateBillingUser(userId, patch) {
      const sanitized = sanitizeBillingPatch(patch);
      if (!Object.keys(sanitized).length) {
        const user = findUserRecord(userId);
        if (!user) return null;
        const { passwordHash, ...safeUser } = user;
        return safeUser;
      }
      const updated = updateUserRecord(userId, sanitized);
      if (!updated) throw requestError("Billing account not found.", 404);
      const { passwordHash, ...safeUser } = updated;
      return safeUser;
    },
    async adminContent(userId) {
      requireJsonAdmin(userId);
      return {
        books: curriculum.books,
        lessons: curriculum.lessons,
        vocabulary: curriculum.vocabulary,
        grammar: curriculum.grammar,
        exercises: curriculum.exercises,
        resources: curriculum.resources
      };
    },
    async patchContent(userId, collectionName, id, patch) {
      requireJsonAdmin(userId);
      const sanitized = sanitizeContentPatch(collectionName, patch);
      const updated = patchContentArray(curriculum[collectionName], id, sanitized);
      writeJson(dataPath, curriculum);
      structuredLog("info", "admin.content_updated", { userId, collectionName, id });
      return updated;
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

function sendHealth(response, store, requestId) {
  sendJson(response, 200, {
    ok: true,
    service: serviceName,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    release: process.env.HEROKU_SLUG_COMMIT || process.env.SOURCE_VERSION || "",
    databaseMode: store.mode === "json" ? "local-json" : store.mode,
    authStateMode: authStateStore.mode,
    content: store.contentSummary,
    requestId
  }, {
    "cache-control": "no-store"
  });
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
    const startedAt = Date.now();
    const parsedUrl = new URL(request.url, "http://localhost");
    const requestId = requestIdFromRequest(request);
    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);

    response.on("finish", () => {
      structuredLog("info", "http.request", {
        requestId,
        method: request.method,
        path: parsedUrl.pathname,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        ipHash: hashIdentifier(clientIp(request)),
        userAgent: boundedString(request.headers["user-agent"], 180)
      });
    });

    try {
      if (request.method === "GET" && parsedUrl.pathname === "/api/health") {
        sendHealth(response, store, requestId);
        return;
      }

      if (request.method === "GET" && parsedUrl.pathname === "/api/bootstrap") {
        sendJson(response, 200, await store.bootstrap(await userFromRequest(request)));
        return;
      }

      if (request.method === "PATCH" && parsedUrl.pathname === "/api/progress") {
        const userId = await authenticatedUserFromRequest(request);
        if (!userId) {
          sendJson(response, 401, { error: "Sign in required to save progress." });
          return;
        }

        sendJson(response, 200, { progress: await store.updateProgress(userId, await readBody(request)) });
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/billing/checkout") {
        const userId = await authenticatedUserFromRequest(request);
        if (!userId) {
          sendJson(response, 401, { error: "Sign in required to upgrade." });
          return;
        }

        const session = await createStripeCheckoutSession(request, store, userId);
        sendJson(response, 200, { url: session.url });
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/billing/portal") {
        const userId = await authenticatedUserFromRequest(request);
        if (!userId) {
          sendJson(response, 401, { error: "Sign in required to manage billing." });
          return;
        }

        const session = await createStripePortalSession(request, store, userId);
        sendJson(response, 200, { url: session.url });
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/billing/webhook") {
        const rawBody = await readTextBody(request);
        const stripeEvent = verifyStripeWebhook(rawBody, request.headers["stripe-signature"]);
        await handleStripeWebhook(store, stripeEvent);
        sendJson(response, 200, { received: true });
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/client-error") {
        const body = await readBody(request);
        structuredLog("error", "frontend.error", {
          requestId,
          message: boundedString(body.message, 300),
          source: boundedString(body.source, 120),
          route: boundedString(body.route, 80),
          path: boundedString(body.path, 180),
          stack: boundedString(body.stack, 1200),
          userAgent: boundedString(request.headers["user-agent"], 180),
          userId: await authenticatedUserFromRequest(request) || "anonymous"
        });
        sendJson(response, 200, { ok: true });
        return;
      }

      const oauthStart = parsedUrl.pathname.match(/^\/api\/auth\/(google|microsoft|apple)$/);
      if (request.method === "GET" && oauthStart) {
        redirect(response, await oauthAuthorizationUrl(request, oauthStart[1]));
        return;
      }

      const oauthCallback = parsedUrl.pathname.match(/^\/api\/auth\/(google|microsoft|apple)\/callback$/);
      if (oauthCallback && (request.method === "GET" || request.method === "POST")) {
        const provider = oauthCallback[1];
        const params = request.method === "POST"
          ? new URLSearchParams(await readTextBody(request))
          : parsedUrl.searchParams;
        await completeOAuthCallback(request, response, store, provider, params);
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/auth/register") {
        const body = await readBody(request);
        await enforceAuthRateLimit(request, "register", body.email);
        if (isProduction) requireEmailDeliveryConfigured("verify");
        const user = await store.register(body);
        const verification = await store.requestEmailVerification(user.userId);
        await sendAuthEmail(request, "verify", verification);
        const sessionToken = await createSession(user);
        await clearAuthRateLimit(request, "register", body.email);
        sendJson(
          response,
          200,
          {
            user,
            progress: (await store.bootstrap(user.userId)).progress,
            emailVerificationRequired: !user.emailVerified,
            ...devTokenPayload(verification?.token)
          },
          { "set-cookie": sessionCookie(sessionToken, request) }
        );
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/auth/login") {
        const body = await readBody(request);
        await enforceAuthRateLimit(request, "login", body.email);
        const user = await store.login(body);
        const sessionToken = await createSession(user);
        await clearAuthRateLimit(request, "login", body.email);
        sendJson(
          response,
          200,
          { user, progress: (await store.bootstrap(user.userId)).progress },
          { "set-cookie": sessionCookie(sessionToken, request) }
        );
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/auth/forgot-password") {
        const body = await readBody(request);
        await enforceAuthRateLimit(request, "forgot-password", body.email);
        if (isProduction) requireEmailDeliveryConfigured("reset");
        const reset = await store.requestPasswordReset(body.email);
        await sendAuthEmail(request, "reset", reset);
        await clearAuthRateLimit(request, "forgot-password", body.email);
        sendJson(response, 200, {
          ok: true,
          message: "If an account exists for that email, a reset link has been prepared.",
          ...devTokenPayload(reset?.token)
        });
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/auth/reset-password") {
        const body = await readBody(request);
        const user = await store.resetPassword(body);
        sendJson(response, 200, { ok: true, user });
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/auth/send-verification") {
        const userId = await authenticatedUserFromRequest(request);
        if (!userId) {
          sendJson(response, 401, { error: "Sign in required to verify email." });
          return;
        }
        if (isProduction) requireEmailDeliveryConfigured("verify");
        const verification = await store.requestEmailVerification(userId);
        await sendAuthEmail(request, "verify", verification);
        sendJson(response, 200, {
          ok: true,
          message: "Verification email prepared.",
          ...devTokenPayload(verification?.token)
        });
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/auth/verify-email") {
        const body = await readBody(request);
        const user = await store.verifyEmail(body);
        sendJson(response, 200, { ok: true, user });
        return;
      }

      if (request.method === "POST" && parsedUrl.pathname === "/api/auth/logout") {
        const token = sessionTokenFromRequest(request);
        if (token) await authStateStore.deleteSession(token);
        sendJson(response, 200, { ok: true }, { "set-cookie": clearSessionCookie(request) });
        return;
      }

      if (request.method === "GET" && parsedUrl.pathname === "/api/admin/content") {
        const userId = await authenticatedUserFromRequest(request);
        if (!userId) {
          sendJson(response, 401, { error: "Sign in required." });
          return;
        }
        sendJson(response, 200, await store.adminContent(userId));
        return;
      }

      if (request.method === "GET" && parsedUrl.pathname === "/api/admin/export") {
        const userId = await authenticatedUserFromRequest(request);
        if (!userId) {
          sendJson(response, 401, { error: "Sign in required." });
          return;
        }
        const content = await store.adminContent(userId);
        sendJson(response, 200, {
          exportedAt: new Date().toISOString(),
          content
        }, {
          "content-disposition": `attachment; filename="madinah-content-export-${new Date().toISOString().slice(0, 10)}.json"`
        });
        return;
      }

      if (request.method === "PATCH" && parsedUrl.pathname === "/api/admin/content") {
        const userId = await authenticatedUserFromRequest(request);
        if (!userId) {
          sendJson(response, 401, { error: "Sign in required." });
          return;
        }
        const body = await readBody(request);
        const item = await store.patchContent(userId, body.collection, body.id, body.patch);
        sendJson(response, 200, { item });
        return;
      }

      if (parsedUrl.pathname.startsWith("/api/")) {
        sendJson(response, 404, { error: "API endpoint not found." });
        return;
      }

      sendStatic(request, response);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      const rejectedAuth = parsedUrl.pathname.startsWith("/api/auth/") && [401, 403, 429].includes(statusCode);
      structuredLog(statusCode >= 500 ? "error" : "warn", rejectedAuth ? "auth.request_rejected" : statusCode >= 500 ? "server.error" : "request.rejected", {
        requestId,
        method: request.method,
        path: parsedUrl.pathname,
        statusCode,
        message: error.message
      });
      sendJson(response, statusCode, { error: error.message, requestId });
    }
  });

  server.listen(port, host, () => {
    structuredLog("info", "server.started", {
      url: `http://localhost:${port}`,
      host,
      databaseMode: store.mode,
      authStateMode: authStateStore.mode,
      workspace: pathToFileURL(root).href
    });
  });
}

process.on("unhandledRejection", (reason) => {
  structuredLog("error", "process.unhandled_rejection", {
    message: boundedString(reason?.message || reason, 500),
    stack: boundedString(reason?.stack, 1200)
  });
});

process.on("uncaughtException", (error) => {
  structuredLog("error", "process.uncaught_exception", {
    message: boundedString(error?.message || error, 500),
    stack: boundedString(error?.stack, 1200)
  });
  process.exit(1);
});

start().catch((error) => {
  structuredLog("error", "server.start_failed", {
    message: boundedString(error.message, 500),
    stack: boundedString(error.stack, 1200)
  });
  process.exit(1);
});
