// Showcase logic: languages, tabs, live status panel and CRUD demo.
// No frameworks: fetch + DOM, so the template reads at a glance.

import { LANGS, translations, jsDefaults } from './i18n.js';
import { initTraffic } from './traffic.js';

const $ = (sel) => document.querySelector(sel);

// ── Languages ───────────────────────────────────────────────────────────────
// English lives in the HTML; when switching to another language the original
// is saved so it can be restored. Preference persisted in localStorage.
let lang = localStorage.getItem('lang') || 'en';
if (!LANGS[lang]) lang = 'en';
const originals = new Map();

function t(key) {
  return (translations[lang] && translations[lang][key]) || jsDefaults[key] || key;
}

function applyLang(newLang) {
  lang = newLang;
  window.__lang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  const dict = translations[lang] || {};
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (!originals.has(key)) originals.set(key, el.innerHTML);
    el.innerHTML = dict[key] !== undefined ? dict[key] : originals.get(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (!originals.has(key)) originals.set(key, el.placeholder);
    el.placeholder = dict[key] !== undefined ? dict[key] : originals.get(key);
  });
  renderLangSwitcher();
  // Re-paint the JS-generated areas with the new language strings.
  if (lastStatus) paintStatus(lastStatus);
  if (lastItems) paintItems(lastItems);
  window.dispatchEvent(new Event('vt-lang'));
}

function renderLangSwitcher() {
  const box = $('#lang-switcher');
  box.innerHTML = `
    <button id="lang-btn" class="lang-btn" title="${LANGS[lang].name}">
      <span class="flag">${LANGS[lang].flag}</span>
      <span class="lang-code">${lang.toUpperCase()}</span>
      <span class="caret">▾</span>
    </button>
    <div id="lang-menu" class="lang-menu hidden">
      ${Object.entries(LANGS).map(([code, l]) => `
        <button data-lang="${code}" class="${code === lang ? 'current' : ''}">
          <span class="flag">${l.flag}</span> ${l.name}
        </button>`).join('')}
    </div>`;
  $('#lang-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#lang-menu').classList.toggle('hidden');
  });
  box.querySelectorAll('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => applyLang(b.dataset.lang)));
}

document.addEventListener('click', () => $('#lang-menu')?.classList.add('hidden'));

// ── Mermaid diagrams ────────────────────────────────────────────────────────
// Only VISIBLE diagrams are rendered: rendering inside a display:none container
// (hidden tab or collapsed section) produces "translate(undefined, NaN)".
// offsetParent is null for hidden elements, so we skip those and render them
// later, when their tab is shown or their section is expanded.
async function renderDiagrams(root) {
  if (!window.mermaid) return; // still loading; the mermaid-ready event retries
  const pending = [...root.querySelectorAll('pre.mermaid:not([data-processed])')]
    .filter((el) => el.offsetParent !== null);
  if (!pending.length) return;
  await window.mermaid.run({ nodes: pending });
  // Make each rendered diagram clickable to open the zoom viewer.
  pending.forEach((node) => {
    if (node.dataset.zoomBound) return;
    node.dataset.zoomBound = '1';
    node.classList.add('zoomable');
    node.addEventListener('click', () => openZoom(node));
  });
}

window.addEventListener('mermaid-ready', () => renderDiagrams($('section.tab.active')));

// ── Diagram zoom viewer (pan + wheel-zoom, no libraries) ─────────────────────
let zoomEl = null;
function buildZoom() {
  const overlay = document.createElement('div');
  overlay.id = 'zoom-modal';
  overlay.className = 'zoom-modal hidden';
  overlay.innerHTML = `
    <div class="zoom-bar">
      <button data-z="out" aria-label="Zoom out">−</button>
      <button data-z="reset" aria-label="Reset zoom">⟲</button>
      <button data-z="in" aria-label="Zoom in">＋</button>
      <button data-z="close" aria-label="Close">✕</button>
    </div>
    <div class="zoom-stage"><div class="zoom-content"></div></div>`;
  document.body.appendChild(overlay);

  const stage = overlay.querySelector('.zoom-stage');
  const content = overlay.querySelector('.zoom-content');
  const st = { scale: 1, tx: 0, ty: 0, drag: false, sx: 0, sy: 0 };
  const apply = () => { content.style.transform = `translate(${st.tx}px,${st.ty}px) scale(${st.scale})`; };
  const reset = () => { st.scale = 1; st.tx = 0; st.ty = 0; apply(); };
  const zoomAt = (factor, cx, cy) => {
    const rect = stage.getBoundingClientRect();
    const ox = cx - rect.left - rect.width / 2;
    const oy = cy - rect.top - rect.height / 2;
    const ns = Math.min(Math.max(st.scale * factor, 0.3), 8);
    const k = ns / st.scale;
    st.tx = ox - (ox - st.tx) * k;
    st.ty = oy - (oy - st.ty) * k;
    st.scale = ns;
    apply();
  };
  stage.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.15 : 0.87, e.clientX, e.clientY); }, { passive: false });
  stage.addEventListener('mousedown', (e) => { st.drag = true; st.sx = e.clientX - st.tx; st.sy = e.clientY - st.ty; stage.classList.add('grabbing'); });
  window.addEventListener('mousemove', (e) => { if (!st.drag) return; st.tx = e.clientX - st.sx; st.ty = e.clientY - st.sy; apply(); });
  window.addEventListener('mouseup', () => { st.drag = false; stage.classList.remove('grabbing'); });
  overlay.querySelector('.zoom-bar').addEventListener('click', (e) => {
    const z = e.target.dataset.z;
    if (z === 'in') zoomAt(1.3, innerWidth / 2, innerHeight / 2);
    else if (z === 'out') zoomAt(0.77, innerWidth / 2, innerHeight / 2);
    else if (z === 'reset') reset();
    else if (z === 'close') closeZoom();
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeZoom(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeZoom(); });
  return { overlay, content, reset };
}
// Move the real SVG into the viewer (no clone → no duplicate-id CSS glitches,
// renders exactly as inline). Restore it to its <pre> on close. Force a large
// base width so it actually fills the viewer; wheel/drag zoom from there.
let zoomState = null;
function openZoom(pre) {
  const svg = pre.querySelector('svg');
  if (!svg) return;
  if (!zoomEl) zoomEl = buildZoom();
  zoomState = { svg, parent: pre, style: svg.getAttribute('style') || '' };
  svg.setAttribute('style', 'width:84vw;height:auto;max-width:none;max-height:none;display:block;');
  zoomEl.content.appendChild(svg);
  zoomEl.reset();
  zoomEl.overlay.classList.remove('hidden');
}
function closeZoom() {
  if (zoomState) {
    zoomState.svg.setAttribute('style', zoomState.style);
    zoomState.parent.appendChild(zoomState.svg);
    zoomState = null;
  }
  zoomEl?.overlay.classList.add('hidden');
}

// ── Collapsible sections ─────────────────────────────────────────────────────
// Every top-level h2/h3 in a tab becomes a toggle for the content beneath it
// (up to the next header). Collapsed state is persisted in localStorage, like
// the language. The chevron is a CSS pseudo-element on the header, so it
// survives the innerHTML swap that language switching does to translated text.
const collapsed = new Set(JSON.parse(localStorage.getItem('vt-collapsed') || '[]'));
const saveCollapsed = () => localStorage.setItem('vt-collapsed', JSON.stringify([...collapsed]));

function setupCollapsibles() {
  document.querySelectorAll('section.tab').forEach((tab) => {
    let idx = 0;
    [...tab.children].forEach((node) => {
      if (node.tagName !== 'H2' && node.tagName !== 'H3') return;
      const id = `${tab.id}:${idx++}`;
      const body = document.createElement('div');
      body.className = 'sec-body';
      let sib = node.nextElementSibling;
      while (sib && sib.tagName !== 'H2' && sib.tagName !== 'H3') {
        const next = sib.nextElementSibling;
        body.appendChild(sib);
        sib = next;
      }
      node.after(body);
      node.classList.add('sec-h');
      node.dataset.collapseId = id;
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      const apply = (isCollapsed) => {
        node.classList.toggle('collapsed', isCollapsed);
        body.classList.toggle('hidden', isCollapsed);
        isCollapsed ? collapsed.add(id) : collapsed.delete(id);
      };
      apply(collapsed.has(id));
      const toggle = () => {
        const willCollapse = !node.classList.contains('collapsed');
        apply(willCollapse);
        saveCollapsed();
        if (!willCollapse) renderDiagrams(body);
      };
      node.addEventListener('click', toggle);
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  });
}

function setAllCollapsed(isCollapsed) {
  const tab = $('section.tab.active');
  if (!tab) return;
  tab.querySelectorAll('.sec-h').forEach((h) => {
    const body = h.nextElementSibling;
    h.classList.toggle('collapsed', isCollapsed);
    body.classList.toggle('hidden', isCollapsed);
    isCollapsed ? collapsed.add(h.dataset.collapseId) : collapsed.delete(h.dataset.collapseId);
    if (!isCollapsed) renderDiagrams(body);
  });
  saveCollapsed();
}

$('#collapse-all')?.addEventListener('click', () => setAllCollapsed(true));
$('#expand-all')?.addEventListener('click', () => setAllCollapsed(false));

// ── Tabs (with hash deep-linking: /#traffic) ────────────────────────────────
function activateTab(tab) {
  const btn = $(`#tabs button[data-tab="${tab}"]`);
  if (!btn) return;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('section.tab').forEach((s) => s.classList.remove('active'));
  btn.classList.add('active');
  const section = $(`#tab-${tab}`);
  section.classList.add('active');
  renderDiagrams(section);
  // The traffic dashboard loads the first time its tab is opened.
  if (tab === 'traffic') initTraffic();
}

document.querySelectorAll('#tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    history.replaceState(null, '', '#' + btn.dataset.tab);
    activateTab(btn.dataset.tab);
  });
});

// ── Connection status ───────────────────────────────────────────────────────
let lastStatus = null;

function statCard(label, value, cls = '') {
  return `<div class="stat ${cls}"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function paintStatus(s) {
  const badge = $('#mode-badge');
  const dynOk = s.dynamo.reachable;
  const mode = s.storage.mode;
  badge.textContent = mode === 'dynamodb'
    ? t('js.badge.dynamo').replace('{table}', s.storage.table).replace('{region}', s.storage.region)
    : t('js.badge.memory');
  badge.className = 'badge ' + (mode === 'dynamodb' ? 'ok' : 'warn');

  const envRows = Object.entries(s.env)
    .map(([k, v]) => `${v ? '✅' : '—'} ${k}`)
    .join('<br/>');

  $('#status-panel').innerHTML = [
    statCard(t('js.stat.mode'), mode.toUpperCase(), mode === 'dynamodb' ? 'ok' : 'warn'),
    statCard(t('js.stat.dynamo'), dynOk
      ? `✅ ${s.dynamo.tableStatus} · ${s.dynamo.latencyMs} ms`
      : (s.dynamo.enabled ? t('js.stat.noaccess') : t('js.stat.disabled')),
      dynOk ? 'ok' : (s.dynamo.enabled ? 'err' : 'warn')),
    statCard(t('js.stat.detail'), s.dynamo.detail || '—'),
    statCard(t('js.stat.platform'), s.runtime.platform + (s.runtime.region ? ` · ${s.runtime.region}` : '')),
    statCard('Node', s.runtime.node),
    statCard(t('js.stat.uptime'), s.runtime.uptimeSeconds + ' s'),
    statCard(t('js.stat.env'), envRows),
  ].join('');
  $('#status-raw').textContent = JSON.stringify(s, null, 2);
}

async function loadStatus() {
  try {
    lastStatus = await fetch('/api/status').then((r) => r.json());
    paintStatus(lastStatus);
  } catch (err) {
    $('#status-panel').innerHTML = statCard(t('js.error'), String(err), 'err');
  }
}

$('#refresh-status').addEventListener('click', loadStatus);

// ── CRUD demo ───────────────────────────────────────────────────────────────
let lastItems = null;

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function paintItems(items) {
  const box = $('#items-list');
  if (!items.length) {
    box.innerHTML = `<p class="hint">${t('js.items.empty')}</p>`;
    return;
  }
  box.innerHTML = '<ul class="items">' + items.map((i) => `
    <li>
      <div>
        <div>${escapeHtml(i.text)}</div>
        <div class="meta">${i.id} · ${new Date(i.createdAt).toLocaleString()}</div>
      </div>
      <button class="btn danger" data-del="${i.id}">${t('js.items.delete')}</button>
    </li>`).join('') + '</ul>';
  box.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      await fetch(`/api/items/${b.dataset.del}`, { method: 'DELETE' });
      loadItems();
    }));
}

async function loadItems() {
  try {
    const { items } = await fetch('/api/items').then((r) => r.json());
    lastItems = items;
    paintItems(items);
  } catch (err) {
    $('#items-list').innerHTML = `<p class="hint">${t('js.items.loaderr')} ${err}</p>`;
  }
}

$('#add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#add-text');
  const text = input.value.trim();
  if (!text) return;
  const res = await fetch('/api/items', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (res.ok) {
    input.value = '';
    loadItems();
  } else {
    alert(t('js.error') + ': ' + ((await res.json()).error || res.status));
  }
});

// ── curl examples with the real URL ─────────────────────────────────────────
$('#curl-examples').textContent = $('#curl-examples').textContent
  .replaceAll('BASE', window.location.origin);

// ── Startup ─────────────────────────────────────────────────────────────────
applyLang(lang);
setupCollapsibles();
loadStatus();
loadItems();
// Initial deep-link: if the URL carries #<tab>, open that tab.
const initialTab = location.hash.replace('#', '');
if (initialTab) activateTab(initialTab);
