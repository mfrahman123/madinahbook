import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { api, authHeaders, otherAdminUser, paidTestUser, startTestServer, testUser } from "../helpers/test-server.mjs";

describe("Madinah Arabic API and static app", () => {
  let server;

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await server?.stop();
  });

  it("serves only free Book 1 curriculum to anonymous visitors", async () => {
    const { response, body } = await api(server.baseUrl, "/api/bootstrap");

    assert.equal(response.status, 200);
    assert.equal(body.databaseMode, "local-json");
    assert.equal(body.user.isDemo, true);
    assert.equal(body.books.length, 3);
    assert.equal(body.books.find((book) => book.slug === "book-1").status, "available");
    assert.equal(body.books.find((book) => book.slug === "book-2").status, "locked");
    assert.equal(body.books.find((book) => book.slug === "book-3").status, "locked");
    assert.equal(body.books.find((book) => book.slug === "book-2").lessonCount, 31);
    assert.equal(body.books.find((book) => book.slug === "book-3").lessonCount, 34);
    assert.equal(body.lessons.length, 23);
    assert.equal(body.vocabulary.length, 423);
    assert.equal(body.vocabulary.filter((word) => word.bookSlug === "book-1").length, 423);
    assert.equal(body.lessons.some((lesson) => lesson.bookSlug === "book-2" || lesson.bookSlug === "book-3"), false);
    assert.equal(body.vocabulary.some((word) => word.bookSlug === "book-2" || word.bookSlug === "book-3"), false);
    assert.equal(body.exercises.some((exercise) => exercise.bookSlug === "book-2" || exercise.bookSlug === "book-3"), false);
    assert.deepEqual(body.authProviders, []);
    assert.equal(body.billing.provider, "stripe");
    assert.deepEqual(body.billing.plans.map((plan) => plan.id), ["monthly", "six_months", "yearly", "lifetime"]);
    assert.equal(body.billing.plans.find((plan) => plan.id === "monthly").price, "£5");
    assert.equal(body.billing.plans.find((plan) => plan.id === "lifetime").price, "£110");
  });

  it("fails safely when OAuth providers are not configured", async () => {
    const google = await fetch(`${server.baseUrl}/api/auth/google`, { redirect: "manual" });
    const microsoft = await fetch(`${server.baseUrl}/api/auth/microsoft`, { redirect: "manual" });
    const apple = await fetch(`${server.baseUrl}/api/auth/apple`, { redirect: "manual" });

    assert.equal(google.status, 503);
    assert.equal(microsoft.status, 503);
    assert.equal(apple.status, 503);
    assert.match(await google.text(), /Google sign-in is not configured/);
  });

  it("exposes production-safe health and request-id observability metadata", async () => {
    const { response, body } = await api(server.baseUrl, "/api/health", {
      headers: { "x-request-id": "test-request-12345" }
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-request-id"), "test-request-12345");
    assert.equal(body.ok, true);
    assert.equal(body.service, "madinah-arabic");
    assert.equal(body.databaseMode, "local-json");
    assert.equal(body.authStateMode, "memory");
    assert.equal(body.content.books, 3);
    assert.equal(body.content.lessons, 88);
    assert.equal(body.content.vocabulary, 1292);
    assert.equal(body.requestId, "test-request-12345");
    const logs = await waitForLog(server, /"requestId":"test-request-12345"/);
    assert.match(logs, /"event":"http\.request"/);
  });

  it("serves the full Book 1, Book 2 and Book 3 curriculum to premium users", async () => {
    const { body } = await bootstrapAs(server, paidTestUser);

    assert.equal(body.user.email, paidTestUser.email);
    assert.equal(body.books.length, 3);
    assert.equal(body.books.find((book) => book.slug === "book-1").status, "available");
    assert.equal(body.books.find((book) => book.slug === "book-2").status, "available");
    assert.equal(body.books.find((book) => book.slug === "book-3").status, "available");
    assert.equal(body.lessons.length, 88);
    assert.equal(body.vocabulary.length, 1292);
    assert.equal(body.vocabulary.filter((word) => word.bookSlug === "book-1").length, 423);
    assert.equal(body.vocabulary.filter((word) => word.bookSlug === "book-2").length, 335);
    assert.equal(body.vocabulary.filter((word) => word.bookSlug === "book-3").length, 534);
  });

  it("keeps paired verb forms readable with slash separators", async () => {
    const { body } = await bootstrapAs(server, paidTestUser);
    const vocabularyById = new Map(body.vocabulary.map((word) => [word.id, word]));
    const slashSeparatedWords = body.vocabulary.filter((word) => word.arabic.includes(" / "));
    const colonSeparatedArabicPair = /[\u0600-\u06ff]\s*:\s*[\u0600-\u06ff]/;

    assert.ok(slashSeparatedWords.length >= 80);
    assert.equal(body.vocabulary.some((word) => colonSeparatedArabicPair.test(word.arabic)), false);
    assert.equal(vocabularyById.get("v2-l4-dhahaba").arabic, "ذَهَبَ / يَذْهَبُ");
    assert.equal(vocabularyById.get("v3-l1-taghayyara").arabic, "تَغَيَّرَ / يَتَغَيَّرُ");
    assert.equal(vocabularyById.get("v3-l11-nawa").arabic, "نَوَى نِيَّةً");
    assert.equal(vocabularyById.get("v3-l11-nawa").arabic.includes(" / "), false);
  });

  it("serves clean vocabulary records without undefined values or legacy mistranslations", async () => {
    const { body } = await bootstrapAs(server, paidTestUser);
    const brokenWords = body.vocabulary.filter((word) => {
      const searchable = `${word.arabic || ""} ${word.english || ""} ${word.transliteration || ""}`;
      return !word.arabic || !word.english || /undefined/i.test(searchable);
    });
    const musa = body.vocabulary.find((word) => word.id === "v2-l14-musa");

    assert.deepEqual(brokenWords.map((word) => word.id), []);
    assert.equal(musa.arabic, "مُوسَى");
    assert.equal(musa.english, "Musa (proper name)");
    assert.doesNotMatch(musa.english, /razor/i);
  });

  it("serves pronunciation notes with final vowels and apostrophes for ayn", async () => {
    const { body } = await bootstrapAs(server, paidTestUser);
    const wordsById = new Map(body.vocabulary.map((word) => [word.id, word]));
    const emptyNotes = body.vocabulary.filter((word) => !word.transliteration);
    const numberNotes = body.vocabulary.filter((word) => /[0-9]/.test(word.transliteration));
    const badFinalVowels = body.vocabulary.flatMap((word) => pronunciationFinalVowelIssues(word));

    assert.deepEqual(emptyNotes.map((word) => word.id), []);
    assert.deepEqual(numberNotes.map((word) => word.id), []);
    assert.equal(wordsById.get("v-bada").transliteration, "ba'da");
    assert.equal(wordsById.get("v2-l25-badu").transliteration, "ba'du");
    assert.equal(wordsById.get("v3-l24-badama").transliteration, "ba'damaa");
    assert.equal(wordsById.get("v-baduhum").transliteration, "ba'duhum");
    assert.equal(wordsById.get("v3-l1-taghayyara").transliteration, "taghayyara / yataghayyaru");
    assert.deepEqual(badFinalVowels, []);
  });

  it("keeps displayed Arabic free of conflicting vowel marks", async () => {
    const { body } = await bootstrapAs(server, paidTestUser);
    const arabicSamples = [
      ...body.lessons.map((lesson) => [lesson.id, "lesson.arabic", lesson.arabic]),
      ...body.lessons.flatMap((lesson) => (lesson.examples || []).map((example) => [lesson.id, `lesson.example.${example.label}`, example.arabic])),
      ...body.vocabulary.map((word) => [word.id, "vocabulary.arabic", word.arabic]),
      ...body.grammar.map((rule) => [rule.id, "grammar.example", rule.example]),
      ...body.exercises.map((exercise) => [exercise.id, "exercise.arabic", exercise.arabic])
    ].filter(([, , value]) => /[\u0600-\u06ff]/u.test(String(value || "")));

    const invalidSamples = arabicSamples.filter(([, , value]) => hasConflictingArabicVowels(value));
    assert.deepEqual(invalidSamples, []);
  });

  it("serves three ordered Learn examples for every lesson", async () => {
    const { body } = await bootstrapAs(server, paidTestUser);

    body.lessons.forEach((lesson) => {
      assert.equal(lesson.examples.length, 3, `${lesson.id} should have three Learn examples`);
      assert.deepEqual(lesson.examples.map((example) => example.label), ["A", "B", "C"]);
      assert.deepEqual(lesson.examples.map((example) => example.difficulty), [1, 2, 3]);
      assert.ok(lesson.examples.some((example) => example.source === "Book model"), `${lesson.id} should include a book model`);

      const complexities = lesson.examples.map((example) => exampleComplexity(example.arabic));
      assert.deepEqual([...complexities].sort((a, b) => a - b), complexities, `${lesson.id} examples should increase in complexity`);
      lesson.examples.forEach((example) => {
        assert.ok(example.arabic, `${lesson.id} ${example.label} needs Arabic`);
        assert.ok(example.translation, `${lesson.id} ${example.label} needs translation`);
      });
    });
  });

  it("links vocabulary and grammar metadata for every available lesson", async () => {
    const { body } = await bootstrapAs(server, paidTestUser);
    const availableBookSlugs = new Set(body.books.filter((book) => book.status === "available").map((book) => book.slug));
    const vocabularyIds = new Set(body.vocabulary.map((word) => word.id));
    const grammarIds = new Set(body.grammar.map((rule) => rule.id));

    body.lessons
      .filter((lesson) => availableBookSlugs.has(lesson.bookSlug))
      .forEach((lesson) => {
        assert.ok(lesson.arabic, `${lesson.id} should include an Arabic example`);
        assert.ok(lesson.translation, `${lesson.id} should include an English translation`);
        assert.ok(lesson.vocabularyIds.length > 0, `${lesson.id} should have lesson vocabulary`);
        assert.ok(lesson.grammarIds.length > 0, `${lesson.id} should have grammar notes`);
        lesson.vocabularyIds.forEach((id) => assert.ok(vocabularyIds.has(id), `${lesson.id} references missing vocabulary ${id}`));
        lesson.grammarIds.forEach((id) => assert.ok(grammarIds.has(id), `${lesson.id} references missing grammar ${id}`));
      });
  });

  it("logs in with the seeded test account and returns private progress", async () => {
    const login = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });

    assert.equal(login.response.status, 200);
    assert.equal(login.body.user.email, testUser.email);
    assert.equal(login.body.user.subscriptionPlan, "free");
    assert.equal(login.body.user.subscriptionStatus, "active");
    assert.equal(login.body.sessionToken, undefined);
    assert.match(login.response.headers.get("set-cookie") || "", /madinah_session=.*HttpOnly.*SameSite=Lax/);

    const authed = await api(server.baseUrl, "/api/bootstrap", {
      headers: authHeaders(login)
    });

    assert.equal(authed.body.user.email, testUser.email);
    assert.equal(authed.body.user.subscriptionPlan, "free");
    assert.equal(authed.body.progress.userId, testUser.userId);
    assert.deepEqual(authed.body.progress.completedLessonIds, []);
    assert.equal(authed.body.books.find((book) => book.slug === "book-2").status, "locked");
    assert.equal(authed.body.lessons.some((lesson) => lesson.bookSlug === "book-2" || lesson.bookSlug === "book-3"), false);
    assert.equal(authed.body.vocabulary.some((word) => word.bookSlug === "book-2" || word.bookSlug === "book-3"), false);
  });

  it("logs in with the seeded premium account and exposes paid entitlements", async () => {
    const login = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: paidTestUser.email, password: paidTestUser.password })
    });

    assert.equal(login.response.status, 200);
    assert.equal(login.body.user.email, paidTestUser.email);
    assert.equal(login.body.user.subscriptionPlan, "paid");
    assert.equal(login.body.user.subscriptionStatus, "active");
  });

  it("allows admin users to load and patch curated content", async () => {
    const login = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: paidTestUser.email, password: paidTestUser.password })
    });
    const content = await api(server.baseUrl, "/api/admin/content", {
      headers: authHeaders(login)
    });
    const patched = await api(server.baseUrl, "/api/admin/content", {
      method: "PATCH",
      headers: authHeaders(login),
      body: JSON.stringify({
        collection: "vocabulary",
        id: "v-hadha",
        patch: {
          english: "this",
          passwordHash: "must-not-save"
        }
      })
    });

    assert.equal(login.body.user.role, "admin");
    assert.equal(content.response.status, 200);
    assert.ok(content.body.vocabulary.length > 1000);
    assert.equal(patched.response.status, 200);
    assert.equal(patched.body.item.english, "this");
    assert.equal(patched.body.item.passwordHash, undefined);
  });

  it("allows admins to export editable curriculum content", async () => {
    const login = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: paidTestUser.email, password: paidTestUser.password })
    });
    const exported = await api(server.baseUrl, "/api/admin/export", {
      headers: authHeaders(login)
    });

    assert.equal(login.body.user.role, "admin");
    assert.equal(exported.response.status, 200);
    assert.match(exported.response.headers.get("content-disposition") || "", /madinah-content-export/);
    assert.ok(exported.body.exportedAt);
    assert.ok(exported.body.content.lessons.some((lesson) => lesson.sourceRef && lesson.contentStatus));
    assert.ok(exported.body.content.vocabulary.length > 1000);
  });

  it("blocks non-admin users from content management", async () => {
    const login = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });
    const content = await api(server.baseUrl, "/api/admin/content", {
      headers: authHeaders(login)
    });
    const patched = await api(server.baseUrl, "/api/admin/content", {
      method: "PATCH",
      headers: authHeaders(login),
      body: JSON.stringify({ collection: "vocabulary", id: "v-hadha", patch: { english: "blocked" } })
    });
    const exported = await api(server.baseUrl, "/api/admin/export", {
      headers: authHeaders(login)
    });

    assert.equal(login.body.user.role, "student");
    assert.equal(content.response.status, 403);
    assert.equal(patched.response.status, 403);
    assert.equal(exported.response.status, 403);
  });

  it("blocks role-admin users unless they are the configured owner account", async () => {
    const login = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: otherAdminUser.email, password: otherAdminUser.password })
    });
    const content = await api(server.baseUrl, "/api/admin/content", {
      headers: authHeaders(login)
    });

    assert.equal(login.body.user.role, "admin");
    assert.equal(login.body.user.email, otherAdminUser.email);
    assert.equal(content.response.status, 403);
  });

  it("never returns password hashes in public auth responses", async () => {
    const login = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });
    const bootstrap = await api(server.baseUrl, "/api/bootstrap", {
      headers: authHeaders(login)
    });
    const registered = await api(server.baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ displayName: "Hash Check", email: uniqueEmail("hash-check"), password: "test123" })
    });

    assert.doesNotMatch(JSON.stringify(login.body), /passwordHash/i);
    assert.doesNotMatch(JSON.stringify(bootstrap.body), /passwordHash/i);
    assert.doesNotMatch(JSON.stringify(registered.body), /passwordHash/i);
    assert.doesNotMatch(JSON.stringify(login.body), new RegExp(testUser.passwordHash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  it("rejects invalid logins with an auth status", async () => {
    const login = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testUser.email, password: "wrong-password" })
    });

    assert.equal(login.response.status, 401);
    assert.match(login.body.error, /invalid email or password/i);
    assert.equal(login.body.sessionToken, undefined);
  });

  it("rate limits repeated login attempts", async () => {
    const email = uniqueEmail("rate-limit");
    let latest;

    for (let attempt = 0; attempt < 9; attempt += 1) {
      latest = await api(server.baseUrl, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: "wrong-password" })
      });
    }

    assert.equal(latest.response.status, 429);
    assert.match(latest.body.error, /too many attempts/i);
  });

  it("registers a new account with fresh learner progress", async () => {
    const email = uniqueEmail("learner");
    const created = await api(server.baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ displayName: "New Learner", email, password: "test123" })
    });

    assert.equal(created.response.status, 200);
    assert.equal(created.body.user.email, email);
    assert.equal(created.body.user.subscriptionPlan, "free");
    assert.equal(created.body.user.subscriptionStatus, "active");
    assert.equal(created.body.progress.currentLessonId, "lesson-1");
    assert.deepEqual(created.body.progress.completedLessonIds, []);
    assert.deepEqual(created.body.progress.learnedVocabularyIds, []);
    assert.deepEqual(created.body.progress.learningPreferences, {
      studyGoal: "guided-books",
      skillFocus: "balanced",
      dailyMinutes: 10,
      onboardingComplete: false
    });
  });

  it("normalizes account email and rejects duplicate registrations", async () => {
    const email = uniqueEmail("duplicate");
    const created = await api(server.baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ displayName: "Duplicate Learner", email: `  ${email.toUpperCase()}  `, password: "test123" })
    });
    const duplicate = await api(server.baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ displayName: "Duplicate Learner", email, password: "test123" })
    });

    assert.equal(created.response.status, 200);
    assert.equal(created.body.user.email, email);
    assert.equal(duplicate.response.status, 409);
    assert.match(duplicate.body.error, /already exists/i);
  });

  it("rejects malformed JSON request bodies", async () => {
    const badRequest = await api(server.baseUrl, "/api/auth/register", {
      method: "POST",
      body: "{"
    });

    assert.equal(badRequest.response.status, 400);
    assert.match(badRequest.body.error, /invalid json/i);
  });

  it("accepts frontend error telemetry without requiring login", async () => {
    const telemetry = await api(server.baseUrl, "/api/client-error", {
      method: "POST",
      body: JSON.stringify({
        message: "Synthetic UI error",
        source: "test",
        route: "home",
        path: "/?token=super-secret-token",
        stack: "SyntheticStack:1 https://example.test/reset?token=super-secret-token"
      })
    });

    assert.equal(telemetry.response.status, 200);
    assert.equal(telemetry.body.ok, true);
    assert.match(server.logs(), /frontend\.error/);
    assert.match(server.logs(), /SyntheticStack:1/);
    assert.match(server.logs(), /token=\[redacted\]/);
    assert.doesNotMatch(server.logs(), /super-secret-token/);
  });

  it("requires sign-in and Stripe config before creating billing checkout", async () => {
    const anonymous = await api(server.baseUrl, "/api/billing/checkout", { method: "POST" });
    const login = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });
    const missingConfig = await api(server.baseUrl, "/api/billing/checkout", {
      method: "POST",
      headers: authHeaders(login)
    });

    assert.equal(anonymous.response.status, 401);
    assert.equal(missingConfig.response.status, 503);
    assert.match(missingConfig.body.error, /stripe checkout is not configured/i);
  });

  it("syncs premium access from signed Stripe subscription webhooks", async () => {
    const webhookSecret = "whsec_test_secret";
    const billingServer = await startTestServer({
      STRIPE_SECRET_KEY: "sk_test_fake",
      STRIPE_PRICE_MONTHLY: "price_premium_monthly_test",
      STRIPE_PRICE_SIX_MONTHS: "price_premium_six_months_test",
      STRIPE_PRICE_YEARLY: "price_premium_yearly_test",
      STRIPE_PRICE_LIFETIME: "price_premium_lifetime_test",
      STRIPE_WEBHOOK_SECRET: webhookSecret
    });

    try {
      const email = uniqueEmail("stripe");
      const password = "test123";
      const created = await api(billingServer.baseUrl, "/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ displayName: "Stripe Learner", email, password })
      });
      const userId = created.body.user.userId;
      const activeEvent = stripeEventPayload("customer.subscription.updated", {
        id: "sub_test_active",
        object: "subscription",
        customer: "cus_test_active",
        status: "active",
        current_period_end: 1893456000,
        cancel_at_period_end: false,
        metadata: { userId },
        items: { data: [{ price: { id: "price_premium_monthly_test" } }] }
      });
      const upgraded = await postStripeWebhook(billingServer, webhookSecret, activeEvent);
      const premiumLogin = await api(billingServer.baseUrl, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      const premiumBootstrap = await api(billingServer.baseUrl, "/api/bootstrap", {
        headers: authHeaders(premiumLogin)
      });

      assert.equal(upgraded.response.status, 200);
      assert.equal(premiumLogin.body.user.subscriptionPlan, "paid");
      assert.equal(premiumLogin.body.user.subscriptionStatus, "active");
      assert.equal(premiumLogin.body.user.subscriptionEndsAt, "2030-01-01T00:00:00.000Z");
      assert.equal(premiumLogin.body.user.billingProvider, "stripe");
      assert.equal(premiumLogin.body.user.billingPortalAvailable, true);
      assert.equal(premiumBootstrap.body.books.find((book) => book.slug === "book-2").status, "available");

      const cancelledEvent = stripeEventPayload("customer.subscription.deleted", {
        id: "sub_test_active",
        object: "subscription",
        customer: "cus_test_active",
        status: "canceled",
        current_period_end: 1893456000,
        cancel_at_period_end: false,
        metadata: { userId },
        items: { data: [{ price: { id: "price_premium_monthly_test" } }] }
      });
      const downgraded = await postStripeWebhook(billingServer, webhookSecret, cancelledEvent);
      const freeLogin = await api(billingServer.baseUrl, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      const freeBootstrap = await api(billingServer.baseUrl, "/api/bootstrap", {
        headers: authHeaders(freeLogin)
      });
      const badSignature = await api(billingServer.baseUrl, "/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=123,v1=bad" },
        body: JSON.stringify(cancelledEvent)
      });

      assert.equal(downgraded.response.status, 200);
      assert.equal(freeLogin.body.user.subscriptionPlan, "free");
      assert.equal(freeLogin.body.user.subscriptionStatus, "cancelled");
      assert.equal(freeLogin.body.user.billingPortalAvailable, true);
      assert.equal(freeBootstrap.body.books.find((book) => book.slug === "book-2").status, "locked");
      assert.equal(badSignature.response.status, 400);
      assert.match(badSignature.body.error, /signature verification failed/i);

      const checkoutEmail = uniqueEmail("stripe-checkout");
      const checkoutCreated = await api(billingServer.baseUrl, "/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ displayName: "Checkout Learner", email: checkoutEmail, password })
      });
      const subscriptionCheckoutEvent = stripeEventPayload("checkout.session.completed", {
        id: "cs_test_subscription",
        object: "checkout.session",
        mode: "subscription",
        payment_status: "paid",
        customer: "cus_test_checkout",
        subscription: "sub_test_checkout",
        client_reference_id: checkoutCreated.body.user.userId,
        metadata: {
          userId: checkoutCreated.body.user.userId,
          planId: "monthly",
          stripePriceId: "price_premium_monthly_test"
        }
      });
      const checkoutSynced = await postStripeWebhook(billingServer, webhookSecret, subscriptionCheckoutEvent, "/api/stripe/webhook");
      const checkoutLogin = await api(billingServer.baseUrl, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: checkoutEmail, password })
      });
      const checkoutBootstrap = await api(billingServer.baseUrl, "/api/bootstrap", {
        headers: authHeaders(checkoutLogin)
      });

      assert.equal(checkoutSynced.response.status, 200);
      assert.equal(checkoutLogin.body.user.subscriptionPlan, "paid");
      assert.equal(checkoutLogin.body.user.subscriptionStatus, "active");
      assert.equal(checkoutBootstrap.body.books.find((book) => book.slug === "book-2").status, "available");

      const lifetimeEmail = uniqueEmail("stripe-lifetime");
      const lifetimeCreated = await api(billingServer.baseUrl, "/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ displayName: "Lifetime Learner", email: lifetimeEmail, password })
      });
      const lifetimeEvent = stripeEventPayload("checkout.session.completed", {
        id: "cs_test_lifetime",
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        customer: "cus_test_lifetime",
        subscription: null,
        client_reference_id: lifetimeCreated.body.user.userId,
        metadata: {
          userId: lifetimeCreated.body.user.userId,
          planId: "lifetime",
          stripePriceId: "price_premium_lifetime_test"
        }
      });
      const lifetimeSynced = await postStripeWebhook(billingServer, webhookSecret, lifetimeEvent);
      const lifetimeLogin = await api(billingServer.baseUrl, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: lifetimeEmail, password })
      });

      assert.equal(lifetimeSynced.response.status, 200);
      assert.equal(lifetimeLogin.body.user.subscriptionPlan, "paid");
      assert.equal(lifetimeLogin.body.user.subscriptionStatus, "active");
      assert.equal(lifetimeLogin.body.user.subscriptionEndsAt, null);
    } finally {
      await billingServer.stop();
    }
  });

  it("can forward structured logs to an observability webhook", async () => {
    const receiver = await startObservabilityWebhook();
    const observedServer = await startTestServer({
      OBSERVABILITY_WEBHOOK_URL: receiver.url,
      OBSERVABILITY_WEBHOOK_SECRET: "observability-test-secret"
    });

    try {
      await api(observedServer.baseUrl, "/api/health", {
        headers: { "x-request-id": "forwarded-request-123" }
      });
      const event = await receiver.waitFor((entry) => entry.event === "http.request" && entry.requestId === "forwarded-request-123");

      assert.equal(event.service, "madinah-arabic");
      assert.equal(event.path, "/api/health");
      assert.equal(event.statusCode, 200);
      assert.equal(receiver.secrets.includes("observability-test-secret"), true);
    } finally {
      await observedServer.stop();
      await receiver.stop();
    }
  });

  it("rejects invalid reset and verification tokens", async () => {
    const reset = await api(server.baseUrl, "/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token: "invalid-token", password: "new-password" })
    });
    const verification = await api(server.baseUrl, "/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token: "invalid-token" })
    });

    assert.equal(reset.response.status, 400);
    assert.match(reset.body.error, /invalid or expired/i);
    assert.equal(verification.response.status, 400);
    assert.match(verification.body.error, /invalid or expired/i);
  });

  it("supports forgotten password reset and email verification tokens", async () => {
    const email = uniqueEmail("reset");
    const created = await api(server.baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ displayName: "Reset Learner", email, password: "test123" })
    });
    const page = await fetch(`${server.baseUrl}/`).then((response) => response.text());
    const app = await fetch(`${server.baseUrl}/app.js`).then((response) => response.text());
    const forgot = await api(server.baseUrl, "/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    const reset = await api(server.baseUrl, "/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token: forgot.body.devToken, password: "new-password" })
    });
    const newLogin = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "new-password" })
    });
    const verification = await api(server.baseUrl, "/api/auth/send-verification", {
      method: "POST",
      headers: authHeaders(newLogin)
    });
    const verified = await api(server.baseUrl, "/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token: verification.body.devToken })
    });

    assert.equal(created.response.status, 200);
    assert.equal(created.body.user.emailVerified, false);
    assert.match(`${page}\n${app}`, /forgot password|reset password/i);
    assert.equal(forgot.response.status, 200);
    assert.ok(forgot.body.devToken);
    assert.equal(reset.response.status, 200);
    assert.equal(newLogin.response.status, 200);
    assert.equal(verification.response.status, 200);
    assert.ok(verification.body.devToken);
    assert.equal(verified.response.status, 200);
    assert.equal(verified.body.user.emailVerified, true);
  });

  it("blocks local JSON fallback during production startup", async () => {
    await assert.rejects(
      () => startTestServer({
        NODE_ENV: "production",
        AUTH_BASE_URL: "https://example.test",
        COOKIE_SECURE: "true"
      }),
      /MONGODB_URI is required in production/i
    );
  });

  it("sends production auth emails and never exposes dev tokens", async () => {
    const webhook = await startEmailWebhook();
    const productionServer = await startTestServer({
      NODE_ENV: "production",
      AUTH_BASE_URL: "https://example.test",
      EMAIL_PROVIDER: "webhook",
      EMAIL_FROM: "no-reply@example.test",
      EMAIL_WEBHOOK_URL: webhook.url,
      COOKIE_SECURE: "true",
      ALLOW_UNSAFE_PRODUCTION_JSON_FALLBACK: "true"
    });

    try {
      const email = uniqueEmail("prod-email");
      const created = await api(productionServer.baseUrl, "/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ displayName: "Production Learner", email, password: "test123" })
      });
      const resendVerification = await api(productionServer.baseUrl, "/api/auth/send-verification", {
        method: "POST",
        headers: authHeaders(created)
      });
      const forgot = await api(productionServer.baseUrl, "/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email })
      });

      assert.equal(created.response.status, 200);
      assert.equal(created.body.devToken, undefined);
      assert.equal(resendVerification.response.status, 200);
      assert.equal(resendVerification.body.devToken, undefined);
      assert.equal(forgot.response.status, 200);
      assert.equal(forgot.body.devToken, undefined);
      assert.equal(webhook.messages.length, 3);
      assert.deepEqual(webhook.messages.map((message) => message.type), ["verify", "verify", "reset"]);
      assert.ok(webhook.messages.every((message) => message.to === email));
      assert.match(webhook.messages[0].actionUrl, /^https:\/\/example\.test\/\?auth=verify&token=/);
      assert.match(webhook.messages[2].actionUrl, /^https:\/\/example\.test\/\?auth=reset&token=/);

      const resetToken = new URL(webhook.messages[2].actionUrl).searchParams.get("token");
      const reset = await api(productionServer.baseUrl, "/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: resetToken, password: "new-password" })
      });
      const login = await api(productionServer.baseUrl, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: "new-password" })
      });

      assert.equal(reset.response.status, 200);
      assert.equal(login.response.status, 200);
    } finally {
      await productionServer.stop();
      await webhook.stop();
    }
  });

  it("fails closed when production email delivery is not configured", async () => {
    const productionServer = await startTestServer({
      NODE_ENV: "production",
      AUTH_BASE_URL: "https://example.test",
      COOKIE_SECURE: "true",
      ALLOW_UNSAFE_PRODUCTION_JSON_FALLBACK: "true"
    });

    try {
      const blocked = await api(productionServer.baseUrl, "/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: testUser.email })
      });

      assert.equal(blocked.response.status, 503);
      assert.match(blocked.body.error, /email delivery is not configured/i);
      assert.equal(blocked.body.devToken, undefined);
    } finally {
      await productionServer.stop();
    }
  });

  it("rejects anonymous progress writes", async () => {
    const blocked = await api(server.baseUrl, "/api/progress", {
      method: "PATCH",
      body: JSON.stringify({ xp: 9999 })
    });

    assert.equal(blocked.response.status, 401);
    assert.match(blocked.body.error, /sign in required/i);

    const demo = await api(server.baseUrl, "/api/bootstrap");
    assert.equal(demo.body.progress.xp, 4280);
  });

  it("persists account progress without touching the demo user", async () => {
    const login = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });

    const updated = await api(server.baseUrl, "/api/progress", {
      method: "PATCH",
      headers: authHeaders(login),
      body: JSON.stringify({
        xp: 80,
        completedLessonIds: ["lesson-1"],
        learnedVocabularyIds: ["v-hadha"]
      })
    });

    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.progress.xp, 80);
    assert.ok(updated.body.progress.completedLessonIds.includes("lesson-1"));
    assert.ok(updated.body.progress.learnedVocabularyIds.includes("v-hadha"));

    const demo = await api(server.baseUrl, "/api/bootstrap");
    assert.equal(demo.body.user.isDemo, true);
    assert.equal(demo.body.progress.xp, 4280);
  });

  it("rejects oversized XP jumps in progress updates", async () => {
    const login = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });

    const blocked = await api(server.baseUrl, "/api/progress", {
      method: "PATCH",
      headers: authHeaders(login),
      body: JSON.stringify({ xp: 9999 })
    });

    assert.equal(blocked.response.status, 400);
    assert.match(blocked.body.error, /xp increase/i);
  });

  it("does not persist premium progress IDs for free accounts", async () => {
    const login = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });

    const updated = await api(server.baseUrl, "/api/progress", {
      method: "PATCH",
      headers: authHeaders(login),
      body: JSON.stringify({
        completedLessonIds: ["book-2-lesson-1"],
        learnedVocabularyIds: ["v2-l1-inna"],
        exerciseAttempts: { "ex-book-2-lesson-1": "correct" }
      })
    });

    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.progress.completedLessonIds.includes("book-2-lesson-1"), false);
    assert.equal(updated.body.progress.learnedVocabularyIds.includes("v2-l1-inna"), false);
    assert.equal(updated.body.progress.exerciseAttempts["ex-book-2-lesson-1"], undefined);
  });

  it("invalidates a session cookie on logout", async () => {
    const login = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });
    const headers = authHeaders(login);

    const logout = await api(server.baseUrl, "/api/auth/logout", {
      method: "POST",
      headers
    });
    const afterLogout = await api(server.baseUrl, "/api/bootstrap", {
      headers
    });
    const blockedSave = await api(server.baseUrl, "/api/progress", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ xp: 320 })
    });

    assert.equal(logout.response.status, 200);
    assert.match(logout.response.headers.get("set-cookie") || "", /madinah_session=.*Max-Age=0/);
    assert.equal(afterLogout.body.user.isDemo, true);
    assert.equal(blockedSave.response.status, 401);
  });

  it("merges saved progress maps across multiple updates", async () => {
    const email = uniqueEmail("merge");
    const created = await api(server.baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ displayName: "Merge Learner", email, password: "test123" })
    });

    const headers = authHeaders(created);
    const firstSave = await api(server.baseUrl, "/api/progress", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        xp: 40,
        exerciseAttempts: { "ex-lesson-1": "correct" },
        vocabularyStats: { "v-hadha": { attempts: 1, correct: 1 } }
      })
    });

    const secondSave = await api(server.baseUrl, "/api/progress", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        xp: 40,
        exerciseAttempts: { "ex-lesson-2": "incorrect" },
        vocabularyStats: { "v-baytun": { attempts: 1, correct: 0 } }
      })
    });

    assert.equal(firstSave.response.status, 200);
    assert.equal(secondSave.response.status, 200);
    assert.equal(secondSave.body.progress.xp, 40);
    assert.equal(secondSave.body.progress.exerciseAttempts["ex-lesson-1"], "correct");
    assert.equal(secondSave.body.progress.exerciseAttempts["ex-lesson-2"], "incorrect");
    assert.equal(secondSave.body.progress.vocabularyStats["v-hadha"].correct, 1);
    assert.equal(secondSave.body.progress.vocabularyStats["v-baytun"].attempts, 1);
  });

  it("persists bounded learner profile preferences", async () => {
    const email = uniqueEmail("preferences");
    const created = await api(server.baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ displayName: "Preference Learner", email, password: "test123" })
    });

    const saved = await api(server.baseUrl, "/api/progress", {
      method: "PATCH",
      headers: authHeaders(created),
      body: JSON.stringify({
        learningPreferences: {
          studyGoal: "vocabulary",
          skillFocus: "grammar",
          dailyMinutes: 999,
          onboardingComplete: true,
          unexpectedField: "ignore me"
        }
      })
    });

    assert.equal(saved.response.status, 200);
    assert.equal(saved.body.progress.learningPreferences.studyGoal, "vocabulary");
    assert.equal(saved.body.progress.learningPreferences.skillFocus, "grammar");
    assert.equal(saved.body.progress.learningPreferences.dailyMinutes, 45);
    assert.equal(saved.body.progress.learningPreferences.onboardingComplete, true);
    assert.equal(saved.body.progress.learningPreferences.reminderTime, undefined);
    assert.equal(saved.body.progress.learningPreferences.unexpectedField, undefined);
  });

  it("persists learner bookmarks and allows categories to be toggled off", async () => {
    const email = uniqueEmail("bookmarks");
    const created = await api(server.baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ displayName: "Bookmark Learner", email, password: "test123" })
    });
    const headers = authHeaders(created);

    const saved = await api(server.baseUrl, "/api/progress", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        bookmarks: {
          lessons: ["lesson-1", "book-2-lesson-1"],
          vocabulary: ["v-hadha", "v2-l1-inna"],
          examples: ["example-lesson-1-1"],
          exercises: ["book-lesson-1-1"]
        }
      })
    });
    const removed = await api(server.baseUrl, "/api/progress", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        bookmarks: {
          lessons: [],
          vocabulary: ["v-hadha"],
          examples: [],
          exercises: []
        }
      })
    });

    assert.equal(saved.response.status, 200);
    assert.deepEqual(saved.body.progress.bookmarks.lessons, ["lesson-1"]);
    assert.deepEqual(saved.body.progress.bookmarks.vocabulary, ["v-hadha"]);
    assert.deepEqual(saved.body.progress.bookmarks.examples, ["example-lesson-1-1"]);
    assert.deepEqual(saved.body.progress.bookmarks.exercises, ["book-lesson-1-1"]);
    assert.deepEqual(removed.body.progress.bookmarks.lessons, []);
    assert.deepEqual(removed.body.progress.bookmarks.vocabulary, ["v-hadha"]);
  });

  it("accepts learner content reports and exposes them to admins", async () => {
    const login = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });
    const report = await api(server.baseUrl, "/api/content/report", {
      method: "POST",
      headers: authHeaders(login),
      body: JSON.stringify({
        kind: "vocabulary",
        itemId: "v-hadha",
        lessonId: "lesson-1",
        bookSlug: "book-1",
        route: "vocabulary",
        message: "Please review the audio note."
      })
    });
    const admin = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: paidTestUser.email, password: paidTestUser.password })
    });
    const content = await api(server.baseUrl, "/api/admin/content", {
      headers: authHeaders(admin)
    });

    assert.equal(report.response.status, 200);
    assert.equal(report.body.report.status, "new");
    assert.equal(content.response.status, 200);
    assert.ok(content.body.reports.some((item) => item.itemId === "v-hadha" && item.message.includes("audio note")));
  });

  it("validates admin bulk imports before patching content", async () => {
    const admin = await api(server.baseUrl, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: paidTestUser.email, password: paidTestUser.password })
    });
    const headers = authHeaders(admin);

    const blocked = await api(server.baseUrl, "/api/admin/import", {
      method: "POST",
      headers,
      body: JSON.stringify({
        collection: "lessons",
        items: [{ id: "missing-lesson", contentStatus: "published" }]
      })
    });
    const imported = await api(server.baseUrl, "/api/admin/import", {
      method: "POST",
      headers,
      body: JSON.stringify({
        collection: "lessons",
        items: [{ id: "lesson-1", contentStatus: "published", sourceRef: "Book 1 p.1" }]
      })
    });
    const content = await api(server.baseUrl, "/api/admin/content", { headers });
    const lesson = content.body.lessons.find((item) => item.id === "lesson-1");

    assert.equal(blocked.response.status, 400);
    assert.match(blocked.body.error, /unknown IDs/);
    assert.equal(imported.response.status, 200);
    assert.equal(imported.body.updated, 1);
    assert.equal(lesson.contentStatus, "published");
    assert.equal(lesson.sourceRef, "Book 1 p.1");
  });

  it("persists adaptive practice progress keys safely", async () => {
    const email = uniqueEmail("adaptive");
    const created = await api(server.baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ displayName: "Adaptive Learner", email, password: "test123" })
    });

    const saved = await api(server.baseUrl, "/api/progress", {
      method: "PATCH",
      headers: authHeaders(created),
      body: JSON.stringify({
        xp: 37,
        exerciseAttempts: {
          "sentence-lesson-1": "correct",
          "morphology-morph-lesson-1-1-past": "incorrect",
          "cumulative-cumulative-vocab-1-v-hadha-1770000000000-1": "correct"
        },
        vocabularyStats: {
          "v-hadha": {
            level: 6,
            correct: 2,
            incorrect: 0,
            reviewCount: 2,
            lastReviewedAt: "2026-06-13T10:00:00.000Z",
            dueAt: "2026-06-20T10:00:00.000Z"
          }
        },
        mistakes: {
          "sentence-lesson-1": {
            id: "sentence-lesson-1",
            type: "Sentence Builder",
            lessonId: "lesson-1",
            prompt: "Rebuild the sentence",
            expected: "هٰذَا كِتَابٌ",
            given: "كِتَابٌ هٰذَا",
            resolved: false,
            createdAt: "2026-06-13T10:00:00.000Z"
          }
        }
      })
    });

    assert.equal(saved.response.status, 200);
    assert.equal(saved.body.progress.exerciseAttempts["sentence-lesson-1"], "correct");
    assert.equal(saved.body.progress.exerciseAttempts["morphology-morph-lesson-1-1-past"], "incorrect");
    assert.equal(saved.body.progress.exerciseAttempts["cumulative-cumulative-vocab-1-v-hadha-1770000000000-1"], "correct");
    assert.equal(saved.body.progress.vocabularyStats["v-hadha"].level, 5);
    assert.equal(saved.body.progress.mistakes["sentence-lesson-1"].type, "Sentence Builder");
  });

  it("does not expose private files through static routes", async () => {
    const publicApp = await fetch(`${server.baseUrl}/app.js?v=cache-check`);
    const blockedPaths = [
      "/.env",
      "/.gitignore",
      "/server.js",
      "/package.json",
      "/package-lock.json",
      "/data/curriculum.json",
      "/data/users.json",
      "/data/progress-users.json"
    ];

    assert.equal(publicApp.status, 200);
    assert.equal(publicApp.headers.get("x-content-type-options"), "nosniff");
    assert.match(publicApp.headers.get("content-security-policy") || "", /default-src 'self'/);

    for (const pathname of blockedPaths) {
      const response = await fetch(`${server.baseUrl}${pathname}`);
      const text = await response.text();
      assert.equal(response.status, 404, `${pathname} should not be publicly served`);
      assert.doesNotMatch(text, /MONGODB_URI|passwordHash|const http = require|lockfileVersion/);
    }
  });

  it("serves the account page code and cache-busted assets", async () => {
    const page = await fetch(`${server.baseUrl}/`).then((response) => response.text());
    const app = await fetch(`${server.baseUrl}/app.js?v=20260621-vocab-prompt-dedupe`).then((response) => response.text());
    const core = await fetch(`${server.baseUrl}/learning-core.js?v=20260621-vocab-prompt-dedupe`).then((response) => response.text());
    const manifestResponse = await fetch(`${server.baseUrl}/manifest.webmanifest`);
    const manifest = await manifestResponse.json();
    const serviceWorker = await fetch(`${server.baseUrl}/service-worker.js`).then((response) => response.text());

    assert.match(page, /20260621-vocab-prompt-dedupe/);
    assert.match(page, /learning-core\.js/);
    assert.match(page, /manifest\.webmanifest/);
    assert.match(app, /renderAccountPage/);
    assert.match(app, /renderOAuthButtons/);
    assert.match(app, /renderOAuthIcon/);
    assert.match(app, /google-icon/);
    assert.match(app, /microsoft-icon/);
    assert.match(app, /renderAdminPage/);
    assert.match(app, /renderReviewSessionPanel/);
    assert.match(app, /renderBookmarkButton/);
    assert.match(app, /renderReportIssueForm/);
    assert.match(app, /normalizedQuizPrompt/);
    assert.doesNotMatch(app, /localizedText\((quiz|question)\.prompt\)/);
    assert.match(app, /forgot-password/);
    assert.match(app, /send-verification/);
    assert.match(app, /planEntitlements/);
    assert.match(app, /routeRequiresPremium/);
    assert.match(app, /data-route="account"/);
    assert.match(app, /renderPublicHeader/);
    assert.match(app, /renderSubscriptionPage/);
    assert.match(app, /data-route="subscription"/);
    assert.match(app, /membership-table/);
    assert.match(app, /\/api\/auth\/\$\{escapeHtml\(provider\)\}/);
    assert.match(core, /createVocabularyQuestion/);
    assert.equal(manifest.name, "Madinah Arabic");
    assert.equal(manifest.display, "standalone");
    assert.match(manifestResponse.headers.get("content-type") || "", /manifest\+json/);
    assert.match(serviceWorker, /CACHE_NAME/);
    assert.match(serviceWorker, /\/api\//);
    assert.match(app, /শব্দভান্ডার/);
    assert.doesNotMatch(app, /data-language-toggle/);
    assert.doesNotMatch(app, /data-vocab-tester-mode/);
    assert.doesNotMatch(app, /madinah-session-token/);
  });

  it("does not configure transliteration prompts in vocabulary quizzes", async () => {
    const core = await fetch(`${server.baseUrl}/learning-core.js`).then((response) => response.text());
    const start = core.indexOf("function createVocabularyQuestion");
    const end = core.indexOf("function createVocabTester");
    const quizCode = core.slice(start, end);

    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    assert.match(quizCode, /answerKey: "english"/);
    assert.match(quizCode, /answerKey: "arabic"/);
    assert.doesNotMatch(quizCode, /transliteration/i);
  });
});

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}@example.test`;
}

async function bootstrapAs(server, user) {
  const login = await api(server.baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: user.email, password: user.password })
  });
  return api(server.baseUrl, "/api/bootstrap", {
    headers: authHeaders(login)
  });
}

async function startEmailWebhook() {
  const messages = [];
  const server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      messages.push(JSON.parse(body));
      response.writeHead(202, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address();
  return {
    messages,
    url: `http://127.0.0.1:${port}/mail`,
    stop: () => new Promise((resolve) => server.close(resolve))
  };
}

async function startObservabilityWebhook() {
  const events = [];
  const secrets = [];
  const server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      secrets.push(request.headers["x-observability-secret"] || "");
      events.push(JSON.parse(body));
      response.writeHead(202, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address();
  return {
    events,
    secrets,
    url: `http://127.0.0.1:${port}/logs`,
    async waitFor(predicate) {
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const event = events.find(predicate);
        if (event) return event;
        await new Promise((resolve) => setTimeout(resolve, 75));
      }
      throw new Error(`Timed out waiting for observability event. Received: ${JSON.stringify(events.slice(-5), null, 2)}`);
    },
    stop: () => new Promise((resolve) => server.close(resolve))
  };
}

function stripeEventPayload(type, object) {
  return {
    id: `evt_${type.replace(/[^a-z0-9]/gi, "_")}`,
    object: "event",
    api_version: "2026-02-25.clover",
    created: Math.floor(Date.now() / 1000),
    type,
    data: { object }
  };
}

async function postStripeWebhook(server, secret, payload, pathName = "/api/billing/webhook") {
  const body = JSON.stringify(payload);
  return api(server.baseUrl, pathName, {
    method: "POST",
    headers: { "stripe-signature": stripeSignatureHeader(secret, body) },
    body
  });
}

function stripeSignatureHeader(secret, body) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function waitForLog(server, pattern) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const logs = server.logs();
    if (pattern.test(logs)) return logs;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for log pattern ${pattern}. Recent logs:\n${server.logs().slice(-2000)}`);
}

function pronunciationFinalVowelIssues(word) {
  const arabicParts = String(word.arabic || "").split(" / ");
  const noteParts = String(word.transliteration || "").split(" / ");
  return arabicParts.flatMap((arabicPart, index) => {
    const expectedEnding = finalArabicPronunciationEnding(arabicPart);
    if (!expectedEnding) return [];

    const notePart = String(noteParts[index] || "").trim().toLowerCase().replace(/[^\w']+$/g, "");
    return notePart.endsWith(expectedEnding) ? [] : [{
      id: word.id,
      arabic: arabicPart,
      transliteration: notePart,
      expectedEnding
    }];
  });
}

function finalArabicPronunciationEnding(text) {
  const letters = [];
  for (const char of [...String(text).normalize("NFC")]) {
    if (/[\u064b-\u0652\u0670]/u.test(char)) {
      if (letters.length) letters[letters.length - 1].marks.push(char);
      continue;
    }

    if (/[\u0621-\u063a\u0641-\u064a]/u.test(char)) {
      letters.push({ base: char, marks: [] });
    }
  }

  if (!letters.length) return "";

  let finalLetter = letters[letters.length - 1];
  if (finalLetter.base === "ا" && !finalLetter.marks.length && letters.at(-2)?.marks.includes("\u064b")) {
    finalLetter = letters.at(-2);
  }

  const marks = new Set(finalLetter.marks);
  if (marks.has("\u064b")) return "an";
  if (marks.has("\u064c")) return "un";
  if (marks.has("\u064d")) return "in";
  if (marks.has("\u064e")) return "a";
  if (marks.has("\u064f")) return "u";
  if (marks.has("\u0650")) return "i";
  return "";
}

function hasConflictingArabicVowels(text) {
  const primaryMarks = new Set(["\u064b", "\u064c", "\u064d", "\u064e", "\u064f", "\u0650", "\u0652"]);
  let primaryMarksOnLetter = 0;

  for (const char of [...String(text).normalize("NFC")]) {
    if (/[\u064b-\u065f\u0670]/u.test(char)) {
      if (primaryMarks.has(char)) {
        primaryMarksOnLetter += 1;
        if (primaryMarksOnLetter > 1) return true;
      }
      continue;
    }

    primaryMarksOnLetter = 0;
  }

  return false;
}

function exampleComplexity(arabic) {
  const words = String(arabic).split(/\s+/).filter(Boolean).length;
  const clauses = (String(arabic).match(/[،؟.]/g) || []).length;
  const characters = [...String(arabic)].filter((char) => /[\u0600-\u06ff]/u.test(char)).length;
  return words * 10 + clauses * 4 + characters / 100;
}
