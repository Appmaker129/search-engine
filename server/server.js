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
// Behavior:
// - If TVLY_API_KEY and TVLY_API_URL are set, proxy the query to the Tavily Search API and return its response (with light normalization).
// - Otherwise fall back to local SQLite search.
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = parseInt(req.query.limit, 10) || 20;
  if (!q) return res.json({ results: [] });

  const tvlyKey = process.env.TVLY_API_KEY;
  const tvlyUrl = process.env.TVLY_API_URL;

  if (tvlyKey && tvlyUrl) {
    try {
      // Tavily expects POST with { query, ... } so map our q -> query
      const payload = { query: q, limit };

      const resp = await fetch(tvlyUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tvlyKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error('TVLY upstream error', resp.status, text);
        return res.status(502).json({ error: 'Upstream error', status: resp.status, body: text });
      }

      const data = await resp.json();

      // Normalize common shapes into { results: [ { id, title, snippet } ] }
      let results = [];
      if (Array.isArray(data)) {
        results = data.map((item, idx) => ({ id: item.id || idx, title: item.title || item.name || '', snippet: item.snippet || item.body || item.summary || '' }));
      } else if (Array.isArray(data.results)) {
        results = data.results.map((item, idx) => ({ id: item.id || idx, title: item.title || item.name || '', snippet: item.snippet || item.body || item.summary || '' }));
      } else if (Array.isArray(data.items)) {
        results = data.items.map((item, idx) => ({ id: item.id || idx, title: item.title || item.name || '', snippet: item.snippet || item.body || item.summary || '' }));
      } else if (data.result && Array.isArray(data.result)) {
        results = data.result.map((item, idx) => ({ id: item.id || idx, title: item.title || item.name || '', snippet: item.snippet || item.body || item.summary || '' }));
      } else if (data && typeof data === 'object') {
        if (data.id || data.title || data.body) {
          results = [{ id: data.id || 0, title: data.title || data.name || '', snippet: data.snippet || data.body || data.summary || '' }];
        } else {
          return res.json({ raw: data });
        }
      } else {
        return res.json({ results: [] });
      }

      return res.json({ results });
    } catch (err) {
      console.error('Tavily proxy error', err);
      return res.status(500).json({ error: 'Tavily proxy error', detail: String(err) });
    }
  }

  // Fallback to local SQLite search
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

// Optional: lightweight ping to verify Tavily credentials (does not expose the key)
app.get('/api/tvly-ping', async (req, res) => {
  const tvlyKey = process.env.TVLY_API_KEY;
  const tvlyUrl = process.env.TVLY_API_URL;
  if (!tvlyKey || !tvlyUrl) return res.status(400).json({ error: 'TVLY env vars not set' });
  try {
    const resp = await fetch(tvlyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tvlyKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query: '', limit: 1 })
    });
    const text = await resp.text();
    return res.json({ status: resp.status, body: text.slice(0, 200) });
  } catch (err) {
    console.error('TVLY ping error', err);
    return res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Search server listening on http://localhost:${PORT}`);
});
