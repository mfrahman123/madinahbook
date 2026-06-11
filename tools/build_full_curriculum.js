const fs = require("node:fs");

const book1OcrPath = "data/pdf-ocr.txt";
const book2OcrPath = "data/book-2-key-ocr.txt";
const book3OcrPath = "data/book-3-key-ocr.txt";
const outPath = "data/curriculum.json";
const arabicVowelMarks = /[\u064B-\u0650]/;
const arabicCombiningMarks = /[\u064B-\u0652\u0670]/;

const lessonOrder = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23"
];

function normalizeArabicMarks(text) {
  let hasVowel = false;
  const seenMarks = new Set();
  let normalized = "";

  for (const character of text) {
    if (arabicCombiningMarks.test(character)) {
      if (arabicVowelMarks.test(character)) {
        if (hasVowel) continue;
        hasVowel = true;
      } else {
        if (seenMarks.has(character)) continue;
        seenMarks.add(character);
      }

      normalized += character;
      continue;
    }

    hasVowel = false;
    seenMarks.clear();
    normalized += character;
  }

  return normalized;
}

function formatVocabularyArabic(text) {
  const value = normalizeArabicMarks(String(text || "").trim());
  if (value.includes(" / ")) return value;

  if (/[\u0600-\u06FF]\s*:\s*[\u0600-\u06FF]/.test(value)) {
    return value.replace(/\s*:\s*/g, " / ");
  }

  const words = value.split(/\s+/);
  const startsWithMudariPrefix = /^ي[\u064B-\u0652\u0670]?[\u0600-\u06FF]/;
  const startsWithParticle = /^(?:لَا|لَنْ|لَمْ|أَنْ|مَا|يَا|إِنَّ|أَظُنُّ|ثَلَاثُ|مَرَّةً)$/;
  if (
    words.length === 2
    && !startsWithParticle.test(words[0])
    && startsWithMudariPrefix.test(words[1])
  ) {
    return `${words[0]} / ${words[1]}`;
  }

  return value;
}

const arabicBaseLetters = /[\u0621-\u063A\u0641-\u064A\u0671]/;
const arabicMarkPattern = /[\u064B-\u0652\u0670]/;
const sunLetterSounds = {
  "ت": "t",
  "ث": "th",
  "د": "d",
  "ذ": "dh",
  "ر": "r",
  "ز": "z",
  "س": "s",
  "ش": "sh",
  "ص": "s",
  "ض": "d",
  "ط": "t",
  "ظ": "z",
  "ل": "l",
  "ن": "n"
};
const consonantSounds = {
  "ء": "'",
  "أ": "'",
  "إ": "'",
  "ؤ": "'",
  "ئ": "'",
  "ب": "b",
  "ت": "t",
  "ث": "th",
  "ج": "j",
  "ح": "h",
  "خ": "kh",
  "د": "d",
  "ذ": "dh",
  "ر": "r",
  "ز": "z",
  "س": "s",
  "ش": "sh",
  "ص": "s",
  "ض": "d",
  "ط": "t",
  "ظ": "z",
  "ع": "'",
  "غ": "gh",
  "ف": "f",
  "ق": "q",
  "ك": "k",
  "ل": "l",
  "م": "m",
  "ن": "n",
  "ه": "h",
  "ة": "t",
  "و": "w",
  "ي": "y",
  "ى": "aa"
};

function pronunciationNote(arabic, fallback = "") {
  const generated = transliterateArabicExpression(arabic);
  return generated || normalizePronunciationFallback(fallback);
}

function normalizePronunciationFallback(value) {
  return String(value || "")
    .trim()
    .replace(/3/g, "'")
    .replace(/\s+/g, " ");
}

function transliterateArabicExpression(text) {
  return String(text || "")
    .split(" / ")
    .map((part) => part
      .split(/(\s+|[،؛؟,.()])/)
      .map((token) => arabicBaseLetters.test(token) ? transliterateArabicWord(token) : token)
      .join("")
      .replace(/\s+/g, " ")
      .trim())
    .filter(Boolean)
    .join(" / ");
}

function transliterateArabicWord(word) {
  const letters = parseArabicLetters(word);
  if (!letters.length) return "";

  const article = definiteArticlePrefix(letters);
  let output = article.output;

  for (let index = article.nextIndex; index < letters.length; index += 1) {
    const current = letters[index];
    if (index === 0 && ["ا", "أ", "إ", "آ"].includes(current.base)) {
      output += initialAlifSound(current);
      continue;
    }

    if (isLongVowelCarrier(current, letters[index - 1])) continue;

    const baseSound = consonantSound(current, index);
    if (!baseSound) continue;

    const marks = new Set(current.marks);
    const consonant = marks.has("\u0651") ? `${baseSound}${baseSound}` : baseSound;
    const vowel = vowelSound(current, letters[index + 1]);

    output += consonant + vowel.sound;
    if (vowel.skipNext) index += 1;
  }

  return output
    .replace(/'{2,}/g, "'")
    .replace(/^'/, "")
    .replace(/aa'/g, "aa'")
    .toLowerCase();
}

function parseArabicLetters(word) {
  const letters = [];

  for (const character of normalizeArabicMarks(word.replace(/\u0640/g, ""))) {
    if (arabicMarkPattern.test(character)) {
      if (letters.length) letters[letters.length - 1].marks.push(character);
      continue;
    }

    if (arabicBaseLetters.test(character)) {
      letters.push({ base: character === "ٱ" ? "ا" : character, marks: [] });
    }
  }

  return letters;
}

function initialAlifSound(letter) {
  if (letter.base === "آ") return "aa";

  const marks = new Set(letter.marks);
  if (marks.has("\u064f")) return "u";
  if (marks.has("\u0650")) return "i";
  if (marks.has("\u064e")) return "a";
  if (letter.base === "إ") return "i";
  if (letter.base === "أ") return "a";
  return "i";
}

function definiteArticlePrefix(letters) {
  const startsWithArticle = letters.length > 2
    && ["ا", "أ", "إ"].includes(letters[0].base)
    && letters[1].base === "ل";

  if (!startsWithArticle) return { output: "", nextIndex: 0 };

  const firstLetterAfterArticle = letters[2];
  const sunSound = sunLetterSounds[firstLetterAfterArticle.base];
  if (sunSound && firstLetterAfterArticle.marks.includes("\u0651")) {
    return { output: `a${sunSound}-`, nextIndex: 2 };
  }

  return { output: "al-", nextIndex: 2 };
}

function consonantSound(letter, index) {
  if (["ا", "أ", "إ"].includes(letter.base)) {
    return index === 0 ? "" : "'";
  }

  if (letter.base === "ة" && !letter.marks.length) return "h";
  return consonantSounds[letter.base] || "";
}

function vowelSound(letter, nextLetter) {
  const marks = new Set(letter.marks);

  if (marks.has("\u064b")) return { sound: "an", skipNext: isSilentTanwinAlif(nextLetter) };
  if (marks.has("\u064c")) return { sound: "un", skipNext: false };
  if (marks.has("\u064d")) return { sound: "in", skipNext: false };
  if (marks.has("\u064e")) return longVowel("a", "aa", nextLetter, ["ا", "ى"]);
  if (marks.has("\u064f")) return longVowel("u", "uu", nextLetter, ["و"]);
  if (marks.has("\u0650")) return longVowel("i", "ii", nextLetter, ["ي"]);
  return { sound: "", skipNext: false };
}

function longVowel(shortSound, longSound, nextLetter, carriers) {
  if (nextLetter && carriers.includes(nextLetter.base) && !nextLetter.marks.length) {
    return { sound: longSound, skipNext: true };
  }

  return { sound: shortSound, skipNext: false };
}

function isSilentTanwinAlif(letter) {
  return Boolean(letter && letter.base === "ا" && !letter.marks.length);
}

function isLongVowelCarrier(letter, previousLetter) {
  if (letter.marks.length) return false;
  const previousMarks = new Set(previousLetter?.marks || []);
  return (["ا", "ى"].includes(letter.base) && previousMarks.has("\u064e"))
    || (letter.base === "و" && previousMarks.has("\u064f"))
    || (letter.base === "ي" && previousMarks.has("\u0650"));
}

function cleanOcrText(text) {
  return normalizeArabicMarks(text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^--- PAGE/.test(trimmed)) return false;
      if (/^For Personal use Only/.test(trimmed)) return false;
      if (/^and by kind permission/.test(trimmed)) return false;
      if (/^\d+$/.test(trimmed)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim());
}

function normalizeLessonLabel(label) {
  return String(label)
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/^0+/, "");
}

function extractSections(ocrPath = book1OcrPath) {
  if (!fs.existsSync(ocrPath)) return {};
  const text = fs.readFileSync(ocrPath, "utf8");
  const matches = Array.from(text.matchAll(/LESSON\s*([0-9IOl]{1,2}A?)/g));
  const sections = {};

  for (let index = 0; index < matches.length; index += 1) {
    const label = normalizeLessonLabel(matches[index][1]);
    const start = matches[index].index;
    const end = matches[index + 1]?.index ?? text.length;
    sections[label] = cleanOcrText(text.slice(start, end));
  }

  return sections;
}

function exercisePrompts(sourceText) {
  return sourceText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^Ex\.\d+/.test(line) || /^\d+\.\s/.test(line) || /^\(?\d+[a-z]?\)\s*/i.test(line))
    .map((line) => line
      .replace(/^\((\d+[a-z]?)\)\s*/i, "Ex.$1: ")
      .replace(/^(\d+[a-z]?)\)\s*/i, "Ex.$1: ")
      .replace(/^(\d+)\.\s*/, "Ex.$1: ")
      .replace(/\bLeam\b/g, "Learn")
      .replace(/\bLear\b/g, "Learn")
      .replace(/\bRowrite\b/g, "Rewrite")
      .replace(/\s+/g, " "));
}

const lessonExampleCatalog = [
  {
    bookSlug: "book-1",
    match: /Questions|Demonstratives|Tanwin/,
    examples: [
      ["هٰذَا قَلَمٌ.", "This is a pen."],
      ["أَهٰذَا بَيْتٌ؟ نَعَمْ، هٰذَا بَيْتٌ.", "Is this a house? Yes, this is a house."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /ذٰلِكَ/,
    examples: [
      ["ذٰلِكَ مَسْجِدٌ.", "That is a mosque."],
      ["هٰذَا قَلَمٌ وَذٰلِكَ كِتَابٌ.", "This is a pen and that is a book."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /Definite Article|Solar/,
    examples: [
      ["الْقَلَمُ مَكْسُورٌ.", "The pen is broken."],
      ["الشَّمْسُ حَارَّةٌ.", "The sun is hot."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /Prepositions|Direction/,
    examples: [
      ["الْكِتَابُ عَلَى الْمَكْتَبِ.", "The book is on the desk."],
      ["هُوَ فِي الْمَسْجِدِ.", "He is in the mosque."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /Possessive Phrases/,
    examples: [
      ["بَيْتُ الْإِمَامِ قَرِيبٌ.", "The imam's house is near."],
      ["أَيْنَ كِتَابُ الْمُدَرِّسِ؟", "Where is the teacher's book?"]
    ]
  },
  {
    bookSlug: "book-1",
    match: /^Feminine Nouns/,
    examples: [
      ["هٰذِهِ مُدَرِّسَةٌ.", "This is a female teacher."],
      ["لِآمِنَةَ كِتَابٌ جَدِيدٌ.", "Aminah has a new book."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /تِلْكَ/,
    examples: [
      ["تِلْكَ سَيَّارَةٌ.", "That is a car."],
      ["أَتِلْكَ سَاعَةٌ؟ لَا، تِلْكَ سَيَّارَةٌ.", "Is that a watch? No, that is a car."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /Demonstrative plus Definite/,
    examples: [
      ["ذٰلِكَ الْبَيْتُ قَرِيبٌ.", "That house is near."],
      ["هٰذِهِ السَّاعَةُ جَمِيلَةٌ.", "This watch is beautiful."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /Adjectives|Relative Pronouns/,
    examples: [
      ["الْوَلَدُ الَّذِي عِنْدَ الْبَابِ طَالِبٌ.", "The boy who is by the door is a student."],
      ["هٰذَا الرَّجُلُ الطَّوِيلُ مُدَرِّسٌ.", "This tall man is a teacher."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /Possessive Suffixes/,
    examples: [
      ["أَيْنَ قَلَمُهُ؟", "Where is his pen?"],
      ["بَيْتُهَا قَرِيبٌ مِنَ الْمَسْجِدِ.", "Her house is near the mosque."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /فِيهِ|أُحِبُّ/,
    examples: [
      ["فِي الْبَيْتِ غُرْفَةٌ كَبِيرَةٌ.", "In the house there is a large room."],
      ["هٰذَا الْكِتَابُ أُحِبُّهُ.", "This book, I love it."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /أَنْتِ|الَّتِي/,
    examples: [
      ["أَنْتِ طَالِبَةٌ مُجْتَهِدَةٌ.", "You are a hardworking student."],
      ["هٰذِهِ الطَّالِبَةُ الَّتِي فِي الْفَصْلِ.", "This is the student who is in the classroom."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /Plural Forms/,
    examples: [
      ["هُمْ مُدَرِّسُونَ جُدُدٌ.", "They are new teachers."],
      ["أُولٰئِكَ الطُّلَّابُ فِي الْفَصْلِ.", "Those students are in the classroom."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /أَنْتُمْ|نَحْنُ/,
    examples: [
      ["أَيْنَ كُتُبُكُمْ؟", "Where are your books?"],
      ["أَيُّ طَالِبٍ فِي الْمَكْتَبَةِ؟", "Which student is in the library?"]
    ]
  },
  {
    bookSlug: "book-1",
    match: /أَنْتُنَّ|Time Words/,
    examples: [
      ["كُنَّ فِي الْبَيْتِ قَبْلَ الظُّهْرِ.", "They were in the house before noon."],
      ["ذَهَبْتُنَّ إِلَى الْمَدْرَسَةِ بَعْدَ الْفَجْرِ.", "You all went to the school after dawn."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /Rational|Irrational|Plural Review/,
    examples: [
      ["الْبُيُوتُ كَبِيرَةٌ.", "The houses are large."],
      ["أَيْنَ الْأَقْلَامُ الْجَدِيدَةُ؟", "Where are the new pens?"]
    ]
  },
  {
    bookSlug: "book-1",
    match: /Dual/,
    examples: [
      ["هَاتَانِ طَالِبَتَانِ.", "These two are female students."],
      ["أَيْنَ الْوَلَدَانِ اللَّذَانِ فِي الْفَصْلِ؟", "Where are the two boys who are in the classroom?"]
    ]
  },
  {
    bookSlug: "book-1",
    match: /Masculine Nouns/,
    examples: [
      ["عِنْدِي خَمْسَةُ أَقْلَامٍ.", "I have five pens."],
      ["فِي الْفَصْلِ عَشَرَةُ طُلَّابٍ.", "There are ten students in the classroom."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /Feminine Nouns|Feminine one/,
    examples: [
      ["عِنْدِي أَرْبَعُ سَاعَاتٍ.", "I have four watches."],
      ["فِي الْمَدْرَسَةِ سَبْعُ مُدَرِّسَاتٍ.", "There are seven female teachers in the school."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /Review and Test/,
    examples: [
      ["أَحْمَدُ مِنْ بَغْدَادَ.", "Ahmad is from Baghdad."],
      ["ذَاكَ الْبَيْتُ أَحْمَرُ.", "That house is red."]
    ]
  },
  {
    bookSlug: "book-1",
    match: /Diptotes/,
    examples: [
      ["كِتَابُ أَحْمَدَ جَدِيدٌ.", "Ahmad's book is new."],
      ["ذَهَبْتُ إِلَى مَدَارِسَ كَثِيرَةٍ.", "I went to many schools."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /إِنَّ|لَعَلَّ|ذُو/,
    examples: [
      ["لَعَلَّ الطَّالِبَ حَاضِرٌ.", "Perhaps the student is present."],
      ["هٰؤُلَاءِ الطُّلَّابُ ذَوُو خُلُقٍ.", "These students have good character."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /لَيْسَ/,
    examples: [
      ["لَسْتُ مَرِيضًا.", "I am not sick."],
      ["لَيْسَتِ الطَّالِبَةُ غَائِبَةً.", "The student is not absent."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /Comparison|لٰكِنَّ|Numbers 11-20/,
    examples: [
      ["الْمَسْجِدُ أَقْرَبُ مِنَ السُّوقِ.", "The mosque is nearer than the market."],
      ["لٰكِنَّ الدَّرْسَ أَطْوَلُ مِنَ الْقِصَّةِ.", "But the lesson is longer than the story."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /Feminine Past/,
    examples: [
      ["ذَهَبَتِ الطَّالِبَةُ إِلَى الْمَكْتَبَةِ.", "The student went to the library."],
      ["أَظُنُّ أَنَّ آمِنَةَ حَاضِرَةٌ.", "I think Aminah is present."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /Past Tense|Subject, Object|Verb Roots|Past Negation/,
    examples: [
      ["قَرَأَ الطَّالِبُ الدَّرْسَ.", "The student read the lesson."],
      ["مَا خَرَجَ الطَّالِبُ مِنَ الْفَصْلِ.", "The student did not leave the classroom."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /Accusative Pronouns|كَانَ/,
    examples: [
      ["رَأَيْتُهُ فِي الْفَصْلِ.", "I saw him in the classroom."],
      ["كَانَ الطُّلَّابُ حَاضِرِينَ.", "The students were present."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /Present Tense|Mudāriʿ|Mudari/,
    examples: [
      ["نَذْهَبُ إِلَى الْمَكْتَبَةِ يَوْمَ السَّبْتِ.", "We go to the library on Saturday."],
      ["سَأَكْتُبُ لَكَ رِسَالَةً.", "I will write you a letter."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /Imperative/,
    examples: [
      ["اُكْتُبْ يَا بِلَالُ.", "Write, Bilal."],
      ["اُكْتُبُوا أَسْمَاءَكُمْ فِي الدَّفْتَرِ.", "Write your names in the notebook."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /Prohibition|كَادَ/,
    examples: [
      ["لَا تَكْتُبِي عَلَى الْكِتَابِ.", "Do not write on the book."],
      ["لَا تَخْرُجُوا مِنَ الْفَصْلِ.", "Do not leave the classroom."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /يُرِيدُ|أَنْ|Purpose|يُمْكِنُ/,
    examples: [
      ["جِئْتُ لِأَتَعَلَّمَ النَّحْوَ.", "I came to learn grammar."],
      ["يُمْكِنُكَ أَنْ تَكْتُبَ الْجَوَابَ.", "You can write the answer."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /Future Negation/,
    examples: [
      ["لَنْ نَكْتُبَ الدَّرْسَ الْيَوْمَ.", "We will not write the lesson today."],
      ["لَنْ يَخْرُجَ الطَّالِبُ قَبْلَ الظُّهْرِ.", "The student will not leave before noon."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /Dual/,
    examples: [
      ["ذَهَبَ الطَّالِبَانِ إِلَى الْمَسْجِدِ.", "The two students went to the mosque."],
      ["سَأَلْتُ إِحْدَى الطَّالِبَتَيْنِ.", "I asked one of the two students."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /لَمْ|لَمَّا|Parts of Speech|Three Mudāriʿ/,
    examples: [
      ["لَمَّا يَحْضُرِ الْمُدَرِّسُ.", "The teacher has not yet arrived."],
      ["لَمْ يَكْتُبُوا الْوَاجِبَ.", "They did not write the homework."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /Sound Masculine|20-90|Numbers Summary/,
    examples: [
      ["جَاءَ عِشْرُونَ طَالِبًا.", "Twenty students came."],
      ["فِي الْمَدْرَسَةِ ثَلَاثُونَ مُدَرِّسًا.", "There are thirty teachers in the school."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /Mithāl|Ajwaf|Nāqiṣ|Muḍaʿʿaf|Doubled|Weak/,
    examples: [
      ["قَالَ الطَّالِبُ: لَمْ أَقُلْ هٰذَا.", "The student said: I did not say this."],
      ["لَمْ أَحُجَّ قَطُّ.", "I have never performed hajj."]
    ]
  },
  {
    bookSlug: "book-2",
    match: /Adjective Agreement/,
    examples: [
      ["هٰذِهِ طَالِبَةٌ مُجْتَهِدَةٌ.", "This is a hardworking student."],
      ["رَأَيْتُ الطَّالِبَاتِ الْجَدِيدَاتِ.", "I saw the new students."]
    ]
  },
  {
    bookSlug: "book-3",
    match: /Passive/,
    examples: [
      ["فُتِحَ الْبَابُ صَبَاحًا.", "The door was opened in the morning."],
      ["قِيلَ إِنَّ الْبَابَ مُغْلَقٌ.", "It was said that the door is closed."]
    ]
  },
  {
    bookSlug: "book-3",
    match: /Participles/,
    examples: [
      ["هٰذَا بَابٌ مَفْتُوحٌ.", "This is an open door."],
      ["رَأَيْتُ طَالِبًا مُجْتَهِدًا.", "I saw a hardworking student."]
    ]
  },
  {
    bookSlug: "book-3",
    match: /Place and Time|Instrument/,
    examples: [
      ["هٰذَا مِفْتَاحٌ لِلْبَابِ.", "This is a key for the door."],
      ["الْمِصْعَدُ آلَةٌ لِلصُّعُودِ.", "The lift is an instrument for going up."]
    ]
  },
  {
    bookSlug: "book-3",
    match: /Ma'rifah|Nakirah|Omitting Nun|Idafah/,
    examples: [
      ["كِتَابُ الطَّالِبِ عَلَى الْمَكْتَبِ.", "The student's book is on the desk."],
      ["هٰذَانِ طَالِبَا الْمَدْرَسَةِ.", "These two are the school's students."]
    ]
  },
  {
    bookSlug: "book-3",
    match: /Sentence Types|Masdar|Nominal Sentence/,
    examples: [
      ["الْقِرَاءَةُ مُفِيدَةٌ.", "Reading is beneficial."],
      ["سَمِعْتُ أَنَّ الطَّالِبَ نَجَحَ.", "I heard that the student succeeded."]
    ]
  },
  {
    bookSlug: "book-3",
    match: /Zarf|Lam Al-Amr|Conditional|Idha|Jazim/,
    examples: [
      ["لِيَكْتُبْ كُلُّ طَالِبٍ اسْمَهُ.", "Let every student write his name."],
      ["إِنْ تَجْتَهِدْ تَنْجَحْ.", "If you work hard, you will succeed."]
    ]
  },
  {
    bookSlug: "book-3",
    match: /Bab|Thulathi|Ruba'i|Transitive|Intransitive/,
    examples: [
      ["أَنْزَلَ الْوَلَدُ الْكِتَابَ.", "The boy brought the book down."],
      ["تَعَلَّمَ الطَّالِبُ النَّحْوَ.", "The student learned grammar."]
    ]
  },
  {
    bookSlug: "book-3",
    match: /Separate and Attached Pronouns|Damir/,
    examples: [
      ["إِيَّاكَ أَسْأَلُ.", "You alone I ask."],
      ["قَابَلْتُهُ فِي الْمَكْتَبَةِ.", "I met him in the library."]
    ]
  },
  {
    bookSlug: "book-3",
    match: /Maf'ul|Tamyiz/,
    examples: [
      ["حَضَرْتُ رَغْبَةً فِي الْعِلْمِ.", "I attended out of desire for knowledge."],
      ["اِشْتَرَيْتُ لِتْرًا حَلِيبًا.", "I bought a litre of milk."]
    ]
  },
  {
    bookSlug: "book-3",
    match: /Hal|Istithna'|Nun of Emphasis/,
    examples: [
      ["نَجَحَ الطُّلَّابُ إِلَّا حَامِدًا.", "The students succeeded except Hamid."],
      ["لَا تَخْرُجَنَّ قَبْلَ السَّاعَةِ.", "Do not leave before the hour."]
    ]
  },
  {
    bookSlug: "book-3",
    match: /Diptotes/,
    examples: [
      ["أَحْمَدُ مِنْ بَغْدَادَ.", "Ahmad is from Baghdad."],
      ["مَرَرْتُ بِأَحْمَدَ.", "I passed by Ahmad."]
    ]
  }
];

const fallbackExamples = {
  "book-1": [
    ["هٰذَا كِتَابٌ.", "This is a book."],
    ["الْكِتَابُ عَلَى الْمَكْتَبِ.", "The book is on the desk."],
    ["أَيْنَ كِتَابُ الْمُدَرِّسِ؟", "Where is the teacher's book?"]
  ],
  "book-2": [
    ["فَتَحَ الْوَلَدُ الْبَابَ.", "The boy opened the door."],
    ["يَكْتُبُ الطَّالِبُ الدَّرْسَ.", "The student writes the lesson."],
    ["أُرِيدُ أَنْ أَدْرُسَ الْعَرَبِيَّةَ.", "I want to study Arabic."]
  ],
  "book-3": [
    ["كُتِبَ الدَّرْسُ عَلَى السَّبُّورَةِ.", "The lesson was written on the board."],
    ["أَنْ تَدْرُسَ الْعَرَبِيَّةَ نَافِعٌ لَكَ.", "That you study Arabic is beneficial for you."],
    ["رَجَعَ الطُّلَّابُ فَرِحِينَ.", "The students returned happy."]
  ]
};

function lessonExamples(lesson) {
  const key = `${lesson.title} ${lesson.focus}`;
  const catalogEntry = lessonExampleCatalog.find((entry) => entry.bookSlug === lesson.bookSlug && entry.match.test(key));
  const practiceExamples = normalizeExamples(catalogEntry?.examples || [], "Practice model");
  const fallbackPractice = normalizeExamples(fallbackExamples[lesson.bookSlug] || fallbackExamples["book-1"], "Practice model");
  const coreExample = normalizeExample({
    arabic: lesson.arabic,
    translation: lesson.translation,
    source: "Book model"
  });
  const basePractice = uniqueExamples(practiceExamples).filter((example) => example.arabic !== coreExample.arabic);
  const completePractice = basePractice.length >= 2
    ? basePractice
    : uniqueExamples([...basePractice, ...fallbackPractice]).filter((example) => example.arabic !== coreExample.arabic);

  return selectLessonExamples(coreExample, completePractice)
    .sort((a, b) => exampleComplexity(a.arabic) - exampleComplexity(b.arabic))
    .slice(0, 3)
    .map((example, index) => ({
      label: String.fromCharCode(65 + index),
      title: ["Foundation", "Build", "Challenge"][index],
      difficulty: index + 1,
      ...example
    }));
}

function normalizeExamples(examples, source) {
  return examples
    .map(([arabic, translation]) => normalizeExample({ arabic, translation, source }))
    .filter(Boolean);
}

function normalizeExample(example) {
  const arabic = normalizeArabicMarks(String(example.arabic || "").trim());
  const translation = String(example.translation || "").trim();
  if (!arabic || !translation) return null;
  return { arabic, translation, source: example.source };
}

function selectLessonExamples(coreExample, practiceExamples) {
  const practicePool = uniqueExamples(practiceExamples)
    .sort((a, b) => exampleComplexity(a.arabic) - exampleComplexity(b.arabic));
  const coreScore = exampleComplexity(coreExample.arabic);
  const below = practicePool.filter((example) => exampleComplexity(example.arabic) <= coreScore);
  const above = practicePool.filter((example) => exampleComplexity(example.arabic) > coreScore);
  const selected = [];

  if (below.length) selected.push(below[below.length - 1]);
  selected.push(coreExample);
  if (above.length) selected.push(above[0]);

  for (const example of practicePool.sort((a, b) => Math.abs(exampleComplexity(a.arabic) - coreScore) - Math.abs(exampleComplexity(b.arabic) - coreScore))) {
    if (selected.length >= 3) break;
    if (selected.some((item) => item.arabic === example.arabic)) continue;
    selected.push(example);
  }

  return uniqueExamples(selected);
}

function uniqueExamples(examples) {
  const uniqueItems = [];
  for (const example of examples) {
    if (!example) continue;
    if (uniqueItems.some((item) => item.arabic === example.arabic)) continue;
    uniqueItems.push(example);
  }
  return uniqueItems;
}

function exampleComplexity(arabic) {
  const words = String(arabic).split(/\s+/).filter(Boolean).length;
  const clauses = (String(arabic).match(/[،؟.]/g) || []).length;
  const characters = [...String(arabic)].filter((char) => /[\u0600-\u06FF]/.test(char)).length;
  return words * 10 + clauses * 4 + characters / 100;
}

const book1Sections = extractSections(book1OcrPath);
const book2Sections = extractSections(book2OcrPath);
const book3Sections = extractSections(book3OcrPath);

const lessonDrafts = [
  {
    n: "1",
    title: "Questions, Demonstratives and Tanwin",
    focus: "مَا, مَنْ, هٰذَا, yes/no questions, and the indefinite ending.",
    arabic: "مَا هٰذَا؟ هٰذَا كِتَابٌ.",
    translation: "What is this? This is a book.",
    notes: [
      "Arabic has no separate word for “is” in simple nominal sentences.",
      "Tanwin gives many beginner nouns an indefinite sense, like “a” or “an”.",
      "The question hamzah أَ turns a statement into a yes-or-no question."
    ],
    quiz: {
      prompt: "What does مَا هٰذَا؟ ask?",
      arabic: "مَا هٰذَا؟",
      answer: "What is this?",
      options: ["What is this?", "Who is this?", "Where is this?"]
    }
  },
  {
    n: "2",
    title: "ذٰلِكَ and وَ",
    focus: "Using the distant demonstrative and joining clauses with وَ.",
    arabic: "هٰذَا بَيْتٌ، وَذٰلِكَ مَسْجِدٌ.",
    translation: "This is a house, and that is a mosque.",
    notes: ["ذٰلِكَ means “that”.", "وَ means “and” and is written attached to the following word."],
    quiz: {
      prompt: "Choose the meaning of ذٰلِكَ.",
      arabic: "ذٰلِكَ",
      answer: "that",
      options: ["this", "that", "who"]
    }
  },
  {
    n: "3",
    title: "Definite Article and Solar Letters",
    focus: "Using الْـ, recognizing solar and lunar letters, and reading definite nouns.",
    arabic: "الْبَابُ مَفْتُوحٌ.",
    translation: "The door is open.",
    notes: [
      "The definite article الْـ is like “the”.",
      "With solar letters the ل sound is assimilated in pronunciation.",
      "The first vowel of الْـ is pronounced only when not preceded by another word."
    ],
    quiz: {
      prompt: "What does الْـ usually mean?",
      arabic: "الْبَيْتُ",
      answer: "the",
      options: ["a", "the", "and"]
    }
  },
  {
    n: "4",
    title: "Prepositions, Pronouns and Direction Words",
    focus: "فِي, عَلَى, مِنْ, إِلَى, genitive endings, هُوَ, هِيَ, أَنَا, أَنْتَ, and ذَهَبَ.",
    arabic: "ذَهَبَ بِلَالٌ إِلَى الْمَسْجِدِ.",
    translation: "Bilal went to the mosque.",
    notes: [
      "After a preposition, many nouns change from -u to -i.",
      "هُوَ is used for masculine nouns. هِيَ is used for feminine nouns.",
      "مِنْ means “from” and إِلَى means “to”.",
      "أَنَا is used for “I” for both masculine and feminine speakers.",
      "ذَهَبَ means “he went”; when the subject is named, the English “he” is dropped."
    ],
    quiz: {
      prompt: "Choose the meaning of إِلَى.",
      arabic: "إِلَى",
      answer: "to",
      options: ["from", "to", "under"]
    }
  },
  {
    n: "5",
    title: "Possessive Phrases",
    focus: "The iḍāfah construction, mudaf and mudaf ilayhi.",
    arabic: "هٰذَا كِتَابُ بِلَالٍ.",
    translation: "This is Bilal’s book.",
    notes: [
      "The first word in an iḍāfah is the thing possessed.",
      "The second word is the possessor and takes the genitive case.",
      "The mudaf does not take الْـ or tanwin."
    ],
    quiz: {
      prompt: "In كِتَابُ بِلَالٍ, who is the possessor?",
      arabic: "كِتَابُ بِلَالٍ",
      answer: "Bilal",
      options: ["the book", "Bilal", "the teacher"]
    }
  },
  {
    n: "6",
    title: "Feminine Nouns and هٰذِهِ",
    focus: "Feminine demonstratives, feminine endings, and لِ for possession.",
    arabic: "هٰذِهِ بِنْتٌ.",
    translation: "This is a girl.",
    notes: [
      "هٰذِهِ is the feminine form of هٰذَا.",
      "Many feminine nouns end in ة.",
      "لِ can mean “belongs to” or “for”."
    ],
    quiz: {
      prompt: "Choose the feminine demonstrative.",
      arabic: "هٰذِهِ",
      answer: "هٰذِهِ",
      options: ["هٰذَا", "هٰذِهِ", "ذٰلِكَ"]
    }
  },
  {
    n: "7",
    title: "تِلْكَ",
    focus: "The distant feminine demonstrative.",
    arabic: "هٰذِهِ آمِنَةُ، وَتِلْكَ مَرْيَمُ.",
    translation: "This is Aminah, and that is Maryam.",
    notes: ["تِلْكَ is the feminine form of ذٰلِكَ.", "It is used for a distant feminine noun or name."],
    quiz: {
      prompt: "What is the feminine form of ذٰلِكَ?",
      arabic: "تِلْكَ",
      answer: "تِلْكَ",
      options: ["تِلْكَ", "هُوَ", "أَنَا"]
    }
  },
  {
    n: "8",
    title: "Demonstrative plus Definite Noun",
    focus: "Using هٰذَا الْكِتَابُ, nouns ending in long alif, and position words.",
    arabic: "هٰذَا الْكِتَابُ جَدِيدٌ.",
    translation: "This book is new.",
    notes: [
      "هٰذَا كِتَابٌ is a sentence; هٰذَا الْكِتَابُ is a phrase until a predicate is added.",
      "Nouns ending in long alif do not show normal case endings.",
      "خَلْفَ and أَمَامَ are used as mudaf-like position words."
    ],
    quiz: {
      prompt: "Which phrase means “this book”?",
      arabic: "هٰذَا الْكِتَابُ",
      answer: "هٰذَا الْكِتَابُ",
      options: ["هٰذَا كِتَابٌ", "هٰذَا الْكِتَابُ", "مَنْ هٰذَا؟"]
    }
  },
  {
    n: "9",
    title: "Adjectives and Relative Pronouns",
    focus: "Adjective agreement, adjectives ending in ـان, الَّذِي and عِنْدَ.",
    arabic: "بَيْتٌ جَدِيدٌ.",
    translation: "A new house.",
    notes: [
      "The adjective follows the noun it describes.",
      "The adjective agrees with the noun in gender, definiteness, and case.",
      "الَّذِي can mean “who” for people and “which” for things."
    ],
    quiz: {
      prompt: "Where does the adjective usually appear in Arabic?",
      arabic: "بَيْتٌ جَدِيدٌ",
      answer: "after the noun",
      options: ["before the noun", "after the noun", "only at the start"]
    }
  },
  {
    n: "10",
    title: "Possessive Suffixes",
    focus: "كَ, هُ, هَا, ي, أَبٌ, أَخٌ, and possession with لِ.",
    arabic: "هٰذَا كِتَابُكَ.",
    translation: "This is your book.",
    notes: [
      "Possessive pronouns attach to nouns as suffixes.",
      "أَبٌ and أَخٌ take an extra و in many iḍāfah forms.",
      "مَا can also be used as a negative particle."
    ],
    quiz: {
      prompt: "Which suffix means “his”?",
      arabic: "كِتَابُهُ",
      answer: "هُ",
      options: ["كَ", "هُ", "هَا"]
    }
  },
  {
    n: "11",
    title: "فِيهِ, فِيهَا and أُحِبُّ",
    focus: "In it, I love, object endings, and تُحِبُّ.",
    arabic: "أُحِبُّ اللُّغَةَ الْعَرَبِيَّةَ.",
    translation: "I love the Arabic language.",
    notes: [
      "فِيهِ means “in it” for masculine nouns; فِيهَا is the feminine form.",
      "أُحِبُّ means “I love” or “I like”.",
      "The object of a verb takes the accusative case."
    ],
    quiz: {
      prompt: "What does أُحِبُّ mean?",
      arabic: "أُحِبُّ",
      answer: "I love",
      options: ["I love", "I went", "I have"]
    }
  },
  {
    n: "12",
    title: "أَنْتِ, كِ and الَّتِي",
    focus: "Feminine “you”, feminine possessive suffix, and feminine relative pronoun.",
    arabic: "أَيْنَ بَيْتُكِ يَا مَرْيَمُ؟",
    translation: "Where is your house, Maryam?",
    notes: [
      "أَنْتِ means “you” for feminine singular.",
      "The feminine possessive suffix is كِ.",
      "الَّتِي is the feminine form of الَّذِي."
    ],
    quiz: {
      prompt: "Choose the feminine singular “you”.",
      arabic: "أَنْتِ",
      answer: "أَنْتِ",
      options: ["أَنْتَ", "أَنْتِ", "أَنْتُمْ"]
    }
  },
  {
    n: "13",
    title: "Plural Forms",
    focus: "Sound plurals, broken plurals, هٰؤُلَاءِ, هُمْ, هُنَّ and أُولٰئِكَ.",
    arabic: "هٰؤُلَاءِ طُلَّابٌ.",
    translation: "These are students.",
    notes: [
      "Arabic has sound plurals and broken plurals.",
      "هٰؤُلَاءِ is used for “these”, especially for people.",
      "هُمْ is masculine plural and هُنَّ is feminine plural."
    ],
    quiz: {
      prompt: "Which word means “these”?",
      arabic: "هٰؤُلَاءِ",
      answer: "هٰؤُلَاءِ",
      options: ["هٰؤُلَاءِ", "هِيَ", "مِنْ"]
    }
  },
  {
    n: "14",
    title: "أَنْتُمْ, نَحْنُ and أَيُّ",
    focus: "Masculine plural “you”, we, our, and “which”.",
    arabic: "نَحْنُ مُسْلِمُونَ.",
    translation: "We are Muslims.",
    notes: [
      "أَنْتُمْ is masculine plural “you”.",
      "نَحْنُ means “we” for masculine and feminine groups.",
      "أَيُّ means “which” and behaves like a mudaf."
    ],
    quiz: {
      prompt: "What does نَحْنُ mean?",
      arabic: "نَحْنُ",
      answer: "we",
      options: ["I", "we", "you"]
    }
  },
  {
    n: "15",
    title: "أَنْتُنَّ and Time Words",
    focus: "Feminine plural “you”, كُنَّ, ذَهَبْتُنَّ, قَبْلَ and بَعْدَ.",
    arabic: "أَيْنَ ذَهَبْتُنَّ يَا أَخَوَاتُ؟",
    translation: "Where did you go, sisters?",
    notes: [
      "أَنْتُنَّ is feminine plural “you”.",
      "The possessive suffix for feminine plural “your” is كُنَّ.",
      "قَبْلَ and بَعْدَ are followed by the genitive."
    ],
    quiz: {
      prompt: "Choose the feminine plural “you”.",
      arabic: "أَنْتُنَّ",
      answer: "أَنْتُنَّ",
      options: ["أَنْتَ", "أَنْتُمْ", "أَنْتُنَّ"]
    }
  },
  {
    n: "16",
    title: "Rational and Irrational Plurals",
    focus: "Human plurals vs non-human plurals and feminine singular agreement.",
    arabic: "هٰذِهِ كُتُبٌ جَدِيدَةٌ.",
    translation: "These are new books.",
    notes: [
      "Rational plurals usually refer to human beings.",
      "Irrational plurals are often treated as feminine singular.",
      "More broken plural patterns appear in this lesson."
    ],
    quiz: {
      prompt: "How are many non-human plurals treated?",
      arabic: "هٰذِهِ كُتُبٌ",
      answer: "as feminine singular",
      options: ["as feminine singular", "as dual", "as first person"]
    }
  },
  {
    n: "17",
    title: "Plural Review",
    focus: "Continuation of rational and irrational plural agreement.",
    arabic: "حِمَارٌ، حُمُرٌ، حَمِيرٌ.",
    translation: "A donkey, donkeys, donkeys.",
    notes: ["This lesson continues Lesson 16.", "Some nouns have more than one plural form."],
    quiz: {
      prompt: "Which are plural forms of حِمَارٌ?",
      arabic: "حُمُرٌ، حَمِيرٌ",
      answer: "حُمُرٌ and حَمِيرٌ",
      options: ["حُمُرٌ and حَمِيرٌ", "هُوَ and هِيَ", "مِنْ and إِلَى"]
    }
  },
  {
    n: "18",
    title: "The Dual",
    focus: "Two of something, هٰذَانِ, هَاتَانِ, هُمَا, and كَمْ.",
    arabic: "هٰذَانِ كِتَابَانِ.",
    translation: "These are two books.",
    notes: [
      "Arabic has singular, dual, and plural.",
      "The dual commonly ends in ـانِ.",
      "كَمْ is followed by a singular accusative noun."
    ],
    quiz: {
      prompt: "What number does the dual represent?",
      arabic: "كِتَابَانِ",
      answer: "two",
      options: ["one", "two", "more than two"]
    }
  },
  {
    n: "19",
    title: "Numbers 3-10 with Masculine Nouns",
    focus: "Counting masculine maʿdūd nouns from three to ten.",
    arabic: "ثَلَاثَةُ كُتُبٍ.",
    translation: "Three books.",
    notes: [
      "Numbers from three to ten are used as mudaf.",
      "The counted noun is plural and genitive.",
      "The number word can take case according to its sentence role."
    ],
    quiz: {
      prompt: "In ثَلَاثَةُ كُتُبٍ, what case is كُتُبٍ?",
      arabic: "ثَلَاثَةُ كُتُبٍ",
      answer: "genitive",
      options: ["nominative", "genitive", "imperative"]
    }
  },
  {
    n: "20",
    title: "Numbers 3-10 with Feminine Nouns",
    focus: "Counting feminine maʿdūd nouns and feminine one/two.",
    arabic: "ثَلَاثُ بَنَاتٍ.",
    translation: "Three girls.",
    notes: [
      "With feminine counted nouns, the tāʾ marbūṭah is omitted from numbers three to ten.",
      "The feminine of وَاحِدٌ is وَاحِدَةٌ.",
      "The feminine of اِثْنَانِ is اِثْنَتَانِ."
    ],
    quiz: {
      prompt: "Choose “three girls”.",
      arabic: "ثَلَاثُ بَنَاتٍ",
      answer: "ثَلَاثُ بَنَاتٍ",
      options: ["ثَلَاثُ بَنَاتٍ", "ثَلَاثَةُ بَنَاتٍ", "هٰذَا بَيْتٌ"]
    }
  },
  {
    n: "21",
    title: "Review and Test Lesson",
    focus: "Review with ذَاكَ, colors, نُحِبُّ and country names.",
    arabic: "نُحِبُّ اللُّغَةَ الْعَرَبِيَّةَ.",
    translation: "We love the Arabic language.",
    notes: ["This lesson is a test lesson with no major new construction.", "It introduces a small set of new review words."],
    quiz: {
      prompt: "What does نُحِبُّ mean?",
      arabic: "نُحِبُّ",
      answer: "we love",
      options: ["we love", "they went", "which"]
    }
  },
  {
    n: "22",
    title: "Diptotes",
    focus: "Nouns and adjectives that do not take tanwin.",
    arabic: "أَحْمَدُ مِنْ بَغْدَادَ.",
    translation: "Ahmad is from Baghdad.",
    notes: [
      "Diptotes do not take tanwin.",
      "Several proper nouns, color adjectives, and broken plural patterns are diptotes.",
      "A diptote has one dammah in the nominative."
    ],
    quiz: {
      prompt: "What is special about a diptote?",
      arabic: "أَحْمَدُ",
      answer: "it does not take tanwin",
      options: ["it does not take tanwin", "it is always dual", "it is always feminine"]
    }
  },
  {
    n: "23",
    title: "Diptotes in the Genitive",
    focus: "Diptotes take fatḥah instead of kasrah in genitive positions.",
    arabic: "كِتَابُ أَحْمَدَ.",
    translation: "Ahmad’s book.",
    notes: [
      "Ordinary genitive nouns often take kasrah.",
      "A diptote takes fatḥah in genitive positions unless another rule changes it.",
      "The lesson reviews diptotes with numbers and iḍāfah."
    ],
    quiz: {
      prompt: "What ending does a diptote often take in the genitive?",
      arabic: "مِنْ أَحْمَدَ",
      answer: "fatḥah",
      options: ["fatḥah", "tanwin", "dual ending"]
    }
  }
];

const vocabularyDrafts = [
  ["v-hadha", "هٰذَا", "hadha", "this", "1"],
  ["v-ma", "مَا", "ma", "what", "1"],
  ["v-man", "مَنْ", "man", "who", "1"],
  ["v-a-question", "أَ", "a", "question particle", "1"],
  ["v-naam", "نَعَمْ", "naam", "yes", "1"],
  ["v-la", "لَا", "la", "no", "1"],
  ["v-kitabun", "كِتَابٌ", "kitabun", "book", "1"],
  ["v-baytun", "بَيْتٌ", "baytun", "house", "1"],
  ["v-masjidun", "مَسْجِدٌ", "masjidun", "mosque", "1"],
  ["v-babun", "بَابٌ", "babun", "door", "1"],
  ["v-qalamun", "قَلَمٌ", "qalamun", "pen", "1"],
  ["v-miftahun", "مِفْتَاحٌ", "miftahun", "key", "1"],
  ["v-najmun", "نَجْمٌ", "najmun", "star", "1"],
  ["v-waladun", "وَلَدٌ", "waladun", "boy", "1"],
  ["v-rajulun", "رَجُلٌ", "rajulun", "man", "1"],
  ["v-tajirun", "تَاجِرٌ", "tajirun", "merchant", "1"],
  ["v-kalbun", "كَلْبٌ", "kalbun", "dog", "1"],
  ["v-qittun", "قِطٌّ", "qittun", "cat", "1"],
  ["v-himarun", "حِمَارٌ", "himarun", "donkey", "1"],
  ["v-hisanun", "حِصَانٌ", "hisanun", "horse", "1"],
  ["v-jamalun", "جَمَلٌ", "jamalun", "camel", "1"],
  ["v-dikun", "دِيكٌ", "dikun", "rooster", "1"],
  ["v-kursiyyun", "كُرْسِيٌّ", "kursiyyun", "chair", "1"],
  ["v-dhalika", "ذٰلِكَ", "dhalika", "that", "2"],
  ["v-wa", "وَ", "wa", "and", "2"],
  ["v-hajarun", "حَجَرٌ", "hajarun", "stone", "2"],
  ["v-sukkarun", "سُكَّرٌ", "sukkarun", "sugar", "2"],
  ["v-labanun", "لَبَنٌ", "labanun", "milk", "2"],
  ["v-al-baytu", "الْبَيْتُ", "al-baytu", "the house", "3"],
  ["v-al-babu", "الْبَابُ", "al-babu", "the door", "3"],
  ["v-al-qalamu", "الْقَلَمُ", "al-qalamu", "the pen", "3"],
  ["v-maftuhun", "مَفْتُوحٌ", "maftuhun", "open", "3"],
  ["v-maksurun", "مَكْسُورٌ", "maksurun", "broken", "3"],
  ["v-ghaniyyun", "غَنِيٌّ", "ghaniyyun", "rich", "3"],
  ["v-faqirun", "فَقِيرٌ", "faqirun", "poor", "3"],
  ["v-tawilun", "طَوِيلٌ", "tawilun", "tall", "3"],
  ["v-qasirun", "قَصِيرٌ", "qasirun", "short", "3"],
  ["v-baridun", "بَارِدٌ", "baridun", "cold", "3"],
  ["v-harrun", "حَارٌّ", "harrun", "hot", "3"],
  ["v-jalisun", "جَالِسٌ", "jalisun", "sitting", "3"],
  ["v-qaimun", "قَائِمٌ", "qaimun", "standing", "3"],
  ["v-qadimun", "قَدِيمٌ", "qadimun", "old", "3"],
  ["v-baidun", "بَعِيدٌ", "baidun", "far", "3"],
  ["v-wasikhun", "وَسِخٌ", "wasikhun", "dirty", "3"],
  ["v-kabirun", "كَبِيرٌ", "kabirun", "big", "3"],
  ["v-thaqilun", "ثَقِيلٌ", "thaqilun", "heavy", "3"],
  ["v-maun", "مَاءٌ", "maun", "water", "3"],
  ["v-jamilun", "جَمِيلٌ", "jamilun", "beautiful", "3"],
  ["v-hulwun", "حُلْوٌ", "hulwun", "sweet", "3"],
  ["v-maridun", "مَرِيضٌ", "maridun", "sick", "3"],
  ["v-ayna", "أَيْنَ", "ayna", "where", "4"],
  ["v-fi", "فِي", "fi", "in", "4"],
  ["v-ala", "عَلَى", "ala", "on", "4"],
  ["v-huwa", "هُوَ", "huwa", "he / it", "4"],
  ["v-hiya", "هِيَ", "hiya", "she / it", "4"],
  ["v-ghurfatun", "غُرْفَةٌ", "ghurfatun", "room", "4"],
  ["v-hammamun", "حَمَّامٌ", "hammamun", "bathroom", "4"],
  ["v-matbakhun", "مَطْبَخٌ", "matbakhun", "kitchen", "4"],
  ["v-sama", "السَّمَاءُ", "as-sama", "the sky", "4"],
  ["v-faslun", "فَصْلٌ", "faslun", "classroom", "4"],
  ["v-sarirun", "سَرِيرٌ", "sarirun", "bed", "4"],
  ["v-ana", "أَنَا", "ana", "I", "4"],
  ["v-anta", "أَنْتَ", "anta", "you", "4"],
  ["v-min", "مِنْ", "min", "from", "4"],
  ["v-ila", "إِلَى", "ila", "to", "4"],
  ["v-dhahaba", "ذَهَبَ", "dhahaba", "he went", "4"],
  ["v-al-yaban", "الْيَابَانُ", "al-yaban", "Japan", "4"],
  ["v-al-hind", "الْهِنْدُ", "al-hind", "India", "4"],
  ["v-kitab-u", "كِتَابُ", "kitabu", "book of", "5"],
  ["v-imamun", "إِمَامٌ", "imamun", "imam", "5"],
  ["v-mudarrisun", "مُدَرِّسٌ", "mudarrisun", "teacher", "5"],
  ["v-tahta", "تَحْتَ", "tahta", "under", "5"],
  ["v-ya", "يَا", "ya", "vocative particle", "5"],
  ["v-ismun", "اِسْمٌ", "ismun", "name", "5"],
  ["v-ibnun", "اِبْنٌ", "ibnun", "son", "5"],
  ["v-ibnatun", "اِبْنَةٌ", "ibnatun", "daughter", "5"],
  ["v-shariun", "شَارِعٌ", "shariun", "street", "5"],
  ["v-sayyaratun", "سَيَّارَةٌ", "sayyaratun", "car", "5"],
  ["v-haqibatun", "حَقِيبَةٌ", "haqibatun", "bag", "5"],
  ["v-tabibun", "طَبِيبٌ", "tabibun", "doctor", "5"],
  ["v-amm-un", "عَمٌّ", "ammun", "paternal uncle", "5"],
  ["v-khalun", "خَالٌ", "khalun", "maternal uncle", "5"],
  ["v-hadhihi", "هٰذِهِ", "hadhihi", "this", "6"],
  ["v-bintun", "بِنْتٌ", "bintun", "girl / daughter", "6"],
  ["v-mudarrisatun", "مُدَرِّسَةٌ", "mudarrisatun", "female teacher", "6"],
  ["v-akhun", "أَخٌ", "akhun", "brother", "6"],
  ["v-ukhtun", "أُخْتٌ", "ukhtun", "sister", "6"],
  ["v-yadun", "يَدٌ", "yadun", "hand", "6"],
  ["v-rijlun", "رِجْلٌ", "rijlun", "leg", "6"],
  ["v-rasun", "رَأْسٌ", "rasun", "head", "6"],
  ["v-anfun", "أَنْفٌ", "anfun", "nose", "6"],
  ["v-aynun", "عَيْنٌ", "aynun", "eye", "6"],
  ["v-udhun", "أُذُنٌ", "udhun", "ear", "6"],
  ["v-wajhun", "وَجْهٌ", "wajhun", "face", "6"],
  ["v-li", "لِ", "li", "for / belongs to", "6"],
  ["v-liman", "لِمَنْ", "liman", "whose", "6"],
  ["v-aydan", "أَيْضًا", "aydan", "also", "6"],
  ["v-jiddan", "جِدًّا", "jiddan", "very", "6"],
  ["v-hadidun", "حَدِيدٌ", "hadidun", "iron", "6"],
  ["v-baqaratun", "بَقَرَةٌ", "baqaratun", "cow", "6"],
  ["v-nafidhatun", "نَافِذَةٌ", "nafidhatun", "window", "6"],
  ["v-sariun", "سَرِيعٌ", "sariun", "fast", "6"],
  ["v-tilka", "تِلْكَ", "tilka", "that", "7"],
  ["v-naqatun", "نَاقَةٌ", "naqatun", "she-camel", "7"],
  ["v-battatun", "بَطَّةٌ", "battatun", "duck", "7"],
  ["v-baydatun", "بَيْضَةٌ", "baydatun", "egg", "7"],
  ["v-muadhdhinun", "مُؤَذِّنٌ", "muadhdhinun", "muadhdhin", "7"],
  ["v-dajajah", "دَجَاجَةٌ", "dajajatun", "hen", "7"],
  ["v-khalfa", "خَلْفَ", "khalfa", "behind", "8"],
  ["v-amama", "أَمَامَ", "amama", "in front of", "8"],
  ["v-jalasa", "جَلَسَ", "jalasa", "he sat", "8"],
  ["v-amrika", "أَمْرِيكَا", "amrika", "America", "8"],
  ["v-al-iraq", "الْعِرَاقُ", "al-iraq", "Iraq", "8"],
  ["v-suwaysra", "سُوَيْسْرَا", "suwaysra", "Switzerland", "8"],
  ["v-almania", "أَلْمَانِيَا", "almania", "Germany", "8"],
  ["v-inkiltira", "إِنْكِلْتَرَا", "inkiltira", "England", "8"],
  ["v-mustashfa", "مُسْتَشْفًى", "mustashfa", "hospital", "8"],
  ["v-sikkinun", "سِكِّينٌ", "sikkinun", "knife", "8"],
  ["v-mughlaqun", "مُغْلَقٌ", "mughlaqun", "closed", "8"],
  ["v-saghirun", "صَغِيرٌ", "saghirun", "small", "9"],
  ["v-kaslan", "كَسْلَانُ", "kaslan", "lazy", "9"],
  ["v-jawan", "جَوْعَانُ", "jawan", "hungry", "9"],
  ["v-atshan", "عَطْشَانُ", "atshan", "thirsty", "9"],
  ["v-ghadban", "غَضْبَانُ", "ghadban", "angry", "9"],
  ["v-malan", "مَلآنُ", "malan", "full", "9"],
  ["v-fakihatun", "فَاكِهَةٌ", "fakihatun", "fruit", "9"],
  ["v-usfurun", "عُصْفُورٌ", "usfurun", "bird", "9"],
  ["v-tairun", "طَائِرٌ", "tairun", "bird", "9"],
  ["v-lughatun", "لُغَةٌ", "lughatun", "language", "9"],
  ["v-sahlun", "سَهْلٌ", "sahlun", "easy", "9"],
  ["v-sabun", "صَعْبٌ", "sabun", "difficult", "9"],
  ["v-shahirun", "شَهِيرٌ", "shahirun", "famous", "9"],
  ["v-limadha", "لِمَاذَا", "limadha", "why", "9"],
  ["v-kubun", "كُوبٌ", "kubun", "cup", "9"],
  ["v-alladhi", "الَّذِي", "alladhi", "who / which", "9"],
  ["v-inda", "عِنْدَ", "inda", "with / at", "9"],
  ["v-maktabatun", "مَكْتَبَةٌ", "maktabatun", "library", "9"],
  ["v-al-ana", "الآنَ", "al-ana", "now", "9"],
  ["v-mustawsafun", "مُسْتَوْصَفٌ", "mustawsafun", "clinic", "9"],
  ["v-mirwahatun", "مِرْوَحَةٌ", "mirwahatun", "fan", "9"],
  ["v-al-kuwait", "الْكُوَيْتُ", "al-kuwayt", "Kuwait", "9"],
  ["v-suq", "سُوقٌ", "suqun", "market", "9"],
  ["v-ka", "كَ", "ka", "your", "10"],
  ["v-hu", "هُ", "hu", "his", "10"],
  ["v-ha", "هَا", "ha", "her", "10"],
  ["v-ya-suffix", "ي", "i", "my", "10"],
  ["v-abun", "أَبٌ", "abun", "father", "10"],
  ["v-abu", "أَبُو", "abu", "father of", "10"],
  ["v-akhu", "أَخُو", "akhu", "brother of", "10"],
  ["v-laka", "لَكَ", "laka", "belongs to you", "10"],
  ["v-lahu", "لَهُ", "lahu", "belongs to him", "10"],
  ["v-laha", "لَهَا", "laha", "belongs to her", "10"],
  ["v-lii", "لِي", "li", "belongs to me", "10"],
  ["v-indi", "عِنْدِي", "indi", "I have", "10"],
  ["v-maa", "مَعَ", "maa", "with", "10"],
  ["v-dhahabta", "ذَهَبْتَ", "dhahabta", "you went", "10"],
  ["v-dhahabtu", "ذَهَبْتُ", "dhahabtu", "I went", "10"],
  ["v-al-yawma", "الْيَوْمَ", "al-yawma", "today", "10"],
  ["v-zawjun", "زَوْجٌ", "zawjun", "husband", "10"],
  ["v-tiflun", "طِفْلٌ", "tiflun", "child", "10"],
  ["v-wahidun", "وَاحِدٌ", "wahidun", "one", "10"],
  ["v-fihi", "فِيهِ", "fihi", "in it", "11"],
  ["v-fiha", "فِيهَا", "fiha", "in it", "11"],
  ["v-uhibbu", "أُحِبُّ", "uhibbu", "I love", "11"],
  ["v-tuhibbu", "تُحِبُّ", "tuhibbu", "you love", "11"],
  ["v-allah", "اللَّهُ", "allahu", "Allah", "11"],
  ["v-rasul", "الرَّسُولُ", "ar-rasulu", "the messenger", "11"],
  ["v-lugha-arabiyya", "اللُّغَةُ الْعَرَبِيَّةُ", "al-lughatu al-arabiyyah", "the Arabic language", "11"],
  ["v-madha", "مَاذَا", "madha", "what", "11"],
  ["v-anti", "أَنْتِ", "anti", "you", "12"],
  ["v-ki", "كِ", "ki", "your", "12"],
  ["v-dhahabat", "ذَهَبَتْ", "dhahabat", "she went", "12"],
  ["v-allati", "الَّتِي", "allati", "who / which", "12"],
  ["v-bada", "بَعْدَ", "bada", "after", "12"],
  ["v-shajaratun", "شَجَرَةٌ", "shajaratun", "tree", "12"],
  ["v-madrasatun", "مَدْرَسَةٌ", "madrasatun", "school", "12"],
  ["v-maryam", "مَرْيَمُ", "maryamu", "Maryam", "12"],
  ["v-mamlakatun", "مَمْلَكَةٌ", "mamlakatun", "kingdom", "12"],
  ["v-muslimun", "مُسْلِمٌ", "muslimun", "Muslim", "13"],
  ["v-muslimuna", "مُسْلِمُونَ", "muslimuna", "Muslims", "13"],
  ["v-muslimatun", "مُسْلِمَةٌ", "muslimatun", "Muslim woman", "13"],
  ["v-muslimatun-pl", "مُسْلِمَاتٌ", "muslimatun", "Muslim women", "13"],
  ["v-muhandisun", "مُهَنْدِسٌ", "muhandisun", "engineer", "13"],
  ["v-muhandisuna", "مُهَنْدِسُونَ", "muhandisuna", "engineers", "13"],
  ["v-haulai", "هٰؤُلَاءِ", "haulai", "these", "13"],
  ["v-hum", "هُمْ", "hum", "they / their", "13"],
  ["v-dhahabu", "ذَهَبُوا", "dhahabu", "they went", "13"],
  ["v-baduhum", "بَعْضُهُمْ", "baduhum", "some of them", "13"],
  ["v-nujumun", "نُجُومٌ", "nujumun", "stars", "13"],
  ["v-kutubun", "كُتُبٌ", "kutubun", "books", "13"],
  ["v-jibalun", "جِبَالٌ", "jibalun", "mountains", "13"],
  ["v-tujjarun", "تُجَّارٌ", "tujjarun", "merchants", "13"],
  ["v-aqlamun", "أَقْلَامٌ", "aqlamun", "pens", "13"],
  ["v-zumala", "زُمَلَاءُ", "zumalau", "classmates", "13"],
  ["v-asdiqa", "أَصْدِقَاءُ", "asdiqau", "friends", "13"],
  ["v-ikhwatun", "إِخْوَةٌ", "ikhwatun", "brothers", "13"],
  ["v-tullabun", "طُلَّابٌ", "tullabun", "students", "13"],
  ["v-duyufun", "ضُيُوفٌ", "duyufun", "guests", "13"],
  ["v-qaryatun", "قَرْيَةٌ", "qaryatun", "village", "13"],
  ["v-huqulun", "حُقُولٌ", "huqulun", "fields", "13"],
  ["v-mujtahidun", "مُجْتَهِدٌ", "mujtahidun", "hard-working", "13"],
  ["v-matamun", "مَطْعَمٌ", "matamun", "restaurant", "13"],
  ["v-shaykhun", "شَيْخٌ", "shaykhun", "old man / scholar", "13"],
  ["v-shuyukhun", "شُيُوخٌ", "shuyukhun", "old men / scholars", "13"],
  ["v-hunna", "هُنَّ", "hunna", "they", "13"],
  ["v-baytuhunna", "بَيْتُهُنَّ", "baytuhunna", "their house", "13"],
  ["v-dhahabna", "ذَهَبْنَ", "dhahabna", "they went", "13"],
  ["v-akhawatun", "أَخَوَاتٌ", "akhawatun", "sisters", "13"],
  ["v-banatun", "بَنَاتٌ", "banatun", "girls / daughters", "13"],
  ["v-fatayatun", "فَتَيَاتٌ", "fatayatun", "young women", "13"],
  ["v-imraatun", "امْرَأَةٌ", "imraatun", "woman", "13"],
  ["v-zawjatun", "زَوْجَةٌ", "zawjatun", "wife", "13"],
  ["v-ulaika", "أُولٰئِكَ", "ulaika", "those", "13"],
  ["v-antum", "أَنْتُمْ", "antum", "you", "14"],
  ["v-kum", "كُمْ", "kum", "your", "14"],
  ["v-nahnu", "نَحْنُ", "nahnu", "we", "14"],
  ["v-na", "نَا", "na", "our", "14"],
  ["v-dhahabtum", "ذَهَبْتُمْ", "dhahabtum", "you went", "14"],
  ["v-dhahabna2", "ذَهَبْنَا", "dhahabna", "we went", "14"],
  ["v-ayyu", "أَيُّ", "ayyu", "which", "14"],
  ["v-ayya", "أَيَّ", "ayya", "which", "14"],
  ["v-ahlan", "أَهْلًا وَسَهْلًا", "ahlan wa sahlan", "welcome", "14"],
  ["v-hafidun", "حَفِيدٌ", "hafidun", "grandson", "14"],
  ["v-hafadatun", "حَفَدَةٌ", "hafadatun", "grandsons", "14"],
  ["v-rabbun", "رَبٌّ", "rabbun", "lord", "14"],
  ["v-dinun", "دِينٌ", "dinun", "religion", "14"],
  ["v-shahrun", "شَهْرٌ", "shahrun", "month", "14"],
  ["v-nasara", "نَصَارَى", "nasara", "Christians", "14"],
  ["v-antunna", "أَنْتُنَّ", "antunna", "you", "15"],
  ["v-kunna", "كُنَّ", "kunna", "your", "15"],
  ["v-dhahabtunna", "ذَهَبْتُنَّ", "dhahabtunna", "you went", "15"],
  ["v-qabla", "قَبْلَ", "qabla", "before", "15"],
  ["v-rajaa", "رَجَعَ", "rajaa", "he returned", "15"],
  ["v-darsun", "دَرْسٌ", "darsun", "lesson", "15"],
  ["v-usbuun", "أُسْبُوعٌ", "usbuu", "week", "15"],
  ["v-qahirah", "الْقَاهِرَةُ", "al-qahirah", "Cairo", "15"],
  ["v-adhan", "أَذَانٌ", "adhanun", "adhan", "15"],
  ["v-aqilun", "عَاقِلٌ", "aqilun", "rational", "16"],
  ["v-ghayru-aqil", "غَيْرُ عَاقِلٍ", "ghayru aqil", "irrational", "16"],
  ["v-kilabun", "كِلَابٌ", "kilabun", "dogs", "16"],
  ["v-kharaju", "خَرَجُوا", "kharaju", "they went out", "16"],
  ["v-kharajat", "خَرَجَتْ", "kharajat", "it went out", "16"],
  ["v-masajidu", "مَسَاجِدُ", "masajidu", "mosques", "16"],
  ["v-dafatiru", "دَفَاتِرُ", "dafatiru", "notebooks", "16"],
  ["v-nahrun", "نَهْرٌ", "nahrun", "river", "16"],
  ["v-bahrun", "بَحْرٌ", "bahrun", "sea", "16"],
  ["v-humurun", "حُمُرٌ", "humurun", "donkeys", "17"],
  ["v-hamirun", "حَمِيرٌ", "hamirun", "donkeys", "17"],
  ["v-sharikatun", "شَرِكَةٌ", "sharikatun", "company", "17"],
  ["v-qamisun", "قَمِيصٌ", "qamisun", "shirt", "17"],
  ["v-qumsanun", "قُمْصَانٌ", "qumsanun", "shirts", "17"],
  ["v-baytani", "بَيْتَانِ", "baytani", "two houses", "18"],
  ["v-yadani", "يَدَانِ", "yadani", "two hands", "18"],
  ["v-hadhani", "هٰذَانِ", "hadhani", "these two", "18"],
  ["v-hatani", "هَاتَانِ", "hatani", "these two", "18"],
  ["v-huma", "هُمَا", "huma", "they two", "18"],
  ["v-kam", "كَمْ", "kam", "how many", "18"],
  ["v-kitaban", "كِتَابًا", "kitaban", "a book", "18"],
  ["v-idun", "عِيدٌ", "idun", "festival", "18"],
  ["v-sanatun", "سَنَةٌ", "sanatun", "year", "18"],
  ["v-hayyun", "حَيٌّ", "hayyun", "city district", "18"],
  ["v-rakatun", "رَكْعَةٌ", "rakatun", "rakah", "18"],
  ["v-rakaatun", "رَكَعَاتٌ", "rakaatun", "rakahs", "18"],
  ["v-sabburatun", "سَبُّورَةٌ", "sabburatun", "writing board", "18"],
  ["v-ithnani", "اِثْنَانِ", "ithnani", "two", "19"],
  ["v-thalathatu", "ثَلَاثَةُ", "thalathatu", "three", "19"],
  ["v-arbaatu", "أَرْبَعَةُ", "arbaatu", "four", "19"],
  ["v-khamsatu", "خَمْسَةُ", "khamsatu", "five", "19"],
  ["v-sittatu", "سِتَّةُ", "sittatu", "six", "19"],
  ["v-sabatu", "سَبْعَةُ", "sabatu", "seven", "19"],
  ["v-thamaniyatu", "ثَمَانِيَةُ", "thamaniyatu", "eight", "19"],
  ["v-tisatu", "تِسْعَةُ", "tisatu", "nine", "19"],
  ["v-asharatu", "عَشَرَةُ", "asharatu", "ten", "19"],
  ["v-kullu", "كُلُّ", "kullu", "all", "19"],
  ["v-kulluhum", "كُلُّهُمْ", "kulluhum", "all of them", "19"],
  ["v-kullukum", "كُلُّكُمْ", "kullukum", "all of you", "19"],
  ["v-kulluna", "كُلُّنَا", "kulluna", "all of us", "19"],
  ["v-biladun", "بِلَادٌ", "biladun", "countries", "19"],
  ["v-mukhtalifun", "مُخْتَلِفٌ", "mukhtalifun", "different", "19"],
  ["v-hafilatun", "حَافِلَةٌ", "hafilatun", "bus", "19"],
  ["v-minhum", "مِنْهُمْ", "minhum", "of them", "19"],
  ["v-urubba", "أُورُبَّا", "urubba", "Europe", "19"],
  ["v-nisfun", "نِصْفٌ", "nisfun", "half", "19"],
  ["v-qurushun", "قُرُوشٌ", "qurushun", "qirshes", "19"],
  ["v-rakibun", "رَاكِبٌ", "rakibun", "passenger", "19"],
  ["v-rukkabun", "رُكَّابٌ", "rukkabun", "passengers", "19"],
  ["v-sualun", "سُؤَالٌ", "sualun", "question", "19"],
  ["v-jaybun", "جَيْبٌ", "jaybun", "pocket", "19"],
  ["v-thalathu", "ثَلَاثُ", "thalathu", "three", "20"],
  ["v-arbau", "أَرْبَعُ", "arbau", "four", "20"],
  ["v-khamsu", "خَمْسُ", "khamsu", "five", "20"],
  ["v-sittu", "سِتُّ", "sittu", "six", "20"],
  ["v-sabu", "سَبْعُ", "sabu", "seven", "20"],
  ["v-thamani", "ثَمَانِي", "thamani", "eight", "20"],
  ["v-tisu", "تِسْعُ", "tisu", "nine", "20"],
  ["v-ashru", "عَشْرُ", "ashru", "ten", "20"],
  ["v-wahidatun", "وَاحِدَةٌ", "wahidatun", "one", "20"],
  ["v-ithnatani", "اِثْنَتَانِ", "ithnatani", "two", "20"],
  ["v-indunisiya", "إِنْدُونِيسِيَا", "indunisiya", "Indonesia", "20"],
  ["v-ghurafun", "غُرَفٌ", "ghurafun", "rooms", "20"],
  ["v-majallatun", "مَجَلَّةٌ", "majallatun", "magazine", "20"],
  ["v-harfun", "حَرْفٌ", "harfun", "letter", "20"],
  ["v-hurufun", "حُرُوفٌ", "hurufun", "letters", "20"],
  ["v-dhaka", "ذَاكَ", "dhaka", "that", "21"],
  ["v-alwanun", "أَلْوَانٌ", "alwanun", "colors", "21"],
  ["v-lawnun", "لَوْنٌ", "lawnun", "color", "21"],
  ["v-nuhibbu", "نُحِبُّ", "nuhibbu", "we love", "21"],
  ["v-wasiun", "وَاسِعٌ", "wasiun", "spacious", "21"],
  ["v-asiya", "آسِيَا", "asiya", "Asia", "21"],
  ["v-nuhibbuhu", "نُحِبُّهُ", "nuhibbuhu", "we love him", "21"],
  ["v-mamnu-min-sarf", "مَمْنُوعٌ مِنَ الصَّرْفِ", "mamnu min as-sarf", "diptote", "22"],
  ["v-ahmaru", "أَحْمَرُ", "ahmaru", "red", "22"],
  ["v-akhdaru", "أَخْضَرُ", "akhdaru", "green", "22"],
  ["v-aswadu", "أَسْوَدُ", "aswadu", "black", "22"],
  ["v-asfaru", "أَصْفَرُ", "asfaru", "yellow", "22"],
  ["v-abyadu", "أَبْيَضُ", "abyadu", "white", "22"],
  ["v-qala", "قَالَ", "qala", "he said", "22"],
  ["v-qalat", "قَالَتْ", "qalat", "she said", "22"],
  ["v-baghdad", "بَغْدَادُ", "baghdad", "Baghdad", "22"],
  ["v-jiddah", "جِدَّةُ", "jiddah", "Jeddah", "22"],
  ["v-finjanun", "فِنْجَانٌ", "finjanun", "cup", "22"],
  ["v-fanajinu", "فَنَاجِينُ", "fanajinu", "cups", "22"],
  ["v-daqiqatun", "دَقِيقَةٌ", "daqiqah", "minute", "22"],
  ["v-daqaiqu", "دَقَائِقُ", "daqaiqu", "minutes", "22"],
  ["v-manadilu", "مَنَادِيلُ", "manadilu", "handkerchiefs", "22"],
  ["v-mafatihu", "مَفَاتِيحُ", "mafatihu", "keys", "22"],
  ["v-taif", "الطَّائِفُ", "at-taif", "Taif", "23"],
  ["v-washintun", "وَاشِنْطُنُ", "washintun", "Washington", "23"],
  ["v-fanadiqu", "فَنَادِقُ", "fanadiqu", "hotels", "23"],
  ["v-pdf-qirsh", "قِرْشٌ", "qirshun", "1/10th of a riyal", "PDF"],
  ["v-pdf-aba", "آبَاءٌ", "abaun", "fathers", "PDF"],
  ["v-pdf-abna", "أَبْنَاءٌ", "abnaun", "sons", "PDF"],
  ["v-pdf-tairah", "طَائِرَةٌ", "tairatun", "airplane", "PDF"],
  ["v-pdf-matar", "مَطَارٌ", "matarun", "airport", "PDF"],
  ["v-pdf-tuffahah", "تُفَّاحَةٌ", "tuffahatun", "apple", "PDF"],
  ["v-pdf-arabiyyun", "عَرَبِيٌّ", "arabiyyun", "Arabic", "PDF"],
  ["v-pdf-azraqu", "أَزْرَقُ", "azraqu", "blue", "PDF"],
  ["v-pdf-ustadhatun", "أُسْتَاذَةٌ", "ustadhatun", "professor (f)", "PDF"],
  ["v-pdf-asma", "أَسْمَاءٌ", "asmaun", "names", "PDF"],
  ["v-pdf-istanbul", "إِسْطَنْبُولُ", "istanbul", "Istanbul", "PDF"],
  ["v-pdf-amam", "أَعْمَامٌ", "amamun", "paternal uncles", "PDF"],
  ["v-pdf-aqwiya", "أَقْوِيَاءُ", "aqwiyau", "strong (p)", "PDF"],
  ["v-pdf-ummun", "أُمٌّ", "ummun", "mother", "PDF"],
  ["v-pdf-ummahat", "أُمَّهَاتٌ", "ummahatun", "mothers", "PDF"],
  ["v-pdf-ana-bikhayr", "أَنَا بِخَيْرٍ", "ana bikhayrin", "I am fine", "PDF"],
  ["v-pdf-ayyam", "أَيَّامٌ", "ayyamun", "days", "PDF"],
  ["v-pdf-ikhtibar", "اِخْتِبَارٌ", "ikhtibarun", "examination", "PDF"],
  ["v-pdf-al-injiliziyyah", "الْإِنْجِلِيزِيَّةُ", "al-injiliziyyah", "English (language)", "PDF"],
  ["v-pdf-ath-thanawiyyah", "الثَّانَوِيَّةُ", "ath-thanawiyyah", "secondary (the)", "PDF"],
  ["v-pdf-ar-rabb", "الرَّبُّ", "ar-rabbu", "Lord (the)", "PDF"],
  ["v-pdf-al-filibbin", "الْفِلِبِّينُ", "al-filibbin", "The Philippines", "PDF"],
  ["v-pdf-al-qiblah", "الْقِبْلَةُ", "al-qiblah", "prayer direction (the)", "PDF"],
  ["v-pdf-al-kabah", "الْكَعْبَةُ", "al-kabah", "Ka'bah (the)", "PDF"],
  ["v-pdf-al-madrasah-mutawassitah", "الْمَدْرَسَةُ الْمُتَوَسِّطَةُ", "al-madrasah al-mutawassitah", "middle school", "PDF"],
  ["v-pdf-al-mamlakah-arabiyyah-suudiyyah", "الْمَمْلَكَةُ الْعَرَبِيَّةُ السُّعُودِيَّةُ", "al-mamlakah al-arabiyyah as-suudiyyah", "Kingdom of Saudi Arabia", "PDF"],
  ["v-pdf-an-nas", "النَّاسُ", "an-nasu", "people", "PDF"],
  ["v-pdf-al-yunan", "الْيُونَانُ", "al-yunan", "Greece", "PDF"],
  ["v-pdf-maktabun", "مَكْتَبٌ", "maktabun", "desk", "PDF"],
  ["v-pdf-mudir-ash-sharikah", "مُدِيرُ الشَّرِكَةِ", "mudir ash-sharikah", "director of the company", "PDF"],
  ["v-pdf-baladun", "بَلَدٌ", "baladun", "country", "PDF"],
  ["v-pdf-thallajah", "ثَلَّاجَةٌ", "thallajatun", "fridge", "PDF"],
  ["v-pdf-thamanun", "ثَمَنٌ", "thamanun", "price", "PDF"],
  ["v-pdf-jamiatun", "جَامِعَةٌ", "jamiatun", "university", "PDF"],
  ["v-pdf-jududun", "جُدُدٌ", "jududun", "new (p)", "PDF"],
  ["v-pdf-jadidun", "جَدِيدٌ", "jadidun", "new", "PDF"],
  ["v-pdf-hajjun", "حَاجٌّ", "hajjun", "pilgrim", "PDF"],
  ["v-pdf-hujjajun", "حُجَّاجٌ", "hujjajun", "pilgrims", "PDF"],
  ["v-pdf-hadiqatun", "حَدِيقَةٌ", "hadiqatun", "garden", "PDF"],
  ["v-pdf-khalatun", "خَالَةٌ", "khalatun", "maternal aunt", "PDF"],
  ["v-pdf-khafifun", "خَفِيفٌ", "khafifun", "light", "PDF"],
  ["v-pdf-durusun", "دُرُوسٌ", "durusun", "lessons", "PDF"],
  ["v-pdf-daftarun", "دَفْتَرٌ", "daftarun", "notebook", "PDF"],
  ["v-pdf-dukkannun", "دُكَّانٌ", "dukkanun", "shop", "PDF"],
  ["v-pdf-rajab", "رَجَبٌ", "rajab", "the month of Rajab", "PDF"],
  ["v-pdf-rijalun", "رِجَالٌ", "rijalun", "men", "PDF"],
  ["v-pdf-riyalun", "رِيَالٌ", "riyalun", "riyal", "PDF"],
  ["v-pdf-haqlun", "حَقْلٌ", "haqlun", "field", "PDF"],
  ["v-pdf-sadiqun", "صَدِيقٌ", "sadiqun", "friend", "PDF"],
  ["v-pdf-dayfun", "ضَيْفٌ", "dayfun", "guest", "PDF"],
  ["v-pdf-mindilun", "مِنْدِيلٌ", "mindilun", "handkerchief", "PDF"],
  ["v-pdf-mudirun", "مُدِيرٌ", "mudirun", "headmaster", "PDF"],
  ["v-pdf-mufattishun", "مُفَتِّشٌ", "mufattishun", "inspector", "PDF"],
  ["v-pdf-mikwatun", "مِكْوَاةٌ", "mikwatun", "iron (for ironing)", "PDF"],
  ["v-pdf-mahkamatun", "مَحْكَمَةٌ", "mahkamatun", "lawcourt", "PDF"],
  ["v-pdf-wazirun", "وَزِيرٌ", "wazirun", "minister", "PDF"],
  ["v-pdf-wuzara", "وُزَرَاءُ", "wuzarau", "ministers", "PDF"],
  ["v-pdf-mustashfa-al-wiladah", "مُسْتَشْفَى الْوِلَادَةِ", "mustashfa al-wiladah", "maternity hospital", "PDF"],
  ["v-pdf-gharbun", "غَرْبٌ", "gharbun", "west", "PDF"],
  ["v-pdf-mirhadun", "مِرْحَاضٌ", "mirhadun", "toilet", "PDF"],
  ["v-pdf-mumarridatun", "مُمَرِّضَةٌ", "mumarridatun", "nurse", "PDF"],
  ["v-pdf-nabiyyun", "نَبِيٌّ", "nabiyyun", "Prophet", "PDF"],
  ["v-pdf-nazifun", "نَظِيفٌ", "nazifun", "clean", "PDF"],
  ["v-pdf-huna", "هُنَا", "huna", "here", "PDF"],
  ["v-pdf-hunaka", "هُنَاكَ", "hunaka", "there", "PDF"],
  ["v-pdf-waraqun", "وَرَقٌ", "waraqun", "paper", "PDF"],
  ["v-pdf-yabaniyyun", "يَابَانِيٌّ", "yabaniyyun", "Japanese", "PDF"],
  ["v-pdf-ya-sayyidati", "يَا سَيِّدَتِي", "ya sayyidati", "madam", "PDF"],
  ["v-pdf-ya-sayyidi", "يَا سَيِّدِي", "ya sayyidi", "sir", "PDF"],
  ["v-pdf-yuguslaviya", "يُوغُوسْلَافِيَا", "yuguslaviya", "Yugoslavia", "PDF"],
  ["v-pdf-yawm-as-sabt", "يَوْمُ السَّبْتِ", "yawm as-sabt", "Saturday", "PDF"],
  ["v-pdf-famun", "فَمٌ", "famun", "mouth", "PDF"],
  ["v-pdf-fallahun", "فَلَّاحٌ", "fallahun", "farmer", "PDF"],
  ["v-pdf-shayun", "شَايٌ", "shayun", "tea", "PDF"],
  ["v-pdf-milaqah", "مِلْعَقَةٌ", "milaqah", "spoon", "PDF"],
  ["v-pdf-ajalatun", "عَجَلَةٌ", "ajalatun", "wheel", "PDF"],
  ["v-pdf-daifun", "ضَعِيفٌ", "daifun", "weak", "PDF"],
  ["v-pdf-diafun", "ضِعَافٌ", "diafun", "weak (p)", "PDF"],
  ["v-pdf-qadrun", "قِدْرٌ", "qadrun", "pot (f)", "PDF"],
  ["v-pdf-qaribun", "قَرِيبٌ", "qaribun", "near", "PDF"],
  ["v-pdf-qisarun", "قِصَارٌ", "qisarun", "short (p)", "PDF"],
  ["v-pdf-tiwalun", "طِوَالٌ", "tiwalun", "tall (p)", "PDF"],
  ["v-pdf-kalimatun", "كَلِمَةٌ", "kalimatun", "word", "PDF"],
  ["v-pdf-kalimat", "كَلِمَاتٌ", "kalimatun", "words", "PDF"],
  ["v-pdf-qahwatun", "قَهْوَةٌ", "qahwatun", "coffee", "PDF"],
  ["v-pdf-dusturun", "دُسْتُورٌ", "dusturun", "constitution (law)", "PDF"],
  ["v-pdf-kulliyyatun", "كُلِّيَّةٌ", "kulliyyatun", "faculty, college", "PDF"],
  ["v-pdf-kulliyyat-at-tijarah", "كُلِّيَّةُ التِّجَارَةِ", "kulliyyat at-tijarah", "faculty of commerce", "PDF"],
  ["v-pdf-kulliyyat-al-handasah", "كُلِّيَّةُ الْهَنْدَسَةِ", "kulliyyat al-handasah", "faculty of engineering", "PDF"],
  ["v-pdf-kulliyyat-ash-shariah", "كُلِّيَّةُ الشَّرِيعَةِ", "kulliyyat ash-shariah", "faculty of islamic law", "PDF"],
  ["v-pdf-kulliyyat-at-tibb", "كُلِّيَّةُ الطِّبِّ", "kulliyyat at-tibb", "faculty of medicine", "PDF"],
  ["v-pdf-shafahullah", "شَفَاهُ اللَّهُ", "shafahullahu", "May Allah grant him health", "PDF"],
  ["v-pdf-shukran", "شُكْرًا", "shukran", "thanks", "PDF"],
  ["v-pdf-kayfa-haluk", "كَيْفَ حَالُكَ؟", "kayfa haluka", "how are you? How do you do?", "PDF"]
];

const book2LessonDrafts = [
  {
    n: "1",
    title: "إِنَّ, لَعَلَّ, ذُو and Large Numbers",
    focus: "Emphasis with إِنَّ, hope/fear with لَعَلَّ, possession adjectives, أَمْ, and 100/1000.",
    arabic: "إِنَّ الْبَيْتَ جَدِيدٌ.",
    translation: "Indeed, the house is new.",
    notes: [
      "إِنَّ emphasizes a nominal sentence and makes its ism accusative.",
      "لَعَلَّ can express hope or fear according to context.",
      "ذُو and its forms describe possession and behave like adjectives."
    ],
    quiz: {
      prompt: "What happens to the ism of إِنَّ?",
      arabic: "إِنَّ الْبَيْتَ جَدِيدٌ.",
      answer: "it becomes accusative",
      options: ["it becomes accusative", "it becomes dual", "it becomes imperative"]
    }
  },
  {
    n: "2",
    title: "Negating Nominal Sentences With لَيْسَ",
    focus: "لَيْسَ, لَيْسَتْ, لَسْتُ, the bāʾ of emphasis, and ابن.",
    arabic: "لَيْسَ الْمَاءُ بَارِدًا.",
    translation: "The water is not cold.",
    notes: [
      "لَيْسَ negates a nominal sentence.",
      "Its khabar is accusative, and it may also appear with بِ for emphasis.",
      "The word اِبْنٌ has special spelling behavior between names."
    ],
    quiz: {
      prompt: "What does لَيْسَ do?",
      arabic: "لَيْسَ الْمَاءُ بَارِدًا.",
      answer: "negates a nominal sentence",
      options: ["negates a nominal sentence", "forms the dual", "marks future tense"]
    }
  },
  {
    n: "3",
    title: "Comparison, لٰكِنَّ and Numbers 11-20",
    focus: "The pattern أَفْعَلُ for comparison, لٰكِنَّ, كَأَنَّ, ordinals, and 11-20 with masculine nouns.",
    arabic: "هٰذَا الْكِتَابُ أَسْهَلُ مِنْ ذٰلِكَ.",
    translation: "This book is easier than that one.",
    notes: [
      "أَفْعَلُ مِنْ expresses comparison.",
      "لٰكِنَّ and كَأَنَّ work like إِنَّ.",
      "Numbers 11-20 have special agreement rules with the counted noun."
    ],
    quiz: {
      prompt: "What does أَكْبَرُ مِنْ express?",
      arabic: "أَكْبَرُ مِنْ",
      answer: "bigger than",
      options: ["bigger than", "because of", "not yet"]
    }
  },
  {
    n: "4",
    title: "The Past Tense and Past Negation",
    focus: "The māḍī verb, مَا for past negation, نَعَمْ vs بَلَى, and لِأَنَّ.",
    arabic: "ذَهَبْتُ إِلَى السُّوقِ أَمْسِ.",
    translation: "I went to the market yesterday.",
    notes: [
      "The māḍī expresses completed action.",
      "مَا negates past-tense verbs.",
      "بَلَى answers a negative question affirmatively."
    ],
    quiz: {
      prompt: "Which particle negates a past-tense verb?",
      arabic: "مَا ذَهَبْتُ.",
      answer: "مَا",
      options: ["مَا", "سَ", "أَنْ"]
    }
  },
  {
    n: "5",
    title: "Subject, Object and Verb Roots",
    focus: "The verbal sentence, فاعل, مفعول به, accusative objects, hamzat al-wasl, and three radicals.",
    arabic: "فَتَحَ الْوَلَدُ الْبَابَ.",
    translation: "The boy opened the door.",
    notes: [
      "The doer of a verb is the فاعل.",
      "The direct object is the مفعول به and is usually accusative.",
      "Most simple Arabic verbs are built from three radicals."
    ],
    quiz: {
      prompt: "In فَتَحَ الْوَلَدُ الْبَابَ, what is الْبَابَ?",
      arabic: "فَتَحَ الْوَلَدُ الْبَابَ.",
      answer: "the object",
      options: ["the object", "the subject", "a preposition"]
    }
  },
  {
    n: "6",
    title: "Feminine Past Forms and أَيُّ",
    focus: "Second-person feminine māḍī, 11-20 with feminine nouns, أَيُّ, أَظُنُّ أَنَّ, لِمَهْ, and هَاتِ.",
    arabic: "أَيُّ طَالِبَةٍ ذَهَبَتْ؟",
    translation: "Which female student went?",
    notes: [
      "أَيُّ is usually mudaf, so the following noun is genitive.",
      "Numbers 11-20 change form with feminine counted nouns.",
      "Adjectives like جَوْعَانُ have feminine and plural patterns."
    ],
    quiz: {
      prompt: "How does أَيُّ normally behave?",
      arabic: "أَيُّ طَالِبٍ؟",
      answer: "as a mudaf",
      options: ["as a mudaf", "as a verb", "as a sound plural"]
    }
  },
  {
    n: "7",
    title: "Accusative Pronouns and كَانَ",
    focus: "Past-tense plural forms, object pronouns attached to verbs, كَانَ, ذُو with definiteness, and fractions.",
    arabic: "كَانَ الْمُدَرِّسُ فِي الْمَكْتَبَةِ.",
    translation: "The teacher was in the library.",
    notes: [
      "Object pronouns attach directly to many verbs.",
      "كَانَ enters nominal sentences and can change the case of the khabar.",
      "Fractions such as نِصْفٌ and ثُلُثٌ are introduced."
    ],
    quiz: {
      prompt: "What does كَانَ do to a noun khabar?",
      arabic: "كَانَ بِلَالٌ مَرِيضًا.",
      answer: "makes it accusative",
      options: ["makes it accusative", "makes it dual", "makes it future"]
    }
  },
  {
    n: "8",
    title: "Past Tense Review",
    focus: "Revision of the māḍī with all non-dual pronouns.",
    arabic: "ذَهَبْنَا إِلَى الْجَامِعَةِ.",
    translation: "We went to the university.",
    notes: [
      "This lesson consolidates māḍī endings.",
      "The dual verb forms are delayed until Lesson 30.",
      "Students identify subjects and attached pronouns."
    ],
    quiz: {
      prompt: "What does Lesson 8 mainly revise?",
      arabic: "ذَهَبْتُ، ذَهَبْنَا، ذَهَبُوا",
      answer: "past tense isnad",
      options: ["past tense isnad", "adjective colors", "dual nouns only"]
    }
  },
  {
    n: "9",
    title: "Sound Feminine Plural and Relative Pronouns",
    focus: "Accusative sound feminine plural, the first-person object pronoun, فِعْلُ التَّعَجُّبِ, vocatives, and plural relative pronouns.",
    arabic: "رَأَيْتُ الطَّالِبَاتِ فِي الْحَافِلَاتِ.",
    translation: "I saw the female students in the buses.",
    notes: [
      "The sound feminine plural has kasrah in both accusative and genitive positions.",
      "The pronoun -نِي means “me” when attached to a verb.",
      "الَّذِينَ and اللَّاتِي are plural relative pronouns."
    ],
    quiz: {
      prompt: "What is the accusative ending of a sound feminine plural?",
      arabic: "رَأَيْتُ الطَّالِبَاتِ.",
      answer: "kasrah",
      options: ["kasrah", "wāw", "tanwin fatḥ"]
    }
  },
  {
    n: "10",
    title: "The Present Tense",
    focus: "Introducing the mudāriʿ, four common verb groups, numbers 21-30 with masculine nouns, and بَيْنَ.",
    arabic: "يَكْتُبُ الطَّالِبُ الدَّرْسَ.",
    translation: "The student writes the lesson.",
    notes: [
      "The mudāriʿ can mean present, continuous, or future depending on context.",
      "Four prefix letters are used with the mudāriʿ.",
      "Numbers 21-30 connect the unit and ten with وَ."
    ],
    quiz: {
      prompt: "What can يَكْتُبُ mean?",
      arabic: "يَكْتُبُ",
      answer: "present or future",
      options: ["present or future", "only past", "only command"]
    }
  },
  {
    n: "11",
    title: "Mudāriʿ Forms, Future سَ and Masdar",
    focus: "Mudāriʿ isnad, the future particle سَ, negative لَا, masdar pattern فُعُولٌ, and أَمَّا.",
    arabic: "سَأَكْتُبُ لَكَ رِسَالَةً.",
    translation: "I will write you a letter.",
    notes: [
      "سَ before the mudāriʿ marks future meaning.",
      "لَا negates the mudāriʿ in the present.",
      "Masdars like دُخُولٌ and خُرُوجٌ are verbal nouns."
    ],
    quiz: {
      prompt: "What does سَ before the mudāriʿ mark?",
      arabic: "سَأَكْتُبُ",
      answer: "future",
      options: ["future", "past negation", "dual"]
    }
  },
  {
    n: "12",
    title: "More Mudāriʿ Forms and Time Adverbs",
    focus: "Feminine singular/plural mudāriʿ, نَفْعَلُ, adverbial time, and إنَّ/أنَّ after verbs of saying and thinking.",
    arabic: "نَذْهَبُ إِلَى الْمَكْتَبَةِ يَوْمَ السَّبْتِ.",
    translation: "We go to the library on Saturday.",
    notes: [
      "نَـ marks the first-person plural mudāriʿ.",
      "Time words can be used as adverbs in the accusative.",
      "قَالَ is followed by إِنَّ, while many other verbs take أَنَّ."
    ],
    quiz: {
      prompt: "What is يَوْمَ السَّبْتِ in the model sentence?",
      arabic: "يَوْمَ السَّبْتِ",
      answer: "adverbial time",
      options: ["adverbial time", "object pronoun", "comparative adjective"]
    }
  },
  {
    n: "13",
    title: "Mudāriʿ Review",
    focus: "Full review of the mudāriʿ with all non-dual pronouns.",
    arabic: "أَيْنَ تَدْرُسُونَ؟",
    translation: "Where do you study?",
    notes: [
      "This lesson consolidates the mudāriʿ forms before the imperative.",
      "Students compare prefixes and endings across pronouns.",
      "The lesson emphasizes correct marfūʿ endings."
    ],
    quiz: {
      prompt: "What does this revision lesson focus on?",
      arabic: "يَدْرُسُ، تَدْرُسُ، أَدْرُسُ، نَدْرُسُ",
      answer: "mudari' isnad",
      options: ["mudari' isnad", "diptote colors", "only numbers"]
    }
  },
  {
    n: "14",
    title: "The Imperative",
    focus: "Forming the command, hamzat al-wasl, imperative endings, and indefinite mubtada.",
    arabic: "اُكْتُبْ يَا بِلَالُ.",
    translation: "Write, Bilal.",
    notes: [
      "The imperative is built from the second-person mudāriʿ.",
      "Hamzat al-wasl is used when the command would begin with a sakin letter.",
      "كُلْ and خُذْ are irregular common commands."
    ],
    quiz: {
      prompt: "The imperative is formed from which verb form?",
      arabic: "تَكْتُبُ → اُكْتُبْ",
      answer: "second-person mudari'",
      options: ["second-person mudari'", "a diptote noun", "a relative pronoun"]
    }
  },
  {
    n: "15",
    title: "Prohibition and كَادَ",
    focus: "لا الناهية, prohibitive endings, كَادَ, negative لَا with the present, and إِنَّمَا.",
    arabic: "لَا تَذْهَبْ إِلَى السُّوقِ.",
    translation: "Do not go to the market.",
    notes: [
      "لا الناهية turns a second-person mudāriʿ into a prohibition.",
      "The final vowel is dropped in the basic prohibited form.",
      "كَادَ means “almost” or “was about to”."
    ],
    quiz: {
      prompt: "What is لَا تَذْهَبْ?",
      arabic: "لَا تَذْهَبْ",
      answer: "prohibition",
      options: ["prohibition", "past affirmation", "comparison"]
    }
  },
  {
    n: "16",
    title: "يُرِيدُ, Relative مَا and Color Forms",
    focus: "The verb يُرِيدُ, مَا الموصولة, ذَا, diptote names, feminine colors, بدل, آخَر/أُخْرَى, المصحف, and غير.",
    arabic: "أُرِيدُ مُصْحَفًا جَدِيدًا.",
    translation: "I want a new copy of the Qur'an.",
    notes: [
      "يُرِيدُ means “he wants”, and its māḍī is أَرَادَ.",
      "مَا الموصولة means “what” or “that which”.",
      "Color adjectives have distinctive masculine, feminine, and plural patterns."
    ],
    quiz: {
      prompt: "What does مَا الموصولة mean?",
      arabic: "أَشْرَبُ مَا تُرِيدُ.",
      answer: "that which / what",
      options: ["that which / what", "not yet", "between"]
    }
  },
  {
    n: "17",
    title: "أَنْ, Purpose لِـ and يُمْكِنُ",
    focus: "Mudāriʿ mansūb after أَنْ, لام التعليل, يُمْكِنُ, مُنْذُ, and feminine verb agreement.",
    arabic: "أُرِيدُ أَنْ أَدْرُسَ الْعَرَبِيَّةَ.",
    translation: "I want to study Arabic.",
    notes: [
      "أَنْ makes the following mudāriʿ mansūb.",
      "لام التعليل explains purpose.",
      "If the فاعل is feminine, the verb usually shows feminine agreement."
    ],
    quiz: {
      prompt: "What does أَنْ do to the mudāriʿ after يُرِيدُ?",
      arabic: "أُرِيدُ أَنْ أَدْرُسَ.",
      answer: "makes it accusative",
      options: ["makes it accusative", "makes it past", "makes it plural"]
    }
  },
  {
    n: "18",
    title: "Mansūb Endings, كَـ and كُلّ",
    focus: "Mudāriʿ mansūb endings, كَـ meaning “like”, كُلّ for emphasis, vocative يا أيها, اسم الفعل, and demonstratives with iḍāfah.",
    arabic: "الطُّلَّابُ كُلُّهُمْ حَاضِرُونَ.",
    translation: "All the students are present.",
    notes: [
      "The five mudāriʿ forms ending in nūn drop that nūn in the mansūb.",
      "كَـ is a preposition meaning “like”.",
      "كُلّ is connected to what it emphasizes by a pronoun."
    ],
    quiz: {
      prompt: "What does كَـ mean as a preposition?",
      arabic: "كَالْجَبَلِ",
      answer: "like",
      options: ["like", "never", "which"]
    }
  },
  {
    n: "19",
    title: "Future Negation With لَنْ",
    focus: "لَنْ with the mudāriʿ mansūb and أَبَدًا for emphatic future negation.",
    arabic: "لَنْ أَذْهَبَ غَدًا.",
    translation: "I will not go tomorrow.",
    notes: [
      "لَنْ negates the future and makes the mudāriʿ mansūb.",
      "When لَنْ is used, the future سَ is omitted.",
      "أَبَدًا emphasizes a negative future verb."
    ],
    quiz: {
      prompt: "What does لَنْ do to the mudāriʿ?",
      arabic: "لَنْ أَذْهَبَ",
      answer: "accusative and future negative",
      options: ["accusative and future negative", "past positive", "dual nominative"]
    }
  },
  {
    n: "20",
    title: "Dual Accusative and Genitive",
    focus: "Dual nouns in accusative/genitive cases and the patterns أَحَدُهُمَا/إِحْدَاهُمَا.",
    arabic: "رَأَيْتُ طَالِبَيْنِ جَدِيدَيْنِ.",
    translation: "I saw two new students.",
    notes: [
      "The dual nominative ending is ـَانِ.",
      "The dual accusative and genitive ending is ـَيْنِ.",
      "أَحَدُهُمَا and إِحْدَاهُمَا mean “one of the two”."
    ],
    quiz: {
      prompt: "What is the dual accusative/genitive ending?",
      arabic: "طَالِبَيْنِ",
      answer: "ـَيْنِ",
      options: ["ـَيْنِ", "ـُونَ", "ـَاتٌ"]
    }
  },
  {
    n: "21",
    title: "لَمْ, لَمَّا and Parts of Speech",
    focus: "لَمْ and لَمَّا with the mudāriʿ majzūm, nouns/verbs/particles, nominal/verbal sentences, مَهْلًا, and neither/nor.",
    arabic: "لَمْ أَفْهَمْ هٰذَا السُّؤَالَ.",
    translation: "I did not understand this question.",
    notes: [
      "لَمْ changes the mudāriʿ to past negative meaning and makes it majzūm.",
      "لَمَّا means “not yet” with similar grammatical effect.",
      "Arabic classifies words as ism, fiʿl, or ḥarf."
    ],
    quiz: {
      prompt: "What meaning does لَمْ give the mudāriʿ?",
      arabic: "لَمْ أَفْهَمْ",
      answer: "past negative",
      options: ["past negative", "future command", "comparison"]
    }
  },
  {
    n: "22",
    title: "The Three Mudāriʿ Moods",
    focus: "Revision of the marfūʿ, mansūb and majzūm mudāriʿ.",
    arabic: "يُرِيدُونَ أَنْ يَذْهَبُوا.",
    translation: "They want to go.",
    notes: [
      "The marfūʿ mudāriʿ is the default form.",
      "The mansūb appears after particles such as أَنْ and لَنْ.",
      "The majzūm appears after particles such as لَمْ."
    ],
    quiz: {
      prompt: "What are the three mudāriʿ moods reviewed here?",
      arabic: "مَرْفُوعٌ، مَنْصُوبٌ، مَجْزُومٌ",
      answer: "marfu, mansub, majzum",
      options: ["marfu, mansub, majzum", "singular, dual, plural", "noun, adjective, adverb"]
    }
  },
  {
    n: "23",
    title: "Sound Masculine Plural and 20-90",
    focus: "Sound masculine plural iʿrāb, the ʿuqūd numbers, 21-30 with feminine nouns, and لا...ولا.",
    arabic: "رَأَيْتُ الْمُدَرِّسِينَ فِي الْفَصْلِ.",
    translation: "I saw the teachers in the classroom.",
    notes: [
      "The sound masculine plural uses ـُونَ in the nominative.",
      "It uses ـِينَ in both accusative and genitive positions.",
      "Numbers 20-90 decline like the sound masculine plural."
    ],
    quiz: {
      prompt: "What ending marks the sound masculine plural in accusative/genitive?",
      arabic: "الْمُدَرِّسِينَ",
      answer: "ـِينَ",
      options: ["ـِينَ", "ـَاتِ", "ـَانِ"]
    }
  },
  {
    n: "24",
    title: "Numbers Summary",
    focus: "A full consolidation of number agreement, counted nouns, iʿrāb, hundreds and thousands.",
    arabic: "عِنْدِي خَمْسَةُ كُتُبٍ.",
    translation: "I have five books.",
    notes: [
      "The counted noun after 3-10 is plural genitive.",
      "The counted noun after 11-99 is singular accusative.",
      "The counted noun after 100 and 1000 is singular genitive."
    ],
    quiz: {
      prompt: "What is the maʿdūd of numbers 3-10?",
      arabic: "خَمْسَةُ كُتُبٍ",
      answer: "plural genitive",
      options: ["plural genitive", "singular nominative", "dual accusative"]
    }
  },
  {
    n: "25",
    title: "كَانَ, لَا يَزَالُ and Special Noun Cases",
    focus: "كَانَ with noun khabar, لَا يَزَالُ, case forms of أَب and أَخ, قَبْلُ/بَعْدُ, and selected broken plurals.",
    arabic: "كَانَ الْجَوُّ جَمِيلًا.",
    translation: "The weather was fine.",
    notes: [
      "The khabar of كَانَ is mansūb when it is a noun or adjective.",
      "لَا يَزَالُ means “he/it is still”.",
      "أَب and أَخ have special forms when they are mudaf."
    ],
    quiz: {
      prompt: "What is the case of a noun khabar after كَانَ?",
      arabic: "كَانَ الْجَوُّ جَمِيلًا.",
      answer: "accusative",
      options: ["accusative", "genitive plural", "imperative"]
    }
  },
  {
    n: "26",
    title: "Mithāl Verbs and يَجِبُ",
    focus: "Weak first-radical verbs, diminutives, comparatives, يَجِبُ, and another masdar pattern.",
    arabic: "يَجِبُ عَلَيْنَا أَنْ نَفْهَمَ الدَّرْسَ.",
    translation: "We must understand the lesson.",
    notes: [
      "A mithāl verb has a weak first radical.",
      "The initial wāw often drops in the mudāriʿ.",
      "يَجِبُ عَلَى means “it is necessary for”."
    ],
    quiz: {
      prompt: "Where is the weak letter in a mithāl verb?",
      arabic: "وَقَفَ : يَقِفُ",
      answer: "first radical",
      options: ["first radical", "middle radical", "final radical"]
    }
  },
  {
    n: "27",
    title: "Ajwaf Verbs",
    focus: "Weak middle-radical verbs in the māḍī, mudāriʿ, majzūm and imperative, oaths, ظَنَّ, يَنْبَغِي, and مَاتَ.",
    arabic: "قَالَ الطَّالِبُ: لَمْ أَقُلْ هٰذَا.",
    translation: "The student said: I did not say this.",
    notes: [
      "An ajwaf verb has a weak middle radical.",
      "The weak middle radical is often omitted in majzūm and command forms.",
      "ظَنَّ can take two accusative objects."
    ],
    quiz: {
      prompt: "Where is the weak letter in an ajwaf verb?",
      arabic: "قَالَ : يَقُولُ",
      answer: "middle radical",
      options: ["middle radical", "first radical", "final radical"]
    }
  },
  {
    n: "28",
    title: "Nāqiṣ Verbs",
    focus: "Weak final-radical verbs, رأى/يرى, the command أَرِ, and omitted final radicals in majzūm and command forms.",
    arabic: "دَعَا الْمُدَرِّسُ الطُّلَّابَ.",
    translation: "The teacher called the students.",
    notes: [
      "A nāqiṣ verb has a weak final radical.",
      "The final weak radical is often dropped in majzūm and imperative forms.",
      "رَأَى has special forms such as يَرَى and لَمْ يَرَ."
    ],
    quiz: {
      prompt: "Where is the weak letter in a nāqiṣ verb?",
      arabic: "دَعَا : يَدْعُو",
      answer: "final radical",
      options: ["final radical", "first radical", "second and third radicals"]
    }
  },
  {
    n: "29",
    title: "Muḍaʿʿaf Verbs",
    focus: "Doubled verbs, their māḍī/mudāriʿ/imperative changes, لَمَّا meaning “when”, قَطُّ, أَبَدًا, and polite thanks.",
    arabic: "لَمْ أَحُجَّ قَطُّ.",
    translation: "I have never performed Hajj.",
    notes: [
      "A muḍaʿʿaf verb has identical second and third radicals.",
      "Strong doubled letters are handled differently from weak letters.",
      "قَطُّ emphasizes a negative past verb."
    ],
    quiz: {
      prompt: "What defines a muḍaʿʿaf verb?",
      arabic: "حَجَّ : يَحُجُّ",
      answer: "same second and third radicals",
      options: ["same second and third radicals", "weak first radical", "a feminine plural ending"]
    }
  },
  {
    n: "30",
    title: "Dual Verb Forms and The Five Verbs",
    focus: "Dual pronouns with māḍī, mudāriʿ and imperative, dual attached pronouns, and الأفعال الخمسة.",
    arabic: "الطَّالِبَانِ يَذْهَبَانِ إِلَى الْمَسْجِدِ.",
    translation: "The two students go to the mosque.",
    notes: [
      "Dual verb forms are used for two people or things.",
      "The five verb forms keep nūn in marfūʿ and drop it in mansūb and majzūm.",
      "هُمَا and أَنْتُمَا are dual pronouns."
    ],
    quiz: {
      prompt: "When do the five verb forms omit the nūn?",
      arabic: "لَنْ يَذْهَبَا، لَمْ يَذْهَبَا",
      answer: "mansub and majzum",
      options: ["mansub and majzum", "only nominative", "only after كَانَ"]
    }
  },
  {
    n: "31",
    title: "Adjective Agreement",
    focus: "The naʿt and manʿūt, and agreement in definiteness, case, number and gender.",
    arabic: "سَأَلْتُ الْمُدَرِّسَ الْجَدِيدَ.",
    translation: "I asked the new teacher.",
    notes: [
      "The adjective follows the noun it describes.",
      "The adjective agrees with the described noun in four areas.",
      "This lesson consolidates adjective agreement across singular, dual and plural forms."
    ],
    quiz: {
      prompt: "What does the naʿt agree with?",
      arabic: "الْمُدَرِّسَ الْجَدِيدَ",
      answer: "definiteness, case, number, gender",
      options: ["definiteness, case, number, gender", "only tense", "only word order"]
    }
  }
];

const book2VocabularyByLesson = {
  "1": [
    ["inna", "إِنَّ", "inna", "indeed / surely"],
    ["anna", "أَنَّ", "anna", "that / indeed"],
    ["laalla", "لَعَلَّ", "laalla", "perhaps / I hope"],
    ["dhu", "ذُو", "dhu", "possessing"],
    ["dhatu", "ذَاتُ", "dhatu", "possessing (f)"],
    ["dhawu", "ذَوُو", "dhawu", "possessing (mp)"],
    ["dhawat", "ذَوَاتُ", "dhawat", "possessing (fp)"],
    ["am", "أَمْ", "am", "or (in questions)"],
    ["miah", "مِائَةٌ", "miah", "hundred"],
    ["alf", "أَلْفٌ", "alf", "thousand"],
    ["ghalin", "غَالٍ", "ghalin", "expensive"],
    ["rupiyyah", "رُوبِيَّةٌ", "rubiyyah", "rupee"],
    ["khuluq", "خُلُقٌ", "khuluq", "manners"]
  ],
  "2": [
    ["laysa", "لَيْسَ", "laysa", "is not"],
    ["laysat", "لَيْسَتْ", "laysat", "is not (f)"],
    ["lastu", "لَسْتُ", "lastu", "I am not"],
    ["ibn", "اِبْنٌ", "ibn", "son"],
    ["masrif", "مَصْرِفٌ", "masrif", "bank"],
    ["maktab-barid", "مَكْتَبُ الْبَرِيدِ", "maktab al-barid", "post office"],
    ["barqiyyah", "بَرْقِيَّةٌ", "barqiyyah", "telegram"],
    ["nahr", "نَهْرٌ", "nahr", "river"],
    ["jayb", "جَيْبٌ", "jayb", "pocket"],
    ["rasaba", "رَسَبَ : يَرْسُبُ", "rasaba / yarsubu", "to fail an examination"]
  ],
  "3": [
    ["akbar", "أَكْبَرُ", "akbar", "bigger / biggest"],
    ["ahsan", "أَحْسَنُ", "ahsan", "better / best"],
    ["atwal", "أَطْوَلُ", "atwal", "taller / tallest"],
    ["lakin", "لٰكِنَّ", "lakin", "but"],
    ["kaanna", "كَأَنَّ", "kaanna", "as if"],
    ["bala", "بَلَى", "bala", "yes (after a negative question)"],
    ["ayyuhuma", "أَيُّهُمَا", "ayyuhuma", "which of the two"],
    ["thanin", "ثَانٍ", "thanin", "second"],
    ["thalith", "ثَالِثٌ", "thalith", "third"],
    ["thaman", "ثَمَنٌ", "thaman", "price"]
  ],
  "4": [
    ["dhahaba", "ذَهَبَ : يَذْهَبُ", "dhahaba / yadhhabu", "to go"],
    ["rajaa", "رَجَعَ", "rajaa", "he returned"],
    ["kharaja", "خَرَجَ", "kharaja", "he went out"],
    ["dakhala", "دَخَلَ", "dakhala", "he entered"],
    ["ma-neg", "مَا", "ma", "not"],
    ["lianna", "لِأَنَّ", "lianna", "because"],
    ["amsi", "أَمْسِ", "amsi", "yesterday"],
    ["suq", "السُّوقُ", "as-suq", "the market"],
    ["jaww", "الْجَوُّ", "al-jaww", "the weather"]
  ],
  "5": [
    ["fataha", "فَتَحَ", "fataha", "he opened"],
    ["saala", "سَأَلَ", "saala", "he asked"],
    ["shariba", "شَرِبَ", "shariba", "he drank"],
    ["hafiza", "حَفِظَ", "hafiza", "he memorized"],
    ["fahima", "فَهِمَ", "fahima", "he understood"],
    ["fail", "الْفَاعِلُ", "al-fail", "the subject / doer"],
    ["maful", "الْمَفْعُولُ بِهِ", "al-maful bihi", "the object"],
    ["inab", "عِنَبٌ", "inab", "grapes"],
    ["mawz", "مَوْزٌ", "mawz", "banana"],
    ["tin", "تِينٌ", "tin", "fig"],
    ["qahwah", "قَهْوَةٌ", "qahwah", "coffee"]
  ],
  "6": [
    ["ayyu", "أَيُّ", "ayyu", "which"],
    ["azunnu", "أَظُنُّ", "azunnu", "I think"],
    ["limah", "لِمَهْ", "limah", "why?"],
    ["jawan", "جَوْعَانُ", "jawan", "hungry (m)"],
    ["jawa", "جَوْعَى", "jawa", "hungry (f)"],
    ["jiya", "جِيَاعٌ", "jiya", "hungry (plural)"],
    ["hati", "هَاتِ", "hati", "bring (m)"],
    ["hatu", "هَاتُوا", "hatu", "bring (mp)"],
    ["majallah", "مَجَلَّةٌ", "majallah", "magazine"],
    ["kalimah", "كَلِمَةٌ", "kalimah", "word"],
    ["rakib", "رَاكِبٌ", "rakib", "passenger"],
    ["khadimah", "خَادِمَةٌ", "khadimah", "maid servant"]
  ],
  "7": [
    ["raaytuhu", "رَأَيْتُهُ", "raaytuhu", "I saw him"],
    ["raaytumuhu", "رَأَيْتُمُوهُ", "raaytumuhu", "you saw him"],
    ["kana", "كَانَ", "kana", "he was"],
    ["dhu-lihyah", "ذُو اللِّحْيَةِ", "dhu al-lihyah", "having a beard"],
    ["abshir", "أَبْشِرْ", "abshir", "rejoice at good news"],
    ["thuluth", "ثُلُثٌ", "thuluth", "one third"],
    ["nisf", "نِصْفٌ", "nisf", "half"],
    ["miknasah", "مِكْنَسَةٌ", "miknasah", "broom"],
    ["nazzarah", "نَظَّارَةٌ", "nazzarah", "spectacles"],
    ["sabun", "صَابُونٌ", "sabun", "soap"],
    ["asir", "عَصِيرٌ", "asir", "juice"],
    ["sullam", "سُلَّمٌ", "sullam", "staircase"],
    ["manarah", "مَنَارَةٌ", "manarah", "minaret"]
  ],
  "8": [
    ["madi", "الْمَاضِي", "al-madi", "past tense"],
    ["dhahabtu", "ذَهَبْتُ", "dhahabtu", "I went"],
    ["dhahabna", "ذَهَبْنَا", "dhahabna", "we went"],
    ["dhahabu", "ذَهَبُوا", "dhahabu", "they went"],
    ["dhahabna-f", "ذَهَبْنَ", "dhahabna", "they went (fp)"],
    ["fail-indef", "فَاعِلٌ", "fail", "subject / doer"],
    ["damir", "ضَمِيرٌ", "damir", "pronoun"],
    ["mustatir", "مُسْتَتِرٌ", "mustatir", "hidden"]
  ],
  "9": [
    ["talibat", "الطَّالِبَاتُ", "at-talibat", "the female students"],
    ["majallat", "الْمَجَلَّاتُ", "al-majallat", "the magazines"],
    ["raaytani", "رَأَيْتَنِي", "raaytani", "you saw me"],
    ["ma-ajmala", "مَا أَجْمَلَ", "ma ajmala", "how beautiful"],
    ["ya-aba-bakr", "يَا أَبَا بَكْرٍ", "ya aba bakrin", "O Abu Bakr"],
    ["mimma", "مِمَّ", "mimma", "from what"],
    ["amma", "عَمَّ", "amma", "about what"],
    ["alladhina", "الَّذِينَ", "alladhina", "who / which (mp)"],
    ["allati-pl", "اللَّاتِي", "allati", "who / which (fp)"],
    ["qaimah", "قَائِمَةٌ", "qaimah", "list"],
    ["mana", "مَعْنًى", "mana", "meaning"],
    ["lahzah", "لَحْظَةٌ", "lahzah", "moment"],
    ["hadara", "حَضَرَ", "hadara", "he attended"]
  ],
  "10": [
    ["mudari", "الْمُضَارِعُ", "al-mudari", "present/future tense"],
    ["madi", "الْمَاضِي", "al-madi", "past tense"],
    ["amr", "الْأَمْرُ", "al-amr", "imperative"],
    ["yaktubu", "يَكْتُبُ", "yaktubu", "he writes"],
    ["yajlisu", "يَجْلِسُ", "yajlisu", "he sits"],
    ["yafalu", "يَفْعَلُ", "yafalu", "he does"],
    ["wahid-wa-ishrun", "وَاحِدٌ وَعِشْرُونَ", "wahid wa-ishrun", "twenty-one"],
    ["bayna", "بَيْنَ", "bayna", "between"],
    ["daiman", "دَائِمًا", "daiman", "always"],
    ["ahyanan", "أَحْيَانًا", "ahyanan", "sometimes"],
    ["maktab", "مَكْتَبٌ", "maktab", "office"],
    ["mitr", "مِتْرٌ", "mitr", "metre"],
    ["kilumitr", "كِيلُومِتْرٌ", "kilumitr", "kilometre"]
  ],
  "11": [
    ["yadhhabu", "يَذْهَبُ", "yadhhabu", "he goes"],
    ["tadhhabu", "تَذْهَبُ", "tadhhabu", "she/you go"],
    ["adhhabu", "أَذْهَبُ", "adhhabu", "I go"],
    ["tadhhabuna", "تَذْهَبُونَ", "tadhhabuna", "you go (mp)"],
    ["saaktubu", "سَأَكْتُبُ", "saaktubu", "I will write"],
    ["la-afhamu", "لَا أَفْهَمُ", "la afhamu", "I do not understand"],
    ["dukhul", "دُخُولٌ", "dukhul", "entry"],
    ["khuruj", "خُرُوجٌ", "khuruj", "exit"],
    ["amma", "أَمَّا", "amma", "as for"],
    ["risalah", "رِسَالَةٌ", "risalah", "letter"],
    ["mahattah", "مَحَطَّةٌ", "mahattah", "station"],
    ["khayl", "خَيْلٌ", "khayl", "horses"]
  ],
  "12": [
    ["tadhhabina", "تَذْهَبِينَ", "tadhhabina", "you go (fs)"],
    ["tadhhabna", "تَذْهَبْنَ", "tadhhabna", "you/they go (fp)"],
    ["nadhhabu", "نَذْهَبُ", "nadhhabu", "we go"],
    ["yawm-sabt", "يَوْمَ السَّبْتِ", "yawm as-sabt", "Saturday"],
    ["azunnu-anna", "أَظُنُّ أَنَّ", "azunnu anna", "I think that"],
    ["dawa", "دَوَاءٌ", "dawa", "medicine"],
    ["tilmidh", "تِلْمِيذٌ", "tilmidh", "pupil"],
    ["hatif", "هَاتِفٌ", "hatif", "telephone"],
    ["waqt", "وَقْتٌ", "waqt", "time"],
    ["jar", "جَارٌ", "jar", "neighbor"],
    ["wajib", "وَاجِبٌ", "wajib", "homework / duty"]
  ],
  "13": [
    ["yadrusu", "يَدْرُسُ", "yadrusu", "he studies"],
    ["tadrusu", "تَدْرُسُ", "tadrusu", "she/you study"],
    ["adrusu", "أَدْرُسُ", "adrusu", "I study"],
    ["nadrusu", "نَدْرُسُ", "nadrusu", "we study"],
    ["yadrusuna", "يَدْرُسُونَ", "yadrusuna", "they study"],
    ["tadrusina", "تَدْرُسِينَ", "tadrusina", "you study (fs)"],
    ["yadrusna", "يَدْرُسْنَ", "yadrusna", "they study (fp)"],
    ["tadrusna", "تَدْرُسْنَ", "tadrusna", "you study (fp)"]
  ],
  "14": [
    ["uktub", "اُكْتُبْ", "uktub", "write"],
    ["ijlis", "اِجْلِسْ", "ijlis", "sit"],
    ["iqra", "اِقْرَأْ", "iqra", "read"],
    ["kul", "كُلْ", "kul", "eat"],
    ["khudh", "خُذْ", "khudh", "take"],
    ["aqrab", "عَقْرَبٌ", "aqrab", "scorpion"],
    ["hidha", "حِذَاءٌ", "hidha", "shoe"],
    ["kub", "كُوبٌ", "kub", "glass"],
    ["yad", "يَدٌ", "yad", "hand"],
    ["musa", "مُوسَى", "musa", "Musa (proper name)"],
    ["mizallah", "مِظَلَّةٌ", "mizallah", "umbrella"],
    ["waraqah", "وَرَقَةٌ", "waraqah", "piece of paper"]
  ],
  "15": [
    ["la-tadhhab", "لَا تَذْهَبْ", "la tadhhab", "do not go"],
    ["la-taktub", "لَا تَكْتُبْ", "la taktub", "do not write"],
    ["la-nahiyah", "لَا النَّاهِيَةُ", "la an-nahiyah", "prohibitive la"],
    ["la-nafiyah", "لَا النَّافِيَةُ", "la an-nafiyah", "negative la"],
    ["kada", "كَادَ : يَكَادُ", "kada / yakadu", "to almost do"],
    ["innama", "إِنَّمَا", "innama", "only"],
    ["maqad", "مَقْعَدٌ", "maqad", "seat"],
    ["athna", "أَثْنَاءَ", "athna", "during"],
    ["ya-abati", "يَا أَبَتِ", "ya abati", "O my father"],
    ["tariq", "الطَّرِيقُ", "at-tariq", "the road"]
  ],
  "16": [
    ["yuridu", "يُرِيدُ", "yuridu", "he wants"],
    ["arada", "أَرَادَ", "arada", "he wanted"],
    ["ma-mawsulah", "مَا الْمَوْصُولَةُ", "ma al-mawsulah", "relative ma"],
    ["dha", "ذَا", "dha", "possessing (accusative)"],
    ["umar", "عُمَرُ", "umar", "Umar"],
    ["abyad", "أَبْيَضُ", "abyad", "white (m)"],
    ["bayda", "بَيْضَاءُ", "bayda", "white (f)"],
    ["akhar", "آخَرُ", "akhar", "another"],
    ["ukhra", "أُخْرَى", "ukhra", "another (f)"],
    ["mushaf", "مُصْحَفٌ", "mushaf", "copy of the Qur'an"],
    ["ghayr", "غَيْرُ", "ghayr", "other than / non-"],
    ["dayyiq", "ضَيِّقٌ", "dayyiq", "narrow"]
  ],
  "17": [
    ["an", "أَنْ", "an", "that / to"],
    ["li-afhama", "لِأَفْهَمَ", "li-afhama", "so that I understand"],
    ["yumkin", "يُمْكِنُ", "yumkin", "it is possible"],
    ["mundhu", "مُنْذُ", "mundhu", "since"],
    ["samaha", "سَمَحَ", "samaha", "he permitted"],
    ["utlah", "عُطْلَةٌ", "utlah", "holiday"],
    ["misr", "مِصْرُ", "misr", "Egypt"],
    ["hudu", "هُدُوءٌ", "hudu", "calm"],
    ["zarf", "ظَرْفٌ", "zarf", "envelope"],
    ["hawa", "هَوَاءٌ", "hawa", "air"],
    ["sayf", "صَيْفٌ", "sayf", "summer"]
  ],
  "18": [
    ["kamithl", "كَمِثْلِ", "kamithli", "like"],
    ["kulluhum", "كُلُّهُمْ", "kulluhum", "all of them"],
    ["ya-ayyuh", "يَا أَيُّهَا", "ya ayyuha", "O"],
    ["uff", "أُفٍّ", "uffin", "I am bored"],
    ["amin", "آمِينَ", "amin", "accept my prayer"],
    ["mathaf", "مُتْحَفٌ", "mathaf", "museum"],
    ["hadiqat-hayawanat", "حَدِيقَةُ الْحَيَوَانَاتِ", "hadiqat al-hayawanat", "zoo"],
    ["unwan", "عُنْوَانٌ", "unwan", "address"],
    ["malabis", "مَلَابِسُ", "malabis", "clothes"],
    ["mithl", "مِثْلٌ", "mithl", "like / similar"]
  ],
  "19": [
    ["lan", "لَنْ", "lan", "will not"],
    ["abadan", "أَبَدًا", "abadan", "never (future)"],
    ["qattu", "قَطُّ", "qattu", "never (past)"],
    ["ghadan", "غَدًا", "ghadan", "tomorrow"],
    ["am-muqbil", "الْعَامُ الْمُقْبِلُ", "al-am al-muqbil", "next year"],
    ["layl", "لَيْلٌ", "layl", "night"],
    ["dawda", "ضَوْضَاءُ", "dawda", "noise"],
    ["wala", "وَلَا", "wala", "nor"],
    ["ya-bunayy", "يَا بُنَيَّ", "ya bunayya", "O my little son"],
    ["marratan-ukhra", "مَرَّةً أُخْرَى", "marratan ukhra", "once again"]
  ],
  "20": [
    ["talibani", "طَالِبَانِ", "talibani", "two students"],
    ["talibayni", "طَالِبَيْنِ", "talibayni", "two students (acc/gen)"],
    ["ghurfatani", "غُرْفَتَانِ", "ghurfatani", "two rooms"],
    ["ghurfatayni", "غُرْفَتَيْنِ", "ghurfatayni", "two rooms (acc/gen)"],
    ["ahaduhuma", "أَحَدُهُمَا", "ahaduhuma", "one of the two (m)"],
    ["ihdahuma", "إِحْدَاهُمَا", "ihdahuma", "one of the two (f)"],
    ["musht", "مُشْطٌ", "musht", "comb"],
    ["mikhaddah", "مِخَدَّةٌ", "mikhaddah", "pillow"],
    ["mirah", "مِرْآةٌ", "mirah", "mirror"],
    ["mufid", "مُفِيدٌ", "mufid", "useful"],
    ["tafsir", "تَفْسِيرٌ", "tafsir", "commentary of the Qur'an"],
    ["liss", "لِصٌّ", "liss", "thief"]
  ],
  "21": [
    ["lam", "لَمْ", "lam", "did not"],
    ["lamma", "لَمَّا", "lamma", "not yet"],
    ["ism", "اِسْمٌ", "ism", "noun"],
    ["fil", "فِعْلٌ", "fil", "verb"],
    ["harf", "حَرْفٌ", "harf", "particle"],
    ["jumlah-ismiyyah", "جُمْلَةٌ اِسْمِيَّةٌ", "jumlah ismiyyah", "nominal sentence"],
    ["jumlah-filiyyah", "جُمْلَةٌ فِعْلِيَّةٌ", "jumlah filiyyah", "verbal sentence"],
    ["mahlan", "مَهْلًا", "mahlan", "slowly please"],
    ["rais", "رَئِيسٌ", "rais", "president"],
    ["farq", "فَرْقٌ", "farq", "difference"],
    ["mamnu", "مَمْنُوعٌ", "mamnu", "forbidden"]
  ],
  "22": [
    ["marfu", "مَرْفُوعٌ", "marfu", "nominative / indicative"],
    ["mansub", "مَنْصُوبٌ", "mansub", "accusative / subjunctive"],
    ["majzum", "مَجْزُومٌ", "majzum", "jussive"],
    ["lan-yadhhaba", "لَنْ يَذْهَبَ", "lan yadhhaba", "he will not go"],
    ["lam-yadhhab", "لَمْ يَذْهَبْ", "lam yadhhab", "he did not go"],
    ["an-yadhhaba", "أَنْ يَذْهَبَ", "an yadhhaba", "to go"],
    ["li-adhhaba", "لِأَذْهَبَ", "li-adhhaba", "so that I go"],
    ["la-tadhhab", "لَا تَذْهَبْ", "la tadhhab", "do not go"]
  ],
  "23": [
    ["mudarrisun", "مُدَرِّسُونَ", "mudarrisun", "teachers"],
    ["mudarrisina", "مُدَرِّسِينَ", "mudarrisina", "teachers (acc/gen)"],
    ["ishrun", "عِشْرُونَ", "ishrun", "twenty"],
    ["ishrin", "عِشْرِينَ", "ishrin", "twenty (acc/gen)"],
    ["ihda-wa-ishrun", "إِحْدَى وَعِشْرُونَ", "ihda wa-ishrun", "twenty-one (f)"],
    ["musliman", "مُسْلِمًا", "musliman", "a Muslim (accusative)"],
    ["ijtima", "اِجْتِمَاعٌ", "ijtima", "meeting"],
    ["imtihan", "اِمْتِحَانٌ", "imtihan", "examination"],
    ["nabiyy", "نَبِيٌّ", "nabiyy", "prophet"],
    ["thaniyah", "ثَانِيَةٌ", "thaniyah", "second"]
  ],
  "24": [
    ["wahid", "وَاحِدٌ", "wahid", "one (m)"],
    ["wahidah", "وَاحِدَةٌ", "wahidah", "one (f)"],
    ["ithnan", "اِثْنَانِ", "ithnan", "two (m)"],
    ["ithnatan", "اِثْنَتَانِ", "ithnatan", "two (f)"],
    ["thalathatu-rijal", "ثَلَاثَةُ رِجَالٍ", "thalathatu rijal", "three men"],
    ["thalathu-nisa", "ثَلَاثُ نِسَاءٍ", "thalathu nisa", "three women"],
    ["miatu-talib", "مِائَةُ طَالِبٍ", "miatu talib", "one hundred students"],
    ["alf-riyal", "أَلْفُ رِيَالٍ", "alf riyal", "one thousand riyals"],
    ["thalathumiah", "ثَلَاثُمِائَةٍ", "thalathumiah", "three hundred"],
    ["sittun", "سِتُّونَ", "sittun", "sixty"]
  ],
  "25": [
    ["kana", "كَانَ", "kana", "was"],
    ["la-yazalu", "لَا يَزَالُ", "la yazalu", "he is still"],
    ["abuka", "أَبُوكَ", "abuka", "your father"],
    ["abaka", "أَبَاكَ", "abaka", "your father (acc)"],
    ["abika", "أَبِيكَ", "abika", "your father (gen)"],
    ["akhuka", "أَخُوكَ", "akhuka", "your brother"],
    ["qablu", "قَبْلُ", "qablu", "before"],
    ["badu", "بَعْدُ", "badu", "after"],
    ["safir", "سَفِيرٌ", "safir", "ambassador"],
    ["shurti", "شُرْطِيٌّ", "shurti", "policeman"],
    ["mutaqaid", "مُتَقَاعِدٌ", "mutaqaid", "retired"]
  ],
  "26": [
    ["mithal", "مِثَالٌ", "mithal", "weak first-radical verb"],
    ["waqafa", "وَقَفَ : يَقِفُ", "waqafa / yaqifu", "to stop / stand"],
    ["wazana", "وَزَنَ : يَزِنُ", "wazana / yazinu", "to weigh"],
    ["wadaa", "وَضَعَ : يَضَعُ", "wadaa / yada'u", "to place"],
    ["da", "ضَعْ", "da", "place"],
    ["zuhayr", "زُهَيْرٌ", "zuhayr", "little flower / name"],
    ["yajibu", "يَجِبُ", "yajibu", "it is necessary"],
    ["nikah", "نِكَاحٌ", "nikah", "marriage"],
    ["ajnabi", "أَجْنَبِيٌّ", "ajnabi", "stranger"],
    ["naqd", "نَقْدٌ", "naqd", "cash"],
    ["khata", "خَطَأٌ", "khata", "mistake"]
  ],
  "27": [
    ["ajwaf", "أَجْوَفُ", "ajwaf", "weak middle-radical verb"],
    ["qala", "قَالَ : يَقُولُ", "qala / yaqulu", "to say"],
    ["zara", "زَارَ : يَزُورُ", "zara / yazuru", "to visit"],
    ["baa", "بَاعَ : يَبِيعُ", "baa / yabiu", "to sell"],
    ["sara", "سَارَ : يَسِيرُ", "sara / yasiru", "to walk"],
    ["nama", "نَامَ : يَنَامُ", "nama / yanamu", "to sleep"],
    ["wallah", "وَاللَّهِ", "wallahi", "by Allah"],
    ["zanna", "ظَنَّ : يَظُنُّ", "zanna / yazunnu", "to think"],
    ["yanbaghi", "يَنْبَغِي", "yanbaghi", "it is proper"],
    ["zayt", "زَيْتٌ", "zayt", "oil"],
    ["mashghul", "مَشْغُولٌ", "mashghul", "busy"]
  ],
  "28": [
    ["naqis", "نَاقِصٌ", "naqis", "weak final-radical verb"],
    ["daa", "دَعَا : يَدْعُو", "daa / yadu", "to invite / call"],
    ["baka", "بَكَى : يَبْكِي", "baka / yabki", "to cry"],
    ["nasiya", "نَسِيَ : يَنْسَى", "nasiya / yansa", "to forget"],
    ["raa", "رَأَى : يَرَى", "raa / yara", "to see"],
    ["ari", "أَرِ", "ari", "show"],
    ["lam-yara", "لَمْ يَرَ", "lam yara", "he did not see"],
    ["qumamah", "قُمَامَةٌ", "qumamah", "garbage"],
    ["nahar", "نَهَارٌ", "nahar", "day"],
    ["yamin", "يَمِينٌ", "yamin", "right hand"],
    ["yasar", "يَسَارٌ", "yasar", "left hand"]
  ],
  "29": [
    ["mudaaf", "مُضَعَّفٌ", "mudaaf", "doubled verb"],
    ["hajja", "حَجَّ : يَحُجُّ", "hajja / yahujju", "to perform Hajj"],
    ["shamma", "شَمَّ : يَشَمُّ", "shamma / yashammu", "to smell"],
    ["marra", "مَرَّ : يَمُرُّ", "marra / yamurru", "to pass"],
    ["lamma-when", "لَمَّا", "lamma", "when"],
    ["qattu", "قَطُّ", "qattu", "never (past)"],
    ["abadan", "أَبَدًا", "abadan", "never (future)"],
    ["la-shukra", "لَا شُكْرَ عَلَى وَاجِبٍ", "la shukra ala wajib", "no thanks for a duty"],
    ["raihah", "رَائِحَةٌ", "raihah", "smell"],
    ["nuskhah", "نُسْخَةٌ", "nuskhah", "copy"],
    ["baluah", "بَالُوعَةٌ", "baluah", "drain"]
  ],
  "30": [
    ["dhahaba-dual", "ذَهَبَا", "dhahaba", "they two went (m)"],
    ["dhahabata", "ذَهَبَتَا", "dhahabata", "they two went (f)"],
    ["dhahabtuma", "ذَهَبْتُمَا", "dhahabtuma", "you two went"],
    ["yadhhabani", "يَذْهَبَانِ", "yadhhabani", "they two go"],
    ["tadhhabani", "تَذْهَبَانِ", "tadhhabani", "they/you two go"],
    ["idhhaba", "اِذْهَبَا", "idhhaba", "go, you two"],
    ["huma", "هُمَا", "huma", "they two"],
    ["antuma", "أَنْتُمَا", "antuma", "you two"],
    ["raaytuhuma", "رَأَيْتُهُمَا", "raaytuhuma", "I saw them both"],
    ["tawaman", "تَوْءَمَانِ", "tawaman", "twins"],
    ["iyadah", "عِيَادَةٌ", "iyadah", "visiting the sick"]
  ],
  "31": [
    ["nat", "نَعْتٌ", "nat", "adjective"],
    ["manut", "مَنْعُوتٌ", "manut", "described noun"],
    ["jadid", "جَدِيدٌ", "jadid", "new"],
    ["jadidah", "جَدِيدَةٌ", "jadidah", "new (f)"],
    ["kabir", "كَبِيرٌ", "kabir", "big"],
    ["saghirah", "صَغِيرَةٌ", "saghirah", "small (f)"],
    ["wasit", "وَسِيطٌ", "wasit", "medium"],
    ["mujam", "مُعْجَمٌ", "mujam", "dictionary"],
    ["intaha", "اِنْتَهَى : يَنْتَهِي", "intaha / yantahi", "to end"],
    ["hayy", "حَيٌّ", "hayy", "city district"]
  ]
};

const book2VocabularyDrafts = Object.entries(book2VocabularyByLesson).flatMap(([lessonNumber, words]) =>
  words.map(([key, arabic, transliteration, english]) => [
    `v2-l${lessonNumber}-${key}`,
    arabic,
    transliteration,
    english,
    lessonNumber
  ])
);

const book3LessonDrafts = [
  [
    "1",
    "I'rab of Nouns and Verb Moods",
    "Declension of nouns, primary and secondary endings, mabni nouns, and the marfu, mansub and majzum moods of the mudari'.",
    "دَخَلَ الْمُدَرِّسُ الْفَصْلَ.",
    "The teacher entered the classroom.",
    [
      "Most nouns show their role through case endings: raf', nasb, and jarr.",
      "Some noun groups use secondary endings, such as the dual and sound masculine plural.",
      "The mudari' also changes mood: marfu', mansub, or majzum."
    ],
    "Which case is used for a direct object?",
    "الْفَصْلَ",
    "accusative",
    ["accusative", "genitive", "jussive"]
  ],
  [
    "2",
    "Waw, Extra Min and Wish Meanings",
    "Uses of waw, لَعَلَّ for hope or fear, the extra مِنْ, لَدَى, and selected plural patterns.",
    "جَاءَ حَامِدٌ وَالْكِتَابُ فِي يَدِهِ.",
    "Hamid came while the book was in his hand.",
    [
      "وَ can join words, function as a preposition, or introduce a circumstantial clause.",
      "لَعَلَّ can express hope or fear according to context.",
      "The extra مِنْ strengthens a negative, prohibitive, or هل question."
    ],
    "What does waw al-hal introduce?",
    "وَالْكِتَابُ فِي يَدِهِ",
    "a circumstantial clause",
    ["a circumstantial clause", "a dual noun", "a passive verb"]
  ],
  [
    "3",
    "Passive Voice and Na'ib Al-Fa'il",
    "Passive voice in the madi and mudari', the نائب الفاعل, time adverbs, nisbah adjectives, and collective nouns.",
    "كُتِبَ الدَّرْسُ عَلَى السَّبُّورَةِ.",
    "The lesson was written on the board.",
    [
      "In the passive voice, the doer is omitted.",
      "The object can take the place of the subject and becomes نائب الفاعل.",
      "The passive has distinct vowel patterns in the madi and mudari'."
    ],
    "What is the نائب الفاعل in the model sentence?",
    "الدَّرْسُ",
    "الدَّرْسُ",
    ["الدَّرْسُ", "عَلَى", "السَّبُّورَةِ"]
  ],
  [
    "4",
    "Active and Passive Participles",
    "Forming اسم الفاعل and اسم المفعول from sound verbs and reading them as descriptive nouns.",
    "الطَّالِبُ كَاتِبٌ، وَالدَّرْسُ مَكْتُوبٌ.",
    "The student is writing, and the lesson is written.",
    [
      "اسم الفاعل names the doer of an action.",
      "اسم المفعول names the one or thing affected by an action.",
      "These forms behave like nouns and adjectives in sentences."
    ],
    "Which form names the one affected by the action?",
    "مَكْتُوبٌ",
    "اسم المفعول",
    ["اسم المفعول", "اسم الفاعل", "ظرف"]
  ],
  [
    "5",
    "Passive Ajwaf Verbs",
    "Passive forms of hollow verbs such as قَالَ and بَاعَ, and their mudari' forms.",
    "قِيلَ إِنَّ الْبَابَ مُغْلَقٌ.",
    "It was said that the door is closed.",
    [
      "Ajwaf verbs have a weak middle radical.",
      "Their passive forms often show a long vowel change.",
      "Common examples include قِيلَ and بِيعَ."
    ],
    "What kind of verb is قَالَ?",
    "قَالَ",
    "ajwaf",
    ["ajwaf", "sound feminine plural", "diptote"]
  ],
  [
    "6",
    "Nouns of Place and Time",
    "Forming اسم المكان and اسم الزمان on مَفْعَل and مَفْعِل patterns.",
    "الْمَكْتَبُ مَكَانُ الْكِتَابَةِ.",
    "The office is a place of writing.",
    [
      "The noun of place and time can share the same form.",
      "The pattern depends on the verb type and mudari' vowel.",
      "Words such as مَكْتَبٌ and مَجْلِسٌ are common examples."
    ],
    "What does اسم المكان usually indicate?",
    "مَكَانُ الْكِتَابَةِ",
    "place",
    ["place", "negation", "exception"]
  ],
  [
    "7",
    "Noun of Instrument",
    "Forming اسم الآلة on patterns such as مِفْعَال, مِفْعَل and مِفْعَلَة.",
    "هٰذَا مِفْتَاحٌ لِلْبَابِ.",
    "This is a key for the door.",
    [
      "اسم الآلة names the instrument used for an action.",
      "Common patterns include مِفْعَالٌ, مِفْعَلٌ and مِفْعَلَةٌ.",
      "Instrument nouns are regular nouns and take normal case endings."
    ],
    "Which word is an instrument noun?",
    "مِفْتَاحٌ",
    "مِفْتَاحٌ",
    ["مِفْتَاحٌ", "الْبَابِ", "هٰذَا"]
  ],
  [
    "8",
    "Ma'rifah and Nakirah",
    "Definite and indefinite nouns, categories of definite nouns, and how definiteness affects meaning.",
    "جَاءَ رَجُلٌ، فَسَأَلْتُ الرَّجُلَ.",
    "A man came, so I asked the man.",
    [
      "A nakirah noun is indefinite.",
      "A ma'rifah noun is definite, often through الْـ, a pronoun, a proper noun, or idafah.",
      "A noun may become definite after it has already been mentioned."
    ],
    "Which noun is definite in the model sentence?",
    "الرَّجُلَ",
    "الرَّجُلَ",
    ["الرَّجُلَ", "رَجُلٌ", "جَاءَ"]
  ],
  [
    "9",
    "Omitting Nun in Idafah",
    "The dual and sound masculine plural omit their nun when they become mudaf.",
    "هٰذَانِ طَالِبَا الْمَدْرَسَةِ.",
    "These are the two students of the school.",
    [
      "The dual ending loses its nun in idafah.",
      "The sound masculine plural also loses its nun when it is mudaf.",
      "The remaining ending still shows the case of the noun."
    ],
    "What happens to the nun in طَالِبَانِ when it becomes mudaf?",
    "طَالِبَا الْمَدْرَسَةِ",
    "it is omitted",
    ["it is omitted", "it doubles", "it becomes tanwin"]
  ],
  [
    "10",
    "Sentence Types and Masdar Mu'awwal",
    "Nominal and verbal sentences, sentence beginnings, and clauses functioning as masdars.",
    "أَنْ تَدْرُسَ الْعَرَبِيَّةَ نَافِعٌ لَكَ.",
    "Studying Arabic is useful for you.",
    [
      "Arabic sentences are broadly nominal or verbal.",
      "A masdar mu'awwal can act like a noun in a sentence.",
      "A clause beginning with أَنْ plus mudari' can function as a verbal noun."
    ],
    "What is أَنْ تَدْرُسَ functioning as?",
    "أَنْ تَدْرُسَ",
    "a masdar-like noun phrase",
    ["a masdar-like noun phrase", "a diptote", "an instrument noun"]
  ],
  [
    "11",
    "The Nominal Sentence",
    "Types of mubtada' and khabar, when the mubtada' can be indefinite, and khabar structures.",
    "الْقِرَاءَةُ مُفِيدَةٌ.",
    "Reading is useful.",
    [
      "The mubtada' is the topic of a nominal sentence.",
      "The khabar gives information about the mubtada'.",
      "Both are normally marfu', though the khabar can be a phrase or sentence."
    ],
    "What is مُفِيدَةٌ in the model sentence?",
    "مُفِيدَةٌ",
    "khabar",
    ["khabar", "maf'ul mutlaq", "mustathna"]
  ],
  [
    "12",
    "Zarf and Maf'ul Fihi",
    "Adverbs of time and place, mabni zuruf, and words functioning as ظرف.",
    "سَافَرْتُ لَيْلًا.",
    "I travelled at night.",
    [
      "A zarf gives the time or place of an action.",
      "The zarf is usually mansub.",
      "Some zuruf are mabni and keep a fixed ending."
    ],
    "What kind of word is لَيْلًا here?",
    "لَيْلًا",
    "zarf of time",
    ["zarf of time", "passive participle", "noun of instrument"]
  ],
  [
    "13",
    "Lam Al-Amr",
    "The jussive command for third person and first person plural using لام الأمر.",
    "لِيَكْتُبْ كُلُّ طَالِبٍ اسْمَهُ.",
    "Let every student write his name.",
    [
      "لام الأمر is used with the mudari' majzum.",
      "It can command or request from the third person.",
      "It can also be used with the first person plural, meaning 'let us'."
    ],
    "What mood follows لام الأمر?",
    "لِيَكْتُبْ",
    "majzum",
    ["majzum", "genitive", "dual"]
  ],
  [
    "14",
    "Idha and Conditional Meaning",
    "Using إِذَا with conditional meaning and recognizing the jawab al-shart.",
    "إِذَا دَخَلَ الْمُدَرِّسُ فَاسْتَمِعْ.",
    "When the teacher enters, listen.",
    [
      "إِذَا often introduces a future condition even when the verb is madi.",
      "The condition has two parts: shart and jawab al-shart.",
      "The answer may be introduced by فَ according to the structure."
    ],
    "What does إِذَا introduce here?",
    "إِذَا دَخَلَ",
    "a condition",
    ["a condition", "a passive participle", "a diptote"]
  ],
  [
    "15",
    "Jazim Conditional Particles",
    "إِنْ and its sisters, two jussive verbs in conditional constructions, and related diminutive review.",
    "إِنْ تَجْتَهِدْ تَنْجَحْ.",
    "If you work hard, you will succeed.",
    [
      "Some conditional particles make both the shart and jawab verbs majzum.",
      "إِنْ means 'if' and is a common jazim particle.",
      "Particles such as مَنْ and مَا can introduce similar conditional structures."
    ],
    "How many verbs are majzum after إِنْ in the model?",
    "تَجْتَهِدْ، تَنْجَحْ",
    "two",
    ["two", "none", "only the first noun"]
  ],
  [
    "16",
    "Thulathi, Ruba'i and Bab Fa''ala",
    "Root length, mujarrad and mazid verbs, and the doubled second-radical form فَعَّلَ.",
    "دَرَّسَ الْمُدَرِّسُ الدَّرْسَ.",
    "The teacher taught the lesson.",
    [
      "A thulathi verb has three radicals.",
      "A ruba'i verb has four radicals.",
      "Bab فَعَّلَ doubles the second radical and often intensifies or makes a verb transitive."
    ],
    "Which radical is doubled in فَعَّلَ?",
    "دَرَّسَ",
    "the second radical",
    ["the second radical", "the final weak letter", "the tanwin"]
  ],
  [
    "17",
    "Bab Af'ala",
    "The form أَفْعَلَ, its mudari', masdar, active/passive participles, and related non-salim forms.",
    "أَنْزَلَ الْوَلَدُ الْكِتَابَ.",
    "The boy brought the book down.",
    [
      "Bab أَفْعَلَ prefixes hamzah to the first radical.",
      "Its mudari' begins with a dammah on the mudari' prefix.",
      "Its masdar often follows the pattern إِفْعَالٌ."
    ],
    "What extra letter begins باب أَفْعَلَ?",
    "أَنْزَلَ",
    "hamzah",
    ["hamzah", "nun of emphasis", "tanwin"]
  ],
  [
    "18",
    "Transitive and Intransitive Verbs",
    "الفعل المتعدي واللازم, indirect objects, and making verbs transitive through فَعَّلَ or أَفْعَلَ.",
    "جَلَسَ الطَّالِبُ، وَأَجْلَسَ الْمُدَرِّسُ الطِّفْلَ.",
    "The student sat, and the teacher seated the child.",
    [
      "A transitive verb takes a direct object.",
      "An intransitive verb does not take a direct object without help.",
      "Arabic can make some verbs transitive by changing the verb form."
    ],
    "Which verb is transitive in the model sentence?",
    "أَجْلَسَ",
    "أَجْلَسَ",
    ["أَجْلَسَ", "جَلَسَ", "الطَّالِبُ"]
  ],
  [
    "19",
    "Bab Fa'ala and Qad",
    "The form فَاعَلَ, its masdar, participles, place/time noun, the shifted lam, قَدْ, and ذَوُو.",
    "سَاعَدَ الطَّالِبُ زَمِيلَهُ.",
    "The student helped his classmate.",
    [
      "Bab فَاعَلَ adds an alif after the first radical.",
      "Its masdar can appear on مُفَاعَلَةٌ.",
      "قَدْ can add emphasis with madi or possibility with mudari'."
    ],
    "Which form is represented by سَاعَدَ?",
    "فَاعَلَ",
    "فَاعَلَ",
    ["فَاعَلَ", "اِنْفَعَلَ", "اِفْعَلَّ"]
  ],
  [
    "20",
    "Bab Tafa''ala",
    "The form تَفَعَّلَ, its masdar, participles, mutawa'ah, لَمَّا as 'when', and الاختصاص.",
    "تَعَلَّمَ الطَّالِبُ النَّحْوَ.",
    "The student learned grammar.",
    [
      "Bab تَفَعَّلَ begins with تَ and doubles the second radical.",
      "It can express receiving or undergoing an action.",
      "لَمَّا can mean 'when' with a past-tense verb."
    ],
    "Which form is تَعَلَّمَ?",
    "تَفَعَّلَ",
    "تَفَعَّلَ",
    ["تَفَعَّلَ", "فَاعَلَ", "اِفْتَعَلَ"]
  ],
  [
    "21",
    "Bab Tafa'ala and La of Genus",
    "The form تَفَاعَلَ, reciprocal meanings, لَيْتَ, and لا النافية للجنس.",
    "تَعَاوَنَ الطُّلَّابُ فِي الدَّرْسِ.",
    "The students cooperated in the lesson.",
    [
      "Bab تَفَاعَلَ often expresses reciprocal action.",
      "لَيْتَ expresses a wish.",
      "لا النافية للجنس negates an entire class or genus."
    ],
    "What meaning does تَعَاوَنَ often show?",
    "تَعَاوَنَ",
    "reciprocal action",
    ["reciprocal action", "diptote case", "absolute object"]
  ],
  [
    "22",
    "Bab Infa'ala and Lawla",
    "The form اِنْفَعَلَ, mutawa'ah, hamzat al-wasl, and لَوْلَا conditional meaning.",
    "اِنْكَسَرَ الْقَلَمُ.",
    "The pen broke.",
    [
      "Bab اِنْفَعَلَ is usually intransitive.",
      "It often expresses the result of another action.",
      "لَوْلَا can mean 'if not for' or 'but for'."
    ],
    "Which form is اِنْكَسَرَ?",
    "اِنْفَعَلَ",
    "اِنْفَعَلَ",
    ["اِنْفَعَلَ", "تَفَاعَلَ", "مَفْعَلَةٌ"]
  ],
  [
    "23",
    "Bab Ifta'ala and Idha of Surprise",
    "The form اِفْتَعَلَ, assimilation of the extra ت, إِذَا الفجائية, and ظَنَّ with two objects.",
    "اِنْتَظَرَ الطَّالِبُ الْمُدَرِّسَ.",
    "The student waited for the teacher.",
    [
      "Bab اِفْتَعَلَ adds an extra ت after the first radical.",
      "That ت can change or assimilate with some first radicals.",
      "ظَنَّ can take two objects originally related as mubtada' and khabar."
    ],
    "What extra letter appears in باب اِفْتَعَلَ?",
    "اِنْتَظَرَ",
    "ت",
    ["ت", "و", "ة"]
  ],
  [
    "24",
    "Bab If'alla, Ra'a and 'Asa",
    "The colour/defect form اِفْعَلَّ, رَأَى meaning see or think, عَسَى, and infinitive ما.",
    "اِحْمَرَّ الْوَجْهُ.",
    "The face became red.",
    [
      "Bab اِفْعَلَّ is used mainly for colours and defects.",
      "رَأَى can mean physical seeing or thinking.",
      "عَسَى can work as an incomplete or complete verb."
    ],
    "For what meanings is باب اِفْعَلَّ mainly used?",
    "اِحْمَرَّ",
    "colours and defects",
    ["colours and defects", "instrument nouns", "dual idafah only"]
  ],
  [
    "25",
    "Bab Istaf'ala, Kay and Idhan",
    "The form اِسْتَفْعَلَ, seeking meanings, كَيْ, لِكَيْلَا, إِذَنْ, and negating the madi.",
    "اِسْتَأْذَنَ الطَّالِبُ.",
    "The student asked permission.",
    [
      "Bab اِسْتَفْعَلَ often means seeking or asking for something.",
      "كَيْ makes the following mudari' mansub and expresses purpose.",
      "إِذَنْ can make a future mudari' mansub in reply to a statement."
    ],
    "What common meaning does اِسْتَفْعَلَ carry?",
    "اِسْتَأْذَنَ",
    "seeking",
    ["seeking", "passive voice", "exception"]
  ],
  [
    "26",
    "Ruba'i Verbs and Damir Al-Fasl",
    "Quadriliteral mujarrad/mazid verbs, ضمير الفصل, and the partitive مِنْ.",
    "هٰذَا هُوَ الرَّجُلُ.",
    "This is the man.",
    [
      "Ruba'i verbs have four radicals.",
      "ضمير الفصل can remove ambiguity between a phrase and a full sentence.",
      "مِنْ التبعيضية indicates part of a whole."
    ],
    "What is هُوَ doing in the model sentence?",
    "هُوَ",
    "differentiating pronoun",
    ["differentiating pronoun", "object of place", "nun of emphasis"]
  ],
  [
    "27",
    "Separate and Attached Pronouns",
    "Pronouns of raf', nasb and jarr, separate forms such as إِيَّاكَ, and attached pronoun use.",
    "إِيَّاكَ أَسْأَلُ.",
    "It is you that I ask.",
    [
      "Pronouns can be separate or attached.",
      "Separate nasb pronouns are built with إِيَّا plus attached endings.",
      "Attached pronouns of jarr follow prepositions and idafah."
    ],
    "Which word is a separate nasb pronoun?",
    "إِيَّاكَ",
    "إِيَّاكَ",
    ["إِيَّاكَ", "أَسْأَلُ", "كَانَ"]
  ],
  [
    "28",
    "Maf'ul Mutlaq",
    "The absolute object, masdar emphasis, number, kind, substitutes for the masdar, and cognate masdars.",
    "فَهِمْتُ الدَّرْسَ فَهْمًا.",
    "I understood the lesson with clear understanding.",
    [
      "The maf'ul mutlaq is usually a masdar from the same verb.",
      "It can emphasize, count, or describe the action.",
      "Some words deputize for the masdar and take the same role."
    ],
    "What is فَهْمًا in the model sentence?",
    "فَهْمًا",
    "maf'ul mutlaq",
    ["maf'ul mutlaq", "zarf of place", "diptote"]
  ],
  [
    "29",
    "Maf'ul Lahu",
    "The object of reason, masdars of motive, هَلَّا for urging/rebuke, and لا as a conjunction.",
    "حَضَرْتُ رَغْبَةً فِي الْعِلْمِ.",
    "I attended out of desire for knowledge.",
    [
      "The maf'ul lahu gives the reason for an action.",
      "It is usually a masdar denoting an inner motive.",
      "هَلَّا can urge action with mudari' or rebuke neglect with madi."
    ],
    "What does رَغْبَةً explain?",
    "رَغْبَةً فِي الْعِلْمِ",
    "the reason for the action",
    ["the reason for the action", "a colour defect", "an attached pronoun"]
  ],
  [
    "30",
    "Tamyiz",
    "Tamyiz of quantity and sentence, number review, masdar pattern فُعْل, and the second wonder form.",
    "اِشْتَرَيْتُ لِتْرًا حَلِيبًا.",
    "I bought a litre of milk.",
    [
      "Tamyiz clarifies a vague quantity or sentence meaning.",
      "It is usually mansub.",
      "After many quantity words, tamyiz names what the quantity refers to."
    ],
    "What is حَلِيبًا in the model sentence?",
    "حَلِيبًا",
    "tamyiz",
    ["tamyiz", "khabar", "nun of emphasis"]
  ],
  [
    "31",
    "Hal",
    "The circumstantial accusative, صاحب الحال, sentence hal, connectors, and agreement.",
    "رَجَعَ الطُّلَّابُ فَرِحِينَ.",
    "The students returned happy.",
    [
      "The hal describes the state of the sahib al-hal during the action.",
      "The hal is mansub.",
      "It may be a single word or a sentence connected by a pronoun, waw, or both."
    ],
    "What does فَرِحِينَ describe?",
    "فَرِحِينَ",
    "the state of the students",
    ["the state of the students", "the instrument of writing", "a diptote reason"]
  ],
  [
    "32",
    "Istithna'",
    "Exception with إِلَّا and related tools, connected/disconnected exception, and i'rab of the mustathna.",
    "نَجَحَ الطُّلَّابُ إِلَّا حَامِدًا.",
    "The students succeeded except Hamid.",
    [
      "Istithna' has a mustathna, mustathna minhu, and a tool of exception.",
      "إِلَّا is the most common exception tool.",
      "The case of the mustathna depends on the kind of exception and sentence."
    ],
    "Which word is the exception tool?",
    "إِلَّا",
    "إِلَّا",
    ["إِلَّا", "نَجَحَ", "الطُّلَّابُ"]
  ],
  [
    "33",
    "Nun of Emphasis",
    "نُون التوكيد الثقيلة والخفيفة with the mudari' and imperative.",
    "لَا تَخْرُجَنَّ قَبْلَ السَّاعَةِ.",
    "Do not leave before the hour.",
    [
      "Nun of emphasis is used with the mudari' and imperative.",
      "The heavy form has a doubled nun.",
      "Suffixing it changes endings in several verb forms."
    ],
    "Which ending shows heavy nun of emphasis?",
    "تَخْرُجَنَّ",
    "نَّ",
    ["نَّ", "ات", "ون"]
  ],
  [
    "34",
    "Diptotes Review",
    "ممنوع من الصرف, one-reason and two-reason diptotes, proper nouns, adjectives, and ultimate plural patterns.",
    "ذَهَبْتُ إِلَى مَدَارِسَ كَثِيرَةٍ.",
    "I went to many schools.",
    [
      "A diptote does not take tanwin.",
      "Many diptotes take fathah in the genitive when they are indefinite and without الْـ.",
      "Common diptote groups include some proper nouns, colour adjectives, and ultimate plural patterns."
    ],
    "What is special about مَدَارِسَ in the model sentence?",
    "مَدَارِسَ",
    "it is a diptote",
    ["it is a diptote", "it is an instrument noun", "it is a passive verb"]
  ]
].map(([n, title, focus, arabic, translation, notes, prompt, quizArabic, answer, options]) => ({
  n,
  title,
  focus,
  arabic,
  translation,
  notes,
  quiz: { prompt, arabic: quizArabic, answer, options }
}));

const book3VocabularyByLesson = {
  "1": [
    ["taghayyara", "تَغَيَّرَ يَتَغَيَّرُ", "to change"],
    ["zahara", "ظَهَرَ يَظْهَرُ", "to appear"],
    ["mayyaza", "مَيَّزَ يُمَيِّزُ", "to distinguish"],
    ["bashara", "بَاشَرَ يُبَاشِرُ", "to be directly attached"],
    ["nuhat", "نُحَاةٌ", "grammarians"],
    ["fiah", "فِئَةٌ", "group / class"],
    ["muhamin", "مُحَامٍ", "lawyer"],
    ["janin", "جَانٍ", "criminal / offender"],
    ["mutlaqan", "مُطْلَقًا", "absolutely"],
    ["ma-ada", "مَا عَدَا", "except"],
    ["aqrab", "أَقْرَبُ", "relative / closer"],
    ["afa", "أَفْعَى", "viper"],
    ["hadhafa", "حَذَفَ يَحْذِفُ", "to omit"],
    ["harr", "حَرٌّ", "heat"],
    ["jarih", "جَرِيحٌ", "wounded person"],
    ["ittasala", "اتَّصَلَ يَتَّصِلُ", "to contact / be attached"],
    ["thabata", "ثَبَتَ يَثْبُتُ", "to remain / stay"],
    ["sinn", "سِنٌّ", "tooth / age"]
  ],
  "2": [
    ["akbar-sinnan", "أَكْبَرُ سِنًّا", "older"],
    ["hinaidhin", "حِينَئِذٍ", "at that time"],
    ["taybah", "طَيْبَةُ", "Taybah, another name for Madinah"],
    ["hadith-muttafaq", "حَدِيثٌ مُتَّفَقٌ عَلَيْهِ", "agreed-upon hadith"],
    ["qasam", "قَسَمٌ", "oath"],
    ["umrah", "عُمْرَةٌ", "Umrah"],
    ["hizb", "حِزْبٌ", "group / party"],
    ["farih", "فَرِحٌ", "happy"],
    ["nashrat-al-akhbar", "نَشْرَةُ الْأَخْبَارِ", "news bulletin"],
    ["wada", "وَدَاعٌ", "farewell"],
    ["talaa", "طَلَعَ يَطْلُعُ", "to rise"],
    ["gharaba", "غَرَبَ يَغْرُبُ", "to set"],
    ["nataqa", "نَطَقَ يَنْطِقُ", "to pronounce / speak"],
    ["taqabbala", "تَقَبَّلَ يَتَقَبَّلُ", "to accept"],
    ["aqama", "أَقَامَ يُقِيمُ", "to establish"],
    ["hamala", "حَمَلَ يَحْمِلُ", "to carry"],
    ["shaa", "شَاءَ يَشَاءُ", "to wish / want"],
    ["sharaha", "شَرَحَ يَشْرَحُ", "to explain"],
    ["mana", "مَعْنًى", "meaning"],
    ["hal", "حَالٌ", "state / circumstance"]
  ],
  "3": [
    ["rasib", "رَاسِبٌ", "one who has failed"],
    ["al-barihah", "الْبَارِحَةَ", "last night"],
    ["qaidah", "قَاعِدَةٌ", "rule"],
    ["malabis", "مَلَابِسُ", "clothes"],
    ["hidha", "حِذَاءٌ", "shoe"],
    ["muazam-al-kutub", "مُعْظَمُ الْكُتُبِ", "most of the books"],
    ["siwar", "سِوَارٌ", "bracelet"],
    ["tadhkirah", "تَذْكِرَةٌ", "ticket"],
    ["jadwal", "جَدْوَلٌ", "table / schedule"],
    ["mawudah", "مَوْءُودَةٌ", "buried-alive girl"],
    ["dhanb", "ذَنْبٌ", "sin / offence"],
    ["musaddas", "مُسَدَّسٌ", "pistol"],
    ["shahinah", "شَاحِنَةٌ", "truck"],
    ["tamr", "تَمْرٌ", "dates"],
    ["jundi", "جُنْدِيٌّ", "soldier"],
    ["jasus", "جَاسُوسٌ", "spy"],
    ["harb", "حَرْبٌ", "war"],
    ["wuduh", "وُضُوحٌ", "clarity"],
    ["wadih", "وَاضِحٌ", "clear"],
    ["muhimm", "مُهِمٌّ", "important"]
  ],
  "4": [
    ["al-kufah", "الْكُوفَةُ", "Kufah"],
    ["natijah", "نَتِيجَةٌ", "result"],
    ["qufl", "قُفْلٌ", "lock"],
    ["nasikh", "نَاسِخٌ", "typist"],
    ["ghafil", "غَافِلٌ", "heedless"],
    ["jayyid", "جَيِّدٌ", "good"],
    ["yatim", "يَتِيمٌ", "orphan"],
    ["majusi", "مَجُوسِيٌّ", "Zoroastrian"],
    ["fatih", "فَاتِحٌ", "conqueror"],
    ["al-andalus", "الْأَنْدَلُسُ", "al-Andalus"],
    ["jaza", "جَزَاءٌ", "recompense"],
    ["jihah", "جِهَةٌ", "side / direction"],
    ["mankib", "مَنْكِبٌ", "shoulder"],
    ["gharib", "غَرِيبٌ", "stranger"],
    ["jamr", "جَمْرٌ", "live coal"],
    ["mujam", "مُعْجَمٌ", "dictionary"],
    ["sariqah", "سَرِقَةٌ", "theft"],
    ["kafala", "كَفَلَ يَكْفُلُ", "to sponsor"]
  ],
  "5": [
    ["rasaba", "رَسَبَ يَرْسُبُ", "to fail"],
    ["samaha", "سَمَحَ يَسْمَحُ", "to permit"],
    ["waqaa", "وَقَعَ يَقَعُ", "to fall / happen"],
    ["ashara", "أَشَارَ يُشِيرُ", "to point / indicate"],
    ["ishtaqqa", "اِشْتَقَّ يَشْتَقُّ", "to derive"],
    ["sagha", "صَاغَ يَصُوغُ", "to form / coin"],
    ["sighah", "صِيغَةٌ", "form"],
    ["ishtara", "اِشْتَرَى يَشْتَرِي", "to buy"],
    ["zann", "ظَنٌّ", "thought / supposition"],
    ["zaman", "زَمَانٌ", "time"],
    ["shahri", "شَهْرِيٌّ", "monthly"],
    ["athna", "أَثْنَاءَ", "during"],
    ["taah", "طَاعَةٌ", "obedience"],
    ["masiyah", "مَعْصِيَةٌ", "disobedience"],
    ["muhadir", "مُحَاضِرٌ", "lecturer"],
    ["mahad", "مَعْهَدٌ", "institute"],
    ["fursah", "فُرْصَةٌ", "opportunity"],
    ["manhaj", "مَنْهَجٌ", "method / curriculum"],
    ["bitaqah", "بِطَاقَةٌ", "card"],
    ["majjanan", "مَجَّانًا", "free of charge"]
  ],
  "6": [
    ["shabb", "شَابٌّ", "young man"],
    ["zair", "زَائِرٌ", "visitor"],
    ["muddah", "مُدَّةٌ", "period of time"],
    ["tahiyyah", "تَحِيَّةٌ", "greeting"],
    ["mushtarik", "مُشْتَرِكٌ", "participant"],
    ["rihlah", "رِحْلَةٌ", "journey / trip"],
    ["masrif", "مَصْرِفٌ", "bank"],
    ["mustaid", "مُسْتَعِدٌّ", "ready"],
    ["mawqif-as-sayyarat", "مَوْقِفُ السَّيَّارَاتِ", "car park"],
    ["qitar", "قِطَارٌ", "train"],
    ["mahattat-al-qitar", "مَحَطَّةُ الْقِطَارِ", "train station"],
    ["ziham", "الزِّحَامُ", "crowding"],
    ["laha", "لَهَا يَلْهُو", "to amuse oneself"],
    ["lajaa", "لَجَأَ", "to take refuge"],
    ["nada", "نَادَى يُنَادِي", "to call"],
    ["tafa", "طَافَ يَطُوفُ", "to go round"],
    ["saa", "سَعَى يَسْعَى", "to walk / strive"],
    ["nafa", "نَفَى يَنْفِي", "to banish / deny"],
    ["arada", "عَرَضَ يَعْرِضُ", "to display"],
    ["maqarr", "مَقَرٌّ", "headquarters / residence"]
  ],
  "7": [
    ["talabah", "طَلَبَةٌ", "students"],
    ["taban", "طَبْعًا", "of course"],
    ["qamh", "قَمْحٌ", "wheat"],
    ["adas", "عَدَسٌ", "lentils"],
    ["mikhlab", "مِخْلَبٌ", "claw"],
    ["tiraz", "طِرَازٌ", "model / style"],
    ["ajwad", "أَجْوَدُ", "better quality"],
    ["mutaffif", "مُطَفِّفٌ", "one who gives short measure"],
    ["burr", "بُرٌّ", "wheat"],
    ["alah", "آلَةٌ", "tool / machine"],
    ["dhib", "ذِئْبٌ", "wolf"],
    ["namir", "نَمِرٌ", "tiger / leopard"],
    ["wayl", "وَيْلٌ", "woe"],
    ["waddaa", "وَدَّعَ يُوَدِّعُ", "to say goodbye"],
    ["wada", "وَدَاعٌ", "farewell"],
    ["mibrah", "مِبْرَاةٌ", "pencil sharpener"],
    ["miqlah", "مِقْلَاةٌ", "frying pan"],
    ["mitraqah", "مِطْرَقَةٌ", "hammer"],
    ["miqyas", "مِقْيَاسٌ", "measuring instrument"],
    ["wasitah", "وَاسِطَةٌ", "means / medium"]
  ],
  "8": [
    ["hibr", "حِبْرٌ", "ink"],
    ["qalam-hibr", "قَلَمُ حِبْرٍ", "fountain pen"],
    ["rasas", "رَصَاصٌ", "lead"],
    ["qalam-rasas", "قَلَمُ رَصَاصٍ", "pencil"],
    ["jaff", "جَافٌّ", "dry"],
    ["qalam-jaff", "قَلَمٌ جَافٌّ", "ball-point pen"],
    ["kharitah", "خَرِيطَةٌ", "map"],
    ["waraq-musattar", "وَرَقٌ مُسَطَّرٌ", "ruled paper"],
    ["al-alam-al-islami", "الْعَالَمُ الْإِسْلَامِيُّ", "the Islamic world"],
    ["kis", "كِيسٌ", "bag"],
    ["qimah", "قِيمَةٌ", "value / price"],
    ["hadiyyah", "هَدِيَّةٌ", "gift"],
    ["lawhah", "لَوْحَةٌ", "board / sign"],
    ["naw", "نَوْعٌ", "kind / type"],
    ["qism", "قِسْمٌ", "department / section"],
    ["mushtarin", "مُشْتَرٍ", "buyer"],
    ["ghilaf", "غِلَافٌ", "cover"],
    ["lisan", "لِسَانٌ", "tongue / language"],
    ["muayyan", "مُعَيَّنٌ", "specified"],
    ["didd", "ضِدٌّ", "opposite"]
  ],
  "9": [
    ["alin", "عَالٍ", "high / loud"],
    ["bisawt-alin", "بِصَوْتٍ عَالٍ", "loudly"],
    ["muqaddas", "مُقَدَّسٌ", "sacred"],
    ["ishal", "إِسْهَالٌ", "diarrhea"],
    ["hissah", "حِصَّةٌ", "class period / share"],
    ["ijtima", "اِجْتِمَاعٌ", "meeting"],
    ["arikah", "أَرِيكَةٌ", "sofa"],
    ["nal", "نَعْلٌ", "sandal"],
    ["ajir", "أَجِيرٌ", "labourer"],
    ["umlah", "عُمْلَةٌ", "currency"],
    ["dawlah", "دَوْلَةٌ", "state / country"],
    ["mablagh", "مَبْلَغٌ", "amount"],
    ["nuskhah", "نُسْخَةٌ", "copy"],
    ["raqm", "رَقْمٌ", "number"],
    ["muraah", "مُرَاعَاةٌ", "consideration / observance"],
    ["lahab", "لَهَبٌ", "flame"],
    ["ghammada", "غَمَّضَ عَيْنَيْهِ", "to close his eyes"],
    ["khalaa", "خَلَعَ النَّعْلَيْنِ", "to take off the sandals"],
    ["sahaba", "سَحَبَ", "to withdraw / pull"],
    ["daa", "ضَاعَ يَضِيعُ", "to be lost"]
  ],
  "10": [
    ["rafaa", "رَفَعَ", "to raise"],
    ["ata", "أَعْطَى يُعْطِي", "to give"],
    ["dabata", "ضَبَطَ", "to vocalize / ضبط a word"],
    ["jannah", "جَنَّةٌ", "garden"],
    ["ukul", "أُكُلٌ", "produce"],
    ["intizar", "اِنْتِظَارٌ", "waiting"],
    ["makan", "مَكَانٌ", "place"],
    ["fajatan", "فَجْأَةً", "suddenly"],
    ["fawda", "فَوْضَى", "confusion / chaos"],
    ["mabna", "مَبْنًى", "building"],
    ["mahad", "مَعْهَدٌ", "institute"],
    ["munasib", "مُنَاسِبٌ", "suitable"],
    ["jumlah", "جُمْلَةٌ", "sentence"],
    ["utlah", "عُطْلَةٌ", "holiday"],
    ["taqwa", "تَقْوَى", "piety / God-consciousness"],
    ["baqiya", "بَقِيَ يَبْقَى", "to remain"],
    ["sakana", "سَكَنَ يَسْكُنُ", "to live / stay"],
    ["afa", "عَفَا عَنْ", "to forgive"],
    ["ada-al-marid", "عَادَ الْمَرِيضَ", "to visit the sick"],
    ["khatal", "خَطَبَ", "to address a gathering"]
  ],
  "11": [
    ["khatt", "خَطٌّ", "calligraphy / handwriting"],
    ["jaww", "جَوٌّ", "weather"],
    ["nadi-riyadi", "النَّادِي الرِّيَاضِيُّ", "sports club"],
    ["ulbah", "عُلْبَةٌ", "box / tin"],
    ["tabashir", "طَبَاشِيرُ", "chalk"],
    ["bid-dabt", "بِالضَّبْطِ", "exactly"],
    ["mushrik", "مُشْرِكٌ", "one who associates partners"],
    ["shakk", "شَكٌّ", "doubt"],
    ["nawa", "نَوَى نِيَّةً", "to intend"],
    ["mahall", "مَحَلٌّ", "place / location"],
    ["yusr", "يُسْرٌ", "ease"],
    ["mutabaqah", "مُطَابَقَةٌ", "agreement / correspondence"],
    ["ajib", "عَجِيبٌ", "strange / wonderful"],
    ["jabba", "جَبَّ", "to cut and remove"],
    ["istadhana", "اِسْتَأْذَنَ", "to ask permission"],
    ["tamma", "تَمَّ يَتِمُّ", "to be complete"],
    ["tahaddatha", "تَحَدَّثَ يَتَحَدَّثُ", "to speak"],
    ["faidah", "فَائِدَةٌ", "benefit / information"],
    ["shart", "شَرْطٌ", "condition / stipulation"]
  ],
  "12": [
    ["istaqbala", "اِسْتَقْبَلَ يَسْتَقْبِلُ", "to receive a guest"],
    ["istamarra", "اِسْتَمَرَّ", "to continue"],
    ["idtarra", "اِضْطَرَّ", "to be compelled"],
    ["iqtarana", "اِقْتَرَنَ", "to be linked"],
    ["iltazama", "اِلْتَزَمَ", "to embrace / commit"],
    ["imtanaa", "اِمْتَنَعَ", "to refrain / be prevented"],
    ["intazara", "اِنْتَظَرَ", "to wait"],
    ["abadan", "أَبَدًا", "never / ever"],
    ["athbata", "أَثْبَتَ", "to confirm"],
    ["adda", "أَدَّى", "to perform"],
    ["afada", "أَفَادَ", "to inform / be useful"],
    ["balad", "بَلَدٌ", "town / country"],
    ["taqdir", "تَقْدِيرٌ", "grade / estimation"],
    ["darajah", "دَرَجَةٌ", "mark / degree"],
    ["dalla", "دَلَّ عَلَى", "to indicate"],
    ["dhaqa", "ذَاقَ يَذُوقُ", "to taste"],
    ["rajaa", "رَاجَعَ يُرَاجِعُ", "to revise"],
    ["zara", "زَارَ يَزُورُ", "to visit"],
    ["sabara", "صَبَرَ يَصْبِرُ", "to be patient"],
    ["fata", "فَاتَ يَفُوتُ", "to miss / escape"],
    ["qabila", "قَبِلَ يَقْبَلُ", "to accept"],
    ["lahzah", "لَحْظَةٌ", "moment"],
    ["mani", "مَانِعٌ", "preventer / obstacle"],
    ["muthbat", "مُثْبَتٌ", "affirmative"],
    ["manfi", "مَنْفِيٌّ", "negative"],
    ["nahar", "نَهَارٌ", "daytime"],
    ["wasala", "وَصَلَ يَصِلُ", "to arrive"],
    ["waqafa", "وَقَفَ يَقِفُ", "to stand / stop"]
  ],
  "13": [
    ["istaadha", "اِسْتَعَاذَ", "to seek refuge"],
    ["ash-shimal", "الشِّمَالُ", "left side / north"],
    ["ajaba", "أَجَابَ يُجِيبُ", "to reply"],
    ["atama", "أَطْعَمَ يُطْعِمُ", "to feed"],
    ["ilan", "إِعْلَانٌ", "announcement"],
    ["baa", "بَاعَ يَبِيعُ", "to sell"],
    ["tashkin", "تَسْكِينٌ", "making sakin"],
    ["tatim", "تَطْعِيمٌ", "vaccination"],
    ["tawajjaa", "تَوَجَّعَ", "to suffer pain"],
    ["jazim", "جَازِمٌ", "word that makes a verb majzum"],
    ["jadar", "جِدَارٌ", "wall"],
    ["jawab", "جَوَابٌ", "answer"],
    ["jawaz-safar", "جَوَازُ سَفَرٍ", "passport"],
    ["hazina", "حَزِنَ يَحْزَنُ", "to be sad"],
    ["hafiza", "حَفِظَ يَحْفَظُ", "to memorize / protect"],
    ["khashab", "خَشَبٌ", "wood"],
    ["daa", "دَعَا يَدْعُو", "to call / invite"],
    ["sabba", "سَبَّ يَسُبُّ", "to insult"],
    ["sabaqa", "سَبَقَ يَسْبِقُ", "to precede"],
    ["sakhira", "سَخِرَ يَسْخَرُ", "to mock"],
    ["sayyarat-ujrah", "سَيَّارَةُ الْأُجْرَةِ", "taxi"],
    ["suda", "صُدَاعٌ", "headache"],
    ["sawt", "صَوْتٌ", "voice / sound"],
    ["tariq", "طَرِيقٌ", "road / way"],
    ["taam", "طَعَامٌ", "food"],
    ["matam", "مَطْعَمٌ", "restaurant"],
    ["mustaqbal", "مُسْتَقْبَلٌ", "future"],
    ["waja", "وَجَعٌ", "pain"],
    ["wafd", "وَفْدٌ", "delegation"]
  ],
  "14": [
    ["barqiyyah", "بَرْقِيَّةٌ", "telegram"],
    ["adah", "عَادَةٌ", "habit"],
    ["qama", "قَامَ يَقُومُ", "to get up"],
    ["atasa", "عَطَسَ يَعْطِسُ", "to sneeze"],
    ["utas", "عُطَاسٌ", "sneeze"],
    ["hamida", "حَمِدَ يَحْمَدُ", "to praise"],
    ["rahima", "رَحِمَ يَرْحَمُ", "to have mercy"],
    ["hada", "هَدَى يَهْدِي", "to guide"],
    ["hudan", "هُدًى", "guidance"],
    ["hadiyyah", "هَدِيَّةٌ", "gift"],
    ["saluha", "صَلُحَ يَصْلُحُ", "to be good / proper"],
    ["aslaha", "أَصْلَحَ", "to improve / reform"],
    ["hal", "حَالٌ", "state / condition"],
    ["tadamman", "تَضَمَّنَ", "to contain / comprise"],
    ["hawwala", "حَوَّلَ", "to change / transfer"],
    ["raghiba-fi", "رَغِبَ فِي", "to desire"],
    ["raghiba-an", "رَغِبَ عَنْ", "to dislike / turn away"],
    ["radda", "رَدَّ يَرُدُّ", "to reply / send back"]
  ],
  "15": [
    ["shart", "شَرْطٌ", "condition"],
    ["jawab-shart", "جَوَابُ الشَّرْطِ", "answer of the condition"],
    ["adat-shart", "أَدَاةُ الشَّرْطِ", "conditional particle"],
    ["in", "إِنْ", "if"],
    ["man", "مَنْ", "whoever"],
    ["ma", "مَا", "whatever"],
    ["mata", "مَتَى", "whenever"],
    ["ayna", "أَيْنَ", "wherever"],
    ["haythuma", "حَيْثُمَا", "wherever"],
    ["kayfama", "كَيْفَمَا", "however"],
    ["mahma", "مَهْمَا", "whatever"],
    ["jazim", "جَازِمٌ", "jussive-governing"],
    ["majzum", "مَجْزُومٌ", "jussive"],
    ["diminutive", "تَصْغِيرٌ", "diminutive"]
  ],
  "16": [
    ["thulathi", "ثُلَاثِيٌّ", "triliteral"],
    ["rubai", "رُبَاعِيٌّ", "quadriliteral"],
    ["mujarrad", "مُجَرَّدٌ", "unaugmented"],
    ["mazid", "مَزِيدٌ", "augmented"],
    ["bab", "بَابٌ", "verb form / pattern"],
    ["faala", "فَعَّلَ", "form II pattern"],
    ["darrasa", "دَرَّسَ", "he taught"],
    ["sajjala", "سَجَّلَ", "he recorded"],
    ["qabbala", "قَبَّلَ", "he kissed"],
    ["allama", "عَلَّمَ", "he taught"],
    ["sallama", "سَلَّمَ", "he greeted / handed over"],
    ["kasara", "كَسَّرَ", "he broke repeatedly"],
    ["hawwala", "حَوَّلَ", "he transformed"],
    ["masdar", "مَصْدَرٌ", "verbal noun"]
  ],
  "17": [
    ["afala", "أَفْعَلَ", "form IV pattern"],
    ["anzala", "أَنْزَلَ", "he brought down"],
    ["aslama", "أَسْلَمَ", "he became Muslim"],
    ["arsala", "أَرْسَلَ", "he sent"],
    ["aghlaqa", "أَغْلَقَ", "he closed"],
    ["aqama", "أَقَامَ", "he established"],
    ["amana", "آمَنَ", "he believed"],
    ["alqa", "أَلْقَى", "he threw / delivered"],
    ["iqamah", "إِقَامَةٌ", "establishing / iqamah"],
    ["iman", "إِيمَانٌ", "faith"],
    ["mursil", "مُرْسِلٌ", "sender"],
    ["mursal", "مُرْسَلٌ", "sent"],
    ["mumkin", "مُمْكِنٌ", "possible"],
    ["muthaf", "مُتْحَفٌ", "museum"]
  ],
  "18": [
    ["mutaaddi", "مُتَعَدٍّ", "transitive"],
    ["lazim", "لَازِمٌ", "intransitive"],
    ["maful-ghayr-sarih", "مَفْعُولٌ غَيْرُ صَرِيحٍ", "indirect object"],
    ["hamzat-tadiyah", "هَمْزَةُ التَّعْدِيَةِ", "transitive hamzah"],
    ["jalasa", "جَلَسَ", "he sat"],
    ["ajlasa", "أَجْلَسَ", "he seated"],
    ["nazala", "نَزَلَ", "he got down"],
    ["nazzala", "نَزَّلَ", "he brought down"],
    ["darasa", "دَرَسَ", "he studied"],
    ["darrasa", "دَرَّسَ", "he taught"],
    ["samia", "سَمِعَ", "he heard"],
    ["asmaa", "أَسْمَعَ", "he made someone hear"],
    ["ghadiba-ala", "غَضِبَ عَلَى", "to be angry with"],
    ["raghiba-fi", "رَغِبَ فِي", "to desire"]
  ],
  "19": [
    ["faala", "فَاعَلَ", "form III pattern"],
    ["saada", "سَاعَدَ", "he helped"],
    ["qabala", "قَابَلَ", "he met"],
    ["hawala", "حَاوَلَ", "he tried"],
    ["rasala", "رَاسَلَ", "he corresponded"],
    ["shahada", "شَاهَدَ", "he watched"],
    ["musaadah", "مُسَاعَدَةٌ", "help"],
    ["murasil", "مُرَاسِلٌ", "correspondent"],
    ["mukhatab", "مُخَاطَبٌ", "one addressed"],
    ["muhajar", "مُهَاجَرٌ", "place of migration"],
    ["qad", "قَدْ", "indeed / may"],
    ["dhawu", "ذَوُو", "possessors of"]
  ],
  "20": [
    ["tafaala", "تَفَعَّلَ", "form V pattern"],
    ["taallama", "تَعَلَّمَ", "he learned"],
    ["takallama", "تَكَلَّمَ", "he spoke"],
    ["tazawwaja", "تَزَوَّجَ", "he married"],
    ["tahaddatha", "تَحَدَّثَ", "he spoke"],
    ["tadhakkara", "تَذَكَّرَ", "he remembered"],
    ["talaqqa", "تَلَقَّى", "he received"],
    ["mutaallim", "مُتَعَلِّمٌ", "learner"],
    ["mutakallim", "مُتَكَلِّمٌ", "speaker"],
    ["mutawaah", "مُطَاوَعَةٌ", "resultative meaning"],
    ["lamma", "لَمَّا", "when"],
    ["ikhtisas", "اِخْتِصَاصٌ", "specification"]
  ],
  "21": [
    ["tafaala", "تَفَاعَلَ", "form VI pattern"],
    ["taawana", "تَعَاوَنَ", "he cooperated"],
    ["taarafa", "تَعَارَفَ", "they got to know one another"],
    ["tanawala", "تَنَاوَلَ", "he took"],
    ["tashaama", "تَشَاءَمَ", "he was pessimistic"],
    ["tabaka", "تَبَاكَى", "he pretended to cry"],
    ["tashawara", "تَشَاوَرَ", "they consulted one another"],
    ["mutanawal", "مُتَنَاوَلٌ", "within reach"],
    ["layta", "لَيْتَ", "would that"],
    ["jins", "جِنْسٌ", "genus / class"],
    ["la-nafiyah-liljins", "لَا النَّافِيَةُ لِلْجِنْسِ", "la negating the whole genus"]
  ],
  "22": [
    ["infala", "اِنْفَعَلَ", "form VII pattern"],
    ["inkasara", "اِنْكَسَرَ", "it broke"],
    ["inshaqqa", "اِنْشَقَّ", "it split"],
    ["insarafa", "اِنْصَرَفَ", "he left / returned"],
    ["infial", "اِنْفِعَالٌ", "form VII masdar"],
    ["inkisar", "اِنْكِسَارٌ", "breaking"],
    ["munkasir", "مُنْكَسِرٌ", "broken"],
    ["munataf", "مُنْعَطَفٌ", "bend / turning place"],
    ["lawla", "لَوْلَا", "if not for / but for"],
    ["shams", "الشَّمْسُ", "the sun"],
    ["natayij", "نَتَائِجُ", "results"]
  ],
  "23": [
    ["iftaala", "اِفْتَعَلَ", "form VIII pattern"],
    ["intazara", "اِنْتَظَرَ", "he waited"],
    ["imtahana", "اِمْتَحَنَ", "he examined"],
    ["ibtasama", "اِبْتَسَمَ", "he smiled"],
    ["ikhtara", "اِخْتَارَ", "he chose"],
    ["ijtamaa", "اِجْتَمَعَ", "he gathered"],
    ["ikhtiyar", "اِخْتِيَارٌ", "choice"],
    ["muntazir", "مُنْتَظِرٌ", "one waiting"],
    ["mukhtabar", "مُخْتَبَرٌ", "laboratory / tested place"],
    ["mujtama", "مُجْتَمَعٌ", "society / gathering"],
    ["idha-fujaiyyah", "إِذَا الْفُجَائِيَّةُ", "idha of surprise"],
    ["zanna", "ظَنَّ", "he thought"]
  ],
  "24": [
    ["ifalla", "اِفْعَلَّ", "form IX pattern"],
    ["ihmarra", "اِحْمَرَّ", "it became red"],
    ["iwajja", "اِعْوَجَّ", "it became crooked"],
    ["ihmirar", "اِحْمِرَارٌ", "reddening"],
    ["muhmarr", "مُحْمَرٌّ", "reddened"],
    ["raa", "رَأَى", "he saw / considered"],
    ["asa", "عَسَى", "perhaps / it is hoped"],
    ["masdar-muawwal", "مَصْدَرٌ مُؤَوَّلٌ", "interpreted verbal noun"],
    ["amma", "أَمَّا", "as for"],
    ["badama", "بَعْدَمَا", "after"]
  ],
  "25": [
    ["istafala", "اِسْتَفْعَلَ", "form X pattern"],
    ["istaghfara", "اِسْتَغْفَرَ", "he sought forgiveness"],
    ["istadhana", "اِسْتَأْذَنَ", "he asked permission"],
    ["istaqala", "اِسْتَقَالَ", "he resigned"],
    ["istalqa", "اِسْتَلْقَى", "he lay down"],
    ["istiqalah", "اِسْتِقَالَةٌ", "resignation"],
    ["mustashfa", "مُسْتَشْفًى", "hospital"],
    ["mustawsaf", "مُسْتَوْصَفٌ", "clinic"],
    ["kay", "كَيْ", "so that"],
    ["likayla", "لِكَيْلَا", "so that not / lest"],
    ["idhan", "إِذَنْ", "in that case"]
  ],
  "26": [
    ["rubai", "رُبَاعِيٌّ", "quadriliteral"],
    ["tarjama", "تَرْجَمَ", "he translated"],
    ["basmala", "بَسْمَلَ", "he said bismillah"],
    ["harwala", "هَرْوَلَ", "he walked quickly"],
    ["zalzala", "زَلْزَلَ", "he shook violently"],
    ["tarjamah", "تَرْجَمَةٌ", "translation"],
    ["mutarjim", "مُتَرْجِمٌ", "translator"],
    ["mutarjam", "مُتَرْجَمٌ", "translated"],
    ["tafalala", "تَفَعْلَلَ", "ruba'i mazid form"],
    ["tararaa", "تَرَعْرَعَ", "he grew up"],
    ["itmaanna", "اِطْمَأَنَّ", "he felt at ease"],
    ["damir-fasl", "ضَمِيرُ الْفَصْلِ", "differentiating pronoun"],
    ["min-tabidiyyah", "مِنْ التَّبْعِيضِيَّةُ", "partitive min"]
  ],
  "27": [
    ["damir", "ضَمِيرٌ", "pronoun"],
    ["munfasil", "مُنْفَصِلٌ", "separate"],
    ["muttasil", "مُتَّصِلٌ", "attached"],
    ["iyyaka", "إِيَّاكَ", "you as object"],
    ["iyyahu", "إِيَّاهُ", "him as object"],
    ["iyyaya", "إِيَّايَ", "me as object"],
    ["nasb", "نَصْبٌ", "accusative"],
    ["jarr", "جَرٌّ", "genitive"],
    ["raf", "رَفْعٌ", "nominative"],
    ["alayhi", "عَلَيْهِ", "on him"],
    ["minhum", "مِنْهُمْ", "from them"],
    ["kitabuka", "كِتَابُكَ", "your book"],
    ["saalahu", "سَأَلَهُ", "he asked him"]
  ],
  "28": [
    ["maful-mutlaq", "مَفْعُولٌ مُطْلَقٌ", "absolute object"],
    ["masdar", "مَصْدَرٌ", "verbal noun"],
    ["darban", "ضَرْبًا", "a beating"],
    ["fahman", "فَهْمًا", "understanding"],
    ["shukran", "شُكْرًا", "thanks"],
    ["sabran", "صَبْرًا", "patience"],
    ["marratan", "مَرَّةً", "once"],
    ["sajdah", "سَجْدَةٌ", "prostration"],
    ["ijtihad", "اِجْتِهَادٌ", "hard effort"],
    ["kalam", "كَلَامٌ", "speech"],
    ["qabul", "قَبُولٌ", "acceptance"],
    ["hayah", "حَيَاةٌ", "life"]
  ],
  "29": [
    ["maful-lahu", "مَفْعُولٌ لَهُ", "object of reason"],
    ["khawfan", "خَوْفًا", "out of fear"],
    ["hubban", "حُبًّا", "out of love"],
    ["raghbatan", "رَغْبَةً", "out of desire"],
    ["rahbatan", "رَهْبَةً", "out of fear / awe"],
    ["makhafah", "مَخَافَةً", "for fear of"],
    ["halla", "هَلَّا", "why not / should have"],
    ["lawla", "لَوْلَا", "why not / if not for"],
    ["lawma", "لَوْمَا", "why not"],
    ["tandim", "تَنْدِيمٌ", "rebuke"],
    ["tahdid", "تَحْضِيضٌ", "urging"],
    ["la-atifah", "لَا الْعَاطِفَةُ", "la as a conjunction"]
  ],
  "30": [
    ["tamyiz", "تَمْيِيزٌ", "specification"],
    ["dhat", "ذَاتٌ", "entity / essence"],
    ["nisbah", "نِسْبَةٌ", "relation / sentence meaning"],
    ["litr", "لِتْرٌ", "litre"],
    ["kilughram", "كِيلُوغْرَامٌ", "kilogram"],
    ["mitr", "مِتْرٌ", "metre"],
    ["burtuqal", "بُرْتُقَالٌ", "oranges"],
    ["halib", "حَلِيبٌ", "milk"],
    ["khuluq", "خُلُقٌ", "manners"],
    ["ma", "مَاءٌ", "water"],
    ["akthar", "أَكْثَرُ", "more / most"],
    ["afil-bihi", "أَفْعِلْ بِهِ", "wonder expression form"]
  ],
  "31": [
    ["hal", "حَالٌ", "circumstantial accusative"],
    ["sahib-al-hal", "صَاحِبُ الْحَالِ", "the one whose state is described"],
    ["rakiban", "رَاكِبًا", "riding"],
    ["dahikan", "ضَاحِكًا", "laughing"],
    ["farihin", "فَرِحِينَ", "happy"],
    ["mashwiyyan", "مَشْوِيًّا", "roasted"],
    ["maqliyyan", "مَقْلِيًّا", "fried"],
    ["jumlat-al-hal", "جُمْلَةُ الْحَالِ", "hal sentence"],
    ["waw-al-hal", "وَاوُ الْحَالِ", "circumstantial waw"],
    ["mutabun", "مُتْعَبُونَ", "tired"]
  ],
  "32": [
    ["istithna", "اِسْتِثْنَاءٌ", "exception"],
    ["mustathna", "مُسْتَثْنًى", "excepted item"],
    ["mustathna-minhu", "مُسْتَثْنًى مِنْهُ", "item excepted from"],
    ["adat-istithna", "أَدَاةُ الِاسْتِثْنَاءِ", "tool of exception"],
    ["illa", "إِلَّا", "except"],
    ["siwa", "سِوَى", "except / other than"],
    ["ghayr", "غَيْرُ", "other than"],
    ["khala", "خَلَا", "except"],
    ["ada", "عَدَا", "except"],
    ["hasha", "حَاشَا", "except"],
    ["muttasil", "مُتَّصِلٌ", "connected"],
    ["munqati", "مُنْقَطِعٌ", "disconnected"]
  ],
  "33": [
    ["nun-tawkid", "نُونُ التَّوْكِيدِ", "nun of emphasis"],
    ["thaqilah", "ثَقِيلَةٌ", "heavy"],
    ["khafifah", "خَفِيفَةٌ", "light"],
    ["uktubanna", "اُكْتُبَنَّ", "write with emphasis"],
    ["la-takhrujanna", "لَا تَخْرُجَنَّ", "do not leave with emphasis"],
    ["la-tansayanna", "لَا تَنْسَيَنَّ", "do not forget with emphasis"],
    ["layaktubanna", "لَيَكْتُبَنَّ", "he shall certainly write"],
    ["akkid", "أَكِّدْ", "emphasize"],
    ["tawkid", "تَوْكِيدٌ", "emphasis"],
    ["mudari", "مُضَارِعٌ", "present/future verb"],
    ["amr", "أَمْرٌ", "imperative"]
  ],
  "34": [
    ["mamnu-min-as-sarf", "مَمْنُوعٌ مِنَ الصَّرْفِ", "diptote"],
    ["alam", "عَلَمٌ", "proper noun"],
    ["wasf", "وَصْفٌ", "adjective"],
    ["sahra", "صَحْرَاءُ", "desert"],
    ["hamra", "حَمْرَاءُ", "red feminine"],
    ["marda", "مَرْضَى", "sick people"],
    ["dunya", "دُنْيَا", "world"],
    ["masajid", "مَسَاجِدُ", "mosques"],
    ["madaris", "مَدَارِسُ", "schools"],
    ["mafatih", "مَفَاتِيحُ", "keys"],
    ["asawir", "أَسَاوِرُ", "bracelets"],
    ["umar", "عُمَرُ", "Umar"],
    ["ahmad", "أَحْمَدُ", "Ahmad"],
    ["fatimah", "فَاطِمَةُ", "Fatimah"]
  ]
};

const book3VocabularyDrafts = Object.entries(book3VocabularyByLesson).flatMap(([lessonNumber, words]) =>
  words.map(([key, arabic, english]) => [
    `v3-l${lessonNumber}-${key}`,
    arabic,
    "",
    english,
    lessonNumber
  ])
);

function book1SourceTextForLesson(number) {
  const sourceText = book1Sections[number] || "";
  if (number === "4") {
    const continuation = (book1Sections["4A"] || "").replace(/^LESSON\s+4A/m, "LESSON 4 CONTINUATION");
    return [sourceText, continuation].filter(Boolean).join("\n\n");
  }
  return sourceText;
}

function book2SourceTextForLesson(number) {
  return book2Sections[number] || "";
}

function book3SourceTextForLesson(number) {
  return book3Sections[number] || "";
}

function buildBookContent({ bookSlug, lessonDrafts, vocabularyDrafts, sourceTextForLesson, idForLesson, idForGrammar, idForExercise }) {
  const vocabulary = vocabularyDrafts.map(([id, arabic, transliteration, english, lessonNumber]) => {
    const formattedArabic = formatVocabularyArabic(arabic);
    return {
      id,
      bookSlug,
      lessonNumber,
      sequence: lessonNumber === "PDF" ? 999 : Number.parseInt(lessonNumber, 10) || 999,
      arabic: formattedArabic,
      transliteration: pronunciationNote(formattedArabic, transliteration),
      english,
      audioKey: `${bookSlug}/lesson-${lessonNumber}/${id.replace(/^v\d?-/, "")}`
    };
  });

  const grammar = lessonDrafts.map((lesson, index) => ({
    id: idForGrammar(lesson.n),
    bookSlug,
    sequence: index + 1,
    title: lesson.title,
    summary: lesson.focus,
    example: lesson.arabic
  }));

  const lessons = lessonDrafts.map((lesson, index) => {
    const sourceText = sourceTextForLesson(lesson.n);
    const lessonVocabularyIds = vocabulary
      .filter((word) => word.lessonNumber === lesson.n)
      .map((word) => word.id);

    return {
      id: idForLesson(lesson.n),
      bookSlug,
      number: lesson.n,
      sequence: index + 1,
      title: lesson.title,
      focus: lesson.focus,
      arabic: lesson.arabic,
      translation: lesson.translation,
      examples: lessonExamples({ ...lesson, bookSlug }),
      notes: lesson.notes,
      exercisePrompts: exercisePrompts(sourceText),
      sourceText,
      grammarIds: [idForGrammar(lesson.n)],
      vocabularyIds: lessonVocabularyIds,
      completed: false
    };
  });

  const exercises = lessonDrafts.map((lesson) => ({
    id: idForExercise(lesson.n),
    lessonId: idForLesson(lesson.n),
    bookSlug,
    sequence: Number.parseInt(lesson.n, 10) || 999,
    type: "choice",
    prompt: lesson.quiz.prompt,
    arabic: lesson.quiz.arabic,
    options: lesson.quiz.options,
    answer: lesson.quiz.answer
  }));

  return { grammar, lessons, vocabulary, exercises };
}

const book1Content = buildBookContent({
  bookSlug: "book-1",
  lessonDrafts,
  vocabularyDrafts,
  sourceTextForLesson: book1SourceTextForLesson,
  idForLesson: (number) => `lesson-${String(number).toLowerCase()}`,
  idForGrammar: (number) => `g-lesson-${String(number).toLowerCase()}`,
  idForExercise: (number) => `ex-lesson-${String(number).toLowerCase()}`
});

const book2Content = buildBookContent({
  bookSlug: "book-2",
  lessonDrafts: book2LessonDrafts,
  vocabularyDrafts: book2VocabularyDrafts,
  sourceTextForLesson: book2SourceTextForLesson,
  idForLesson: (number) => `book-2-lesson-${String(number).toLowerCase()}`,
  idForGrammar: (number) => `g-book-2-lesson-${String(number).toLowerCase()}`,
  idForExercise: (number) => `ex-book-2-lesson-${String(number).toLowerCase()}`
});

const book3Content = buildBookContent({
  bookSlug: "book-3",
  lessonDrafts: book3LessonDrafts,
  vocabularyDrafts: book3VocabularyDrafts,
  sourceTextForLesson: book3SourceTextForLesson,
  idForLesson: (number) => `book-3-lesson-${String(number).toLowerCase()}`,
  idForGrammar: (number) => `g-book-3-lesson-${String(number).toLowerCase()}`,
  idForExercise: (number) => `ex-book-3-lesson-${String(number).toLowerCase()}`
});

const grammar = [...book1Content.grammar, ...book2Content.grammar, ...book3Content.grammar];
const vocabulary = [...book1Content.vocabulary, ...book2Content.vocabulary, ...book3Content.vocabulary];
const lessons = [...book1Content.lessons, ...book2Content.lessons, ...book3Content.lessons];
const exercises = [...book1Content.exercises, ...book2Content.exercises, ...book3Content.exercises];

const curriculum = {
  books: [
    {
      slug: "book-1",
      title: "Book 1",
      status: "available",
      lessonCount: book1Content.lessons.length,
      summary: "Complete Book 1 curriculum extracted from the attached English key, with cleaned Arabic examples and vocabulary."
    },
    {
      slug: "book-2",
      title: "Book 2",
      status: "available",
      lessonCount: book2Content.lessons.length,
      summary: "Book 2 is now available with 31 lessons, curated vocabulary from the attached vocabulary PDF, lesson quizzes, and exercise prompts from the English key."
    },
    {
      slug: "book-3",
      title: "Book 3",
      status: "available",
      lessonCount: book3Content.lessons.length,
      summary: "Book 3 is now available with 34 lessons, OCR-backed exercise prompts from the English key, and curated vocabulary from the attached vocabulary PDF."
    }
  ],
  lessons,
  vocabulary,
  grammar,
  exercises,
  resources: [
    {
      id: "res-lesson-notes",
      title: "Book 1, Book 2 and Book 3 Lesson Notes",
      kind: "Notes",
      description: "Clean lesson summaries and examples for every available Madinah Arabic lesson."
    },
    {
      id: "res-pdf-key-extract",
      title: "Extracted PDF Key",
      kind: "Reference",
      description: "OCR-backed lesson source text attached to each lesson for traceability."
    },
    {
      id: "res-vocabulary-review",
      title: "Full Vocabulary Review",
      kind: "Review",
      description: "Expanded vocabulary table with Arabic, transliteration, English, lesson number, and audio playback."
    },
    {
      id: "res-exercise-bank",
      title: "All Lesson Quizzes",
      kind: "Practice",
      description: "Interactive lesson and vocabulary quizzes for every available lesson."
    },
    {
      id: "res-book-2-key",
      title: "Book 2 Key Extract",
      kind: "Reference",
      description: "OCR-backed Book 2 English key text attached to each Book 2 lesson for traceability."
    },
    {
      id: "res-book-3-key",
      title: "Book 3 Key Extract",
      kind: "Reference",
      description: "OCR-backed Book 3 English key text attached to each Book 3 lesson for traceability."
    }
  ],
  defaultProgress: {
    userId: "demo-user",
    displayName: "Fahima",
    activeBookSlug: "book-1",
    currentLessonId: "lesson-4",
    completedLessonIds: ["lesson-1", "lesson-2", "lesson-3"],
    learnedVocabularyIds: vocabulary.slice(0, 24).map((word) => word.id),
    exerciseAttempts: {},
    vocabularyStats: {},
    mistakes: {},
    writingAttempts: {},
    exerciseAnswers: {},
    dailyStreakDays: 12,
    xp: 4280,
    weeklyGoalCompleted: 5,
    weeklyGoalTarget: 7
  }
};

fs.writeFileSync(outPath, `${JSON.stringify(curriculum, null, 2)}\n`);
fs.writeFileSync("data/progress.json", `${JSON.stringify(curriculum.defaultProgress, null, 2)}\n`);

console.log(`Wrote ${lessons.length} lessons`);
console.log(`Wrote ${vocabulary.length} vocabulary items`);
console.log(`Wrote ${exercises.length} exercises`);
