// Gerador procedural da pelagem de onça-pintada. Tile de 512px, sem emenda.
// Uso: const url = OncaTexture.generate('dourada', 3); el.style.backgroundImage = `url(${url})`;
(function () {
  const presets = {
    dourada: { base: '#C98A3A', light: 'rgba(232,184,104,.55)', dark: 'rgba(150,88,32,.35)', inner: '#A8652A', ring: '#1C120A', fur: 'rgba(90,45,10,.12)', fur2: 'rgba(255,225,170,.08)' },
    noturna: { base: '#15120E', light: 'rgba(40,31,22,.7)', dark: 'rgba(0,0,0,.4)', inner: '#251C13', ring: '#55412A', fur: 'rgba(255,220,170,.03)', fur2: 'rgba(0,0,0,.2)' }
  };
  const cache = {};
  function generate(preset, seed = 3) {
    const o = typeof preset === 'string' ? presets[preset] : preset;
    const key = typeof preset === 'string' ? preset + ':' + seed : null;
    if (key && cache[key]) return cache[key];
    let s = (seed || 1) * 7919; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const W = 512, c = document.createElement('canvas'); c.width = c.height = W; const g = c.getContext('2d');
    const wrap = fn => { for (const dx of [-W, 0, W]) for (const dy of [-W, 0, W]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
    g.fillStyle = o.base; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 14; i++) { const x = rnd() * W, y = rnd() * W, r = 50 + rnd() * 140, col = rnd() < .6 ? o.light : o.dark; wrap(() => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }); }
    g.lineWidth = 1;
    for (let i = 0; i < 5000; i++) { const x = rnd() * W, y = rnd() * W, l = 2 + rnd() * 5, a = 1.2 + (rnd() - .5) * .5; g.strokeStyle = rnd() < .5 ? o.fur : o.fur2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    const ops = [];
    const smooth = (P, n = 6) => { const out = [], L = P.length; for (let i = 0; i < L; i++) { const p0 = P[(i - 1 + L) % L], p1 = P[i], p2 = P[(i + 1) % L], p3 = P[(i + 2) % L], seg = []; for (let t = 0; t <= n; t++) { const u = t / n, u2 = u * u, u3 = u2 * u; seg.push([0, 1].map(k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3))); } out.push(seg); } return out; };
    const blobPts = (cx, cy, r, irr, k) => { const P = [], r0 = rnd() * 6; for (let i = 0; i < k; i++) { const a = r0 + i / k * Math.PI * 2 + (rnd() - .5) * .35, m = r * (1 + (rnd() - .5) * irr); P.push([cx + Math.cos(a) * m, cy + Math.sin(a) * m * (.85 + rnd() * .15)]); } return P; };
    const fillBlob = (P, col) => { const segs = smooth(P); ops.push(() => { g.beginPath(); segs.forEach((sg, i) => sg.forEach((p, j) => (i === 0 && j === 0) ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1]))); g.closePath(); g.fillStyle = col; g.fill(); }); };
    const dist = (a, x, y) => { let dx = Math.abs(a.x - x), dy = Math.abs(a.y - y); dx = Math.min(dx, W - dx); dy = Math.min(dy, W - dy); return Math.hypot(dx, dy); };
    const pts = []; let tries = 0;
    while (pts.length < 44 && tries < 6000) { tries++; const x = rnd() * W, y = rnd() * W, R = 18 + rnd() * 22; if (pts.every(p => dist(p, x, y) >= (p.R + R) * 1.12)) pts.push({ x, y, R }); }
    pts.forEach(({ x, y, R }) => {
      const k = 6 + Math.floor(rnd() * 3), P = blobPts(x, y, R, .32, k);
      fillBlob(P.map(([px, py]) => [x + (px - x) * .8, y + (py - y) * .8]), o.inner);
      const nd = rnd() < .8 ? 1 + Math.floor(rnd() * 3) : 0;
      for (let d = 0; d < nd; d++) { const a = rnd() * 6.28, dd = rnd() * R * .35, rr = R * (.07 + rnd() * .07); fillBlob(blobPts(x + Math.cos(a) * dd, y + Math.sin(a) * dd, rr, .5, 6), o.ring); }
      const segs = smooth(P), gaps = new Set(), ng = 1 + Math.floor(rnd() * 3);
      while (gaps.size < Math.min(ng, k - 2)) gaps.add(Math.floor(rnd() * k));
      segs.forEach((sg, i) => { if (gaps.has(i)) return; const w = R * (.22 + rnd() * .2); ops.push(() => { g.beginPath(); sg.forEach((p, j) => j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = o.ring; g.stroke(); }); });
      if (rnd() < .3) { const a = rnd() * 6.28; fillBlob(blobPts(x + Math.cos(a) * R * 1.15, y + Math.sin(a) * R * 1.15, R * .14, .5, 6), o.ring); }
    });
    let spots = 0; tries = 0;
    while (spots < 70 && tries < 3000) { tries++; const x = rnd() * W, y = rnd() * W, r = 2.5 + rnd() * 6; if (pts.every(p => dist(p, x, y) >= p.R * 1.35 + r)) { spots++; fillBlob(blobPts(x, y, r, .6, 6), o.ring); } }
    g.filter = 'blur(0.6px)'; ops.forEach(op => wrap(op)); g.filter = 'none';
    const b64 = c.toDataURL('image/png').split(',')[1], bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([u8], { type: 'image/png' }));
    if (key) cache[key] = url;
    return url;
  }
  window.OncaTexture = { generate, presets };
})();
