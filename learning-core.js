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
      options
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
    createVocabTester
  };
});
