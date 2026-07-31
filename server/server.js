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
  // Increase default limit to 30 to request more results from Tavily
  const limit = parseInt(req.query.limit, 10) || 30;
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

      // Normalize common shapes into { results: [ { id, title, snippet, url } ] }
      let results = [];
      const toResult = (item, idx) => ({
        id: item && (item.id || item._id || item.doc_id) || idx,
        title: item && (item.title || item.name || item.heading) || '',
        snippet: item && (item.snippet || item.body || item.summary || item.excerpt) || '',
        url: item && (item.url || item.link || item.href || item.source_url) || null,
        score: item && (item.score || item.rank) || null
      });

      if (Array.isArray(data)) {
        results = data.map((item, idx) => toResult(item, idx));
      } else if (Array.isArray(data.results)) {
        results = data.results.map((item, idx) => toResult(item, idx));
      } else if (Array.isArray(data.items)) {
        results = data.items.map((item, idx) => toResult(item, idx));
      } else if (data.result && Array.isArray(data.result)) {
        results = data.result.map((item, idx) => toResult(item, idx));
      } else if (data && typeof data === 'object') {
        // Single object response: try to extract an array under a common key
        const possibleArrays = ['hits', 'documents', 'rows', 'matches'];
        let found = false;
        for (const k of possibleArrays) {
          if (Array.isArray(data[k])) {
            results = data[k].map((item, idx) => toResult(item, idx));
            found = true;
            break;
          }
        }
        if (!found) {
          if (data.id || data.title || data.body) {
            results = [toResult(data, 0)];
          } else {
            // Unknown shape: return raw so frontend can inspect
            return res.json({ raw: data });
          }
        }
      } else {
        return res.json({ results: [] });
      }

      // Respect the requested limit client-side as well (slice if upstream returned more)
      if (results.length > limit) results = results.slice(0, limit);

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
