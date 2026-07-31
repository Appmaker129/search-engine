const Database = require('better-sqlite3');
const db = new Database('search.db');

// Initialize tables and FTS virtual table
db.exec(`
CREATE TABLE IF NOT EXISTS docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  body TEXT
);
CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(title, body, content='docs', content_rowid='id');
`);

// Insert doc into docs and index into FTS
function addDoc(title, body) {
  const insert = db.prepare('INSERT INTO docs (title, body) VALUES (?, ?)');
  const info = insert.run(title, body);
  const id = info.lastInsertRowid;
  const index = db.prepare('INSERT INTO docs_fts(rowid, title, body) VALUES (?, ?, ?)');
  index.run(id, title, body);
  return id;
}

// Basic search: use FTS match, return id, title, and a simple snippet extracted from body
function search(query, limit = 20) {
  // Use FTS to find matching rowids
  const matchStmt = db.prepare(`SELECT rowid FROM docs_fts WHERE docs_fts MATCH ? LIMIT ?`);
  const rows = matchStmt.all(query, limit);
  const ids = rows.map(r => r.rowid);
  if (ids.length === 0) return [];

  // Fetch docs and compute a small snippet around the first match (fallback to prefix)
  const placeholder = ids.map(() => '?').join(',');
  const docsStmt = db.prepare(`SELECT id, title, body FROM docs WHERE id IN (${placeholder})`);
  const docs = docsStmt.all(...ids);

  // Build snippet: if query token appears in body, give surrounding text; else first 200 chars
  const qLower = query.toLowerCase().replace(/["'*]/g, '').trim();
  return docs.map(d => {
    const bodyLower = (d.body || '').toLowerCase();
    const idx = qLower ? bodyLower.indexOf(qLower) : -1;
    let snippet;
    if (idx >= 0) {
      const start = Math.max(0, idx - 60);
      snippet = d.body.substr(start, 220);
      if (start > 0) snippet = '...' + snippet;
      if (snippet.length < d.body.length - start) snippet = snippet + '...';
    } else {
      snippet = (d.body || '').substr(0, 220) + ((d.body || '').length > 220 ? '...' : '');
    }
    return { id: d.id, title: d.title, snippet };
  });
}

function getDoc(id) {
  return db.prepare('SELECT id, title, body FROM docs WHERE id = ?').get(id);
}

module.exports = { addDoc, search, getDoc };
