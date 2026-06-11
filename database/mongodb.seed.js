const database = db.getSiblingDB("madinah_arabic");
const curriculum = JSON.parse(cat("data/curriculum.json"));

database.books.deleteMany({});
database.lessons.deleteMany({});
database.vocabulary.deleteMany({});
database.grammar.deleteMany({});
database.exercises.deleteMany({});
database.resources.deleteMany({});
database.userProgress.deleteMany({});

database.books.insertMany(curriculum.books);
database.lessons.insertMany(curriculum.lessons);
database.vocabulary.insertMany(curriculum.vocabulary);
database.grammar.insertMany(curriculum.grammar);
database.exercises.insertMany(curriculum.exercises);
database.resources.insertMany(curriculum.resources);
database.userProgress.insertOne({
  ...curriculum.defaultProgress,
  updatedAt: new Date()
});

database.books.createIndex({ slug: 1 }, { unique: true });
database.lessons.createIndex({ id: 1 }, { unique: true });
database.lessons.createIndex({ bookSlug: 1, number: 1 }, { unique: true });
database.vocabulary.createIndex({ id: 1 }, { unique: true });
database.vocabulary.createIndex({ lessonNumber: 1 });
database.grammar.createIndex({ id: 1 }, { unique: true });
database.exercises.createIndex({ id: 1 }, { unique: true });
database.resources.createIndex({ id: 1 }, { unique: true });
database.userProgress.createIndex({ userId: 1 }, { unique: true });
