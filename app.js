/* ═══════════════════════════════════════════════════════════
   dp-vault — app.js
   Storage : data.json in your GitHub repo (Contents API)
   Credentials : localStorage (browser-only, never transmitted
                 except directly to api.github.com)
   ═══════════════════════════════════════════════════════════ */

const GITHUB_API = 'https://api.github.com';
const LS_TOKEN   = 'dp_vault_gh_token';
const LS_REPO    = 'dp_vault_gh_repo';
const DATA_PATH  = 'data.json';

const PHASES = [
  'Phase 1 — Foundations',
  'Phase 2 — SOLID',
  'Phase 3 — Patterns',
  'Phase 4 — Systems',
];

// ── State ────────────────────────────────────────────────────
let entries      = [];
let activeTab    = 'all';
let activeFilter = 'all';
let ghToken      = localStorage.getItem(LS_TOKEN) || '';
let ghRepo       = localStorage.getItem(LS_REPO)  || '';
let fileSha      = '';

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  loadData();
});

// ── GitHub API ────────────────────────────────────────────────
async function ghGet(path) {
  const r = await fetch(`${GITHUB_API}/repos/${ghRepo}/contents/${path}`, {
    headers: { 'Authorization':`Bearer ${ghToken}`, 'Accept':'application/vnd.github+json' }
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

async function ghPut(path, content, sha, message) {
  const r = await fetch(`${GITHUB_API}/repos/${ghRepo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization':`Bearer ${ghToken}`,
      'Accept':'application/vnd.github+json',
      'Content-Type':'application/json',
    },
    body: JSON.stringify({
      message,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(content,null,2)))),
      ...(sha ? { sha } : {}),
    })
  });
  if (!r.ok) {
    const err = await r.json().catch(()=>({}));
    throw new Error(err.message || `PUT failed: ${r.status}`);
  }
  return r.json();
}

// ── Load ──────────────────────────────────────────────────────
async function loadData() {
  if (!ghToken || !ghRepo) {
    setSub('not connected — click ⚙ settings');
    entries = [];
    renderAll();
    return;
  }
  setSub('syncing...');
  try {
    const file = await ghGet(DATA_PATH);
    fileSha    = file.sha;
    const raw  = decodeURIComponent(escape(atob(file.content.replace(/\n/g,''))));
    entries    = JSON.parse(raw)?.entries || [];
    renderAll();
    showToast('synced ✓');
  } catch(e) {
    if (e.message.startsWith('404')) {
      entries = []; fileSha = '';
      renderAll();
      setSub('no data yet — complete your first exercise');
    } else {
      setSub('sync error — check token & repo');
      showToast('error: ' + e.message);
      entries = [];
      renderAll();
    }
  }
}

// ── Save ──────────────────────────────────────────────────────
async function saveToGitHub(entry) {
  if (!ghToken || !ghRepo) { showToast('error: not connected'); return false; }
  const updated = [...entries, { ...entry, ts: entry.ts || Date.now() }];
  try {
    const res = await ghPut(
      DATA_PATH, { entries: updated }, fileSha,
      `feat(vault): ${entry.type} — ${entry.title || entry.topic || 'exercise'}`
    );
    fileSha = res.content.sha;
    entries = updated;
    renderAll();
    showToast('saved → github ✓');
    return true;
  } catch(e) {
    showToast('save failed: ' + e.message);
    return false;
  }
}

// ── Import ────────────────────────────────────────────────────
function openImport() {
  document.getElementById('importInput').value = '';
  document.getElementById('importError').textContent = '';
  document.getElementById('importOverlay').classList.add('open');
  setTimeout(() => document.getElementById('importInput').focus(), 80);
}
function closeImport() { document.getElementById('importOverlay').classList.remove('open'); }

async function doImport() {
  const raw   = document.getElementById('importInput').value.trim();
  const errEl = document.getElementById('importError');
  errEl.textContent = '';
  if (!raw) { errEl.textContent = '// error: empty input'; return; }
  let entry;
  try { entry = JSON.parse(raw); }
  catch(e) { errEl.textContent = '// error: invalid JSON'; return; }
  if (!['code','mcq','uml'].includes(entry.type)) {
    errEl.textContent = '// error: type must be code | mcq | uml';
    return;
  }
  closeImport();
  const ok = await saveToGitHub(entry);
  if (!ok) openImport();
}

// ── Settings ──────────────────────────────────────────────────
function openSettings() {
  document.getElementById('cfgToken').value = ghToken || '';
  document.getElementById('cfgRepo').value  = ghRepo  || '';
  document.getElementById('settingsOverlay').classList.add('open');
}
function closeSettings() { document.getElementById('settingsOverlay').classList.remove('open'); }
function saveSettings() {
  const t = document.getElementById('cfgToken').value.trim();
  const r = document.getElementById('cfgRepo').value.trim();
  if (!t || !r) { showToast('error: fill in both fields'); return; }
  ghToken = t; ghRepo = r;
  localStorage.setItem(LS_TOKEN, ghToken);
  localStorage.setItem(LS_REPO,  ghRepo);
  closeSettings();
  loadData();
}

// ── Export / Clear ────────────────────────────────────────────
function exportAll() {
  const blob = new Blob([JSON.stringify({entries},null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dp-vault-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('exported ✓');
}

async function clearAll() {
  if (!confirm('clear all entries in data.json? this cannot be undone.')) return;
  try {
    const res = await ghPut(DATA_PATH,{entries:[]},fileSha,'chore(vault): clear all entries');
    fileSha = res.content.sha;
    entries = [];
    renderAll();
    showToast('cleared ✓');
  } catch(e) { showToast('clear failed: ' + e.message); }
}

// ── Render ────────────────────────────────────────────────────
function renderAll() {
  renderStats();
  renderChips();
  renderPanels();
  renderProgress();
}

function renderStats() {
  const codes   = entries.filter(e=>e.type==='code');
  const mcqs    = entries.filter(e=>e.type==='mcq');
  const correct = mcqs.filter(e=>e.correct).length;
  const pct     = mcqs.length ? Math.round(correct/mcqs.length*100) : null;
  const streak  = calcStreak();

  set('sc-total',  entries.length);
  set('sc-code',   codes.length);
  set('sc-mcq',    mcqs.length);
  set('sc-score',  pct !== null ? pct+'%' : '—');
  set('sc-streak', streak+'d');
  set('tabStatus', `${entries.length} entr${entries.length===1?'y':'ies'}`);
  setSub(statusLine());
}

function statusLine() {
  if (!entries.length) return 'no exercises yet — start learning';
  const phases = [...new Set(entries.map(e=>e.phase).filter(Boolean))];
  return `${entries.length} entries · ${phases.length} phases · ${calcStreak()}d streak · ${ghRepo}`;
}

function calcStreak() {
  if (!entries.length) return 0;
  const days = new Set(entries.map(e=>new Date(e.ts).toDateString()));
  let s=0, d=new Date();
  while(days.has(d.toDateString())){ s++; d.setDate(d.getDate()-1); }
  return s;
}

function renderChips() {
  const phases = [...new Set(entries.map(e=>e.phase).filter(Boolean))];
  document.getElementById('filterRow').innerHTML =
    ['all',...phases].map(p => {
      const active = p===activeFilter ? ' active' : '';
      return `<button class="chip${active}" onclick="setFilter('${esc(p)}')">${esc(p)}</button>`;
    }).join('');
}

function renderPanels() {
  const filtered = activeFilter==='all' ? entries : entries.filter(e=>e.phase===activeFilter);
  const sorted   = [...filtered].reverse();
  ['all','code','mcq','uml'].forEach(tab => {
    const rows = tab==='all' ? sorted : sorted.filter(e=>e.type===tab);
    document.getElementById(`panel-${tab}`).innerHTML = rows.length
      ? listHTML(rows) : emptyHTML(tab);
  });
}

function listHTML(rows) {
  return `<div class="list-header">
      <span class="lh-type">type</span>
      <span class="lh-title">title</span>
      <span class="lh-topic">topic</span>
      <span class="lh-phase">phase</span>
      <span class="lh-result">result</span>
      <span class="lh-date">date</span>
    </div>
    <div class="entries-list">
      ${rows.map((e,i)=>rowHTML(e,i)).join('')}
    </div>`;
}

function rowHTML(e, i) {
  const delay = Math.min(i*0.025, 0.3);
  const enc   = encodeURIComponent(JSON.stringify(e));
  let result='—', rClass='neu';
  if (e.type==='mcq')  { result=e.correct?'pass':'fail'; rClass=e.correct?'ok':'bad'; }
  else if (e.type==='code') { result='done'; rClass='ok'; }
  else { result='saved'; rClass='neu'; }

  return `<div class="entry-row type-${e.type}" style="animation-delay:${delay}s"
    onclick="openDetail('${enc}')">
    <span class="entry-type">${e.type}</span>
    <span class="entry-title">${esc(e.title||'untitled')}</span>
    <span class="entry-topic">${esc(e.topic||'—')}</span>
    <span class="entry-phase">${esc(e.phase||'—')}</span>
    <span class="entry-result ${rClass}">${result}</span>
    <span class="entry-date">${fmtDate(e.ts)}</span>
  </div>`;
}

function emptyHTML(tab) {
  const map = {
    all:  ['// no entries yet','// complete an exercise with Claude','// click ⊕ import to save it here'],
    code: ['// no code submissions yet'],
    mcq:  ['// no mcq answers yet'],
    uml:  ['// no uml diagrams yet'],
  };
  return `<div class="empty">${(map[tab]||map.all).map(l=>`<span class="empty-line comment">${l}</span>`).join('')}</div>`;
}

// ── Progress ──────────────────────────────────────────────────
function renderProgress() {
  document.getElementById('progressGrid').innerHTML =
    `<div class="prog-grid">` +
    PHASES.map(phase => {
      const items  = entries.filter(e=>e.phase===phase);
      const topics = [...new Set(items.map(e=>e.topic).filter(Boolean))];
      const pct    = Math.min(Math.round(items.length/8*100),100);
      return `<div class="prog-card">
        <div class="prog-head">
          <span class="prog-name">${phase}</span>
          <span class="prog-count">${items.length} / 8</span>
        </div>
        <div class="prog-bar-wrap"><div class="prog-bar" style="width:${pct}%"></div></div>
        <div class="prog-topics">
          ${topics.length
            ? topics.map(t=>`<span class="t-chip done">${esc(t)}</span>`).join('')
            : '<span class="t-chip">// not started</span>'}
        </div>
      </div>`;
    }).join('') + `</div>`;
}

// ── Detail modal ──────────────────────────────────────────────
function openDetail(enc) {
  const e = JSON.parse(decodeURIComponent(enc));
  document.getElementById('detailTitle').textContent = `[${e.type}] ${e.title||'exercise detail'}`;

  let body = `<div class="detail-meta">
    <span class="meta-tag type-${e.type}">${e.type}</span>
    <span class="meta-tag">${esc(e.phase||'—')}</span>
    <span class="meta-tag">${esc(e.topic||'—')}</span>
    <span class="meta-tag">${fmtDate(e.ts)}</span>
  </div>`;

  if (e.type==='code') {
    body += `<div class="code-block">
      <div class="code-block-header">
        <div class="dot r"></div><div class="dot y"></div><div class="dot g"></div>
        <span class="code-lang">c++</span>
      </div>
      <pre>${esc(e.content||'// no code recorded')}</pre>
    </div>
    ${e.feedback?`<div class="fb ok">// ${esc(e.feedback)}</div>`:''}`;
  } else if (e.type==='mcq') {
    body += `<div class="mcq-question">${esc(e.question||'')}</div>
    <div class="mcq-ans ${e.correct?'ok':'bad'}">${e.correct?'✓':'✗'} ${esc(e.answer||'')}</div>
    ${e.explanation?`<div class="fb ${e.correct?'ok':'bad'}">${esc(e.explanation)}</div>`:''}`;
  } else {
    body += `<div class="fb info">// ${esc(e.content||'uml diagram submitted')}</div>`;
  }

  document.getElementById('detailBody').innerHTML = body;
  document.getElementById('detailOverlay').classList.add('open');
}
function closeDetail() { document.getElementById('detailOverlay').classList.remove('open'); }
function closeDetailOuter(evt) { if(evt.target===document.getElementById('detailOverlay')) closeDetail(); }

// ── Tabs ──────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.tab[data-tab]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
      document.getElementById(`panel-${activeTab}`).classList.add('active');
    });
  });
}

function setFilter(f) { activeFilter=f; renderChips(); renderPanels(); }

// ── Helpers ───────────────────────────────────────────────────
const set    = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
const setSub = msg => set('headerSub', msg);

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts)
    .toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'})
    .toLowerCase().replace(/ /g,'-');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = '> ' + msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(()=>t.classList.remove('show'), 2600);
}
