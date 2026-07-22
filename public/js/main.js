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
// Only the visible tab's diagrams are rendered: rendering inside a
// display:none container produces "translate(undefined, NaN)".
async function renderDiagrams(section) {
  if (!window.mermaid) return; // still loading; the mermaid-ready event retries
  const pending = section.querySelectorAll('pre.mermaid:not([data-processed])');
  if (pending.length) await window.mermaid.run({ nodes: pending });
}

window.addEventListener('mermaid-ready', () => renderDiagrams($('section.tab.active')));

// ── Tabs (with hash deep-linking: /#trafico) ────────────────────────────────
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
  if (tab === 'trafico') initTraffic();
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
loadStatus();
loadItems();
// Initial deep-link: if the URL carries #<tab>, open that tab.
const initialTab = location.hash.replace('#', '');
if (initialTab) activateTab(initialTab);
