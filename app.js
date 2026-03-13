/* ─── Config ─────────────────────────────────────────────────
   Credentials are stored in localStorage (browser only, never sent anywhere else).
   JSONBin free tier: https://jsonbin.io
   ──────────────────────────────────────────────────────────── */

const JSONBIN_BASE = 'https://api.jsonbin.io/v3';
const LS_KEY_APIKEY = 'dp_vault_apikey';
const LS_KEY_BINID  = 'dp_vault_binid';

const PHASES = [
  'Phase 1 — Foundations',
  'Phase 2 — SOLID',
  'Phase 3 — Patterns',
  'Phase 4 — Systems',
];

// ── State ────────────────────────────────────────────────────
let allEntries    = [];
let activeTab     = 'all';
let activeFilter  = 'all';
let apiKey        = localStorage.getItem(LS_KEY_APIKEY) || '';
let binId         = localStorage.getItem(LS_KEY_BINID)  || '';

// ── Boot ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  if (!apiKey || !binId) {
    document.getElementById('configOverlay').classList.add('open');
  } else {
    loadData();
  }
});

// ── Config save ───────────────────────────────────────────────
function saveConfig() {
  const k = document.getElementById('cfgApiKey').value.trim();
  const b = document.getElementById('cfgBinId').value.trim();
  if (!k || !b) { showToast('Please fill in both fields'); return; }
  apiKey = k; binId = b;
  localStorage.setItem(LS_KEY_APIKEY, k);
  localStorage.setItem(LS_KEY_BINID,  b);
  document.getElementById('configOverlay').classList.remove('open');
  loadData();
}

// ── Fetch data from JSONBin ───────────────────────────────────
async function loadData() {
  setHeaderSub('Syncing...');
  try {
    const res = await fetch(`${JSONBIN_BASE}/b/${binId}/latest`, {
      headers: { 'X-Master-Key': apiKey }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    allEntries = Array.isArray(json.record?.entries) ? json.record.entries : [];
    renderAll();
    showToast('Vault synced ✓');
  } catch (e) {
    console.error(e);
    setHeaderSub('Could not connect — check your credentials');
    showToast('Sync failed: ' + e.message);
    // Show demo data if fetch fails
    allEntries = getDemoEntries();
    renderAll();
  }
}

// ── Render everything ─────────────────────────────────────────
function renderAll() {
  renderStats();
  renderFilterChips();
  renderPanels();
  renderProgress();
}

function renderStats() {
  const codes   = allEntries.filter(e => e.type === 'code');
  const mcqs    = allEntries.filter(e => e.type === 'mcq');
  const correct = mcqs.filter(e => e.correct).length;
  const pct     = mcqs.length ? Math.round(correct / mcqs.length * 100) : null;

  document.querySelector('#sc-total .stat-num').textContent  = allEntries.length || '0';
  document.querySelector('#sc-code  .stat-num').textContent  = codes.length      || '0';
  document.querySelector('#sc-mcq   .stat-num').textContent  = mcqs.length       || '0';
  document.querySelector('#sc-score .stat-num').textContent  = pct !== null ? pct + '%' : '—';

  setHeaderSub(
    allEntries.length === 0
      ? 'No exercises yet — start learning!'
      : `${allEntries.length} exercise${allEntries.length !== 1 ? 's' : ''} across ${[...new Set(allEntries.map(e => e.phase))].filter(Boolean).length} phase${[...new Set(allEntries.map(e => e.phase))].filter(Boolean).length !== 1 ? 's' : ''}`
  );
}

function renderFilterChips() {
  const phases = [...new Set(allEntries.map(e => e.phase))].filter(Boolean);
  const row = document.getElementById('filterRow');
  row.innerHTML = ['All', ...phases].map(p =>
    `<button class="chip${(p === 'All' && activeFilter === 'all') || p === activeFilter ? ' active' : ''}"
      onclick="setFilter('${p === 'All' ? 'all' : p}')">${p}</button>`
  ).join('');
}

function renderPanels() {
  const filtered = activeFilter === 'all'
    ? allEntries
    : allEntries.filter(e => e.phase === activeFilter);
  const sorted = [...filtered].reverse(); // newest first

  ['all', 'code', 'mcq', 'uml'].forEach(tab => {
    const panelId = `panel-${tab}`;
    const subset  = tab === 'all' ? sorted : sorted.filter(e => e.type === tab);
    document.getElementById(panelId).innerHTML = subset.length
      ? `<div class="entries-grid">${subset.map((e, i) => renderEntryCard(e, i, tab)).join('')}</div>`
      : renderEmpty(tab);
  });
}

function renderEntryCard(e, i, ns) {
  const id    = `${ns}_${i}`;
  const badge = e.type === 'code' ? 'badge-code' : e.type === 'mcq' ? 'badge-mcq' : 'badge-uml';
  const delay = Math.min(i * 0.04, 0.4);

  let resultRow = '';
  if (e.type === 'mcq') {
    resultRow = `<div class="entry-result">
      <div class="result-dot ${e.correct ? 'ok' : 'bad'}"></div>
      <div class="result-text">${e.correct ? 'Correct' : 'Incorrect'} — ${e.topic || ''}</div>
    </div>`;
  } else if (e.type === 'code') {
    resultRow = `<div class="entry-result">
      <div class="result-dot ok"></div>
      <div class="result-text">${e.topic || ''}</div>
    </div>`;
  }

  return `<div class="entry-card" style="animation-delay:${delay}s" onclick="openModal(${JSON.stringify(JSON.stringify(e))})">
    <div class="entry-head">
      <span class="entry-type-badge ${badge}">${e.type}</span>
      <span class="entry-title">${esc(e.title || 'Untitled exercise')}</span>
      <span class="entry-phase">${esc(e.phase || '')}</span>
      <span class="entry-date">${formatDate(e.ts)}</span>
    </div>
    ${resultRow}
  </div>`;
}

function renderEmpty(tab) {
  const msgs = {
    all:  ['[ ]', 'No exercises saved yet.<br>Complete an exercise in your Claude session and it will appear here.'],
    code: ['</>', 'No code submissions yet.<br>Write some C++ in your Claude session!'],
    mcq:  ['?',   'No MCQs answered yet.<br>Answer a quick-check in your Claude session.'],
    uml:  ['⊞',   'No UML diagrams yet.<br>Draw a class diagram in your Claude session.'],
  };
  const [icon, msg] = msgs[tab] || msgs.all;
  return `<div class="empty"><div class="empty-icon">${icon}</div>${msg}</div>`;
}

// ── Progress panel ────────────────────────────────────────────
function renderProgress() {
  const phaseData = PHASES.map(phase => {
    const items   = allEntries.filter(e => e.phase === phase);
    const topics  = [...new Set(items.map(e => e.topic).filter(Boolean))];
    const maxEx   = 8; // rough target per phase
    return { phase, count: items.length, topics, pct: Math.min(Math.round(items.length / maxEx * 100), 100) };
  });

  document.getElementById('progressGrid').innerHTML = phaseData.map(d => `
    <div class="progress-card">
      <div class="progress-card-header">
        <div class="progress-card-title">${d.phase}</div>
        <div class="progress-card-count">${d.count} exercise${d.count !== 1 ? 's' : ''}</div>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width:${d.pct}%"></div>
      </div>
      <div class="progress-topics">
        ${d.topics.length
          ? d.topics.map(t => `<span class="topic-chip done">${esc(t)}</span>`).join('')
          : '<span class="topic-chip">Not started</span>'}
      </div>
    </div>`
  ).join('');
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(jsonStr) {
  const e = JSON.parse(jsonStr);
  document.getElementById('modalTitle').textContent = e.title || 'Exercise detail';

  let body = `<div class="modal-meta">
    <span class="meta-pill">${e.type?.toUpperCase()}</span>
    <span class="meta-pill">${esc(e.phase || '—')}</span>
    <span class="meta-pill">${esc(e.topic || '—')}</span>
    <span class="meta-pill">${formatDate(e.ts)}</span>
  </div>`;

  if (e.type === 'code') {
    body += `
      <div class="code-block">
        <div class="code-block-header">
          <div class="dot r"></div><div class="dot y"></div><div class="dot g"></div>
          <span class="code-lang">C++</span>
        </div>
        <pre>${esc(e.content || '')}</pre>
      </div>
      ${e.feedback ? `<div class="feedback-block good"><strong>Review:</strong><br>${esc(e.feedback)}</div>` : ''}`;
  } else if (e.type === 'mcq') {
    body += `<div class="mcq-result-block">
      <div class="mcq-question">${esc(e.question || '')}</div>
      <div class="mcq-answer-row ${e.correct ? 'correct' : 'wrong'}">
        ${e.correct ? '✓' : '✗'} ${esc(e.answer || '')}
      </div>
      ${e.explanation ? `<div class="feedback-block ${e.correct ? 'good' : 'bad'}">${esc(e.explanation)}</div>` : ''}
    </div>`;
  } else {
    body += `<div class="feedback-block good">${esc(e.content || 'UML diagram submitted.')}</div>`;
  }

  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modal').classList.add('open');
  document.getElementById('modalBackdrop').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  document.getElementById('modalBackdrop').classList.remove('open');
}

// ── Tabs ──────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`panel-${activeTab}`).classList.add('active');
    });
  });
}

// ── Filter ────────────────────────────────────────────────────
function setFilter(f) {
  activeFilter = f;
  renderFilterChips();
  renderPanels();
}

// ── Helpers ───────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
}

function setHeaderSub(msg) {
  document.getElementById('headerSub').textContent = msg;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Demo entries (shown on connection failure for preview) ────
function getDemoEntries() {
  return [
    { type:'code',  title:'Strategy Pattern — PaymentProcessor refactor', phase:'Phase 3 — Patterns', topic:'Strategy', ts: Date.now()-86400000*2, content:'// Demo entry\nclass IPaymentStrategy {\npublic:\n  virtual void pay(double amount) = 0;\n};', feedback:'Good use of pure virtual interface.' },
    { type:'mcq',   title:'SRP quick check', phase:'Phase 2 — SOLID', topic:'SRP', ts: Date.now()-86400000, question:'Which principle says a class should have one reason to change?', answer:'Single Responsibility Principle', correct:true, explanation:'SRP: one responsibility = one reason to change.' },
    { type:'uml',   title:'Observer Pattern UML', phase:'Phase 3 — Patterns', topic:'Observer', ts: Date.now()-3600000, content:'Drew ISubject, ConcreteSubject, IObserver, ConcreteObserver with correct relationships.' },
  ];
}

/* ─── PUBLIC API ─────────────────────────────────────────────
   Called by Claude's exercise widgets via postMessage or direct
   window.vaultPost(entry) when embedded in same origin.

   For cross-origin posting from Claude widgets, we listen for
   postMessage events with { type: 'VAULT_SAVE', entry: {...} }
   ──────────────────────────────────────────────────────────── */
window.vaultPost = async function(entry) {
  if (!apiKey || !binId) {
    showToast('Vault not connected — open Settings');
    return { ok: false };
  }
  try {
    // Fetch current bin
    const getRes = await fetch(`${JSONBIN_BASE}/b/${binId}/latest`, {
      headers: { 'X-Master-Key': apiKey }
    });
    const current = await getRes.json();
    const entries = Array.isArray(current.record?.entries) ? current.record.entries : [];

    // Append new entry
    entries.push({ ...entry, ts: entry.ts || Date.now() });

    // Write back
    await fetch(`${JSONBIN_BASE}/b/${binId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': apiKey },
      body:    JSON.stringify({ entries })
    });

    allEntries = entries;
    renderAll();
    showToast('Saved to vault!');
    return { ok: true };
  } catch(err) {
    console.error(err);
    showToast('Save failed: ' + err.message);
    return { ok: false, error: err.message };
  }
};
