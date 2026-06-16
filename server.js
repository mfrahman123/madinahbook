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
const oauthStates = new Map();
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
  const safeDetails = Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined)
  );
  console.log(JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...safeDetails
  }));
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
  return publicUser(
    user.userId,
    user.displayName,
    user.email,
    user.subscriptionPlan,
    user.subscriptionStatus,
    user.subscriptionEndsAt,
    user.role,
    user.emailVerified
  );
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

function createOAuthState(provider) {
  cleanupOAuthStates();
  const state = crypto.randomBytes(24).toString("hex");
  const nonce = crypto.randomBytes(24).toString("hex");
  const codeVerifier = base64UrlEncode(crypto.randomBytes(48));
  oauthStates.set(state, {
    provider,
    nonce,
    codeVerifier,
    expiresAt: Date.now() + oauthStateTtlMs
  });
  return { state, nonce, codeVerifier };
}

function consumeOAuthState(provider, state) {
  cleanupOAuthStates();
  const record = oauthStates.get(state);
  oauthStates.delete(state);
  if (!record || record.provider !== provider || record.expiresAt <= Date.now()) {
    throw requestError("Sign-in state is invalid or expired. Please try again.", 400);
  }
  return record;
}

function cleanupOAuthStates() {
  const now = Date.now();
  for (const [state, record] of oauthStates.entries()) {
    if (!record || record.expiresAt <= now) oauthStates.delete(state);
  }
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

function oauthAuthorizationUrl(request, provider) {
  const config = oauthProviderConfig(provider);
  if (!config || !isOAuthProviderConfigured(provider)) throw requestError(`${providerDisplayName(provider)} sign-in is not configured.`, 503);
  const state = createOAuthState(provider);
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

  const stateRecord = consumeOAuthState(provider, state);
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
  const sessionToken = createSession(user);
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
    response.on("finish", () => {
      structuredLog("info", "http.request", {
        method: request.method,
        path: parsedUrl.pathname,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt
      });
    });

    try {
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

      if (request.method === "POST" && parsedUrl.pathname === "/api/client-error") {
        const body = await readBody(request);
        structuredLog("error", "frontend.error", {
          message: boundedString(body.message, 300),
          source: boundedString(body.source, 120),
          route: boundedString(body.route, 80),
          userId: authenticatedUserFromRequest(request) || "anonymous"
        });
        sendJson(response, 200, { ok: true });
        return;
      }

      const oauthStart = parsedUrl.pathname.match(/^\/api\/auth\/(google|microsoft|apple)$/);
      if (request.method === "GET" && oauthStart) {
        redirect(response, oauthAuthorizationUrl(request, oauthStart[1]));
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
        enforceAuthRateLimit(request, "register", body.email);
        if (isProduction) requireEmailDeliveryConfigured("verify");
        const user = await store.register(body);
        const verification = await store.requestEmailVerification(user.userId);
        await sendAuthEmail(request, "verify", verification);
        const sessionToken = createSession(user);
        clearAuthRateLimit(request, "register", body.email);
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

      if (request.method === "POST" && parsedUrl.pathname === "/api/auth/forgot-password") {
        const body = await readBody(request);
        enforceAuthRateLimit(request, "forgot-password", body.email);
        if (isProduction) requireEmailDeliveryConfigured("reset");
        const reset = await store.requestPasswordReset(body.email);
        await sendAuthEmail(request, "reset", reset);
        clearAuthRateLimit(request, "forgot-password", body.email);
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
        const userId = authenticatedUserFromRequest(request);
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
        if (token) sessions.delete(token);
        sendJson(response, 200, { ok: true }, { "set-cookie": clearSessionCookie(request) });
        return;
      }

      if (request.method === "GET" && parsedUrl.pathname === "/api/admin/content") {
        const userId = authenticatedUserFromRequest(request);
        if (!userId) {
          sendJson(response, 401, { error: "Sign in required." });
          return;
        }
        sendJson(response, 200, await store.adminContent(userId));
        return;
      }

      if (request.method === "GET" && parsedUrl.pathname === "/api/admin/export") {
        const userId = authenticatedUserFromRequest(request);
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
        const userId = authenticatedUserFromRequest(request);
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
      structuredLog("error", "server.error", {
        method: request.method,
        path: parsedUrl.pathname,
        statusCode: error.statusCode || 500,
        message: error.message
      });
      sendJson(response, error.statusCode || 500, { error: error.message });
    }
  });

  server.listen(port, host, () => {
    structuredLog("info", "server.started", {
      url: `http://localhost:${port}`,
      host,
      databaseMode: store.mode,
      workspace: pathToFileURL(root).href
    });
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
