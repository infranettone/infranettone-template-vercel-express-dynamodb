// Lógica del showcase: pestañas, panel de estado en vivo y demo CRUD.
// Sin frameworks: fetch + DOM, para que la plantilla sea legible de un vistazo.

const $ = (sel) => document.querySelector(sel);

// ── Diagramas Mermaid ───────────────────────────────────────────────────────
// Solo se renderizan los diagramas de la pestaña visible: renderizar dentro
// de un contenedor display:none produce "translate(undefined, NaN)".
async function renderDiagrams(section) {
  if (!window.mermaid) return; // aún cargando; el evento mermaid-ready reintenta
  const pending = section.querySelectorAll('pre.mermaid:not([data-processed])');
  if (pending.length) await window.mermaid.run({ nodes: pending });
}

window.addEventListener('mermaid-ready', () => renderDiagrams($('section.tab.active')));

// ── Pestañas ────────────────────────────────────────────────────────────────
document.querySelectorAll('#tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('section.tab').forEach((s) => s.classList.remove('active'));
    btn.classList.add('active');
    const section = $(`#tab-${btn.dataset.tab}`);
    section.classList.add('active');
    renderDiagrams(section);
  });
});

// ── Estado de conexiones ────────────────────────────────────────────────────
function statCard(label, value, cls = '') {
  return `<div class="stat ${cls}"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

async function loadStatus() {
  const panel = $('#status-panel');
  const raw = $('#status-raw');
  const badge = $('#mode-badge');
  try {
    const s = await fetch('/api/status').then((r) => r.json());
    raw.textContent = JSON.stringify(s, null, 2);

    const dynOk = s.dynamo.reachable;
    const mode = s.storage.mode;
    badge.textContent = mode === 'dynamodb'
      ? `● Persistencia: DynamoDB (${s.storage.table} · ${s.storage.region})`
      : '● Persistencia: memoria (sin credenciales AWS)';
    badge.className = 'badge ' + (mode === 'dynamodb' ? 'ok' : 'warn');

    const envRows = Object.entries(s.env)
      .map(([k, v]) => `${v ? '✅' : '—'} ${k}`)
      .join('<br/>');

    panel.innerHTML = [
      statCard('Modo de almacenamiento', mode.toUpperCase(), mode === 'dynamodb' ? 'ok' : 'warn'),
      statCard('DynamoDB', dynOk
        ? `✅ ${s.dynamo.tableStatus} · ${s.dynamo.latencyMs} ms`
        : (s.dynamo.enabled ? `❌ sin acceso` : '— desactivado'),
        dynOk ? 'ok' : (s.dynamo.enabled ? 'err' : 'warn')),
      statCard('Detalle', s.dynamo.detail || '—'),
      statCard('Plataforma', s.runtime.platform + (s.runtime.region ? ` · ${s.runtime.region}` : '')),
      statCard('Node', s.runtime.node),
      statCard('Uptime del proceso', s.runtime.uptimeSeconds + ' s'),
      statCard('Variables de entorno', envRows),
    ].join('');
  } catch (err) {
    panel.innerHTML = statCard('Error', String(err), 'err');
  }
}

$('#refresh-status').addEventListener('click', loadStatus);

// ── Demo CRUD ───────────────────────────────────────────────────────────────
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function loadItems() {
  const box = $('#items-list');
  try {
    const { items } = await fetch('/api/items').then((r) => r.json());
    if (!items.length) {
      box.innerHTML = '<p class="hint">No hay registros todavía. Añade el primero arriba 👆</p>';
      return;
    }
    box.innerHTML = '<ul class="items">' + items.map((i) => `
      <li>
        <div>
          <div>${escapeHtml(i.text)}</div>
          <div class="meta">${i.id} · ${new Date(i.createdAt).toLocaleString()}</div>
        </div>
        <button class="btn danger" data-del="${i.id}">🗑 borrar</button>
      </li>`).join('') + '</ul>';
    box.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        await fetch(`/api/items/${b.dataset.del}`, { method: 'DELETE' });
        loadItems();
      }));
  } catch (err) {
    box.innerHTML = `<p class="hint">Error cargando registros: ${err}</p>`;
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
    alert('Error: ' + ((await res.json()).error || res.status));
  }
});

// ── Ejemplos curl con la URL real ───────────────────────────────────────────
$('#curl-examples').textContent = $('#curl-examples').textContent
  .replaceAll('BASE', window.location.origin);

// ── Arranque ────────────────────────────────────────────────────────────────
loadStatus();
loadItems();
