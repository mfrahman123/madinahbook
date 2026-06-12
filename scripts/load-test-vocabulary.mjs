import { paidTestUser, startTestServer } from "../tests/helpers/test-server.mjs";

const iterations = Number(process.env.LOAD_TEST_ITERATIONS || 40);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 8);
const maxP95Ms = Number(process.env.LOAD_TEST_MAX_P95_MS || 750);

async function main() {
  const server = await startTestServer();
  try {
    const login = await fetch(`${server.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: paidTestUser.email, password: paidTestUser.password })
    });
    const cookie = login.headers.get("set-cookie")?.split(";")[0] || "";
    if (!login.ok || !cookie) throw new Error("Unable to authenticate load-test user.");

    const durations = [];
    for (let start = 0; start < iterations; start += concurrency) {
      const batchSize = Math.min(concurrency, iterations - start);
      const batch = Array.from({ length: batchSize }, () => timedFetch(server.baseUrl, cookie));
      durations.push(...await Promise.all(batch));
    }

    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95) - 1] || 0;
    const max = durations[durations.length - 1] || 0;
    const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length;

    console.log(`Vocabulary load test: iterations=${iterations} concurrency=${concurrency} avg=${avg.toFixed(1)}ms p95=${p95.toFixed(1)}ms max=${max.toFixed(1)}ms`);
    if (p95 > maxP95Ms) {
      throw new Error(`Vocabulary load p95 ${p95.toFixed(1)}ms exceeded ${maxP95Ms}ms.`);
    }
  } finally {
    await server.stop();
  }
}

async function timedFetch(baseUrl, cookie) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/bootstrap`, { headers: { cookie } });
  if (!response.ok) throw new Error(`Bootstrap failed with ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body.vocabulary) || body.vocabulary.length < 1000) {
    throw new Error("Paid bootstrap did not include the full vocabulary payload.");
  }
  return performance.now() - startedAt;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
