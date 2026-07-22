// Visitor identification beacon (privacy-friendly, no dependencies).
//
// Computes a stable browser fingerprint by combining low-invasiveness signals
// (no PII) and sends it to /api/traffic/track along with visit context. The
// server adds masked IP, geo and human/bot classification.
//
// This is what turns an "anonymous request" into a "visitor": it lets us count
// uniques, detect recurrence and confirm there is a real browser running JS (a
// strong signal of legitimate traffic versus simple bots).

(function () {
  // Don't track in Do Not Track mode: we respect the user's preference.
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  async function sha256Hex(str) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Simple fallback if SubtleCrypto isn't available (old http/local).
      let h = 0;
      for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
      return (h >>> 0).toString(16).padStart(8, '0');
    }
  }

  // Canvas fingerprint: same browser/GPU → same drawing. It doesn't identify
  // the person, only distinguishes device configurations.
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
    } catch { /* tracking must never break the page */ }

    // Exposed so the dashboard can show "you are this visitor".
    window.__vtVisitor = fp.slice(0, 8);
    window.dispatchEvent(new CustomEvent('vt-tracked', { detail: window.__vtVisitor }));
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
