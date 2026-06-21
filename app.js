const initialParams = new URLSearchParams(window.location.search);
const initialAuthMode = ["reset", "verify"].includes(initialParams.get("auth")) ? initialParams.get("auth") : null;

const state = {
  route: "home",
  selectedLessonId: initialParams.get("lesson") || "lesson-4",
  data: null,
  progress: null,
  search: "",
  theme: initialParams.get("theme") || localStorage.getItem("madinah-theme") || "dark",
  language: "en",
  lessonTab: initialParams.get("tab") || "learn",
  selectedExerciseId: null,
  exerciseFeedback: {},
  vocabularyQuizByLesson: {},
  vocabularyQuizFeedback: {},
  cumulativeTestByLesson: {},
  cumulativeFeedback: {},
  sentenceBuilderByLesson: {},
  sentenceBuilderSelections: {},
  sentenceBuilderFeedback: {},
  morphologyFeedback: {},
  vocabularyTab: initialParams.get("vocabTab") || "list",
  selectedVocabularyBookSlug: initialParams.get("vocabBook") || "book-1",
  vocabularyPage: 1,
  vocabTesterFilters: {
    bookSlugs: ["book-1"],
    lessonKey: "all",
    focus: ["all"]
  },
  vocabTester: null,
  vocabTesterActiveIndex: 0,
  vocabTesterFeedback: {},
  nativeDailySession: null,
  nativeDailyStepIndex: 0,
  nativeDailyFeedback: {},
  nativeAudioReview: null,
  nativeAudioFeedback: null,
  writingFeedback: {},
  checkedPracticeSelections: {},
  authMode: initialAuthMode,
  authError: "",
  authNotice: "",
  authDevToken: initialParams.get("token") || "",
  billingError: "",
  billingNotice: initialParams.get("billing") === "success"
    ? "Stripe checkout completed. Your premium access will appear as soon as Stripe confirms the subscription."
    : initialParams.get("billing") === "cancelled"
      ? "Stripe checkout was cancelled."
      : "",
  sessionToken: "",
  user: null,
  adminContent: null,
  adminLoading: false,
  adminError: "",
  adminStatus: "",
  adminTab: "vocabulary",
  adminSearch: "",
  adminImportText: "",
  adminImportStatus: "",
  adminImportError: "",
  contentReportStatus: "",
  contentReportError: "",
  audioRate: Number(localStorage.getItem("madinah-audio-rate") || 0.82),
  arabicFontScale: Number(localStorage.getItem("madinah-arabic-scale") || 1),
  reminderNotice: localStorage.getItem("madinah-reminders") || "",
  offlineNotice: "",
  mobileFilterSheetOpen: false,
  viewportMode: currentViewportMode(),
  motion: {
    view: false,
    tester: false,
    xpBurst: null,
    celebration: ""
  }
};

const iconPaths = {
  home: '<path d="m3 10 9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  book: '<path d="M12 7v14"/><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v19H7.5A3.5 3.5 0 0 0 4 17.5z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v19h4.5a3.5 3.5 0 0 1 3.5-3.5z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  words: '<path d="M5 8h8"/><path d="M7 4h1"/><path d="M10 4h1"/><path d="M9 8c-.4 3-1.9 5.2-4 6.8"/><path d="M6.5 11.5c1 1.2 2.3 2.2 3.8 3"/><path d="M14 20l3.5-8 3.5 8"/><path d="M15.2 17h4.6"/>',
  grammar: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  exercises: '<path d="M9 4h6l1 2h3v15H5V6h3z"/><path d="m9 14 2 2 4-5"/>',
  resources: '<path d="M3 7h7l2 2h9v10H3z"/><path d="M3 7v12"/>',
  progress: '<path d="M4 19V5"/><path d="M4 19h17"/><path d="M8 16v-5"/><path d="M13 16V8"/><path d="M18 16v-9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  flame: '<path d="M12 22c4 0 7-2.7 7-6.7 0-2.4-1.2-4.6-3.5-6.5.1 1.6-.4 2.9-1.5 3.7.1-3-1.4-5.3-4.2-7.5.2 3.2-.8 4.9-2.7 6.8A6.3 6.3 0 0 0 5 16c0 3.8 3 6 7 6z"/>',
  spark: '<path d="M13 2 5 14h7l-1 8 8-12h-7z"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  speaker: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9.5c.8.8 1.2 1.6 1.2 2.5s-.4 1.7-1.2 2.5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  x: '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
  retry: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M22 12h-3"/><path d="M12 22v-3"/><path d="M2 12h3"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M20 14.6A8.5 8.5 0 0 1 9.4 4 7 7 0 1 0 20 14.6z"/>',
  star: '<path d="m12 2 2.9 6 6.6.9-4.8 4.7 1.1 6.6L12 17.1l-5.8 3.1 1.1-6.6-4.8-4.7 6.6-.9z"/>',
  flag: '<path d="M5 22V4"/><path d="M5 4h11l-1 4 1 4H5"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>'
};

const routes = [
  { id: "home", label: "Home", icon: "home" },
  { id: "books", label: "Books", icon: "book" },
  { id: "vocabulary", label: "Vocabulary", icon: "words" },
  { id: "review", label: "Review", icon: "target" },
  { id: "subscription", label: "Subscription", icon: "spark" },
  { id: "admin", label: "Admin", icon: "target" },
  { id: "account", label: "Account", icon: "user" }
];

const publicRoutes = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "curriculum", label: "Curriculum" },
  { id: "subscription", label: "Pricing" }
];

const publicRouteIds = new Set(publicRoutes.map((route) => route.id));

const planEntitlements = {
  free: {
    label: "Free",
    books: ["book-1"],
    lessonTabs: ["learn"],
    testerBooks: ["book-1"],
    testerFocus: ["all", "new", "learned"],
    paidRoutes: ["book-2", "book-3", "exercises", "review", "progress"]
  },
  paid: {
    label: "Premium",
    books: ["book-1", "book-2", "book-3"],
    lessonTabs: ["learn", "book-exercises", "quiz", "review"],
    testerBooks: ["book-1", "book-2", "book-3"],
    testerFocus: ["all", "new", "learned", "due", "mistakes"],
    paidRoutes: []
  }
};

const uiText = {
  bn: {
    home: "হোম",
    "book-1": "বই ১",
    "book-2": "বই ২",
    "book-3": "বই ৩",
    vocabulary: "শব্দভান্ডার",
    grammar: "ব্যাকরণ",
    exercises: "অনুশীলন",
    review: "ভুলগুলো",
    resources: "রিসোর্স",
    progress: "অগ্রগতি",
    account: "অ্যাকাউন্ট",
    booksActive: "বই ১-৩ চালু",
    comingSoon: "শীঘ্রই আসছে",
    privateProgress: "ব্যক্তিগত অগ্রগতি",
    signIn: "সাইন ইন",
    signInTitle: "সাইন ইন",
    signInToStart: "শুরু করতে সাইন ইন করুন",
    openAccount: "অ্যাকাউন্ট খুলুন",
    unableSignIn: "সাইন ইন করা যায়নি।",
    signInLearning: "শেখা চালিয়ে যেতে সাইন ইন করুন।",
    signInLessons: "পাঠ খুলতে সাইন ইন করুন।",
    loadError: "পাঠের ডেটা লোড করতে লোকাল সার্ভার দরকার।",
    today: "আজ",
    searchPlaceholder: "পাঠ বা শব্দ খুঁজুন",
    searchAria: "পাঠ বা শব্দ খুঁজুন",
    streak: "ধারাবাহিকতা",
    totalPoints: "মোট পয়েন্ট",
    available: "উপলব্ধ",
    words: "শব্দ",
    light: "লাইট",
    dark: "ডার্ক",
    toggleTheme: "থিম বদলান",
    language: "বাংলা",
    toggleLanguage: "ভাষা বদলান",
    createAccount: "অ্যাকাউন্ট তৈরি করুন",
    createNewAccount: "নতুন অ্যাকাউন্ট তৈরি করুন",
    alreadyAccount: "আমার অ্যাকাউন্ট আছে",
    accountLabel: "অ্যাকাউন্ট",
    name: "নাম",
    email: "ইমেইল",
    password: "পাসওয়ার্ড",
    close: "বন্ধ করুন",
    landingLabel: "মদিনা আরবি বই ১-৩",
    landingTitle: "নিয়মিত পাঠ, অনুশীলন ও রিভিউ দিয়ে আরবি শিখুন।",
    landingText: "মদিনা আরবি বই ১, ২ ও ৩-এর জন্য সাজানো পাঠ, শব্দভান্ডার রিভিউ, পরীক্ষিত অনুশীলন, লেখা, কুইজ ও অগ্রগতি ট্র্যাকিং।",
    continueLearning: "পড়া চালিয়ে যান",
    checkedPractice: "যাচাই করা অনুশীলন",
    mistakeReview: "ভুল রিভিউ",
    vocabTester: "শব্দ টেস্টার",
    guidedPath: "গাইডেড পথ",
    guidedPathText: "প্রতিটি পাঠে শেখা, অনুশীলন, কুইজ ও রিভিউ।",
    spacedVocabulary: "পরিকল্পিত শব্দ রিভিউ",
    spacedVocabularyText: "অগ্রগতির ভিত্তিতে ঠিক সময়ে শব্দগুলো রিভিউ করুন।",
    writingPractice: "লেখার অনুশীলন",
    writingPracticeText: "উত্তর লিখুন, যাচাই করুন, আর ভুলগুলো রিভিউতে পাঠান।",
    fullVocabTester: "সম্পূর্ণ শব্দ টেস্টার",
    fullVocabTesterText: "পুরো শব্দভান্ডার থেকে নতুন আরবি-বাংলা টেস্ট তৈরি করুন।",
    privateWorkspace: "ব্যক্তিগত শেখার জায়গা",
    signInContinue: "চালিয়ে যেতে সাইন ইন করুন",
    signInGateText: "লগইন করার পর আপনার পাঠ, কুইজ, শব্দ রিভিউ ও অগ্রগতি দেখা যাবে।",
    lesson: "পাঠ",
    lessons: "পাঠ",
    sections: "অংশ",
    section: "অংশ",
    continue: "চালিয়ে যান",
    quickAccess: "দ্রুত প্রবেশ",
    rules: "নিয়ম",
    drills: "ড্রিল",
    mistakes: "ভুল",
    items: "আইটেম",
    learn: "শিখুন",
    practice: "অনুশীলন",
    quiz: "কুইজ",
    examples: "উদাহরণ",
    lessonPattern: "পাঠের ধরন",
    total: "মোট",
    foundation: "ভিত্তি",
    build: "গঠন",
    challenge: "চ্যালেঞ্জ",
    bookModel: "বইয়ের উদাহরণ",
    practiceModel: "অনুশীলন উদাহরণ",
    lessonNotes: "পাঠ নোট",
    exercisesFromKey: "বইয়ের অনুশীলন",
    bookExercises: "বইয়ের অনুশীলন",
    practiceTask: "অনুশীলনের কাজ",
    exampleQuestions: "উদাহরণ প্রশ্ন",
    checkedPractice: "যাচাই করা অনুশীলন",
    yourAnswer: "আপনার উত্তর",
    checkAnswer: "উত্তর যাচাই করুন",
    viewAnswer: "উত্তর দেখুন",
    revealAnswer: "উত্তর দেখুন",
    viewExplanation: "ব্যাখ্যা দেখুন",
    modelAnswer: "মডেল উত্তর",
    correct: "সঠিক",
    retry: "আবার চেষ্টা",
    notQuite: "পুরোপুরি নয়। সঠিক উত্তর:",
    notQuiteShort: "পুরোপুরি নয়।",
    correctSaved: "সঠিক। শব্দটি অগ্রগতিতে সংরক্ষিত হয়েছে।",
    done: "সম্পন্ন",
    markPracticeDone: "অনুশীলন সম্পন্ন করুন",
    correctAnswer: "সঠিক উত্তর",
    playAudio: "অডিও চালান",
    markComplete: "সম্পন্ন করুন",
    reviewComplete: "রিভিউ সম্পন্ন",
    book: "বই",
    wordList: "শব্দ তালিকা",
    arabic: "আরবি",
    transliteration: "উচ্চারণ",
    english: "অর্থ",
    meaning: "অর্থ",
    typeArabicSentence: "সম্পূর্ণ আরবি বাক্য লিখুন",
    audio: "অডিও",
    viewAll: "সব দেখুন",
    availableBooks: "উপলব্ধ বই",
    selectedWords: "নির্বাচিত শব্দ",
    correctCount: "সঠিক",
    generateNew: "নতুন তৈরি করুন",
    generateNewTest: "নতুন টেস্ট তৈরি করুন",
    books: "বই",
    days: "দিন",
    soon: "শীঘ্রই",
    allSelectedSections: "নির্বাচিত সব অংশ",
    focus: "ফোকাস",
    anyProgress: "যেকোনো অগ্রগতি",
    new: "নতুন",
    learned: "শেখা হয়েছে",
    due: "বাকি",
    noVocabularyMatches: "এই নির্বাচনের সঙ্গে কোনো শব্দ মেলেনি।",
    answered: "উত্তর দেওয়া হয়েছে",
    spacedRepetition: "পরিকল্পিত রিভিউ",
    wordsDue: "শব্দ বাকি",
    noDueWords: "এখন কোনো শব্দ বাকি নেই।",
    reviewQueue: "রিভিউ সারি",
    openVocabulary: "শব্দভান্ডার খুলুন",
    noMistakes: "এখন রিভিউ করার মতো ভুল নেই।",
    openReviewPage: "রিভিউ পেজ খুলুন",
    resourcesTitle: "রিসোর্স",
    open: "খুলুন",
    learningOverview: "শেখার সারাংশ",
    learningGoals: "শেখার লক্ষ্য",
    completedLessons: "সম্পন্ন পাঠ",
    vocabularyLearned: "শেখা শব্দ",
    lessonsCompleted: "সম্পন্ন পাঠ",
    profileDetails: "প্রোফাইল তথ্য",
    signedInAs: "লগইন করা হয়েছে",
    viewProgress: "অগ্রগতি দেখুন",
    signOut: "সাইন আউট",
    currentBook: "বর্তমান বই",
    currentLesson: "বর্তমান পাঠ",
    xpPoints: "XP পয়েন্ট",
    dailyStreak: "দৈনিক ধারাবাহিকতা",
    weeklyGoal: "সাপ্তাহিক লক্ষ্য",
    accountData: "অ্যাকাউন্ট ডেটা",
    privateAccountData: "এই লগইনের জন্য শেখার অগ্রগতি ব্যক্তিগত",
    privateAccountDataText: "সম্পন্ন পাঠ, শব্দ রিভিউ, লেখার চেষ্টা, ভুল, ধারাবাহিকতা ও XP এই অ্যাকাউন্টে সংরক্ষিত।",
    userId: "ইউজার আইডি",
    storage: "স্টোরেজ",
    savedAccount: "আপনার অ্যাকাউন্টে সংরক্ষিত",
    keepHabit: "অভ্যাসটি ধরে রাখুন",
    openMistakes: "খোলা ভুল",
    thisWeek: "এই সপ্তাহ",
    lessonPath: "পাঠের পথ",
    mastery: "দক্ষতা",
    inProgress: "চলমান",
    completed: "সম্পন্ন",
    bookProgress: "অগ্রগতি",
    primaryNavigation: "প্রধান নেভিগেশন",
    openNavigation: "নেভিগেশন খুলুন",
    openAccountDetails: "অ্যাকাউন্টের তথ্য খুলুন",
    accountDetails: "অ্যাকাউন্টের তথ্য",
    coursePreview: "কোর্স প্রিভিউ",
    quickAccess: "দ্রুত প্রবেশ",
    guidedLessonPath: "গাইডেড পাঠের পথ",
    lessonSections: "পাঠের অংশ",
    vocabularySections: "শব্দভান্ডারের অংশ",
    vocabularyBooks: "শব্দভান্ডারের বই",
    vocabularyBank: "শব্দভান্ডার ব্যাংক",
    supplemental: "অতিরিক্ত",
    arabicCourseFocus: "এই পাঠে আরবি বাক্য, শব্দ ও ব্যাকরণ ধাপে ধাপে অনুশীলন করা হবে।",
    grammarSummary: "এই পাঠের মূল ব্যাকরণ ধারণা আরবি উদাহরণের মাধ্যমে অনুশীলন করুন।",
    thisBookUnavailable: "এই বইটি এখনো উপলব্ধ নয়।",
    searchSignIn: "কোর্সে খুঁজতে সাইন ইন করুন।",
    noWordsDue: "এখন কোনো শব্দ রিভিউ বাকি নেই।",
    noVocabularyDue: "এখন কোনো শব্দভান্ডার রিভিউ বাকি নেই।",
    bookOneSummary: "বই ১-এর সম্পূর্ণ পাঠ, পরিষ্কার আরবি উদাহরণ ও শব্দভান্ডার।",
    bookTwoSummary: "বই ২-এ ৩১টি পাঠ, সাজানো শব্দভান্ডার, পাঠ কুইজ ও বইয়ের অনুশীলন আছে।",
    bookThreeSummary: "বই ৩-এ ৩৪টি পাঠ, বইয়ের অনুশীলন ও সাজানো শব্দভান্ডার আছে।"
    ,
    freePlan: "ফ্রি",
    premiumPlan: "প্রিমিয়াম",
    currentPlan: "বর্তমান প্ল্যান",
    subscriptionStatus: "সাবস্ক্রিপশন অবস্থা",
    active: "চালু",
    upgradeRequired: "প্রিমিয়াম দরকার",
    upgradeToPremium: "প্রিমিয়ামে আপগ্রেড করুন",
    premiumUnlocks: "প্রিমিয়ামে আনলক হবে",
    viewPlan: "প্ল্যান দেখুন",
    continueBookOne: "বই ১ চালিয়ে যান",
    premiumFeature: "প্রিমিয়াম ফিচার",
    included: "অন্তর্ভুক্ত",
    lockedPremium: "প্রিমিয়াম",
    freePlanText: "বই ১-এর শেখা, শব্দ তালিকা, অডিও এবং বেসিক ৩-প্রশ্নের শব্দ টেস্ট।",
    premiumPlanText: "বই ২-৩, সব অনুশীলন, পাঠ কুইজ, ভুল রিভিউ, spaced review, উন্নত অগ্রগতি এবং সম্পূর্ণ শব্দ টেস্টার।",
    paidBookText: "এই বইটি প্রিমিয়াম প্ল্যানে আছে। বই ১ ফ্রিতে চালিয়ে যেতে পারবেন।",
    paidLessonTabText: "এই পাঠের অনুশীলন, কুইজ ও রিভিউ প্রিমিয়ামে আনলক হবে।",
    paidProgressText: "সম্পূর্ণ অগ্রগতি, ভুল রিভিউ ও spaced repetition প্রিমিয়াম প্ল্যানে আছে।",
    paidTesterText: "বই ২-৩, due words, mistake filters এবং সম্পূর্ণ শব্দ টেস্টার প্রিমিয়ামে আনলক হবে।",
    basicTester: "বেসিক টেস্টার",
    allBooks: "সব বই",
    allBooksText: "বই ১, বই ২, বই ৩",
    allExercises: "সব অনুশীলন",
    allExercisesText: "ভাঁজ করা অনুশীলন, লেখা যাচাই, কুইজ",
    advancedReview: "উন্নত রিভিউ",
    advancedReviewText: "ভুল, বাকি শব্দ, পরিকল্পিত রিভিউ",
    paymentLater: "পেমেন্ট চেকআউট পরে যুক্ত করা যাবে।"
  }
};

const bengaliMeanings = {
  "what is this? this is a book.": "এটা কী? এটা একটি বই।",
  "this is a pen.": "এটা একটি কলম।",
  "is this a house? yes, this is a house.": "এটা কি একটি বাড়ি? হ্যাঁ, এটা একটি বাড়ি।",
  "this is a book.": "এটা একটি বই।",
  "the book is on the desk.": "বইটি ডেস্কের উপর আছে।",
  "where is the teacher's book?": "শিক্ষকের বই কোথায়?",
  "the teacher entered the classroom.": "শিক্ষক শ্রেণিকক্ষে প্রবেশ করলেন।",
  "bilal went to the mosque.": "বিলাল মসজিদে গেল।",
  "indeed, the house is new.": "নিশ্চয়ই বাড়িটি নতুন।",
  "i will not go tomorrow.": "আমি আগামীকাল যাব না।",
  "lesson quiz": "পাঠ কুইজ",
  "vocabulary": "শব্দভান্ডার",
  "vocabulary quiz": "শব্দভান্ডার কুইজ",
  "vocab tester": "শব্দ টেস্টার",
  "random vocabulary quiz": "র‌্যান্ডম শব্দভান্ডার কুইজ",
  "writing practice": "লেখার অনুশীলন",
  "resources": "রিসোর্স",
  "practice set": "অনুশীলন সেট",
  "progress tool": "অগ্রগতি টুল",
  "review tool": "রিভিউ টুল",
  "answer questions": "প্রশ্নের উত্তর",
  "fill the blanks": "শূন্যস্থান পূরণ",
  "transform the sentence": "বাক্য রূপান্তর",
  "plural practice": "বহুবচন অনুশীলন",
  "correction drill": "সংশোধন অনুশীলন",
  "counting drill": "গণনা অনুশীলন",
  "matching drill": "মেলানো অনুশীলন",
  "read and write": "পড়ুন ও লিখুন",
  "book practice": "বইয়ের অনুশীলন",
  "practice": "অনুশীলন",
  "review this item.": "এই বিষয়টি রিভিউ করুন।",
  "blank": "খালি",
  "lesson mistakes": "পাঠের ভুল",
  "mistakes and due vocabulary": "ভুল ও বাকি শব্দভান্ডার",
  "complete book 1 curriculum extracted from the attached english key, with cleaned arabic examples and vocabulary.": "বই ১-এর সম্পূর্ণ পাঠ, পরিষ্কার আরবি উদাহরণ ও শব্দভান্ডার।",
  "book 2 is now available with 31 lessons, curated vocabulary from the attached vocabulary pdf, lesson quizzes, and exercise prompts from the english key.": "বই ২-এ ৩১টি পাঠ, সাজানো শব্দভান্ডার, পাঠ কুইজ ও বইয়ের অনুশীলন আছে।",
  "book 3 is now available with 34 lessons, ocr-backed exercise prompts from the english key, and curated vocabulary from the attached vocabulary pdf.": "বই ৩-এ ৩৪টি পাঠ, বইয়ের অনুশীলন ও সাজানো শব্দভান্ডার আছে।",
  "book 1 lesson path": "বই ১ পাঠের পথ",
  "book 2 lesson path": "বই ২ পাঠের পথ",
  "book 3 lesson path": "বই ৩ পাঠের পথ",
  "all lesson readers, quizzes, and collapsible exercise sections for the available books.": "উপলব্ধ বইগুলোর সব পাঠ, কুইজ ও ভাঁজ করা অনুশীলন অংশ।",
  "expanded vocabulary table with arabic, transliteration, english, lesson number, and audio playback.": "আরবি, উচ্চারণ, অর্থ, পাঠ নম্বর ও অডিওসহ বিস্তৃত শব্দ তালিকা।",
  "interactive lesson and vocabulary quizzes for every available lesson.": "প্রতিটি উপলব্ধ পাঠের জন্য ইন্টারঅ্যাক্টিভ পাঠ ও শব্দ কুইজ।",
  "account progress": "অ্যাকাউন্ট অগ্রগতি",
  "private streak, xp, completed lessons, learned words, and mistake review.": "ব্যক্তিগত ধারাবাহিকতা, XP, সম্পন্ন পাঠ, শেখা শব্দ ও ভুল রিভিউ।",
  "audio practice": "অডিও অনুশীলন",
  "tap any arabic sentence or vocabulary item to hear pronunciation using the browser voice.": "ব্রাউজারের কণ্ঠ দিয়ে উচ্চারণ শুনতে যেকোনো আরবি বাক্য বা শব্দে চাপুন।",
  "checked writing practice": "যাচাই করা লেখার অনুশীলন",
  "write answers for book exercises, check them instantly, and save mistakes for review.": "বইয়ের অনুশীলনে উত্তর লিখুন, সঙ্গে সঙ্গে যাচাই করুন, আর ভুলগুলো রিভিউয়ের জন্য সংরক্ষণ করুন।",
  "based on lesson completion, checked exercises, writing practice, quizzes, and vocabulary review.": "পাঠ সম্পন্ন করা, যাচাই করা অনুশীলন, লেখার অনুশীলন, কুইজ ও শব্দভান্ডার রিভিউয়ের উপর ভিত্তি করে।",
  "no lesson quiz has been added for this lesson yet.": "এই পাঠে এখনো কোনো কুইজ যোগ করা হয়নি।",
  "no vocabulary is available for this lesson yet.": "এই পাঠের জন্য এখনো কোনো শব্দভান্ডার নেই।",
  "no ocr exercise prompts were found for this lesson.": "এই পাঠের জন্য বই থেকে কোনো অনুশীলন পাওয়া যায়নি।",
  "this book is not available yet.": "এই বইটি এখনো উপলব্ধ নয়।",
  "read this aloud, then write it from memory.": "এটি জোরে পড়ুন, তারপর মুখস্থ থেকে লিখুন।",
  "compare your writing with the model sentence.": "আপনার লেখা নমুনা বাক্যের সঙ্গে মিলিয়ে দেখুন।",
  "match this arabic word to its english meaning.": "এই আরবি শব্দটির বাংলা অর্থের সঙ্গে মিল করুন।",
  "use this word in the requested number pattern.": "চাওয়া সংখ্যা-প্যাটার্নে এই শব্দটি ব্যবহার করুন।",
  "translate this sentence into english.": "এই বাক্যটির বাংলা অর্থ লিখুন।",
  "what does this word mean?": "এই শব্দের অর্থ কী?",
  "fill the blank, then read the full sentence.": "শূন্যস্থান পূরণ করুন, তারপর পুরো বাক্য পড়ুন।",
  "fill the blank using the lesson sentence pattern.": "পাঠের বাক্য-প্যাটার্ন ব্যবহার করে শূন্যস্থান পূরণ করুন।",
  "type the arabic model sentence from memory.": "মুখস্থ থেকে আরবি নমুনা বাক্যটি লিখুন।",
  "answer using the lesson pattern:": "পাঠের ধরন ব্যবহার করে উত্তর দিন:",
  "use the lesson example and vocabulary to complete this book exercise.": "পাঠের উদাহরণ ও শব্দভান্ডার ব্যবহার করে এই বইয়ের অনুশীলন সম্পন্ন করুন।",
  "read and copy the lesson examples with the correct endings.": "সঠিক শেষ-চিহ্নসহ পাঠের উদাহরণগুলো পড়ুন ও কপি করুন।",
  "answer short questions using the lesson pattern.": "পাঠের ধরন ব্যবহার করে ছোট প্রশ্নের উত্তর দিন।",
  "fill in blanks with suitable words from this lesson.": "এই পাঠের উপযুক্ত শব্দ দিয়ে শূন্যস্থান পূরণ করুন।",
  "translate between arabic and english using the lesson vocabulary.": "পাঠের শব্দভান্ডার ব্যবহার করে আরবি ও বাংলার মধ্যে অর্থ অনুশীলন করুন।",
  "book": "বই",
  "house": "বাড়ি",
  "mosque": "মসজিদ",
  "door": "দরজা",
  "pen": "কলম",
  "key": "চাবি",
  "star": "তারা",
  "boy": "ছেলে",
  "man": "পুরুষ",
  "merchant": "ব্যবসায়ী",
  "dog": "কুকুর",
  "cat": "বিড়াল",
  "donkey": "গাধা",
  "horse": "ঘোড়া",
  "camel": "উট",
  "rooster": "মোরগ",
  "chair": "চেয়ার",
  "stone": "পাথর",
  "sugar": "চিনি",
  "milk": "দুধ",
  "open": "খোলা",
  "broken": "ভাঙা",
  "rich": "ধনী",
  "poor": "গরিব",
  "tall": "লম্বা",
  "short": "খাটো",
  "cold": "ঠান্ডা",
  "hot": "গরম",
  "sitting": "বসা",
  "standing": "দাঁড়ানো",
  "old": "পুরোনো",
  "far": "দূর",
  "dirty": "নোংরা",
  "big": "বড়",
  "heavy": "ভারী",
  "water": "পানি",
  "beautiful": "সুন্দর",
  "sweet": "মিষ্টি",
  "sick": "অসুস্থ",
  "room": "ঘর",
  "bathroom": "গোসলখানা",
  "kitchen": "রান্নাঘর",
  "classroom": "শ্রেণিকক্ষ",
  "bed": "বিছানা",
  "teacher": "শিক্ষক",
  "female teacher": "শিক্ষিকা",
  "student": "ছাত্র",
  "name": "নাম",
  "son": "ছেলে",
  "daughter": "মেয়ে",
  "street": "রাস্তা",
  "car": "গাড়ি",
  "bag": "ব্যাগ",
  "doctor": "ডাক্তার",
  "paternal uncle": "চাচা",
  "maternal uncle": "মামা",
  "girl / daughter": "মেয়ে / কন্যা",
  "brother": "ভাই",
  "sister": "বোন",
  "hand": "হাত",
  "leg": "পা",
  "head": "মাথা",
  "nose": "নাক",
  "eye": "চোখ",
  "ear": "কান",
  "face": "মুখ",
  "iron": "লোহা",
  "cow": "গরু",
  "window": "জানালা",
  "fast": "দ্রুত",
  "egg": "ডিম",
  "knife": "ছুরি",
  "closed": "বন্ধ",
  "after": "পরে",
  "before": "আগে",
  "never (future)": "কখনো না (ভবিষ্যৎ)",
  "never (past)": "কখনো না (অতীত)",
  "to change": "পরিবর্তন হওয়া",
  "to appear": "প্রকাশ পাওয়া",
  "to distinguish": "পার্থক্য করা",
  "to omit": "বাদ দেওয়া",
  "to contact / be attached": "যোগাযোগ করা / যুক্ত থাকা",
  "to remain / stay": "থাকা / স্থির থাকা",
  "meaning": "অর্থ",
  "state / circumstance": "অবস্থা / পরিস্থিতি",
  "except": "ব্যতীত",
  "relative / closer": "নিকটাত্মীয় / আরও নিকট",
  "viper": "সাপ",
  "heat": "তাপ",
  "wounded person": "আহত ব্যক্তি",
  "to rise": "উঠা",
  "to set": "অস্ত যাওয়া",
  "to pronounce / speak": "উচ্চারণ করা / কথা বলা",
  "to accept": "গ্রহণ করা",
  "to establish": "প্রতিষ্ঠা করা",
  "to carry": "বহন করা",
  "to wish / want": "ইচ্ছা করা / চাওয়া",
  "to explain": "ব্যাখ্যা করা"
};

const bengaliVocabularyMeanings = {
  "this": "এটি",
  "that": "ওটি",
  "these": "এগুলো",
  "those": "ওগুলো",
  "what": "কী",
  "who": "কে",
  "where": "কোথায়",
  "when": "কখন",
  "why": "কেন",
  "how": "কীভাবে",
  "which": "কোন",
  "whose": "কার",
  "yes": "হ্যাঁ",
  "no": "না",
  "not": "না",
  "never": "কখনো না",
  "and": "এবং",
  "or": "অথবা",
  "but": "কিন্তু",
  "because": "কারণ",
  "if": "যদি",
  "in": "ভিতরে",
  "on": "উপর",
  "to": "দিকে",
  "from": "থেকে",
  "with": "সঙ্গে",
  "for": "জন্য",
  "before": "আগে",
  "after": "পরে",
  "behind": "পিছনে",
  "between": "মাঝে",
  "under": "নিচে",
  "there": "সেখানে",
  "here": "এখানে",
  "now": "এখন",
  "today": "আজ",
  "tomorrow": "আগামীকাল",
  "yesterday": "গতকাল",
  "always": "সবসময়",
  "sometimes": "কখনো কখনো",
  "only": "শুধু",
  "also": "এছাড়াও",
  "very": "খুব",
  "all": "সব",
  "some": "কিছু",
  "one": "এক",
  "two": "দুই",
  "three": "তিন",
  "four": "চার",
  "five": "পাঁচ",
  "six": "ছয়",
  "seven": "সাত",
  "eight": "আট",
  "nine": "নয়",
  "ten": "দশ",
  "twenty": "বিশ",
  "hundred": "শত",
  "thousand": "হাজার",
  "half": "অর্ধেক",
  "third": "তৃতীয়",
  "book": "বই",
  "books": "বইগুলো",
  "lesson": "পাঠ",
  "lessons": "পাঠগুলো",
  "word": "শব্দ",
  "words": "শব্দগুলো",
  "sentence": "বাক্য",
  "question": "প্রশ্ন",
  "answer": "উত্তর",
  "meaning": "অর্থ",
  "language": "ভাষা",
  "arabic": "আরবি",
  "english": "ইংরেজি",
  "grammar": "ব্যাকরণ",
  "noun": "বিশেষ্য",
  "verb": "ক্রিয়া",
  "particle": "অব্যয়",
  "pronoun": "সর্বনাম",
  "adjective": "বিশেষণ",
  "subject": "কর্তা",
  "object": "কর্ম",
  "past tense": "অতীত কাল",
  "present/future tense": "বর্তমান/ভবিষ্যৎ কাল",
  "present/future verb": "বর্তমান/ভবিষ্যৎ ক্রিয়া",
  "imperative": "আদেশরূপ",
  "verbal noun": "ক্রিয়াবাচক বিশেষ্য",
  "nominal sentence": "নামবাচক বাক্য",
  "verbal sentence": "ক্রিয়াবাচক বাক্য",
  "accusative": "নসব অবস্থা",
  "genitive": "জার অবস্থা",
  "nominative": "রফ অবস্থা",
  "jussive": "জযম অবস্থা",
  "subjunctive": "নসব অবস্থা",
  "diptote": "গায়র মুনসরিফ",
  "proper noun": "ব্যক্তিনাম",
  "definite": "নির্দিষ্ট",
  "indefinite": "অনির্দিষ্ট",
  "singular": "একবচন",
  "plural": "বহুবচন",
  "dual": "দ্বিবচন",
  "masculine": "পুংলিঙ্গ",
  "feminine": "স্ত্রীলিঙ্গ",
  "rule": "নিয়ম",
  "form": "রূপ",
  "pattern": "ওজন",
  "condition": "শর্ত",
  "exception": "ব্যতিক্রম",
  "emphasis": "জোর",
  "negative": "নেতিবাচক",
  "affirmative": "ইতিবাচক",
  "transitive": "সকর্মক",
  "intransitive": "অকর্মক",
  "house": "বাড়ি",
  "mosque": "মসজিদ",
  "door": "দরজা",
  "pen": "কলম",
  "key": "চাবি",
  "star": "তারা",
  "boy": "ছেলে",
  "girl": "মেয়ে",
  "man": "পুরুষ",
  "woman": "নারী",
  "father": "পিতা",
  "mother": "মাতা",
  "son": "ছেলে",
  "daughter": "মেয়ে",
  "brother": "ভাই",
  "sister": "বোন",
  "teacher": "শিক্ষক",
  "student": "ছাত্র",
  "pupil": "শিক্ষার্থী",
  "doctor": "ডাক্তার",
  "engineer": "ইঞ্জিনিয়ার",
  "merchant": "ব্যবসায়ী",
  "minister": "মন্ত্রী",
  "president": "সভাপতি",
  "kingdom": "রাজ্য",
  "city": "শহর",
  "country": "দেশ",
  "village": "গ্রাম",
  "street": "রাস্তা",
  "road": "রাস্তা",
  "market": "বাজার",
  "school": "স্কুল",
  "university": "বিশ্ববিদ্যালয়",
  "library": "লাইব্রেরি",
  "classroom": "শ্রেণিকক্ষ",
  "room": "ঘর",
  "bathroom": "গোসলখানা",
  "kitchen": "রান্নাঘর",
  "office": "অফিস",
  "hospital": "হাসপাতাল",
  "clinic": "ক্লিনিক",
  "airport": "বিমানবন্দর",
  "station": "স্টেশন",
  "restaurant": "রেস্তোরাঁ",
  "shop": "দোকান",
  "garden": "বাগান",
  "sea": "সমুদ্র",
  "river": "নদী",
  "mountain": "পাহাড়",
  "sky": "আকাশ",
  "weather": "আবহাওয়া",
  "water": "পানি",
  "milk": "দুধ",
  "tea": "চা",
  "coffee": "কফি",
  "juice": "রস",
  "food": "খাবার",
  "fruit": "ফল",
  "apple": "আপেল",
  "banana": "কলা",
  "grapes": "আঙুর",
  "dates": "খেজুর",
  "egg": "ডিম",
  "sugar": "চিনি",
  "bread": "রুটি",
  "lentils": "মসুর",
  "wheat": "গম",
  "car": "গাড়ি",
  "bus": "বাস",
  "train": "ট্রেন",
  "airplane": "বিমান",
  "taxi": "ট্যাক্সি",
  "truck": "ট্রাক",
  "ticket": "টিকিট",
  "passport": "পাসপোর্ট",
  "dog": "কুকুর",
  "cat": "বিড়াল",
  "donkey": "গাধা",
  "horse": "ঘোড়া",
  "camel": "উট",
  "bird": "পাখি",
  "duck": "হাঁস",
  "cow": "গরু",
  "rooster": "মোরগ",
  "hen": "মুরগি",
  "tiger": "বাঘ",
  "wolf": "নেকড়ে",
  "scorpion": "বিচ্ছু",
  "viper": "সাপ",
  "hand": "হাত",
  "leg": "পা",
  "head": "মাথা",
  "face": "মুখ",
  "eye": "চোখ",
  "ear": "কান",
  "nose": "নাক",
  "mouth": "মুখ",
  "tooth": "দাঁত",
  "tongue": "জিহ্বা",
  "shoulder": "কাঁধ",
  "right hand": "ডান হাত",
  "left hand": "বাম হাত",
  "chair": "চেয়ার",
  "bed": "বিছানা",
  "desk": "ডেস্ক",
  "table": "টেবিল",
  "board": "বোর্ড",
  "bag": "ব্যাগ",
  "paper": "কাগজ",
  "notebook": "খাতা",
  "pencil": "পেন্সিল",
  "chalk": "চক",
  "ink": "কালি",
  "envelope": "খাম",
  "letter": "চিঠি",
  "magazine": "পত্রিকা",
  "dictionary": "অভিধান",
  "map": "মানচিত্র",
  "telephone": "টেলিফোন",
  "umbrella": "ছাতা",
  "knife": "ছুরি",
  "spoon": "চামচ",
  "cup": "কাপ",
  "glass": "গ্লাস",
  "fridge": "ফ্রিজ",
  "mirror": "আয়না",
  "comb": "চিরুনি",
  "soap": "সাবান",
  "clothes": "কাপড়",
  "shirt": "শার্ট",
  "shoe": "জুতা",
  "sandal": "স্যান্ডেল",
  "beautiful": "সুন্দর",
  "good": "ভালো",
  "new": "নতুন",
  "old": "পুরোনো",
  "big": "বড়",
  "small": "ছোট",
  "tall": "লম্বা",
  "short": "খাটো",
  "long": "লম্বা",
  "hot": "গরম",
  "cold": "ঠান্ডা",
  "sweet": "মিষ্টি",
  "easy": "সহজ",
  "difficult": "কঠিন",
  "rich": "ধনী",
  "poor": "গরিব",
  "clean": "পরিষ্কার",
  "dirty": "নোংরা",
  "open": "খোলা",
  "closed": "বন্ধ",
  "broken": "ভাঙা",
  "heavy": "ভারী",
  "light": "হালকা",
  "near": "কাছে",
  "far": "দূরে",
  "fast": "দ্রুত",
  "slowly": "ধীরে",
  "happy": "খুশি",
  "angry": "রাগান্বিত",
  "hungry": "ক্ষুধার্ত",
  "thirsty": "তৃষ্ণার্ত",
  "sick": "অসুস্থ",
  "tired": "ক্লান্ত",
  "ready": "প্রস্তুত",
  "busy": "ব্যস্ত",
  "famous": "বিখ্যাত",
  "important": "গুরুত্বপূর্ণ",
  "suitable": "উপযুক্ত",
  "useful": "উপকারী",
  "white": "সাদা",
  "black": "কালো",
  "red": "লাল",
  "green": "সবুজ",
  "blue": "নীল",
  "yellow": "হলুদ",
  "I": "আমি",
  "i": "আমি",
  "we": "আমরা",
  "you": "তুমি",
  "he": "সে",
  "she": "সে",
  "they": "তারা",
  "my": "আমার",
  "your": "তোমার",
  "his": "তার",
  "her": "তার",
  "our": "আমাদের",
  "their": "তাদের",
  "Allah": "আল্লাহ",
  "Prophet": "নবী",
  "prophet": "নবী",
  "Muslim": "মুসলিম",
  "Muslims": "মুসলিমরা",
  "Qur'an": "কুরআন",
  "Ka'bah": "কাবা",
  "adhan": "আযান",
  "imam": "ইমাম",
  "prayer": "নামাজ",
  "religion": "ধর্ম",
  "faith": "ঈমান",
  "piety": "তাকওয়া",
  "Hajj": "হজ",
  "Umrah": "উমরা",
  "Musa": "মূসা",
  "Ahmad": "আহমদ",
  "Maryam": "মারইয়াম",
  "Fatimah": "ফাতিমা",
  "Umar": "উমর",
  "Bilal": "বিলাল",
  "Aminah": "আমিনা",
  "Madinah": "মদিনা",
  "Makkah": "মক্কা",
  "Baghdad": "বাগদাদ",
  "Egypt": "মিশর",
  "India": "ভারত",
  "Indonesia": "ইন্দোনেশিয়া",
  "Japan": "জাপান",
  "Germany": "জার্মানি",
  "England": "ইংল্যান্ড",
  "America": "আমেরিকা",
  "Europe": "ইউরোপ",
  "Asia": "এশিয়া",
  "Cairo": "কায়রো",
  "Kuwait": "কুয়েত",
  "Jeddah": "জেদ্দা",
  "Iraq": "ইরাক",
  "Washington": "ওয়াশিংটন"
};

const bengaliVerbMeanings = {
  "go": "যাওয়া",
  "went": "গিয়েছিল",
  "come": "আসা",
  "came": "এসেছিল",
  "enter": "প্রবেশ করা",
  "entered": "প্রবেশ করেছিল",
  "open": "খোলা",
  "opened": "খুলেছিল",
  "write": "লেখা",
  "writes": "লেখে",
  "wrote": "লিখেছিল",
  "study": "পড়া",
  "studies": "পড়ে",
  "learn": "শেখা",
  "learned": "শিখেছিল",
  "teach": "শেখানো",
  "taught": "শেখিয়েছিল",
  "love": "ভালোবাসা",
  "want": "চাওয়া",
  "wanted": "চেয়েছিল",
  "say": "বলা",
  "said": "বলেছিল",
  "see": "দেখা",
  "saw": "দেখেছিল",
  "understand": "বোঝা",
  "understood": "বুঝেছিল",
  "ask": "জিজ্ঞেস করা",
  "asked": "জিজ্ঞেস করেছিল",
  "drink": "পান করা",
  "drank": "পান করেছিল",
  "eat": "খাওয়া",
  "sit": "বসা",
  "sat": "বসেছিল",
  "stand": "দাঁড়ানো",
  "sleep": "ঘুমানো",
  "read": "পড়া",
  "bring": "নিয়ে আসা",
  "take": "নেওয়া",
  "give": "দেওয়া",
  "return": "ফিরে আসা",
  "returned": "ফিরে এসেছিল",
  "memorize": "মুখস্থ করা",
  "permit": "অনুমতি দেওয়া",
  "perform": "আদায় করা",
  "accept": "গ্রহণ করা",
  "explain": "ব্যাখ্যা করা",
  "appear": "প্রকাশ পাওয়া",
  "remain": "থাকা",
  "rise": "উঠা",
  "set": "অস্ত যাওয়া",
  "speak": "কথা বলা",
  "carry": "বহন করা",
  "wish": "ইচ্ছা করা",
  "visit": "সাক্ষাৎ করা",
  "wait": "অপেক্ষা করা",
  "reply": "উত্তর দেওয়া",
  "sell": "বিক্রি করা",
  "buy": "কেনা",
  "call": "ডাকা",
  "invite": "আমন্ত্রণ করা",
  "guide": "পথ দেখানো",
  "praise": "প্রশংসা করা",
  "forgive": "ক্ষমা করা",
  "choose": "বেছে নেওয়া",
  "gather": "জমা করা",
  "smile": "হাসা",
  "translate": "অনুবাদ করা"
};

function currentViewportMode() {
  return window.matchMedia("(max-width: 820px)").matches || isNativeApp() ? "mobile" : "desktop";
}

function isNativeApp() {
  const capacitor = window.Capacitor;
  if (initialParams.get("native") === "1") return true;
  if (!capacitor) return false;
  if (typeof capacitor.isNativePlatform === "function") return capacitor.isNativePlatform();
  if (typeof capacitor.getPlatform === "function") return capacitor.getPlatform() !== "web";
  return Boolean(capacitor.platform && capacitor.platform !== "web");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name] || iconPaths.home}</svg>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isBengali() {
  return state.language === "bn";
}

function t(key, fallback = key) {
  return isBengali() ? (uiText.bn[key] || fallback) : fallback;
}

function routeLabel(route) {
  return t(route.id, route.label);
}

function publicRouteLabel(route) {
  return t(route.id, route.label);
}

function localizedText(value) {
  const text = String(value || "");
  if (!isBengali()) return text;

  const exact = bengaliMeanings[normalizeMeaningKey(text)];
  if (exact) return exact;

  const phrase = text
    .split(" / ")
    .map((part) => bengaliMeanings[normalizeMeaningKey(part)] || localizedMeaningPart(part) || part)
    .join(" / ");
  if (phrase !== text && !/[A-Za-z]/.test(phrase)) return phrase;

  const generated = localizedMeaningPart(text);
  if (generated) return generated;

  return bengaliFallbackFor(text);
}

function localizedMeaningPart(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const normalized = normalizeMeaningKey(text);
  if (bengaliMeanings[normalized]) return bengaliMeanings[normalized];
  const term = lookupBengaliTerm(text, bengaliVocabularyMeanings);
  if (term) return term;

  const slashParts = text.split(/\s*\/\s*/).filter(Boolean);
  if (slashParts.length > 1) {
    return slashParts.map((part) => localizedMeaningPart(part) || fallbackBengaliMeaning(part)).join(" / ");
  }

  const parenthetical = text.match(/^(.+?)\s*\((.+)\)$/);
  if (parenthetical) {
    const base = localizedMeaningPart(parenthetical[1]) || fallbackBengaliMeaning(parenthetical[1]);
    const note = localizedMeaningPart(parenthetical[2]) || fallbackBengaliMeaning(parenthetical[2]);
    return `${base} (${note})`;
  }

  if (normalized.startsWith("the ")) {
    return localizedMeaningPart(text.replace(/^the\s+/i, "")) || fallbackBengaliMeaning(text);
  }

  if (normalized.startsWith("a ")) {
    const base = localizedMeaningPart(text.replace(/^a\s+/i, ""));
    if (base) return `একটি ${base}`;
  }

  const toVerb = text.match(/^to\s+(.+)$/i);
  if (toVerb) return localizedVerbPhrase(toVerb[1]);

  const pronounVerb = text.match(/^(i|we|you|he|she|they)\s+(.+)$/i);
  if (pronounVerb) {
    const pronoun = lookupBengaliTerm(pronounVerb[1], bengaliVocabularyMeanings);
    return `${pronoun} ${localizedVerbPhrase(pronounVerb[2])}`.trim();
  }

  const possessive = text.match(/^(.+?)\s+of\s+(.+)$/i);
  if (possessive) {
    const first = localizedMeaningPart(possessive[1]) || fallbackBengaliMeaning(possessive[1]);
    const second = localizedMeaningPart(possessive[2]) || fallbackBengaliMeaning(possessive[2]);
    return `${second}-এর ${first}`;
  }

  const wordTranslation = translateWordsToBengali(text);
  if (wordTranslation) return wordTranslation;

  return "";
}

function localizedVerbPhrase(value) {
  const text = String(value || "").trim();
  const normalized = normalizeMeaningKey(text)
    .replace(/^not\s+/, "না ")
    .replace(/^be\s+/, "")
    .replace(/^is\s+/, "")
    .replace(/^are\s+/, "");

  const verb = lookupBengaliTerm(normalized, bengaliVerbMeanings);
  if (verb) return verb;
  const noun = lookupBengaliTerm(normalized, bengaliVocabularyMeanings);
  if (noun) return noun;

  const slashParts = text.split(/\s*\/\s*/).filter(Boolean);
  if (slashParts.length > 1) {
    return slashParts.map((part) => localizedVerbPhrase(part)).join(" / ");
  }

  const cleaned = normalized
    .replace(/^be\s+/, "")
    .replace(/^a\s+/, "")
    .replace(/^the\s+/, "");
  const cleanedVerb = lookupBengaliTerm(cleaned, bengaliVerbMeanings);
  if (cleanedVerb) return cleanedVerb;

  const words = cleaned.split(/\s+/).filter(Boolean);
  const translated = words
    .map((word) => lookupBengaliTerm(word, bengaliVerbMeanings) || lookupBengaliTerm(word, bengaliVocabularyMeanings) || "")
    .filter(Boolean);
  if (translated.length === words.length && translated.length) return translated.join(" ");

  return `${fallbackBengaliMeaning(text)} করা`;
}

function translateWordsToBengali(value) {
  const text = String(value || "").trim();
  const words = text
    .replace(/[.,!?;:]+$/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length || words.length > 6) return "";

  const translated = words.map((word) => {
    const clean = normalizeMeaningKey(word.replace(/[()]/g, ""));
    return lookupBengaliTerm(clean, bengaliVocabularyMeanings)
      || lookupBengaliTerm(clean, bengaliVerbMeanings)
      || lookupBengaliTerm(singularizeEnglish(clean), bengaliVocabularyMeanings)
      || "";
  });

  if (translated.every(Boolean)) return translated.join(" ");
  return "";
}

function lookupBengaliTerm(value, lexicon) {
  const text = String(value || "").trim();
  const normalized = normalizeMeaningKey(text);
  const titleCase = normalized
    .split(/\s+/)
    .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : word)
    .join(" ");
  return lexicon[text] || lexicon[normalized] || lexicon[titleCase] || "";
}

function singularizeEnglish(value) {
  if (value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.endsWith("es")) return value.slice(0, -2);
  if (value.endsWith("s") && value.length > 3) return value.slice(0, -1);
  return value;
}

function fallbackBengaliMeaning(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/[A-Za-z]/.test(text)) return text;
  if (/proper name/i.test(text)) return "ব্যক্তিনাম";
  if (/language/i.test(text)) return "ভাষা";
  if (/pattern/i.test(text)) return "রূপ";
  if (/particle/i.test(text)) return "অব্যয়";
  if (/verb/i.test(text)) return "ক্রিয়া";
  if (/noun/i.test(text)) return "বিশেষ্য";
  if (/pronoun/i.test(text)) return "সর্বনাম";
  if (/sentence/i.test(text)) return "বাক্য";
  if (/question/i.test(text)) return "প্রশ্ন";
  if (/object/i.test(text)) return "কর্ম";
  if (/subject/i.test(text)) return "কর্তা";
  return "বাংলা অর্থ";
}

function bengaliFallbackFor(value) {
  const text = String(value || "").trim();
  if (!/[A-Za-z]/.test(text)) return text;

  const patterns = [
    [/^Choose the English meaning\.$/, "বাংলা অর্থ বেছে নিন।"],
    [/^Choose (the|an) Arabic word for:?$/, "এই অর্থের আরবি শব্দ বেছে নিন।"],
    [/^Choose the Arabic word for "(.+)"\.$/, (_, word) => `"${localizedText(word)}" অর্থের আরবি শব্দ বেছে নিন।`],
    [/^Choose an Arabic word for "(.+)"\.$/, (_, word) => `"${localizedText(word)}" অর্থের আরবি শব্দ বেছে নিন।`],
    [/^Write the Arabic word that means "(.+)"\.$/, (_, word) => `"${localizedText(word)}" অর্থের আরবি শব্দ লিখুন।`],
    [/^Which Arabic word means "(.+)"\?$/, (_, word) => `"${localizedText(word)}" অর্থের আরবি শব্দ কোনটি?`],
    [/^Answer using the lesson pattern: (.+)$/, "পাঠের ধরন ব্যবহার করে উত্তর দিন।"],
    [/^Fill each blank with a suitable word from this lesson.*$/, "এই পাঠের উপযুক্ত শব্দ দিয়ে শূন্যস্থান পূরণ করুন।"],
    [/^Rewrite the example by changing.*$/, "নির্দেশ অনুযায়ী সর্বনাম, লিঙ্গ, সংখ্যা বা কর্তা বদলে বাক্যটি লিখুন।"],
    [/^Write the singular and plural forms.*$/, "পাঠের বিশেষ্যগুলোর একবচন ও বহুবচন লিখুন, তারপর একটি বাক্যে ব্যবহার করুন।"],
    [/^Find the error, correct.*$/, "ভুলটি খুঁজে সংশোধন করুন, তারপর সঠিক বাক্যটি জোরে পড়ুন।"],
    [/^Count from 3 to 10.*$/, "এই পাঠের বিশেষ্য ব্যবহার করে ৩ থেকে ১০ পর্যন্ত গণনা করুন।"],
    [/^Match the Arabic words.*$/, "আরবি শব্দগুলো তাদের অর্থের সঙ্গে মিল করুন।"],
    [/^Read the example aloud.*$/, "উদাহরণটি জোরে পড়ুন, একবার কপি করুন, তারপর মিল আছে এমন একটি বাক্য লিখুন।"],
    [/^Ex\.\d+:\s*(.+)$/, (_, prompt) => localizedText(prompt)],
    [/^Lesson (\d+) Vocabulary$/, (_, number) => `পাঠ ${number} শব্দভান্ডার`],
    [/^Lesson (\d+)$/, (_, number) => `পাঠ ${number}`],
    [/^(.+) words due$/, (_, count) => `${count} শব্দ বাকি`],
    [/^(.+) selected words$/, (_, count) => `${count} নির্বাচিত শব্দ`],
    [/^(.+) answered$/, (_, count) => `${count} উত্তর দেওয়া হয়েছে`],
    [/^(.+) lessons available$/, (_, count) => `${count} পাঠ উপলব্ধ`],
    [/^(.+)% complete$/, (_, count) => `${count}% সম্পন্ন`],
    [/^(.+)% this week$/, (_, count) => `${count}% এই সপ্তাহে`]
  ];

  for (const [pattern, replacement] of patterns) {
    const match = text.match(pattern);
    if (match) return typeof replacement === "function" ? replacement(...match) : replacement;
  }

  return "বাংলা অনুবাদ যোগ করা হচ্ছে।";
}

function bilingualText(value) {
  const text = String(value || "");
  const localized = localizedText(text);
  return isBengali() && localized !== text ? localized : text;
}

function normalizeMeaningKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function localizedSourceLabel(source) {
  if (source === "Book model") return t("bookModel", source);
  if (source === "Practice model") return t("practiceModel", source);
  return source;
}

function localizedDifficultyLabel(title) {
  if (title === "Foundation") return t("foundation", title);
  if (title === "Build") return t("build", title);
  if (title === "Challenge") return t("challenge", title);
  return title;
}

function localizedLessonTitle(lesson) {
  return isBengali() ? `${t("lesson", "Lesson")} ${lesson.number}` : lesson.title;
}

function localizedLessonFocus(lesson) {
  if (!isBengali()) return lesson.focus;
  const localized = localizedText(lesson.focus);
  return localized.includes("বাংলা অনুবাদ") ? t("arabicCourseFocus", "This lesson builds Arabic structures, vocabulary, and grammar step by step.") : localized;
}

function localizedBookTitle(bookOrSlug) {
  const book = typeof bookOrSlug === "string" ? getBook(bookOrSlug) : bookOrSlug;
  if (!isBengali()) return book?.title || "Book";
  const number = String(book?.slug || "").replace("book-", "");
  return number ? `${t("book", "Book")} ${number}` : t("book", "Book");
}

function localizedBookSummary(book) {
  if (!isBengali()) return book?.summary || "This book is not available yet.";
  if (book?.slug === "book-1") return t("bookOneSummary", "Book 1 curriculum.");
  if (book?.slug === "book-2") return t("bookTwoSummary", "Book 2 curriculum.");
  if (book?.slug === "book-3") return t("bookThreeSummary", "Book 3 curriculum.");
  return t("thisBookUnavailable", "This book is not available yet.");
}

function localizedGrammarTitle(rule) {
  return isBengali() ? `${t("lesson", "Lesson")} ${rule.sequence} ${t("grammar", "Grammar")}` : rule.title;
}

function localizedGrammarSummary(rule) {
  if (!isBengali()) return rule.summary;
  const localized = localizedText(rule.summary);
  return localized.includes("বাংলা অনুবাদ") ? t("grammarSummary", "Practice the main grammar idea through the Arabic example.") : localized;
}

function localizedOption(value) {
  return hasArabic(value) ? value : localizedText(value);
}

const ANSWER_ARABIC_GLOSSARY = [
  ["fatḥah", "فَتْحَةٌ"],
  ["fathah", "فَتْحَةٌ"],
  ["kasrah", "كَسْرَةٌ"],
  ["ḍammah", "ضَمَّةٌ"],
  ["dammah", "ضَمَّةٌ"],
  ["tanwin", "تَنْوِينٌ"],
  ["definite", "مَعْرِفَةٌ"],
  ["indefinite", "نَكِرَةٌ"],
  ["marfu", "مَرْفُوعٌ"],
  ["marfūʿ", "مَرْفُوعٌ"],
  ["mansub", "مَنْصُوبٌ"],
  ["manṣūb", "مَنْصُوبٌ"],
  ["majzum", "مَجْزُومٌ"],
  ["majzūm", "مَجْزُومٌ"],
  ["mudari", "مُضَارِعٌ"],
  ["mudari'", "مُضَارِعٌ"],
  ["mudāriʿ", "مُضَارِعٌ"],
  ["second-person mudari", "الْمُضَارِعُ لِلْمُخَاطَبِ"],
  ["past tense isnad", "إِسْنَادُ الْمَاضِي"],
  ["mudari isnad", "إِسْنَادُ الْمُضَارِعِ"],
  ["mudari' isnad", "إِسْنَادُ الْمُضَارِعِ"],
  ["isnad", "إِسْنَادٌ"],
  ["maf'ul mutlaq", "مَفْعُولٌ مُطْلَقٌ"],
  ["mafʿul mutlaq", "مَفْعُولٌ مُطْلَقٌ"],
  ["tamyiz", "تَمْيِيزٌ"],
  ["tamyīz", "تَمْيِيزٌ"],
  ["khabar", "خَبَرٌ"],
  ["zarf of time", "ظَرْفُ زَمَانٍ"],
  ["zarf", "ظَرْفٌ"],
  ["mudaf", "مُضَافٌ"],
  ["muḍāf", "مُضَافٌ"],
  ["ma'dud", "مَعْدُودٌ"],
  ["maʿdūd", "مَعْدُودٌ"],
  ["masdar", "مَصْدَرٌ"],
  ["active participle", "اسْمُ الْفَاعِلِ"],
  ["passive participle", "اسْمُ الْمَفْعُولِ"],
  ["noun of instrument", "اسْمُ الْآلَةِ"],
  ["instrument noun", "اسْمُ الْآلَةِ"],
  ["noun of place", "اسْمُ الْمَكَانِ"],
  ["noun of time", "اسْمُ الزَّمَانِ"],
  ["place noun", "اسْمُ الْمَكَانِ"],
  ["time noun", "اسْمُ الزَّمَانِ"],
  ["mithal", "مِثَالٌ"],
  ["mithāl", "مِثَالٌ"],
  ["ajwaf", "أَجْوَفُ"],
  ["nāqiṣ", "نَاقِصٌ"],
  ["naqis", "نَاقِصٌ"],
  ["muḍaʿʿaf", "مُضَعَّفٌ"],
  ["mudaaf", "مُضَعَّفٌ"],
  ["diptote", "مَمْنُوعٌ مِنَ الصَّرْفِ"],
  ["accusative", "نَصْبٌ"],
  ["genitive", "جَرٌّ"],
  ["nominative", "رَفْعٌ"],
  ["indicative", "رَفْعٌ"],
  ["subjunctive", "نَصْبٌ"],
  ["jussive", "جَزْمٌ"],
  ["object", "مَفْعُولٌ بِهِ"],
  ["direct object", "مَفْعُولٌ بِهِ"],
  ["circumstantial clause", "جُمْلَةُ الْحَالِ"],
  ["waw al-hal", "وَاوُ الْحَالِ"],
  ["condition", "شَرْطٌ"],
  ["prohibition", "نَهْيٌ"],
  ["imperative", "أَمْرٌ"],
  ["hamzah", "هَمْزَةٌ"],
  ["nun", "نُونٌ"],
  ["nūn", "نُونٌ"],
  ["future", "مُسْتَقْبَلٌ"],
  ["present", "مُضَارِعٌ"]
];

function normalizeAnswerGloss(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ʿ‘’`]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function answerGlossParts(value) {
  const text = String(value || "");
  return uniqueValues([
    text,
    ...text.split(/\s*(?:,|;|\/|\band\b|\bor\b)\s*/i)
  ].map((part) => part.trim()).filter(Boolean));
}

function glossaryArabicForAnswer(answer) {
  const entries = ANSWER_ARABIC_GLOSSARY.map(([term, arabic]) => ({
    key: normalizeAnswerGloss(term),
    arabic
  }));
  const normalizedAnswer = normalizeAnswerGloss(answer);
  const exactMatches = answerGlossParts(answer).flatMap((part) => {
    const normalizedPart = normalizeAnswerGloss(part);
    return entries.filter((entry) => entry.key === normalizedPart).map((entry) => entry.arabic);
  });
  if (exactMatches.length) return uniqueValues(exactMatches);

  return uniqueValues(
    entries
      .filter((entry) => entry.key.length > 3 && normalizedAnswer.includes(entry.key))
      .map((entry) => entry.arabic)
  );
}

function vocabularyArabicForAnswer(answer) {
  const parts = answerGlossParts(answer).map(normalizeAnswerGloss);
  if (!parts.length) return [];

  return uniqueValues(
    (state.data.vocabulary || [])
      .flatMap((word) => {
        const glosses = [
          word.english,
          word.transliteration,
          ...answerGlossParts(word.english || ""),
          ...answerGlossParts(word.transliteration || "")
        ].map(normalizeAnswerGloss);
        return glosses.some((gloss) => parts.includes(gloss)) ? [word.arabic] : [];
      })
      .filter(Boolean)
  ).slice(0, 3);
}

function answerArabicMatches(answer, context = {}, options = {}) {
  if (!answer || hasArabic(answer)) return [];
  const excludedArabic = (Array.isArray(options.excludeArabic) ? options.excludeArabic : [options.excludeArabic])
    .filter(Boolean);
  const removeExcluded = (matches) => uniqueValues(matches)
    .filter((candidate) => !excludedArabic.some((excluded) => isSameArabicText(candidate, excluded)));
  const directMatches = removeExcluded([
    ...vocabularyArabicForAnswer(answer),
    ...glossaryArabicForAnswer(answer),
    ...(context.answerArabic ? [context.answerArabic] : [])
  ].filter(Boolean));

  if (directMatches.length || options.includeSourceContext === false) return directMatches;
  return removeExcluded(context.arabic ? [context.arabic] : []);
}

function renderAnswerDisplay(answer, context = {}, options = {}) {
  const value = String(answer || "");
  const arabicMatches = answerArabicMatches(value, context, options);
  const isArabic = hasArabic(value);
  const label = isArabic ? value : localizedOption(value);
  const classes = [
    "answer-with-arabic",
    isArabic ? "arabic-only" : "",
    options.className || ""
  ].filter(Boolean).join(" ");

  return `
    <span class="${classes}">
      <span class="answer-primary" ${isArabic ? 'dir="rtl" lang="ar"' : ""}>${escapeHtml(label)}</span>
      ${arabicMatches.length ? `<span class="answer-arabic" dir="rtl" lang="ar">${escapeHtml(arabicMatches.join(" / "))}</span>` : ""}
    </span>
  `;
}

function renderExerciseOptionDisplay(option) {
  return renderAnswerDisplay(option, {}, {
    includeSourceContext: false,
    className: "option-answer"
  });
}

function arabicTermsForText(text) {
  const normalized = ` ${normalizeAnswerGloss(text)} `;
  return uniqueValues(
    ANSWER_ARABIC_GLOSSARY
      .map(([term, arabic]) => ({ key: normalizeAnswerGloss(term), arabic }))
      .filter((entry) => entry.key.length > 3 && normalized.includes(` ${entry.key} `))
      .map((entry) => entry.arabic)
  );
}

function renderPromptTermGlosses(prompt) {
  const terms = arabicTermsForText(prompt);
  if (!terms.length) return "";
  return `
    <div class="prompt-term-glosses" aria-label="${t("arabicTerms", "Arabic terms")}">
      ${terms.map((term) => `<span dir="rtl" lang="ar">${escapeHtml(term)}</span>`).join("")}
    </div>
  `;
}

function renderPromptText(prompt) {
  return `
    <p>${escapeHtml(localizedText(prompt))}</p>
    ${renderPromptTermGlosses(prompt)}
  `;
}

function normalizedQuizPrompt(question) {
  const prompt = String(question?.prompt || "");
  const display = String(question?.display || "").trim();
  if (question?.answerKey !== "arabic" || !display) return prompt;

  const mentionsDisplay = prompt.includes(`"${display}"`) || prompt.toLowerCase().includes(display.toLowerCase());
  const asksForArabicWord = /arabic word/i.test(prompt);
  if (mentionsDisplay && asksForArabicWord) return "Choose an Arabic word for:";
  if (/^Choose (the|an) Arabic word for:?$/i.test(prompt)) return "Choose an Arabic word for:";
  if (/^Which Arabic word means\b/i.test(prompt)) return "Choose an Arabic word for:";
  return prompt;
}

function arabicLookupTokens(value) {
  return normalizeArabicLookup(value)
    .split(/[\s/]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function isSameArabicText(first, second) {
  if (!hasArabic(first) || !hasArabic(second)) return false;
  const firstText = normalizeArabicLookup(first);
  const secondText = normalizeArabicLookup(second);
  if (firstText && firstText === secondText) return true;

  const firstTokens = arabicLookupTokens(first).sort();
  const secondTokens = arabicLookupTokens(second).sort();
  return firstTokens.length > 0
    && firstTokens.length === secondTokens.length
    && firstTokens.every((token, index) => token === secondTokens[index]);
}

function exercisePromptArabic(exercise) {
  if (!exercise?.arabic || !hasArabic(exercise.arabic)) return "";
  const lesson = byId(state.data.lessons || [], exercise.lessonId);
  const answerOnlyArabic = isSameArabicText(exercise.arabic, exercise.answer);
  const prompt = String(exercise.prompt || "").toLowerCase();

  if (!answerOnlyArabic) return exercise.arabic;
  if (prompt.includes("model sentence") && lesson?.arabic && !isSameArabicText(lesson.arabic, exercise.answer)) {
    return lesson.arabic;
  }

  return "";
}

function renderExerciseArabicPrompt(exercise, className = "arabic-hero exercise-prompt") {
  const arabic = exercisePromptArabic(exercise);
  if (!arabic) return "";
  return `<button class="${className}" type="button" data-speak="${escapeHtml(arabic)}" lang="ar">${arabic}</button>`;
}

function renderModelAnswerReveal(answer, context = {}, explanation = "", options = {}) {
  const correct = Boolean(options.correct);
  if (correct && !explanation) return "";
  return `
    <details class="answer-reveal practice-answer-reveal">
      <summary>
        <span>${correct ? t("viewExplanation", "View explanation") : t("viewAnswer", "View answer")}</span>
        ${icon("arrow")}
      </summary>
      <div class="practice-answer-content">
        ${correct ? "" : `<span class="answer-kicker">${t("modelAnswer", "Model answer")}</span>${renderAnswerDisplay(answer, context)}`}
        ${explanation ? `<span class="answer-extra">${escapeHtml(explanation)}</span>` : ""}
      </div>
    </details>
  `;
}

function renderQuestionExplanation(question, selectedAnswer = "") {
  const answer = question?.answer || "";
  const correct = selectedAnswer === answer;
  const context = {
    answerArabic: question?.answerArabic || "",
    arabic: question?.answerKey === "english" ? question?.arabic || "" : question?.arabic || ""
  };
  return renderModelAnswerReveal(answer, context, question?.explanation || "", { correct });
}

function renderRetryButton(kind, payload = {}) {
  const attributes = Object.entries(payload)
    .map(([key, value]) => `data-retry-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="${escapeHtml(value)}"`)
    .join(" ");
  return `
    <button class="retry-button" type="button" data-retry-answer="${escapeHtml(kind)}" ${attributes}>
      ${icon("retry")} ${t("retry", "Retry")}
    </button>
  `;
}

function byId(items, id) {
  return items.find((item) => item.id === id);
}

function getCurrentLesson() {
  return byId(state.data.lessons, state.progress.currentLessonId) || state.data.lessons[0];
}

function getSelectedLesson() {
  return byId(state.data.lessons, state.selectedLessonId) || getCurrentLesson();
}

function lessonsForBook(bookSlug) {
  return state.data.lessons.filter((lesson) => lesson.bookSlug === bookSlug);
}

function selectedLessonForBook(bookSlug) {
  const bookLessons = lessonsForBook(bookSlug);
  return bookLessons.find((lesson) => lesson.id === state.selectedLessonId)
    || bookLessons.find((lesson) => lesson.id === state.progress.currentLessonId)
    || bookLessons[0];
}

function lessonProgressPercent(bookSlug = null) {
  const scopedLessons = bookSlug ? lessonsForBook(bookSlug) : state.data.lessons;
  if (!scopedLessons.length) return 0;
  const scopedIds = new Set(scopedLessons.map((lesson) => lesson.id));
  const completed = state.progress.completedLessonIds.filter((id) => scopedIds.has(id)).length;
  return Math.round((completed / scopedLessons.length) * 100);
}

function weeklyPercent() {
  return Math.round((state.progress.weeklyGoalCompleted / state.progress.weeklyGoalTarget) * 100);
}

function vocabularyPercent() {
  return Math.round((state.progress.learnedVocabularyIds.length / state.data.vocabulary.length) * 100);
}

function getLessonVocabulary(lesson) {
  return state.data.vocabulary.filter((word) => lesson.vocabularyIds.includes(word.id));
}

function getBook(slug) {
  return state.data.books.find((book) => book.slug === slug);
}

function isBookRoute(routeId) {
  return /^book-\d+$/.test(routeId);
}

function routeIsLocked(route) {
  const book = isBookRoute(route.id) ? getBook(route.id) : null;
  if (book) return book.status !== "available" || (isAuthenticated() && !canAccessBookSlug(route.id));
  return Boolean(route.locked) || (isAuthenticated() && routeRequiresPremium(route.id));
}

function getVocabularyWordsForBook(bookSlug) {
  return state.data.vocabulary.filter((word) => word.bookSlug === bookSlug);
}

function getVocabularyBookOptions() {
  return state.data.books.map((book) => ({
    ...book,
    wordCount: getVocabularyWordsForBook(book.slug).length
  }));
}

function currentVocabularyBook() {
  const options = getVocabularyBookOptions();
  const selected = options.find((book) => book.slug === state.selectedVocabularyBookSlug && book.status === "available" && canAccessBookSlug(book.slug));
  return selected || options.find((book) => book.status === "available" && canAccessBookSlug(book.slug)) || options[0];
}

function vocabularyLessonKey(bookSlug, lessonNumber) {
  return `${bookSlug}:${lessonNumber}`;
}

function wordLessonKey(word) {
  return vocabularyLessonKey(word.bookSlug, word.lessonNumber);
}

function lessonLabelForWord(word) {
  const book = getBook(word.bookSlug);
  if (word.lessonNumber === "PDF") return `${localizedBookTitle(book)} ${t("supplemental", "Supplemental")}`;
  const lesson = state.data.lessons.find((item) => item.bookSlug === word.bookSlug && item.number === word.lessonNumber);
  return `${localizedBookTitle(book)} ${t("lesson", "Lesson")} ${word.lessonNumber}${lesson && !isBengali() ? ` · ${lesson.title}` : ""}`;
}

function routeForResource(resource) {
  if (resource.kind === "Practice") return "exercises";
  const relatedBook = state.data.books.find((book) =>
    resource.id.includes(book.slug) || resource.title.includes(book.title)
  );
  return relatedBook?.slug || "resources";
}

function progressRecord(name) {
  return state.progress?.[name] || {};
}

function bookmarkRecord() {
  return {
    lessons: [],
    vocabulary: [],
    examples: [],
    exercises: [],
    ...(state.progress?.bookmarks || {})
  };
}

function isBookmarked(type, id) {
  return (bookmarkRecord()[type] || []).includes(id);
}

function bookmarkPatch(type, id, enabled) {
  const bookmarks = bookmarkRecord();
  const values = new Set(bookmarks[type] || []);
  if (enabled) values.add(id);
  else values.delete(id);
  return {
    bookmarks: {
      ...bookmarks,
      [type]: Array.from(values)
    }
  };
}

function renderBookmarkButton(type, id, label = "") {
  const active = isBookmarked(type, id);
  return `
    <button class="bookmark-button ${active ? "active" : ""}" type="button" data-bookmark-type="${escapeHtml(type)}" data-bookmark-id="${escapeHtml(id)}" aria-pressed="${active}" aria-label="${active ? t("removeBookmark", "Remove bookmark") : t("bookmark", "Bookmark")}">
      ${icon("star")} ${label ? `<span>${escapeHtml(label)}</span>` : ""}
    </button>
  `;
}

function renderReportIssueForm({ kind, itemId, lessonId = "", bookSlug = "", label = "" }) {
  return `
    <details class="report-issue">
      <summary>${icon("flag")} <span>${escapeHtml(label || t("reportIssue", "Report issue"))}</span></summary>
      <form class="report-issue-form" data-content-report>
        <input type="hidden" name="kind" value="${escapeHtml(kind)}" />
        <input type="hidden" name="itemId" value="${escapeHtml(itemId)}" />
        <input type="hidden" name="lessonId" value="${escapeHtml(lessonId)}" />
        <input type="hidden" name="bookSlug" value="${escapeHtml(bookSlug)}" />
        <label class="form-field">
          <span>${t("whatNeedsFixing", "What needs fixing?")}</span>
          <textarea name="message" maxlength="700" required placeholder="${escapeHtml(t("reportIssuePlaceholder", "Mention the translation, diacritic, audio note, or exercise wording that looks wrong."))}"></textarea>
        </label>
        <button class="ghost-button compact-button" type="submit">${icon("flag")} ${t("sendReport", "Send report")}</button>
      </form>
    </details>
  `;
}

function isAuthenticated() {
  return Boolean(state.user && !state.user.isDemo);
}

function isAdmin() {
  return isAuthenticated() && normalizeEmail(state.user.email) === "99muhammad.r@gmail.com";
}

function isPublicRoute(routeId) {
  return publicRouteIds.has(routeId);
}

function isHiddenLaunchRoute(routeId) {
  return ["grammar", "exercises", "progress"].includes(routeId);
}

function applyLaunchRouteRedirect(routeId) {
  if (routeId === "exercises") {
    const lesson = getCurrentLesson();
    state.selectedLessonId = lesson.id;
    state.route = lesson.bookSlug;
    state.lessonTab = hasPremiumAccess() ? "book-exercises" : "learn";
    return true;
  }

  if (routeId === "grammar") {
    const lesson = getCurrentLesson();
    state.selectedLessonId = lesson.id;
    state.route = lesson.bookSlug;
    state.lessonTab = "learn";
    return true;
  }

  if (routeId === "progress") {
    state.route = "home";
    state.lessonTab = "learn";
    return true;
  }

  return false;
}

function currentPlanKey() {
  if (!isAuthenticated()) return "free";
  return state.user.subscriptionPlan === "paid" && state.user.subscriptionStatus === "active" ? "paid" : "free";
}

function currentPlan() {
  return planEntitlements[currentPlanKey()] || planEntitlements.free;
}

function hasPremiumAccess() {
  return currentPlanKey() === "paid";
}

function localizedPlanLabel(planKey = currentPlanKey()) {
  return planKey === "paid" ? t("premiumPlan", "Premium") : t("freePlan", "Free");
}

function canAccessBookSlug(bookSlug) {
  return currentPlan().books.includes(bookSlug);
}

function canAccessLessonTab(tab) {
  return currentPlan().lessonTabs.includes(tab);
}

function canAccessTesterBook(bookSlug) {
  return currentPlan().testerBooks.includes(bookSlug);
}

function canAccessTesterFocus(focus) {
  return currentPlan().testerFocus.includes(focus);
}

function routeRequiresPremium(routeId) {
  if (isBookRoute(routeId)) return !canAccessBookSlug(routeId);
  return currentPlan().paidRoutes.includes(routeId);
}

function learningPreferences() {
  return {
    studyGoal: "guided-books",
    skillFocus: "balanced",
    dailyMinutes: 10,
    onboardingComplete: false,
    ...(state.progress?.learningPreferences || {})
  };
}

function learningPreferenceLabel(type, value) {
  const labels = {
    studyGoal: {
      "guided-books": t("guidedBooks", "Guided books"),
      "quran-grammar": t("quranGrammar", "Qur'an grammar"),
      vocabulary: t("vocabulary", "Vocabulary"),
      "exam-revision": t("examRevision", "Exam revision")
    },
    skillFocus: {
      balanced: t("balanced", "Balanced"),
      reading: t("reading", "Reading"),
      vocabulary: t("vocabulary", "Vocabulary"),
      grammar: t("grammar", "Grammar")
    }
  };
  return labels[type]?.[value] || String(value || "");
}

function paidFeatureText(feature = "default") {
  const copy = {
    book: t("paidBookText", "This book is part of Premium. You can continue Book 1 for free."),
    lessonTab: t("paidLessonTabText", "Lesson exercises, quizzes, and review are unlocked with Premium."),
    progress: t("paidProgressText", "Full progress, mistake review, and spaced repetition are part of Premium."),
    tester: t("paidTesterText", "Book 2-3, due words, mistake filters, and the full vocabulary tester unlock with Premium."),
    default: t("premiumPlanText", "Book 2-3, all exercises, lesson quizzes, mistake review, spaced review, advanced progress, and the full vocabulary tester.")
  };
  return copy[feature] || copy.default;
}

function reviewStatsFor(wordId, correct) {
  const current = progressRecord("vocabularyStats")[wordId] || { level: 0, correct: 0, incorrect: 0 };
  return window.MadinahLearningCore.nextReviewStats(current, correct);
}

function dueVocabularyItems(lesson = null) {
  const lessonIds = lesson ? new Set(lesson.vocabularyIds || []) : null;
  return state.data.vocabulary.filter((word) => {
    if (lessonIds && !lessonIds.has(word.id)) return false;
    return isVocabularyDue(word);
  });
}

function weakVocabularyItems(limit = 12) {
  const accessibleWords = state.data.vocabulary.filter((word) => canAccessBookSlug(word.bookSlug));
  return window.MadinahLearningCore.weakVocabulary(accessibleWords, state.progress, limit);
}

function isVocabularyDue(word) {
  const stats = progressRecord("vocabularyStats")[word.id];
  if (!stats) return !state.progress.learnedVocabularyIds.includes(word.id);
  return Date.parse(stats.dueAt || 0) <= Date.now();
}

function hasOpenVocabularyMistake(word) {
  const mistakes = progressRecord("mistakes");
  return [`vocab-${word.id}`, `tester-${word.id}`].some((id) => mistakes[id] && !mistakes[id].resolved);
}

function vocabularyFocusMatches(word, focus) {
  const learned = state.progress.learnedVocabularyIds.includes(word.id);
  if (focus === "new") return !learned;
  if (focus === "learned") return learned;
  if (focus === "due") return isVocabularyDue(word);
  if (focus === "mistakes") return hasOpenVocabularyMistake(word);
  return true;
}

function vocabularyStatus(word) {
  const stats = progressRecord("vocabularyStats")[word.id] || {};
  const learned = state.progress.learnedVocabularyIds.includes(word.id);
  const correct = Number(stats.correct || 0);
  const incorrect = Number(stats.incorrect || 0);
  const level = Number(stats.level || 0);

  if (hasOpenVocabularyMistake(word) || incorrect > correct) return "weak";
  if (learned && level >= 4) return "known";
  if (learned || correct > 0 || Number(stats.reviewCount || 0) > 0) return "learning";
  return "new";
}

function vocabularyStatusLabel(status) {
  return {
    new: t("new", "New"),
    learning: t("learning", "Learning"),
    known: t("known", "Known"),
    weak: t("weak", "Weak")
  }[status] || t("new", "New");
}

function vocabularyStatusCounts(words = state.data.vocabulary.filter((word) => canAccessBookSlug(word.bookSlug))) {
  return words.reduce((counts, word) => {
    counts[vocabularyStatus(word)] += 1;
    return counts;
  }, { new: 0, learning: 0, known: 0, weak: 0 });
}

function reviewScheduleText(word) {
  const stats = progressRecord("vocabularyStats")[word.id];
  if (!stats?.dueAt) return t("readyToLearn", "Ready to learn");
  const due = Date.parse(stats.dueAt);
  if (!Number.isFinite(due) || due <= Date.now()) return t("dueNow", "Due now");
  const days = Math.max(1, Math.ceil((due - Date.now()) / (24 * 60 * 60 * 1000)));
  return days === 1 ? t("dueTomorrow", "Due tomorrow") : `${t("dueIn", "Due in")} ${days} ${t("days", "days")}`;
}

function visibleVocabularyWords() {
  return state.data.vocabulary.filter((word) => canAccessBookSlug(word.bookSlug));
}

function mistakeItems(lesson = null) {
  const lessonId = lesson?.id;
  return Object.values(progressRecord("mistakes"))
    .filter((mistake) => mistake && !mistake.resolved && (!lessonId || mistake.lessonId === lessonId))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function mistakePatch(id, mistake) {
  return {
    mistakes: {
      [id]: {
        id,
        resolved: false,
        createdAt: new Date().toISOString(),
        ...mistake
      }
    }
  };
}

function resolvedMistakePatch(id) {
  return {
    mistakes: {
      [id]: {
        ...(progressRecord("mistakes")[id] || { id }),
        id,
        resolved: true,
        resolvedAt: new Date().toISOString()
      }
    }
  };
}

function lessonMastery(lesson) {
  const lessonVocabulary = getLessonVocabulary(lesson);
  const learned = lessonVocabulary.filter((word) => state.progress.learnedVocabularyIds.includes(word.id)).length;
  const vocabularyScore = lessonVocabulary.length ? learned / lessonVocabulary.length : 0;
  const exerciseCards = getLessonExerciseCards(lesson, lessonVocabulary);
  const exerciseScore = exerciseCards.length
    ? exerciseCards.filter((card) => progressRecord("exerciseAttempts")[card.id] === "complete" || progressRecord("exerciseAnswers")[card.id] === "correct").length / exerciseCards.length
    : 0;
  const lessonQuiz = state.data.exercises.find((item) => item.lessonId === lesson.id);
  const quizScore = lessonQuiz && progressRecord("exerciseAttempts")[lessonQuiz.id] === "correct" ? 1 : 0;
  const writingScore = exerciseCards.length
    ? exerciseCards.filter((card) => progressRecord("writingAttempts")[`write-${card.id}`] === "correct").length / exerciseCards.length
    : 0;
  const completedScore = state.progress.completedLessonIds.includes(lesson.id) ? 1 : 0;

  return Math.round((vocabularyScore * 0.3 + exerciseScore * 0.25 + quizScore * 0.2 + writingScore * 0.15 + completedScore * 0.1) * 100);
}

function lessonMasteryStatus(lesson) {
  const score = lessonMastery(lesson);
  const due = dueVocabularyItems(lesson).length;
  const openMistakes = mistakeItems(lesson).length;
  const complete = state.progress.completedLessonIds.includes(lesson.id);

  if (!complete && score === 0) return { key: "not-started", label: t("notStarted", "Not started"), score };
  if (openMistakes || due > 2 || (complete && score < 75)) return { key: "needs-review", label: t("needsReview", "Needs review"), score };
  if (complete && score >= 90 && due === 0) return { key: "mastered", label: t("mastered", "Mastered"), score };
  return { key: "learning", label: t("learning", "Learning"), score };
}

function renderMasteryChip(lesson) {
  const mastery = lessonMasteryStatus(lesson);
  return `<span class="mastery-chip ${mastery.key}">${escapeHtml(mastery.label)} · ${mastery.score}%</span>`;
}

function lessonListStatusLabel(mastery) {
  if (mastery.key === "needs-review") return t("review", "Review");
  return mastery.label;
}

function renderLessonListItem(item, selectedLessonId) {
  const mastery = lessonMasteryStatus(item);
  const score = Math.max(0, Math.min(100, Number(mastery.score) || 0));
  const complete = state.progress.completedLessonIds.includes(item.id);
  const active = selectedLessonId === item.id;

  return `
    <button class="lesson-link ${active ? "active" : ""} ${mastery.key}" type="button" data-lesson="${item.id}" ${active ? 'aria-current="page"' : ""}>
      <span class="lesson-number">${String(item.number).padStart(2, "0")}</span>
      <span class="lesson-link-main">
        <strong>${escapeHtml(localizedLessonTitle(item))}</strong>
      </span>
      <span class="lesson-link-meta">
        <span class="lesson-progress-track" aria-hidden="true"><span style="width:${score}%"></span></span>
        <span class="lesson-status ${mastery.key}" aria-label="${escapeHtml(mastery.label)} ${score}%">
          <span class="lesson-status-label">${escapeHtml(lessonListStatusLabel(mastery))}</span>
          <span class="lesson-status-score">${score}%</span>
        </span>
        ${complete ? `<span class="lesson-complete-icon" aria-label="${t("completed", "Completed")}">${icon("check")}</span>` : ""}
      </span>
    </button>
  `;
}

function normalizeArabicLookup(value) {
  return String(value || "")
    .replace(/[ـ]/g, "")
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[^\u0621-\u064A\u0660-\u0669\s/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArabicCore(value) {
  return normalizeArabicLookup(value).replace(/^ال/, "");
}

function wordForArabicToken(token, lessonVocabulary) {
  const normalized = normalizeArabicCore(token);
  if (!normalized) return null;
  return lessonVocabulary.find((word) => {
    const forms = String(word.arabic || "").split(/\s*\/\s*/);
    return forms.some((form) => {
      const wordNormalized = normalizeArabicCore(form);
      return wordNormalized && (normalized === wordNormalized || normalized.includes(wordNormalized) || wordNormalized.includes(normalized));
    });
  }) || null;
}

function renderArabicWordInspector(text, lessonVocabulary) {
  const tokens = String(text || "").split(/(\s+)/);
  if (!tokens.some((token) => hasArabic(token))) return "";

  return `
    <div class="arabic-word-inspector" dir="rtl" lang="ar" aria-label="${t("tapArabicWords", "Tap Arabic words")}">
      ${tokens.map((token) => {
        if (!token.trim()) return escapeHtml(token);
        if (!hasArabic(token)) return `<span>${escapeHtml(token)}</span>`;

        const word = wordForArabicToken(token, lessonVocabulary);
        const speakText = word?.arabic || token;
        const status = word ? vocabularyStatus(word) : "new";
        const meaning = word ? localizedText(word.english) : t("listenToPhrase", "Listen to this phrase");
        return `
          <details class="arabic-token ${word ? `status-${status}` : "unmatched"}">
            <summary>${escapeHtml(token)}</summary>
            <div class="arabic-token-popover" dir="ltr">
              <strong>${escapeHtml(meaning)}</strong>
              <span>${word ? `${vocabularyStatusLabel(status)} · ${reviewScheduleText(word)}` : t("audioOnly", "Audio only")}</span>
              <button class="icon-button" type="button" data-speak="${escapeHtml(speakText)}" aria-label="${t("playAudio", "Play audio")}">${icon("speaker")}</button>
            </div>
          </details>
        `;
      }).join("")}
    </div>
  `;
}

function normalizeAnswer(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[ـ،.؟?!'"]/g, "")
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/\s+/g, " ");
}

async function loadApp() {
  document.getElementById("app").innerHTML = renderLoadingShell();

  try {
    const response = await fetch("/api/bootstrap", authFetchOptions());
    if (!response.ok) throw new Error("Unable to load app data.");
    const payload = await response.json();
    state.data = payload;
    state.progress = payload.progress;
    state.user = payload.user;
    state.selectedLessonId = new URLSearchParams(window.location.search).get("lesson") || payload.progress.currentLessonId;
    state.route = new URLSearchParams(window.location.search).get("route") || state.route;
    if (isHiddenLaunchRoute(state.route)) applyLaunchRouteRedirect(state.route);
    state.selectedExerciseId = payload.exercises[0]?.id || null;
    render();
  } catch (error) {
    document.getElementById("app").innerHTML = `
      <main class="load-error">
        <h1>Madinah Arabic</h1>
        <p>${t("loadError", "The app needs the local server to load lesson data.")}</p>
        <code>npm run dev</code>
      </main>
    `;
  }
}

function renderLoadingShell() {
  return `
    <main class="loading-shell" aria-busy="true">
      <section class="card loading-card">
        <span class="brand-mark" aria-hidden="true"></span>
        <div class="skeleton-line wide"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-grid">
          <span class="skeleton-block"></span>
          <span class="skeleton-block"></span>
          <span class="skeleton-block"></span>
        </div>
      </section>
    </main>
  `;
}

function authFetchOptions(options = {}) {
  return {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.headers || {})
    }
  };
}

async function saveProgress(patch) {
  const response = await fetch("/api/progress", authFetchOptions({
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch)
  }));

  if (!response.ok) return;
  const payload = await response.json();
  state.progress = payload.progress;
  render();
}

async function submitAuth(form) {
  const formData = new FormData(form);
  const authMode = state.authMode || "login";
  const endpointByMode = {
    register: "/api/auth/register",
    login: "/api/auth/login",
    forgot: "/api/auth/forgot-password",
    reset: "/api/auth/reset-password",
    verify: "/api/auth/verify-email"
  };
  const payload = authMode === "reset"
    ? { token: formData.get("token"), password: formData.get("password") }
    : authMode === "verify"
      ? { token: formData.get("token") }
      : {
          displayName: formData.get("displayName"),
          email: formData.get("email"),
          password: formData.get("password")
        };
  const endpoint = endpointByMode[authMode] || "/api/auth/login";
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    state.authError = isBengali() ? t("unableSignIn", "Unable to sign in.") : (data.error || "Unable to sign in.");
    state.authNotice = "";
    render();
    return;
  }

  if (authMode === "forgot") {
    state.authMode = "reset";
    state.authError = "";
    state.authNotice = data.devToken
      ? `Development reset token: ${data.devToken}`
      : t("resetEmailPrepared", "If an account exists, reset instructions have been prepared.");
    state.authDevToken = data.devToken || "";
    render();
    return;
  }

  if (authMode === "reset") {
    state.authMode = "login";
    state.authError = "";
    state.authNotice = t("passwordUpdated", "Password updated. You can sign in now.");
    state.authDevToken = "";
    render();
    return;
  }

  if (authMode === "verify") {
    state.user = data.user || state.user;
    state.authMode = null;
    state.authError = "";
    state.authNotice = "";
    state.authDevToken = "";
    await loadApp();
    return;
  }

  state.sessionToken = "";
  state.user = data.user;
  state.progress = data.progress;
  state.authMode = null;
  state.authError = "";
  state.authNotice = data.devToken
    ? `Development verification token: ${data.devToken}`
    : "";
  state.authDevToken = data.devToken || "";
  await loadApp();
}

async function signOut() {
  await fetch("/api/auth/logout", authFetchOptions({ method: "POST" }));
  state.sessionToken = "";
  state.user = null;
  state.route = "home";
  state.authMode = null;
  state.authError = "";
  state.authNotice = "";
  state.authDevToken = "";
  state.adminContent = null;
  state.adminStatus = "";
  state.adminError = "";
  loadApp();
}

async function sendEmailVerification() {
  const response = await fetch("/api/auth/send-verification", authFetchOptions({ method: "POST" }));
  const data = await response.json();
  if (!response.ok) {
    state.authError = data.error || t("unableSignIn", "Unable to sign in.");
    render();
    return;
  }

  state.authMode = "verify";
  state.authError = "";
  state.authNotice = data.devToken
    ? `Development verification token: ${data.devToken}`
    : t("verificationPrepared", "Verification instructions have been prepared.");
  state.authDevToken = data.devToken || "";
  render();
}

async function startBillingCheckout(planId = "monthly") {
  state.billingError = "";
  state.billingNotice = "";
  render();

  const response = await fetch("/api/billing/checkout", authFetchOptions({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ planId })
  }));
  const data = await response.json();
  if (!response.ok || !data.url) {
    state.billingError = data.error || t("billingCheckoutError", "Unable to start Stripe checkout.");
    render();
    return;
  }

  window.location.assign(data.url);
}

async function openBillingPortal() {
  state.billingError = "";
  state.billingNotice = "";
  render();

  const response = await fetch("/api/billing/portal", authFetchOptions({ method: "POST" }));
  const data = await response.json();
  if (!response.ok || !data.url) {
    state.billingError = data.error || t("billingPortalError", "Unable to open billing portal.");
    render();
    return;
  }

  window.location.assign(data.url);
}

async function requestReminderPermission() {
  if (!("Notification" in window)) {
    state.reminderNotice = t("notificationsUnsupported", "Notifications are not supported in this browser.");
    render();
    return;
  }

  const permission = await Notification.requestPermission();
  const dueCount = dueVocabularyItems().filter((word) => canAccessBookSlug(word.bookSlug)).length;
  state.reminderNotice = permission === "granted"
    ? dueCount
      ? `${dueCount} ${t("wordsDueTodayReminder", "words are due today. Reminder permission is enabled.")}`
      : t("remindersEnabled", "Reminder permission enabled on this device.")
    : t("remindersNotEnabled", "Reminder permission was not enabled.");
  localStorage.setItem("madinah-reminders", state.reminderNotice);
  if (permission === "granted") {
    try {
      const registration = await navigator.serviceWorker?.ready;
      if (registration?.showNotification) {
        registration.showNotification("Madinah Arabic", {
          body: dueCount ? `${dueCount} words are due today.` : "Study reminder is ready.",
          tag: "madinah-due-vocab",
          data: { url: "/?native=1&route=vocabulary&vocabTab=listen" }
        });
      }
    } catch (error) {
      reportFrontendError(error, "notification");
    }
  }
  render();
}

async function refreshOfflineCache() {
  if (!("serviceWorker" in navigator) || !("caches" in window)) {
    state.offlineNotice = t("offlineUnsupported", "Offline cache is not supported in this browser.");
    render();
    return;
  }

  try {
    const cache = await caches.open("madinah-arabic-user-cache-v1");
    await cache.addAll([
	      "/",
	      "/index.html",
	      "/app.js?v=20260621-mobile-native-life",
	      "/learning-core.js?v=20260621-mobile-native-life",
	      "/styles.css?v=20260621-mobile-native-life",
	      "/api/bootstrap"
	    ]);
    state.offlineNotice = t("offlineReady", "Offline cache refreshed for core lessons and vocabulary.");
    localStorage.setItem(userScopedLocalKey("offline-ready"), todayKey());
  } catch {
    state.offlineNotice = t("offlineRefreshFailed", "Offline cache could not be refreshed right now.");
  }
  render();
}

async function loadAdminContent() {
  if (state.adminLoading) return;
  state.adminLoading = true;
  state.adminError = "";
  render();

  const response = await fetch("/api/admin/content", authFetchOptions());
  const data = await response.json();
  state.adminLoading = false;

  if (!response.ok) {
    state.adminError = data.error || t("adminLoadError", "Unable to load admin content.");
    render();
    return;
  }

  state.adminContent = data;
  render();
}

async function saveAdminContent(form) {
  const formData = new FormData(form);
  const collection = formData.get("collection");
  const id = formData.get("id");
  const patch = {};

  for (const [key, value] of formData.entries()) {
    if (["collection", "id"].includes(key)) continue;
    if (key.endsWith("Json")) {
      const field = key.replace(/Json$/, "");
      try {
        patch[field] = JSON.parse(String(value || "[]"));
      } catch {
        state.adminError = `${field} must be valid JSON.`;
        render();
        return;
      }
      continue;
    }
    if (key.endsWith("Lines")) {
      const field = key.replace(/Lines$/, "");
      patch[field] = String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      continue;
    }
    patch[key] = value;
  }

  const response = await fetch("/api/admin/content", authFetchOptions({
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ collection, id, patch })
  }));
  const data = await response.json();

  if (!response.ok) {
    state.adminError = data.error || t("adminSaveError", "Unable to save content.");
    render();
    return;
  }

  const items = state.adminContent?.[collection] || [];
  const index = items.findIndex((item) => item.id === id);
  if (index >= 0) items[index] = data.item;
  state.adminStatus = `${collection} ${id} saved.`;
  state.adminError = "";
  render();
}

async function importAdminContent(form) {
  const formData = new FormData(form);
  const collection = formData.get("collection");
  let items = [];
  state.adminImportStatus = "";
  state.adminImportError = "";

  try {
    const parsed = JSON.parse(String(formData.get("items") || "[]"));
    items = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(items)) throw new Error("Paste an array of content items, or an object with an items array.");
  } catch (error) {
    state.adminImportError = error.message || "Import JSON is invalid.";
    render();
    return;
  }

  const response = await fetch("/api/admin/import", authFetchOptions({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ collection, items })
  }));
  const data = await response.json();
  if (!response.ok) {
    state.adminImportError = data.error || t("adminImportError", "Unable to import content.");
    render();
    return;
  }

  state.adminImportText = "";
  state.adminImportStatus = `${data.updated}/${data.requested} ${collection} items imported.`;
  await loadAdminContent();
}

async function submitContentReport(form) {
  const formData = new FormData(form);
  state.contentReportStatus = "";
  state.contentReportError = "";
  const payload = {
    kind: formData.get("kind"),
    itemId: formData.get("itemId"),
    lessonId: formData.get("lessonId"),
    bookSlug: formData.get("bookSlug"),
    route: state.route,
    message: formData.get("message")
  };

  const response = await fetch("/api/content/report", authFetchOptions({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  }));
  const data = await response.json();
  if (!response.ok) {
    state.contentReportError = data.error || t("reportIssueError", "Unable to send report.");
    render();
    return;
  }

  state.contentReportStatus = t("reportIssueSent", "Thanks, this content report has been sent for review.");
  form.reset();
  render();
}

function toggleBookmark(type, id) {
  if (!isAuthenticated()) return;
  saveProgress(bookmarkPatch(type, id, !isBookmarked(type, id)));
}

function markReviewWord(wordId, correct) {
  const word = byId(state.data.vocabulary, wordId);
  if (!word) return;
  const gainedXp = correct ? 8 : 0;
  markMotionXp(gainedXp);
  saveProgress({
    learnedVocabularyIds: correct ? [word.id] : [],
    vocabularyStats: { [word.id]: reviewStatsFor(word.id, correct) },
    xp: state.progress.xp + gainedXp
  });
}

function resolveMistake(id) {
  if (!progressRecord("mistakes")[id]) return;
  saveProgress(resolvedMistakePatch(id));
}

function updateReminderTime(value) {
  saveProgress({
    learningPreferences: {
      ...learningPreferences(),
      reminderTime: value
    }
  });
}

function updateOfflinePack(value) {
  saveProgress({
    learningPreferences: {
      ...learningPreferences(),
      offlinePack: value
    }
  });
}

function reportFrontendError(error, source = "window") {
  const message = error?.message || String(error || "");
  fetch("/api/client-error", authFetchOptions({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message,
      source,
      route: state.route,
      path: window.location.pathname,
      stack: error?.stack || ""
    })
  })).catch(() => {});
}

function setRoute(route) {
  state.motion.view = true;

  if (!isPublicRoute(route) && !isAuthenticated()) {
    state.route = "home";
    state.authMode = "login";
    state.authError = t("signInLearning", "Please sign in to continue learning.");
    render();
    return;
  }

  if (route === "admin" && !isAdmin()) {
    state.route = "account";
    render();
    return;
  }

  if (isHiddenLaunchRoute(route)) {
    applyLaunchRouteRedirect(route);
    render();
    return;
  }

  if (isAuthenticated() && routeRequiresPremium(route)) {
    state.route = route;
    render();
    return;
  }

  state.route = route;
  render();
}

function setLesson(id) {
  state.motion.view = true;

  if (!isAuthenticated()) {
    state.route = "home";
    state.authMode = "login";
    state.authError = t("signInLessons", "Please sign in to open lessons.");
    render();
    return;
  }

  const lesson = byId(state.data.lessons, id);
  if (!lesson) return;
  state.selectedLessonId = id;
  state.route = lesson.bookSlug;
  state.lessonTab = "learn";
  render();
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ar-SA";
  utterance.rate = Math.min(1.1, Math.max(0.55, Number(state.audioRate) || 0.82));
  window.speechSynthesis.speak(utterance);
}

function markMotionXp(amount) {
  if (amount > 0) state.motion.xpBurst = amount;
}

function hapticFeedback(success = true) {
  if ("vibrate" in navigator) navigator.vibrate(success ? 18 : [16, 24, 16]);
}

function markLessonComplete(lesson) {
  const lessonVocabulary = lesson.vocabularyIds || [];
  const alreadyComplete = state.progress.completedLessonIds.includes(lesson.id);
  const gainedXp = alreadyComplete ? 0 : 80;
  markMotionXp(gainedXp);
  if (!alreadyComplete) state.motion.celebration = `${localizedLessonTitle(lesson)} completed`;
  const xp = state.progress.xp + gainedXp;
  saveProgress({
    activeBookSlug: lesson.bookSlug,
    currentLessonId: nextLessonId(lesson.id),
    completedLessonIds: [lesson.id],
    learnedVocabularyIds: lessonVocabulary,
    weeklyGoalCompleted: Math.min(state.progress.weeklyGoalTarget, state.progress.weeklyGoalCompleted + (alreadyComplete ? 0 : 1)),
    xp
  });
}

function nextLessonId(currentId) {
  const current = byId(state.data.lessons, currentId);
  const scopedLessons = current ? lessonsForBook(current.bookSlug) : state.data.lessons;
  const index = scopedLessons.findIndex((lesson) => lesson.id === currentId);
  return scopedLessons[Math.min(index + 1, scopedLessons.length - 1)]?.id || currentId;
}

function answerExercise(exercise, answer) {
  if (!hasPremiumAccess()) return;
  if (state.exerciseFeedback[exercise.id]) return;
  const correct = answer === exercise.answer;
  state.exerciseFeedback[exercise.id] = correct ? "correct" : "incorrect";
  hapticFeedback(correct);

  const previous = state.progress.exerciseAttempts[exercise.id];
  const gainedXp = correct && previous !== "correct" ? 40 : 0;
  markMotionXp(gainedXp);
  const xp = state.progress.xp + gainedXp;
  saveProgress({
    exerciseAttempts: { [exercise.id]: correct ? "correct" : "incorrect" },
    ...(correct
      ? resolvedMistakePatch(exercise.id)
      : mistakePatch(exercise.id, {
          type: "Lesson Quiz",
          lessonId: exercise.lessonId,
          prompt: exercise.prompt,
          arabic: exercise.arabic,
          expected: exercise.answer,
          given: answer
        })),
    xp
  });
}

function answerVocabularyQuiz(lessonId, answer) {
  if (!hasPremiumAccess()) return;
  if (state.vocabularyQuizFeedback[lessonId]) return;
  const quiz = state.vocabularyQuizByLesson[lessonId];
  if (!quiz) return;

  const correct = answer === quiz.answer;
  state.vocabularyQuizFeedback[lessonId] = { status: correct ? "correct" : "incorrect", answer };
  hapticFeedback(correct);
  const mistakeId = `vocab-${quiz.wordId}`;
  const previous = state.progress.exerciseAttempts[`vocab-${lessonId}`];
  const gainedXp = correct && previous !== "correct" ? 15 : 0;
  markMotionXp(gainedXp);
  saveProgress({
    learnedVocabularyIds: correct ? [quiz.wordId] : [],
    vocabularyStats: { [quiz.wordId]: reviewStatsFor(quiz.wordId, correct) },
    exerciseAttempts: { [`vocab-${lessonId}`]: correct ? "correct" : "incorrect" },
    ...(correct
      ? resolvedMistakePatch(mistakeId)
      : mistakePatch(mistakeId, {
          type: "Vocabulary",
          lessonId,
          prompt: normalizedQuizPrompt(quiz),
          arabic: quiz.arabic,
          expected: quiz.answer,
          given: answer
        })),
    xp: state.progress.xp + gainedXp
  });
}

function retryAnswer(kind, payload = {}) {
  if (kind === "exercise") {
    delete state.exerciseFeedback[payload.exerciseId];
  }

  if (kind === "vocab-quiz") {
    delete state.vocabularyQuizFeedback[payload.lessonId];
  }

  if (kind === "vocab-tester") {
    delete state.vocabTesterFeedback[payload.questionId];
  }

  if (kind === "cumulative") {
    const lessonFeedback = state.cumulativeFeedback[payload.lessonId];
    if (lessonFeedback) delete lessonFeedback[payload.questionId];
  }

  if (kind === "morphology") {
    delete state.morphologyFeedback[`${payload.lessonId}:${payload.drillId}`];
  }

  if (kind === "sentence-builder") {
    delete state.sentenceBuilderFeedback[payload.lessonId];
    delete state.sentenceBuilderSelections[payload.lessonId];
  }

  if (kind === "checked-practice") {
    delete state.writingFeedback[payload.exerciseId];
    delete state.checkedPracticeSelections[payload.exerciseId];
  }

  state.motion.tester = true;
  render();
}

function generateNewVocabularyQuiz(lessonId) {
  if (!hasPremiumAccess()) return;
  const lesson = byId(state.data.lessons, lessonId);
  if (!lesson) return;
  const lessonVocabulary = state.data.vocabulary.filter((word) => lesson.vocabularyIds.includes(word.id));
  state.vocabularyQuizByLesson[lessonId] = createVocabularyQuiz(lesson, lessonVocabulary);
  delete state.vocabularyQuizFeedback[lessonId];
  state.motion.tester = true;
  render();
}

function getCumulativeTest(lesson) {
  if (!state.cumulativeTestByLesson[lesson.id]) {
    state.cumulativeTestByLesson[lesson.id] = window.MadinahLearningCore.createCumulativeTest({
      throughLesson: lesson,
      lessons: state.data.lessons,
      vocabulary: state.data.vocabulary,
      exercises: state.data.exercises,
      size: 5
    });
  }
  return state.cumulativeTestByLesson[lesson.id];
}

function generateCumulativeTest(lessonId) {
  if (!hasPremiumAccess()) return;
  const lesson = byId(state.data.lessons, lessonId);
  if (!lesson) return;
  state.cumulativeTestByLesson[lessonId] = window.MadinahLearningCore.createCumulativeTest({
    throughLesson: lesson,
    lessons: state.data.lessons,
    vocabulary: state.data.vocabulary,
    exercises: state.data.exercises,
    size: 5
  });
  state.cumulativeFeedback[lessonId] = {};
  state.motion.tester = true;
  render();
}

function getSentenceBuilder(lesson) {
  if (!lesson || !window.MadinahLearningCore?.createSentenceBuilder) return null;
  if (!state.sentenceBuilderByLesson[lesson.id]) {
    state.sentenceBuilderByLesson[lesson.id] = window.MadinahLearningCore.createSentenceBuilder(lesson);
  }
  return state.sentenceBuilderByLesson[lesson.id];
}

function sentenceBuilderSelection(lessonId) {
  return state.sentenceBuilderSelections[lessonId] || [];
}

function selectSentenceBuilderToken(lessonId, index) {
  if (state.sentenceBuilderFeedback[lessonId]) return;
  const lesson = byId(state.data.lessons, lessonId);
  const builder = getSentenceBuilder(lesson);
  if (!builder) return;

  const tokenIndex = Number(index);
  if (!Number.isInteger(tokenIndex) || tokenIndex < 0 || tokenIndex >= builder.tokens.length) return;

  const selected = sentenceBuilderSelection(lessonId);
  if (selected.includes(tokenIndex) || selected.length >= builder.tokens.length) return;

  state.sentenceBuilderSelections[lessonId] = [...selected, tokenIndex];
  render();
}

function removeSentenceBuilderToken(lessonId, position) {
  if (state.sentenceBuilderFeedback[lessonId]) return;
  const selected = sentenceBuilderSelection(lessonId);
  const selectedPosition = Number(position);
  if (!Number.isInteger(selectedPosition) || selectedPosition < 0 || selectedPosition >= selected.length) return;

  state.sentenceBuilderSelections[lessonId] = selected.filter((_, index) => index !== selectedPosition);
  render();
}

function resetSentenceBuilder(lessonId) {
  delete state.sentenceBuilderSelections[lessonId];
  render();
}

function stableHash(value) {
  return Array.from(String(value || "")).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function answerBuildTokens(value) {
  return String(value || "")
    .split(/\s+/)
    .map((token) => token.replace(/[ـ،.؟?!'"]/g, "").trim())
    .filter(Boolean);
}

function stableTokenBank(tokens, seed) {
  const ordered = tokens
    .map((token, index) => ({ token, index, score: stableHash(`${seed}:${index}:${token}`) }))
    .sort((a, b) => a.score - b.score || a.index - b.index);

  if (ordered.length > 1 && ordered.every((item, index) => item.index === index)) {
    return [...ordered].reverse();
  }

  return ordered;
}

function checkedPracticeUsesBuilder(card) {
  return hasArabic(card?.checked?.answer);
}

function checkedPracticeTokens(card) {
  return answerBuildTokens(card?.checked?.answer);
}

function checkedPracticeTokenBank(card) {
  return stableTokenBank(checkedPracticeTokens(card), card?.id || "");
}

function checkedPracticeSelection(cardId) {
  return state.checkedPracticeSelections[cardId] || [];
}

function findCheckedPracticeCard(cardId) {
  const lesson = getSelectedLesson();
  if (!lesson) return null;
  return getLessonExerciseCards(lesson, getLessonVocabulary(lesson)).find((card) => card.id === cardId) || null;
}

function selectCheckedPracticeToken(cardId, index) {
  if (state.writingFeedback[cardId]) return;
  const card = findCheckedPracticeCard(cardId);
  const tokens = checkedPracticeTokens(card);
  const tokenIndex = Number(index);
  if (!card || !Number.isInteger(tokenIndex) || tokenIndex < 0 || tokenIndex >= tokens.length) return;

  const selected = checkedPracticeSelection(cardId);
  if (selected.includes(tokenIndex) || selected.length >= tokens.length) return;

  state.checkedPracticeSelections[cardId] = [...selected, tokenIndex];
  render();
}

function removeCheckedPracticeToken(cardId, position) {
  if (state.writingFeedback[cardId]) return;
  const selected = checkedPracticeSelection(cardId);
  const selectedPosition = Number(position);
  if (!Number.isInteger(selectedPosition) || selectedPosition < 0 || selectedPosition >= selected.length) return;

  state.checkedPracticeSelections[cardId] = selected.filter((_, index) => index !== selectedPosition);
  render();
}

function resetCheckedPractice(cardId) {
  delete state.checkedPracticeSelections[cardId];
  render();
}

function generateVocabTester() {
  if (!hasPremiumAccess()) {
    state.vocabTesterFilters.bookSlugs = state.vocabTesterFilters.bookSlugs.filter((slug) => canAccessTesterBook(slug));
    state.vocabTesterFilters.focus = state.vocabTesterFilters.focus.filter((focus) => canAccessTesterFocus(focus));
  }
  state.vocabTester = createVocabTester(3);
  state.vocabTesterActiveIndex = 0;
  state.vocabTesterFeedback = {};
  state.motion.tester = true;
  render();
}

function resetVocabTester() {
  state.vocabTester = null;
  state.vocabTesterActiveIndex = 0;
  state.vocabTesterFeedback = {};
}

function setVocabularyBook(slug) {
  const book = getVocabularyBookOptions().find((item) => item.slug === slug);
  if (!book || book.status !== "available" || !canAccessBookSlug(slug)) return;

  state.selectedVocabularyBookSlug = slug;
  state.vocabularyPage = 1;
  state.vocabTesterFilters.bookSlugs = [slug];
  state.vocabTesterFilters.lessonKey = "all";
  resetVocabTester();
  render();
}

function toggleVocabTesterBook(slug) {
  const book = getVocabularyBookOptions().find((item) => item.slug === slug);
  if (!book || book.status !== "available" || !book.wordCount || !canAccessTesterBook(slug)) return;

  const selected = new Set(state.vocabTesterFilters.bookSlugs);
  if (selected.has(slug) && selected.size > 1) {
    selected.delete(slug);
  } else {
    selected.add(slug);
  }

  state.vocabTesterFilters.bookSlugs = Array.from(selected);
  state.vocabTesterFilters.lessonKey = "all";
  resetVocabTester();
  render();
}

function toggleVocabTesterFocus(focus) {
  if (!canAccessTesterFocus(focus)) return;

  if (focus === "all") {
    state.vocabTesterFilters.focus = ["all"];
  } else {
    const selected = new Set(state.vocabTesterFilters.focus.filter((item) => item !== "all"));
    if (selected.has(focus)) selected.delete(focus);
    else selected.add(focus);
    state.vocabTesterFilters.focus = selected.size ? Array.from(selected) : ["all"];
  }

  resetVocabTester();
  render();
}

function setVocabTesterLesson(lessonKey) {
  state.vocabTesterFilters.lessonKey = lessonKey;
  resetVocabTester();
  render();
}

function updateStudyPreference(key, rawValue) {
  const current = learningPreferences();
  const value = key === "dailyMinutes" ? Number(rawValue) : rawValue;
  saveProgress({
    learningPreferences: {
      ...current,
      [key]: value
    }
  });
}

function completeOnboarding() {
  saveProgress({
    learningPreferences: {
      ...learningPreferences(),
      onboardingComplete: true
    }
  });
}

function openLessonTab(lessonId, tab) {
  const lesson = byId(state.data.lessons, lessonId);
  if (!lesson) return;
  state.selectedLessonId = lesson.id;
  state.route = lesson.bookSlug;
  state.lessonTab = tab || "learn";
  state.motion.view = true;
  render();
}

function answerVocabTester(questionId, answer) {
  const question = state.vocabTester?.questions.find((item) => item.id === questionId);
  if (!question) return;
  if (state.vocabTesterFeedback[questionId]) return;

  const previous = state.progress.exerciseAttempts[`vocab-tester-${questionId}`];
  const correct = answer === question.answer;
  state.vocabTesterFeedback[questionId] = { status: correct ? "correct" : "incorrect", answer };
  hapticFeedback(correct);
  const mistakeId = `tester-${question.wordId}`;
  const gainedXp = correct && previous !== "correct" ? 10 : 0;
  markMotionXp(gainedXp);

  saveProgress({
    learnedVocabularyIds: correct ? [question.wordId] : [],
    vocabularyStats: { [question.wordId]: reviewStatsFor(question.wordId, correct) },
    exerciseAttempts: { [`vocab-tester-${questionId}`]: correct ? "correct" : "incorrect" },
    ...(correct
      ? resolvedMistakePatch(mistakeId)
      : mistakePatch(mistakeId, {
          type: t("vocabTester", "Vocab Tester"),
          lessonId: question.lessonId,
          prompt: normalizedQuizPrompt(question),
          arabic: question.arabic,
          expected: question.answer,
          given: answer
        })),
    xp: state.progress.xp + gainedXp
  });
}

function moveNativeTesterNext() {
  const total = state.vocabTester?.questions.length || 0;
  state.vocabTesterActiveIndex = Math.min(total, Number(state.vocabTesterActiveIndex || 0) + 1);
  state.motion.tester = true;
  render();
}

function answerCumulativeQuestion(lessonId, questionId, answer) {
  if (!hasPremiumAccess()) return;
  const test = state.cumulativeTestByLesson[lessonId];
  const question = test?.questions.find((item) => item.id === questionId);
  if (!question) return;
  if (state.cumulativeFeedback[lessonId]?.[questionId]) return;
  const correct = answer === question.answer;
  state.cumulativeFeedback[lessonId] = {
    ...(state.cumulativeFeedback[lessonId] || {}),
    [questionId]: { status: correct ? "correct" : "incorrect", answer }
  };
  hapticFeedback(correct);
  const mistakeId = question.wordId ? `cumulative-${question.wordId}` : `cumulative-${questionId}`;

  const previous = state.progress.exerciseAttempts[`cumulative-${questionId}`];
  const gainedXp = correct && previous !== "correct" ? 12 : 0;
  markMotionXp(gainedXp);
  saveProgress({
    learnedVocabularyIds: correct && question.wordId ? [question.wordId] : [],
    vocabularyStats: question.wordId ? { [question.wordId]: reviewStatsFor(question.wordId, correct) } : {},
    exerciseAttempts: { [`cumulative-${questionId}`]: correct ? "correct" : "incorrect" },
    ...(correct
      ? resolvedMistakePatch(mistakeId)
      : mistakePatch(mistakeId, {
          type: "Cumulative Check",
          lessonId,
          prompt: normalizedQuizPrompt(question),
          arabic: question.arabic,
          expected: question.answer,
          given: answer
        })),
    xp: state.progress.xp + gainedXp
  });
}

function answerMorphologyDrill(lessonId, drillId, answer) {
  if (!hasPremiumAccess()) return;
  const lesson = byId(state.data.lessons, lessonId);
  const drill = window.MadinahLearningCore.createMorphologyDrills(lesson).find((item) => item.id === drillId);
  if (!drill) return;
  if (state.morphologyFeedback[`${lessonId}:${drillId}`]) return;
  const correct = answer === drill.answer;
  state.morphologyFeedback[`${lessonId}:${drillId}`] = { status: correct ? "correct" : "incorrect", answer };
  hapticFeedback(correct);
  const previous = state.progress.exerciseAttempts[`morphology-${drillId}`];
  const gainedXp = correct && previous !== "correct" ? 10 : 0;
  markMotionXp(gainedXp);
  saveProgress({
    exerciseAttempts: { [`morphology-${drillId}`]: correct ? "correct" : "incorrect" },
    ...(correct
      ? resolvedMistakePatch(`morphology-${drillId}`)
      : mistakePatch(`morphology-${drillId}`, {
          type: "Morphology",
          lessonId,
          prompt: drill.prompt,
          expected: drill.answer,
          given: answer
        })),
    xp: state.progress.xp + gainedXp
  });
}

function markBookExerciseComplete(id) {
  if (!hasPremiumAccess()) return;
  const previous = state.progress.exerciseAttempts[id];
  const gainedXp = previous === "complete" ? 0 : 20;
  markMotionXp(gainedXp);
  saveProgress({
    exerciseAttempts: { [id]: "complete" },
    xp: state.progress.xp + gainedXp
  });
}

function checkBookExercise(form) {
  if (!hasPremiumAccess()) return;
  const cardId = form.dataset.bookExerciseCheck;
  const expected = form.dataset.answer || "";
  const given = new FormData(form).get("checkedAnswer") || "";
  const correct = normalizeAnswer(given) === normalizeAnswer(expected);
  state.writingFeedback[cardId] = { status: correct ? "correct" : "incorrect", expected, given };
  const lesson = getSelectedLesson();
  const mistakeId = `write-${cardId}`;

  const previous = progressRecord("writingAttempts")[mistakeId];
  const gainedXp = correct && previous !== "correct" ? 20 : 0;
  markMotionXp(gainedXp);
  saveProgress({
    exerciseAnswers: { [cardId]: correct ? "correct" : "incorrect" },
    writingAttempts: { [mistakeId]: correct ? "correct" : "incorrect" },
    ...(correct
      ? resolvedMistakePatch(mistakeId)
      : mistakePatch(mistakeId, {
          type: "Writing Practice",
          lessonId: lesson.id,
          prompt: form.dataset.prompt || "Write the answer.",
          arabic: form.dataset.arabic || "",
          expected,
          given
        })),
    xp: state.progress.xp + gainedXp
  });
}

function checkSentenceBuilder(form) {
  if (!hasPremiumAccess()) return;
  const lessonId = form.dataset.sentenceBuilder;
  const lesson = byId(state.data.lessons, lessonId);
  const builder = getSentenceBuilder(lesson);
  if (!builder) return;

  const given = new FormData(form).get("sentenceAnswer") || "";
  const correct = normalizeAnswer(given) === normalizeAnswer(builder.answer);
  state.sentenceBuilderFeedback[lessonId] = { status: correct ? "correct" : "incorrect", expected: builder.answer, given };
  hapticFeedback(correct);

  const previous = state.progress.exerciseAttempts[`sentence-${lessonId}`];
  const gainedXp = correct && previous !== "correct" ? 15 : 0;
  markMotionXp(gainedXp);
  saveProgress({
    exerciseAttempts: { [`sentence-${lessonId}`]: correct ? "correct" : "incorrect" },
    ...(correct
      ? resolvedMistakePatch(`sentence-${lessonId}`)
      : mistakePatch(`sentence-${lessonId}`, {
          type: "Sentence Builder",
          lessonId,
          prompt: builder.prompt,
          arabic: builder.answer,
          expected: builder.answer,
          given
        })),
    xp: state.progress.xp + gainedXp
  });
}

function render() {
  state.viewportMode = currentViewportMode();
  const nativeApp = isNativeApp();
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.appMode = nativeApp ? "native" : "web";
  document.documentElement.lang = isBengali() ? "bn" : "en";
  document.documentElement.style.setProperty("--arabic-scale", String(Math.min(1.2, Math.max(0.9, state.arabicFontScale))));
  const app = document.getElementById("app");
  const viewClass = state.motion.view ? "view view-enter" : "view";
  app.className = isAuthenticated() ? `app-shell${nativeApp ? " native-app-shell" : ""}` : "public-shell";
  app.innerHTML = isAuthenticated()
    ? `
      ${renderMobileAppbar()}
      ${renderSidebar()}
      <div class="main-shell">
        ${renderTopbar()}
        <main class="${viewClass}">${renderGlobalNotices()}${renderRoute()}</main>
      </div>
      ${renderMobileBottomNav()}
      ${renderMobileStickyAction()}
      ${renderCelebrationToast()}
      ${renderAuthModal()}
    `
    : `
      ${renderPublicHeader()}
      <main class="public-view ${state.motion.view ? "view-enter" : ""}">${renderGlobalNotices()}${renderPublicRoute()}</main>
      ${renderAuthModal()}
    `;
  state.motion.view = false;
  state.motion.tester = false;
  state.motion.xpBurst = null;
  state.motion.celebration = "";
}

function renderGlobalNotices() {
  return `
    ${state.contentReportStatus ? `<div class="global-notice success">${icon("check")}<span>${escapeHtml(state.contentReportStatus)}</span></div>` : ""}
    ${state.contentReportError ? `<div class="global-notice error">${icon("x")}<span>${escapeHtml(state.contentReportError)}</span></div>` : ""}
  `;
}

function renderPublicHeader() {
  return `
    <header class="public-header">
      <button class="public-brand" type="button" data-route="home" aria-label="Madinah Arabic home">
        <span class="brand-mark" aria-hidden="true"></span>
        <span>
          <strong>Madinah Arabic</strong>
          <small>${t("guidedArabicPlatform", "Guided Arabic learning")}</small>
        </span>
      </button>
      <nav class="public-nav" aria-label="${t("publicNavigation", "Public navigation")}">
        ${publicRoutes.map((route) => `
          <button class="${state.route === route.id ? "active" : ""}" type="button" data-route="${route.id}">
            ${escapeHtml(publicRouteLabel(route))}
          </button>
        `).join("")}
      </nav>
      <div class="public-actions">
        <button class="theme-toggle" type="button" data-theme-toggle aria-label="${t("toggleTheme", "Toggle theme")}">
          ${icon(state.theme === "dark" ? "sun" : "moon")}
          <span>${state.theme === "dark" ? t("light", "Light") : t("dark", "Dark")}</span>
        </button>
        <button class="ghost-button compact-button" type="button" data-auth-mode="login">${t("signIn", "Sign in")}</button>
        <button class="primary-button compact-button" type="button" data-auth-mode="register">${t("createAccount", "Create account")}</button>
      </div>
    </header>
  `;
}

function renderCelebrationToast() {
  if (!state.motion.celebration) return "";
  return `
    <div class="celebration-toast" role="status" aria-live="polite">
      ${icon("check")}
      <span>${escapeHtml(state.motion.celebration)}</span>
    </div>
  `;
}

function mobileLearningRoute() {
  if (isBookRoute(state.route) && canAccessBookSlug(state.route)) return state.route;
  if (state.progress?.activeBookSlug && canAccessBookSlug(state.progress.activeBookSlug)) return state.progress.activeBookSlug;
  return "book-1";
}

function renderMobileAppbar() {
  if (isNativeApp()) return renderNativeAppbar();

  const initial = state.user?.displayName?.slice(0, 1).toUpperCase() || "M";
  const moreRoutes = [
    { id: "books", label: t("books", "Books"), icon: "book" },
    { id: "subscription", label: t("subscription", "Subscription"), icon: "spark" },
    ...(isAdmin() ? [{ id: "admin", label: t("admin", "Admin"), icon: "target" }] : [])
  ];

  return `
    <header class="mobile-appbar">
      <div class="mobile-appbar-row">
        <details class="mobile-more-menu">
          <summary aria-label="${t("openNavigation", "Open navigation")}">${icon("menu")}</summary>
          <div class="mobile-more-panel">
            ${moreRoutes.map((route) => `
              <button type="button" data-route="${route.id}">
                ${icon(route.icon)}
                <span>${escapeHtml(route.label)}</span>
              </button>
            `).join("")}
            <button type="button" data-theme-toggle>
              ${icon(state.theme === "dark" ? "sun" : "moon")}
              <span>${state.theme === "dark" ? t("light", "Light") : t("dark", "Dark")}</span>
            </button>
          </div>
        </details>
        <div class="mobile-title">
          <p class="eyebrow">${t("today", "Today")}</p>
          <strong>${routeTitle()}</strong>
        </div>
        <span class="mobile-streak">${icon("flame")} ${state.progress.dailyStreakDays}</span>
        <button class="avatar mobile-avatar ${state.route === "account" ? "active" : ""}" type="button" data-route="account" aria-label="${t("openAccountDetails", "Open account details")}">${escapeHtml(initial)}</button>
      </div>
      <label class="search mobile-search">
        ${icon("search")}
        <input value="${escapeHtml(state.search)}" placeholder="${t("searchPlaceholder", "Search lessons or words")}" aria-label="${t("searchAria", "Search lessons or words")}" data-search />
      </label>
    </header>
  `;
}

function renderNativeAppbar() {
  const initial = state.user?.displayName?.slice(0, 1).toUpperCase() || "M";
  const dueCount = dueVocabularyItems().filter((word) => canAccessBookSlug(word.bookSlug)).length;
  const dueLabel = dueCount > 99 ? "99+" : String(dueCount);

  return `
    <header class="mobile-appbar native-appbar">
      <div class="mobile-appbar-row native-appbar-row">
        <div class="mobile-title">
          <p class="eyebrow">${t("mobileStudyCompanion", "Study companion")}</p>
          <strong>${state.route === "home" ? t("todaysStudyQueue", "Today's Study") : routeTitle()}</strong>
        </div>
        <span class="mobile-streak native-review-pill">${icon("target")} ${dueLabel}</span>
        <span class="mobile-streak">${icon("flame")} ${state.progress.dailyStreakDays}</span>
        <button class="avatar mobile-avatar ${state.route === "account" ? "active" : ""}" type="button" data-route="account" aria-label="${t("openAccountDetails", "Open account details")}">${escapeHtml(initial)}</button>
      </div>
    </header>
  `;
}

function renderMobileBottomNav() {
  if (isNativeApp()) return renderNativeBottomNav();

  const items = [
    { id: "home", route: "home", label: t("home", "Home"), icon: "home", active: state.route === "home" },
    { id: "lessons", route: mobileLearningRoute(), label: t("lessons", "Lessons"), icon: "book", active: isBookRoute(state.route) },
    { id: "review", route: "review", label: t("review", "Review"), icon: "target", active: state.route === "review" },
    { id: "vocabulary", route: "vocabulary", label: t("vocabShort", "Vocab"), icon: "words", active: state.route === "vocabulary" },
    { id: "account", route: "account", label: t("account", "Account"), icon: "user", active: state.route === "account" }
  ];

  return `
    <nav class="mobile-bottom-nav" aria-label="${t("primaryNavigation", "Primary navigation")}">
      ${items.map((item) => `
        <button class="${item.active ? "active" : ""}" type="button" data-route="${item.route}">
          ${icon(item.icon)}
          <span>${escapeHtml(item.label)}</span>
        </button>
      `).join("")}
    </nav>
  `;
}

function renderNativeBottomNav() {
  const items = [
    { id: "today", route: "home", label: t("today", "Today"), icon: "home", active: state.route === "home" },
    { id: "review", route: "review", label: t("review", "Review"), icon: "target", active: state.route === "review" },
    { id: "flashcards", route: "vocabulary", label: t("flashcards", "Cards"), icon: "words", active: state.route === "vocabulary" },
    { id: "lesson", route: mobileLearningRoute(), label: t("lesson", "Lesson"), icon: "book", active: isBookRoute(state.route) },
    { id: "account", route: "account", label: t("account", "Account"), icon: "user", active: state.route === "account" }
  ];

  return `
    <nav class="mobile-bottom-nav native-bottom-nav" aria-label="${t("primaryNavigation", "Primary navigation")}">
      ${items.map((item) => `
        <button class="${item.active ? "active" : ""}" type="button" data-route="${item.route}">
          ${icon(item.icon)}
          <span>${escapeHtml(item.label)}</span>
        </button>
      `).join("")}
    </nav>
  `;
}

function renderMobileStickyAction() {
  if (isNativeApp()) return "";
  if (!isAuthenticated()) return "";
  const lesson = getSelectedLesson();
  const currentLesson = getCurrentLesson();
  let label = t("continue", "Continue");
  let attrs = `data-lesson="${escapeHtml(currentLesson.id)}"`;
  let secondary = `${escapeHtml(localizedBookTitle(getBook(currentLesson.bookSlug)))} · ${t("lesson", "Lesson")} ${escapeHtml(currentLesson.number)}`;

  if (isBookRoute(state.route) && lesson) {
    const nextTabByTab = {
      learn: hasPremiumAccess() ? "book-exercises" : "",
      "book-exercises": "quiz",
      quiz: "review",
      review: ""
    };
    const nextTab = nextTabByTab[state.lessonTab];
    if (nextTab) {
      label = state.lessonTab === "learn" ? t("practiceNext", "Practice next") : state.lessonTab === "book-exercises" ? t("startQuiz", "Start quiz") : t("reviewLesson", "Review lesson");
      attrs = `data-open-lesson="${escapeHtml(lesson.id)}" data-open-lesson-tab="${escapeHtml(nextTab)}"`;
    } else {
      label = state.progress.completedLessonIds.includes(lesson.id) ? t("nextLesson", "Next lesson") : t("markComplete", "Mark complete");
      attrs = state.progress.completedLessonIds.includes(lesson.id)
        ? `data-lesson="${escapeHtml(nextLessonId(lesson.id))}"`
        : `data-complete="${escapeHtml(lesson.id)}"`;
    }
    secondary = `${t("lesson", "Lesson")} ${escapeHtml(lesson.number)} · ${lessonMastery(lesson)}% ${t("mastery", "mastery")}`;
  } else if (state.route === "vocabulary") {
    label = state.vocabularyTab === "tester" ? t("generateNewTest", "Generate new test") : t("openVocabTester", "Open tester");
    attrs = state.vocabularyTab === "tester" ? "data-vocab-tester-new" : 'data-vocabulary-tab="tester"';
    secondary = `${getVocabTesterPool().length} ${t("selectedWords", "selected words")}`;
  } else if (state.route === "exercises" || state.route === "review") {
    label = t("continueLesson", "Continue lesson");
    attrs = `data-lesson="${escapeHtml(currentLesson.id)}"`;
    secondary = `${mistakeItems().length} ${t("openMistakes", "open mistakes")}`;
  } else if (state.route === "account") {
    label = state.user.billingPortalAvailable ? t("manageBilling", "Manage billing") : t("continueLearning", "Continue learning");
    attrs = state.user.billingPortalAvailable ? "data-billing-portal" : `data-lesson="${escapeHtml(currentLesson.id)}"`;
    secondary = escapeHtml(localizedPlanLabel());
  }

  return `
    <section class="mobile-sticky-action" aria-label="${t("nextAction", "Next action")}">
      <div>
        <span>${secondary}</span>
        <strong>${escapeHtml(label)}</strong>
      </div>
      <button class="primary-button" type="button" ${attrs}>
        ${escapeHtml(label)} ${icon("arrow")}
      </button>
    </section>
  `;
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <button class="mobile-menu" type="button" aria-label="${t("openNavigation", "Open navigation")}">${icon("menu")}</button>
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <div>
          <p class="brand-title">Madinah Arabic</p>
          <p class="brand-subtitle">${t("booksActive", "Books 1-3 active")}</p>
        </div>
      </div>
      <nav class="nav" aria-label="${t("primaryNavigation", "Primary navigation")}">
        ${routes
          .filter((route) => route.id !== "admin" || isAdmin())
          .map((route) => {
            const locked = routeIsLocked(route);
            return `
              <button class="nav-item ${state.route === route.id ? "active" : ""} ${locked ? "locked" : ""}" type="button" data-route="${route.id}">
                <span class="nav-icon">${icon(locked ? "lock" : route.icon)}</span>
                <span>${escapeHtml(routeLabel(route))}</span>
                ${locked ? `<span class="soon">${routeRequiresPremium(route.id) ? t("lockedPremium", "Premium") : t("comingSoon", "Coming Soon")}</span>` : ""}
              </button>
            `;
          })
          .join("")}
      </nav>
      <div class="sidebar-card">
        ${isAuthenticated() ? `
          <p>${t("nextLesson", "Next lesson")}</p>
          <strong>${t("lesson", "Lesson")} ${escapeHtml(getCurrentLesson().number)}</strong>
          <button class="ghost-button compact-button sidebar-signin" type="button" data-lesson="${escapeHtml(getCurrentLesson().id)}">${t("openLesson", "Open lesson")}</button>
        ` : `
          <p>${t("privateProgress", "Private progress")}</p>
          <strong>${t("signIn", "Sign in")}</strong>
          <button class="ghost-button compact-button sidebar-signin" type="button" data-auth-mode="login">${t("openAccount", "Open account")}</button>
        `}
      </div>
    </aside>
  `;
}

function renderTopbar() {
  return `
    <header class="topbar">
      <div class="greeting">
        <p class="eyebrow">${t("today", "Today")}</p>
        <h1>${routeTitle()}</h1>
      </div>
      <label class="search">
        ${icon("search")}
        <input value="${escapeHtml(state.search)}" placeholder="${t("searchPlaceholder", "Search lessons or words")}" aria-label="${t("searchAria", "Search lessons or words")}" data-search />
      </label>
      ${isAuthenticated() ? `
        <div class="metric">
          ${icon("flame")}
          <div><strong>${state.progress.dailyStreakDays} ${t("days", "days")}</strong><span>${t("streak", "Streak")}</span></div>
        </div>
        <div class="metric">
          ${icon("spark")}
          <div><strong>${state.progress.xp.toLocaleString()} XP</strong><span>${t("totalPoints", "Total points")}</span></div>
          ${state.motion.xpBurst ? `<span class="xp-burst" aria-hidden="true">+${state.motion.xpBurst} XP</span>` : ""}
        </div>
      ` : `
        <div class="metric">
          ${icon("book")}
          <div><strong>${state.data.books.filter((book) => book.status === "available").length} ${t("books", "books")}</strong><span>${t("available", "Available")}</span></div>
        </div>
        <div class="metric">
          ${icon("words")}
          <div><strong>${state.data.vocabulary.length} ${t("words", "words")}</strong><span>${t("vocabulary", "Vocabulary")}</span></div>
        </div>
      `}
      <button class="theme-toggle" type="button" data-theme-toggle aria-label="${t("toggleTheme", "Toggle theme")}">
        ${icon(state.theme === "dark" ? "sun" : "moon")}
        <span>${state.theme === "dark" ? t("light", "Light") : t("dark", "Dark")}</span>
      </button>
      ${state.user && !state.user.isDemo ? `
        <button class="avatar auth-avatar ${state.route === "account" ? "active" : ""}" type="button" data-route="account" aria-label="${t("openAccountDetails", "Open account details")}" title="${t("accountDetails", "Account details")}">${escapeHtml(state.user.displayName.slice(0, 1).toUpperCase())}</button>
      ` : `
        <button class="ghost-button compact-button" type="button" data-auth-mode="login">${t("signIn", "Sign in")}</button>
      `}
    </header>
  `;
}

function renderAuthModal() {
  if (!state.authMode) return "";
  const register = state.authMode === "register";
  const forgot = state.authMode === "forgot";
  const reset = state.authMode === "reset";
  const verify = state.authMode === "verify";
  const title = register
    ? t("createAccount", "Create Account")
    : forgot
      ? t("forgotPassword", "Forgot Password")
      : reset
        ? t("resetPassword", "Reset Password")
        : verify
          ? t("verifyEmail", "Verify Email")
          : t("signInTitle", "Sign In");
  return `
    <div class="modal-backdrop">
      <form class="auth-card" data-auth-form>
        <div class="card-heading">
          <div>
            <p class="section-label">${t("accountLabel", "Account")}</p>
            <h2>${title}</h2>
          </div>
          <button class="icon-button" type="button" data-auth-close aria-label="${t("close", "Close")}">${icon("x")}</button>
        </div>
        ${state.authError ? `<div class="feedback incorrect">${icon("x")}<span>${escapeHtml(state.authError)}</span></div>` : ""}
        ${state.authNotice ? `<div class="feedback correct">${icon("check")}<span>${escapeHtml(state.authNotice)}</span></div>` : ""}
        ${!forgot && !reset && !verify ? renderOAuthButtons() : ""}
        ${register ? `
          <label class="form-field">
            <span>${t("name", "Name")}</span>
            <input name="displayName" autocomplete="name" required />
          </label>
        ` : ""}
        ${reset || verify ? `
          <label class="form-field">
            <span>${t("token", "Token")}</span>
            <input name="token" value="${escapeHtml(state.authDevToken)}" autocomplete="one-time-code" required />
          </label>
        ` : `
          <label class="form-field">
            <span>${t("email", "Email")}</span>
            <input name="email" type="email" autocomplete="email" required />
          </label>
        `}
        ${verify || forgot ? "" : `
          <label class="form-field">
            <span>${t("password", "Password")}</span>
            <input name="password" type="password" autocomplete="${register || reset ? "new-password" : "current-password"}" required />
          </label>
        `}
        <button class="primary-button" type="submit">
          ${register ? t("createAccount", "Create account") : forgot ? t("sendReset", "Send reset") : reset ? t("resetPassword", "Reset password") : verify ? t("verifyEmail", "Verify email") : t("signIn", "Sign in")}
          ${icon("arrow")}
        </button>
        ${!forgot && !reset && !verify ? `
          <button class="ghost-button" type="button" data-auth-mode="${register ? "login" : "register"}">
            ${register ? t("alreadyAccount", "I already have an account") : t("createNewAccount", "Create a new account")}
          </button>
        ` : ""}
        ${!register && !forgot && !reset && !verify ? `<button class="ghost-button" type="button" data-auth-mode="forgot">${t("forgotPassword", "Forgot password?")}</button>` : ""}
        ${forgot || reset || verify ? `<button class="ghost-button" type="button" data-auth-mode="login">${t("backToSignIn", "Back to sign in")}</button>` : ""}
      </form>
    </div>
  `;
}

function renderOAuthButtons() {
  const providers = state.data?.authProviders || [];
  if (!providers.length) return "";
  const labels = {
    google: "Google",
    microsoft: "Microsoft",
    apple: "Apple"
  };

  return `
    <section class="oauth-panel" aria-label="${t("socialSignIn", "Social sign in")}">
      <div class="oauth-divider"><span>${t("continueWith", "Continue with")}</span></div>
      <div class="oauth-grid">
        ${providers.map((provider) => `
          <a class="oauth-button ${provider}" href="/api/auth/${escapeHtml(provider)}">
            ${renderOAuthIcon(provider)}
            <span>${escapeHtml(labels[provider] || provider.slice(0, 1).toUpperCase() + provider.slice(1))}</span>
          </a>
        `).join("")}
      </div>
    </section>
  `;
}

function renderOAuthIcon(provider) {
  const icons = {
    google: `
      <svg class="oauth-icon google-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
      </svg>
    `,
    microsoft: `
      <svg class="oauth-icon microsoft-icon" aria-hidden="true" focusable="false" viewBox="0 0 23 23">
        <rect width="10.5" height="10.5" fill="#F25022"/>
        <rect x="12.5" width="10.5" height="10.5" fill="#7FBA00"/>
        <rect y="12.5" width="10.5" height="10.5" fill="#00A4EF"/>
        <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900"/>
      </svg>
    `
  };

  return icons[provider] || "";
}

function routeTitle() {
  if (state.route === "home") return "Madinah Arabic";
  if (isBookRoute(state.route)) return localizedBookTitle(getBook(state.route));
  const route = routes.find((item) => item.id === state.route);
  if (route) return routeLabel(route);
  const publicRoute = publicRoutes.find((item) => item.id === state.route);
  return publicRoute ? publicRouteLabel(publicRoute) : "Madinah Arabic";
}

function renderRoute() {
  if (state.route !== "home" && !isAuthenticated()) return renderSignInGate();
  if (isAuthenticated() && routeRequiresPremium(state.route)) {
    const feature = isBookRoute(state.route) ? "book" : ["review", "progress"].includes(state.route) ? "progress" : "default";
    return renderUpgradeGate(feature);
  }
  if (state.route === "about") return renderAboutPage();
  if (state.route === "curriculum") return renderCurriculumPage();
  if (state.route === "subscription") return renderSubscriptionPage();
  if (state.route === "books") return renderBooksPage();
  if (isBookRoute(state.route)) {
    const book = getBook(state.route);
    return book?.status === "available" ? renderBook(state.route) : renderLockedBook();
  }
  if (state.route === "vocabulary") return renderVocabularyPage();
  if (state.route === "grammar") return renderGrammarPage();
  if (state.route === "exercises") return renderExercisesPage();
  if (state.route === "review") return renderReviewPage();
  if (state.route === "progress") return renderProgressPage();
  if (state.route === "admin") return isAdmin() ? renderAdminPage() : renderUpgradeGate("default");
  if (state.route === "account") return renderAccountPage();
  return renderHome();
}

function renderPublicRoute() {
  if (state.route === "about") return renderAboutPage();
  if (state.route === "curriculum") return renderCurriculumPage();
  if (state.route === "subscription") return renderSubscriptionPage();
  if (state.route === "home") return renderHome();
  return renderSignInGate();
}

function renderHome() {
  if (isAuthenticated()) return renderAuthenticatedHome();

  return `
    <section class="landing-page">
      <div class="landing-hero card">
        <div class="landing-copy">
          <p class="section-label">${t("landingLabel", "Madinah Arabic Books 1-3")}</p>
          <h2>${t("landingTitle", "Learn Arabic through a guided, premium study workspace.")}</h2>
          <p class="landing-text">${t("landingText", "Structured lessons, vocabulary review, checked exercises, writing practice, quizzes, and progress tracking for Madinah Arabic Books 1, 2, and 3.")}</p>
          <div class="landing-actions">
            ${isAuthenticated()
              ? `<button class="primary-button" type="button" data-route="${getCurrentLesson()?.bookSlug || "book-1"}">${t("continueLearning", "Continue learning")} ${icon("arrow")}</button>`
              : `<button class="primary-button" type="button" data-auth-mode="login">${t("signInToStart", "Sign in to start")} ${icon("arrow")}</button>`}
            <button class="ghost-button" type="button" data-auth-mode="register">${t("createAccount", "Create account")}</button>
          </div>
        </div>
        <div class="landing-preview" aria-label="${t("coursePreview", "Course preview")}">
          <div class="preview-panel">
            <span class="pill">${isBengali() ? "বই ১-৩" : "Books 1-3"}</span>
            <button class="arabic-line preview-arabic" type="button" data-speak="مَا هٰذَا؟ هٰذَا كِتَابٌ." lang="ar">مَا هٰذَا؟ هٰذَا كِتَابٌ.</button>
            <p class="translation">${escapeHtml(localizedText("What is this? This is a book."))}</p>
            <div class="bar"><span style="width:68%"></span></div>
          </div>
          <div class="preview-grid">
            <span>${icon("words")} ${state.data.vocabulary.length} ${t("words", "words")}</span>
            <span>${icon("exercises")} ${t("checkedPractice", "Checked practice")}</span>
            <span>${icon("target")} ${t("mistakeReview", "Mistake review")}</span>
            <span>${icon("spark")} ${t("vocabTester", "Vocab tester")}</span>
          </div>
        </div>
      </div>
      <div class="landing-feature-grid">
        ${[
          [t("guidedPath", "Guided Path"), t("guidedPathText", "Learn, practice, quiz, and review inside every lesson.")],
          [t("spacedVocabulary", "Spaced Vocabulary"), t("spacedVocabularyText", "Review words at the right time with progress-aware scheduling.")],
          [t("writingPractice", "Writing Practice"), t("writingPracticeText", "Type answers, check them, and send mistakes into review.")],
          [t("fullVocabTester", "Full Vocab Tester"), t("fullVocabTesterText", "Generate fresh Arabic-English tests from the complete vocabulary bank.")]
        ].map(([title, body]) => `
          <article class="card landing-feature">
            <span class="quick-icon">${icon("check")}</span>
            <h3>${title}</h3>
            <p>${body}</p>
          </article>
        `).join("")}
      </div>
      ${renderMobileComingSoonSection()}
    </section>
  `;
}

function renderMobileComingSoonSection() {
  return `
    <section class="card mobile-coming-soon">
      <div class="mobile-coming-copy">
        <p class="section-label">${t("mobileAppComingSoon", "Mobile app coming soon")}</p>
        <h2>${t("mobileSoonTitle", "The same study workspace, shaped for your phone.")}</h2>
        <p>${t("mobileSoonText", "Premium lifetime members will receive free access and early access to the mobile app as it rolls out.")}</p>
        <div class="mobile-coming-pills">
          <span class="pill">${t("earlyAccess", "Early access")}</span>
          <span class="pill">${t("offlineReady", "Offline-ready study")}</span>
          <span class="pill">${t("phoneFirstReview", "Phone-first review")}</span>
        </div>
      </div>
      <div class="mobile-preview-row" aria-label="${t("mobilePreviewSnippets", "Mobile app preview snippets")}">
        ${renderMobilePreviewPhone("lesson")}
        ${renderMobilePreviewPhone("vocabulary")}
        ${renderMobilePreviewPhone("tester")}
      </div>
    </section>
  `;
}

function renderMobilePreviewPhone(kind) {
  const previews = {
    lesson: {
      label: t("lesson", "Lesson"),
      title: "Book 1 · Lesson 4",
      body: "هُوَ فِي الْمَسْجِدِ.",
      meta: t("tapToReveal", "Tap to reveal")
    },
    vocabulary: {
      label: t("vocabulary", "Vocabulary"),
      title: "مَسْجِدٌ",
      body: "mosque",
      meta: "423 words"
    },
    tester: {
      label: t("vocabTester", "Vocab Tester"),
      title: "3 questions",
      body: "مَا هٰذَا؟",
      meta: t("regenerate", "Regenerate")
    }
  };
  const item = previews[kind];

  return `
    <article class="mobile-preview-phone ${kind}">
      <span class="phone-speaker"></span>
      <div class="phone-appbar">
        <span>${escapeHtml(item.label)}</span>
        <span class="phone-dot"></span>
      </div>
      <div class="phone-card-mini">
        <small>${escapeHtml(item.title)}</small>
        <strong lang="${/[\u0600-\u06ff]/.test(item.body) || /[\u0600-\u06ff]/.test(item.title) ? "ar" : "en"}">${escapeHtml(item.body)}</strong>
        <span>${escapeHtml(item.meta)}</span>
      </div>
      <div class="phone-nav-mini">
        <i></i><i></i><i></i>
      </div>
    </article>
  `;
}

function renderAuthenticatedHome() {
  const currentLesson = getCurrentLesson();
  if (isNativeApp()) return renderNativeTodayApp(currentLesson);

  return `
    <section class="dashboard-grid learning-dashboard">
      <div class="primary-stack">
        ${renderMobileTodayScreen(currentLesson)}
        ${renderOnboardingPanel()}
        ${renderContinueCard(currentLesson)}
        ${renderQuickAccess()}
        ${renderDailyMissionPanel(currentLesson)}
        ${renderTodayReviewPanel(currentLesson)}
        ${renderLessonMapCard(currentLesson.bookSlug, currentLesson)}
      </div>
      <aside class="side-stack">
        ${renderStudyProfileCard()}
      </aside>
    </section>
  `;
}

function nativePriorityWords(limit = 8, bookSlug = null) {
  const due = dueVocabularyItems().filter((word) => canAccessBookSlug(word.bookSlug) && (!bookSlug || word.bookSlug === bookSlug));
  const weak = weakVocabularyItems(limit).filter((word) => canAccessBookSlug(word.bookSlug) && (!bookSlug || word.bookSlug === bookSlug));
  const bookmarkedIds = bookmarkRecord().vocabulary || [];
  const bookmarked = bookmarkedIds
    .map((id) => byId(state.data.vocabulary, id))
    .filter((word) => word && canAccessBookSlug(word.bookSlug) && (!bookSlug || word.bookSlug === bookSlug));
  const fallback = state.data.vocabulary.filter((word) => canAccessBookSlug(word.bookSlug) && (!bookSlug || word.bookSlug === bookSlug));

  return uniqueValues([...weak, ...due, ...bookmarked, ...fallback].map((word) => word.id))
    .map((id) => byId(state.data.vocabulary, id))
    .filter(Boolean)
    .slice(0, limit);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function userScopedLocalKey(key) {
  return `madinah-${key}-${state.user?.userId || "guest"}`;
}

function nativeDailySessionCompletedToday() {
  return localStorage.getItem(userScopedLocalKey("native-daily-session")) === todayKey();
}

function nativeStreakRecoveryAvailable() {
  return isNativeApp()
    && Number(state.progress?.dailyStreakDays || 0) === 0
    && localStorage.getItem(userScopedLocalKey("streak-recovery")) !== todayKey();
}

function nativeOfflineStatusText() {
  if (state.offlineNotice || localStorage.getItem(userScopedLocalKey("offline-ready"))) {
    return t("availableOffline", "Available offline");
  }
  const pack = learningPreferences().offlinePack || "recent";
  return pack === "all"
    ? t("readyForFullDownload", "Ready for full download")
    : t("readyForRecentDownload", "Ready for recent lessons");
}

function audioModeLabel() {
  return Number(state.audioRate) < 0.75 ? t("slowAudio", "Slow audio") : t("normalAudio", "Normal audio");
}

function nativeDifficultWords(limit = 8, bookSlug = null) {
  const bookmarkedIds = bookmarkRecord().vocabulary || [];
  const bookmarked = bookmarkedIds
    .map((id) => byId(state.data.vocabulary, id))
    .filter((word) => word && canAccessBookSlug(word.bookSlug) && (!bookSlug || word.bookSlug === bookSlug));
  const weak = weakVocabularyItems(limit * 2).filter((word) => canAccessBookSlug(word.bookSlug) && (!bookSlug || word.bookSlug === bookSlug));
  const due = dueVocabularyItems().filter((word) => canAccessBookSlug(word.bookSlug) && (!bookSlug || word.bookSlug === bookSlug));

  return uniqueValues([...bookmarked, ...weak, ...due].map((word) => word.id))
    .map((id) => byId(state.data.vocabulary, id))
    .filter(Boolean)
    .slice(0, limit);
}

function createNativeAudioReview(selectedBook = currentVocabularyBook()) {
  const bookWords = getVocabularyWordsForBook(selectedBook.slug).filter((word) => canAccessBookSlug(word.bookSlug));
  const targetPool = nativePriorityWords(12, selectedBook.slug);
  const word = randomItem(targetPool.length ? targetPool : bookWords);
  if (!word) return null;

  const options = buildVocabularyOptions(bookWords.length >= 4 ? bookWords : state.data.vocabulary, word, "english");
  return {
    id: `native-audio-${word.id}-${Date.now()}`,
    bookSlug: selectedBook.slug,
    wordId: word.id,
    arabic: word.arabic,
    answer: word.english,
    options
  };
}

function ensureNativeAudioReview(selectedBook = currentVocabularyBook()) {
  if (!state.nativeAudioReview || state.nativeAudioReview.bookSlug !== selectedBook.slug) {
    state.nativeAudioReview = createNativeAudioReview(selectedBook);
    state.nativeAudioFeedback = null;
  }
  return state.nativeAudioReview;
}

function createNativeDailySession() {
  const currentLesson = getCurrentLesson();
  const lessonWords = getLessonVocabulary(currentLesson);
  const priorityWords = nativePriorityWords(3, currentLesson.bookSlug);
  const words = (priorityWords.length ? priorityWords : lessonWords).slice(0, 3);
  const mistake = mistakeItems()[0];
  const quizWord = words[0] || lessonWords[0] || state.data.vocabulary.find((word) => canAccessBookSlug(word.bookSlug));
  const quiz = quizWord ? createVocabularyQuestion(quizWord, lessonWords.length >= 4 ? lessonWords : getVocabularyWordsForBook(currentLesson.bookSlug), `native-daily-${currentLesson.id}`) : null;
  const items = [
    { type: "lesson", lessonId: currentLesson.id },
    ...words.map((word) => ({ type: "word", wordId: word.id })),
    mistake ? { type: "mistake", mistakeId: mistake.id } : (words[0] ? { type: "review", wordId: words[0].id } : null),
    quiz ? { type: "quiz", question: quiz } : null
  ].filter(Boolean);

  return {
    id: `native-daily-${todayKey()}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    items
  };
}

function startNativeDailySession() {
  state.nativeDailySession = createNativeDailySession();
  state.nativeDailyStepIndex = 0;
  state.nativeDailyFeedback = {};
  state.motion.tester = true;
  render();
}

function advanceNativeDailySession() {
  if (!state.nativeDailySession) return;
  state.nativeDailyStepIndex = Math.min(state.nativeDailySession.items.length, Number(state.nativeDailyStepIndex || 0) + 1);
  state.motion.tester = true;
  render();
}

function finishNativeDailySession() {
  const alreadyCompleted = nativeDailySessionCompletedToday();
  state.nativeDailySession = null;
  state.nativeDailyStepIndex = 0;
  state.nativeDailyFeedback = {};
  localStorage.setItem(userScopedLocalKey("native-daily-session"), todayKey());
  state.motion.celebration = alreadyCompleted
    ? t("dailySessionRefreshed", "Daily 5 refreshed")
    : t("dailySessionComplete", "Daily 5 complete · +25 XP");

  if (alreadyCompleted) {
    render();
    return;
  }

  markMotionXp(25);
  saveProgress({
    weeklyGoalCompleted: Math.min(state.progress.weeklyGoalTarget || 0, Number(state.progress.weeklyGoalCompleted || 0) + 1),
    xp: Number(state.progress.xp || 0) + 25
  });
}

function answerNativeDailyQuiz(answer) {
  const item = state.nativeDailySession?.items[state.nativeDailyStepIndex];
  const question = item?.question;
  if (!question || state.nativeDailyFeedback[question.id]) return;
  const correct = answer === question.answer;
  state.nativeDailyFeedback[question.id] = { status: correct ? "correct" : "incorrect", answer };
  hapticFeedback(correct);

  if (question.wordId) {
    saveProgress({
      learnedVocabularyIds: correct ? [question.wordId] : [],
      vocabularyStats: { [question.wordId]: reviewStatsFor(question.wordId, correct) },
      xp: correct ? Number(state.progress.xp || 0) + 8 : Number(state.progress.xp || 0)
    });
    return;
  }

  render();
}

function answerNativeAudioReview(answer) {
  const review = state.nativeAudioReview;
  if (!review || state.nativeAudioFeedback) return;
  const correct = answer === review.answer;
  state.nativeAudioFeedback = { status: correct ? "correct" : "incorrect", answer };
  hapticFeedback(correct);
  markReviewWord(review.wordId, correct);
}

function generateNativeAudioReview(play = false) {
  state.nativeAudioReview = createNativeAudioReview(currentVocabularyBook());
  state.nativeAudioFeedback = null;
  state.motion.tester = true;
  render();
  if (play && state.nativeAudioReview?.arabic) {
    window.setTimeout(() => speak(state.nativeAudioReview.arabic), 120);
  }
}

function toggleAudioRate() {
  state.audioRate = Number(state.audioRate) < 0.75 ? 0.9 : 0.62;
  localStorage.setItem("madinah-audio-rate", String(state.audioRate));
  render();
}

function restoreNativeStreak() {
  if (!nativeStreakRecoveryAvailable()) return;
  localStorage.setItem(userScopedLocalKey("streak-recovery"), todayKey());
  state.motion.celebration = t("streakRestored", "Streak restored · complete a review today");
  saveProgress({
    dailyStreakDays: 1,
    xp: Number(state.progress.xp || 0) + 5
  });
}

function renderNativeTodayApp(currentLesson) {
  const preferences = learningPreferences();
  const dueWords = dueVocabularyItems().filter((word) => canAccessBookSlug(word.bookSlug));
  const mistakes = mistakeItems();
  const lessonVocabulary = getLessonVocabulary(currentLesson);
  const reviewWord = nativePriorityWords(1)[0] || lessonVocabulary[0];
  const mastery = lessonMasteryStatus(currentLesson);
  const sessionDoneToday = nativeDailySessionCompletedToday();
  const queueItems = [
    {
      label: t("nextLesson", "Next lesson"),
      title: `${t("lesson", "Lesson")} ${currentLesson.number}`,
      detail: localizedLessonTitle(currentLesson),
      iconName: "book",
      attrs: `data-lesson="${escapeHtml(currentLesson.id)}"`
    },
    {
      label: t("dueVocabulary", "Due vocabulary"),
      title: `${dueWords.length} ${t("words", "words")}`,
      detail: dueWords[0]?.arabic || t("flashcardReview", "Flashcard review"),
      iconName: "words",
      attrs: 'data-route="vocabulary"'
    },
    {
      label: t("mistakeReview", "Mistake review"),
      title: `${mistakes.length} ${t("items", "items")}`,
      detail: mistakes[0]?.prompt || t("reviewQueueClear", "Review queue clear"),
      iconName: "target",
      attrs: hasPremiumAccess() ? 'data-route="review"' : 'data-route="subscription"'
    },
    {
      label: t("quickExercise", "Quick exercise"),
      title: hasPremiumAccess() ? t("practice", "Practice") : t("premiumPlan", "Premium"),
      detail: hasPremiumAccess() ? t("lessonDrill", "Lesson drill") : t("unlockPractice", "Unlock practice"),
      iconName: "exercises",
      attrs: hasPremiumAccess() ? `data-open-lesson="${escapeHtml(currentLesson.id)}" data-open-lesson-tab="book-exercises"` : 'data-route="subscription"'
    }
  ];

  return `
    <section class="native-today-app" aria-label="${t("todaysStudyQueue", "Today's Study Queue")}">
      <article class="native-hero-card">
        <div class="native-hero-copy">
          <p class="section-label">${t("phoneSession", "Phone session")}</p>
          <h2>${t("dailyFive", "Daily 5")}</h2>
          <div class="native-stat-row" aria-label="${t("studyStats", "Study stats")}">
            <span>${icon("flame")} ${state.progress.dailyStreakDays} ${t("days", "days")}</span>
            <span>${icon("spark")} ${state.progress.xp} XP</span>
            <span>${preferences.dailyMinutes}m</span>
            ${sessionDoneToday ? `<span>${icon("check")} ${t("doneToday", "Done today")}</span>` : ""}
          </div>
        </div>
        <button class="primary-button native-start-button" type="button" data-native-session-start>
          ${state.nativeDailySession ? t("resume", "Resume") : sessionDoneToday ? t("reviewAgain", "Review again") : t("start", "Start")} ${icon("arrow")}
        </button>
      </article>

      ${state.nativeDailySession ? renderNativeDailySessionPanel() : renderNativeSessionPreview(currentLesson, dueWords, mistakes)}
      ${nativeStreakRecoveryAvailable() ? renderNativeStreakRecoveryCard() : ""}

      <article class="native-next-lesson-card">
        <div>
          <p class="section-label">${escapeHtml(localizedBookTitle(getBook(currentLesson.bookSlug)))}</p>
          <h3>${escapeHtml(localizedLessonTitle(currentLesson))}</h3>
        </div>
        <span class="mastery-chip ${mastery.key}">${escapeHtml(mastery.label)} · ${mastery.score}%</span>
        <button class="native-lesson-arabic" type="button" data-speak="${escapeHtml(currentLesson.arabic)}" lang="ar">${currentLesson.arabic}</button>
        <span class="native-offline-badge">${icon("download")} ${escapeHtml(nativeOfflineStatusText())}</span>
      </article>

      ${reviewWord ? renderNativeFlashcardCard(reviewWord, { featured: true }) : ""}

      <section class="native-study-queue" aria-label="${t("todaysStudyQueue", "Today's Study Queue")}">
        ${queueItems.map((item) => `
          <button class="native-queue-card" type="button" ${item.attrs}>
            <span class="quick-icon">${icon(item.iconName)}</span>
            <span>
              <small>${escapeHtml(item.label)}</small>
              <strong>${escapeHtml(item.title)}</strong>
              <em ${hasArabic(item.detail) ? 'dir="rtl" lang="ar"' : ""}>${escapeHtml(localizedText(item.detail))}</em>
            </span>
          </button>
        `).join("")}
      </section>

      <section class="native-tools-card">
        <button class="native-tool-button" type="button" data-install-offline>
          ${icon("download")}
          <span>
            <strong>${t("offlineLessonPack", "Offline lesson pack")}</strong>
            <small>${escapeHtml(nativeOfflineStatusText())}</small>
          </span>
        </button>
        <button class="native-tool-button" type="button" data-request-reminders>
          ${icon("flame")}
          <span>
            <strong>${t("studyReminders", "Study reminders")}</strong>
            <small>${dueWords.length ? `${dueWords.length} ${t("wordsDueToday", "words due today")}` : t("enableReminders", "Enable reminders")}</small>
          </span>
        </button>
        <button class="native-tool-button" type="button" data-audio-rate-toggle>
          ${icon("speaker")}
          <span>
            <strong>${t("pronunciationMode", "Pronunciation mode")}</strong>
            <small>${escapeHtml(audioModeLabel())}</small>
          </span>
        </button>
        ${renderNativeQuickActions()}
        ${state.offlineNotice ? `<p class="preference-note">${escapeHtml(state.offlineNotice)}</p>` : ""}
        ${state.reminderNotice ? `<p class="preference-note">${escapeHtml(state.reminderNotice)}</p>` : ""}
      </section>
    </section>
  `;
}

function renderNativeSessionPreview(currentLesson, dueWords, mistakes) {
  const words = nativePriorityWords(3, currentLesson.bookSlug);
  return `
    <section class="native-daily-preview">
      <div>
        <p class="section-label">${t("fiveMinuteSession", "5-minute session")}</p>
        <h3>${t("knowWhatToDoNext", "Know exactly what to do next")}</h3>
      </div>
      <div class="native-daily-steps">
        <span>${icon("book")} ${t("lessonSnippet", "Lesson snippet")}</span>
        <span>${icon("words")} ${Math.max(3, words.length || dueWords.length || 3)} ${t("cards", "cards")}</span>
        <span>${icon("target")} ${mistakes.length ? t("mistakeRetry", "Mistake retry") : t("quickReview", "Quick review")}</span>
        <span>${icon("spark")} ${t("oneQuestionQuiz", "1-question quiz")}</span>
      </div>
    </section>
  `;
}

function renderNativeDailySessionPanel() {
  const session = state.nativeDailySession;
  const total = session?.items.length || 0;
  const index = Math.min(Number(state.nativeDailyStepIndex || 0), total);
  const item = session?.items[index];

  if (!session) return "";
  if (!item) return renderNativeDailySessionComplete(total);

  return `
    <section class="native-daily-session-card ${state.motion.tester ? "shuffle-in" : ""}" aria-label="${t("dailyFiveSession", "Daily 5 session")}">
      <div class="native-question-topline">
        <span>${String(index + 1).padStart(2, "0")} / ${total}</span>
        <span>${t("dailyFive", "Daily 5")}</span>
      </div>
      ${renderNativeDailySessionItem(item)}
    </section>
  `;
}

function renderNativeDailySessionItem(item) {
  if (item.type === "lesson") {
    const lesson = byId(state.data.lessons, item.lessonId) || getCurrentLesson();
    return `
      <div class="native-session-item">
        <p class="section-label">${t("lessonSnippet", "Lesson snippet")}</p>
        <h3>${escapeHtml(localizedLessonTitle(lesson))}</h3>
        <button class="native-lesson-arabic" type="button" data-speak="${escapeHtml(lesson.arabic)}" lang="ar">${lesson.arabic}</button>
        <details class="answer-reveal native-answer-reveal">
          <summary><span>${t("revealMeaning", "Reveal meaning")}</span>${icon("arrow")}</summary>
          <p class="translation">${escapeHtml(localizedText(lesson.translation))}</p>
        </details>
        <button class="primary-button" type="button" data-native-session-next>${t("done", "Done")} ${icon("arrow")}</button>
      </div>
    `;
  }

  if (item.type === "word" || item.type === "review") {
    const word = byId(state.data.vocabulary, item.wordId);
    if (!word) return `<button class="primary-button" type="button" data-native-session-next>${t("continue", "Continue")}</button>`;
    return `
      <div class="native-session-item">
        <p class="section-label">${item.type === "review" ? t("quickReview", "Quick review") : t("flashcard", "Flashcard")}</p>
        ${renderNativeFlashcardCard(word, { featured: false, session: true })}
        <div class="native-session-actions">
          <button class="ghost-button" type="button" data-native-session-word="${escapeHtml(word.id)}" data-native-session-correct="false">${t("stillLearning", "Still learning")}</button>
          <button class="primary-button" type="button" data-native-session-word="${escapeHtml(word.id)}" data-native-session-correct="true">${t("iKnowThis", "I know this")}</button>
        </div>
      </div>
    `;
  }

  if (item.type === "mistake") {
    const mistake = progressRecord("mistakes")[item.mistakeId];
    return `
      <div class="native-session-item">
        <p class="section-label">${t("mistakeRetry", "Mistake retry")}</p>
        ${mistake ? `
          <h3>${escapeHtml(localizedText(mistake.prompt || t("reviewThisItem", "Review this item.")))}</h3>
          ${mistake.arabic ? `<button class="native-test-arabic" type="button" data-speak="${escapeHtml(mistake.arabic)}" lang="ar">${mistake.arabic}</button>` : ""}
          <details class="answer-reveal native-answer-reveal">
            <summary><span>${t("revealAnswer", "Reveal answer")}</span>${icon("arrow")}</summary>
            ${renderAnswerDisplay(mistake.expected || "", { answerArabic: mistake.arabic || "" })}
          </details>
          <button class="primary-button" type="button" data-native-session-mistake="${escapeHtml(item.mistakeId)}">${t("markReviewed", "Mark reviewed")} ${icon("check")}</button>
        ` : `
          <h3>${t("reviewQueueClear", "Review queue clear")}</h3>
          <p class="translation">${t("reviewQueueClearText", "Open a lesson or generate a vocabulary test to create new review items.")}</p>
          <button class="primary-button" type="button" data-native-session-next>${t("continue", "Continue")} ${icon("arrow")}</button>
        `}
      </div>
    `;
  }

  if (item.type === "quiz") {
    const question = item.question;
    const feedback = state.nativeDailyFeedback[question.id];
    return `
      <div class="native-session-item">
        <p class="section-label">${t("oneQuestionQuiz", "1-question quiz")}</p>
        <div class="vocab-test-prompt native-test-prompt">
          <p>${escapeHtml(localizedText(normalizedQuizPrompt(question)))}</p>
          ${question.arabic ? `<button class="native-test-arabic" type="button" data-speak="${escapeHtml(question.arabic)}" lang="ar">${question.arabic}</button>` : `
            <span class="native-target-card">
              <small>${t("meaning", "Meaning")}</small>
              <strong>${escapeHtml(localizedOption(question.display))}</strong>
            </span>
          `}
        </div>
        <div class="native-test-options">
          ${question.options.map((option) => {
            const answered = Boolean(feedback);
            const isCorrect = answered && feedback.status === "correct" && option === question.answer;
            const isWrong = answered && option === feedback.answer && option !== question.answer;
            return `
              <button class="option-button vocab-option ${isCorrect ? "correct-option" : ""} ${isWrong ? "incorrect-option" : ""}" type="button" data-native-session-quiz-answer="${escapeHtml(option)}" ${answered ? "disabled" : ""}>
                <span ${hasArabic(option) ? 'class="arabic-option" lang="ar"' : ""}>${escapeHtml(localizedOption(option))}</span>
              </button>
            `;
          }).join("")}
        </div>
        ${feedback ? `
          <div class="feedback ${feedback.status === "correct" ? "correct" : "incorrect"}">
            ${icon(feedback.status === "correct" ? "check" : "x")}
            <span>${feedback.status === "correct" ? t("correct", "Correct") : t("notQuiteShort", "Not quite.")}</span>
          </div>
          ${renderQuestionExplanation(question, feedback.answer)}
          <button class="primary-button" type="button" data-native-session-next>${t("continue", "Continue")} ${icon("arrow")}</button>
        ` : ""}
      </div>
    `;
  }

  return "";
}

function renderNativeDailySessionComplete(total) {
  const doneToday = nativeDailySessionCompletedToday();
  return `
    <article class="native-tester-complete native-daily-complete">
      <span class="quick-icon">${icon("check")}</span>
      <p class="section-label">${t("sessionComplete", "Session complete")}</p>
      <h3>${t("dailyFiveFinished", "Daily 5 finished")}</h3>
      <p>${doneToday ? t("alreadyClaimedXp", "You have already claimed today's session XP.") : t("sessionReward", "Claim 25 XP and move your weekly goal forward.")}</p>
      <div class="native-stat-row">
        <span>${total} ${t("steps", "steps")}</span>
        <span>${nativePriorityWords(1)[0] ? escapeHtml(reviewScheduleText(nativePriorityWords(1)[0])) : t("nextReview", "Next review")}</span>
      </div>
      <button class="primary-button" type="button" data-native-session-finish>${doneToday ? t("close", "Close") : t("claimReward", "Claim reward")} ${icon("check")}</button>
    </article>
  `;
}

function renderNativeStreakRecoveryCard() {
  return `
    <section class="native-streak-card">
      <span class="quick-icon">${icon("flame")}</span>
      <div>
        <p class="section-label">${t("streakRecovery", "Streak recovery")}</p>
        <h3>${t("restoreYourStreak", "Restore your streak")}</h3>
        <p>${t("restoreStreakText", "Complete a short review today and keep momentum without extra fuss.")}</p>
      </div>
      <button class="ghost-button compact-button" type="button" data-native-restore-streak>${t("restore", "Restore")}</button>
    </section>
  `;
}

function renderNativeQuickActions() {
  return `
    <div class="native-quick-actions" aria-label="${t("quickActions", "Quick actions")}">
      <button type="button" data-lesson="${escapeHtml(getCurrentLesson().id)}">${icon("book")}<span>${t("continueLesson", "Continue lesson")}</span></button>
      <button type="button" data-native-open-listen>${icon("speaker")}<span>${t("listenReview", "Listen review")}</span></button>
      <button type="button" data-route="review">${icon("target")}<span>${t("mistakes", "Mistakes")}</span></button>
    </div>
  `;
}

function renderMobileTodayScreen(currentLesson) {
  const preferences = learningPreferences();
  const dueWords = dueVocabularyItems().filter((word) => canAccessBookSlug(word.bookSlug));
  const weakWords = weakVocabularyItems(3);
  const lessonVocabulary = getLessonVocabulary(currentLesson);
  const learned = lessonVocabulary.filter((word) => state.progress.learnedVocabularyIds.includes(word.id)).length;
  const sessionSteps = [
    [icon("play"), t("read", "Read"), currentLesson.arabic, `data-lesson="${escapeHtml(currentLesson.id)}"`],
    [icon("words"), t("review", "Review"), `${Math.min(3, dueWords.length || lessonVocabulary.length)} ${t("words", "words")}`, 'data-route="vocabulary"'],
    [icon("exercises"), t("practice", "Practice"), hasPremiumAccess() ? t("miniDrill", "Mini drill") : t("premiumPlan", "Premium"), hasPremiumAccess() ? `data-open-lesson="${escapeHtml(currentLesson.id)}" data-open-lesson-tab="book-exercises"` : 'data-route="subscription"']
  ];

  return `
    <section class="mobile-today-screen">
      <article class="mobile-hero-study">
        <div>
          <p class="section-label">${t("today", "Today")}</p>
          <h2>${t("todaysStudyQueue", "Today's Study Queue")}</h2>
          <span>${preferences.dailyMinutes}m · ${learningPreferenceLabel("skillFocus", preferences.skillFocus)}</span>
        </div>
        <button class="primary-button" type="button" data-lesson="${escapeHtml(currentLesson.id)}">${t("start", "Start")} ${icon("arrow")}</button>
      </article>
      <article class="mobile-current-card">
        <div class="card-heading">
          <div>
            <p class="section-label">${escapeHtml(localizedBookTitle(getBook(currentLesson.bookSlug)))}</p>
            <h3>${t("lesson", "Lesson")} ${currentLesson.number}: ${escapeHtml(localizedLessonTitle(currentLesson))}</h3>
          </div>
          <span class="pill">${lessonMastery(currentLesson)}%</span>
        </div>
        <button class="mobile-current-arabic" type="button" data-speak="${escapeHtml(currentLesson.arabic)}" lang="ar">${currentLesson.arabic}</button>
        <div class="mobile-session-progress">
          <span>${learned}/${lessonVocabulary.length} ${t("words", "words")}</span>
          <div class="bar"><span style="width:${lessonVocabulary.length ? Math.round((learned / lessonVocabulary.length) * 100) : 0}%"></span></div>
        </div>
      </article>
      <section class="mobile-session-cards" aria-label="${t("todaySession", "Today session")}">
        ${sessionSteps.map(([stepIcon, title, body, attrs]) => `
          <button class="mobile-session-card" type="button" ${attrs}>
            <span class="quick-icon">${stepIcon}</span>
            <strong>${escapeHtml(title)}</strong>
            <small ${hasArabic(body) ? 'dir="rtl" lang="ar"' : ""}>${escapeHtml(body)}</small>
          </button>
        `).join("")}
      </section>
      <section class="mobile-review-strip">
        <div>
          <p class="section-label">${t("quickReview", "Quick review")}</p>
          <h3>${dueWords.length} ${t("wordsDue", "words due")}</h3>
        </div>
        <div class="chip-row">
          ${(weakWords.length ? weakWords : dueWords).slice(0, 4).map((word) => `<button type="button" data-speak="${escapeHtml(word.arabic)}" lang="ar">${word.arabic}</button>`).join("") || `<span class="empty-state">${t("noDueWords", "No due words right now.")}</span>`}
        </div>
      </section>
      <section class="mobile-offline-card">
        <div>
          <p class="section-label">${t("offlineStudy", "Offline study")}</p>
          <h3>${t("keepRecentLessonsReady", "Keep recent lessons ready")}</h3>
        </div>
        <button class="ghost-button compact-button" type="button" data-install-offline>${t("refreshOffline", "Refresh offline cache")}</button>
      </section>
    </section>
  `;
}

function renderOnboardingPanel() {
  const preferences = learningPreferences();
  if (preferences.onboardingComplete) return "";
  const goals = [
    ["guided-books", t("guidedBooks", "Guided books")],
    ["quran-grammar", t("quranGrammar", "Qur'an grammar")],
    ["vocabulary", t("vocabulary", "Vocabulary")],
    ["exam-revision", t("examRevision", "Exam revision")]
  ];
  const focuses = [
    ["balanced", t("balanced", "Balanced")],
    ["reading", t("reading", "Reading")],
    ["vocabulary", t("vocabulary", "Vocabulary")],
    ["grammar", t("grammar", "Grammar")]
  ];
  const minuteOptions = [5, 10, 15, 25];

  return `
    <section class="card onboarding-card">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${t("studySetup", "Study setup")}</p>
          <h2>${t("shapeYourDailyPath", "Shape your daily path")}</h2>
        </div>
        <span class="pill">${preferences.dailyMinutes} ${t("minutes", "minutes")}</span>
      </div>
      <div class="onboarding-grid">
        <div class="preference-choice">
          <span>${t("mainGoal", "Main goal")}</span>
          <div class="filter-chip-row">
            ${goals.map(([value, label]) => `
              <button class="filter-chip ${preferences.studyGoal === value ? "active" : ""}" type="button" data-study-pref-key="studyGoal" data-study-pref-value="${value}">
                ${escapeHtml(label)}
              </button>
            `).join("")}
          </div>
        </div>
        <div class="preference-choice">
          <span>${t("dailyTime", "Daily time")}</span>
          <div class="filter-chip-row">
            ${minuteOptions.map((value) => `
              <button class="filter-chip ${Number(preferences.dailyMinutes) === value ? "active" : ""}" type="button" data-study-pref-key="dailyMinutes" data-study-pref-value="${value}">
                ${value}m
              </button>
            `).join("")}
          </div>
        </div>
        <div class="preference-choice">
          <span>${t("skillFocus", "Skill focus")}</span>
          <div class="filter-chip-row">
            ${focuses.map(([value, label]) => `
              <button class="filter-chip ${preferences.skillFocus === value ? "active" : ""}" type="button" data-study-pref-key="skillFocus" data-study-pref-value="${value}">
                ${escapeHtml(label)}
              </button>
            `).join("")}
          </div>
        </div>
      </div>
      <div class="onboarding-actions">
        <p>${t("onboardingHint", "Your dashboard mission and review prompts will stay focused on this profile.")}</p>
        <button class="primary-button compact-button" type="button" data-onboarding-complete>${t("saveStudyProfile", "Save study profile")} ${icon("check")}</button>
      </div>
    </section>
  `;
}

function renderStudyProfileCard() {
  const preferences = learningPreferences();
  return `
    <section class="card study-profile-card">
      <div class="panel-heading">
        <p class="section-label">${t("studyProfile", "Study profile")}</p>
        <h2>${learningPreferenceLabel("studyGoal", preferences.studyGoal)}</h2>
      </div>
      <div class="study-profile-list">
        <span>${icon("target")} ${learningPreferenceLabel("skillFocus", preferences.skillFocus)}</span>
        <span>${icon("flame")} ${preferences.dailyMinutes} ${t("minutesPerDay", "minutes per day")}</span>
        <span>${icon("spark")} ${preferences.onboardingComplete ? t("personalised", "Personalised") : t("setupPending", "Setup pending")}</span>
      </div>
    </section>
  `;
}

function renderContentChangelogPanel() {
  const items = [
    ...state.data.lessons.map((item) => ({ ...item, type: t("lesson", "Lesson"), title: localizedLessonTitle(item), route: item.bookSlug })),
    ...state.data.vocabulary.map((item) => ({ ...item, type: t("vocabulary", "Vocabulary"), title: `${item.arabic} - ${localizedText(item.english)}`, route: "vocabulary" })),
    ...state.data.exercises.map((item) => {
      const lesson = byId(state.data.lessons, item.lessonId);
      return { ...item, type: t("exercise", "Exercise"), title: localizedText(item.prompt), route: lesson?.bookSlug || "book-1" };
    })
  ]
    .filter((item) => item.updatedAt || item.contentStatus || item.sourceRef)
    .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
    .slice(0, 5);

  return `
    <section class="card changelog-card">
      <div class="panel-heading">
        <p class="section-label">${t("contentQuality", "Content quality")}</p>
        <h2>${t("contentChangelog", "Content Changelog")}</h2>
      </div>
      <div class="changelog-list">
        ${items.map((item) => `
          <button type="button" data-route="${escapeHtml(item.route)}">
            <span>${escapeHtml(item.type)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.contentStatus || item.sourceRef || t("updated", "Updated"))}</small>
          </button>
        `).join("") || `<p class="translation">${t("noRecentContentChanges", "No recent content changes to show.")}</p>`}
      </div>
    </section>
  `;
}

function buildTodayStudyQueue(currentLesson) {
  const lessonVocabulary = getLessonVocabulary(currentLesson);
  const dueWords = dueVocabularyItems().filter((word) => canAccessBookSlug(word.bookSlug));
  const mistakes = mistakeItems();
  const cards = getLessonExerciseCards(currentLesson, lessonVocabulary);
  const nextExercise = cards.find((card) => progressRecord("exerciseAttempts")[card.id] !== "complete") || cards[0];
  const nextLesson = state.progress.completedLessonIds.includes(currentLesson.id)
    ? byId(state.data.lessons, nextLessonId(currentLesson.id)) || currentLesson
    : currentLesson;

  return [
    {
      id: "lesson",
      iconName: "book",
      label: t("nextLesson", "Next lesson"),
      title: `${localizedBookTitle(getBook(nextLesson.bookSlug))} · ${t("lesson", "Lesson")} ${nextLesson.number}`,
      body: localizedLessonFocus(nextLesson),
      meta: renderMasteryChip(nextLesson),
      attrs: `data-lesson="${escapeHtml(nextLesson.id)}"`,
      done: state.progress.completedLessonIds.includes(nextLesson.id)
    },
    {
      id: "vocab",
      iconName: "words",
      label: t("dueVocabulary", "Due vocabulary"),
      title: dueWords.length ? `${dueWords.length} ${t("wordsDue", "words due")}` : t("noDueWords", "No due words"),
      body: dueWords.slice(0, 3).map((word) => word.arabic).join("  ") || t("reviewFreshWords", "Open vocabulary to review fresh words."),
      attrs: hasPremiumAccess() ? 'data-route="review"' : 'data-route="vocabulary"',
      done: dueWords.length === 0
    },
    {
      id: "mistake",
      iconName: "target",
      label: t("mistakeReview", "Mistake review"),
      title: mistakes.length ? `${mistakes.length} ${t("openMistakes", "open mistakes")}` : t("noMistakes", "No mistakes"),
      body: mistakes[0]?.prompt || t("keepGoingClean", "Nothing needs repair right now."),
      attrs: hasPremiumAccess() ? 'data-route="review"' : 'data-route="subscription"',
      done: mistakes.length === 0
    },
    {
      id: "exercise",
      iconName: "exercises",
      label: t("oneExercise", "One exercise"),
      title: nextExercise ? localizedText(nextExercise.title) : t("practice", "Practice"),
      body: hasPremiumAccess()
        ? (nextExercise?.bookPrompt || t("consolidatePractice", "Consolidate practice"))
        : t("premiumPlanTextShort", "Exercises unlock with Premium."),
      attrs: hasPremiumAccess()
        ? `data-open-lesson="${escapeHtml(currentLesson.id)}" data-open-lesson-tab="book-exercises"`
        : 'data-route="subscription"',
      done: nextExercise ? progressRecord("exerciseAttempts")[nextExercise.id] === "complete" : true
    }
  ];
}

function renderDailyMissionPanel(currentLesson) {
  const preferences = learningPreferences();
  const missions = buildTodayStudyQueue(currentLesson);

  return `
    <section class="card daily-mission-panel">
      <div class="panel-heading inline">
        <div>
          <p class="section-label">${t("today", "Today")}</p>
          <h2>${t("todaysStudyQueue", "Today's Study Queue")}</h2>
        </div>
        <span class="pill">${preferences.dailyMinutes}m · ${learningPreferenceLabel("skillFocus", preferences.skillFocus)}</span>
      </div>
      <div class="mission-grid">
        ${missions.map((mission) => `
          <button class="mission-card ${mission.done ? "done" : ""}" type="button" ${mission.attrs}>
            <span class="quick-icon">${icon(mission.done ? "check" : mission.iconName)}</span>
            <span>
              <em>${escapeHtml(mission.label)}</em>
              <strong>${escapeHtml(mission.title)}</strong>
              <small ${hasArabic(mission.body) ? 'dir="rtl" lang="ar"' : ""}>${escapeHtml(mission.body)}</small>
              ${mission.meta || ""}
            </span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderLessonMapCard(bookSlug, currentLesson = null) {
  const book = getBook(bookSlug);
  const lessons = lessonsForBook(bookSlug);
  if (!lessons.length) return "";
  const selectedId = currentLesson?.id || state.selectedLessonId;

  return `
    <section class="card lesson-map-card">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${t("roadmap", "Roadmap")}</p>
          <h2>${escapeHtml(localizedBookTitle(book))} ${t("lessonPath", "Lesson Path")}</h2>
        </div>
        <span class="pill">${lessonProgressPercent(bookSlug)}% ${t("complete", "complete")}</span>
      </div>
      <div class="lesson-map-scroll">
        ${lessons.map((lesson) => {
          const complete = state.progress.completedLessonIds.includes(lesson.id);
          const active = lesson.id === selectedId;
          return `
            <button class="lesson-map-node ${complete ? "done" : ""} ${active ? "active" : ""} ${lessonMasteryStatus(lesson).key}" type="button" data-lesson="${lesson.id}">
              <span>${complete ? icon("check") : escapeHtml(String(lesson.number))}</span>
              <strong>${escapeHtml(localizedLessonTitle(lesson))}</strong>
              <small>${lessonMasteryStatus(lesson).label} · ${lessonMastery(lesson)}%</small>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderTodayReviewPanel(currentLesson) {
  const dueWords = dueVocabularyItems().filter((word) => word.bookSlug === currentLesson.bookSlug && canAccessBookSlug(word.bookSlug));
  const mistakes = mistakeItems();
  const nextLesson = byId(state.data.lessons, nextLessonId(currentLesson.id)) || currentLesson;
  const modules = [
    {
      iconName: "words",
      label: t("spacedRepetition", "Spaced Repetition"),
      title: `${dueWords.length} ${t("wordsDue", "words due")}`,
      body: dueWords.slice(0, 4).map((word) => word.arabic).join("  ") || t("noDueWords", "No due words right now."),
      route: "vocabulary"
    },
    {
      iconName: "target",
      label: t("mistakeReview", "Mistake review"),
      title: `${mistakes.length} ${t("openMistakes", "open mistakes")}`,
      body: mistakes[0]?.prompt || t("noMistakes", "No mistakes to review right now."),
      route: "review"
    },
    {
      iconName: "book",
      label: t("nextStep", "Next step"),
      title: `${localizedBookTitle(getBook(nextLesson.bookSlug))} · ${t("lesson", "Lesson")} ${nextLesson.number}`,
      body: localizedLessonFocus(nextLesson),
      lessonId: nextLesson.id
    }
  ];

  return `
    <section class="card today-review-panel">
      <div class="panel-heading inline">
        <div>
          <p class="section-label">${t("today", "Today")}</p>
          <h2>${t("learningOverview", "Learning Overview")}</h2>
        </div>
        <span class="pill">${state.progress.xp.toLocaleString()} XP</span>
      </div>
      <div class="today-review-grid">
        ${modules.map((item) => `
          <article class="today-review-card">
            <span class="quick-icon">${icon(item.iconName)}</span>
            <p class="section-label">${escapeHtml(item.label)}</p>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
            <button class="ghost-button compact-button" type="button" ${item.lessonId ? `data-lesson="${escapeHtml(item.lessonId)}"` : `data-route="${escapeHtml(item.route)}"`}>
              ${t("open", "Open")} ${icon("arrow")}
            </button>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderAboutPage() {
  const totalLessonCount = state.data.books.reduce(
    (sum, book) => sum + (Number(book.lessonCount) || lessonsForBook(book.slug).length),
    0
  );
  const values = [
    [icon("book"), t("bookBasedStudy", "Book-based study"), t("bookBasedStudyText", "Lessons follow the Madinah Arabic sequence so students can move from recognition to confident sentence building.")],
    [icon("words"), t("vocabularyDepth", "Vocabulary depth"), t("vocabularyDepthText", "Each book keeps its vocabulary grouped by source content, with tester filters ready for future Book 2 and Book 3 revision.")],
    [icon("exercises"), t("practiceFirst", "Practice first"), t("practiceFirstText", "Lesson pages combine examples, collapsible exercises, checked prompts, and quizzes without crowding the student.")],
    [icon("progress"), t("progressAware", "Progress-aware"), t("progressAwareText", "Saved progress, XP, streaks, review queues, and mistake tracking help learners know what to do next.")]
  ];

  return `
    <section class="page-stack public-page">
      <section class="public-hero card">
        <div>
          <p class="section-label">${t("about", "About")}</p>
          <h2>${t("aboutTitle", "A focused workspace for learning the Madinah Arabic Books.")}</h2>
          <p>${t("aboutText", "Madinah Arabic keeps the interface calm and study-centred: authentic Arabic examples, clear English meanings, lesson exercises, vocabulary testing, and account-based progress in one place.")}</p>
        </div>
        <div class="public-hero-metrics" aria-label="${t("platformSnapshot", "Platform snapshot")}">
          <span><strong>${state.data.books.length}</strong>${t("books", "Books")}</span>
          <span><strong>${totalLessonCount}</strong>${t("lessons", "Lessons")}</span>
          <span><strong>${state.data.vocabulary.length}</strong>${t("words", "Words")}</span>
        </div>
      </section>
      <section class="public-info-grid">
        ${values.map(([itemIcon, title, body]) => `
          <article class="card public-info-card">
            <span class="quick-icon">${itemIcon}</span>
            <h3>${title}</h3>
            <p>${body}</p>
          </article>
        `).join("")}
      </section>
    </section>
  `;
}

function renderCurriculumPage() {
  const totalLessonCount = state.data.books.reduce(
    (sum, book) => sum + (Number(book.lessonCount) || lessonsForBook(book.slug).length),
    0
  );
  return `
    <section class="page-stack public-page">
      <div class="page-heading">
        <div>
          <p class="section-label">${t("curriculum", "Curriculum")}</p>
          <h2>${t("curriculumTitle", "Madinah Arabic Books 1-3")}</h2>
        </div>
        <span class="pill">${totalLessonCount} ${t("lessons", "lessons")}</span>
      </div>
      <section class="curriculum-grid">
        ${state.data.books.map((book, index) => {
          const accessible = isAuthenticated() && book.status === "available" && canAccessBookSlug(book.slug);
          const freeBook = book.slug === "book-1";
          const lessonCount = lessonsForBook(book.slug).length || book.lessonCount || 0;
          const wordCount = getVocabularyWordsForBook(book.slug).length;
          return `
            <article class="card curriculum-card ${accessible ? "available" : ""}">
              <div class="card-heading">
                <span class="book-number">${index + 1}</span>
                <span class="pill ${freeBook ? "" : "muted"}">${freeBook ? t("freePlan", "Free") : t("premiumPlan", "Premium")}</span>
              </div>
              <h3>${escapeHtml(localizedBookTitle(book))}</h3>
              <p>${escapeHtml(localizedBookSummary(book))}</p>
              <div class="curriculum-meta">
                <span>${lessonCount} ${t("lessons", "lessons")}</span>
                ${wordCount ? `<span>${wordCount} ${t("words", "words")}</span>` : ""}
              </div>
              <button class="${accessible ? "primary-button" : "ghost-button"}" type="button" data-route="${freeBook || accessible ? book.slug : "subscription"}">
                ${accessible ? t("continueLearning", "Continue learning") : freeBook ? t("signInToStart", "Sign in to start") : t("viewPlan", "View plan")}
                ${icon("arrow")}
              </button>
            </article>
          `;
        }).join("")}
      </section>
    </section>
  `;
}

function renderBooksPage() {
  const availableCount = state.data.books.filter((book) => book.status === "available" && canAccessBookSlug(book.slug)).length;
  const currentLesson = getCurrentLesson();

  return `
    <section class="page-stack books-page">
      <div class="page-heading">
        <div>
          <p class="section-label">${t("books", "Books")}</p>
          <h2>${t("madinahArabicBooks", "Madinah Arabic Books")}</h2>
        </div>
        <span class="pill">${availableCount}/${state.data.books.length} ${t("available", "available")}</span>
      </div>
      <section class="curriculum-grid">
        ${state.data.books.map((book, index) => {
          const accessible = book.status === "available" && canAccessBookSlug(book.slug);
          const current = book.slug === currentLesson.bookSlug;
          const lessonCount = lessonsForBook(book.slug).length || book.lessonCount || 0;
          const wordCount = getVocabularyWordsForBook(book.slug).length;
          return `
            <article class="card curriculum-card ${accessible ? "available" : "locked"} ${current ? "current" : ""}">
              <div class="card-heading">
                <span class="book-number">${index + 1}</span>
                <span class="pill ${accessible ? "" : "muted"}">${accessible ? (current ? t("current", "Current") : t("available", "Available")) : t("lockedPremium", "Premium")}</span>
              </div>
              <h3>${escapeHtml(localizedBookTitle(book))}</h3>
              <p>${escapeHtml(localizedBookSummary(book))}</p>
              <div class="curriculum-meta">
                <span>${lessonCount} ${t("lessons", "lessons")}</span>
                ${wordCount ? `<span>${wordCount} ${t("words", "words")}</span>` : ""}
              </div>
              <button class="${accessible ? "primary-button" : "ghost-button"}" type="button" data-route="${accessible ? book.slug : "subscription"}">
                ${accessible ? (current ? t("continueLearning", "Continue learning") : t("openBook", "Open book")) : t("viewPlan", "View plan")}
                ${icon(accessible ? "arrow" : "lock")}
              </button>
            </article>
          `;
        }).join("")}
      </section>
    </section>
  `;
}

function renderSubscriptionPage() {
  const planKey = currentPlanKey();
  const signedIn = isAuthenticated();
  const billing = state.data?.billing || {};
  const checkoutReady = Boolean(billing.checkoutConfigured);
  const portalReady = Boolean(state.user?.billingPortalAvailable && billing.portalConfigured);
  const billingMessage = state.billingError || state.billingNotice;
  return `
    <section class="page-stack subscription-page">
      <section class="subscription-hero card">
        <div>
          <p class="section-label">${t("earlyBirdOffer", "Early-bird offer")}</p>
          <h2>${t("subscriptionTitle", "Premium access for every stage of study.")}</h2>
          <p>${t("subscriptionText", "Unlock Books 1-3, lesson exercises, vocabulary testing, mistake review, progress tools, and mobile-app early access options. These launch prices are planned for the first two months only.")}</p>
          <div class="early-bird-row">
            <span>${icon("spark")} ${t("twoMonthOffer", "Launch pricing for 2 months")}</span>
            <span>${icon("check")} ${t("cancelAnytime", "Cancel recurring plans anytime")}</span>
            <span>${icon("flame")} ${t("lifetimeMobileIncluded", "Lifetime includes mobile early access")}</span>
          </div>
        </div>
        <div class="subscription-status">
          <span class="pill">${signedIn ? t("currentPlan", "Current plan") : t("accountLabel", "Account")}</span>
          <strong>${signedIn ? escapeHtml(localizedPlanLabel(planKey)) : t("signIn", "Sign in")}</strong>
          <small>${signedIn ? escapeHtml(state.user.subscriptionStatus || "active") : t("signInToSeePlan", "Sign in to see your plan status")}</small>
        </div>
      </section>
      ${billingMessage ? `<p class="billing-message ${state.billingError ? "error" : ""}">${escapeHtml(billingMessage)}</p>` : ""}
      ${renderPricingCards(billing)}
      ${renderMembershipTable()}
      <section class="card subscription-next">
        <div>
          <p class="section-label">${t("nextStep", "Next step")}</p>
          <h3>${hasPremiumAccess() ? t("premiumActive", "Premium is active on this account") : t("startLearningToday", "Start learning today")}</h3>
          <p>${hasPremiumAccess() ? t("premiumActiveText", "Book 1, Book 2, Book 3, quizzes, exercises, and review tools are unlocked.") : signedIn ? t("upgradeText", "Upgrade securely with Stripe to unlock Books 2-3, exercises, quizzes, review, and complete vocabulary testing.") : t("startLearningText", "Create an account to save progress, or sign in with an existing account to continue where you left off.")}</p>
          ${signedIn && !checkoutReady && !hasPremiumAccess() ? `<p class="preference-note">${t("billingSetupNeeded", "Stripe billing is not configured yet. Add Stripe keys and a Premium Price ID in production settings.")}</p>` : ""}
        </div>
        <div class="landing-actions">
          ${signedIn
            ? hasPremiumAccess()
              ? portalReady
                ? `<button class="primary-button" type="button" data-billing-portal>${t("manageBilling", "Manage billing")} ${icon("arrow")}</button>
                   <button class="ghost-button" type="button" data-route="account">${t("account", "Account")}</button>`
                : `<button class="primary-button" type="button" data-route="account">${t("account", "Account")} ${icon("arrow")}</button>`
              : `<button class="primary-button" type="button" data-billing-checkout ${checkoutReady ? "" : "disabled"}>${t("upgradeWithStripe", "Upgrade with Stripe")} ${icon("arrow")}</button>
                 <button class="ghost-button" type="button" data-route="book-1">${t("continueBookOne", "Continue Book 1")}</button>`
            : `<button class="primary-button" type="button" data-auth-mode="register">${t("createAccount", "Create account")} ${icon("arrow")}</button>
               <button class="ghost-button" type="button" data-auth-mode="login">${t("signIn", "Sign in")}</button>`}
        </div>
      </section>
    </section>
  `;
}

function renderPricingCards(billing = {}) {
  const signedIn = isAuthenticated();
  const fallbackPlans = [
    { id: "monthly", label: "Monthly", price: "£5", term: "per month", description: "Flexible premium access.", checkoutConfigured: false },
    { id: "six_months", label: "6 months", price: "£25", term: "every 6 months", description: "One focused study block.", checkoutConfigured: false },
    { id: "yearly", label: "Yearly", price: "£50", term: "per year", description: "Best recurring value.", checkoutConfigured: false },
    { id: "lifetime", label: "Lifetime", price: "£110", term: "one-time", description: "Lifetime access plus mobile early access.", checkoutConfigured: false }
  ];
  const plans = billing.plans?.length ? billing.plans : fallbackPlans;
  const features = {
    monthly: [t("allBooks", "Books 1-3"), t("quizzesExercises", "Quizzes and exercises"), t("cancelAnytimeShort", "Cancel anytime")],
    six_months: [t("allBooks", "Books 1-3"), t("sixMonthValue", "Save £5 vs monthly"), t("focusedRevision", "Focused revision block")],
    yearly: [t("allBooks", "Books 1-3"), t("yearlyValue", "Save £10 vs monthly"), t("fullYearProgress", "Full-year progress tracking")],
    lifetime: [t("allBooks", "Books 1-3"), t("lifetimeAccess", "Lifetime web access"), t("mobileEarlyAccess", "Free mobile + early access")]
  };

  return `
    <section class="pricing-section">
      <div class="pricing-heading">
        <div>
          <p class="section-label">${t("earlyBirdMembership", "Early-bird membership")}</p>
          <h2>${t("chooseYourPlan", "Choose your Premium plan")}</h2>
        </div>
        <span class="pill">${t("limitedTwoMonths", "Limited to 2 months")}</span>
      </div>
      <div class="pricing-grid">
        ${plans.map((plan) => {
          const highlighted = plan.id === "yearly";
          const lifetime = plan.id === "lifetime";
          const disabled = signedIn && (!plan.checkoutConfigured || hasPremiumAccess());
          const buttonLabel = !signedIn
            ? t("signInToUpgrade", "Sign in to upgrade")
            : hasPremiumAccess()
              ? t("premiumActiveShort", "Premium active")
              : plan.checkoutConfigured
                ? t("choosePlan", "Choose plan")
                : t("stripeSetupNeeded", "Stripe setup needed");

          return `
            <article class="pricing-card card ${highlighted ? "recommended" : ""} ${lifetime ? "lifetime" : ""}">
              <div class="pricing-card-top">
                <p class="section-label">${highlighted ? t("bestValue", "Best value") : lifetime ? t("oneTime", "One-time") : t("earlyBird", "Early bird")}</p>
                <span class="pill">${escapeHtml(plan.label)}</span>
              </div>
              <div class="pricing-price">
                <strong>${escapeHtml(plan.price)}</strong>
                <span>${escapeHtml(plan.term)}</span>
              </div>
              <p>${escapeHtml(plan.description)}</p>
              <ul class="pricing-feature-list">
                ${(features[plan.id] || features.monthly).map((feature) => `<li>${icon("check")} ${escapeHtml(feature)}</li>`).join("")}
              </ul>
              <button class="${highlighted || lifetime ? "primary-button" : "ghost-button"}" type="button" ${signedIn ? `data-billing-checkout data-billing-plan="${escapeHtml(plan.id)}"` : `data-auth-mode="login"`} ${disabled ? "disabled" : ""}>
                ${buttonLabel} ${!disabled ? icon("arrow") : ""}
              </button>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderMembershipTable() {
  const rows = [
    [t("bookOneAccess", "Book 1 lessons"), true, true],
    [t("bookTwoThreeAccess", "Book 2 and Book 3 lessons"), false, true],
    [t("lessonExamples", "Lesson examples"), true, true],
    [t("bookExerciseSections", "Book exercise sections"), false, true],
    [t("lessonVocabularyQuizzes", "Lesson vocabulary quizzes"), false, true],
    [t("sentenceBuilderAccess", "Sentence builder drills"), false, true],
    [t("morphologyDrillsAccess", "Morphology pattern drills"), false, true],
    [t("cumulativeChecksAccess", "Cumulative milestone checks"), false, true],
    [t("vocabTesterAccess", "Vocabulary tester"), t("basicTester", "Basic tester"), t("fullTester", "Full tester")],
    [t("mistakeReviewAccess", "Mistake review"), false, true],
    [t("spacedReviewAccess", "Due-word and spaced review"), false, true],
    [t("progressDashboardAccess", "Progress dashboard"), false, true],
    [t("offlineStudyAccess", "Offline-ready study cache"), true, true]
  ];

  const cell = (value) => {
    if (value === true) return `<span class="table-check">${icon("check")} ${t("included", "Included")}</span>`;
    if (value === false) return `<span class="table-muted">${t("notIncluded", "Not included")}</span>`;
    return `<span>${escapeHtml(value)}</span>`;
  };

  return `
    <section class="card membership-card">
      <div class="table-title">
        <div>
          <p class="section-label">${t("membershipTiers", "Membership tiers")}</p>
          <h2>${t("freeVsPremium", "Free vs Premium")}</h2>
        </div>
        <span class="pill">${escapeHtml(localizedPlanLabel())}</span>
      </div>
      <div class="membership-table-wrap">
        <table class="membership-table">
          <thead>
            <tr>
              <th>${t("feature", "Feature")}</th>
              <th>${t("freePlan", "Free")}</th>
              <th>${t("premiumPlan", "Premium")}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(([feature, free, premium]) => `
              <tr>
                <td>${escapeHtml(feature)}</td>
                <td>${cell(free)}</td>
                <td>${cell(premium)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderSignInGate() {
  return `
    <section class="locked-page card">
      <span class="locked-icon">${icon("lock")}</span>
      <p class="section-label">${t("privateWorkspace", "Private learning workspace")}</p>
      <h2>${t("signInContinue", "Sign in to continue")}</h2>
      <p>${t("signInGateText", "Your lessons, quizzes, vocabulary review, and progress are available after login.")}</p>
      <button class="primary-button" type="button" data-auth-mode="login">${t("signIn", "Sign in")} ${icon("arrow")}</button>
    </section>
  `;
}

function renderUpgradeGate(feature = "default", embedded = false) {
  return `
    <section class="upgrade-gate ${embedded ? "embedded" : "card"}">
      <span class="locked-icon">${icon("lock")}</span>
      <p class="section-label">${t("premiumFeature", "Premium feature")}</p>
      <h2>${t("upgradeToPremium", "Upgrade to Premium")}</h2>
      <p>${escapeHtml(paidFeatureText(feature))}</p>
      <div class="upgrade-benefit-grid">
        ${[
          [icon("book"), t("allBooks", "All books"), t("allBooksText", "Book 1, Book 2, Book 3")],
          [icon("exercises"), t("allExercises", "All exercises"), t("allExercisesText", "Collapsible practice, writing checks, quizzes")],
          [icon("target"), t("advancedReview", "Advanced review"), t("advancedReviewText", "Mistakes, due words, spaced repetition")]
        ].map(([itemIcon, title, body]) => `
          <article>
            <span class="quick-icon">${itemIcon}</span>
            <strong>${title}</strong>
            <small>${escapeHtml(body)}</small>
          </article>
        `).join("")}
      </div>
      <div class="landing-actions">
        <button class="primary-button" type="button" data-route="subscription">${t("viewPlan", "View plan")} ${icon("arrow")}</button>
        <button class="ghost-button" type="button" data-route="book-1">${t("continueBookOne", "Continue Book 1")}</button>
      </div>
    </section>
  `;
}

function renderPlanComparison(compact = false) {
  const rows = [
    [t("freePlan", "Free"), t("freePlanText", "Book 1 learn content, vocabulary list, audio, and a basic 3-question vocabulary tester.")],
    [t("premiumPlan", "Premium"), t("premiumPlanText", "Book 2-3, all exercises, lesson quizzes, mistake review, spaced review, advanced progress, and the full vocabulary tester.")]
  ];

  return `
    <section class="plan-grid ${compact ? "compact" : ""}">
      ${rows.map(([title, body], index) => {
        const premium = index === 1;
        const current = (premium && hasPremiumAccess()) || (!premium && !hasPremiumAccess());
        return `
          <article class="card plan-card ${premium ? "premium" : ""} ${current ? "current" : ""}">
            <div class="card-heading">
              <div>
                <p class="section-label">${current ? t("currentPlan", "Current plan") : t("included", "Included")}</p>
                <h3>${title}</h3>
              </div>
              <span class="pill">${premium ? t("premiumPlan", "Premium") : t("freePlan", "Free")}</span>
            </div>
            <p>${body}</p>
          </article>
        `;
      }).join("")}
    </section>
  `;
}

function renderPremiumInline(labelKey, body) {
  return `
    <section class="premium-inline">
      <div>
        <p class="section-label">${t(labelKey, "Premium")}</p>
        <h3>${t("premiumFeature", "Premium feature")}</h3>
        <p>${escapeHtml(body)}</p>
      </div>
      <button class="ghost-button compact-button" type="button" data-route="subscription">${t("viewPlan", "View plan")}</button>
    </section>
  `;
}

function renderContinueCard(lesson) {
  const book = getBook(lesson.bookSlug);
  const progress = lessonProgressPercent(lesson.bookSlug);
  return `
    <article class="card continue-card">
      <div>
        <div class="card-heading">
          <div>
            <p class="section-label">${t("continueLearning", "Continue Learning")}</p>
            <h2>${isBengali() ? escapeHtml(localizedLessonTitle(lesson)) : `Lesson ${lesson.number}: ${escapeHtml(lesson.title)}`}</h2>
          </div>
          <span class="pill">${escapeHtml(localizedBookTitle(book))}</span>
        </div>
        <button class="arabic-line" type="button" data-speak="${escapeHtml(lesson.arabic)}" lang="ar">${lesson.arabic}</button>
        <p class="translation">${escapeHtml(localizedText(lesson.translation))}</p>
        <div class="progress-row">
          <div class="bar"><span style="width:${progress}%"></span></div>
          <strong>${progress}%</strong>
        </div>
      </div>
      <div class="continue-side">
        <div class="motif" aria-hidden="true">${icon("book")}</div>
        <button class="primary-button" type="button" data-lesson="${lesson.id}">
          ${t("continue", "Continue")} ${icon("arrow")}
        </button>
      </div>
    </article>
  `;
}

function renderQuickAccess() {
  const visibleVocabulary = state.data.vocabulary.filter((word) => canAccessBookSlug(word.bookSlug));
  const currentLesson = getCurrentLesson();
  const cards = [
    { route: currentLesson.bookSlug, label: t("nextLesson", "Next lesson"), icon: "book", value: `${t("lesson", "Lesson")} ${currentLesson.number}` },
    { route: "vocabulary", label: t("vocabulary", "Vocabulary"), icon: "words", value: `${visibleVocabulary.length} ${t("words", "words")}` },
    { route: "review", label: t("review", "Review"), icon: "target", value: `${mistakeItems().length} ${t("mistakes", "mistakes")}` },
    { route: "subscription", label: t("subscription", "Subscription"), icon: "spark", value: hasPremiumAccess() ? t("premiumPlan", "Premium") : t("freePlan", "Free") }
  ];

  return `
    <section class="quick-grid" aria-label="${t("quickAccess", "Quick access")}">
      ${cards
        .map((card) => {
          const locked = isAuthenticated() && routeRequiresPremium(card.route);
          return `
            <button class="quick-card ${locked ? "locked" : ""}" type="button" data-route="${card.route}">
              <span class="quick-icon">${icon(locked ? "lock" : card.icon)}</span>
              <span><strong>${card.label}</strong><small>${locked ? t("lockedPremium", "Premium") : card.value}</small></span>
            </button>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderBook(bookSlug) {
  const book = getBook(bookSlug);
  const bookLessons = lessonsForBook(bookSlug);
  const lesson = selectedLessonForBook(bookSlug);
  if (!lesson) return renderLockedBook();
  const lessonVocabulary = state.data.vocabulary.filter((word) => lesson.vocabularyIds.includes(word.id));
  const lessonGrammar = state.data.grammar.filter((rule) => lesson.grammarIds.includes(rule.id));
  const complete = state.progress.completedLessonIds.includes(lesson.id);

  return `
    <section class="lesson-layout">
      <aside class="lesson-list card">
        <div class="panel-heading">
          <p class="section-label">${escapeHtml(localizedBookTitle(book))}</p>
          <h2>${t("lessons", "Lessons")}</h2>
        </div>
        ${bookLessons
          .map((item) => renderLessonListItem(item, lesson.id))
          .join("")}
      </aside>
      <article class="lesson-reader card">
        <div class="card-heading">
          <div>
            <p class="section-label">${t("lesson", "Lesson")} ${lesson.number}</p>
            <h2>${escapeHtml(localizedLessonTitle(lesson))}</h2>
          </div>
          <div class="lesson-heading-actions">
            ${renderBookmarkButton("lessons", lesson.id)}
            ${renderMasteryChip(lesson)}
            ${renderReportIssueForm({ kind: "lesson", itemId: lesson.id, lessonId: lesson.id, bookSlug: lesson.bookSlug })}
          </div>
        </div>
        ${renderMobileLessonPicker(book, lesson, bookLessons)}
        ${renderMobileLessonSession(lesson, lessonVocabulary, complete)}
        ${state.lessonTab === "learn" ? renderMobileStudyDeck(lesson, lessonVocabulary) : ""}
        <p class="focus">${escapeHtml(localizedLessonFocus(lesson))}</p>
        ${renderLessonMapStrip(bookSlug, lesson)}
        ${renderLessonPath(lesson)}
        <div class="lesson-tabs" role="tablist" aria-label="${t("lessonSections", "Lesson sections")}">
          ${[
            ["learn", t("learn", "Learn")],
            ["book-exercises", t("exercises", "Book Exercises")],
            ["quiz", t("quiz", "Quiz")],
            ["review", t("review", "Review")]
          ]
            .map(
              ([id, label]) => `
                <button class="lesson-tab ${state.lessonTab === id ? "active" : ""} ${canAccessLessonTab(id) ? "" : "locked"}" type="button" data-lesson-tab="${id}" role="tab" aria-selected="${state.lessonTab === id}">
                  ${canAccessLessonTab(id) ? "" : icon("lock")} ${label}
                </button>
              `
            )
            .join("")}
        </div>
        ${renderLessonTabContent(lesson, lessonVocabulary, lessonGrammar, complete)}
      </article>
    </section>
  `;
}

function renderMobileLessonPicker(book, lesson, bookLessons) {
  return `
    <section class="mobile-lesson-picker" aria-label="${t("lessonPicker", "Lesson picker")}">
      <div>
        <p class="section-label">${escapeHtml(localizedBookTitle(book))}</p>
        <strong>${t("lesson", "Lesson")} ${lesson.number} ${t("of", "of")} ${bookLessons.length}</strong>
      </div>
      <label>
        <span>${t("chooseLesson", "Choose lesson")}</span>
        <select data-lesson-select>
          ${bookLessons.map((item) => `
            <option value="${escapeHtml(item.id)}" ${item.id === lesson.id ? "selected" : ""}>
              ${t("lesson", "Lesson")} ${escapeHtml(item.number)} - ${escapeHtml(localizedLessonTitle(item))}
            </option>
          `).join("")}
        </select>
      </label>
    </section>
  `;
}

function renderMobileLessonSession(lesson, lessonVocabulary, complete) {
  const due = dueVocabularyItems(lesson).length;
  const learned = lessonVocabulary.filter((word) => state.progress.learnedVocabularyIds.includes(word.id)).length;
  return `
    <section class="mobile-session-panel" aria-label="${t("mobileLessonFlow", "Mobile lesson flow")}">
      <div>
        <p class="section-label">${t("fiveMinuteSession", "5-minute session")}</p>
        <strong>${complete ? t("lessonReadyToReview", "Ready to review") : t("startWithLearn", "Start with Learn")}</strong>
      </div>
      <div class="mobile-session-steps">
        ${[
          ["learn", t("learn", "Learn"), true],
          ["book-exercises", t("practice", "Practice"), hasPremiumAccess()],
          ["quiz", t("quiz", "Quiz"), hasPremiumAccess()],
          ["review", t("review", "Review"), hasPremiumAccess()]
        ].map(([id, label, allowed]) => `
          <button class="${state.lessonTab === id ? "active" : ""} ${allowed ? "" : "locked"}" type="button" data-lesson-tab="${id}">
            ${allowed ? "" : icon("lock")} ${label}
          </button>
        `).join("")}
      </div>
      <div class="mobile-session-meta">
        <span>${learned}/${lessonVocabulary.length} ${t("words", "words")}</span>
        <span>${due} ${t("due", "due")}</span>
      </div>
    </section>
  `;
}

function renderLessonMapStrip(bookSlug, selectedLesson) {
  const lessons = lessonsForBook(bookSlug);
  return `
    <section class="lesson-map-strip" aria-label="${t("lessonPathMap", "Lesson path map")}">
      ${lessons.map((lesson) => {
        const complete = state.progress.completedLessonIds.includes(lesson.id);
        return `
          <button class="lesson-dot ${complete ? "done" : ""} ${lesson.id === selectedLesson.id ? "active" : ""} ${lessonMasteryStatus(lesson).key}" type="button" data-lesson="${lesson.id}" aria-label="${t("lesson", "Lesson")} ${lesson.number}">
            ${complete ? icon("check") : escapeHtml(String(lesson.number))}
          </button>
        `;
      }).join("")}
    </section>
  `;
}

function renderLessonTabContent(lesson, lessonVocabulary, lessonGrammar, complete) {
  if (!canAccessLessonTab(state.lessonTab)) {
    return renderUpgradeGate("lessonTab", true);
  }

  if (state.lessonTab === "book-exercises") {
    return renderLessonBookExercises(lesson, lessonVocabulary);
  }

  if (state.lessonTab === "quiz") {
    return renderLessonQuiz(lesson, lessonVocabulary);
  }

  if (state.lessonTab === "review") {
    return renderLessonReview(lesson, lessonVocabulary);
  }

  return renderLessonLearn(lesson, lessonVocabulary, lessonGrammar, complete);
}

function renderLessonPath(lesson) {
  const steps = [
    ["learn", t("learn", "Learn")],
    ["book-exercises", t("practice", "Practice")],
    ["quiz", t("quiz", "Quiz")],
    ["review", t("review", "Review")]
  ];
  return `
    <section class="lesson-path" aria-label="${t("guidedLessonPath", "Guided lesson path")}">
      <div>
        <p class="section-label">${t("lessonPath", "Lesson Path")}</p>
        ${renderMasteryChip(lesson)}
      </div>
      <div class="path-steps">
        ${steps
          .map(
            ([id, label], index) => `
              <button class="path-step ${state.lessonTab === id ? "active" : ""} ${canAccessLessonTab(id) ? "" : "locked"}" type="button" data-lesson-tab="${id}">
                <span>${index + 1}</span>
                <strong>${canAccessLessonTab(id) ? "" : icon("lock")} ${label}</strong>
              </button>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderAchievementCard(lesson, lessonVocabulary, complete) {
  if (!complete) return "";
  const learned = lessonVocabulary.filter((word) => state.progress.learnedVocabularyIds.includes(word.id)).length;
  const nextLesson = byId(state.data.lessons, nextLessonId(lesson.id));
  return `
    <section class="achievement-card">
      <span class="quick-icon">${icon("spark")}</span>
      <div>
        <p class="section-label">${t("achievement", "Achievement")}</p>
        <h3>${t("lessonCompleted", "Lesson completed")}</h3>
        <p>${learned}/${lessonVocabulary.length} ${t("lessonWordsTracked", "lesson words tracked")} · ${lessonMastery(lesson)}% ${t("mastery", "mastery")}</p>
      </div>
      ${nextLesson && nextLesson.id !== lesson.id ? `<button class="ghost-button compact-button" type="button" data-lesson="${nextLesson.id}">${t("nextLesson", "Next lesson")} ${icon("arrow")}</button>` : ""}
    </section>
  `;
}

function renderLessonExamples(lesson, lessonVocabulary = []) {
  const examples = (lesson.examples?.length ? lesson.examples : [
    {
      label: "A",
      title: "Foundation",
      source: "Book model",
      arabic: lesson.arabic,
      translation: lesson.translation
    }
  ]).slice(0, 3);

  return `
    <section class="lesson-examples-panel">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${t("examples", "Examples")}</p>
          <h3>${t("lessonPattern", "Lesson Pattern")}</h3>
        </div>
        <span class="pill">${examples.length} ${t("total", "total")}</span>
      </div>
      <div class="lesson-example-list">
        ${examples
          .map((example, index) => {
            const exampleId = `example-${lesson.id}-${index + 1}`;
            return `
            <article class="lesson-example-card">
              <span class="example-step">${escapeHtml(example.label)}</span>
              <div>
                <div class="example-meta">
                  <strong>${escapeHtml(localizedDifficultyLabel(example.title))}</strong>
                  <small>${escapeHtml(localizedSourceLabel(example.source))}</small>
                </div>
                <button class="lesson-example-arabic" type="button" data-speak="${escapeHtml(example.arabic)}" lang="ar">${example.arabic}</button>
                ${renderArabicWordInspector(example.arabic, lessonVocabulary)}
                <div class="content-actions">
                  ${renderBookmarkButton("examples", exampleId)}
                  ${renderReportIssueForm({ kind: "example", itemId: exampleId, lessonId: lesson.id, bookSlug: lesson.bookSlug })}
                </div>
                <details class="answer-reveal">
                  <summary>
                    <span>${t("viewAnswer", "View answer")}</span>
                    ${icon("arrow")}
                  </summary>
                  <p class="translation">${escapeHtml(localizedText(example.translation))}</p>
                </details>
              </div>
            </article>
          `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderReadingModePanel(lesson, lessonVocabulary) {
  return `
    <section class="reading-mode-panel">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${t("readingMode", "Reading mode")}</p>
          <h3>${t("tapWordsToInspect", "Tap words to inspect")}</h3>
        </div>
        <span class="pill">${lessonVocabulary.length} ${t("words", "words")}</span>
      </div>
      <div class="reading-mode-sentence">
        ${renderArabicWordInspector(lesson.arabic, lessonVocabulary)}
      </div>
    </section>
  `;
}

function renderMobileStudyDeck(lesson, lessonVocabulary) {
  const examples = (lesson.examples || []).slice(0, 2);
  const focusWords = lessonVocabulary.slice(0, 5);
  return `
    <section class="mobile-study-deck" aria-label="${t("mobileStudyFlow", "Mobile study flow")}">
      <article class="mobile-study-card primary">
        <p class="section-label">${t("stepOne", "Step 1")}</p>
        <h3>${t("listenAndRead", "Listen and read")}</h3>
        <button class="mobile-study-arabic" type="button" data-speak="${escapeHtml(lesson.arabic)}" lang="ar">${lesson.arabic}</button>
        <small>${t("tapArabicForAudio", "Tap the Arabic for audio.")}</small>
      </article>
      <article class="mobile-study-card">
        <p class="section-label">${t("stepTwo", "Step 2")}</p>
        <h3>${t("revealMeaning", "Reveal meaning")}</h3>
        <details class="answer-reveal">
          <summary><span>${t("viewAnswer", "View answer")}</span>${icon("arrow")}</summary>
          <p class="translation">${escapeHtml(localizedText(lesson.translation))}</p>
        </details>
        ${examples[0] ? `<button class="example-arabic compact-arabic" type="button" data-speak="${escapeHtml(examples[0].arabic)}" lang="ar">${escapeHtml(examples[0].arabic)}</button>` : ""}
      </article>
      <article class="mobile-study-card">
        <p class="section-label">${t("stepThree", "Step 3")}</p>
        <h3>${t("wordBreakdown", "Word breakdown")}</h3>
        ${renderArabicWordInspector(lesson.arabic, lessonVocabulary)}
      </article>
      <article class="mobile-study-card">
        <p class="section-label">${t("stepFour", "Step 4")}</p>
        <h3>${t("quickWords", "Quick words")}</h3>
        <div class="mobile-mini-word-grid">
          ${focusWords.map((word) => `
            <button type="button" data-speak="${escapeHtml(word.arabic)}">
              <span lang="ar">${escapeHtml(word.arabic)}</span>
              <small>${escapeHtml(localizedText(word.english))}</small>
            </button>
          `).join("") || `<p class="empty-state">${t("noVocabularyMatches", "No vocabulary matches this selection.")}</p>`}
        </div>
      </article>
      <article class="mobile-study-card action">
        <p class="section-label">${t("stepFive", "Step 5")}</p>
        <h3>${hasPremiumAccess() ? t("consolidatePractice", "Consolidate practice") : t("saveProgress", "Save progress")}</h3>
        <p>${hasPremiumAccess() ? t("mobilePracticePrompt", "Move into a short exercise or quiz when this card feels familiar.") : t("mobileFreePrompt", "Mark the lesson complete, then upgrade when you want exercises and quizzes.")}</p>
        <button class="primary-button" type="button" ${hasPremiumAccess() ? `data-open-lesson="${escapeHtml(lesson.id)}" data-open-lesson-tab="book-exercises"` : `data-complete="${escapeHtml(lesson.id)}"`}>
          ${hasPremiumAccess() ? t("practiceNext", "Practice next") : t("markComplete", "Mark complete")} ${icon("arrow")}
        </button>
      </article>
    </section>
  `;
}

function renderGrammarExplanation(lesson) {
  const explanation = lesson.grammarExplanation;
  if (!explanation) return "";

  return `
    <section class="grammar-explanation-panel">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${t("whatYouAreLearning", "What You Are Learning")}</p>
          <h3>${t("grammarExplained", "Grammar Explained")}</h3>
        </div>
        <span class="pill">${t("lesson", "Lesson")} ${escapeHtml(lesson.number)}</span>
      </div>
      <div class="grammar-explanation-grid">
        <article class="grammar-explanation-card primary">
          <span>${t("rule", "Rule")}</span>
          <p>${escapeHtml(localizedText(explanation.rule))}</p>
        </article>
        <article class="grammar-explanation-card example">
          <span>${t("simpleExample", "Simple Example")}</span>
          <button class="example-arabic" type="button" data-speak="${escapeHtml(explanation.example)}" lang="ar">${escapeHtml(explanation.example)}</button>
          ${explanation.exampleTranslation ? `<small>${escapeHtml(localizedText(explanation.exampleTranslation))}</small>` : ""}
        </article>
        <article class="grammar-explanation-card">
          <span>${t("commonMistake", "Common Mistake")}</span>
          <p>${escapeHtml(localizedText(explanation.commonMistake))}</p>
        </article>
        <article class="grammar-explanation-card">
          <span>${t("miniSummary", "Mini Summary")}</span>
          <p>${escapeHtml(localizedText(explanation.summary))}</p>
        </article>
      </div>
    </section>
  `;
}

function renderMorphologyCards(lesson) {
  const cards = lesson.morphologyCards || [];
  if (!cards.length) return "";
  const formLabels = {
    past: t("past", "Past"),
    present: t("present", "Present"),
    command: t("command", "Command"),
    verbalNoun: t("verbalNoun", "Verbal Noun"),
    activeParticiple: t("activeParticiple", "Active Participle"),
    passiveParticiple: t("passiveParticiple", "Passive Participle")
  };

  return `
    <section class="morphology-panel">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${t("verbsAndPatterns", "Verbs And Patterns")}</p>
          <h3>${t("morphologyCards", "Morphology Cards")}</h3>
        </div>
        <span class="pill">${cards.length} ${t("cards", "cards")}</span>
      </div>
      <div class="morphology-grid">
        ${cards
          .map((card) => `
            <article class="morphology-card">
              <div class="morphology-card-head">
                <button class="morphology-title" type="button" data-speak="${escapeHtml(card.title)}" lang="ar">${escapeHtml(card.title)}</button>
                <p>${escapeHtml(localizedText(card.meaning))}</p>
              </div>
              <div class="morphology-meta">
                <span><strong>${t("root", "Root")}</strong> <b lang="ar">${escapeHtml(card.root)}</b></span>
                <span><strong>${t("pattern", "Pattern")}</strong> <b lang="ar">${escapeHtml(card.pattern)}</b></span>
              </div>
              <dl class="morphology-forms">
                ${Object.entries(formLabels)
                  .filter(([key]) => card.forms?.[key])
                  .map(([key, label]) => `
                    <div>
                      <dt>${label}</dt>
                      <dd><button type="button" data-speak="${escapeHtml(card.forms[key])}" lang="ar">${escapeHtml(card.forms[key])}</button></dd>
                    </div>
                  `)
                  .join("")}
              </dl>
              ${card.note ? `<p class="morphology-note">${escapeHtml(localizedText(card.note))}</p>` : ""}
            </article>
          `)
          .join("")}
      </div>
    </section>
  `;
}

function renderLessonLearn(lesson, lessonVocabulary, lessonGrammar, complete) {
  return `
        ${renderAchievementCard(lesson, lessonVocabulary, complete)}
        ${renderLessonExamples(lesson, lessonVocabulary)}
        ${renderReadingModePanel(lesson, lessonVocabulary)}
        ${renderGrammarExplanation(lesson)}
        ${renderMorphologyCards(lesson)}
        <div class="lesson-sections">
          <section>
            <h3>${t("vocabulary", "Vocabulary")}</h3>
            <div class="word-grid">
              ${lessonVocabulary
                .map((word) => {
                  const status = vocabularyStatus(word);
                  return `
                    <article class="word-chip-card status-${status}">
                      <button class="word-chip status-${status}" type="button" data-speak="${escapeHtml(word.arabic)}">
                        <span lang="ar">${word.arabic}</span>
                        <small>${escapeHtml(localizedText(word.english))}</small>
                        <em>${vocabularyStatusLabel(status)} · ${reviewScheduleText(word)}</em>
                      </button>
                      <div class="content-actions compact">
                        ${renderBookmarkButton("vocabulary", word.id)}
                        ${renderReportIssueForm({ kind: "vocabulary", itemId: word.id, lessonId: lesson.id, bookSlug: lesson.bookSlug })}
                      </div>
                    </article>
                  `;
                })
                .join("")}
            </div>
          </section>
          <section>
            <h3>${t("grammar", "Grammar")}</h3>
            ${lessonGrammar
              .map(
                (rule) => `
                  <div class="grammar-note">
                    <strong>${escapeHtml(localizedGrammarTitle(rule))}</strong>
                    <p>${escapeHtml(localizedGrammarSummary(rule))}</p>
                    <span class="arabic mini" lang="ar">${rule.example}</span>
                  </div>
                `
              )
              .join("")}
          </section>
        </div>
        <div class="lesson-detail-grid">
          <section class="detail-panel">
            <h3>${t("lessonNotes", "Lesson Notes")}</h3>
            <ul class="note-list">
              ${(lesson.notes || [])
                .map((note) => `<li>${escapeHtml(localizedText(note))}</li>`)
                .join("")}
            </ul>
          </section>
          <section class="detail-panel">
            <h3>${t("exercisesFromKey", "Exercises From The Key")}</h3>
            <ul class="note-list">
              ${(lesson.exercisePrompts || [])
                .slice(0, 9)
                .map((prompt) => `<li>${escapeHtml(localizedText(prompt))}</li>`)
                .join("") || `<li>${localizedText("No OCR exercise prompts were found for this lesson.")}</li>`}
            </ul>
          </section>
        </div>
        <div class="lesson-actions">
          <button class="ghost-button" type="button" data-speak="${escapeHtml(lesson.arabic)}">${icon("speaker")} ${t("playAudio", "Play audio")}</button>
          <button class="primary-button" type="button" data-complete="${lesson.id}">${complete ? t("reviewComplete", "Review complete") : t("markComplete", "Mark complete")} ${icon("check")}</button>
        </div>
  `;
}

function renderLessonBookExercises(lesson, lessonVocabulary) {
  const cards = getLessonExerciseCards(lesson, lessonVocabulary);
  return `
    <section class="book-exercise-panel">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${t("lesson", "Lesson")} ${lesson.number}</p>
          <h3>${t("bookExercises", "Book Exercises")}</h3>
        </div>
        <span class="pill">${cards.length} ${t("sections", "sections")}</span>
      </div>
      <div class="book-exercise-accordion">
        ${cards
          .map((card, index) => {
            const done = state.progress.exerciseAttempts[card.id] === "complete";
            const usesCheckedBuilder = checkedPracticeUsesBuilder(card);
            return `
              <details class="book-exercise-item ${done ? "done" : ""}" ${index === 0 ? "open" : ""}>
                <summary>
                  <span class="exercise-letter">${card.label}</span>
                  <span>
                    <strong>${escapeHtml(localizedText(card.title))}</strong>
                    <small>${escapeHtml(localizedText(card.bookPrompt))}</small>
                  </span>
                  <em>${done ? `${icon("check")} ${t("done", "Done")}` : t("practice", "Practice")}</em>
                </summary>
                <div class="book-exercise-body">
	                  <div class="practice-task">
	                    <strong>${t("practiceTask", "Practice task")}</strong>
	                    <p>${escapeHtml(localizedText(card.practice))}</p>
	                  </div>
	                  <div class="content-actions">
	                    ${renderBookmarkButton("exercises", card.id)}
	                    ${renderReportIssueForm({ kind: "exercise", itemId: card.id, lessonId: lesson.id, bookSlug: lesson.bookSlug })}
	                  </div>
	                  ${renderExampleQuestions(card.examples)}
                  ${renderCheckedPractice(card)}
                  ${card.words.length && !usesCheckedBuilder ? `<div class="chip-row">${card.words.map((word) => `<button type="button" data-speak="${escapeHtml(word.arabic)}" lang="ar">${word.arabic}</button>`).join("")}</div>` : ""}
                  <button class="${done ? "ghost-button" : "primary-button"}" type="button" data-book-exercise-complete="${card.id}">
                    ${done ? t("completed", "Completed") : t("markPracticeDone", "Mark practice done")} ${icon("check")}
                  </button>
                </div>
              </details>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function getLessonExerciseCards(lesson, lessonVocabulary) {
  const prompts = [
    ...(lesson.exercisePrompts || []),
    ...fallbackExercisePrompts(lesson)
  ].slice(0, Math.max(5, (lesson.exercisePrompts || []).length));

  return prompts.map((prompt, index) => {
    const label = exerciseLetter(index);
    const cleanPrompt = prompt.replace(/^Ex\.\d+:\s*/, "");
    const words = wordsForExercise(lessonVocabulary, index);
    return {
      id: `book-${lesson.id}-${index + 1}`,
      label,
      title: exerciseTitle(cleanPrompt),
      bookPrompt: cleanPrompt,
      practice: exercisePractice(cleanPrompt, lesson, words),
      examples: exerciseExamples(cleanPrompt, lesson, words),
      checked: checkedPractice(cleanPrompt, lesson, words),
      words
    };
  });
}

function renderCheckedPractice(card) {
  const feedback = state.writingFeedback[card.id];
  const showArabicPrompt = card.checked.arabic && !isSameArabicText(card.checked.arabic, card.checked.answer);
  const usesBuilder = checkedPracticeUsesBuilder(card);
  const tokens = checkedPracticeTokens(card);
  const selected = checkedPracticeSelection(card.id);
  const selectedTokens = selected.map((index) => tokens[index]).filter(Boolean);
  const answered = Boolean(feedback);
  const complete = selected.length === tokens.length;
  return `
    <form class="checked-practice" data-book-exercise-check="${card.id}" data-answer="${escapeHtml(card.checked.answer)}" data-prompt="${escapeHtml(card.checked.prompt)}" data-arabic="${escapeHtml(card.checked.arabic || "")}">
      <div>
        <strong>${t("checkedPractice", "Checked practice")}</strong>
        <p>${escapeHtml(localizedText(card.checked.prompt))}</p>
        ${showArabicPrompt ? `<button class="example-arabic" type="button" data-speak="${escapeHtml(card.checked.arabic)}" lang="ar">${card.checked.arabic}</button>` : ""}
      </div>
      ${usesBuilder ? `
        <input type="hidden" name="checkedAnswer" value="${escapeHtml(selectedTokens.join(" "))}" />
        <div class="sentence-builder-stage checked-builder-stage">
          <div class="sentence-builder-answer checked-builder-answer" dir="rtl" lang="ar" aria-label="${t("yourAnswer", "Your answer")}">
            ${selectedTokens.length
              ? selectedTokens
                  .map((token, index) => `
                    <button class="sentence-answer-token checked-answer-token" type="button" data-checked-remove="${card.id}" data-checked-position="${index}" ${answered ? "disabled" : ""}>
                      ${escapeHtml(token)}
                    </button>
                  `)
                  .join("")
              : `<span class="sentence-answer-placeholder">${t("chooseWordsToBuildAnswer", "Choose words below to build the answer")}</span>`}
          </div>
          <div class="sentence-builder-actions">
            <button class="ghost-button compact-button" type="button" data-checked-reset="${card.id}" ${answered || !selected.length ? "disabled" : ""}>
              ${t("clear", "Clear")}
            </button>
            <button class="ghost-button compact-button" type="submit" ${complete && !answered ? "" : "disabled"}>
              ${t("checkAnswer", "Check answer")} ${icon("check")}
            </button>
          </div>
        </div>
        <div class="scramble-row sentence-word-bank checked-word-bank" dir="rtl" lang="ar" aria-label="${t("wordBank", "Word bank")}">
          ${checkedPracticeTokenBank(card).map(({ token, index }) => `
            <button class="sentence-word-token checked-word-token ${selected.includes(index) ? "selected" : ""}" type="button" data-checked-token="${card.id}" data-checked-index="${index}" ${selected.includes(index) || answered ? "disabled" : ""}>
              ${escapeHtml(token)}
            </button>
          `).join("")}
        </div>
      ` : `
        <label class="checked-input">
          <span>${t("yourAnswer", "Your answer")}</span>
          <input name="checkedAnswer" dir="auto" autocomplete="off" ${answered ? "disabled" : ""} />
        </label>
        <button class="ghost-button" type="submit" ${answered ? "disabled" : ""}>${t("checkAnswer", "Check answer")} ${icon("check")}</button>
      `}
      ${feedback ? `
        <div class="feedback ${feedback.status === "correct" ? "correct" : "incorrect"}">
          ${icon(feedback.status === "correct" ? "check" : "x")}
          <span>${feedback.status === "correct" ? t("correct", "Correct") : t("notQuiteShort", "Not quite.")}</span>
          ${renderRetryButton("checked-practice", { exerciseId: card.id })}
        </div>
        ${feedback.status === "correct" ? "" : renderModelAnswerReveal(feedback.expected, { arabic: card.checked.arabic || "" })}
      ` : ""}
    </form>
  `;
}

function checkedPractice(prompt, lesson, words) {
  const lower = prompt.toLowerCase();
  const quiz = state.data.exercises.find((item) => item.lessonId === lesson.id);
  const target = words[0];

  if (lower.includes("answer") && quiz) {
    return {
      prompt: quiz.prompt,
      arabic: quiz.arabic,
      answer: quiz.answer
    };
  }

  if (lower.includes("fill") && target) {
    return {
      prompt: `Write the Arabic word that means "${target.english}".`,
      answer: target.arabic
    };
  }

  if (target && (lower.includes("match") || lower.includes("vocabulary"))) {
    return {
      prompt: `Write the English meaning of this word.`,
      arabic: target.arabic,
      answer: target.english
    };
  }

  return {
    prompt: "Type the Arabic model sentence from memory.",
    arabic: "",
    answer: lesson.arabic
  };
}

function renderExampleQuestions(examples) {
  if (!examples.length) return "";

  return `
    <div class="example-question-panel">
      <strong>${t("exampleQuestions", "Example questions")}</strong>
      <div class="example-question-list">
        ${examples
          .map((example) => {
            const showArabicPrompt = example.arabic && !isSameArabicText(example.arabic, example.answer);
            return `
              <article class="example-question">
                <p>${escapeHtml(localizedText(example.question))}</p>
                ${showArabicPrompt ? `<button class="example-arabic" type="button" data-speak="${escapeHtml(example.arabic)}" lang="ar">${example.arabic}</button>` : ""}
                ${example.answer ? `
                  <details class="example-answer">
                    <summary><span>${t("revealAnswer", "Reveal answer")}</span>${icon("arrow")}</summary>
                    <div class="example-answer-content">
                      <span class="answer-kicker">${t("answer", "Answer")}</span>
                      ${renderAnswerDisplay(example.answer, { answerArabic: example.answerArabic || "" }, {
                        includeSourceContext: false,
                        excludeArabic: example.arabic || "",
                        className: hasArabic(example.answer) ? "arabic-answer" : ""
                      })}
                    </div>
                  </details>
                ` : ""}
              </article>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function exerciseExamples(prompt, lesson, words) {
  const lower = prompt.toLowerCase();
  const quiz = state.data.exercises.find((item) => item.lessonId === lesson.id);
  const examples = [];
  const add = (example) => {
    if (!example?.question) return;
    const key = `${example.question}|${example.arabic || ""}`;
    if (examples.some((item) => `${item.question}|${item.arabic || ""}` === key)) return;
    examples.push(example);
  };

  if (lower.includes("answer") && quiz) {
    add({ question: quiz.prompt, arabic: quiz.arabic, answer: quiz.answer });
  }

  if (lower.includes("fill")) {
    const blank = blankSentenceExample(lesson, words);
    add(blank);
  }

  if (lower.includes("read")) {
    add({ question: "Read this aloud, then write it from memory.", arabic: lesson.arabic, answer: "Compare your writing with the model sentence." });
  }

  if (lower.includes("match")) {
    words.slice(0, 2).forEach((word) => {
      add({ question: `Match this Arabic word to its English meaning.`, arabic: word.arabic, answer: word.english });
    });
  }

  if (lower.includes("plural") || lower.includes("count")) {
    add({ question: "Use this word in the requested number pattern.", arabic: words[0]?.arabic || lesson.arabic, answer: words[0]?.english || lesson.translation });
  }

  add({ question: "Translate this sentence into English.", arabic: lesson.arabic, answer: lesson.translation });

  words.slice(0, 4).forEach((word, index) => {
    if (index % 2 === 0) {
      add({ question: "What does this word mean?", arabic: word.arabic, answer: word.english });
    } else {
      add({ question: `Which Arabic word means "${word.english}"?`, answer: word.arabic });
    }
  });

  if (quiz) {
    add({ question: quiz.prompt, arabic: quiz.arabic, answer: quiz.answer });
  }

  return examples.slice(0, 3);
}

function blankSentenceExample(lesson, words) {
  const word = words.find((item) => lesson.arabic.includes(item.arabic));
  if (word) {
    return {
      question: "Fill the blank, then read the full sentence.",
      arabic: lesson.arabic.replace(word.arabic, "_____"),
      answer: word.arabic
    };
  }

  const fallback = words[0];
  if (fallback) {
    return {
      question: `Write the Arabic word that means "${fallback.english}".`,
      answer: fallback.arabic
    };
  }

  return {
    question: "Fill the blank using the lesson sentence pattern.",
    arabic: lesson.arabic.replace(/[\u0600-\u06FF][\u0600-\u06FF\u064B-\u0652\u0670]*/, "_____"),
    answer: lesson.arabic
  };
}

function hasArabic(value) {
  return /[\u0600-\u06FF]/.test(value);
}

function fallbackExercisePrompts(lesson) {
  return [
    "Read and copy the lesson examples with the correct endings.",
    "Answer short questions using the lesson pattern.",
    "Fill in blanks with suitable words from this lesson.",
    "Translate between Arabic and English using the lesson vocabulary.",
    `Create five new sentences that follow this model: ${lesson.arabic}`
  ];
}

function exerciseLetter(index) {
  return String.fromCharCode(65 + index);
}

function wordsForExercise(lessonVocabulary, index) {
  if (!lessonVocabulary.length) return [];
  const count = Math.min(4, lessonVocabulary.length);
  const start = (index * 3) % lessonVocabulary.length;
  return Array.from({ length: count }, (_, offset) => lessonVocabulary[(start + offset) % lessonVocabulary.length]);
}

function exerciseTitle(prompt) {
  const lower = prompt.toLowerCase();
  if (lower.includes("answer")) return "Answer Questions";
  if (lower.includes("fill")) return "Fill The Blanks";
  if (lower.includes("change")) return "Transform The Sentence";
  if (lower.includes("plural")) return "Plural Practice";
  if (lower.includes("correct")) return "Correction Drill";
  if (lower.includes("count")) return "Counting Drill";
  if (lower.includes("match")) return "Matching Drill";
  if (lower.includes("read")) return "Read And Write";
  return "Book Practice";
}

function exercisePractice(prompt, lesson, words) {
  const lower = prompt.toLowerCase();
  const wordText = words.map((word) => `${word.arabic} (${word.english})`).join(", ");
  if (lower.includes("answer")) return `Answer using the lesson pattern: ${lesson.arabic}`;
  if (lower.includes("fill")) return `Fill each blank with a suitable word from this lesson${wordText ? `: ${wordText}` : "."}`;
  if (lower.includes("change")) return `Rewrite the example by changing the pronoun, gender, number, or subject requested by the book prompt.`;
  if (lower.includes("plural")) return `Write the singular and plural forms for the lesson nouns, then use one in a sentence.`;
  if (lower.includes("correct")) return `Find the error, correct the ending or pronoun, and read the corrected sentence aloud.`;
  if (lower.includes("count")) return `Count from 3 to 10 using the nouns from this lesson, keeping the ma'dud rule in mind.`;
  if (lower.includes("match")) return `Match the Arabic words to their meanings, then say each pair aloud.`;
  if (lower.includes("read")) return `Read the example aloud, copy it once, then write a similar sentence from memory.`;
  return `Use the lesson example and vocabulary to complete this book exercise.`;
}

function renderLessonReview(lesson, lessonVocabulary) {
  const dueWords = dueVocabularyItems(lesson);
  const mistakes = mistakeItems(lesson);
  return `
    <section class="lesson-review-grid">
      <article class="detail-panel mastery-panel">
        <p class="section-label">${t("mastery", "Mastery")}</p>
        <h3>${lessonMastery(lesson)}%</h3>
        <div class="bar"><span style="width:${lessonMastery(lesson)}%"></span></div>
        <p class="translation">${localizedText("Based on lesson completion, checked exercises, writing practice, quizzes, and vocabulary review.")}</p>
      </article>
      <article class="detail-panel">
        <p class="section-label">${t("spacedRepetition", "Spaced Review")}</p>
        <h3>${dueWords.length} ${t("wordsDue", "words due")}</h3>
        <div class="chip-row">
          ${dueWords.slice(0, 8).map((word) => `<button type="button" data-speak="${escapeHtml(word.arabic)}" lang="ar">${word.arabic}</button>`).join("") || `<span class="empty-state">${t("noDueWords", "No words due right now.")}</span>`}
        </div>
      </article>
      <article class="detail-panel review-wide">
        <div class="subsection-heading">
          <div>
            <p class="section-label">${t("mistakes", "Mistakes")}</p>
            <h3>${localizedText("Lesson Mistakes")}</h3>
          </div>
          <button class="ghost-button compact-button" type="button" data-route="review">${t("openReviewPage", "Open review page")}</button>
        </div>
        ${renderMistakeList(mistakes.slice(0, 4))}
      </article>
    </section>
  `;
}

function renderLessonQuiz(lesson, lessonVocabulary) {
  const exercise = state.data.exercises.find((item) => item.lessonId === lesson.id);
  return `
    <div class="quiz-stack">
      ${exercise ? `
        <section class="lesson-quiz-card">
          <div class="subsection-heading">
            <div>
              <p class="section-label">${t("lesson", "Lesson")} ${lesson.number}</p>
              <h3>${escapeHtml(localizedText(exercise.prompt))}</h3>
              ${renderPromptTermGlosses(exercise.prompt)}
            </div>
            <span class="pill">${localizedText("Lesson Quiz")}</span>
          </div>
          ${renderExerciseArabicPrompt(exercise)}
          <div class="options">
            ${exercise.options
              .map((option) => {
                const answered = Boolean(state.exerciseFeedback[exercise.id]);
                return `
                  <button class="option-button" type="button" data-answer="${escapeHtml(option)}" data-exercise-answer="${exercise.id}" ${answered ? "disabled" : ""}>
                    ${renderExerciseOptionDisplay(option)}
                  </button>
                `;
              })
              .join("")}
          </div>
          ${renderExerciseFeedback(exercise)}
        </section>
      ` : `
        <section class="lesson-quiz-card">
          <h3>${localizedText("Lesson Quiz")}</h3>
          <p class="translation">${localizedText("No lesson quiz has been added for this lesson yet.")}</p>
        </section>
      `}
      ${renderVocabularyQuiz(lesson, lessonVocabulary)}
      ${renderSentenceBuilder(lesson)}
      ${renderMorphologyDrills(lesson)}
      ${renderCumulativeTest(lesson)}
    </div>
  `;
}

function renderVocabularyQuiz(lesson, lessonVocabulary) {
  const quiz = getVocabularyQuiz(lesson, lessonVocabulary);
  if (!quiz) {
    return `
      <section class="lesson-quiz-card vocabulary-quiz-card">
        <h3>${localizedText("Vocabulary Quiz")}</h3>
        <p class="translation">${localizedText("No vocabulary is available for this lesson yet.")}</p>
      </section>
    `;
  }

  const feedback = state.vocabularyQuizFeedback[lesson.id];
  return `
    <section class="lesson-quiz-card vocabulary-quiz-card">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${t("lesson", "Lesson")} ${lesson.number} ${t("vocabulary", "Vocabulary")}</p>
          <h3>${localizedText("Random Vocabulary Quiz")}</h3>
        </div>
        <button class="ghost-button compact-button" type="button" data-vocab-quiz-new="${lesson.id}">
          ${icon("spark")} ${t("generateNew", "Generate new")}
        </button>
      </div>
      <div class="vocabulary-quiz-display">
        <p>${escapeHtml(localizedText(normalizedQuizPrompt(quiz)))}</p>
        ${quiz.arabic ? `<button class="arabic-hero vocab-quiz-arabic" type="button" data-speak="${escapeHtml(quiz.arabic)}" lang="ar">${quiz.arabic}</button>` : `<strong>${escapeHtml(localizedOption(quiz.display))}</strong>`}
      </div>
        <div class="options vocabulary-options ${state.motion.tester ? "shuffle-in" : ""}">
        ${quiz.options
          .map((option) => {
            const answered = Boolean(feedback);
            const isCorrect = answered && feedback.status === "correct" && option === quiz.answer;
            const isWrong = answered && option === feedback.answer && option !== quiz.answer;
            return `
              <button class="option-button vocab-option ${isCorrect ? "correct-option" : ""} ${isWrong ? "incorrect-option" : ""}" type="button" data-vocab-quiz-answer="${escapeHtml(option)}" data-vocab-quiz-lesson="${lesson.id}" ${answered ? "disabled" : ""}>
                <span ${hasArabic(option) ? 'class="arabic-option" lang="ar"' : ""}>${escapeHtml(localizedOption(option))}</span>
              </button>
            `;
          })
          .join("")}
      </div>
      ${renderVocabularyQuizFeedback(lesson.id, quiz)}
    </section>
  `;
}

function renderSentenceBuilder(lesson) {
  const builder = getSentenceBuilder(lesson);
  if (!builder) return "";
  const feedback = state.sentenceBuilderFeedback[lesson.id];
  const correct = feedback?.status === "correct";
  const selected = sentenceBuilderSelection(lesson.id);
  const selectedTokens = selected.map((index) => builder.tokens[index]).filter(Boolean);
  const answered = Boolean(feedback);
  const complete = selected.length === builder.tokens.length;

  return `
    <section class="lesson-quiz-card practice-tool-card">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${t("sentenceBuilder", "Sentence Builder")}</p>
          <h3>${localizedText("Rebuild the model sentence")}</h3>
        </div>
        <span class="pill">${t("premiumPractice", "Premium practice")}</span>
      </div>
      <form class="sentence-builder-form" data-sentence-builder="${lesson.id}">
        <input type="hidden" name="sentenceAnswer" value="${escapeHtml(selectedTokens.join(" "))}" />
        <div class="sentence-builder-stage">
          <div class="sentence-builder-answer" dir="rtl" lang="ar" aria-label="${t("yourSentence", "Your sentence")}">
            ${selectedTokens.length
              ? selectedTokens
                  .map((token, index) => `
                    <button class="sentence-answer-token" type="button" data-sentence-remove="${lesson.id}" data-sentence-position="${index}" ${answered ? "disabled" : ""}>
                      ${escapeHtml(token)}
                    </button>
                  `)
                  .join("")
              : `<span class="sentence-answer-placeholder">${t("chooseWordsToBuildSentence", "Choose words below to build the sentence")}</span>`}
          </div>
          <div class="sentence-builder-actions">
            <button class="ghost-button compact-button" type="button" data-sentence-reset="${lesson.id}" ${answered || !selected.length ? "disabled" : ""}>
              ${t("clear", "Clear")}
            </button>
            <button class="primary-button compact-button" type="submit" ${complete && !answered ? "" : "disabled"}>
              ${icon("check")} ${t("check", "Check")}
            </button>
          </div>
        </div>
        <div class="scramble-row sentence-word-bank" dir="rtl" lang="ar" aria-label="${t("wordBank", "Word bank")}">
          ${builder.tokens.map((token, index) => `
            <button class="sentence-word-token ${selected.includes(index) ? "selected" : ""}" type="button" data-sentence-token="${lesson.id}" data-sentence-index="${index}" ${selected.includes(index) || answered ? "disabled" : ""}>
              ${escapeHtml(token)}
            </button>
          `).join("")}
        </div>
      </form>
      ${feedback ? `
        <div class="feedback ${correct ? "correct" : "incorrect"}">
          ${icon(correct ? "check" : "x")}
          <span>${correct ? t("correct", "Correct") : t("notQuiteShort", "Not quite.")}</span>
          ${renderRetryButton("sentence-builder", { lessonId: lesson.id })}
        </div>
        ${correct ? "" : renderModelAnswerReveal(feedback.expected)}
      ` : ""}
    </section>
  `;
}

function renderMorphologyDrills(lesson) {
  const drills = window.MadinahLearningCore.createMorphologyDrills(lesson).slice(0, 2);
  if (!drills.length) return "";

  return `
    <section class="lesson-quiz-card practice-tool-card">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${t("morphology", "Morphology")}</p>
          <h3>${localizedText("Pattern drills")}</h3>
        </div>
        <span class="pill">${drills.length} ${t("drills", "drills")}</span>
      </div>
      <div class="mini-drill-grid">
        ${drills.map((drill) => {
          const feedback = state.morphologyFeedback[`${lesson.id}:${drill.id}`];
          return `
            <article class="mini-drill">
              <p>${escapeHtml(localizedText(drill.prompt))}</p>
              <div class="mini-drill-cues">
                ${drill.meaning ? `<span>${t("meaning", "Meaning")}: ${escapeHtml(localizedText(drill.meaning))}</span>` : ""}
                ${drill.root ? `<span>${t("root", "Root")}: <b dir="rtl" lang="ar">${escapeHtml(drill.root)}</b></span>` : ""}
              </div>
              <div class="options">
                ${drill.options.map((option) => {
                  const answered = Boolean(feedback);
                  const isCorrect = answered && feedback.status === "correct" && option === drill.answer;
                  const isWrong = answered && option === feedback.answer && option !== drill.answer;
                  return `
                    <button class="option-button vocab-option ${isCorrect ? "correct-option" : ""} ${isWrong ? "incorrect-option" : ""}" type="button" data-morph-lesson="${lesson.id}" data-morph-drill="${escapeHtml(drill.id)}" data-morph-answer="${escapeHtml(option)}" ${answered ? "disabled" : ""}>
                      <span class="arabic-option" lang="ar">${escapeHtml(option)}</span>
                    </button>
                  `;
                }).join("")}
              </div>
              ${feedback ? `
                <div class="feedback ${feedback.status === "correct" ? "correct" : "incorrect"}">
                  ${icon(feedback.status === "correct" ? "check" : "x")}
                  <span>${feedback.status === "correct" ? t("correct", "Correct") : t("notQuiteShort", "Not quite.")}</span>
                  ${renderRetryButton("morphology", { lessonId: lesson.id, drillId: drill.id })}
                </div>
                ${renderModelAnswerReveal(drill.answer, {}, drill.explanation, { correct: feedback.status === "correct" })}
              ` : ""}
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function isCumulativeMilestone(lesson) {
  const bookLessons = lessonsForBook(lesson.bookSlug);
  const finalLesson = bookLessons[bookLessons.length - 1]?.id === lesson.id;
  return Number(lesson.number) % 5 === 0 || finalLesson;
}

function renderCumulativeTest(lesson) {
  if (!isCumulativeMilestone(lesson)) return "";
  const test = getCumulativeTest(lesson);
  const feedback = state.cumulativeFeedback[lesson.id] || {};
  const answered = Object.keys(feedback).length;
  const correct = Object.values(feedback).filter((item) => item.status === "correct").length;

  return `
    <section class="lesson-quiz-card practice-tool-card cumulative-card">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${t("cumulativeCheck", "Cumulative Check")}</p>
          <h3>${t("throughLesson", "Through lesson")} ${lesson.number}</h3>
        </div>
        <div class="tester-actions">
          <span class="pill">${correct}/${test.questions.length} ${t("correctCount", "correct")}</span>
          <button class="ghost-button compact-button" type="button" data-cumulative-new="${lesson.id}">${icon("spark")} ${t("regenerate", "Regenerate")}</button>
        </div>
      </div>
      <div class="cumulative-grid ${state.motion.tester ? "shuffle-in" : ""}">
        ${test.questions.map((question, index) => renderCumulativeQuestion(lesson.id, question, feedback[question.id], index + 1)).join("") || `<p class="translation">${t("noPracticeReady", "No cumulative practice is ready yet.")}</p>`}
      </div>
      <div class="tester-footer">
        <span>${answered} ${t("answered", "answered")}</span>
        <div class="bar"><span style="width:${test.questions.length ? Math.round((answered / test.questions.length) * 100) : 0}%"></span></div>
      </div>
    </section>
  `;
}

function renderCumulativeQuestion(lessonId, question, feedback, number) {
  return `
    <article class="vocab-test-question cumulative-question">
      <div class="vocab-test-prompt">
        <span>${String(number).padStart(2, "0")}</span>
        <div>
          ${renderPromptText(normalizedQuizPrompt(question))}
          ${question.answerKey === "exercise" ? renderExerciseArabicPrompt(question, "example-arabic") : question.arabic ? `<button class="example-arabic" type="button" data-speak="${escapeHtml(question.arabic)}" lang="ar">${question.arabic}</button>` : question.display ? `<strong>${escapeHtml(localizedOption(question.display))}</strong>` : ""}
        </div>
      </div>
      <div class="vocab-test-options">
        ${(question.options || []).map((option) => {
          const answered = Boolean(feedback);
          const isCorrect = answered && feedback.status === "correct" && option === question.answer;
          const isWrong = answered && option === feedback.answer && option !== question.answer;
          return `
            <button class="option-button vocab-option ${isCorrect ? "correct-option" : ""} ${isWrong ? "incorrect-option" : ""}" type="button" data-cumulative-lesson="${lessonId}" data-cumulative-question="${escapeHtml(question.id)}" data-cumulative-answer="${escapeHtml(option)}" ${answered ? "disabled" : ""}>
              ${question.answerKey === "exercise" ? renderExerciseOptionDisplay(option) : `<span ${hasArabic(option) ? 'class="arabic-option" lang="ar"' : ""}>${escapeHtml(localizedOption(option))}</span>`}
            </button>
          `;
        }).join("")}
      </div>
      ${feedback ? `
        <div class="answer-followup">
          <div class="feedback ${feedback.status === "correct" ? "correct" : "incorrect"}">
            ${icon(feedback.status === "correct" ? "check" : "x")}
            <span>${feedback.status === "correct" ? t("correct", "Correct") : t("notQuiteShort", "Not quite.")}</span>
            ${renderRetryButton("cumulative", { lessonId, questionId: question.id })}
          </div>
          ${renderQuestionExplanation(question, feedback.answer)}
        </div>
      ` : ""}
    </article>
  `;
}

function getVocabularyQuiz(lesson, lessonVocabulary) {
  if (!state.vocabularyQuizByLesson[lesson.id]) {
    state.vocabularyQuizByLesson[lesson.id] = createVocabularyQuiz(lesson, lessonVocabulary);
  }
  return state.vocabularyQuizByLesson[lesson.id];
}

function createVocabularyQuiz(lesson, lessonVocabulary) {
  const words = lessonVocabulary.length
    ? lessonVocabulary
    : state.data.vocabulary.filter((word) => word.bookSlug === lesson.bookSlug && word.lessonNumber === lesson.number);
  if (!words.length) return null;

  const word = randomItem(words);
  return createVocabularyQuestion(word, words, `vocab-${lesson.id}`);
}

function createVocabularyQuestion(word, optionPool, idPrefix) {
  return window.MadinahLearningCore.createVocabularyQuestion({
    word,
    optionPool,
    allVocabulary: state.data.vocabulary,
    lessons: state.data.lessons,
    idPrefix
  });
}

function normalizeVocabTesterFilters() {
  const availableBooks = getVocabularyBookOptions().filter((book) => book.status === "available" && book.wordCount > 0 && canAccessTesterBook(book.slug));
  const availableSlugs = availableBooks.map((book) => book.slug);
  const selectedBooks = state.vocabTesterFilters.bookSlugs.filter((slug) => availableSlugs.includes(slug));
  state.vocabTesterFilters.bookSlugs = selectedBooks.length ? uniqueValues(selectedBooks) : [currentVocabularyBook().slug];

  const lessonKeys = new Set(["all", ...getVocabularyLessonOptions(state.vocabTesterFilters.bookSlugs).map((option) => option.key)]);
  if (!lessonKeys.has(state.vocabTesterFilters.lessonKey)) {
    state.vocabTesterFilters.lessonKey = "all";
  }

  const validFocus = new Set(["all", "new", "learned", "due", "mistakes"].filter((focus) => canAccessTesterFocus(focus)));
  const focus = state.vocabTesterFilters.focus.filter((item) => validFocus.has(item));
  state.vocabTesterFilters.focus = focus.length ? focus : ["all"];
}

function getVocabularyLessonOptions(bookSlugs) {
  const selectedBooks = new Set(bookSlugs);
  const byKey = new Map();

  state.data.vocabulary.forEach((word) => {
    if (!selectedBooks.has(word.bookSlug)) return;
    const key = wordLessonKey(word);
    if (byKey.has(key)) {
      byKey.get(key).count += 1;
      return;
    }

    byKey.set(key, {
      key,
      bookSlug: word.bookSlug,
      lessonNumber: word.lessonNumber,
      label: lessonLabelForWord(word),
      count: 1
    });
  });

  const bookOrder = new Map(state.data.books.map((book, index) => [book.slug, index]));
  return Array.from(byKey.values()).sort((a, b) => {
    const bookDiff = (bookOrder.get(a.bookSlug) || 0) - (bookOrder.get(b.bookSlug) || 0);
    if (bookDiff) return bookDiff;
    if (a.lessonNumber === "PDF") return 1;
    if (b.lessonNumber === "PDF") return -1;
    return Number(a.lessonNumber) - Number(b.lessonNumber);
  });
}

function getVocabTesterPool() {
  normalizeVocabTesterFilters();

  const filters = state.vocabTesterFilters;
  const focusFilters = filters.focus.filter((focus) => focus !== "all");

  return state.data.vocabulary.filter((word) => {
    if (!filters.bookSlugs.includes(word.bookSlug)) return false;
    if (filters.lessonKey !== "all" && wordLessonKey(word) !== filters.lessonKey) return false;
    if (!focusFilters.length) return true;

    return focusFilters.some((focus) => vocabularyFocusMatches(word, focus));
  });
}

function vocabTesterFilterKey() {
  normalizeVocabTesterFilters();
  return JSON.stringify(state.vocabTesterFilters);
}

function createVocabTester(size = 3) {
  const pool = getVocabTesterPool();
  return window.MadinahLearningCore.createVocabTester({
    pool,
    allVocabulary: state.data.vocabulary,
    lessons: state.data.lessons,
    size,
    filterKey: vocabTesterFilterKey()
  });
}

function buildVocabularyOptions(lessonWords, targetWord, answerKey) {
  return window.MadinahLearningCore.buildVocabularyOptions(lessonWords, targetWord, answerKey, state.data.vocabulary);
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function renderVocabularyPage() {
  const selectedBook = currentVocabularyBook();
  const bookWords = getVocabularyWordsForBook(selectedBook.slug);
  const query = state.search.trim().toLowerCase();
  const words = bookWords.filter((word) => {
    if (!query) return true;
    return [word.arabic, word.transliteration, word.english, localizedText(word.english)].some((value) => value.toLowerCase().includes(query));
  });
  const testerPoolCount = getVocabTesterPool().length;
  const shownCount = state.vocabularyTab === "tester" ? testerPoolCount : words.length;
  if (isNativeApp()) return renderNativeVocabularyPage(selectedBook, words, shownCount);

  const listMarkup = state.viewportMode === "mobile"
    ? `${renderMobileVocabularyFlashcards(words, selectedBook)}${renderVocabularyCards(words)}`
    : renderVocabularyTable(words);

  return `
    <section class="page-stack">
      <div class="page-heading">
        <div>
          <p class="section-label">${t("vocabularyBank", "Vocabulary Bank")}</p>
          <h2>${escapeHtml(localizedBookTitle(selectedBook))} ${t("vocabulary", "Vocabulary")}</h2>
        </div>
        <span class="pill">${shownCount} ${t("words", "words")}</span>
      </div>
      ${renderVocabularyBookSelector(selectedBook.slug)}
      <div class="lesson-tabs vocabulary-tabs" role="tablist" aria-label="${t("vocabularySections", "Vocabulary sections")}">
        ${[
          ["list", "Word List"],
          ["tester", "Vocab Tester"]
        ]
          .map(
            ([id, label]) => `
              <button class="lesson-tab ${state.vocabularyTab === id ? "active" : ""}" type="button" data-vocabulary-tab="${id}" role="tab" aria-selected="${state.vocabularyTab === id}">
                ${id === "list" ? t("wordList", label) : t("vocabTester", label)}
              </button>
            `
          )
          .join("")}
      </div>
      ${state.vocabularyTab === "tester" ? renderVocabTester() : listMarkup}
    </section>
  `;
}

function renderNativeVocabularyPage(selectedBook, words, shownCount) {
  if (state.vocabularyTab === "tester") return renderNativeVocabTester(selectedBook);
  if (state.vocabularyTab === "listen") return renderNativeAudioReviewPage(selectedBook);

  const deckWords = nativePriorityWords(8, selectedBook.slug);
  const flashcards = deckWords.length ? deckWords : words.slice(0, 8);
  const [featured, ...upNext] = flashcards;
  const counts = vocabularyStatusCounts(words);
  const difficult = nativeDifficultWords(6, selectedBook.slug);

  return `
    <section class="native-vocabulary-app">
      <div class="native-page-heading">
        <div>
          <p class="section-label">${escapeHtml(localizedBookTitle(selectedBook))}</p>
          <h2>${t("flashcards", "Flashcards")}</h2>
        </div>
        <span class="pill">${shownCount} ${t("words", "words")}</span>
      </div>
      <div class="native-tab-switch" role="tablist" aria-label="${t("vocabularySections", "Vocabulary sections")}">
        <button class="active" type="button" data-vocabulary-tab="list" role="tab" aria-selected="true">${t("cards", "Cards")}</button>
        <button type="button" data-vocabulary-tab="listen" role="tab" aria-selected="false">${t("listen", "Listen")}</button>
        <button type="button" data-vocabulary-tab="tester" role="tab" aria-selected="false">${t("vocabTester", "Vocab Tester")}</button>
      </div>
      ${renderVocabularyBookSelector(selectedBook.slug)}
      <section class="native-status-grid" aria-label="${t("vocabularyProgress", "Vocabulary progress")}">
        ${Object.entries(counts).map(([status, count]) => `
          <span class="vocab-status status-${status}">${vocabularyStatusLabel(status)} <strong>${count}</strong></span>
        `).join("")}
      </section>
      ${featured ? renderNativeFlashcardCard(featured, { featured: true }) : `
        <div class="mobile-empty-state">
          <span class="quick-icon">${icon("search")}</span>
          <h3>${t("noVocabularyMatches", "No vocabulary matches this selection.")}</h3>
          <p>${t("tryAnotherBookOrSearch", "Try another book or clear your search.")}</p>
        </div>
      `}
      ${upNext.length ? `
        <section class="native-card-rail" aria-label="${t("upNext", "Up next")}">
          ${upNext.map((word) => renderNativeMiniFlashcard(word)).join("")}
        </section>
      ` : ""}
      ${renderNativeDifficultDeck(difficult)}
    </section>
  `;
}

function renderNativeDifficultDeck(words) {
  if (!words.length) return "";
  return `
    <section class="native-difficult-deck">
      <div class="native-card-topline">
        <span>${t("difficultDeck", "Difficult deck")}</span>
        <span>${words.length} ${t("cards", "cards")}</span>
      </div>
      <div class="native-card-rail">
        ${words.map((word) => renderNativeMiniFlashcard(word)).join("")}
      </div>
      <button class="ghost-button compact-button" type="button" data-route="review">${t("reviewDifficult", "Review difficult items")}</button>
    </section>
  `;
}

function renderNativeAudioReviewPage(selectedBook) {
  const review = ensureNativeAudioReview(selectedBook);
  const feedback = state.nativeAudioFeedback;

  return `
    <section class="native-vocab-tester-app native-audio-review-app">
      <div class="native-page-heading">
        <div>
          <p class="section-label">${escapeHtml(localizedBookTitle(selectedBook))}</p>
          <h2>${t("listenReview", "Listen review")}</h2>
        </div>
        <span class="pill">${escapeHtml(audioModeLabel())}</span>
      </div>
      <div class="native-tab-switch" role="tablist" aria-label="${t("vocabularySections", "Vocabulary sections")}">
        <button type="button" data-vocabulary-tab="list" role="tab" aria-selected="false">${t("cards", "Cards")}</button>
        <button class="active" type="button" data-vocabulary-tab="listen" role="tab" aria-selected="true">${t("listen", "Listen")}</button>
        <button type="button" data-vocabulary-tab="tester" role="tab" aria-selected="false">${t("vocabTester", "Vocab Tester")}</button>
      </div>
      ${renderVocabularyBookSelector(selectedBook.slug)}
      ${review ? `
        <article class="native-vocab-test-question native-audio-card ${state.motion.tester ? "shuffle-in" : ""}">
          <div class="native-question-topline">
            <span>${t("audioFirst", "Audio first")}</span>
            <button class="ghost-button compact-button" type="button" data-audio-rate-toggle>${escapeHtml(audioModeLabel())}</button>
          </div>
          <button class="native-listen-button" type="button" data-native-audio-play>
            ${icon("speaker")}
            <span>${t("playArabicAudio", "Play Arabic audio")}</span>
          </button>
          <p class="translation">${t("listenChooseMeaning", "Listen to the Arabic, then choose the meaning.")}</p>
          <div class="native-test-options">
            ${review.options.map((option) => {
              const answered = Boolean(feedback);
              const isCorrect = answered && feedback.status === "correct" && option === review.answer;
              const isWrong = answered && option === feedback.answer && option !== review.answer;
              return `
                <button class="option-button vocab-option ${isCorrect ? "correct-option" : ""} ${isWrong ? "incorrect-option" : ""}" type="button" data-native-audio-answer="${escapeHtml(option)}" ${answered ? "disabled" : ""}>
                  <span>${escapeHtml(localizedOption(option))}</span>
                </button>
              `;
            }).join("")}
          </div>
          ${feedback ? `
            <div class="feedback ${feedback.status === "correct" ? "correct" : "incorrect"}">
              ${icon(feedback.status === "correct" ? "check" : "x")}
              <span>${feedback.status === "correct" ? t("correct", "Correct") : t("notQuiteShort", "Not quite.")}</span>
            </div>
            <div class="native-audio-answer">
              <button class="example-arabic" type="button" data-speak="${escapeHtml(review.arabic)}" lang="ar">${review.arabic}</button>
              <p>${escapeHtml(localizedText(review.answer))}</p>
            </div>
            <button class="primary-button native-next-question" type="button" data-native-audio-new>${t("nextSound", "Next sound")} ${icon("arrow")}</button>
          ` : ""}
        </article>
      ` : `
        <div class="mobile-empty-state">
          <span class="quick-icon">${icon("speaker")}</span>
          <h3>${t("noVocabularyMatches", "No vocabulary matches this selection.")}</h3>
        </div>
      `}
    </section>
  `;
}

function renderNativeMiniFlashcard(word) {
  const status = vocabularyStatus(word);
  return `
    <article class="native-mini-card">
      <button type="button" data-speak="${escapeHtml(word.arabic)}" lang="ar">${word.arabic}</button>
      <span class="vocab-status status-${status}">${vocabularyStatusLabel(status)}</span>
    </article>
  `;
}

function renderNativeFlashcardCard(word, options = {}) {
  const status = vocabularyStatus(word);
  const lessonLabel = lessonLabelForWord(word);
  return `
    <article class="native-flashcard-card ${options.featured ? "featured" : ""} ${options.session ? "session-card" : ""} status-${status}" data-swipe-word="${escapeHtml(word.id)}">
      <div class="native-card-topline">
        <span>${escapeHtml(lessonLabel)}</span>
        <span class="vocab-status status-${status}">${vocabularyStatusLabel(status)}</span>
      </div>
      <button class="native-flashcard-arabic" type="button" data-speak="${escapeHtml(word.arabic)}" lang="ar">${word.arabic}</button>
      <details class="answer-reveal native-answer-reveal">
        <summary><span>${t("revealMeaning", "Reveal meaning")}</span>${icon("arrow")}</summary>
        <p class="translation">${escapeHtml(localizedText(word.english))}</p>
      </details>
      ${options.session ? `
        <p class="native-swipe-hint">${t("tapRevealOrSwipe", "Tap to reveal. Swipe left to review again, right if you know it.")}</p>
      ` : `
        <div class="native-card-actions">
          ${renderBookmarkButton("vocabulary", word.id)}
          <button class="ghost-button compact-button" type="button" data-review-word-again="${escapeHtml(word.id)}">${t("reviewAgain", "Review again")}</button>
          <button class="primary-button compact-button" type="button" data-review-word-known="${escapeHtml(word.id)}">${t("iKnowThis", "I know this")}</button>
        </div>
        <p class="native-swipe-hint">${t("swipeFlashcardHint", "Swipe left to keep learning, right to mark known.")}</p>
      `}
    </article>
  `;
}

function paginatedVocabularyWords(words, pageSize = 40) {
  const totalPages = Math.max(1, Math.ceil(words.length / pageSize));
  const page = Math.min(Math.max(Number(state.vocabularyPage) || 1, 1), totalPages);
  if (page !== state.vocabularyPage) state.vocabularyPage = page;
  const start = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    totalPages,
    start,
    end: Math.min(start + pageSize, words.length),
    words: words.slice(start, start + pageSize)
  };
}

function renderVocabularyBookSelector(selectedSlug) {
  return `
    <section class="vocab-book-grid" aria-label="${t("vocabularyBooks", "Vocabulary books")}">
      ${getVocabularyBookOptions()
        .map((book) => {
          const locked = book.status !== "available" || !canAccessBookSlug(book.slug);
          return `
            <button class="vocab-book-card ${book.slug === selectedSlug ? "active" : ""} ${locked ? "locked" : ""}" type="button" data-vocabulary-book="${book.slug}" ${locked ? "disabled" : ""}>
              <span class="book-number">${book.slug.replace("book-", "")}</span>
              <span>
                <strong>${escapeHtml(localizedBookTitle(book))}</strong>
                <small>${book.status !== "available" ? t("comingSoon", "Coming Soon") : locked ? t("lockedPremium", "Premium") : `${book.wordCount} ${t("words", "words")}`}</small>
              </span>
              ${icon(locked ? "lock" : "book")}
            </button>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderVocabTester() {
  const filterKey = vocabTesterFilterKey();
  const pool = getVocabTesterPool();
  if (!state.vocabTester || state.vocabTester.filterKey !== filterKey) {
    state.vocabTester = createVocabTester(3);
  }

  const answered = Object.keys(state.vocabTesterFeedback).length;
  const correct = Object.values(state.vocabTesterFeedback).filter((item) => item.status === "correct").length;
  const questionCount = state.vocabTester.questions.length;
  const progressPercent = questionCount ? Math.round((answered / questionCount) * 100) : 0;

  if (isNativeApp()) return renderNativeVocabTester(currentVocabularyBook());

  return `
    <section class="card vocab-tester-card">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${pool.length} ${t("selectedWords", "selected words")}</p>
          <h3>${t("vocabTester", "Vocab Tester")} ${hasPremiumAccess() ? "" : `<span class="inline-plan-chip">${t("basicTester", "Basic tester")}</span>`}</h3>
        </div>
        <div class="tester-actions">
          <span class="pill">${correct}/${questionCount} ${t("correctCount", "correct")}</span>
          <button class="ghost-button compact-button mobile-filter-button" type="button" data-vocab-tester-filters-toggle>${icon("target")} ${t("filters", "Filters")}</button>
          <button class="primary-button compact-button" type="button" data-vocab-tester-new ${pool.length ? "" : "disabled"}>${icon("spark")} ${t("generateNewTest", "Generate new test")}</button>
        </div>
      </div>
      ${renderVocabTesterControls(pool.length)}
      ${renderVocabTesterFilterSheet(pool.length)}
      ${hasPremiumAccess() ? "" : renderPremiumInline("premiumUnlocks", paidFeatureText("tester"))}
      <div class="vocab-test-grid ${state.motion.tester ? "shuffle-in" : ""}">
        ${questionCount
          ? state.vocabTester.questions.map((question) => renderVocabTesterQuestion(question)).join("")
          : `<div class="empty-test-state">${t("noVocabularyMatches", "No vocabulary matches this selection.")}</div>`}
      </div>
      <div class="tester-footer">
        <span>${answered} ${t("answered", "answered")}</span>
        <div class="bar"><span style="width:${progressPercent}%"></span></div>
      </div>
    </section>
  `;
}

function renderNativeVocabTester(selectedBook = currentVocabularyBook()) {
  const filterKey = vocabTesterFilterKey();
  const pool = getVocabTesterPool();
  if (!state.vocabTester || state.vocabTester.filterKey !== filterKey) {
    state.vocabTester = createVocabTester(3);
    state.vocabTesterActiveIndex = 0;
  }

  const questions = state.vocabTester.questions;
  const answered = Object.keys(state.vocabTesterFeedback).length;
  const correct = Object.values(state.vocabTesterFeedback).filter((item) => item.status === "correct").length;
  const activeIndex = Math.min(Math.max(Number(state.vocabTesterActiveIndex) || 0, 0), questions.length);
  state.vocabTesterActiveIndex = activeIndex;
  const activeQuestion = questions[activeIndex];
  const complete = questions.length > 0 && activeIndex >= questions.length;

  return `
    <section class="native-vocab-tester-app">
      <div class="native-page-heading">
        <div>
          <p class="section-label">${pool.length} ${t("selectedWords", "selected words")}</p>
          <h2>${t("vocabTester", "Vocab Tester")}</h2>
        </div>
        <span class="pill">${correct}/${questions.length} ${t("correctCount", "correct")}</span>
      </div>
      <div class="native-tab-switch" role="tablist" aria-label="${t("vocabularySections", "Vocabulary sections")}">
        <button type="button" data-vocabulary-tab="list" role="tab" aria-selected="false">${t("cards", "Cards")}</button>
        <button type="button" data-vocabulary-tab="listen" role="tab" aria-selected="false">${t("listen", "Listen")}</button>
        <button class="active" type="button" data-vocabulary-tab="tester" role="tab" aria-selected="true">${t("vocabTester", "Vocab Tester")}</button>
      </div>
      <div class="native-test-progress" aria-label="${t("testProgress", "Test progress")}">
        ${questions.map((question, index) => `
          <span class="${index === activeIndex ? "active" : ""} ${state.vocabTesterFeedback[question.id]?.status || ""}"></span>
        `).join("")}
      </div>
      ${hasPremiumAccess() ? "" : renderPremiumInline("premiumUnlocks", paidFeatureText("tester"))}
      ${complete ? renderNativeTesterComplete(correct, questions.length) : activeQuestion ? renderNativeVocabTesterQuestion(activeQuestion, activeIndex, questions.length) : `
        <div class="mobile-empty-state">
          <span class="quick-icon">${icon("search")}</span>
          <h3>${t("noVocabularyMatches", "No vocabulary matches this selection.")}</h3>
          <p>${t("tryAnotherBookOrSearch", "Try another book or clear your search.")}</p>
        </div>
      `}
      <div class="native-tester-actions">
        <button class="ghost-button compact-button" type="button" data-vocab-tester-filters-toggle>${icon("target")} ${t("filters", "Filters")}</button>
        <button class="ghost-button compact-button" type="button" data-vocab-tester-new ${pool.length ? "" : "disabled"}>${icon("spark")} ${t("newTest", "New test")}</button>
      </div>
      ${renderVocabTesterFilterSheet(pool.length)}
    </section>
  `;
}

function renderNativeTesterComplete(correct, total) {
  return `
    <article class="native-tester-complete">
      <span class="quick-icon">${icon("check")}</span>
      <p class="section-label">${t("reviewComplete", "Review complete")}</p>
      <h3>${correct}/${total} ${t("correctCount", "correct")}</h3>
      <button class="primary-button" type="button" data-vocab-tester-new>${icon("spark")} ${t("generateNewTest", "Generate new test")}</button>
    </article>
  `;
}

function renderNativeVocabTesterQuestion(question, index, total) {
  const feedback = state.vocabTesterFeedback[question.id];
  const answered = Boolean(feedback);
  return `
    <article class="native-vocab-test-question ${state.motion.tester ? "shuffle-in" : ""}">
      <div class="native-question-topline">
        <span>${String(index + 1).padStart(2, "0")} / ${total}</span>
        <span>${t("vocabTester", "Vocab Tester")}</span>
      </div>
      <div class="vocab-test-prompt native-test-prompt">
        <p>${escapeHtml(localizedText(normalizedQuizPrompt(question)))}</p>
        ${question.arabic ? `<button class="native-test-arabic" type="button" data-speak="${escapeHtml(question.arabic)}" lang="ar">${question.arabic}</button>` : `
          <span class="native-target-card">
            <small>${t("meaning", "Meaning")}</small>
            <strong>${escapeHtml(localizedOption(question.display))}</strong>
          </span>
        `}
      </div>
      <div class="native-test-options">
        ${question.options.map((option) => {
          const isCorrect = answered && feedback.status === "correct" && option === question.answer;
          const isWrong = answered && option === feedback.answer && option !== question.answer;
          return `
            <button class="option-button vocab-option ${isCorrect ? "correct-option" : ""} ${isWrong ? "incorrect-option" : ""}" type="button" data-vocab-tester-answer="${escapeHtml(option)}" data-vocab-tester-question="${question.id}" ${answered ? "disabled" : ""}>
              <span ${hasArabic(option) ? 'class="arabic-option" lang="ar"' : ""}>${escapeHtml(localizedOption(option))}</span>
            </button>
          `;
        }).join("")}
      </div>
      ${feedback ? `
        <div class="feedback ${feedback.status === "correct" ? "correct" : "incorrect"}">
          ${icon(feedback.status === "correct" ? "check" : "x")}
          <span>${feedback.status === "correct" ? t("correct", "Correct") : t("notQuiteShort", "Not quite.")}</span>
          ${feedback.status === "correct" ? "" : renderRetryButton("vocab-tester", { questionId: question.id })}
        </div>
        ${renderQuestionExplanation(question, feedback.answer)}
        <button class="primary-button native-next-question" type="button" data-native-next-question>
          ${index + 1 >= total ? t("finish", "Finish") : t("nextQuestion", "Next question")} ${icon("arrow")}
        </button>
      ` : ""}
    </article>
  `;
}

function renderVocabTesterFilterSheet(poolCount) {
  if (!state.mobileFilterSheetOpen) return "";
  return `
    <div class="mobile-sheet-backdrop" data-filter-sheet-backdrop>
      <section class="mobile-filter-sheet" role="dialog" aria-modal="true" aria-label="${t("testerFilters", "Tester filters")}">
        <div class="mobile-sheet-handle"></div>
        <div class="subsection-heading">
          <div>
            <p class="section-label">${t("vocabTester", "Vocab Tester")}</p>
            <h3>${t("filters", "Filters")}</h3>
          </div>
          <button class="icon-button" type="button" data-filter-sheet-close aria-label="${t("close", "Close")}">${icon("x")}</button>
        </div>
        ${renderVocabTesterControls(poolCount)}
      </section>
    </div>
  `;
}

function renderVocabTesterControls(poolCount) {
  const filters = state.vocabTesterFilters;
  const selectedBooks = new Set(filters.bookSlugs);
  const selectedFocus = new Set(filters.focus);
  const lessonOptions = getVocabularyLessonOptions(filters.bookSlugs);
  const focusOptions = [
    ["all", t("anyProgress", "Any Progress")],
    ["new", t("new", "New")],
    ["learned", t("learned", "Learned")],
    ["due", t("due", "Due")],
    ["mistakes", t("mistakes", "Mistakes")]
  ];

  return `
    <section class="tester-filter-panel">
      <div class="filter-group">
        <span class="filter-label">${t("books", "Books")}</span>
        <div class="filter-chip-row">
          ${getVocabularyBookOptions()
            .map((book) => {
              const premiumLocked = book.status === "available" && !canAccessTesterBook(book.slug);
              const disabled = book.status !== "available" || !book.wordCount || premiumLocked;
              return `
                <button class="filter-chip ${selectedBooks.has(book.slug) ? "active" : ""}" type="button" data-vocab-tester-book="${book.slug}" ${disabled ? "disabled" : ""}>
                  <span>${escapeHtml(localizedBookTitle(book))}</span>
                  <small>${premiumLocked ? t("lockedPremium", "Premium") : disabled ? t("soon", "Soon") : book.wordCount}</small>
                </button>
              `;
            })
            .join("")}
        </div>
      </div>
      <div class="filter-group">
        <span class="filter-label">${t("section", "Section")}</span>
        <select class="filter-select" data-vocab-tester-lesson>
          <option value="all" ${filters.lessonKey === "all" ? "selected" : ""}>${t("allSelectedSections", "All selected sections")}</option>
          ${lessonOptions
            .map((option) => `
              <option value="${escapeHtml(option.key)}" ${filters.lessonKey === option.key ? "selected" : ""}>
                ${escapeHtml(option.label)} (${option.count})
              </option>
            `)
            .join("")}
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">${t("focus", "Focus")}</span>
        <div class="filter-chip-row">
          ${focusOptions
            .map(([id, label]) => `
              <button class="filter-chip ${selectedFocus.has(id) ? "active" : ""}" type="button" data-vocab-tester-focus="${id}" ${canAccessTesterFocus(id) ? "" : "disabled"}>
                ${escapeHtml(label)}
                ${canAccessTesterFocus(id) ? "" : `<small>${t("lockedPremium", "Premium")}</small>`}
              </button>
            `)
            .join("")}
        </div>
      </div>
      <span class="filter-count">${poolCount} ${t("words", "words")}</span>
    </section>
  `;
}

function renderVocabTesterQuestion(question) {
  const feedback = state.vocabTesterFeedback[question.id];
  return `
    <article class="vocab-test-question">
      <div class="vocab-test-prompt">
        <span>${String(question.number).padStart(2, "0")}</span>
        <div>
          <p>${escapeHtml(localizedText(normalizedQuizPrompt(question)))}</p>
          ${question.arabic ? `<button class="example-arabic" type="button" data-speak="${escapeHtml(question.arabic)}" lang="ar">${question.arabic}</button>` : `<strong>${escapeHtml(localizedOption(question.display))}</strong>`}
        </div>
      </div>
      <div class="vocab-test-options">
        ${question.options
          .map((option) => {
            const answered = Boolean(feedback);
            const isCorrect = answered && feedback.status === "correct" && option === question.answer;
            const isWrong = answered && option === feedback.answer && option !== question.answer;
            return `
              <button class="option-button vocab-option ${isCorrect ? "correct-option" : ""} ${isWrong ? "incorrect-option" : ""}" type="button" data-vocab-tester-answer="${escapeHtml(option)}" data-vocab-tester-question="${question.id}" ${answered ? "disabled" : ""}>
                <span ${hasArabic(option) ? 'class="arabic-option" lang="ar"' : ""}>${escapeHtml(localizedOption(option))}</span>
              </button>
            `;
          })
          .join("")}
      </div>
      ${feedback ? `
        <div class="feedback ${feedback.status === "correct" ? "correct" : "incorrect"}">
          ${icon(feedback.status === "correct" ? "check" : "x")}
          <span>${feedback.status === "correct" ? t("correct", "Correct") : t("notQuiteShort", "Not quite.")}</span>
          ${renderRetryButton("vocab-tester", { questionId: question.id })}
        </div>
        ${renderQuestionExplanation(question, feedback.answer)}
      ` : ""}
    </article>
  `;
}

function renderVocabularyReviewStrip(bookSlug) {
  if (!hasPremiumAccess()) {
    return renderPremiumInline("spacedRepetition", paidFeatureText("progress"));
  }

  const due = dueVocabularyItems().filter((word) => word.bookSlug === bookSlug);
  const words = getVocabularyWordsForBook(bookSlug);
  const counts = vocabularyStatusCounts(words);
  return `
    <section class="card vocabulary-review-strip">
      <div>
        <p class="section-label">${t("spacedRepetition", "Spaced Repetition")}</p>
        <h2>${due.length} ${t("wordsDue", "words due")}</h2>
      </div>
      <div class="vocab-status-summary">
        ${["new", "learning", "known", "weak"].map((status) => `
          <span class="vocab-status status-${status}">${vocabularyStatusLabel(status)} <strong>${counts[status]}</strong></span>
        `).join("")}
      </div>
      <div class="chip-row">
        ${due.slice(0, 10).map((word) => `<button type="button" data-speak="${escapeHtml(word.arabic)}" lang="ar">${word.arabic}</button>`).join("") || `<span class="empty-state">${t("noDueWords", "No due words right now.")}</span>`}
      </div>
      <button class="ghost-button compact-button" type="button" data-route="review">${t("reviewQueue", "Review queue")}</button>
    </section>
  `;
}

function renderMobileVocabularyFlashcards(words, selectedBook) {
  const due = dueVocabularyItems().filter((word) => word.bookSlug === selectedBook.slug);
  const weak = weakVocabularyItems(8).filter((word) => word.bookSlug === selectedBook.slug);
  const flashcards = uniqueValues([...weak.map((word) => word.id), ...due.map((word) => word.id), ...words.map((word) => word.id)])
    .map((id) => state.data.vocabulary.find((word) => word.id === id))
    .filter(Boolean)
    .slice(0, 10);

  if (!flashcards.length) {
    return `
      <section class="mobile-flashcard-panel">
        <div class="mobile-empty-state">
          <span class="quick-icon">${icon("words")}</span>
          <h3>${t("noVocabularyMatches", "No vocabulary matches this selection.")}</h3>
          <p>${t("tryAnotherBookOrSearch", "Try another book or clear your search.")}</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="mobile-flashcard-panel" aria-label="${t("flashcardReview", "Flashcard review")}">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${t("phoneFirstReview", "Phone-first review")}</p>
          <h3>${t("flashcards", "Flashcards")}</h3>
        </div>
        <span class="pill">${flashcards.length} ${t("cards", "cards")}</span>
      </div>
      <div class="mobile-flashcard-row">
        ${flashcards.map((word) => {
          const status = vocabularyStatus(word);
          return `
            <article class="mobile-flashcard status-${status}">
              <button class="mobile-flashcard-arabic" type="button" data-speak="${escapeHtml(word.arabic)}" lang="ar">${escapeHtml(word.arabic)}</button>
              <details class="answer-reveal">
                <summary><span>${t("revealMeaning", "Reveal meaning")}</span>${icon("arrow")}</summary>
                <p class="translation">${escapeHtml(localizedText(word.english))}</p>
              </details>
	              <div class="mobile-flashcard-meta">
	                <span class="vocab-status status-${status}">${vocabularyStatusLabel(status)}</span>
	                <span>${escapeHtml(reviewScheduleText(word))}</span>
	              </div>
	              <div class="mobile-flashcard-actions">
	                ${renderBookmarkButton("vocabulary", word.id)}
	                <button class="ghost-button compact-button" type="button" data-review-word-again="${escapeHtml(word.id)}">${t("reviewAgain", "Review again")}</button>
	                <button class="primary-button compact-button" type="button" data-review-word-known="${escapeHtml(word.id)}">${t("iKnowThis", "I know this")}</button>
	              </div>
	            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderVocabularyTable(words) {
  const page = paginatedVocabularyWords(words);
  return `
    <section class="card table-card">
      <div class="table-title">
        <div>
          <h2>${t("vocabulary", "Vocabulary")}</h2>
          <p>${words.length ? `${page.start + 1}-${page.end}` : "0"} ${t("of", "of")} ${words.length} ${t("words", "words")}</p>
        </div>
        <div class="table-actions">
          <button class="ghost-button compact-button" type="button" data-vocab-page="${page.page - 1}" ${page.page <= 1 ? "disabled" : ""}>${t("previous", "Previous")}</button>
          <span class="pill">${page.page}/${page.totalPages}</span>
          <button class="ghost-button compact-button" type="button" data-vocab-page="${page.page + 1}" ${page.page >= page.totalPages ? "disabled" : ""}>${t("next", "Next")}</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>${t("arabic", "Arabic")}</th>
              <th>${t("transliteration", "Transliteration")}</th>
              <th>${isBengali() ? t("meaning", "Meaning") : t("english", "English")}</th>
              <th>${t("status", "Status")}</th>
              <th>${t("nextReview", "Next review")}</th>
              <th>${t("book", "Book")}</th>
              <th>${t("lesson", "Lesson")}</th>
              <th>${t("actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            ${page.words
              .map(
                (word) => {
                  const status = vocabularyStatus(word);
                  return `
                  <tr>
                    <td class="arabic-cell" lang="ar">${word.arabic}</td>
                    <td>${escapeHtml(word.transliteration || "—")}</td>
                    <td>${escapeHtml(localizedText(word.english))}</td>
                    <td><span class="vocab-status status-${status}">${vocabularyStatusLabel(status)}</span></td>
                    <td>${escapeHtml(reviewScheduleText(word))}</td>
                    <td>${escapeHtml(localizedBookTitle(getBook(word.bookSlug) || word.bookSlug))}</td>
                    <td>${word.lessonNumber}</td>
	                    <td>
	                      <div class="table-action-row">
	                        <button class="icon-button" type="button" data-speak="${escapeHtml(word.arabic)}" aria-label="${t("playAudio", "Play audio")}">${icon("speaker")}</button>
	                        ${renderBookmarkButton("vocabulary", word.id)}
	                        ${renderReportIssueForm({ kind: "vocabulary", itemId: word.id, lessonId: byId(state.data.lessons, word.lessonId)?.id || "", bookSlug: word.bookSlug })}
	                      </div>
	                    </td>
                  </tr>
                  `;
                })
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="table-pagination">
        <button class="ghost-button compact-button" type="button" data-vocab-page="${page.page - 1}" ${page.page <= 1 ? "disabled" : ""}>${t("previous", "Previous")}</button>
        <span>${words.length ? `${page.start + 1}-${page.end}` : "0"} ${t("of", "of")} ${words.length}</span>
        <button class="ghost-button compact-button" type="button" data-vocab-page="${page.page + 1}" ${page.page >= page.totalPages ? "disabled" : ""}>${t("next", "Next")}</button>
      </div>
    </section>
  `;
}

function renderVocabularyCards(words) {
  const page = paginatedVocabularyWords(words, 20);
  if (!words.length) {
    return `
      <section class="vocab-mobile-list" aria-label="${t("vocabulary", "Vocabulary")}">
        <div class="mobile-empty-state">
          <span class="quick-icon">${icon("search")}</span>
          <h3>${t("noVocabularyMatches", "No vocabulary matches this selection.")}</h3>
          <p>${t("tryAnotherBookOrSearch", "Try another book or clear your search.")}</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="vocab-mobile-list" aria-label="${t("vocabulary", "Vocabulary")}">
      <div class="table-title mobile-vocab-title">
        <div>
          <h3>${t("wordList", "Word List")}</h3>
          <p>${page.start + 1}-${page.end} ${t("of", "of")} ${words.length}</p>
        </div>
        <div class="table-actions">
          <button class="ghost-button compact-button" type="button" data-vocab-page="${page.page - 1}" ${page.page <= 1 ? "disabled" : ""}>${t("previous", "Previous")}</button>
          <span class="pill">${page.page}/${page.totalPages}</span>
          <button class="ghost-button compact-button" type="button" data-vocab-page="${page.page + 1}" ${page.page >= page.totalPages ? "disabled" : ""}>${t("next", "Next")}</button>
        </div>
      </div>
      ${page.words
        .map((word) => {
          const status = vocabularyStatus(word);
          return `
          <article class="vocab-mobile-card">
            <div>
              <button class="vocab-mobile-arabic" type="button" data-speak="${escapeHtml(word.arabic)}" lang="ar">${word.arabic}</button>
              <p>${escapeHtml(localizedText(word.english))}</p>
              <span class="vocab-status status-${status}">${vocabularyStatusLabel(status)} · ${escapeHtml(reviewScheduleText(word))}</span>
            </div>
	            <div class="vocab-mobile-meta">
	              <span>${escapeHtml(localizedBookTitle(getBook(word.bookSlug) || word.bookSlug))}</span>
	              <span>${t("lesson", "Lesson")} ${escapeHtml(word.lessonNumber)}</span>
	              ${word.transliteration ? `<span>${escapeHtml(word.transliteration)}</span>` : ""}
	            </div>
	            <div class="content-actions compact">
	              <button class="icon-button" type="button" data-speak="${escapeHtml(word.arabic)}" aria-label="${t("playAudio", "Play audio")}">${icon("speaker")}</button>
	              ${renderBookmarkButton("vocabulary", word.id)}
	              ${renderReportIssueForm({ kind: "vocabulary", itemId: word.id, bookSlug: word.bookSlug })}
	            </div>
	          </article>
          `;
        })
        .join("")}
      <div class="table-pagination">
        <button class="ghost-button compact-button" type="button" data-vocab-page="${page.page - 1}" ${page.page <= 1 ? "disabled" : ""}>${t("previous", "Previous")}</button>
        <span>${page.start + 1}-${page.end} ${t("of", "of")} ${words.length}</span>
        <button class="ghost-button compact-button" type="button" data-vocab-page="${page.page + 1}" ${page.page >= page.totalPages ? "disabled" : ""}>${t("next", "Next")}</button>
      </div>
    </section>
  `;
}

function renderGrammarPage() {
  const rules = hasPremiumAccess() ? state.data.grammar : state.data.grammar.filter((rule) => canAccessBookSlug(rule.bookSlug));
  return `
    <section class="page-stack">
      <div class="page-heading">
        <div>
          <p class="section-label">${t("availableBooks", "Available Books")}</p>
          <h2>${t("grammar", "Grammar")}</h2>
        </div>
      </div>
      <div class="grammar-grid">
        ${rules
          .map(
            (rule) => `
              <article class="card grammar-card">
                <span class="quick-icon">${icon("grammar")}</span>
                <h3>${escapeHtml(localizedGrammarTitle(rule))}</h3>
                <p>${escapeHtml(localizedGrammarSummary(rule))}</p>
                <button class="arabic-example" type="button" data-speak="${escapeHtml(rule.example)}" lang="ar">${rule.example}</button>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderExercisesPage() {
  const selected = byId(state.data.exercises, state.selectedExerciseId) || state.data.exercises[0];
  const exerciseLesson = byId(state.data.lessons, selected.lessonId);
  const selectedBook = getBook(exerciseLesson?.bookSlug);

  return `
    <section class="exercise-layout">
      <aside class="card exercise-list">
        <div class="panel-heading">
          <p class="section-label">${t("practice", "Practice")}</p>
          <h2>${t("exercises", "Exercises")}</h2>
        </div>
        ${state.data.exercises
          .map(
            (exercise, index) => `
              <button class="exercise-link ${selected.id === exercise.id ? "active" : ""}" type="button" data-exercise="${exercise.id}">
                <span>${String(index + 1).padStart(2, "0")}</span>
                <strong>${escapeHtml(localizedText(exercise.prompt))}</strong>
                ${state.progress.exerciseAttempts[exercise.id] === "correct" ? icon("check") : ""}
              </button>
            `
          )
          .join("")}
      </aside>
      <article class="card exercise-card">
        <div class="card-heading">
          <div>
            <p class="section-label">${t("exercises", "Exercise")}</p>
            <h2>${escapeHtml(localizedText(selected.prompt))}</h2>
            ${renderPromptTermGlosses(selected.prompt)}
          </div>
          <span class="pill">${escapeHtml(localizedBookTitle(selectedBook))}</span>
        </div>
        ${renderExerciseArabicPrompt(selected)}
        <div class="options">
          ${selected.options
            .map((option) => {
              const answered = Boolean(state.exerciseFeedback[selected.id]);
              return `
                <button class="option-button" type="button" data-answer="${escapeHtml(option)}" data-exercise-answer="${selected.id}" ${answered ? "disabled" : ""}>
                  ${renderExerciseOptionDisplay(option)}
                </button>
              `;
            })
            .join("")}
        </div>
        ${renderExerciseFeedback(selected)}
      </article>
    </section>
  `;
}

function renderExerciseFeedback(exercise) {
  const feedback = state.exerciseFeedback[exercise.id];
  if (!feedback) return "";
  const correct = feedback === "correct";
  return `
    <div class="feedback ${correct ? "correct" : "incorrect"}">
      ${icon(correct ? "check" : "x")}
      <span>${correct ? t("correct", "Correct") : t("notQuiteShort", "Not quite.")}</span>
      ${renderRetryButton("exercise", { exerciseId: exercise.id })}
    </div>
    ${correct ? "" : renderModelAnswerReveal(exercise.answer, { arabic: exercise.arabic || "" })}
  `;
}

function renderVocabularyQuizFeedback(lessonId, quiz) {
  const feedback = state.vocabularyQuizFeedback[lessonId];
  if (!feedback) return "";
  const correct = feedback.status === "correct";
  return `
    <div class="feedback ${correct ? "correct" : "incorrect"}">
      ${icon(correct ? "check" : "x")}
      <span>${correct ? t("correctSaved", "Correct. Vocabulary saved to progress.") : t("notQuiteShort", "Not quite.")}</span>
      ${renderRetryButton("vocab-quiz", { lessonId })}
    </div>
    ${renderQuestionExplanation(quiz, feedback.answer)}
  `;
}

function renderReviewPage() {
  const mistakes = mistakeItems();
  const dueWords = dueVocabularyItems();
  const weakWords = weakVocabularyItems(18);
  return `
    <section class="page-stack">
      <div class="page-heading">
        <div>
          <p class="section-label">${t("review", "Review")}</p>
          <h2>${localizedText("Mistakes And Due Vocabulary")}</h2>
        </div>
        <span class="pill">${mistakes.length} ${t("mistakes", "mistakes")}</span>
      </div>
      ${renderReviewSessionPanel(dueWords, mistakes)}
      <section class="review-dashboard">
        <article class="card">
          <div class="subsection-heading">
            <div>
              <p class="section-label">${t("spacedRepetition", "Spaced Repetition")}</p>
              <h3>${dueWords.length} ${t("wordsDue", "words due")}</h3>
            </div>
            <button class="ghost-button compact-button" type="button" data-route="vocabulary">${t("openVocabulary", "Open vocabulary")}</button>
          </div>
          <div class="review-word-grid">
            ${dueWords.slice(0, 18).map((word) => `
              <button class="word-chip" type="button" data-speak="${escapeHtml(word.arabic)}">
                <span lang="ar">${word.arabic}</span>
                <small>${escapeHtml(localizedText(word.english))} · ${t("lesson", "Lesson")} ${word.lessonNumber}</small>
              </button>
            `).join("") || `<p class="translation">${t("noDueWords", "No vocabulary is due right now.")}</p>`}
          </div>
        </article>
        <article class="card">
          <div class="subsection-heading">
            <div>
              <p class="section-label">${t("mistakes", "Mistakes")}</p>
              <h3>${t("reviewQueue", "Review Queue")}</h3>
            </div>
          </div>
          ${renderMistakeList(mistakes)}
        </article>
        <article class="card review-wide">
          <div class="subsection-heading">
            <div>
              <p class="section-label">${t("weakWords", "Weak Words")}</p>
              <h3>${t("priorityPractice", "Priority practice")}</h3>
            </div>
            <button class="ghost-button compact-button" type="button" data-route="vocabulary">${t("openTester", "Open tester")}</button>
          </div>
          <div class="review-word-grid">
            ${weakWords.map((word) => `
              <button class="word-chip" type="button" data-speak="${escapeHtml(word.arabic)}">
                <span lang="ar">${word.arabic}</span>
                <small>${escapeHtml(localizedText(word.english))} · ${t("lesson", "Lesson")} ${word.lessonNumber}</small>
              </button>
            `).join("") || `<p class="translation">${t("noWeakWords", "No weak words detected yet.")}</p>`}
          </div>
        </article>
      </section>
    </section>
  `;
}

function renderReviewSessionPanel(dueWords, mistakes) {
  const reviewWords = uniqueValues([
    ...dueWords.map((word) => word.id),
    ...weakVocabularyItems(8).map((word) => word.id),
    ...Object.values(bookmarkRecord().vocabulary || [])
  ])
    .map((id) => byId(state.data.vocabulary, id))
    .filter((word) => word && canAccessBookSlug(word.bookSlug))
    .slice(0, 6);
  const activeMistakes = mistakes.slice(0, 3);
  const empty = !reviewWords.length && !activeMistakes.length;

  return `
    <section class="card review-session-panel">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${t("focusedReview", "Focused Review")}</p>
          <h3>${t("clearYourQueue", "Clear your queue")}</h3>
        </div>
        <span class="pill">${reviewWords.length + activeMistakes.length} ${t("items", "items")}</span>
      </div>
      ${empty ? `
        <div class="mobile-empty-state">
          <span class="quick-icon">${icon("check")}</span>
          <h3>${t("reviewQueueClear", "Review queue clear")}</h3>
          <p>${t("reviewQueueClearText", "Open a lesson or generate a vocabulary test to create new review items.")}</p>
        </div>
      ` : `
        <div class="review-session-grid">
          ${reviewWords.map((word) => renderDueReviewCard(word)).join("")}
          ${activeMistakes.map((mistake) => renderMistakeReviewCard(mistake)).join("")}
        </div>
      `}
    </section>
  `;
}

function renderDueReviewCard(word) {
  const status = vocabularyStatus(word);
  return `
    <article class="review-session-card word-review-card status-${status}">
      <div>
        <p class="section-label">${lessonLabelForWord(word)}</p>
        <button class="review-arabic" type="button" data-speak="${escapeHtml(word.arabic)}" lang="ar">${word.arabic}</button>
        <details class="answer-reveal">
          <summary><span>${t("revealMeaning", "Reveal meaning")}</span>${icon("arrow")}</summary>
          <p class="translation">${escapeHtml(localizedText(word.english))}</p>
        </details>
      </div>
      <div class="review-card-actions">
        ${renderBookmarkButton("vocabulary", word.id)}
        <button class="ghost-button compact-button" type="button" data-review-word-again="${escapeHtml(word.id)}">${t("reviewAgain", "Review again")}</button>
        <button class="primary-button compact-button" type="button" data-review-word-known="${escapeHtml(word.id)}">${t("iKnowThis", "I know this")}</button>
      </div>
    </article>
  `;
}

function renderMistakeReviewCard(mistake) {
  return `
    <article class="review-session-card mistake-review-card">
      <div>
        <p class="section-label">${escapeHtml(localizedText(mistake.type || "Mistake"))}</p>
        <strong>${escapeHtml(localizedText(mistake.prompt || "Review this item."))}</strong>
        ${mistake.arabic ? `<button class="arabic-example compact-arabic" type="button" data-speak="${escapeHtml(mistake.arabic)}" lang="ar">${mistake.arabic}</button>` : ""}
        <details class="answer-reveal">
          <summary><span>${t("viewAnswer", "View answer")}</span>${icon("arrow")}</summary>
          <div class="mistake-answer-grid">
            <span><small>${t("yourAnswer", "Your answer")}</small>${renderAnswerDisplay(mistake.given || "Blank", {}, { includeSourceContext: false })}</span>
            <span><small>${t("correctAnswer", "Correct answer")}</small>${renderAnswerDisplay(mistake.expected || "", { arabic: mistake.arabic || "" })}</span>
          </div>
        </details>
      </div>
      <div class="review-card-actions">
        ${renderReportIssueForm({ kind: "exercise", itemId: mistake.id, lessonId: mistake.lessonId, bookSlug: byId(state.data.lessons, mistake.lessonId)?.bookSlug || "" })}
        <button class="primary-button compact-button" type="button" data-resolve-mistake="${escapeHtml(mistake.id)}">${icon("check")} ${t("resolved", "Resolved")}</button>
      </div>
    </article>
  `;
}

function renderMistakeList(mistakes) {
  if (!mistakes.length) return `<p class="translation">${t("noMistakes", "No mistakes to review yet.")}</p>`;
  return `
    <div class="mistake-list">
      ${mistakes
        .map(
          (mistake) => `
            <article class="mistake-card">
              <div>
                <p class="section-label">${escapeHtml(localizedText(mistake.type || "Practice"))}</p>
                <strong>${escapeHtml(localizedText(mistake.prompt || "Review this item."))}</strong>
                ${mistake.arabic ? `<button class="arabic-example compact-arabic" type="button" data-speak="${escapeHtml(mistake.arabic)}" lang="ar">${mistake.arabic}</button>` : ""}
              </div>
              <div class="mistake-answer-grid">
                <span><small>${t("yourAnswer", "Your answer")}</small>${renderAnswerDisplay(mistake.given || "Blank", { arabic: mistake.given === mistake.expected ? mistake.arabic || "" : "" }, { includeSourceContext: false })}</span>
                <span><small>${t("correctAnswer", "Correct answer")}</small>${renderAnswerDisplay(mistake.expected || "", { arabic: mistake.arabic || "" })}</span>
              </div>
              <div class="review-card-actions">
                <button class="ghost-button compact-button" type="button" data-resolve-mistake="${escapeHtml(mistake.id)}">${icon("check")} ${t("markResolved", "Mark resolved")}</button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderResourcesPage() {
  return `
    <section class="page-stack">
      <div class="page-heading">
        <div>
          <p class="section-label">${t("availableBooks", "Available Books")}</p>
          <h2>${t("resourcesTitle", "Resources")}</h2>
        </div>
      </div>
      <div class="resource-grid">
        ${state.data.resources
          .map(
            (resource) => `
              <article class="card resource-card">
                <span class="quick-icon">${icon("resources")}</span>
                <p class="section-label">${escapeHtml(localizedText(resource.kind))}</p>
                <h3>${escapeHtml(localizedText(resource.title))}</h3>
                <p>${escapeHtml(localizedText(resource.description))}</p>
                <button class="ghost-button" type="button" data-route="${routeForResource(resource)}">${t("open", "Open")} ${icon("arrow")}</button>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderProgressPage() {
  return `
    <section class="page-stack">
      <div class="page-heading">
        <div>
          <p class="section-label">${t("progress", "Progress")}</p>
          <h2>${t("learningOverview", "Learning Overview")}</h2>
        </div>
      </div>
      ${renderProgressPanel(true)}
      ${renderBookProgressMap()}
      <div class="card milestone-card">
        <h3>${t("completedLessons", "Completed Lessons")}</h3>
        <div class="milestone-grid">
          ${state.data.lessons
            .map(
              (lesson) => `
              <button class="milestone ${state.progress.completedLessonIds.includes(lesson.id) ? "done" : ""} ${lessonMasteryStatus(lesson).key}" type="button" data-lesson="${lesson.id}">
                <span>${lesson.number}</span>
                <strong>${escapeHtml(localizedLessonTitle(lesson))}</strong>
                <small>${lessonMasteryStatus(lesson).label} · ${lessonMastery(lesson)}%</small>
              </button>
              `
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function renderBookProgressMap() {
  return `
    <section class="card progress-map-card">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${t("roadmap", "Roadmap")}</p>
          <h3>${t("bookProgressMap", "Book progress map")}</h3>
        </div>
        <span class="pill">${state.progress.completedLessonIds.length} ${t("completed", "completed")}</span>
      </div>
      <div class="book-progress-map">
        ${state.data.books.map((book) => {
          const lessons = lessonsForBook(book.slug);
          const locked = !canAccessBookSlug(book.slug);
          const completeCount = lessons.filter((lesson) => state.progress.completedLessonIds.includes(lesson.id)).length;
          return `
            <article class="book-map ${locked ? "locked" : ""}">
              <div>
                <strong>${escapeHtml(localizedBookTitle(book))}</strong>
                <span>${locked ? t("lockedPremium", "Premium") : `${completeCount}/${lessons.length} ${t("lessons", "lessons")}`}</span>
              </div>
              <div class="lesson-dot-row" aria-label="${escapeHtml(localizedBookTitle(book))}">
                ${lessons.map((lesson) => `
                  <button class="lesson-dot ${state.progress.completedLessonIds.includes(lesson.id) ? "done" : ""} ${lessonMasteryStatus(lesson).key}" type="button" data-lesson="${lesson.id}" ${locked ? "disabled" : ""} aria-label="${t("lesson", "Lesson")} ${lesson.number}">
                    ${escapeHtml(String(lesson.number))}
                  </button>
                `).join("")}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderAccountPage() {
  const currentLesson = getCurrentLesson();
  const preferences = learningPreferences();
  const databaseMode = state.data.databaseMode === "mongodb" ? "MongoDB Atlas" : "Local JSON";
  const planKey = currentPlanKey();
  const planName = localizedPlanLabel(planKey);
  const subscriptionStatus = state.user.subscriptionStatus || "active";
  const unlockedBooks = state.data.books.filter((book) => book.status === "available" && canAccessBookSlug(book.slug)).length;
  const accountStats = [
    { label: t("accountStatus", "Account status"), value: t("active", "Active"), detail: t("signedInSaved", "Signed in and progress is saved") },
    { label: t("emailVerification", "Email verification"), value: state.user.emailVerified ? t("verified", "Verified") : t("unverified", "Unverified"), detail: state.user.emailVerified ? t("emailVerifiedText", "Email confirmed") : t("verifyEmailText", "Verify before production use") },
    { label: t("currentPlan", "Current plan"), value: planName, detail: planKey === "paid" ? t("allBooksUnlocked", "Books 1-3 unlocked") : t("bookOneIncluded", "Book 1 included") },
    { label: t("subscriptionStatus", "Subscription status"), value: subscriptionStatus, detail: t("membershipAccess", "Membership access status") },
    { label: t("contentAccess", "Content access"), value: `${unlockedBooks}/${state.data.books.length} ${t("books", "books")}`, detail: planKey === "paid" ? t("fullWorkspace", "Full workspace") : t("freeWorkspace", "Free workspace") }
  ];

  return `
    <section class="page-stack account-page">
      <div class="page-heading">
        <div>
          <p class="section-label">${t("account", "Account")}</p>
          <h2>${t("profileDetails", "Profile Details")}</h2>
        </div>
        <span class="pill">${escapeHtml(planName)}</span>
      </div>
      <section class="card account-hero">
        <div class="account-identity">
          <span class="account-avatar" aria-hidden="true">${escapeHtml(state.user.displayName.slice(0, 1).toUpperCase())}</span>
          <div>
            <p class="section-label">${t("signedInAs", "Signed in as")}</p>
            <h2>${escapeHtml(state.user.displayName)}</h2>
            <p class="account-email">${escapeHtml(state.user.email)}</p>
          </div>
        </div>
        <div class="account-actions">
          <button class="primary-button" type="button" data-route="${escapeHtml(currentLesson.bookSlug)}">${icon("book")} ${t("continue", "Continue")} ${escapeHtml(localizedBookTitle(getBook(currentLesson.bookSlug)))}</button>
          <button class="ghost-button" type="button" data-route="subscription">${icon("spark")} ${t("subscription", "Subscription")}</button>
          ${state.user.billingPortalAvailable ? `<button class="ghost-button" type="button" data-billing-portal>${icon("spark")} ${t("manageBilling", "Manage billing")}</button>` : ""}
          ${state.user.emailVerified ? "" : `<button class="ghost-button" type="button" data-send-verification>${icon("check")} ${t("verifyEmail", "Verify email")}</button>`}
          ${isAdmin() ? `<button class="ghost-button" type="button" data-route="admin">${icon("target")} ${t("admin", "Admin")}</button>` : ""}
          <button class="ghost-button danger-button" type="button" data-auth-signout>${icon("x")} ${t("signOut", "Sign out")}</button>
        </div>
      </section>
      <section class="account-stat-grid">
        ${accountStats
          .map((item) => `
            <article class="card account-stat">
              <p class="section-label">${escapeHtml(item.label)}</p>
              <strong>${escapeHtml(item.value)}</strong>
              <span>${escapeHtml(item.detail)}</span>
            </article>
          `)
          .join("")}
      </section>
      <section class="card preference-panel">
        <div class="subsection-heading">
          <div>
            <p class="section-label">${t("learningPreferences", "Learning Preferences")}</p>
            <h3>${t("audioAndDisplay", "Audio and display")}</h3>
          </div>
          <span class="pill">${navigator.onLine ? t("online", "Online") : t("offline", "Offline")}</span>
        </div>
        <div class="preference-grid">
          <div class="preference-choice wide">
            <span>${t("studyProfile", "Study profile")}</span>
            <div class="filter-chip-row">
              ${[
                ["guided-books", t("guidedBooks", "Guided books")],
                ["quran-grammar", t("quranGrammar", "Qur'an grammar")],
                ["vocabulary", t("vocabulary", "Vocabulary")],
                ["exam-revision", t("examRevision", "Exam revision")]
              ].map(([value, label]) => `
                <button class="filter-chip ${preferences.studyGoal === value ? "active" : ""}" type="button" data-study-pref-key="studyGoal" data-study-pref-value="${value}">
                  ${escapeHtml(label)}
                </button>
              `).join("")}
            </div>
          </div>
          <div class="preference-choice wide">
            <span>${t("skillFocus", "Skill focus")}</span>
            <div class="filter-chip-row">
              ${[
                ["balanced", t("balanced", "Balanced")],
                ["reading", t("reading", "Reading")],
                ["vocabulary", t("vocabulary", "Vocabulary")],
                ["grammar", t("grammar", "Grammar")]
              ].map(([value, label]) => `
                <button class="filter-chip ${preferences.skillFocus === value ? "active" : ""}" type="button" data-study-pref-key="skillFocus" data-study-pref-value="${value}">
                  ${escapeHtml(label)}
                </button>
              `).join("")}
            </div>
          </div>
          <div class="preference-choice wide">
            <span>${t("dailyTime", "Daily time")}</span>
            <div class="filter-chip-row">
              ${[5, 10, 15, 25].map((value) => `
                <button class="filter-chip ${Number(preferences.dailyMinutes) === value ? "active" : ""}" type="button" data-study-pref-key="dailyMinutes" data-study-pref-value="${value}">
                  ${value}m
                </button>
              `).join("")}
            </div>
          </div>
          <div class="preference-choice wide">
            <span>${t("reminderTime", "Reminder time")}</span>
            <div class="filter-chip-row">
              ${["none", "07:00", "18:00", "21:00"].map((value) => `
                <button class="filter-chip ${String(preferences.reminderTime || "none") === value ? "active" : ""}" type="button" data-reminder-time="${value}">
                  ${value === "none" ? t("off", "Off") : value}
                </button>
              `).join("")}
            </div>
          </div>
          <div class="preference-choice wide">
            <span>${t("offlineLessonPack", "Offline lesson pack")}</span>
            <div class="filter-chip-row">
              ${["recent", "book-1", "book-2", "book-3"].map((value) => {
                const locked = value !== "recent" && !canAccessBookSlug(value);
                return `
                  <button class="filter-chip ${String(preferences.offlinePack || "recent") === value ? "active" : ""}" type="button" data-offline-pack="${value}" ${locked ? "disabled" : ""}>
                    ${value === "recent" ? t("recentLessons", "Recent lessons") : escapeHtml(localizedBookTitle(getBook(value)))}
                    ${locked ? `<small>${t("lockedPremium", "Premium")}</small>` : ""}
                  </button>
                `;
              }).join("")}
            </div>
          </div>
          <label class="range-control">
            <span>${t("audioSpeed", "Arabic audio speed")} <strong>${state.audioRate.toFixed(2)}x</strong></span>
            <input type="range" min="0.55" max="1.1" step="0.05" value="${state.audioRate}" data-audio-rate />
          </label>
          <label class="range-control">
            <span>${t("arabicTextSize", "Arabic text size")} <strong>${Math.round(state.arabicFontScale * 100)}%</strong></span>
            <input type="range" min="0.9" max="1.2" step="0.05" value="${state.arabicFontScale}" data-arabic-scale />
          </label>
          <button class="ghost-button" type="button" data-request-reminders>${icon("flame")} ${t("enableReminders", "Enable reminders")}</button>
          <button class="ghost-button" type="button" data-install-offline>${icon("check")} ${t("refreshOffline", "Refresh offline cache")}</button>
        </div>
        ${state.reminderNotice ? `<p class="preference-note">${escapeHtml(state.reminderNotice)}</p>` : ""}
        ${state.offlineNotice ? `<p class="preference-note">${escapeHtml(state.offlineNotice)}</p>` : ""}
      </section>
      <section class="card account-detail-panel">
        <div>
          <p class="section-label">${t("accountData", "Account data")}</p>
          <h3>${t("accountStatusDetails", "Current membership and login details")}</h3>
          <p>${t("accountStatusText", "This page only shows the status of the signed-in account. Plan features are listed in the Subscription tab.")}</p>
        </div>
        <dl class="account-detail-list">
          <div>
            <dt>${t("email", "Email")}</dt>
            <dd>${escapeHtml(state.user.email)}</dd>
          </div>
          <div>
            <dt>${t("userId", "User ID")}</dt>
            <dd>${escapeHtml(state.user.userId)}</dd>
          </div>
          <div>
            <dt>${t("storage", "Storage")}</dt>
            <dd>${escapeHtml(databaseMode)}</dd>
          </div>
          <div>
            <dt>${t("subscriptionStatus", "Subscription status")}</dt>
            <dd>${escapeHtml(planName)} · ${escapeHtml(subscriptionStatus)}</dd>
          </div>
        </dl>
      </section>
    </section>
  `;
}

function renderAdminPage() {
  if (!state.adminContent && !state.adminLoading && !state.adminError) {
    loadAdminContent();
  }

  const tabs = [
    ["vocabulary", t("vocabulary", "Vocabulary")],
    ["lessons", t("lessons", "Lessons")],
    ["exercises", t("exercises", "Exercises")]
  ];
  const items = state.adminContent?.[state.adminTab] || [];
  const adminQuery = state.adminSearch.trim().toLowerCase();
  const filteredItems = adminQuery
    ? items.filter((item) => JSON.stringify(item).toLowerCase().includes(adminQuery))
    : items;
  const visibleItems = filteredItems.slice(0, 12);
  const reviewItems = ["lessons", "vocabulary", "exercises"].flatMap((collection) =>
    (state.adminContent?.[collection] || [])
      .filter((item) => !["published", "verified"].includes(item.contentStatus))
      .map((item) => ({ ...item, collection }))
  ).slice(0, 10);
  const reports = state.adminContent?.reports || [];

  return `
    <section class="page-stack admin-page">
      <div class="page-heading">
        <div>
          <p class="section-label">${t("admin", "Admin")}</p>
          <h2>${t("contentManagement", "Content Management")}</h2>
        </div>
        <span class="pill">${filteredItems.length}/${items.length} ${t("items", "items")}</span>
      </div>
      <section class="card admin-panel">
        <div class="vocabulary-tabs" role="tablist" aria-label="${t("adminSections", "Admin sections")}">
          ${tabs.map(([id, label]) => `
            <button class="vocab-tab ${state.adminTab === id ? "active" : ""}" type="button" data-admin-tab="${id}">
              ${escapeHtml(label)}
            </button>
          `).join("")}
        </div>
        <div class="admin-toolbar">
          <label class="search admin-search">
            ${icon("search")}
            <input value="${escapeHtml(state.adminSearch)}" placeholder="${t("adminSearchPlaceholder", "Search content by Arabic, English, lesson, or ID")}" aria-label="${t("adminSearchPlaceholder", "Search content by Arabic, English, lesson, or ID")}" data-admin-search />
          </label>
          <span class="pill muted">${visibleItems.length} ${t("shown", "shown")}</span>
          <button class="ghost-button compact-button" type="button" data-admin-search-clear ${state.adminSearch ? "" : "disabled"}>${t("clear", "Clear")}</button>
          <a class="ghost-button compact-button admin-export-link" href="/api/admin/export" download>${t("export", "Export")}</a>
        </div>
        ${reviewItems.length ? `
          <section class="admin-review-queue">
            <div>
              <p class="section-label">${t("reviewQueue", "Review Queue")}</p>
              <h3>${reviewItems.length} ${t("itemsNeedReview", "items need review")}</h3>
            </div>
            <div class="chip-row">
              ${reviewItems.map((item) => `<button type="button" data-admin-search-fill="${escapeHtml(item.id)}">${escapeHtml(item.collection)} · ${escapeHtml(item.id)}</button>`).join("")}
            </div>
          </section>
        ` : ""}
        ${state.adminStatus ? `<div class="feedback correct">${icon("check")}<span>${escapeHtml(state.adminStatus)}</span></div>` : ""}
        ${state.adminError ? `<div class="feedback incorrect">${icon("x")}<span>${escapeHtml(state.adminError)}</span></div>` : ""}
        ${state.adminImportStatus ? `<div class="feedback correct">${icon("check")}<span>${escapeHtml(state.adminImportStatus)}</span></div>` : ""}
        ${state.adminImportError ? `<div class="feedback incorrect">${icon("x")}<span>${escapeHtml(state.adminImportError)}</span></div>` : ""}
        ${reports.length ? renderAdminReportInbox(reports) : ""}
        ${renderAdminImportPanel()}
        ${state.adminLoading ? `<p class="translation">${t("loading", "Loading...")}</p>` : ""}
        ${state.adminContent ? `
          <div class="admin-list">
            ${visibleItems.map((item) => renderAdminEditor(state.adminTab, item)).join("") || `<p class="empty-state">${t("noContentMatches", "No content matches this search.")}</p>`}
          </div>
        ` : ""}
      </section>
    </section>
  `;
}

function renderAdminReportInbox(reports) {
  return `
    <section class="admin-report-inbox">
      <div class="subsection-heading">
        <div>
          <p class="section-label">${t("learnerReports", "Learner reports")}</p>
          <h3>${reports.length} ${t("contentReports", "content reports")}</h3>
        </div>
      </div>
      <div class="admin-report-list">
        ${reports.slice(0, 6).map((report) => `
          <article>
            <span>${escapeHtml(report.kind)} · ${escapeHtml(report.itemId)}</span>
            <strong>${escapeHtml(report.message)}</strong>
            <small>${escapeHtml(report.bookSlug || report.route || "")}</small>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderAdminImportPanel() {
  return `
    <details class="admin-import-panel">
      <summary>${icon("download")} <span>${t("bulkImport", "Bulk import")}</span></summary>
      <form data-admin-import-form>
        <label class="form-field">
          <span>${t("collection", "Collection")}</span>
          <select name="collection">
            ${["vocabulary", "lessons", "exercises"].map((collection) => `<option value="${collection}" ${state.adminTab === collection ? "selected" : ""}>${collection}</option>`).join("")}
          </select>
        </label>
        <label class="form-field">
          <span>${t("jsonItems", "JSON items")}</span>
          <textarea name="items" data-admin-import-text placeholder='[{"id":"lesson-1","contentStatus":"needs-review"}]'>${escapeHtml(state.adminImportText)}</textarea>
        </label>
        <p class="preference-note">${t("bulkImportHint", "Paste an array of existing items. The server validates IDs, allowed fields, and JSON shape before saving.")}</p>
        <button class="primary-button compact-button" type="submit">${t("validateAndImport", "Validate and import")}</button>
      </form>
    </details>
  `;
}

function renderAdminEditor(collection, item) {
  const statusOptions = ["draft", "generated-review", "needs-review", "published", "verified"];
  if (collection === "vocabulary") {
    return `
      <form class="admin-editor" data-admin-content-form>
        <input type="hidden" name="collection" value="vocabulary" />
        <input type="hidden" name="id" value="${escapeHtml(item.id)}" />
        <div class="admin-editor-heading">
          <strong>${escapeHtml(item.id)}</strong>
          <span>${escapeHtml(item.bookSlug)} · ${escapeHtml(item.lessonNumber)}</span>
        </div>
        <label class="form-field"><span>${t("arabic", "Arabic")}</span><input name="arabic" value="${escapeHtml(item.arabic)}" dir="rtl" /></label>
        <label class="form-field"><span>${t("english", "English")}</span><input name="english" value="${escapeHtml(item.english)}" /></label>
        <label class="form-field"><span>${t("transliteration", "Transliteration")}</span><input name="transliteration" value="${escapeHtml(item.transliteration || "")}" /></label>
        <label class="form-field"><span>${t("audioNote", "Audio note")}</span><input name="audioNote" value="${escapeHtml(item.audioNote || "")}" /></label>
        <label class="form-field"><span>${t("contentStatus", "Content status")}</span>
          <select name="contentStatus">
            ${statusOptions.map((status) => `<option value="${status}" ${item.contentStatus === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </label>
        <label class="form-field"><span>${t("sourceRef", "Source reference")}</span><input name="sourceRef" value="${escapeHtml(item.sourceRef || "")}" /></label>
        <button class="primary-button compact-button" type="submit">${t("save", "Save")}</button>
      </form>
    `;
  }

  if (collection === "lessons") {
    return `
      <form class="admin-editor wide" data-admin-content-form>
        <input type="hidden" name="collection" value="lessons" />
        <input type="hidden" name="id" value="${escapeHtml(item.id)}" />
        <div class="admin-editor-heading">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.bookSlug)} · ${t("lesson", "Lesson")} ${escapeHtml(item.number)}</span>
        </div>
        <label class="form-field"><span>${t("title", "Title")}</span><input name="title" value="${escapeHtml(item.title)}" /></label>
        <label class="form-field"><span>${t("focus", "Focus")}</span><textarea name="focus">${escapeHtml(item.focus || "")}</textarea></label>
        <label class="form-field"><span>${t("translation", "Translation")}</span><textarea name="translation">${escapeHtml(item.translation || "")}</textarea></label>
        <label class="form-field"><span>${t("contentStatus", "Content status")}</span>
          <select name="contentStatus">
            ${statusOptions.map((status) => `<option value="${status}" ${item.contentStatus === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </label>
        <label class="form-field"><span>${t("sourceRef", "Source reference")}</span><input name="sourceRef" value="${escapeHtml(item.sourceRef || "")}" /></label>
        <label class="form-field"><span>${t("exercisePrompts", "Exercise prompts")}</span><textarea name="exercisePromptsLines">${escapeHtml((item.exercisePrompts || []).join("\n"))}</textarea></label>
        <label class="form-field"><span>${t("examplesJson", "Examples JSON")}</span><textarea name="examplesJson">${escapeHtml(JSON.stringify(item.examples || [], null, 2))}</textarea></label>
        <label class="form-field"><span>${t("grammarExplanationJson", "Grammar explanation JSON")}</span><textarea name="grammarExplanationJson">${escapeHtml(JSON.stringify(item.grammarExplanation || {}, null, 2))}</textarea></label>
        <label class="form-field"><span>${t("morphologyCardsJson", "Morphology cards JSON")}</span><textarea name="morphologyCardsJson">${escapeHtml(JSON.stringify(item.morphologyCards || [], null, 2))}</textarea></label>
        <div class="admin-preview">
          <span class="section-label">${t("preview", "Preview")}</span>
          <button class="example-arabic compact-arabic" type="button" data-speak="${escapeHtml(item.arabic || "")}" lang="ar">${escapeHtml(item.arabic || "")}</button>
          <p>${escapeHtml(localizedText(item.translation || ""))}</p>
        </div>
        <button class="primary-button compact-button" type="submit">${t("save", "Save")}</button>
      </form>
    `;
  }

  return `
    <form class="admin-editor wide" data-admin-content-form>
      <input type="hidden" name="collection" value="exercises" />
      <input type="hidden" name="id" value="${escapeHtml(item.id)}" />
      <div class="admin-editor-heading">
        <strong>${escapeHtml(item.id)}</strong>
        <span>${escapeHtml(item.bookSlug)} · ${escapeHtml(item.lessonId)}</span>
      </div>
      <label class="form-field"><span>${t("prompt", "Prompt")}</span><textarea name="prompt">${escapeHtml(item.prompt || "")}</textarea></label>
      <label class="form-field"><span>${t("arabic", "Arabic")}</span><input name="arabic" value="${escapeHtml(item.arabic || "")}" dir="rtl" /></label>
      <label class="form-field"><span>${t("correctAnswer", "Correct answer")}</span><input name="answer" value="${escapeHtml(item.answer || "")}" /></label>
      <label class="form-field"><span>${t("options", "Options")}</span><textarea name="optionsLines">${escapeHtml((item.options || []).join("\n"))}</textarea></label>
      <label class="form-field"><span>${t("contentStatus", "Content status")}</span>
        <select name="contentStatus">
          ${statusOptions.map((status) => `<option value="${status}" ${item.contentStatus === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </label>
      <label class="form-field"><span>${t("sourceRef", "Source reference")}</span><input name="sourceRef" value="${escapeHtml(item.sourceRef || "")}" /></label>
      <button class="primary-button compact-button" type="submit">${t("save", "Save")}</button>
    </form>
  `;
}

function renderProgressPanel(wide = false) {
  const items = [
    { label: t("vocabularyLearned", "Vocabulary learned"), value: state.progress.learnedVocabularyIds.length, percent: vocabularyPercent() },
    { label: t("lessonsCompleted", "Lessons completed"), value: `${state.progress.completedLessonIds.length}/${state.data.lessons.length}`, percent: lessonProgressPercent() },
    { label: t("weeklyGoal", "Weekly goal"), value: `${state.progress.weeklyGoalCompleted}/${state.progress.weeklyGoalTarget}`, percent: weeklyPercent() }
  ];

  return `
    <section class="card progress-panel ${wide ? "wide" : ""}">
      <div class="panel-heading">
        <p class="section-label">${t("progress", "Progress")}</p>
        <h2>${t("learningGoals", "Learning Goals")}</h2>
      </div>
      <div class="rings">
        ${items
          .map(
            (item) => `
              <article class="ring-card">
                <div class="ring" style="--value:${item.percent}">
                  <span>${item.value}</span>
                </div>
                <p>${item.label}</p>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderBooksPanel() {
  const availableCount = state.data.books.filter((book) => book.status === "available" && canAccessBookSlug(book.slug)).length;
  return `
    <section class="books-panel">
      <div class="panel-heading inline">
        <div>
          <p class="section-label">${t("books", "Books")}</p>
          <h2>Madinah Arabic</h2>
        </div>
        <span class="pill muted">${availableCount} ${t("available", "available")}</span>
      </div>
      ${state.data.books
        .map(
          (book, index) => {
            const locked = book.status !== "available" || !canAccessBookSlug(book.slug);
            return `
            <button class="book-card ${locked ? "locked" : ""}" type="button" data-route="${book.slug}">
              <span class="book-number">${index + 1}</span>
              <span>
                <strong>${escapeHtml(localizedBookTitle(book))}</strong>
                <small>${book.status !== "available" ? t("comingSoon", "Coming Soon") : locked ? t("lockedPremium", "Premium") : `${book.lessonCount} ${t("lessons", "lessons")}`}</small>
              </span>
              ${icon(locked ? "lock" : "book")}
            </button>
          `;
          }
        )
        .join("")}
    </section>
  `;
}

function renderLockedBook() {
  const book = state.data.books.find((item) => item.slug === state.route);
  return `
    <section class="locked-page card">
      <span class="locked-icon">${icon("lock")}</span>
      <p class="section-label">${escapeHtml(localizedBookTitle(book))}</p>
      <h2>${t("comingSoon", "Coming Soon")}</h2>
      <p>${escapeHtml(localizedBookSummary(book))}</p>
      <button class="primary-button" type="button" data-route="${escapeHtml(getCurrentLesson()?.bookSlug || "book-1")}">${icon("book")} ${t("continueLearning", "Continue learning")}</button>
    </section>
  `;
}

document.addEventListener("click", (event) => {
  const authModeButton = event.target.closest("[data-auth-mode]");
  if (authModeButton) {
    state.authMode = authModeButton.dataset.authMode;
    state.authError = "";
    state.authNotice = "";
    state.authDevToken = "";
    render();
    return;
  }

  const authCloseButton = event.target.closest("[data-auth-close]");
  if (authCloseButton) {
    state.authMode = null;
    state.authError = "";
    state.authNotice = "";
    state.authDevToken = "";
    render();
    return;
  }

  const authSignoutButton = event.target.closest("[data-auth-signout]");
  if (authSignoutButton) {
    signOut();
    return;
  }

  const sendVerificationButton = event.target.closest("[data-send-verification]");
  if (sendVerificationButton) {
    sendEmailVerification();
    return;
  }

  const studyPrefButton = event.target.closest("[data-study-pref-key]");
  if (studyPrefButton) {
    updateStudyPreference(studyPrefButton.dataset.studyPrefKey, studyPrefButton.dataset.studyPrefValue);
    return;
  }

  const reminderTimeButton = event.target.closest("[data-reminder-time]");
  if (reminderTimeButton) {
    updateReminderTime(reminderTimeButton.dataset.reminderTime);
    return;
  }

  const offlinePackButton = event.target.closest("[data-offline-pack]");
  if (offlinePackButton) {
    updateOfflinePack(offlinePackButton.dataset.offlinePack);
    return;
  }

  const bookmarkButton = event.target.closest("[data-bookmark-type]");
  if (bookmarkButton) {
    toggleBookmark(bookmarkButton.dataset.bookmarkType, bookmarkButton.dataset.bookmarkId);
    return;
  }

  const onboardingCompleteButton = event.target.closest("[data-onboarding-complete]");
  if (onboardingCompleteButton) {
    completeOnboarding();
    return;
  }

  const openLessonTabButton = event.target.closest("[data-open-lesson]");
  if (openLessonTabButton) {
    openLessonTab(openLessonTabButton.dataset.openLesson, openLessonTabButton.dataset.openLessonTab || "learn");
    return;
  }

  const nativeOpenListenButton = event.target.closest("[data-native-open-listen]");
  if (nativeOpenListenButton) {
    state.route = "vocabulary";
    state.vocabularyTab = "listen";
    state.motion.view = true;
    render();
    return;
  }

  const adminTabButton = event.target.closest("[data-admin-tab]");
  if (adminTabButton) {
    state.adminTab = adminTabButton.dataset.adminTab;
    state.adminSearch = "";
    state.adminStatus = "";
    state.adminError = "";
    render();
    return;
  }

  const adminSearchClearButton = event.target.closest("[data-admin-search-clear]");
  if (adminSearchClearButton) {
    state.adminSearch = "";
    render();
    return;
  }

  const adminSearchFillButton = event.target.closest("[data-admin-search-fill]");
  if (adminSearchFillButton) {
    state.adminSearch = adminSearchFillButton.dataset.adminSearchFill || "";
    render();
    return;
  }

  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    setRoute(routeButton.dataset.route);
    return;
  }

  const lessonButton = event.target.closest("[data-lesson]");
  if (lessonButton) {
    setLesson(lessonButton.dataset.lesson);
    return;
  }

  const lessonTabButton = event.target.closest("[data-lesson-tab]");
  if (lessonTabButton) {
    state.lessonTab = lessonTabButton.dataset.lessonTab;
    state.motion.view = true;
    render();
    return;
  }

  const vocabularyTabButton = event.target.closest("[data-vocabulary-tab]");
  if (vocabularyTabButton) {
    state.vocabularyTab = vocabularyTabButton.dataset.vocabularyTab;
    state.motion.view = true;
    render();
    return;
  }

  const vocabularyBookButton = event.target.closest("[data-vocabulary-book]");
  if (vocabularyBookButton) {
    setVocabularyBook(vocabularyBookButton.dataset.vocabularyBook);
    return;
  }

  const vocabPageButton = event.target.closest("[data-vocab-page]");
  if (vocabPageButton) {
    state.vocabularyPage = Number(vocabPageButton.dataset.vocabPage) || 1;
    render();
    return;
  }

  const vocabTesterBookButton = event.target.closest("[data-vocab-tester-book]");
  if (vocabTesterBookButton) {
    toggleVocabTesterBook(vocabTesterBookButton.dataset.vocabTesterBook);
    return;
  }

  const vocabTesterFocusButton = event.target.closest("[data-vocab-tester-focus]");
  if (vocabTesterFocusButton) {
    toggleVocabTesterFocus(vocabTesterFocusButton.dataset.vocabTesterFocus);
    return;
  }

  const vocabTesterFiltersToggle = event.target.closest("[data-vocab-tester-filters-toggle]");
  if (vocabTesterFiltersToggle) {
    state.mobileFilterSheetOpen = true;
    render();
    return;
  }

  if (event.target.matches("[data-filter-sheet-backdrop]") || event.target.closest("[data-filter-sheet-close]")) {
    state.mobileFilterSheetOpen = false;
    render();
    return;
  }

  const bookExerciseButton = event.target.closest("[data-book-exercise-complete]");
  if (bookExerciseButton) {
    markBookExerciseComplete(bookExerciseButton.dataset.bookExerciseComplete);
    return;
  }

  const vocabTesterNewButton = event.target.closest("[data-vocab-tester-new]");
  if (vocabTesterNewButton) {
    generateVocabTester();
    return;
  }

  const nativeSessionStartButton = event.target.closest("[data-native-session-start]");
  if (nativeSessionStartButton) {
    startNativeDailySession();
    return;
  }

  const nativeSessionNextButton = event.target.closest("[data-native-session-next]");
  if (nativeSessionNextButton) {
    advanceNativeDailySession();
    return;
  }

  const nativeSessionFinishButton = event.target.closest("[data-native-session-finish]");
  if (nativeSessionFinishButton) {
    finishNativeDailySession();
    return;
  }

  const nativeSessionWordButton = event.target.closest("[data-native-session-word]");
  if (nativeSessionWordButton) {
    const correct = nativeSessionWordButton.dataset.nativeSessionCorrect === "true";
    markReviewWord(nativeSessionWordButton.dataset.nativeSessionWord, correct);
    advanceNativeDailySession();
    return;
  }

  const nativeSessionMistakeButton = event.target.closest("[data-native-session-mistake]");
  if (nativeSessionMistakeButton) {
    resolveMistake(nativeSessionMistakeButton.dataset.nativeSessionMistake);
    advanceNativeDailySession();
    return;
  }

  const nativeSessionQuizButton = event.target.closest("[data-native-session-quiz-answer]");
  if (nativeSessionQuizButton) {
    answerNativeDailyQuiz(nativeSessionQuizButton.dataset.nativeSessionQuizAnswer);
    return;
  }

  const vocabTesterAnswerButton = event.target.closest("[data-vocab-tester-answer]");
  if (vocabTesterAnswerButton) {
    answerVocabTester(vocabTesterAnswerButton.dataset.vocabTesterQuestion, vocabTesterAnswerButton.dataset.vocabTesterAnswer);
    return;
  }

  const nativeNextQuestionButton = event.target.closest("[data-native-next-question]");
  if (nativeNextQuestionButton) {
    moveNativeTesterNext();
    return;
  }

  const nativeAudioPlayButton = event.target.closest("[data-native-audio-play]");
  if (nativeAudioPlayButton) {
    if (!state.nativeAudioReview) state.nativeAudioReview = createNativeAudioReview(currentVocabularyBook());
    if (state.nativeAudioReview?.arabic) speak(state.nativeAudioReview.arabic);
    return;
  }

  const nativeAudioNewButton = event.target.closest("[data-native-audio-new]");
  if (nativeAudioNewButton) {
    generateNativeAudioReview(true);
    return;
  }

  const nativeAudioAnswerButton = event.target.closest("[data-native-audio-answer]");
  if (nativeAudioAnswerButton) {
    answerNativeAudioReview(nativeAudioAnswerButton.dataset.nativeAudioAnswer);
    return;
  }

  const cumulativeNewButton = event.target.closest("[data-cumulative-new]");
  if (cumulativeNewButton) {
    generateCumulativeTest(cumulativeNewButton.dataset.cumulativeNew);
    return;
  }

  const cumulativeAnswerButton = event.target.closest("[data-cumulative-answer]");
  if (cumulativeAnswerButton) {
    answerCumulativeQuestion(
      cumulativeAnswerButton.dataset.cumulativeLesson,
      cumulativeAnswerButton.dataset.cumulativeQuestion,
      cumulativeAnswerButton.dataset.cumulativeAnswer
    );
    return;
  }

  const morphologyAnswerButton = event.target.closest("[data-morph-answer]");
  if (morphologyAnswerButton) {
    answerMorphologyDrill(
      morphologyAnswerButton.dataset.morphLesson,
      morphologyAnswerButton.dataset.morphDrill,
      morphologyAnswerButton.dataset.morphAnswer
    );
    return;
  }

  const sentenceTokenButton = event.target.closest("[data-sentence-token]");
  if (sentenceTokenButton) {
    selectSentenceBuilderToken(sentenceTokenButton.dataset.sentenceToken, sentenceTokenButton.dataset.sentenceIndex);
    return;
  }

  const sentenceRemoveButton = event.target.closest("[data-sentence-remove]");
  if (sentenceRemoveButton) {
    removeSentenceBuilderToken(sentenceRemoveButton.dataset.sentenceRemove, sentenceRemoveButton.dataset.sentencePosition);
    return;
  }

  const sentenceResetButton = event.target.closest("[data-sentence-reset]");
  if (sentenceResetButton) {
    resetSentenceBuilder(sentenceResetButton.dataset.sentenceReset);
    return;
  }

  const checkedTokenButton = event.target.closest("[data-checked-token]");
  if (checkedTokenButton) {
    selectCheckedPracticeToken(checkedTokenButton.dataset.checkedToken, checkedTokenButton.dataset.checkedIndex);
    return;
  }

  const checkedRemoveButton = event.target.closest("[data-checked-remove]");
  if (checkedRemoveButton) {
    removeCheckedPracticeToken(checkedRemoveButton.dataset.checkedRemove, checkedRemoveButton.dataset.checkedPosition);
    return;
  }

  const checkedResetButton = event.target.closest("[data-checked-reset]");
  if (checkedResetButton) {
    resetCheckedPractice(checkedResetButton.dataset.checkedReset);
    return;
  }

  const vocabularyQuizNewButton = event.target.closest("[data-vocab-quiz-new]");
  if (vocabularyQuizNewButton) {
    generateNewVocabularyQuiz(vocabularyQuizNewButton.dataset.vocabQuizNew);
    return;
  }

  const vocabularyQuizAnswerButton = event.target.closest("[data-vocab-quiz-answer]");
  if (vocabularyQuizAnswerButton) {
    answerVocabularyQuiz(vocabularyQuizAnswerButton.dataset.vocabQuizLesson, vocabularyQuizAnswerButton.dataset.vocabQuizAnswer);
    return;
  }

  const retryButton = event.target.closest("[data-retry-answer]");
  if (retryButton) {
    retryAnswer(retryButton.dataset.retryAnswer, {
      exerciseId: retryButton.dataset.retryExerciseId,
      lessonId: retryButton.dataset.retryLessonId,
      questionId: retryButton.dataset.retryQuestionId,
      drillId: retryButton.dataset.retryDrillId
    });
    return;
  }

  const reviewKnownButton = event.target.closest("[data-review-word-known]");
  if (reviewKnownButton) {
    markReviewWord(reviewKnownButton.dataset.reviewWordKnown, true);
    return;
  }

  const reviewAgainButton = event.target.closest("[data-review-word-again]");
  if (reviewAgainButton) {
    markReviewWord(reviewAgainButton.dataset.reviewWordAgain, false);
    return;
  }

  const nativeRestoreStreakButton = event.target.closest("[data-native-restore-streak]");
  if (nativeRestoreStreakButton) {
    restoreNativeStreak();
    return;
  }

  const resolveMistakeButton = event.target.closest("[data-resolve-mistake]");
  if (resolveMistakeButton) {
    resolveMistake(resolveMistakeButton.dataset.resolveMistake);
    return;
  }

  const speakButton = event.target.closest("[data-speak]");
  if (speakButton) {
    speakButton.classList.remove("audio-pulse");
    window.requestAnimationFrame(() => {
      speakButton.classList.add("audio-pulse");
      window.setTimeout(() => speakButton.classList.remove("audio-pulse"), 620);
    });
    speak(speakButton.dataset.speak);
    return;
  }

  const completeButton = event.target.closest("[data-complete]");
  if (completeButton) {
    markLessonComplete(byId(state.data.lessons, completeButton.dataset.complete));
    return;
  }

  const exerciseButton = event.target.closest("[data-exercise]");
  if (exerciseButton) {
    state.selectedExerciseId = exerciseButton.dataset.exercise;
    render();
    return;
  }

  const answerButton = event.target.closest("[data-exercise-answer]");
  if (answerButton) {
    const exercise = byId(state.data.exercises, answerButton.dataset.exerciseAnswer);
    answerExercise(exercise, answerButton.dataset.answer);
    return;
  }

  const themeButton = event.target.closest("[data-theme-toggle]");
  if (themeButton) {
    document.documentElement.classList.add("theme-changing");
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("madinah-theme", state.theme);
    render();
    window.setTimeout(() => document.documentElement.classList.remove("theme-changing"), 320);
    return;
  }

  const reminderButton = event.target.closest("[data-request-reminders]");
  if (reminderButton) {
    requestReminderPermission();
    return;
  }

  const audioRateButton = event.target.closest("[data-audio-rate-toggle]");
  if (audioRateButton) {
    toggleAudioRate();
    return;
  }

  const offlineButton = event.target.closest("[data-install-offline]");
  if (offlineButton) {
    refreshOfflineCache();
    return;
  }

  const billingCheckoutButton = event.target.closest("[data-billing-checkout]");
  if (billingCheckoutButton) {
    startBillingCheckout(billingCheckoutButton.dataset.billingPlan || "monthly");
    return;
  }

  const billingPortalButton = event.target.closest("[data-billing-portal]");
  if (billingPortalButton) {
    openBillingPortal();
    return;
  }
});

document.addEventListener("submit", (event) => {
  const authForm = event.target.closest("[data-auth-form]");
  if (authForm) {
    event.preventDefault();
    submitAuth(authForm);
    return;
  }

  const checkedExerciseForm = event.target.closest("[data-book-exercise-check]");
  if (checkedExerciseForm) {
    event.preventDefault();
    checkBookExercise(checkedExerciseForm);
    return;
  }

  const sentenceBuilderForm = event.target.closest("[data-sentence-builder]");
  if (sentenceBuilderForm) {
    event.preventDefault();
    checkSentenceBuilder(sentenceBuilderForm);
    return;
  }

  const adminForm = event.target.closest("[data-admin-content-form]");
  if (adminForm) {
    event.preventDefault();
    saveAdminContent(adminForm);
    return;
  }

  const adminImportForm = event.target.closest("[data-admin-import-form]");
  if (adminImportForm) {
    event.preventDefault();
    importAdminContent(adminImportForm);
    return;
  }

  const reportForm = event.target.closest("[data-content-report]");
  if (reportForm) {
    event.preventDefault();
    submitContentReport(reportForm);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-lesson-select]")) {
    setLesson(event.target.value);
    return;
  }

  if (event.target.matches("[data-vocab-tester-lesson]")) {
    setVocabTesterLesson(event.target.value);
    return;
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-admin-search]")) {
    state.adminSearch = event.target.value;
    render();
    return;
  }

  if (event.target.matches("[data-admin-import-text]")) {
    state.adminImportText = event.target.value;
    return;
  }

  if (event.target.matches("[data-search]")) {
    state.search = event.target.value;
    if (!isAuthenticated()) {
      state.authMode = "login";
      state.authError = t("searchSignIn", "Please sign in to search the course.");
      render();
      return;
    }

    if (state.route !== "vocabulary") {
      state.route = "vocabulary";
    }
    state.vocabularyPage = 1;
    state.vocabularyTab = "list";
    render();
    return;
  }

  if (event.target.matches("[data-audio-rate]")) {
    state.audioRate = Number(event.target.value) || 0.82;
    localStorage.setItem("madinah-audio-rate", String(state.audioRate));
    render();
    return;
  }

  if (event.target.matches("[data-arabic-scale]")) {
    state.arabicFontScale = Number(event.target.value) || 1;
    localStorage.setItem("madinah-arabic-scale", String(state.arabicFontScale));
    render();
  }
});

let nativeSwipeStart = null;
document.addEventListener("pointerdown", (event) => {
  const card = event.target.closest("[data-swipe-word]");
  if (!card || !isNativeApp()) return;
  nativeSwipeStart = {
    wordId: card.dataset.swipeWord,
    x: event.clientX,
    y: event.clientY,
    time: Date.now()
  };
}, { passive: true });

document.addEventListener("pointerup", (event) => {
  if (!nativeSwipeStart || !isNativeApp()) return;
  const deltaX = event.clientX - nativeSwipeStart.x;
  const deltaY = event.clientY - nativeSwipeStart.y;
  const elapsed = Date.now() - nativeSwipeStart.time;
  const wordId = nativeSwipeStart.wordId;
  nativeSwipeStart = null;

  if (!wordId || Math.abs(deltaX) < 74 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4 || elapsed > 1200) return;
  markReviewWord(wordId, deltaX > 0);
}, { passive: true });

window.addEventListener("error", (event) => {
  reportFrontendError(event.error || event.message, "error");
});

window.addEventListener("unhandledrejection", (event) => {
  reportFrontendError(event.reason, "unhandledrejection");
});

let resizeRenderTimer = null;
window.addEventListener("resize", () => {
  const nextMode = currentViewportMode();
  if (nextMode === state.viewportMode) return;
  window.clearTimeout(resizeRenderTimer);
  resizeRenderTimer = window.setTimeout(() => {
    if (currentViewportMode() !== state.viewportMode) render();
  }, 120);
}, { passive: true });

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch((error) => reportFrontendError(error, "service-worker"));
  });
}

loadApp();
