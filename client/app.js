const qInput = document.getElementById('q');
const resultsDiv = document.getElementById('results');

qInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    await doSearch(qInput.value.trim());
  }
});

async function doSearch(q) {
  if (!q) { resultsDiv.innerHTML = ''; return; }
  // Request more results (30) by default
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=30`);
  const payload = await res.json();
  renderResults(payload.results || payload.raw || [], q);
}

function escapeHtml(s) {
  return s.replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function highlight(text, q) {
  if (!q) return escapeHtml(text);
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
  return escapeHtml(text).replace(re, '<mark>$1</mark>');
}

function renderResults(results, q) {
  if (!results || results.length === 0) {
    resultsDiv.innerHTML = '<p>No results.</p>';
    return;
  }
  // Show number of results returned (client-side limited to 30)
  const header = `<p>Showing ${results.length} result${results.length !== 1 ? 's' : ''}</p>`;

  resultsDiv.innerHTML = header + results.map(r => `
    <div class="result">
      <div class="title">${escapeHtml(r.title)}</div>
      <div class="snippet">${highlight(r.snippet || '', q)}</div>
      <div>
        ${r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">Open link</a>` : (r.id ? `<a href="/api/docs/${r.id}" target="_blank">View raw</a>` : '')}
        ${r.score ? ` <small>score: ${escapeHtml(String(r.score))}</small>` : ''}
      </div>
    </div>
  `).join('');
}
