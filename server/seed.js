const { addDoc } = require('./db');

// A few sample documents to get started
const samples = [
  {
    title: 'Node.js Guide',
    body: 'Node.js is a JavaScript runtime built on Chrome\'s V8 engine. It is commonly used for building scalable network applications...'
  },
  {
    title: 'Full-Text Search with SQLite',
    body: 'SQLite supports full-text search (FTS5) which can be used for prototyping search engines locally. It supports MATCH queries and snippet extraction...'
  },
  {
    title: 'How to Build a Search UI',
    body: 'A good search UI provides instant feedback, shows result counts, highlights query terms, and supports pagination and sorting...'
  },
  {
    title: 'Scaling Search',
    body: 'For larger scale, consider using dedicated search engines such as Elasticsearch, MeiliSearch, or Typesense; each provides ranking, distributed indexing, and advanced query features...'
  }
];

for (const s of samples) {
  const id = addDoc(s.title, s.body);
  console.log('Inserted', id, s.title);
}
console.log('Seeding complete.');
