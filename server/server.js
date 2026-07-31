const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { addDoc, search, getDoc } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Serve static client
app.use('/', express.static(path.join(__dirname, '..', 'client')));

// API: index a document
// POST /api/index  { title, body }
app.post('/api/index', (req, res) => {
  const { title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });
  const id = addDoc(title, body);
  res.json({ ok: true, id });
});

// API: search
// GET /api/search?q=term&limit=10
app.get('/api/search', (req, res) => {
  const q = req.query.q || '';
  const limit = parseInt(req.query.limit, 10) || 20;
  if (!q.trim()) return res.json({ results: [] });
  try {
    const results = search(q, limit);
    res.json({ results });
  } catch (err) {
    console.error('Search error', err);
    res.status(500).json({ error: String(err) });
  }
});

// API: fetch document
app.get('/api/docs/:id', (req, res) => {
  const doc = getDoc(req.params.id);
  if (!doc) return res.status(404).json({ error: 'not found' });
  res.json(doc);
});

app.listen(PORT, () => {
  console.log(`Search server listening on http://localhost:${PORT}`);
});
