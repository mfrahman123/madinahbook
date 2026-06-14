import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const curriculum = JSON.parse(fs.readFileSync(path.join(root, "data", "curriculum.json"), "utf8"));

const arabicMarkPattern = /[\u064B-\u0652\u0670]/;
const vowelMarks = new Set(["\u064B", "\u064C", "\u064D", "\u064E", "\u064F", "\u0650", "\u0670"]);
const sukun = "\u0652";
const errors = [];

function fail(message) {
  errors.push(message);
}

function hasConflictingMarks(text) {
  let marks = [];
  for (const char of String(text || "")) {
    if (arabicMarkPattern.test(char)) {
      marks.push(char);
      continue;
    }

    if (marks.length && markConflict(marks)) return true;
    marks = [];
  }
  return marks.length ? markConflict(marks) : false;
}

function markConflict(marks) {
  const vowelCount = marks.filter((mark) => vowelMarks.has(mark)).length;
  const hasSukun = marks.includes(sukun);
  return vowelCount > 1 || (hasSukun && vowelCount > 0) || new Set(marks).size !== marks.length;
}

function wordHasQuizOptions(word, answerKey) {
  const options = new Set(
    curriculum.vocabulary
      .filter((item) => item.id !== word.id)
      .map((item) => item[answerKey])
      .filter(Boolean)
  );
  return options.size >= 3;
}

const books = new Set(curriculum.books.map((book) => book.slug));
const lessonsByBookAndNumber = new Set(curriculum.lessons.map((lesson) => `${lesson.bookSlug}:${lesson.number}`));
const lessonIds = new Set(curriculum.lessons.map((lesson) => lesson.id));
const grammarIds = new Set(curriculum.grammar.map((rule) => rule.id));
const vocabularyIds = new Set(curriculum.vocabulary.map((word) => word.id));
const morphologyFormKeys = ["past", "present", "command", "verbalNoun", "activeParticiple", "passiveParticiple"];
const contentStatuses = new Set(["generated-review", "needs-review", "verified"]);

for (const word of curriculum.vocabulary) {
  if (!word.id) fail("Vocabulary record missing id.");
  if (!books.has(word.bookSlug)) fail(`${word.id} references unknown book ${word.bookSlug}.`);
  if (!word.arabic) fail(`${word.id} is missing Arabic.`);
  if (!word.english || /undefined/i.test(word.english)) fail(`${word.id} is missing a valid English translation.`);
  if (!word.lessonNumber) fail(`${word.id} is missing lessonNumber.`);
  if (word.lessonNumber !== "PDF" && !lessonsByBookAndNumber.has(`${word.bookSlug}:${word.lessonNumber}`)) {
    fail(`${word.id} references missing lesson ${word.bookSlug}:${word.lessonNumber}.`);
  }
  if (!word.audioKey && !word.audioNote) fail(`${word.id} is missing audio metadata.`);
  if (hasConflictingMarks(word.arabic)) fail(`${word.id} has conflicting Arabic diacritics: ${word.arabic}`);
  if (!wordHasQuizOptions(word, "english")) fail(`${word.id} is not eligible for English option quizzes.`);
  if (!wordHasQuizOptions(word, "arabic")) fail(`${word.id} is not eligible for Arabic option quizzes.`);
}

for (const lesson of curriculum.lessons) {
  if (!books.has(lesson.bookSlug)) fail(`${lesson.id} references unknown book ${lesson.bookSlug}.`);
  if (!lesson.title) fail(`${lesson.id} is missing title.`);
  if (!lesson.translation) fail(`${lesson.id} is missing translation.`);
  if (!lesson.sourceRef) fail(`${lesson.id} is missing sourceRef.`);
  if (!contentStatuses.has(lesson.contentStatus)) fail(`${lesson.id} has unsupported contentStatus ${lesson.contentStatus}.`);
  if (hasConflictingMarks(lesson.arabic)) fail(`${lesson.id} has conflicting Arabic diacritics.`);
  if (!Array.isArray(lesson.examples) || lesson.examples.length !== 3) fail(`${lesson.id} must have exactly 3 learn examples.`);
  if (!lesson.grammarExplanation) {
    fail(`${lesson.id} is missing grammarExplanation.`);
  } else {
    for (const field of ["rule", "example", "exampleTranslation", "commonMistake", "summary"]) {
      if (!lesson.grammarExplanation[field]) fail(`${lesson.id} grammarExplanation is missing ${field}.`);
    }
    if (hasConflictingMarks(lesson.grammarExplanation.example)) {
      fail(`${lesson.id} grammarExplanation has conflicting Arabic diacritics.`);
    }
  }
  for (const card of lesson.morphologyCards || []) {
    const cardId = `${lesson.id} morphology card ${card.title || "untitled"}`;
    if (!card.title) fail(`${cardId} is missing title.`);
    if (!card.meaning) fail(`${cardId} is missing meaning.`);
    if (!card.root) fail(`${cardId} is missing root.`);
    if (!card.pattern) fail(`${cardId} is missing pattern.`);
    if (!card.forms || typeof card.forms !== "object" || Array.isArray(card.forms)) {
      fail(`${cardId} is missing forms.`);
      continue;
    }
    if (!card.forms.past || !card.forms.present || !card.forms.verbalNoun || !card.forms.activeParticiple) {
      fail(`${cardId} must include at least past, present, verbalNoun and activeParticiple forms.`);
    }
    for (const field of ["title", "pattern", ...morphologyFormKeys]) {
      const value = field === "title" || field === "pattern" ? card[field] : card.forms[field];
      if (value && hasConflictingMarks(value)) fail(`${cardId} has conflicting Arabic diacritics in ${field}: ${value}`);
    }
  }
  for (const grammarId of lesson.grammarIds || []) {
    if (!grammarIds.has(grammarId)) fail(`${lesson.id} references missing grammar ${grammarId}.`);
  }
  for (const wordId of lesson.vocabularyIds || []) {
    if (!vocabularyIds.has(wordId)) fail(`${lesson.id} references missing vocabulary ${wordId}.`);
  }
}

for (const exercise of curriculum.exercises) {
  if (!lessonIds.has(exercise.lessonId)) fail(`${exercise.id} references missing lesson ${exercise.lessonId}.`);
  if (!exercise.prompt) fail(`${exercise.id} is missing prompt.`);
  if (!exercise.answer) fail(`${exercise.id} is missing answer.`);
}

if (errors.length) {
  console.error(`Content validation failed with ${errors.length} issue(s):`);
  for (const error of errors.slice(0, 80)) console.error(`- ${error}`);
  if (errors.length > 80) console.error(`- ...and ${errors.length - 80} more`);
  process.exit(1);
}

console.log(`Content validation passed for ${curriculum.books.length} books, ${curriculum.lessons.length} lessons, and ${curriculum.vocabulary.length} vocabulary records.`);
