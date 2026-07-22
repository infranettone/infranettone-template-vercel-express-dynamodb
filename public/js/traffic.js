// Traffic dashboard: time-range control, adaptive human/bot series, geographic
// and technical tops, and sortable + filterable + paginated tables (live access
// feed and visitor explorer).
//
// Charts as inline SVG (no libraries): validated categorical palette, thin
// marks with rounded ends, a 2px gap between stacked segments, legend + direct
// labels and a tooltip on hover. Tables sort/paginate on the client over the
// range+limit-bounded set the backend returns, so it stays fast and navigable
// even if the table grows to millions of rows (you narrow the range).

import { tr } from './i18n.js';

const $ = (s, r = document) => r.querySelector(s);
const lang = () => window.__lang || 'en';
const t = (k) => tr(lang(), k);

// Palette (dark, validated with the dataviz skill validator):
const C = { human: '#3987e5', bot: '#d95926', s3: '#199e70', s4: '#c98500', s5: '#d55181' };

// UI state (survives re-renders; never triggers a fetch on its own except load()).
const DEFAULTS = { range: '24h', from: '', to: '', limit: 500, auto: false, autoSecs: 15 };
const ui = {
  ...DEFAULTS, country: '',
  feed: { sort: { col: 'ts', dir: 'desc' }, page: 1, size: 25, filter: 'all', search: '' },
  visitors: { sort: { col: 'lastSeen', dir: 'desc' }, page: 1, size: 25 },
};
let autoTimer = null;

// Persist the toolbar choices in localStorage (like the language). Country and
// per-table sort/page are intentionally per-session, not persisted.
const PAGE_SIZES = [10, 25, 50, 100];
function savePrefs() {
  localStorage.setItem('vt-traffic', JSON.stringify({
    range: ui.range, from: ui.from, to: ui.to, limit: ui.limit, auto: ui.auto, autoSecs: ui.autoSecs,
    // Full table view state, so a reload lands on the same page/sort/filter.
    feed: { size: ui.feed.size, page: ui.feed.page, sort: ui.feed.sort, filter: ui.feed.filter },
    visitors: { size: ui.visitors.size, page: ui.visitors.page, sort: ui.visitors.sort },
  }));
}
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem('vt-traffic') || '{}');
    if (RANGES.includes(p.range)) ui.range = p.range;
    if (typeof p.from === 'string') ui.from = p.from;
    if (typeof p.to === 'string') ui.to = p.to;
    if (LIMITS.includes(p.limit)) ui.limit = p.limit;
    if (typeof p.auto === 'boolean') ui.auto = p.auto;
    if (Number(p.autoSecs) >= 3) ui.autoSecs = Math.min(Number(p.autoSecs), 3600);
    const restore = (dst, src) => {
      if (!src) return;
      if (PAGE_SIZES.includes(src.size)) dst.size = src.size;
      if (Number.isInteger(src.page) && src.page >= 1) dst.page = src.page;
      if (src.sort && typeof src.sort.col === 'string') dst.sort = { col: src.sort.col, dir: src.sort.dir === 'asc' ? 'asc' : 'desc' };
      if (typeof src.filter === 'string') dst.filter = src.filter;
    };
    restore(ui.feed, p.feed);
    restore(ui.visitors, p.visitors);
  } catch { /* ignore corrupt prefs */ }
}
function resetPrefs() {
  Object.assign(ui, DEFAULTS);
  ui.country = '';
  setAuto(false);
  savePrefs();
  renderControls();
  load();
}

const RANGES = ['1h', '24h', '7d', '30d', '90d', '1y', 'custom'];
const LIMITS = [100, 250, 500, 1000, 2000];

// Approximate country centroids [lat, lon] for the world map. Codes not listed
// (and LOCAL/ZZ) simply don't appear on the map — they still show in the lists.
const CENTROIDS = {
  ES: [40, -4], US: [38, -97], DE: [51, 10], FR: [46, 2], GB: [54, -2], MX: [23, -102],
  AR: [-34, -64], BR: [-10, -52], IT: [42, 12], NL: [52, 5], JP: [36, 138], PT: [39, -8],
  CA: [56, -106], AU: [-25, 133], IN: [22, 79], CN: [35, 105], RU: [61, 100], ZA: [-29, 24],
  NG: [9, 8], EG: [26, 30], SE: [62, 15], NO: [62, 10], PL: [52, 19], TR: [39, 35], SA: [24, 45],
  AE: [24, 54], SG: [1, 104], KR: [36, 128], ID: [-2, 118], TH: [15, 101], VN: [16, 106],
  PH: [13, 122], CL: [-30, -71], CO: [4, -72], PE: [-10, -76], IE: [53, -8], BE: [51, 4],
  CH: [47, 8], AT: [47, 14], DK: [56, 10], FI: [64, 26], GR: [39, 22], CZ: [50, 15], RO: [46, 25],
  UA: [49, 32], MA: [32, -6], IL: [31, 35], NZ: [-42, 173], KE: [0, 38], PK: [30, 70],
};

// ── small helpers ────────────────────────────────────────────────────────────
function flag(cc) {
  if (!cc || cc === 'ZZ') return '🌐';
  if (cc === 'LOCAL') return '🏠';
  if (cc.length !== 2) return '🌐';
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function ago(iso) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return Math.floor(s) + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}
function trendHtml(p) {
  const arrow = p.changePct > 0 ? '▲' : p.changePct < 0 ? '▼' : '—';
  const cls = p.changePct > 0 ? 'up' : p.changePct < 0 ? 'down' : 'flat';
  return `<span class="trend ${cls}">${arrow} ${Math.abs(p.changePct)}%</span>`;
}

// ── shared tooltip ───────────────────────────────────────────────────────────
let tip;
function showTip(html, x, y) {
  if (!tip) { tip = document.createElement('div'); tip.className = 'viz-tip hidden'; document.body.appendChild(tip); }
  tip.innerHTML = html;
  tip.classList.remove('hidden');
  tip.style.left = Math.min(x + 12, window.innerWidth - tip.offsetWidth - 12) + 'px';
  tip.style.top = (y + 12) + 'px';
}
function hideTip() { if (tip) tip.classList.add('hidden'); }

// ── controls (range, custom dates, limit, refresh, simulate) ─────────────────
function renderControls() {
  const box = $('#tr-controls');
  const opt = (v, cur, label) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  box.innerHTML = `
    <div class="ctl">
      <label>${t('tr.range.label')}</label>
      <select id="tr-range">${RANGES.map((r) => opt(r, ui.range, t('tr.range.' + r))).join('')}</select>
    </div>
    <div class="ctl tr-custom ${ui.range === 'custom' ? '' : 'hidden'}">
      <label>${t('tr.from')}</label><input type="datetime-local" id="tr-from" value="${ui.from}" />
      <label>${t('tr.to')}</label><input type="datetime-local" id="tr-to" value="${ui.to}" />
    </div>
    <div class="ctl">
      <label>${t('tr.limit.label')}</label>
      <select id="tr-limit">${LIMITS.map((n) => opt(n, ui.limit, String(n))).join('')}</select>
    </div>
    <button id="tr-refresh" class="btn">${t('tr.refresh')}</button>
    <label class="tr-live"><input type="checkbox" id="tr-auto" ${ui.auto ? 'checked' : ''} /> ${t('tr.live')}</label>
    <div class="ctl tr-interval ${ui.auto ? '' : 'hidden'}">
      <label>${t('tr.every')}</label>
      <span class="secs-wrap"><input type="number" id="tr-secs" min="3" max="3600" value="${ui.autoSecs}" /><span class="secs-unit">s</span></span>
    </div>
    <button id="tr-reset" class="btn" title="${t('tr.reset')}">↺ ${t('tr.reset')}</button>
    <button id="tr-sim" class="btn primary">${t('tr.simulate')}</button>
    <span id="tr-you" class="tr-you"></span>`;

  $('#tr-range').addEventListener('change', (e) => {
    ui.range = e.target.value;
    $('.tr-custom').classList.toggle('hidden', ui.range !== 'custom');
    savePrefs();
    if (ui.range !== 'custom') load();
  });
  $('#tr-limit').addEventListener('change', (e) => { ui.limit = Number(e.target.value); savePrefs(); load(); });
  const custom = () => { ui.from = $('#tr-from').value; ui.to = $('#tr-to').value; savePrefs(); if (ui.from) load(); };
  $('#tr-from')?.addEventListener('change', custom);
  $('#tr-to')?.addEventListener('change', custom);
  $('#tr-refresh').addEventListener('click', load);
  $('#tr-auto').addEventListener('change', (e) => setAuto(e.target.checked));
  $('#tr-secs').addEventListener('change', (e) => {
    ui.autoSecs = Math.min(Math.max(Number(e.target.value) || 15, 3), 3600);
    e.target.value = ui.autoSecs;
    savePrefs();
    if (ui.auto) setAuto(true); // restart the timer with the new interval
  });
  $('#tr-reset').addEventListener('click', resetPrefs);
  $('#tr-sim').addEventListener('click', onSimulate);
  paintYou();
}

// Auto-refresh: OFF by default. When on, it only calls load() (read-only GET)
// on a timer at the user's chosen interval — it NEVER simulates. Toggling off
// clears the timer. The interval input appears only while Live is on.
function setAuto(on) {
  ui.auto = on;
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  if (on) autoTimer = setInterval(load, ui.autoSecs * 1000);
  $('.tr-interval')?.classList.toggle('hidden', !on);
  const cb = $('#tr-auto'); if (cb) cb.checked = on;
  savePrefs();
}

// Country filter chip (set by clicking a bar in the map or Top countries).
function setCountry(cc) {
  ui.country = ui.country === cc ? '' : cc;
  ui.feed.page = 1;
  load();
}
function renderCountryChip() {
  const box = $('#tr-country-chip');
  if (!box) return;
  if (ui.country) {
    box.classList.remove('hidden');
    box.innerHTML = `${t('tr.filtered')} <strong>${flag(ui.country)} ${esc(ui.country)}</strong> <button id="tr-clear-country" class="chip-x" title="${t('tr.clear')}">✕</button>`;
    $('#tr-clear-country').addEventListener('click', () => setCountry(ui.country));
  } else {
    box.classList.add('hidden');
    box.innerHTML = '';
  }
}
function paintYou() {
  const el = $('#tr-you');
  if (el && window.__vtVisitor) el.textContent = `${t('tr.you')} ${window.__vtVisitor}`;
}

// Simulation runs ONLY here, on explicit click, with a confirmation. Nothing in
// this module simulates on load, on a timer, or on any automatic path.
async function onSimulate(e) {
  if (!window.confirm(t('tr.simulate.confirm'))) return;
  const btn = e.currentTarget;
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = t('tr.simulating');
  await fetch('/api/traffic/simulate', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ count: 60 }),
  });
  await load();
  btn.disabled = false; btn.textContent = original;
}

// ── KPIs ─────────────────────────────────────────────────────────────────────
function kpi(label, value, sub = '') {
  return `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`;
}
function renderKpis(d) {
  const tot = d.totals;
  const humanPct = tot.hits ? Math.round((tot.humans / tot.hits) * 100) : 0;
  $('#tr-kpis').innerHTML = [
    kpi(t('tr.kpi.hits'), tot.hits.toLocaleString(), d.capped ? t('tr.capped.badge') : ''),
    kpi(t('tr.kpi.unique'), tot.uniqueVisitors.toLocaleString()),
    kpi(t('tr.kpi.split'),
      `<span style="color:${C.human}">${humanPct}%</span> / <span style="color:${C.bot}">${100 - humanPct}%</span>`,
      `${tot.humans} ${t('tr.legend.human')} · ${tot.bots} ${t('tr.legend.bot')}`),
    kpi(t('tr.kpi.confirmed'), tot.confirmedHumans.toLocaleString()),
    kpi(t('tr.kpi.trend'), trendHtml(d.trend), t('tr.trend.sub')),
  ].join('');
}

// ── adaptive stacked series ──────────────────────────────────────────────────
function renderSeries(series) {
  const box = $('#tr-series');
  const data = series.buckets;
  if (!data.length) { box.innerHTML = `<p class="hint">${t('tr.nodata')}</p>`; return; }
  const W = 760, H = 240, padL = 34, padB = 26, padT = 10, padR = 8;
  const max = Math.max(1, ...data.map((h) => h.total));
  const n = data.length;
  const bw = (W - padL - padR) / n;
  const barW = Math.max(3, Math.min(22, bw - 3));
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const gap = barW > 6 ? 2 : 0;   // surface gap between stacked segments

  let bars = '';
  data.forEach((h, i) => {
    const cx = padL + i * bw + bw / 2;
    const x = cx - barW / 2;
    const hHuman = (H - padT - padB) * (h.human / max);
    const hBot = (H - padT - padB) * (h.bot / max);
    const yHumanTop = H - padB - hHuman;
    const yBotTop = yHumanTop - hBot - (h.bot && h.human ? gap : 0);
    if (h.human) bars += `<rect x="${x}" y="${yHumanTop}" width="${barW}" height="${Math.max(1, hHuman)}" rx="2" fill="${C.human}"/>`;
    if (h.bot) bars += `<rect x="${x}" y="${yBotTop}" width="${barW}" height="${Math.max(1, hBot)}" rx="2" fill="${C.bot}"/>`;
    bars += `<rect class="hbar" x="${padL + i * bw}" y="${padT}" width="${bw}" height="${H - padT - padB}" fill="transparent"
      data-tip="${esc(`${h.label} · ${h.total} — ${h.human} ${t('tr.legend.human')} / ${h.bot} ${t('tr.legend.bot')}`)}"/>`;
  });

  // Show at most ~12 x labels so long ranges stay readable.
  const every = Math.max(1, Math.ceil(n / 12));
  let ticks = '';
  data.forEach((h, i) => {
    if (i % every === 0) ticks += `<text x="${padL + i * bw + bw / 2}" y="${H - 8}" class="axis" text-anchor="middle">${esc(h.label)}</text>`;
  });
  [0, Math.round(max / 2), max].forEach((v) => {
    ticks += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`;
    ticks += `<text x="${padL - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${v}</text>`;
  });

  box.innerHTML = `
    <div class="legend">
      <span><i style="background:${C.human}"></i>${t('tr.legend.human')}</span>
      <span><i style="background:${C.bot}"></i>${t('tr.legend.bot')}</span>
      <span class="series-unit">· ${t('tr.unit.' + series.unit)}</span>
    </div>
    <div class="viz-scroll"><svg viewBox="0 0 ${W} ${H}" class="viz" preserveAspectRatio="xMidYMid meet">${ticks}${bars}</svg></div>`;
  box.querySelectorAll('.hbar').forEach((el) => {
    el.addEventListener('mousemove', (e) => showTip(el.dataset.tip, e.clientX, e.clientY));
    el.addEventListener('mouseleave', hideTip);
  });
}

// ── horizontal bars (tops) ───────────────────────────────────────────────────
function renderBars(id, items, { color = C.human, label = (k) => esc(k), onClick = null } = {}) {
  const box = $('#' + id);
  if (!items.length) { box.innerHTML = `<p class="hint">${t('tr.nodata')}</p>`; return; }
  const max = Math.max(...items.map((i) => i.count));
  box.innerHTML = '<div class="hbars">' + items.map((i) => `
    <div class="hbar-row ${onClick ? 'clickable' : ''}" data-k="${esc(i.key)}" data-tip="${esc(i.key + ' · ' + i.count)}">
      <div class="hbar-label">${label(i.key)}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${(i.count / max) * 100}%;background:${color}"></div></div>
      <div class="hbar-val">${i.count}</div>
    </div>`).join('') + '</div>';
  box.querySelectorAll('.hbar-row').forEach((el) => {
    el.addEventListener('mousemove', (e) => showTip(el.dataset.tip, e.clientX, e.clientY));
    el.addEventListener('mouseleave', hideTip);
    if (onClick) el.addEventListener('click', () => onClick(el.dataset.k));
  });
}

// ── world map (bubbles at country centroids, equirectangular) ────────────────
function renderMap(countries) {
  const box = $('#tr-map');
  const plotted = countries.filter((c) => CENTROIDS[c.key]);
  if (!plotted.length) { box.innerHTML = `<p class="hint">${t('tr.map.none')}</p>`; return; }
  const W = 760, H = 380, maxR = 30, minR = 5;
  const max = Math.max(...plotted.map((c) => c.count));
  const proj = (lat, lon) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];

  // Faint graticule so the plot reads as a world map.
  let grid = '';
  [-60, -30, 0, 30, 60].forEach((lat) => { const [, y] = proj(lat, 0); grid += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" class="grid"/>`; });
  [-120, -60, 0, 60, 120].forEach((lon) => { const [x] = proj(0, lon); grid += `<line x1="${x}" x2="${x}" y1="0" y2="${H}" class="grid"/>`; });
  grid += `<line x1="0" x2="${W}" y1="${proj(0, 0)[1]}" y2="${proj(0, 0)[1]}" class="grid equator"/>`;

  const bubbles = plotted.map((c) => {
    const [lat, lon] = CENTROIDS[c.key];
    const [x, y] = proj(lat, lon);
    const r = minR + (maxR - minR) * Math.sqrt(c.count / max);
    const active = ui.country === c.key;
    return `<g class="map-bubble" data-k="${c.key}" data-tip="${esc(flag(c.key) + ' ' + c.key + ' · ' + c.count)}">
      <circle cx="${x}" cy="${y}" r="${r}" fill="${C.human}" fill-opacity="${active ? 0.85 : 0.5}" stroke="${active ? '#fff' : C.human}" stroke-width="${active ? 2 : 1}"/>
      <text x="${x}" y="${y + 3}" text-anchor="middle" class="map-label">${c.key}</text>
    </g>`;
  }).join('');

  box.innerHTML = `<div class="viz-scroll"><svg viewBox="0 0 ${W} ${H}" class="viz map" preserveAspectRatio="xMidYMid meet">
    <rect x="0" y="0" width="${W}" height="${H}" class="map-bg"/>${grid}${bubbles}
  </svg></div>`;
  box.querySelectorAll('.map-bubble').forEach((el) => {
    el.addEventListener('mousemove', (e) => showTip(el.dataset.tip, e.clientX, e.clientY));
    el.addEventListener('mouseleave', hideTip);
    el.addEventListener('click', () => setCountry(el.dataset.k));
  });
}

// ── CSV / JSON export of the currently filtered feed ─────────────────────────
function download(name, mime, content) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportFeed(format) {
  const rows = feedRows();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  if (format === 'json') {
    download(`vedtemplate-traffic-${stamp}.json`, 'application/json', JSON.stringify(rows, null, 2));
    return;
  }
  const cols = ['ts', 'type', 'method', 'path', 'country', 'city', 'ipMasked', 'browser', 'os', 'device', 'isBot', 'botKind', 'beacon', 'refererHost', 'visitorId'];
  const escCsv = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [cols.join(',')].concat(rows.map((r) => cols.map((c) => escCsv(r[c])).join(',')));
  download(`vedtemplate-traffic-${stamp}.csv`, 'text/csv', lines.join('\n'));
}

// ── reusable sortable + paginated table ──────────────────────────────────────
// cols: [{ key, label, get(row) → sortable value, cell(row) → html, align }]
function renderTable(box, cols, rows, state, rerender) {
  const s = state.sort;
  const col = cols.find((c) => c.key === s.col) || cols[0];
  const sorted = [...rows].sort((a, b) => {
    const va = col.get(a);
    const vb = col.get(b);
    if (va < vb) return s.dir === 'asc' ? -1 : 1;
    if (va > vb) return s.dir === 'asc' ? 1 : -1;
    return 0;
  });
  const pages = Math.max(1, Math.ceil(sorted.length / state.size));
  state.page = Math.min(Math.max(1, state.page), pages);
  const start = (state.page - 1) * state.size;
  const slice = sorted.slice(start, start + state.size);

  const head = cols.map((c) => {
    const arrow = s.col === c.key ? (s.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="sortable ${c.align || ''}" data-col="${c.key}">${esc(c.label)}<span class="sort-arrow">${arrow}</span></th>`;
  }).join('');
  const body = slice.length
    ? slice.map((r) => '<tr class="' + (r._cls || '') + '">' + cols.map((c) => `<td class="${c.align || ''}">${c.cell(r)}</td>`).join('') + '</tr>').join('')
    : `<tr><td colspan="${cols.length}" class="hint">${t('tr.noresults')}</td></tr>`;

  const from = sorted.length ? start + 1 : 0;
  const to = Math.min(start + state.size, sorted.length);
  const pager = `
    <div class="pager">
      <span class="pager-info">${from}–${to} ${t('tr.of')} ${sorted.length}</span>
      <label class="pager-size">${t('tr.perpage')}
        <select class="tbl-size">${[10, 25, 50, 100].map((n) => `<option value="${n}" ${n === state.size ? 'selected' : ''}>${n}</option>`).join('')}</select>
      </label>
      <span class="pager-nav">
        <button class="btn tbl-first" ${state.page === 1 ? 'disabled' : ''}>«</button>
        <button class="btn tbl-prev" ${state.page === 1 ? 'disabled' : ''}>‹</button>
        <span class="pager-page">${state.page} / ${pages}</span>
        <button class="btn tbl-next" ${state.page === pages ? 'disabled' : ''}>›</button>
        <button class="btn tbl-last" ${state.page === pages ? 'disabled' : ''}>»</button>
      </span>
    </div>`;

  box.innerHTML = `<div class="viz-scroll"><table class="feed"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${pager}`;

  const go = (p) => { state.page = p; savePrefs(); rerender(); };
  box.querySelectorAll('th.sortable').forEach((th) => th.addEventListener('click', () => {
    const c = th.dataset.col;
    if (s.col === c) s.dir = s.dir === 'asc' ? 'desc' : 'asc';
    else { s.col = c; s.dir = 'asc'; }
    go(1);
  }));
  box.querySelector('.tbl-size').addEventListener('change', (e) => { state.size = Number(e.target.value); go(1); });
  box.querySelector('.tbl-first').addEventListener('click', () => go(1));
  box.querySelector('.tbl-prev').addEventListener('click', () => go(state.page - 1));
  box.querySelector('.tbl-next').addEventListener('click', () => go(state.page + 1));
  box.querySelector('.tbl-last').addEventListener('click', () => go(pages));
}

// ── live access feed ─────────────────────────────────────────────────────────
function classBadge(e) {
  if (e.isBot) return `<span class="badge-chip bot" title="${esc(e.botReason || '')}">🤖 ${e.botKind || t('tr.bot')}</span>`;
  if (e.beacon) return `<span class="badge-chip human">🧑 ${t('tr.human')}</span>`;
  return `<span class="badge-chip unver">👤 ${t('tr.unverified')}</span>`;
}
function feedRows() {
  let rows = (lastDash?.events || []).slice();
  const f = ui.feed;
  if (f.filter === 'humans') rows = rows.filter((e) => !e.isBot);
  else if (f.filter === 'bots') rows = rows.filter((e) => e.isBot);
  const q = f.search.trim().toLowerCase();
  if (q) rows = rows.filter((e) => (e.path + ' ' + e.country + ' ' + (e.city || '') + ' ' + e.visitorId + ' ' + e.refererHost + ' ' + e.browser + ' ' + e.os).toLowerCase().includes(q));
  return rows.map((e) => ({ ...e, _cls: e.synthetic ? 'synthetic' : '' }));
}
function renderFeedControls() {
  const box = $('#tr-feed-controls');
  const f = ui.feed;
  const chip = (v, label) => `<button class="fbtn ${f.filter === v ? 'active' : ''}" data-f="${v}">${label}</button>`;
  box.innerHTML = `
    <div class="fbtns">${chip('all', t('tr.filter.all'))}${chip('humans', t('tr.filter.humans'))}${chip('bots', t('tr.filter.bots'))}</div>
    <input id="tr-search" class="tr-search" type="search" placeholder="${t('tr.search')}" value="${esc(f.search)}" />
    <div class="tr-export">
      <button class="btn" id="tr-csv">⬇ CSV</button>
      <button class="btn" id="tr-json">⬇ JSON</button>
    </div>`;
  box.querySelectorAll('.fbtn').forEach((b) => b.addEventListener('click', () => { f.filter = b.dataset.f; f.page = 1; savePrefs(); renderFeed(); renderFeedControls(); }));
  const inp = $('#tr-search');
  inp.addEventListener('input', () => { f.search = inp.value; f.page = 1; renderFeed(); });
  $('#tr-csv').addEventListener('click', () => exportFeed('csv'));
  $('#tr-json').addEventListener('click', () => exportFeed('json'));
}
function renderFeed() {
  const cols = [
    { key: 'ago', label: t('tr.col.ago'), align: 'nowrap', get: (r) => r.ts, cell: (r) => `<span title="${esc(r.ts)}">${ago(r.ts)}</span>` },
    { key: 'ts', label: t('tr.col.time'), align: 'nowrap', get: (r) => r.ts, cell: (r) => `<span class="mono exact">${new Date(r.ts).toLocaleString()}</span>` },
    { key: 'botKind', label: t('tr.col.class'), get: (r) => (r.isBot ? '2' : r.beacon ? '0' : '1') + r.botKind, cell: (r) => classBadge(r) },
    { key: 'path', label: t('tr.col.path'), get: (r) => r.method + r.path, cell: (r) => `<span class="mono">${esc(r.method)} ${esc(r.path)}${r.sensitive.captured ? ` <span class="sens" title="Authorization / Cookie / query">🔒 ${t('tr.sensitive')}</span>` : ''}</span>` },
    { key: 'country', label: t('tr.col.geo'), align: 'nowrap', get: (r) => r.country + (r.city || ''), cell: (r) => `${flag(r.country)} ${esc(r.country)}${r.city ? ' · ' + esc(r.city) : ''} <span class="ipm">${esc(r.ipMasked)}</span>` },
    { key: 'device', label: t('tr.col.device'), align: 'nowrap', get: (r) => r.os + r.browser, cell: (r) => `${esc(r.browser)} · ${esc(r.os)} · ${esc(r.device)}` },
    { key: 'refererHost', label: t('tr.col.ref'), align: 'nowrap', get: (r) => r.refererHost || '', cell: (r) => r.refererHost ? esc(r.refererHost) : `<span class="muted">${t('tr.direct')}</span>` },
    { key: 'visitorId', label: t('tr.col.vid'), get: (r) => r.visitorId, cell: (r) => `<span class="mono">${esc(r.visitorId)}</span>` },
  ];
  renderTable($('#tr-feed'), cols, feedRows(), ui.feed, renderFeed);
}

// ── visitor explorer ─────────────────────────────────────────────────────────
let visitorsData = [];
async function loadVisitors() {
  const data = await fetch('/api/traffic/visitors').then((r) => r.json());
  visitorsData = data.visitors || [];
  renderVisitors();
}
function renderVisitors() {
  const box = $('#tr-visitors');
  if (!visitorsData.length) { box.innerHTML = `<p class="hint">${t('tr.novisitors')}</p>`; return; }
  const me = window.__vtVisitor;
  const cols = [
    { key: 'id', label: t('tr.v.id'), get: (r) => r.id, cell: (r) => `<span class="mono">${esc(r.id)}${me && r.id.startsWith(me) ? ' 👈' : ''}</span>` },
    { key: 'country', label: t('tr.col.geo'), align: 'nowrap', get: (r) => r.country || '', cell: (r) => `${flag(r.country)} ${esc(r.country || '—')}` },
    { key: 'device', label: t('tr.col.device'), align: 'nowrap', get: (r) => (r.os || '') + (r.browser || ''), cell: (r) => `${esc(r.browser || '—')} · ${esc(r.os || '—')} · ${esc(r.device || '—')}` },
    { key: 'hits', label: t('tr.v.hits'), align: 'num', get: (r) => r.hits || 0, cell: (r) => r.hits },
    { key: 'human', label: t('tr.v.human'), align: 'nowrap', get: (r) => (r.humanConfirmed ? '0' : r.isBot ? '2' : '1'), cell: (r) => r.humanConfirmed ? '🧑' : (r.isBot ? '🤖' : '👤') },
    { key: 'firstSeen', label: t('tr.v.first'), align: 'nowrap', get: (r) => r.firstSeen || '', cell: (r) => r.firstSeen ? `<span title="${esc(r.firstSeen)}">${ago(r.firstSeen)}</span>` : '—' },
    { key: 'lastSeen', label: t('tr.v.last'), align: 'nowrap', get: (r) => r.lastSeen || '', cell: (r) => r.lastSeen ? `<span title="${esc(r.lastSeen)}">${ago(r.lastSeen)}</span>` : '—' },
  ];
  const rows = visitorsData.map((v) => ({ ...v, _cls: me && v.id.startsWith(me) ? 'is-you' : '' }));
  renderTable(box, cols, rows, ui.visitors, renderVisitors);
}

// ── capped note ──────────────────────────────────────────────────────────────
function renderCapped(d) {
  const box = $('#tr-capped');
  if (d.capped) {
    box.classList.remove('hidden');
    box.innerHTML = `⚠️ ${t('tr.capped').replace('{n}', d.limit)}`;
  } else {
    box.classList.add('hidden');
    box.innerHTML = '';
  }
}

// ── orchestration ────────────────────────────────────────────────────────────
let lastDash = null;

function paint(d) {
  renderCapped(d);
  renderCountryChip();
  renderKpis(d);
  renderSeries(d.series);
  renderMap(d.topCountries);
  renderBars('tr-countries', d.topCountries, { color: C.human, label: (k) => `${flag(k)} ${esc(k)}`, onClick: setCountry });
  renderBars('tr-paths', d.topPaths, { color: C.s3 });
  renderBars('tr-referrers', d.topReferrers, { color: C.s4 });
  renderBars('tr-browsers', d.browsers, { color: C.s5 });
  renderBars('tr-os', d.os, { color: C.human });
  renderBars('tr-devices', d.devices, { color: C.s3 });
  renderFeedControls();
  renderFeed();
}

function query() {
  const p = new URLSearchParams({ range: ui.range, limit: String(ui.limit) });
  if (ui.country) p.set('country', ui.country);
  if (ui.range === 'custom') {
    if (ui.from) p.set('from', new Date(ui.from).toISOString());
    if (ui.to) p.set('to', new Date(ui.to).toISOString());
  }
  return p.toString();
}

async function load() {
  const d = await fetch('/api/traffic?' + query()).then((r) => r.json());
  lastDash = d;
  paint(d);
  await loadVisitors();
}

let wired = false;
export function initTraffic() {
  if (!wired) {
    wired = true;
    loadPrefs();
    renderControls();
    if (ui.range === 'custom') $('.tr-custom')?.classList.remove('hidden');
    if (ui.auto) setAuto(true); // restore Live mode + timer from saved prefs
    window.addEventListener('vt-lang', () => { renderControls(); if (lastDash) { paint(lastDash); renderVisitors(); } });
    window.addEventListener('vt-tracked', () => { paintYou(); renderVisitors(); });
  }
  load();
}
