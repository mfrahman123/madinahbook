import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const core = require("../../learning-core.js");

const lessons = [
  { id: "lesson-1", bookSlug: "book-1", number: "1" }
];

const vocabulary = [
  { id: "w1", bookSlug: "book-1", lessonNumber: "1", arabic: "كِتَابٌ", english: "book" },
  { id: "w2", bookSlug: "book-1", lessonNumber: "1", arabic: "قَلَمٌ", english: "pen" },
  { id: "w3", bookSlug: "book-1", lessonNumber: "1", arabic: "بَيْتٌ", english: "house" },
  { id: "w4", bookSlug: "book-1", lessonNumber: "1", arabic: "بَابٌ", english: "door" },
  { id: "w5", bookSlug: "book-1", lessonNumber: "1", arabic: "نَجْمٌ", english: "star" }
];

function seededRandom(values) {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

describe("learning-core vocabulary quizzes", () => {
  it("creates questions without transliteration modes and with four unique options", () => {
    const question = core.createVocabularyQuestion({
      word: vocabulary[0],
      optionPool: vocabulary,
      allVocabulary: vocabulary,
      lessons,
      idPrefix: "unit",
      now: () => 1770000000000,
      random: seededRandom([0.2, 0.8, 0.4, 0.1, 0.7, 0.3])
    });

    assert.equal(question.lessonId, "lesson-1");
    assert.notEqual(question.answerKey, "transliteration");
    assert.equal(new Set(question.options).size, question.options.length);
    assert.ok(question.options.includes(question.answer));
    assert.ok(question.options.length >= 4);
  });

  it("generates randomised three-question vocabulary tester payloads", () => {
    const tester = core.createVocabTester({
      pool: vocabulary,
      allVocabulary: vocabulary,
      lessons,
      size: 3,
      filterKey: "book-1",
      now: () => 1770000000000,
      random: seededRandom([0.9, 0.1, 0.6, 0.2, 0.4, 0.7, 0.3, 0.5])
    });

    assert.equal(tester.questions.length, 3);
    assert.equal(tester.poolSize, vocabulary.length);
    assert.equal(tester.filterKey, "book-1");
    assert.deepEqual(tester.questions.map((question) => question.number), [1, 2, 3]);
    assert.equal(new Set(tester.questions.map((question) => question.wordId)).size, 3);
  });
});

describe("learning-core entitlements", () => {
  it("locks premium books for free users and exposes them for paid users", () => {
    const books = [{ slug: "book-1", status: "available" }, { slug: "book-2", status: "available" }];
    const freeBooks = core.filterBooksForUser(books, { subscriptionPlan: "free", subscriptionStatus: "active" });
    const paidBooks = core.filterBooksForUser(books, { subscriptionPlan: "paid", subscriptionStatus: "active" });

    assert.equal(freeBooks.find((book) => book.slug === "book-2").status, "locked");
    assert.equal(freeBooks.find((book) => book.slug === "book-2").premiumRequired, true);
    assert.equal(paidBooks.find((book) => book.slug === "book-2").status, "available");
  });
});
