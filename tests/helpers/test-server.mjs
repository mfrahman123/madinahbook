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

export async function startTestServer() {
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
      APPLE_PRIVATE_KEY: ""
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
  await waitForBootstrap(baseUrl, child, () => logs);

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
