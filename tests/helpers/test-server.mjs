import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const helperDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(helperDir, "../..");

export const testUser = {
  displayName: "Free Learner",
  email: "free.madinah@example.com",
  password: "test123",
  userId: "user-test-free",
  passwordHash: "da9954747ee5b445cc63adc36bdced59:b6a986029a63a9c88e1f82064226d1025bd1311bde1ed546f00dc91e0cb88a7e"
};

export const paidTestUser = {
  displayName: "Muhammad",
  email: "99muhammad.r@gmail.com",
  password: "test123",
  userId: "user-test-muhammad",
  passwordHash: testUser.passwordHash
};

export const otherAdminUser = {
  displayName: "Content Admin",
  email: "content.admin@example.com",
  password: "test123",
  userId: "user-test-content-admin",
  passwordHash: testUser.passwordHash
};

export async function startTestServer(envOverrides = {}) {
  const port = await getFreePort();
  const dataDir = await createDataFixture();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDir,
      MONGODB_URI: "",
      MONGODB_DB: "",
      AUTH_BASE_URL: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      MICROSOFT_CLIENT_ID: "",
      MICROSOFT_CLIENT_SECRET: "",
      MICROSOFT_TENANT: "",
      APPLE_CLIENT_ID: "",
      APPLE_TEAM_ID: "",
      APPLE_KEY_ID: "",
      APPLE_PRIVATE_KEY: "",
      STRIPE_SECRET_KEY: "",
      STRIPE_PREMIUM_PRICE_ID: "",
      STRIPE_PRICE_MONTHLY: "",
      STRIPE_PRICE_SIX_MONTHS: "",
      STRIPE_PRICE_6_MONTHS: "",
      STRIPE_PRICE_YEARLY: "",
      STRIPE_PRICE_LIFETIME: "",
      STRIPE_DEFAULT_PLAN_ID: "",
      STRIPE_PREMIUM_PRICE_LABEL: "",
      STRIPE_WEBHOOK_SECRET: "",
      EMAIL_PROVIDER: "",
      EMAIL_FROM: "",
      EMAIL_FROM_NAME: "",
      EMAIL_REPLY_TO: "",
      SENDGRID_API_KEY: "",
      RESEND_API_KEY: "",
      EMAIL_WEBHOOK_URL: "",
      EMAIL_WEBHOOK_SECRET: "",
      OBSERVABILITY_SERVICE_NAME: "",
      OBSERVABILITY_WEBHOOK_URL: "",
      OBSERVABILITY_WEBHOOK_SECRET: "",
      OBSERVABILITY_SAMPLE_RATE: "",
      OBSERVABILITY_TIMEOUT_MS: "",
      ALLOW_UNSAFE_PRODUCTION_JSON_FALLBACK: "",
      ...envOverrides
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk;
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForBootstrap(baseUrl, child, () => logs);
  } catch (error) {
    if (!child.killed) child.kill();
    await Promise.race([
      once(child, "exit").catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1200))
    ]);
    await fs.rm(dataDir, { recursive: true, force: true });
    throw error;
  }

  return {
    baseUrl,
    dataDir,
    child,
    logs: () => logs,
    async stop() {
      if (!child.killed) child.kill();
      await Promise.race([
        once(child, "exit").catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 1200))
      ]);
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  };
}

async function createDataFixture() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "madinah-arabic-test-"));
  const curriculumPath = path.join(projectRoot, "data", "curriculum.json");
  const curriculum = JSON.parse(await fs.readFile(curriculumPath, "utf8"));

  await fs.writeFile(path.join(dataDir, "curriculum.json"), `${JSON.stringify(curriculum, null, 2)}\n`);
  await fs.writeFile(path.join(dataDir, "progress.json"), `${JSON.stringify(curriculum.defaultProgress, null, 2)}\n`);
  await fs.writeFile(
    path.join(dataDir, "users.json"),
    `${JSON.stringify(
      {
        users: [
          {
            userId: testUser.userId,
            displayName: testUser.displayName,
            email: testUser.email,
            passwordHash: testUser.passwordHash,
            subscriptionPlan: "free",
            subscriptionStatus: "active",
            subscriptionEndsAt: null,
            role: "student",
            emailVerified: false,
            createdAt: "2026-05-21T12:10:25.032Z"
          },
          {
            userId: paidTestUser.userId,
            displayName: paidTestUser.displayName,
            email: paidTestUser.email,
            passwordHash: paidTestUser.passwordHash,
            subscriptionPlan: "paid",
            subscriptionStatus: "active",
            subscriptionEndsAt: null,
            role: "admin",
            emailVerified: true,
            createdAt: "2026-06-11T12:00:00.000Z"
          },
          {
            userId: otherAdminUser.userId,
            displayName: otherAdminUser.displayName,
            email: otherAdminUser.email,
            passwordHash: otherAdminUser.passwordHash,
            subscriptionPlan: "paid",
            subscriptionStatus: "active",
            subscriptionEndsAt: null,
            role: "admin",
            emailVerified: true,
            createdAt: "2026-06-12T12:00:00.000Z"
          }
        ]
      },
      null,
      2
    )}\n`
  );
  await fs.writeFile(path.join(dataDir, "progress-users.json"), "{}\n");

  return dataDir;
}

async function getFreePort() {
  const server = net.createServer();
  server.unref();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForBootstrap(baseUrl, child, logs) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Test server exited early.\n${logs()}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/bootstrap`);
      if (response.ok) return;
    } catch {
      // Keep polling while the server starts.
    }

    await new Promise((resolve) => setTimeout(resolve, 75));
  }

  throw new Error(`Timed out waiting for test server.\n${logs()}`);
}

export async function api(baseUrl, pathName, options = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(options.body ? { "content-type": "application/json" } : {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

export function authHeaders(result) {
  const cookie = result.response.headers.get("set-cookie");
  return cookie ? { cookie: cookie.split(";")[0] } : {};
}
