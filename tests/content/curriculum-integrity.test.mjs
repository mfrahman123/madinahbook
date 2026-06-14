import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const curriculum = JSON.parse(fs.readFileSync(path.join(root, "data", "curriculum.json"), "utf8"));
const capacitorConfig = JSON.parse(fs.readFileSync(path.join(root, "capacitor.config.json"), "utf8"));

describe("curriculum content integrity", () => {
  it("keeps the expected Book 1-3 lesson snapshot", () => {
    const counts = Object.fromEntries(
      curriculum.books.map((book) => [
        book.slug,
        curriculum.lessons.filter((lesson) => lesson.bookSlug === book.slug).length
      ])
    );

    assert.deepEqual(counts, {
      "book-1": 23,
      "book-2": 31,
      "book-3": 34
    });
  });

  it("has three ordered learn examples for every lesson", () => {
    for (const lesson of curriculum.lessons) {
      assert.equal(lesson.examples.length, 3, `${lesson.id} should have three examples`);
      assert.deepEqual(lesson.examples.map((example) => example.difficulty), [1, 2, 3], `${lesson.id} example difficulty order`);
      assert.deepEqual(lesson.examples.map((example) => example.label), ["A", "B", "C"], `${lesson.id} example labels`);
    }
  });

  it("keeps every rendered lesson example unique", () => {
    const seen = new Map();
    for (const lesson of curriculum.lessons) {
      for (const example of lesson.examples) {
        const arabic = example.arabic.trim();
        const location = `${lesson.bookSlug} lesson ${lesson.number} example ${example.label}`;
        assert.ok(!seen.has(arabic), `${location} duplicates ${seen.get(arabic)}: ${arabic}`);
        seen.set(arabic, location);
      }
    }
  });

  it("provides a grammar explanation for every lesson", () => {
    for (const lesson of curriculum.lessons) {
      assert.ok(lesson.grammarExplanation, `${lesson.id} missing grammar explanation`);
      for (const field of ["rule", "example", "exampleTranslation", "commonMistake", "summary"]) {
        assert.ok(lesson.grammarExplanation[field], `${lesson.id} missing grammar explanation ${field}`);
      }
    }
  });

  it("tracks source references and review status for every lesson", () => {
    const allowedStatuses = new Set(["generated-review", "needs-review", "verified"]);
    for (const lesson of curriculum.lessons) {
      assert.ok(lesson.sourceRef, `${lesson.id} missing sourceRef`);
      assert.ok(allowedStatuses.has(lesson.contentStatus), `${lesson.id} has invalid contentStatus`);
    }
  });

  it("provides structured morphology cards for core verb lessons", () => {
    const requiredLessonKeys = [
      "book-2:4",
      "book-2:10",
      "book-2:14",
      "book-2:26",
      "book-2:27",
      "book-2:28",
      "book-2:29",
      "book-3:16",
      "book-3:17",
      "book-3:20",
      "book-3:22",
      "book-3:23",
      "book-3:25",
      "book-3:26"
    ];

    for (const key of requiredLessonKeys) {
      const lesson = curriculum.lessons.find((item) => `${item.bookSlug}:${item.number}` === key);
      assert.ok(lesson?.morphologyCards?.length, `${key} should include morphology cards`);
    }

    for (const lesson of curriculum.lessons) {
      for (const card of lesson.morphologyCards || []) {
        assert.ok(card.title, `${lesson.id} morphology card missing title`);
        assert.ok(card.meaning, `${lesson.id} morphology card missing meaning`);
        assert.ok(card.root, `${lesson.id} morphology card missing root`);
        assert.ok(card.pattern, `${lesson.id} morphology card missing pattern`);
        assert.ok(card.forms?.past, `${lesson.id} ${card.title} missing past form`);
        assert.ok(card.forms?.present, `${lesson.id} ${card.title} missing present form`);
        assert.ok(card.forms?.verbalNoun, `${lesson.id} ${card.title} missing verbal noun`);
        assert.ok(card.forms?.activeParticiple, `${lesson.id} ${card.title} missing active participle`);
      }
    }
  });

  it("links every lesson vocabulary id to a vocabulary record in the same book", () => {
    const wordsById = new Map(curriculum.vocabulary.map((word) => [word.id, word]));
    for (const lesson of curriculum.lessons) {
      for (const wordId of lesson.vocabularyIds || []) {
        const word = wordsById.get(wordId);
        assert.ok(word, `${lesson.id} missing vocabulary ${wordId}`);
        assert.equal(word.bookSlug, lesson.bookSlug, `${wordId} should belong to ${lesson.bookSlug}`);
      }
    }
  });

  it("keeps vocabulary records eligible for Arabic-English quiz modes", () => {
    for (const word of curriculum.vocabulary) {
      assert.ok(word.arabic, `${word.id} missing Arabic`);
      assert.ok(word.english, `${word.id} missing English`);
      assert.ok(word.audioKey || word.audioNote, `${word.id} missing audio metadata`);
    }
  });
});

describe("mobile app configuration", () => {
  it("keeps Capacitor pointed at the mobile shell and configured app id", () => {
    assert.equal(capacitorConfig.appId, "com.madinaharabic.app");
    assert.equal(capacitorConfig.appName, "Madinah Arabic");
    assert.equal(capacitorConfig.webDir, "mobile/www");
    assert.equal(capacitorConfig.server.cleartext, true);
  });

  it("includes fallback mobile shell assets", () => {
    assert.ok(fs.existsSync(path.join(root, "mobile", "www", "index.html")));
    assert.ok(fs.existsSync(path.join(root, "mobile", "www", "assets", "madinah-icon.svg")));
    assert.ok(fs.existsSync(path.join(root, "ios", "App", "App.xcodeproj", "project.pbxproj")));
    assert.ok(fs.existsSync(path.join(root, "android", "settings.gradle")));
  });
});
