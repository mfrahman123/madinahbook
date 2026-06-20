(function attachLearningCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }
  root.MadinahLearningCore = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function learningCoreFactory() {
  const planEntitlements = {
    free: {
      books: ["book-1"],
      lessonTabs: ["learn"],
      testerBooks: ["book-1"],
      testerFocus: ["all", "new", "learned"]
    },
    paid: {
      books: ["book-1", "book-2", "book-3"],
      lessonTabs: ["learn", "book-exercises", "quiz", "review"],
      testerBooks: ["book-1", "book-2", "book-3"],
      testerFocus: ["all", "new", "learned", "due", "mistakes"]
    }
  };

  function planKeyForUser(user) {
    return user && !user.isDemo && user.subscriptionPlan === "paid" && user.subscriptionStatus === "active" ? "paid" : "free";
  }

  function accessibleBookSlugs(user) {
    return new Set((planEntitlements[planKeyForUser(user)] || planEntitlements.free).books);
  }

  function filterBooksForUser(books, user) {
    const allowed = accessibleBookSlugs(user);
    return books.map((book) => {
      if (allowed.has(book.slug)) return { ...book };
      return { ...book, status: "locked", premiumRequired: true };
    });
  }

  function uniqueValues(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function randomItem(items, random = Math.random) {
    return items[Math.floor(random() * items.length)];
  }

  function hasArabic(value) {
    return /[\u0600-\u06FF]/.test(String(value || ""));
  }

  function answerWithArabic(answer, question = {}) {
    const value = String(answer || "");
    if (!value || hasArabic(value)) return value;
    const arabic = question.answerArabic || (question.answerKey === "english" ? question.arabic : "") || "";
    return arabic ? `${value} (${arabic})` : value;
  }

  function buildVocabularyOptions(optionPool, targetWord, answerKey, allVocabulary = [], random = Math.random) {
    const answer = targetWord[answerKey];
    const lessonOptions = optionPool
      .map((word) => word[answerKey])
      .filter(Boolean);
    const globalOptions = allVocabulary
      .filter((word) => word.id !== targetWord.id)
      .map((word) => word[answerKey])
      .filter(Boolean);
    const distractors = uniqueValues([...shuffle(lessonOptions, random), ...shuffle(globalOptions, random)])
      .filter((option) => option !== answer);
    return shuffle([answer, ...distractors.slice(0, 3)], random);
  }

  function createVocabularyQuestion({
    word,
    optionPool,
    allVocabulary,
    lessons,
    idPrefix,
    now = Date.now,
    random = Math.random
  }) {
    const modes = [
      {
        prompt: "Choose the English meaning.",
        arabic: word.arabic,
        answerKey: "english"
      },
      {
        prompt: `Choose the Arabic word for "${word.english}".`,
        display: word.english,
        answerKey: "arabic"
      }
    ];
    const mode = randomItem(modes, random);
    const options = buildVocabularyOptions(optionPool, word, mode.answerKey, allVocabulary, random);
    const lesson = lessons.find((item) => item.bookSlug === word.bookSlug && item.number === word.lessonNumber);

    return {
      id: `${idPrefix}-${word.id}-${now()}-${Math.round(random() * 100000)}`,
      wordId: word.id,
      lessonId: lesson?.id || "",
      prompt: mode.prompt,
      arabic: mode.arabic || "",
      display: mode.display || "",
      answer: word[mode.answerKey],
      answerKey: mode.answerKey,
      options,
      explanation: `${word.arabic} means ${word.english}.`
    };
  }

  function createVocabTester({
    pool,
    allVocabulary,
    lessons,
    size = 3,
    filterKey = "",
    now = Date.now,
    random = Math.random
  }) {
    const words = shuffle(pool, random).slice(0, Math.min(size, pool.length));
    const optionPool = pool.length >= 4 ? pool : allVocabulary;

    return {
      id: `vocab-tester-${now()}`,
      createdAt: new Date(now()).toISOString(),
      filterKey,
      poolSize: pool.length,
      questions: words.map((word, index) => ({
        ...createVocabularyQuestion({
          word,
          optionPool,
          allVocabulary,
          lessons,
          idPrefix: `tester-${index + 1}`,
          now,
          random
        }),
        number: index + 1
      }))
    };
  }

  function createQuizExplanation(question, selectedAnswer = "") {
    if (!question) return "";
    const answer = question.answer || "";
    const selected = selectedAnswer || "";
    const answerText = answerWithArabic(answer, question);
    const prefix = selected === answer ? "Correct." : `Not quite. Correct answer: ${answerText}.`;

    if (question.explanation) return `${prefix} ${question.explanation}`;
    if (question.arabic && question.answerKey === "english") return `${prefix} ${question.arabic} means ${answer}.`;
    if (question.display && question.answerKey === "arabic") return `${prefix} "${question.display}" is ${answer}.`;
    return prefix;
  }

  function nextReviewStats(current = {}, correct, now = Date.now) {
    const previousLevel = Number(current.level || 0);
    const level = correct ? Math.min(6, previousLevel + 1) : Math.max(0, previousLevel - 1);
    const intervals = [0, 1, 2, 4, 7, 14, 30];
    const timestamp = now();
    const dueAt = new Date(timestamp + intervals[level] * 24 * 60 * 60 * 1000).toISOString();
    const ease = Math.max(1.3, Number(current.ease || 2.2) + (correct ? 0.08 : -0.2));

    return {
      ...current,
      level,
      ease: Number(ease.toFixed(2)),
      correct: Number(current.correct || 0) + (correct ? 1 : 0),
      incorrect: Number(current.incorrect || 0) + (correct ? 0 : 1),
      reviewCount: Number(current.reviewCount || 0) + 1,
      lastReviewedAt: new Date(timestamp).toISOString(),
      dueAt
    };
  }

  function weakVocabulary(vocabulary, progress = {}, limit = 12, now = Date.now) {
    const stats = progress.vocabularyStats || {};
    const mistakes = progress.mistakes || {};
    const learned = new Set(progress.learnedVocabularyIds || []);
    const timestamp = now();

    return vocabulary
      .map((word) => {
        const record = stats[word.id] || {};
        const hasMistake = [`vocab-${word.id}`, `tester-${word.id}`].some((id) => mistakes[id] && !mistakes[id].resolved);
        const due = !record.dueAt || Date.parse(record.dueAt || 0) <= timestamp;
        const incorrect = Number(record.incorrect || 0);
        const correct = Number(record.correct || 0);
        const score = incorrect * 5 + (hasMistake ? 8 : 0) + (due ? 3 : 0) + (learned.has(word.id) ? 0 : 1) - correct;
        return { word, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || String(a.word.id).localeCompare(String(b.word.id)))
      .slice(0, limit)
      .map((item) => item.word);
  }

  function createSentenceBuilder(lesson, random = Math.random) {
    const source = String(lesson?.arabic || lesson?.examples?.[0]?.arabic || "").trim();
    const tokens = source.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return null;

    let shuffled = shuffle(tokens, random);
    if (shuffled.join(" ") === tokens.join(" ")) shuffled = [...tokens].reverse();

    return {
      id: `sentence-${lesson.id}`,
      prompt: "Rebuild the Arabic sentence in the correct order.",
      tokens: shuffled,
      answer: tokens.join(" "),
      explanation: `Correct order: ${tokens.join(" ")}`
    };
  }

  function formLabel(key) {
    return {
      past: "past form",
      present: "present form",
      command: "command form",
      verbalNoun: "verbal noun",
      activeParticiple: "active participle",
      passiveParticiple: "passive participle"
    }[key] || key;
  }

  function morphologyCue(card) {
    const meaning = String(card?.meaning || "").trim();
    const root = String(card?.root || "").trim();
    if (meaning && root) return `for "${meaning}" (root ${root})`;
    if (meaning) return `for "${meaning}"`;
    if (root) return `for root ${root}`;
    return "for this verb";
  }

  function createMorphologyDrills(lesson, random = Math.random) {
    const cards = Array.isArray(lesson?.morphologyCards) ? lesson.morphologyCards : [];
    return cards
      .map((card, cardIndex) => {
        const formEntries = Object.entries(card.forms || {}).filter(([, value]) => value);
        if (formEntries.length < 2) return null;
        const [answerKey, answer] = formEntries[cardIndex % formEntries.length];
        const options = shuffle(uniqueValues(formEntries.map(([, value]) => value)), random);
        const cue = morphologyCue(card);
        return {
          id: `morph-${lesson.id}-${cardIndex + 1}-${answerKey}`,
          cardTitle: card.title || "Verb pattern",
          prompt: `Choose the ${formLabel(answerKey)}.`,
          meaning: card.meaning || "",
          root: card.root || "",
          answer,
          answerKey,
          options,
          explanation: `${cue}: the ${formLabel(answerKey)} is ${answer}.`
        };
      })
      .filter(Boolean);
  }

  function createCumulativeTest({
    throughLesson,
    lessons,
    vocabulary,
    exercises = [],
    size = 5,
    now = Date.now,
    random = Math.random
  }) {
    if (!throughLesson) return { id: "cumulative-empty", questions: [] };
    const lessonOrder = lessons
      .filter((lesson) => lesson.bookSlug === throughLesson.bookSlug && Number(lesson.number) <= Number(throughLesson.number))
      .sort((a, b) => Number(a.number) - Number(b.number));
    const lessonIds = new Set(lessonOrder.map((lesson) => lesson.id));
    const wordIds = new Set(lessonOrder.flatMap((lesson) => lesson.vocabularyIds || []));
    const wordPool = vocabulary.filter((word) => word.bookSlug === throughLesson.bookSlug && (wordIds.has(word.id) || Number(word.lessonNumber) <= Number(throughLesson.number)));
    const optionPool = wordPool.length >= 4 ? wordPool : vocabulary;
    const vocabQuestions = shuffle(wordPool, random)
      .slice(0, Math.min(3, size, wordPool.length))
      .map((word, index) => ({
        ...createVocabularyQuestion({
          word,
          optionPool,
          allVocabulary: vocabulary,
          lessons,
          idPrefix: `cumulative-vocab-${index + 1}`,
          now,
          random
        }),
        kind: "vocabulary"
      }));
    const exerciseQuestions = shuffle(exercises.filter((exercise) => lessonIds.has(exercise.lessonId)), random)
      .slice(0, Math.max(0, size - vocabQuestions.length))
      .map((exercise, index) => ({
        id: `cumulative-exercise-${exercise.id}-${now()}-${index}`,
        kind: "exercise",
        exerciseId: exercise.id,
        lessonId: exercise.lessonId,
        prompt: exercise.prompt,
        arabic: exercise.arabic || "",
        answerArabic: exercise.arabic || "",
        answer: exercise.answer,
        answerKey: "exercise",
        options: shuffle(exercise.options || [exercise.answer], random),
        explanation: `Model answer: ${answerWithArabic(exercise.answer, { answerArabic: exercise.arabic || "" })}.`
      }));

    return {
      id: `cumulative-${throughLesson.id}-${now()}`,
      throughLessonId: throughLesson.id,
      questions: shuffle([...vocabQuestions, ...exerciseQuestions], random).slice(0, size)
    };
  }

  return {
    planEntitlements,
    planKeyForUser,
    accessibleBookSlugs,
    filterBooksForUser,
    uniqueValues,
    shuffle,
    randomItem,
    buildVocabularyOptions,
    createVocabularyQuestion,
    createVocabTester,
    createQuizExplanation,
    nextReviewStats,
    weakVocabulary,
    createSentenceBuilder,
    createMorphologyDrills,
    createCumulativeTest
  };
});
