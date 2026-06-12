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
