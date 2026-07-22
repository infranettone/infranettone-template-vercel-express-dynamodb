// Beacon de identificación de visitante (privacy-friendly, sin dependencias).
//
// Calcula un fingerprint estable del navegador combinando señales poco
// invasivas (no PII) y lo envía a /api/traffic/track junto con contexto de la
// visita. El servidor añade IP enmascarada, geo y clasificación humano/bot.
//
// Esto es lo que convierte una "petición anónima" en un "visitante": permite
// contar únicos, detectar recurrencia y confirmar que hay un navegador real
// ejecutando JS (una señal fuerte de tráfico legítimo frente a bots simples).

(function () {
  // No trackear en modo Do Not Track: respetamos la preferencia del usuario.
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  async function sha256Hex(str) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback simple si SubtleCrypto no está disponible (http/local antiguo).
      let h = 0;
      for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
      return (h >>> 0).toString(16).padStart(8, '0');
    }
  }

  // Huella de canvas: mismo navegador/GPU → mismo trazo. No identifica a la
  // persona, solo distingue configuraciones de dispositivo.
  function canvasHash() {
    try {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 40;
      const ctx = c.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = "14px 'Arial'";
      ctx.fillStyle = '#f60'; ctx.fillRect(0, 0, 100, 20);
      ctx.fillStyle = '#069'; ctx.fillText('vedtemplate·infranettone', 2, 2);
      ctx.fillStyle = 'rgba(102,204,0,0.7)'; ctx.fillText('vedtemplate·infranettone', 4, 8);
      return c.toDataURL();
    } catch { return 'no-canvas'; }
  }

  function signals() {
    const s = window.screen || {};
    return {
      screen: `${s.width || 0}x${s.height || 0}@${window.devicePixelRatio || 1}`,
      timezone: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || '',
      languages: (navigator.languages || [navigator.language]).join(','),
      platform: navigator.platform || '',
      cores: navigator.hardwareConcurrency || 0,
      memory: navigator.deviceMemory || 0,
      touch: navigator.maxTouchPoints || 0,
      colorDepth: s.colorDepth || 0,
    };
  }

  async function run() {
    const sig = signals();
    const raw = [
      sig.screen, sig.timezone, sig.languages, sig.platform,
      sig.cores, sig.memory, sig.touch, sig.colorDepth,
      navigator.userAgent, canvasHash(),
    ].join('|');
    const fp = (await sha256Hex(raw)).slice(0, 24);

    const payload = {
      fp,
      screen: sig.screen, timezone: sig.timezone, languages: sig.languages,
      cores: sig.cores, memory: sig.memory,
      path: location.pathname, referrer: document.referrer || '',
    };

    try {
      await fetch('/api/traffic/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch { /* el tracking nunca debe romper la página */ }

    // Expuesto para que el dashboard muestre "tú eres este visitante".
    window.__vtVisitor = fp.slice(0, 8);
    window.dispatchEvent(new CustomEvent('vt-tracked', { detail: window.__vtVisitor }));
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
