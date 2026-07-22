// Traffic dashboard: KPIs, human/bot time series, geographic and technical
// tops, live access feed (redacted) and visitor explorer.
//
// Charts as inline SVG (no libraries): validated categorical palette, thin
// marks with rounded ends, a 2px gap between stacked segments, legend + direct
// labels and a tooltip on hover.

import { tr } from './i18n.js';

const $ = (s, r = document) => r.querySelector(s);
const lang = () => window.__lang || 'en';
const t = (k) => tr(lang(), k);

// Palette (dark, validated with the dataviz skill validator):
const C = { human: '#3987e5', bot: '#d95926', s3: '#199e70', s4: '#c98500', s5: '#d55181' };

// Emoji flag from the ISO country code.
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

// ── Shared tooltip ──────────────────────────────────────────────────────────
let tip;
function ensureTip() {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'viz-tip hidden';
    document.body.appendChild(tip);
  }
  return tip;
}
function showTip(html, x, y) {
  const el = ensureTip();
  el.innerHTML = html;
  el.classList.remove('hidden');
  el.style.left = Math.min(x + 12, window.innerWidth - el.offsetWidth - 12) + 'px';
  el.style.top = (y + 12) + 'px';
}
function hideTip() { if (tip) tip.classList.add('hidden'); }

// ── KPIs ────────────────────────────────────────────────────────────────────
function kpi(label, value, sub = '') {
  return `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`;
}

function renderKpis(d) {
  const tot = d.totals;
  const humanPct = tot.hits ? Math.round((tot.humans / tot.hits) * 100) : 0;
  $('#tr-kpis').innerHTML = [
    kpi(t('tr.kpi.hits'), tot.hits.toLocaleString()),
    kpi(t('tr.kpi.unique'), tot.uniqueVisitors.toLocaleString()),
    kpi(t('tr.kpi.split'),
      `<span style="color:${C.human}">${humanPct}%</span> / <span style="color:${C.bot}">${100 - humanPct}%</span>`,
      `${tot.humans} ${t('tr.legend.human')} · ${tot.bots} ${t('tr.legend.bot')}`),
    kpi(t('tr.kpi.confirmed'), tot.confirmedHumans.toLocaleString()),
    kpi(t('tr.kpi.trend'), trendHtml(d.trend.day), `${d.trend.day.current} ${t('tr.per24')}`),
    kpi(t('tr.kpi.trendh'), trendHtml(d.trend.hour), `${d.trend.hour.current} ${t('tr.perh')}`),
  ].join('');
}

// ── Stacked time series (24h, human vs bot) ─────────────────────────────────
function renderHourly(hourly) {
  const box = $('#tr-hourly');
  const W = 720, H = 240, padL = 34, padB = 26, padT = 10, padR = 8;
  const max = Math.max(1, ...hourly.map((h) => h.total));
  const n = hourly.length;
  const bw = (W - padL - padR) / n;
  const barW = Math.min(22, bw - 4);
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const gap = 2; // surface gap between stacked segments

  let bars = '';
  hourly.forEach((h, i) => {
    const cx = padL + i * bw + bw / 2;
    const x = cx - barW / 2;
    const hHuman = (H - padT - padB) * (h.human / max);
    const hBot = (H - padT - padB) * (h.bot / max);
    const yHumanTop = H - padB - hHuman;
    const yBotTop = yHumanTop - hBot - (h.bot && h.human ? gap : 0);
    if (h.human) bars += `<rect x="${x}" y="${yHumanTop}" width="${barW}" height="${Math.max(1, hHuman)}" rx="3" fill="${C.human}"/>`;
    if (h.bot) bars += `<rect x="${x}" y="${yBotTop}" width="${barW}" height="${Math.max(1, hBot)}" rx="3" fill="${C.bot}"/>`;
    // invisible hover zone (target larger than the mark)
    bars += `<rect class="hbar" x="${padL + i * bw}" y="${padT}" width="${bw}" height="${H - padT - padB}" fill="transparent"
      data-tip="${esc(`${h.label} · ${h.total} — ${h.human} ${t('tr.legend.human')} / ${h.bot} ${t('tr.legend.bot')}`)}"/>`;
  });

  // axes: labels only every 4 hours to avoid clutter
  let ticks = '';
  hourly.forEach((h, i) => {
    if (i % 4 === 0) ticks += `<text x="${padL + i * bw + bw / 2}" y="${H - 8}" class="axis" text-anchor="middle">${h.label}</text>`;
  });
  [0, Math.round(max / 2), max].forEach((v) => {
    ticks += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`;
    ticks += `<text x="${padL - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${v}</text>`;
  });

  box.innerHTML = `
    <div class="legend">
      <span><i style="background:${C.human}"></i>${t('tr.legend.human')}</span>
      <span><i style="background:${C.bot}"></i>${t('tr.legend.bot')}</span>
    </div>
    <div class="viz-scroll"><svg viewBox="0 0 ${W} ${H}" class="viz" preserveAspectRatio="xMidYMid meet">
      ${ticks}${bars}
    </svg></div>`;

  box.querySelectorAll('.hbar').forEach((el) => {
    el.addEventListener('mousemove', (e) => showTip(el.dataset.tip, e.clientX, e.clientY));
    el.addEventListener('mouseleave', hideTip);
  });
}

// ── Horizontal bars (tops) ──────────────────────────────────────────────────
function renderBars(id, items, { color = C.human, label = (k) => esc(k) } = {}) {
  const box = $('#' + id);
  if (!items.length) { box.innerHTML = `<p class="hint">${t('tr.nodata')}</p>`; return; }
  const max = Math.max(...items.map((i) => i.count));
  box.innerHTML = '<div class="hbars">' + items.map((i) => `
    <div class="hbar-row" data-tip="${esc(i.key + ' · ' + i.count)}">
      <div class="hbar-label">${label(i.key)}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${(i.count / max) * 100}%;background:${color}"></div></div>
      <div class="hbar-val">${i.count}</div>
    </div>`).join('') + '</div>';
  box.querySelectorAll('.hbar-row').forEach((el) => {
    el.addEventListener('mousemove', (e) => showTip(el.dataset.tip, e.clientX, e.clientY));
    el.addEventListener('mouseleave', hideTip);
  });
}

// ── Live access feed (redacted) ─────────────────────────────────────────────
function classBadge(e) {
  if (e.isBot) return `<span class="badge-chip bot" title="${esc(e.botReason || '')}">🤖 ${e.botKind || t('tr.bot')}</span>`;
  if (e.beacon) return `<span class="badge-chip human">🧑 ${t('tr.human')}</span>`;
  return `<span class="badge-chip unver">👤 ${t('tr.unverified')}</span>`;
}

function renderFeed(recent) {
  const box = $('#tr-feed');
  if (!recent.length) { box.innerHTML = `<p class="hint">${t('tr.nodata')}</p>`; return; }
  box.innerHTML = `<div class="viz-scroll"><table class="feed">
    <thead><tr>
      <th>${t('tr.col.time')}</th><th>${t('tr.col.class')}</th><th>${t('tr.col.path')}</th>
      <th>${t('tr.col.geo')}</th><th>${t('tr.col.device')}</th><th>${t('tr.col.ref')}</th><th>${t('tr.col.vid')}</th>
    </tr></thead><tbody>
    ${recent.map((e) => `<tr class="${e.synthetic ? 'synthetic' : ''}">
      <td class="nowrap" title="${esc(e.ts)}">${ago(e.ts)}</td>
      <td>${classBadge(e)}</td>
      <td class="mono">${esc(e.method)} ${esc(e.path)}${e.sensitive.captured ? ` <span class="sens" title="Authorization / Cookie / query">🔒 ${t('tr.sensitive')}</span>` : ''}</td>
      <td class="nowrap">${flag(e.country)} ${esc(e.country)}${e.city ? ' · ' + esc(e.city) : ''} <span class="ipm">${esc(e.ipMasked)}</span></td>
      <td class="nowrap">${esc(e.browser)} · ${esc(e.os)} · ${esc(e.device)}</td>
      <td class="nowrap">${e.refererHost ? esc(e.refererHost) : `<span class="muted">${t('tr.direct')}</span>`}</td>
      <td class="mono">${esc(e.visitorId)}</td>
    </tr>`).join('')}
    </tbody></table></div>`;
}

// ── Visitor explorer ────────────────────────────────────────────────────────
async function renderVisitors() {
  const box = $('#tr-visitors');
  const data = await fetch('/api/traffic/visitors').then((r) => r.json());
  if (!data.visitors.length) { box.innerHTML = `<p class="hint">${t('tr.novisitors')}</p>`; return; }
  const me = window.__vtVisitor;
  box.innerHTML = `<div class="viz-scroll"><table class="feed">
    <thead><tr>
      <th>${t('tr.v.id')}</th><th>${t('tr.col.geo')}</th><th>${t('tr.col.device')}</th>
      <th>${t('tr.v.hits')}</th><th>${t('tr.v.human')}</th><th>${t('tr.v.first')}</th><th>${t('tr.v.last')}</th>
    </tr></thead><tbody>
    ${data.visitors.map((v) => `<tr class="${me && v.id.startsWith(me) ? 'is-you' : ''}">
      <td class="mono">${esc(v.id)}${me && v.id.startsWith(me) ? ' 👈' : ''}</td>
      <td class="nowrap">${flag(v.country)} ${esc(v.country || '—')}</td>
      <td class="nowrap">${esc(v.browser || '—')} · ${esc(v.os || '—')} · ${esc(v.device || '—')}</td>
      <td>${v.hits}</td>
      <td>${v.humanConfirmed ? '🧑' : (v.isBot ? '🤖' : '👤')}</td>
      <td class="nowrap" title="${esc(v.firstSeen || '')}">${v.firstSeen ? ago(v.firstSeen) : '—'}</td>
      <td class="nowrap" title="${esc(v.lastSeen || '')}">${v.lastSeen ? ago(v.lastSeen) : '—'}</td>
    </tr>`).join('')}
    </tbody></table></div>`;
}

// ── Orchestration ───────────────────────────────────────────────────────────
let lastDash = null;

async function load() {
  const d = await fetch('/api/traffic').then((r) => r.json());
  lastDash = d;
  paint(d);
  await renderVisitors();
}

function paint(d) {
  renderKpis(d);
  renderHourly(d.hourly);
  renderBars('tr-countries', d.topCountries, { color: C.human, label: (k) => `${flag(k)} ${esc(k)}` });
  renderBars('tr-paths', d.topPaths, { color: C.s3 });
  renderBars('tr-referrers', d.topReferrers.length ? d.topReferrers : [], { color: C.s4 });
  renderBars('tr-browsers', d.browsers, { color: C.s5 });
  renderBars('tr-os', d.os, { color: C.human });
  renderBars('tr-devices', d.devices, { color: C.s3 });
  renderFeed(d.recent);
}

let wired = false;
export function initTraffic() {
  if (!wired) {
    wired = true;
    $('#tr-refresh').addEventListener('click', load);
    $('#tr-sim').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const original = btn.textContent;
      btn.disabled = true; btn.textContent = t('tr.simulating');
      await fetch('/api/traffic/simulate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ count: 60 }) });
      await load();
      btn.disabled = false; btn.textContent = original;
    });
    // Re-paint labels on language change (data is already in memory).
    window.addEventListener('vt-lang', () => { if (lastDash) { paint(lastDash); renderVisitors(); } });
    // Mark "you are this visitor" once the beacon confirms.
    window.addEventListener('vt-tracked', () => { if (lastDash) renderVisitors(); });
  }
  load();
}
