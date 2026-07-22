// Lógica del showcase: idiomas, pestañas, panel de estado en vivo y demo CRUD.
// Sin frameworks: fetch + DOM, para que la plantilla sea legible de un vistazo.

import { LANGS, translations, jsDefaults } from './i18n.js';
import { initTraffic } from './traffic.js';

const $ = (sel) => document.querySelector(sel);

// ── Idiomas ─────────────────────────────────────────────────────────────────
// El inglés vive en el HTML; al cambiar a otro idioma se guarda el original
// para poder restaurarlo. Preferencia persistida en localStorage.
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
  // Re-pintar las zonas generadas por JS con las cadenas del idioma nuevo.
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

// ── Diagramas Mermaid ───────────────────────────────────────────────────────
// Solo se renderizan los diagramas de la pestaña visible: renderizar dentro
// de un contenedor display:none produce "translate(undefined, NaN)".
async function renderDiagrams(section) {
  if (!window.mermaid) return; // aún cargando; el evento mermaid-ready reintenta
  const pending = section.querySelectorAll('pre.mermaid:not([data-processed])');
  if (pending.length) await window.mermaid.run({ nodes: pending });
}

window.addEventListener('mermaid-ready', () => renderDiagrams($('section.tab.active')));

// ── Pestañas (con deep-linking por hash: /#trafico) ─────────────────────────
function activateTab(tab) {
  const btn = $(`#tabs button[data-tab="${tab}"]`);
  if (!btn) return;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('section.tab').forEach((s) => s.classList.remove('active'));
  btn.classList.add('active');
  const section = $(`#tab-${tab}`);
  section.classList.add('active');
  renderDiagrams(section);
  // El dashboard de tráfico se carga la primera vez que se abre su pestaña.
  if (tab === 'trafico') initTraffic();
}

document.querySelectorAll('#tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    history.replaceState(null, '', '#' + btn.dataset.tab);
    activateTab(btn.dataset.tab);
  });
});

// ── Estado de conexiones ────────────────────────────────────────────────────
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

// ── Demo CRUD ───────────────────────────────────────────────────────────────
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

// ── Ejemplos curl con la URL real ───────────────────────────────────────────
$('#curl-examples').textContent = $('#curl-examples').textContent
  .replaceAll('BASE', window.location.origin);

// ── Arranque ────────────────────────────────────────────────────────────────
applyLang(lang);
loadStatus();
loadItems();
// Deep-link inicial: si la URL trae #<tab>, abrir esa pestaña.
const initialTab = location.hash.replace('#', '');
if (initialTab) activateTab(initialTab);
