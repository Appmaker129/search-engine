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
      // Build URL with query params for GET requests. If your Tavily API expects POST, we can change this to POST.
      const url = new URL(tvlyUrl);
      url.searchParams.set('q', q);
      url.searchParams.set('limit', String(limit));

      const resp = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tvlyKey}`,
          'Accept': 'application/json'
        }
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
        // If the API returned an array of items
        results = data.map((item, idx) => ({ id: item.id || idx, title: item.title || item.name || '', snippet: item.snippet || item.body || item.summary || '' }));
      } else if (Array.isArray(data.results)) {
        results = data.results.map((item, idx) => ({ id: item.id || idx, title: item.title || item.name || '', snippet: item.snippet || item.body || item.summary || '' }));
      } else if (Array.isArray(data.items)) {
        results = data.items.map((item, idx) => ({ id: item.id || idx, title: item.title || item.name || '', snippet: item.snippet || item.body || item.summary || '' }));
      } else if (data.result && Array.isArray(data.result)) {
        results = data.result.map((item, idx) => ({ id: item.id || idx, title: item.title || item.name || '', snippet: item.snippet || item.body || item.summary || '' }));
      } else if (data && typeof data === 'object') {
        // Try to extract fields if the API returned a single object with fields
        if (data.id || data.title || data.body) {
          results = [{ id: data.id || 0, title: data.title || data.name || '', snippet: data.snippet || data.body || data.summary || '' }];
        } else {
          // Unknown shape: return the raw payload under `raw` so the frontend can inspect
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

app.listen(PORT, () => {
  console.log(`Search server listening on http://localhost:${PORT}`);
});
