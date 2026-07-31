const qInput = document.getElementById('q');
const resultsDiv = document.getElementById('results');

qInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    await doSearch(qInput.value.trim());
  }
});

async function doSearch(q) {
  if (!q) { resultsDiv.innerHTML = ''; return; }
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  const payload = await res.json();
  renderResults(payload.results || [], q);
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
  if (!results.length) {
    resultsDiv.innerHTML = '<p>No results.</p>';
    return;
  }
  resultsDiv.innerHTML = results.map(r => `
    <div class="result">
      <div class="title">${escapeHtml(r.title)}</div>
      <div class="snippet">${highlight(r.snippet, q)}</div>
      <div><a href="/api/docs/${r.id}" target="_blank">View raw</a></div>
    </div>
  `).join('');
}
