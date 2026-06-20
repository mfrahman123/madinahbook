import assert from "node:assert/strict";
import fs from "node:fs";
import { after, before, describe, it } from "node:test";
import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { paidTestUser, startTestServer, testUser } from "../helpers/test-server.mjs";

describe("Madinah Arabic Selenium flows", () => {
  let server;
  let driver;

  before(async () => {
    server = await startTestServer();
    driver = await buildDriver();
  });

  after(async () => {
    if (driver) await driver.quit();
    await server?.stop();
  });

  it("shows the landing page and gates protected course content", async () => {
    await openFreshHome(driver, server.baseUrl);

    await waitForText(driver, "Learn Arabic through a guided, premium study workspace.");
    await waitForText(driver, "About");
    await waitForText(driver, "Curriculum");
    await waitForText(driver, "Pricing");
    assert.equal((await driver.findElements(By.css(".sidebar"))).length, 0);

    await driver.findElement(By.css('[data-route="subscription"]')).click();
    await waitForText(driver, "Free vs Premium");

    await driver.findElement(By.css('[data-route="curriculum"]')).click();
    await waitForText(driver, "Madinah Arabic Books 1-3");
    await driver.findElement(By.css('[data-route="book-1"]')).click();

    await waitForText(driver, "Please sign in to continue learning.");
    await waitForText(driver, "Sign In");
  });

  it("keeps the landing and login surfaces usable on mobile width", async () => {
    try {
      await driver.manage().window().setRect({ width: 390, height: 844 });
      await openFreshHome(driver, server.baseUrl);

      await waitForText(driver, "Learn Arabic through a guided, premium study workspace.");
      assert.equal(await hasHorizontalOverflow(driver), false);

      await clickFirstVisible(driver, '[data-auth-mode="login"]');
      await waitForText(driver, "Sign In");
      assert.equal(await hasHorizontalOverflow(driver), false);
    } finally {
      await driver.manage().window().setRect({ width: 1440, height: 1100 });
    }
  });

  it("uses the mobile app shell for signed-in learners", async () => {
    try {
      await driver.manage().window().setRect({ width: 390, height: 844 });
      await login(driver, server.baseUrl, paidTestUser);

      await driver.wait(until.elementLocated(By.css(".mobile-bottom-nav")), 8000);
      assert.equal(await driver.findElement(By.css(".mobile-bottom-nav")).isDisplayed(), true);
      assert.equal(await driver.findElement(By.css(".mobile-appbar")).isDisplayed(), true);
      assert.equal(await driver.findElement(By.css(".sidebar")).isDisplayed(), false);
      assert.equal(await driver.findElement(By.css(".mobile-today-screen")).isDisplayed(), true);
      assert.equal(await driver.findElement(By.css(".mobile-sticky-action")).isDisplayed(), true);
      await waitForText(driver, "Daily Study Mission");
      assert.equal(await hasHorizontalOverflow(driver), false);

      await driver.findElement(By.css('.mobile-bottom-nav [data-route="book-1"]')).click();
      await waitForText(driver, "Lesson 1 of 23");
      assert.equal(await driver.findElement(By.css(".mobile-lesson-picker")).isDisplayed(), true);
      assert.equal(await driver.findElement(By.css(".mobile-study-deck")).isDisplayed(), true);
      assert.equal(await driver.findElement(By.css(".lesson-list")).isDisplayed(), false);
      assert.equal(await hasHorizontalOverflow(driver), false);

      await driver.findElement(By.css('.mobile-bottom-nav [data-route="vocabulary"]')).click();
      await waitForText(driver, "Flashcards");
      assert.equal(await driver.findElement(By.css(".mobile-flashcard-panel")).isDisplayed(), true);
    } finally {
      await driver.manage().window().setRect({ width: 1440, height: 1100 });
    }
  });

  it("opens forgotten password and reset flows from the login modal", async () => {
    await openFreshHome(driver, server.baseUrl);
    await waitForText(driver, "Learn Arabic through a guided, premium study workspace.");
    await clickFirstVisible(driver, '[data-auth-mode="login"]');
    await waitForText(driver, "Forgot password?");

    await driver.findElement(By.css('[data-auth-mode="forgot"]')).click();
    await waitForText(driver, "Forgot Password");
    await driver.findElement(By.css('[data-auth-form] input[name="email"]')).sendKeys("reset-browser@example.test");
    await driver.findElement(By.css('[data-auth-form] button[type="submit"]')).click();

    await waitForText(driver, "Reset Password");
    await waitForText(driver, "Back to sign in");
  });

  it("opens account details from the profile avatar instead of signing out", async () => {
    await login(driver, server.baseUrl);

    await driver.findElement(By.css(".auth-avatar")).click();
    await waitForText(driver, "Profile Details");
    await waitForText(driver, testUser.email);
    await waitForText(driver, "Local JSON");

    const bodyText = await driver.findElement(By.css("body")).getText();
    assert.match(bodyText, /Account status/);
    assert.match(bodyText, /Subscription status/);
    assert.match(bodyText, /Content access/);
    assert.match(bodyText, /Email verification/);
    assert.match(bodyText, /Free/);
    assert.match(bodyText, /Sign out/);
    assert.doesNotMatch(bodyText, /Admin/);
    assert.doesNotMatch(bodyText, /Resources/);
    assert.doesNotMatch(bodyText, /Sign In/);
    assert.doesNotMatch(bodyText, /Free vs Premium/);

    const storedToken = await driver.executeScript("return window.localStorage.getItem('madinah-session-token');");
    const visibleCookies = await driver.executeScript("return document.cookie;");
    assert.equal(storedToken, null);
    assert.doesNotMatch(visibleCookies, /madinah_session/);
  });

  it("shows daily mission onboarding and saves learner profile choices", async () => {
    await login(driver, server.baseUrl);

    await waitForText(driver, "Daily Study Mission");
    await waitForText(driver, "Shape your daily path");

    await driver.findElement(By.css('[data-study-pref-key="skillFocus"][data-study-pref-value="grammar"]')).click();
    await waitForText(driver, "Grammar");
    await driver.findElement(By.css("[data-onboarding-complete]")).click();
    await driver.wait(async () => {
      const bodyText = await driver.findElement(By.css("body")).getText();
      return !bodyText.includes("Shape your daily path");
    }, 8000, "Timed out waiting for onboarding panel to close");
    await waitForText(driver, "Study profile");
  });

  it("locks premium content for the free plan", async () => {
    await login(driver, server.baseUrl);

    await driver.findElement(By.css('.sidebar [data-route="book-2"]')).click();
    await waitForText(driver, "Upgrade to Premium");
    await waitForText(driver, "Book 2");

    await driver.get(`${server.baseUrl}/?route=vocabulary&vocabTab=tester`);
    await waitForText(driver, "Basic tester");
    const book2 = await driver.findElement(By.css('[data-vocab-tester-book="book-2"]'));
    const due = await driver.findElement(By.css('[data-vocab-tester-focus="due"]'));
    assert.notEqual(await book2.getAttribute("disabled"), null);
    assert.notEqual(await due.getAttribute("disabled"), null);

    await driver.findElement(By.css('.sidebar [data-route="progress"]')).click();
    await waitForText(driver, "Upgrade to Premium");
  });

  it("opens the admin content editor for the admin account", async () => {
    await login(driver, server.baseUrl, paidTestUser);

    await driver.findElement(By.css('.sidebar [data-route="admin"]')).click();
    await waitForText(driver, "Content Management");
    await waitForText(driver, "Vocabulary");
    await waitForText(driver, "v-hadha");

    const editors = await driver.findElements(By.css("[data-admin-content-form]"));
    assert.ok(editors.length > 0);
  });

  it("signs out from the account details page", async () => {
    await login(driver, server.baseUrl, paidTestUser);

    await driver.findElement(By.css(".auth-avatar")).click();
    await waitForText(driver, "Profile Details");
    await driver.findElement(By.css("[data-auth-signout]")).click();

    await waitForText(driver, "Sign in to start");
    const avatars = await driver.findElements(By.css(".auth-avatar"));
    assert.equal(avatars.length, 0);
  });

  it("keeps Bengali localization hidden while the toggle is paused", async () => {
    await driver.get(server.baseUrl);
    await driver.executeScript("window.localStorage.setItem('madinah-language', 'bn');");
    await driver.get(server.baseUrl);

    await waitForText(driver, "Learn Arabic through a guided, premium study workspace.");

    const toggles = await driver.findElements(By.css("[data-language-toggle]"));
    const htmlLang = await driver.executeScript("return document.documentElement.lang");
    const bodyText = await driver.findElement(By.css("body")).getText();

    assert.equal(toggles.length, 0);
    assert.equal(htmlLang, "en");
    assert.doesNotMatch(bodyText, /শব্দভান্ডার/);
    assert.doesNotMatch(bodyText, /নিয়মিত পাঠ/);
  });

  it("generates three filtered vocabulary tester questions without Match AND/OR controls", async () => {
    await login(driver, server.baseUrl, paidTestUser);
    await driver.get(`${server.baseUrl}/?route=vocabulary&vocabTab=tester`);

    await waitForText(driver, "Vocab Tester");
    await waitForQuestionCount(driver, 3);

    const bodyText = await driver.findElement(By.css("body")).getText();
    assert.doesNotMatch(bodyText, /\bMATCH\b/);
    assert.doesNotMatch(bodyText, /\bAND\b/);
    assert.doesNotMatch(bodyText, /\bOR\b/);

    const book2 = await driver.findElement(By.css('[data-vocab-tester-book="book-2"]'));
    assert.equal(await book2.getAttribute("disabled"), null);
    await book2.click();
    await waitForText(driver, "Book 2");

    const book3 = await driver.findElement(By.css('[data-vocab-tester-book="book-3"]'));
    assert.equal(await book3.getAttribute("disabled"), null);
    await book3.click();
    await waitForText(driver, "Book 3");

    await driver.findElement(By.css('[data-vocab-tester-focus="new"]')).click();
    await waitForQuestionCount(driver, 3);

    let firstQuestion = await driver.findElement(By.css(".vocab-test-question"));
    await firstQuestion.findElement(By.css("[data-vocab-tester-answer]")).click();
    await driver.wait(async () => {
      [firstQuestion] = await driver.findElements(By.css(".vocab-test-question"));
      if (!firstQuestion) return false;
      const options = await firstQuestion.findElements(By.css("[data-vocab-tester-answer]"));
      const disabledStates = await Promise.all(options.map((option) => option.getAttribute("disabled")));
      return disabledStates.length > 0 && disabledStates.every((value) => value !== null);
    }, 5000, "Timed out waiting for answered tester options to lock");

    await firstQuestion.findElement(By.css('[data-retry-answer="vocab-tester"]')).click();
    await driver.wait(async () => {
      [firstQuestion] = await driver.findElements(By.css(".vocab-test-question"));
      if (!firstQuestion) return false;
      const options = await firstQuestion.findElements(By.css("[data-vocab-tester-answer]"));
      const retryButtons = await firstQuestion.findElements(By.css('[data-retry-answer="vocab-tester"]'));
      const disabledStates = await Promise.all(options.map((option) => option.getAttribute("disabled")));
      return options.length > 0 && retryButtons.length === 0 && disabledStates.every((value) => value === null);
    }, 5000, "Timed out waiting for retry to unlock tester options");
  });

  it("keeps light mode selected controls calm and non-yellow", async () => {
    await login(driver, server.baseUrl, paidTestUser);
    await driver.get(`${server.baseUrl}/?route=vocabulary&theme=light`);

    await waitForText(driver, "Book 1 Vocabulary");
    const vocabularyPalette = await readSelectedPalette(driver, [".lesson-tab.active", ".vocab-book-card.active"]);
    assertLightSelectedPalette(vocabularyPalette);

    await driver.get(`${server.baseUrl}/?route=vocabulary&vocabTab=tester&theme=light`);
    await waitForText(driver, "Vocab Tester");
    const testerPalette = await readSelectedPalette(driver, [".lesson-tab.active", ".filter-chip.active"]);
    assertLightSelectedPalette(testerPalette);

    const backgrounds = testerPalette.map((sample) => sample.background).filter(Boolean);
    assert.ok(colorDistance(backgrounds[0], backgrounds[1]) < 8, "top tabs and lower chips should share the same selected surface");
  });

  it("shows slash-formatted Book 3 verb pairs in the vocabulary list", async () => {
    await login(driver, server.baseUrl, paidTestUser);
    await driver.get(`${server.baseUrl}/?route=vocabulary&vocabBook=book-3`);

    await waitForText(driver, "Book 3 Vocabulary");
    await waitForText(driver, "Status");
    await waitForText(driver, "Next review");
    await waitForText(driver, "تَغَيَّرَ / يَتَغَيَّرُ");

    const bodyText = await driver.findElement(By.css("body")).getText();
    assert.doesNotMatch(bodyText, /تَغَيَّرَ\s*:\s*يَتَغَيَّرُ/);
    assert.doesNotMatch(bodyText, /نَوَى\s*\/\s*نِيَّةً/);
  });

  it("shows lesson practice sections and a lesson vocabulary quiz", async () => {
    await login(driver, server.baseUrl, paidTestUser);
    await driver.get(`${server.baseUrl}/?route=book-1&lesson=lesson-1`);

    await waitForText(driver, "Lesson Path");
    await waitForText(driver, "Lesson Pattern");
    await waitForText(driver, "Reading mode");
    await waitForText(driver, "Tap words to inspect");
    await waitForText(driver, "مَا هٰذَا؟ هٰذَا كِتَابٌ.");
    const learnExamples = await driver.findElements(By.css(".lesson-example-card"));
    assert.equal(learnExamples.length, 3);
    assert.ok((await driver.findElements(By.css(".arabic-token"))).length > 0);
    const firstExampleText = await learnExamples[0].getText();
    assert.match(firstExampleText, /View answer/);
    assert.doesNotMatch(firstExampleText, /This is a pen\./);

    await learnExamples[0].findElement(By.css(".answer-reveal summary")).click();
    await driver.wait(async () => {
      const text = await learnExamples[0].getText();
      return text.includes("This is a pen.");
    }, 5000);

    await driver.findElement(By.css('.lesson-tabs [data-lesson-tab="book-exercises"]')).click();
    await waitForText(driver, "Book Exercises");

    const exerciseSections = await driver.findElements(By.css(".book-exercise-item"));
    assert.ok(exerciseSections.length >= 5);
    const firstExerciseAnswer = await driver.findElement(By.css(".book-exercise-item[open] .example-answer"));
    await firstExerciseAnswer.findElement(By.css("summary")).click();
    await driver.wait(async () => {
      const answerText = await firstExerciseAnswer.getText();
      return answerText.includes("What is this?");
    }, 5000, "Timed out waiting for example answer reveal");
    assert.doesNotMatch(await firstExerciseAnswer.getText(), /مَا هٰذَا؟/);

    await driver.get(`${server.baseUrl}/?route=book-2&lesson=book-2-lesson-8&tab=book-exercises`);
    await waitForText(driver, "Example questions");
    const translationAnswer = await driver.findElement(By.xpath("//article[contains(@class, 'example-question')][.//p[contains(., 'Translate this sentence into English.')]]//details[contains(@class, 'example-answer')]"));
    await translationAnswer.findElement(By.css("summary")).click();
    await waitForText(driver, "We went to the university.");
    const translationAnswerText = await translationAnswer.getText();
    assert.doesNotMatch(translationAnswerText, /ذَهَبْنَا إِلَى الْجَامِعَةِ/);

    await driver.get(`${server.baseUrl}/?route=book-1&lesson=lesson-8&tab=book-exercises`);
    await waitForText(driver, "Example questions");
    const arabicAnswerExample = await driver.findElement(By.xpath("//details[contains(@class, 'book-exercise-item') and @open]//article[contains(@class, 'example-question')][.//p[contains(., 'Which Arabic word means')]]"));
    assert.doesNotMatch(await arabicAnswerExample.getText(), /أَمَامَ/);
    const arabicAnswerDetails = await arabicAnswerExample.findElement(By.css(".example-answer"));
    await driver.executeScript("arguments[0].open = true;", arabicAnswerDetails);
    await driver.wait(async () => {
      const answerText = await driver.executeScript("return arguments[0].innerText;", arabicAnswerExample);
      return answerText.includes("أَمَامَ");
    }, 5000, "Timed out waiting for Arabic answer reveal");

    await driver.findElement(By.css('.lesson-tabs [data-lesson-tab="quiz"]')).click();
    await waitForText(driver, "Vocabulary Quiz");
    await waitForText(driver, "Random Vocabulary Quiz");
    await waitForText(driver, "Sentence Builder");
    const sentenceInput = await driver.findElement(By.css('.sentence-builder-form input[name="sentenceAnswer"]'));
    assert.equal(await sentenceInput.getAttribute("placeholder"), "Type the full Arabic sentence");
  });

  it("shows adaptive milestone practice and account learning preferences", async () => {
    await login(driver, server.baseUrl, paidTestUser);
    await driver.get(`${server.baseUrl}/?route=book-1&lesson=lesson-5&tab=quiz`);

    await waitForText(driver, "Sentence Builder");
    await waitForText(driver, "Cumulative Check");
    await waitForText(driver, "Through lesson 5");
    assert.ok((await driver.findElements(By.css(".cumulative-question"))).length > 0);

    await driver.findElement(By.css(".auth-avatar")).click();
    await waitForText(driver, "Learning Preferences");
    await waitForText(driver, "Arabic audio speed");
    await waitForText(driver, "Arabic text size");
  });

  it("pads sparse source lessons into five practice sections", async () => {
    await login(driver, server.baseUrl, paidTestUser);
    await driver.get(`${server.baseUrl}/?route=book-3&lesson=book-3-lesson-6&tab=book-exercises`);

    await waitForText(driver, "Nouns of Place and Time");
    await waitForText(driver, "5 sections");

    const exerciseSections = await driver.findElements(By.css(".book-exercise-item"));
    assert.equal(exerciseSections.length, 5);
    await waitForText(driver, "Example questions");
  });

  it("opens Book 2 lessons as available course content", async () => {
    await login(driver, server.baseUrl, paidTestUser);
    await driver.findElement(By.css('.sidebar [data-route="book-2"]')).click();

    await waitForText(driver, "Book 2");
    await waitForText(driver, "إِنَّ, لَعَلَّ, ذُو and Large Numbers");

    const lockedText = await driver.findElement(By.css("body")).getText();
    assert.doesNotMatch(lockedText, /Coming Soon/);
    assert.doesNotMatch(lockedText, /Upgrade to Premium/);

    await driver.findElement(By.css('.lesson-tabs [data-lesson-tab="quiz"]')).click();
    await waitForText(driver, "Random Vocabulary Quiz");

    await driver.get(`${server.baseUrl}/?route=book-2&lesson=book-2-lesson-8&tab=quiz`);
    await waitForText(driver, "Pattern drills");
    await waitForText(driver, "to hear");
    await waitForText(driver, "س م ع");
    const morphologyPrompt = await driver.findElement(By.css(".mini-drill p")).getText();
    assert.equal(morphologyPrompt, "Choose the past form.");
    assert.doesNotMatch(morphologyPrompt, /سَمِعَ/);
  });

  it("opens Book 3 lessons as available course content", async () => {
    await login(driver, server.baseUrl, paidTestUser);
    await driver.get(`${server.baseUrl}/?route=book-3`);

    await waitForText(driver, "Book 3");
    await waitForText(driver, "I'rab of Nouns and Verb Moods");

    const lockedText = await driver.findElement(By.css("body")).getText();
    assert.doesNotMatch(lockedText, /Coming Soon\\s+Locked until released/);

    await driver.findElement(By.css('.lesson-tabs [data-lesson-tab="book-exercises"]')).click();
    const exerciseSections = await driver.findElements(By.css(".book-exercise-item"));
    assert.ok(exerciseSections.length >= 5);

    await driver.findElement(By.css('.lesson-tabs [data-lesson-tab="quiz"]')).click();
    await waitForText(driver, "Random Vocabulary Quiz");

    await driver.get(`${server.baseUrl}/?route=book-3&lesson=book-3-lesson-12&tab=quiz`);
    await waitForText(driver, "What kind of word is");
    await waitForText(driver, "ظَرْفُ زَمَانٍ");
    await waitForText(driver, "اسْمُ الْمَفْعُولِ");
    await waitForText(driver, "اسْمُ الْآلَةِ");

    await driver.get(`${server.baseUrl}/?route=book-1&lesson=lesson-8&tab=quiz`);
    await waitForText(driver, "Which phrase means");
    assert.equal((await driver.findElements(By.css(".lesson-quiz-card .exercise-prompt"))).length, 0);

    await driver.get(`${server.baseUrl}/?route=book-1&lesson=lesson-17&tab=quiz`);
    await waitForText(driver, "Which are plural forms of");
    assert.equal((await driver.findElements(By.css(".lesson-quiz-card .exercise-prompt"))).length, 0);

    await driver.get(`${server.baseUrl}/?route=exercises`);
    await waitForText(driver, "Exercises");
    await driver.findElement(By.xpath("//button[contains(@class, 'exercise-link') and contains(., 'plural forms')]")).click();
    await waitForText(driver, "Which are plural forms of");
    assert.equal((await driver.findElements(By.css(".exercise-card .exercise-prompt"))).length, 0);

    await driver.get(`${server.baseUrl}/?route=book-3&lesson=book-3-lesson-8&tab=quiz`);
    await waitForText(driver, "Which noun is definite in the model sentence?");
    await waitForText(driver, "مَعْرِفَةٌ");
    const modelPrompt = await driver.findElement(By.css(".lesson-quiz-card .exercise-prompt")).getText();
    assert.equal(modelPrompt, "جَاءَ رَجُلٌ، فَسَأَلْتُ الرَّجُلَ.");
    assert.notEqual(modelPrompt, "الرَّجُلَ");
  });
});

async function buildDriver() {
  const options = new chrome.Options();
  const headed = process.env.SELENIUM_HEADED === "true";
  options.addArguments("--window-size=1440,1100", "--disable-gpu", "--no-sandbox");
  if (!headed) options.addArguments("--headless=new");

  const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (fs.existsSync(chromePath)) {
    options.setChromeBinaryPath(chromePath);
  }

  return new Builder().forBrowser("chrome").setChromeOptions(options).build();
}

async function openFreshHome(driver, baseUrl) {
  await driver.get(baseUrl);
  await driver.manage().deleteAllCookies();
  await driver.executeScript("window.localStorage.clear();");
  await driver.get(baseUrl);
}

async function login(driver, baseUrl, user = testUser) {
  await openFreshHome(driver, baseUrl);
  const loginButton = await driver.wait(until.elementLocated(By.css('[data-auth-mode="login"]')), 8000);
  await loginButton.click();
  await driver.wait(until.elementLocated(By.css('[data-auth-form] input[name="email"]')), 5000);
  await driver.findElement(By.css('[data-auth-form] input[name="email"]')).sendKeys(user.email);
  await driver.findElement(By.css('[data-auth-form] input[name="password"]')).sendKeys(user.password);
  await driver.findElement(By.css('[data-auth-form] button[type="submit"]')).click();
  await driver.wait(until.elementLocated(By.css(".auth-avatar")), 8000);
}

async function waitForText(driver, text, timeout = 8000) {
  await driver.wait(async () => {
    const body = await driver.findElement(By.css("body")).getText();
    return body.includes(text);
  }, timeout, `Timed out waiting for text: ${text}`);
}

async function waitForQuestionCount(driver, count) {
  await driver.wait(async () => {
    const questions = await driver.findElements(By.css(".vocab-test-question"));
    return questions.length === count;
  }, 8000, `Timed out waiting for ${count} vocabulary questions`);
}

async function hasHorizontalOverflow(driver) {
  return driver.executeScript(`
    const documentWidth = Math.ceil(document.documentElement.scrollWidth);
    const viewportWidth = Math.ceil(document.documentElement.clientWidth);
    return documentWidth > viewportWidth + 1;
  `);
}

async function clickFirstVisible(driver, selector) {
  const elements = await driver.findElements(By.css(selector));
  for (const element of elements) {
    if (await element.isDisplayed()) {
      await element.click();
      return;
    }
  }
  throw new Error(`No visible element found for selector: ${selector}`);
}

async function readSelectedPalette(driver, selectors) {
  return driver.executeScript(`
    const parseRgb = (value) => {
      const match = value.match(/rgba?\\(([^)]+)\\)/);
      if (!match) return null;
      return match[1].split(",").slice(0, 3).map((part) => Number.parseFloat(part.trim()));
    };

    return arguments[0].map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const styles = window.getComputedStyle(element);
      return {
        selector,
        color: parseRgb(styles.color),
        background: parseRgb(styles.backgroundColor)
      };
    }).filter(Boolean);
  `, selectors);
}

function assertLightSelectedPalette(samples) {
  assert.ok(samples.length > 0, "expected selected controls to be visible");
  for (const sample of samples) {
    assert.ok(!isYellow(sample.color), `${sample.selector} selected text should not be yellow/gold`);
    assert.ok(!isNearlyPageBackground(sample.background), `${sample.selector} selected background should be visibly highlighted`);
  }
}

function isYellow(color) {
  if (!color) return false;
  const [red, green, blue] = color;
  return red > 120 && green > 90 && blue < 100;
}

function isNearlyPageBackground(color) {
  if (!color) return true;
  return color.every((channel) => channel > 238);
}

function colorDistance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.sqrt(a.reduce((sum, channel, index) => sum + (channel - b[index]) ** 2, 0));
}
