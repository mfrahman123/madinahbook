import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const core = require("../../learning-core.js");

const lessons = [
  {
    id: "lesson-1",
    bookSlug: "book-1",
    number: "1",
    arabic: "هٰذَا كِتَابٌ",
    vocabularyIds: ["w1", "w2"],
    morphologyCards: [
      {
        title: "دَرَسَ",
        meaning: "to study",
        root: "د ر س",
        forms: {
          past: "دَرَسَ",
          present: "يَدْرُسُ",
          verbalNoun: "دِرَاسَةٌ",
          activeParticiple: "دَارِسٌ"
        }
      }
    ]
  }
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

  it("keeps low-value proper-name style targets out of random vocabulary tests", () => {
    const pool = [
      ...vocabulary,
      { id: "w-yugoslavia", bookSlug: "book-1", lessonNumber: "PDF", arabic: "يُوغُوسْلَافِيَا", english: "Yugoslavia" },
      { id: "w-washington", bookSlug: "book-1", lessonNumber: "PDF", arabic: "وَاشِنْطُنُ", english: "Washington" },
      { id: "w-musa", bookSlug: "book-2", lessonNumber: "14", arabic: "مُوسَى", english: "Musa (proper name)" }
    ];
    const tester = core.createVocabTester({
      pool,
      allVocabulary: pool,
      lessons,
      size: 3,
      filterKey: "all",
      now: () => 1770000000000,
      random: seededRandom([0.98, 0.88, 0.78, 0.68, 0.58, 0.48, 0.38, 0.28, 0.18, 0.08])
    });

    assert.equal(tester.questions.length, 3);
    assert.ok(!tester.questions.some((question) => question.wordId === "w-yugoslavia"));
    assert.ok(!tester.questions.some((question) => question.wordId === "w-washington"));
    assert.ok(!tester.questions.some((question) => question.wordId === "w-musa"));
    assert.ok(!tester.questions.some((question) => question.options.includes("Yugoslavia")));
    assert.ok(!tester.questions.some((question) => question.options.includes("Washington")));
    assert.ok(tester.questions.every((question) => !question.prompt.includes(question.display || "__missing__")));
  });
});

describe("learning-core adaptive practice helpers", () => {
  it("explains vocabulary answers and tracks spaced review metadata", () => {
    const question = core.createVocabularyQuestion({
      word: vocabulary[0],
      optionPool: vocabulary,
      allVocabulary: vocabulary,
      lessons,
      idPrefix: "unit",
      now: () => 1770000000000,
      random: seededRandom([0.2, 0.8, 0.4, 0.1, 0.7, 0.3])
    });
    const stats = core.nextReviewStats({ level: 1, correct: 1, incorrect: 0 }, true, () => 1770000000000);

    assert.match(core.createQuizExplanation(question, "wrong"), /Correct answer:/);
    assert.equal(stats.level, 2);
    assert.equal(stats.correct, 2);
    assert.equal(stats.reviewCount, 1);
    assert.ok(stats.dueAt);
  });

  it("includes Arabic source text when explaining non-Arabic exercise answers", () => {
    const explanation = core.createQuizExplanation({
      answer: "marfu, mansub, majzum",
      answerArabic: "مَرْفُوعٌ، مَنْصُوبٌ، مَجْزُومٌ",
      answerKey: "exercise"
    }, "wrong");

    assert.match(explanation, /marfu, mansub, majzum/);
    assert.match(explanation, /مَرْفُوعٌ، مَنْصُوبٌ، مَجْزُومٌ/);
  });

  it("prioritises weak vocabulary from mistakes and incorrect reviews", () => {
    const weak = core.weakVocabulary(vocabulary, {
      learnedVocabularyIds: ["w1"],
      vocabularyStats: {
        w1: { correct: 1, incorrect: 4, dueAt: "2020-01-01T00:00:00.000Z" },
        w2: { correct: 5, incorrect: 0, dueAt: "2099-01-01T00:00:00.000Z" }
      },
      mistakes: {
        "tester-w3": { resolved: false }
      }
    }, 2, () => 1770000000000);

    assert.deepEqual(weak.map((word) => word.id), ["w1", "w3"]);
  });

  it("generates sentence, morphology, and cumulative drills", () => {
    const sentence = core.createSentenceBuilder(lessons[0], seededRandom([0.9, 0.1, 0.6]));
    const morphology = core.createMorphologyDrills(lessons[0], seededRandom([0.3, 0.7, 0.2]));
    const cumulative = core.createCumulativeTest({
      throughLesson: lessons[0],
      lessons,
      vocabulary,
      exercises: [
        {
          id: "ex-1",
          lessonId: "lesson-1",
          prompt: "Choose the meaning.",
          arabic: "هٰذَا كِتَابٌ",
          answer: "This is a book.",
          options: ["This is a book.", "This is a pen.", "This is a house.", "This is a door."]
        }
      ],
      size: 3,
      now: () => 1770000000000,
      random: seededRandom([0.9, 0.1, 0.6, 0.2, 0.4, 0.7, 0.3, 0.5])
    });

    assert.equal(sentence.answer, "هٰذَا كِتَابٌ");
    assert.ok(sentence.tokens.length >= 2);
    assert.ok(morphology.length >= 1);
    assert.ok(morphology[0].options.includes(morphology[0].answer));
    assert.equal(morphology[0].prompt, "Choose the past form.");
    assert.equal(morphology[0].meaning, "to study");
    assert.equal(morphology[0].root, "د ر س");
    assert.doesNotMatch(morphology[0].prompt, /دَرَسَ/);
    assert.equal(cumulative.questions.length, 3);
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
