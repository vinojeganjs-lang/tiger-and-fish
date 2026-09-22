// ---------- art.js : painterly procedural backgrounds, characters, fx ----------
const Art = (() => {
  const PAL = {
    reef: { sky0: '#10222c', sky1: '#31505c', far: '#213f4b', mid: '#16303a', near: '#0d2028', sea0: '#0a1e28', sea1: '#03090d', rock: '#343a36', rockL: '#5a6058', wood: '#6a4a2a', woodL: '#a07a44', light: '#d8b878', fog: '#6b8a96' },
    forest: { sky0: '#0e1c16', sky1: '#27412f', far: '#16301f', mid: '#0d2215', near: '#07170d', rock: '#343a30', rockL: '#5a6450', wood: '#4a3820', woodL: '#7d6440', light: '#c9aa60', fog: '#4a6a55' },
    gorge: { sky0: '#1a2230', sky1: '#4a586c', far: '#334050', mid: '#242f3c', near: '#161d26', rock: '#3a4250', rockL: '#6a7484', wood: '#4a3620', woodL: '#7a5e38', light: '#d7c49c', fog: '#7b8a9c' },
    kingdom: { sky0: '#1a0f0a', sky1: '#5a2e14', far: '#3a1c10', mid: '#24120a', near: '#140a05', rock: '#3a2c20', rockL: '#6b5238', wood: '#4a3620', woodL: '#8a6a3c', light: '#e8b060', fog: '#7a4a2a' },
  };
  const cache = {};

  function dabs(ctx, rng, x, y, w, h, color, n, alpha = 0.08, sz = 18) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    for (let i = 0; i < n; i++) { const px = x + rng() * w, py = y + rng() * h, rw = sz * (0.4 + rng()), rh = sz * (0.15 + rng() * 0.4); ctx.beginPath(); ctx.ellipse(px, py, rw, rh, rng() * 0.6 - 0.3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function ridge(ctx, rng, fbm, W, baseY, amp, freq, color, seedOff, jag = 0) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, 2000);
    for (let x = 0; x <= W; x += 6) { let y = baseY - fbm((x + seedOff) * freq) * amp; if (jag) y += (rng() - 0.5) * jag; ctx.lineTo(x, y); }
    ctx.lineTo(W, 2000); ctx.closePath(); ctx.fill();
  }
  function trees(ctx, rng, W, baseY, count, hMin, hMax, color, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const x = rng() * W, h = hMin + rng() * (hMax - hMin), tw = 4 + rng() * 6;
      ctx.fillRect(x - tw / 2, baseY - h, tw, h + 40);
      // canopy blobs
      const layers = 3 + (rng() * 4 | 0);
      for (let l = 0; l < layers; l++) { const cy = baseY - h + l * (h / layers) * 0.5, cw = 30 + rng() * 60 * (1 - l / layers) + 20; ctx.beginPath(); ctx.ellipse(x + (rng() - 0.5) * 20, cy, cw, cw * 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  function palms(ctx, rng, W, baseY, count, color) {
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) { const x = rng() * W, h = 120 + rng() * 140, lean = (rng() - 0.5) * 0.8; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x, baseY + 30); ctx.quadraticCurveTo(x + lean * 40, baseY - h * 0.5, x + lean * 90, baseY - h); ctx.stroke(); const tx = x + lean * 90, ty = baseY - h; for (let f = 0; f < 7; f++) { const a = -Math.PI + f * (Math.PI / 6) + rng() * 0.3; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * 40, ty + Math.sin(a) * 40 - 10, tx + Math.cos(a) * 75, ty + Math.sin(a) * 75 + 35); ctx.stroke(); } }
  }

  // Build a parallax background for a scene. W = level width in px, H = 720.
  function bg(scene, seed, W, H = 720) {
    const key = scene + seed + W; if (cache[key]) return cache[key];
    const p = PAL[scene] || PAL.forest, rng = U.rng(seed), fbm = U.fbm1(seed);
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const layers = [];
    // sky
    { const c = mk(1280, H), x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, p.sky0); g.addColorStop(1, p.sky1); x.fillStyle = g; x.fillRect(0, 0, 1280, H); dabs(x, rng, 0, 0, 1280, H, p.sky1, 900, 0.06, 40); dabs(x, rng, 0, 0, 1280, H * 0.6, p.sky0, 600, 0.08, 50); if (scene === 'kingdom') { x.save(); x.globalAlpha = 0.5; const rg = x.createRadialGradient(900, 260, 10, 900, 260, 420); rg.addColorStop(0, p.light); rg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = rg; x.fillRect(0, 0, 1280, H); x.restore(); } layers.push({ c, px: 0, py: 0, fixed: true }); }
    // far
    { const w = Math.ceil(W * 0.25) + 1280, c = mk(w, H), x = c.getContext('2d'); ridge(x, rng, fbm, w, H * 0.62, 260, 0.0025, p.far, 100); dabs(x, rng, 0, H * 0.3, w, H * 0.5, p.sky1, w / 2, 0.05, 30); if (scene === 'reef') { /* distant sea horizon */ x.fillStyle = p.sea0; x.fillRect(0, H * 0.66, w, H); } x.fillStyle = U.hex(p.fog, 0.35); x.fillRect(0, H * 0.55, w, H * 0.2); layers.push({ c, px: 0.25, py: 0.05 }); }
    // mid
    { const w = Math.ceil(W * 0.5) + 1280, c = mk(w, H), x = c.getContext('2d'); ridge(x, rng, fbm, w, H * 0.78, 200, 0.004, p.mid, 900, 2); if (scene === 'forest' || scene === 'reef') trees(x, rng, w, H * 0.8, w / 40, 120, 260, p.mid); if (scene === 'reef') palms(x, rng, w, H * 0.8, w / 160, p.mid); if (scene === 'gorge') { ridge(x, rng, fbm, w, H * 0.7, 320, 0.006, p.mid, 2200, 6); } if (scene === 'kingdom') { /* ruined towers */ for (let i = 0; i < w / 300; i++) { const bx = rng() * w, bw = 40 + rng() * 60, bh = 120 + rng() * 260; x.fillStyle = p.mid; x.fillRect(bx, H * 0.78 - bh, bw, bh); for (let t = 0; t < 5; t++) x.fillRect(bx - 8 + t * (bw / 4), H * 0.78 - bh - 14 - rng() * 20, bw / 6, 20); } } dabs(x, rng, 0, H * 0.4, w, H * 0.5, p.far, w / 3, 0.07, 26); layers.push({ c, px: 0.5, py: 0.12 }); }
    // near (behind platforms)
    { const w = Math.ceil(W * 0.8) + 1280, c = mk(w, H), x = c.getContext('2d'); const near = p.near || p.mid; if (scene === 'forest') trees(x, rng, w, H * 0.95, w / 55, 220, 420, near); if (scene === 'reef') { palms(x, rng, w, H * 0.9, w / 240, near); } if (scene === 'gorge') ridge(x, rng, fbm, w, H * 0.9, 150, 0.01, near, 4200, 10); if (scene === 'kingdom') trees(x, rng, w, H * 0.95, w / 90, 180, 320, near); layers.push({ c, px: 0.8, py: 0.2 }); }
    // foreground (over players), sparse
    { const w = Math.ceil(W * 1.25) + 1280, c = mk(w, H), x = c.getContext('2d'); const near = p.near || p.mid; x.globalAlpha = 0.9; if (scene === 'forest') { for (let i = 0; i < w / 350; i++) { const fx = rng() * w; x.fillStyle = '#020806'; for (let l = 0; l < 6; l++) { x.beginPath(); x.ellipse(fx + (rng() - 0.5) * 120, H - 30 - l * 45, 60 + rng() * 60, 30, (rng() - 0.5), 0, Math.PI * 2); x.fill(); } } } if (scene === 'reef') { for (let i = 0; i < w / 500; i++) { const fx = rng() * w; x.fillStyle = '#04090c'; x.beginPath(); x.ellipse(fx, H + 20, 120 + rng() * 100, 70, 0, 0, Math.PI * 2); x.fill(); } } if (scene === 'gorge') { for (let i = 0; i < w / 600; i++) { const fx = rng() * w; x.fillStyle = '#080b10'; x.beginPath(); x.moveTo(fx, H); x.lineTo(fx + 60, H - 160 - rng() * 100); x.lineTo(fx + 150, H); x.fill(); } } layers.push({ c, px: 1.25, py: 0.3, fg: true }); }
    const out = { layers, p, scene, W, H, seed };
    cache[key] = out; return out;
  }

  function drawLayers(ctx, b, camX, camY, t, fg = false) {
    const H = b.H;
    for (const L of b.layers) {
      if (!!L.fg !== fg) continue;
      if (L.fixed) { ctx.drawImage(L.c, 0, 0); continue; }
      const ox = -camX * L.px, oy = -camY * L.py; const w = L.c.width;
      let sx = ox % w; if (sx > 0) sx -= w;
      for (let x = sx; x < 1280; x += w) ctx.drawImage(L.c, x, oy);
    }
  }
  function fog(ctx, t, color, alpha, y0, h, camX) { ctx.save(); ctx.globalAlpha = alpha; const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; for (let i = 0; i < 3; i++) { const dx = ((t * (12 + i * 7) - camX * 0.3) % 1600); ctx.beginPath(); ctx.ellipse(((dx % 1600) + 1600) % 1600 - 160 + i * 500, y0 + h / 2 + Math.sin(t * 0.3 + i) * 20, 500, h / 2, 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
  function rain(ctx, t, intensity, camX, wind = 0.35) { ctx.save(); ctx.strokeStyle = 'rgba(190,210,220,0.28)'; ctx.lineWidth = 1; const n = 140 * intensity; ctx.beginPath(); for (let i = 0; i < n; i++) { const sp = 900 + (i % 5) * 120; const x = ((i * 137.7 - camX * 0.9 + t * sp * wind) % 1400 + 1400) % 1400 - 60; const y = ((i * 91.3 + t * sp) % 800) - 40; ctx.moveTo(x, y); ctx.lineTo(x - 14 * wind * 2, y + 22); } ctx.stroke(); ctx.restore(); }
  function shafts(ctx, t, camX, color) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 4; i++) { const x = ((i * 430 - camX * 0.6) % 1500 + 1500) % 1500 - 100; const a = 0.05 + 0.03 * Math.sin(t * 0.5 + i); const g = ctx.createLinearGradient(x, 0, x + 80, 720); g.addColorStop(0, U.hex(color, a)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x + 120, -20); ctx.lineTo(x + 260, 740); ctx.lineTo(x + 60, 740); ctx.fill(); } ctx.restore(); }
  function vignette(ctx, W, H, k = 0.75) { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${k})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  function water(ctx, t, level, camX, W, alpha = 0.9) { ctx.save(); const g = ctx.createLinearGradient(0, level, 0, 720); g.addColorStop(0, `rgba(20,60,75,${alpha})`); g.addColorStop(1, `rgba(2,8,12,${alpha})`); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 740); for (let x = 0; x <= 1280; x += 16) { const wx = x + camX; ctx.lineTo(x, level + Math.sin(wx * 0.02 + t * 2.2) * 6 + Math.sin(wx * 0.053 - t * 3.1) * 3); } ctx.lineTo(1280, 740); ctx.fill(); ctx.strokeStyle = 'rgba(180,220,230,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= 1280; x += 16) { const wx = x + camX; const y = level + Math.sin(wx * 0.02 + t * 2.2) * 6 + Math.sin(wx * 0.053 - t * 3.1) * 3; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore(); }

  // ---- platforms (cached paint) ----
  const platCache = new Map();
  function platform(ctx, pl, scene, cx, cy) {
    const p = PAL[scene] || PAL.forest; const key = pl.id || (pl.id = Math.random().toString(36).slice(2));
    let c = platCache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = pl.w + 24; c.height = pl.h + 24; const x = c.getContext('2d'); const rng = U.rng(key.length * 7919 + pl.w);
      x.translate(12, 12);
      if (pl.type === 'wood' || pl.type === 'brace') { x.fillStyle = p.wood; x.fillRect(0, 0, pl.w, pl.h); dabs(x, rng, 0, 0, pl.w, pl.h, p.woodL, pl.w / 6, 0.25, 12); x.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < pl.w; i += 38 + rng() * 20) x.fillRect(i, 0, 2, pl.h); x.fillStyle = U.hex(p.light, 0.35); x.fillRect(0, 0, pl.w, 3); }
      else if (pl.type === 'vine') { x.strokeStyle = '#2e4a24'; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(pl.w / 2, 0); x.lineTo(pl.w / 2, pl.h); x.stroke(); x.fillStyle = '#3d6330'; for (let y = 0; y < pl.h; y += 22) { x.beginPath(); x.ellipse(pl.w / 2 + (y % 44 ? 8 : -8), y, 9, 4, y % 44 ? 0.6 : -0.6, 0, Math.PI * 2); x.fill(); } }
      else { // rock
        const g = x.createLinearGradient(0, 0, 0, pl.h); g.addColorStop(0, p.rockL || '#5a6058'); g.addColorStop(0.15, p.rock); g.addColorStop(1, '#0a0d0c'); x.fillStyle = g;
        x.beginPath(); x.moveTo(-4, 6); x.lineTo(pl.w * 0.1, 0); x.lineTo(pl.w * 0.9, 0); x.lineTo(pl.w + 4, 8); x.lineTo(pl.w + 2, pl.h); x.lineTo(-2, pl.h); x.closePath(); x.fill();
        dabs(x, rng, 0, 0, pl.w, Math.min(pl.h, 90), p.rockL || p.woodL, Math.min(pl.w / 6, 120), 0.07, 22); dabs(x, rng, 0, 20, pl.w, pl.h - 20, '#000', Math.min(pl.w / 7, 160), 0.14, 26);
        // strata / cracks
        x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2; for (let i = 0; i < pl.w / 40; i++) { const sx = rng() * pl.w, sy = 20 + rng() * (pl.h - 30); x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + 10 + rng() * 40, sy + (rng() - 0.5) * 30); x.stroke(); }
        x.fillStyle = U.hex(p.light, 0.35); x.fillRect(0, 0, pl.w, 3);
        if (scene !== 'kingdom') { x.fillStyle = scene === 'gorge' ? '#556a48' : '#3a6a34'; for (let i = 0; i < pl.w; i += 12) if (rng() < 0.7) { x.beginPath(); x.ellipse(i, 2 + rng() * 3, 7 + rng() * 5, 4, 0, 0, Math.PI * 2); x.fill(); } }
      }
      platCache.set(key, c);
    }
    ctx.drawImage(c, pl.x - cx - 12, pl.y - cy - 12);
  }

  // ---- characters ----
  // p: {x,y,w,h,face(1|-1),anim,animT,who('K'|'S'|'M'),held}
  function character(ctx, p, t, cx, cy, opts = {}) {
    const fx = p.x - cx + p.w / 2, fy = p.y - cy + p.h; // feet
    const who = p.who, s = p.h / 60;
    const dark = opts.dark || (who === 'K' ? '#161512' : who === 'S' ? '#12161a' : '#1a1410');
    const rim = opts.rim || (who === 'K' ? '#c9a15c' : who === 'S' ? '#8fc0c8' : '#d9b48a');
    const anim = p.anim || 'idle', at = p.animT || t;
    let legA = 0, armA = 0, bob = 0, crouch = 0;
    if (anim === 'run') { legA = Math.sin(at * 14) * 0.7; armA = -legA; bob = Math.abs(Math.sin(at * 14)) * 3; }
    else if (anim === 'jump') { legA = 0.35; armA = -1.6; }
    else if (anim === 'hold') { crouch = 8; armA = -1.1; legA = 0.5; }
    else if (anim === 'climb') { legA = Math.sin(at * 8) * 0.5; armA = -2.4 + Math.sin(at * 8) * 0.4; }
    else if (anim === 'dead') { }
    else { bob = Math.sin(at * 1.6) * 1.2; armA = 0.08 * Math.sin(at * 1.6); }
    ctx.save(); ctx.translate(fx, fy - bob); ctx.scale(p.face || 1, 1);
    if (anim === 'dead') { ctx.rotate(-Math.PI / 2); ctx.translate(-10, 20); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const legLen = 24 * s - crouch, torso = 24 * s, headR = (who === 'M' ? 6.5 : 7) * s;
    const hipY = -legLen, shY = hipY - torso;
    const stroke = (col, w, pts) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); };
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 2, 16 * s, 4, 0, 0, Math.PI * 2); ctx.fill();
    // legs
    const lw = (who === 'K' ? 8 : 6.5) * s;
    stroke(dark, lw, [[-3, hipY], [-3 + Math.sin(legA) * 12, hipY + legLen * 0.55], [-3 + Math.sin(legA) * 16, 0]]);
    stroke(dark, lw, [[3, hipY], [3 - Math.sin(legA) * 12, hipY + legLen * 0.55], [3 - Math.sin(legA) * 16, 0]]);
    // torso
    const tw = (who === 'K' ? 20 : who === 'S' ? 15 : 14) * s;
    ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-tw / 2, shY); ctx.lineTo(tw / 2, shY); ctx.lineTo(tw * 0.35, hipY + 2); ctx.lineTo(-tw * 0.35, hipY + 2); ctx.closePath(); ctx.fill();
    // bag / gear
    if (who === 'K') { ctx.fillStyle = '#3a2e1e'; ctx.beginPath(); ctx.roundRect(-tw / 2 - 8, shY + 4, 10, 18, 3); ctx.fill(); }
    if (who === 'M') { ctx.fillStyle = '#4a3a24'; ctx.beginPath(); ctx.roundRect(tw / 2 - 2, hipY - 8, 9, 11, 2); ctx.fill(); }
    // arms
    const aw = (who === 'K' ? 7 : 5.5) * s;
    stroke(dark, aw, [[-tw / 2 + 2, shY + 3], [-tw / 2 + 2 + Math.sin(armA) * 10, shY + 12], [-tw / 2 + 2 + Math.sin(armA) * 18 + (anim === 'hold' ? 14 : 0), shY + 22 + (anim === 'hold' ? -6 : 0)]]);
    stroke(dark, aw, [[tw / 2 - 2, shY + 3], [tw / 2 - 2 - Math.sin(armA) * 10, shY + 12], [tw / 2 - 2 - Math.sin(armA) * 18 + (anim === 'hold' ? 14 : 0), shY + 22 + (anim === 'hold' ? -6 : 0)]]);
    if (p.torch) { ctx.fillStyle = '#ffb84a'; ctx.beginPath(); ctx.ellipse(tw / 2 + 10, shY + 6 + Math.sin(t * 20) * 1.5, 6, 9, 0, 0, Math.PI * 2); ctx.fill(); }
    // head
    ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, shY - headR + 1, headR, 0, Math.PI * 2); ctx.fill();
    if (who === 'S') { ctx.fillStyle = '#8a2a2a'; ctx.fillRect(-headR, shY - headR - 2, headR * 2, 3); }
    if (who === 'M') { ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-headR + 1, shY - headR + 6, 4, 9, 0.4, 0, Math.PI * 2); ctx.fill(); }
    // rim light (right side, from above)
    ctx.strokeStyle = rim; ctx.lineWidth = 2.2; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(0, shY - headR + 1, headR - 0.5, -1.2, 0.6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(tw / 2 - 1, shY + 1); ctx.lineTo(tw * 0.35 - 1, hipY); ctx.stroke(); ctx.globalAlpha = 1;
    // tiger mark (revealed later)
    if (p.tiger) { ctx.strokeStyle = '#e8a040'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, shY + 6); ctx.lineTo(4, shY + 8); ctx.moveTo(-5, shY + 11); ctx.lineTo(5, shY + 13); ctx.moveTo(-3, shY + 16); ctx.lineTo(3, shY + 17); ctx.stroke(); }
    ctx.restore();
  }

  function hunter(ctx, h, t, cx, cy) {
    const x = h.x - cx, y = h.y - cy; ctx.save(); ctx.translate(x, y); ctx.scale(h.face || 1, 1);
    const alert = h.state === 'chase' ? 1 : h.state === 'listen' ? 0.5 : 0;
    ctx.fillStyle = '#1a2320'; ctx.strokeStyle = '#1a2320'; ctx.lineCap = 'round';
    const bob = h.state === 'chase' ? Math.abs(Math.sin(t * 18)) * 4 : Math.sin(t * 2) * 1.5;
    // hunched body
    ctx.beginPath(); ctx.ellipse(0, -30 - bob, 22, 14, -0.35, 0, Math.PI * 2); ctx.fill();
    // long limbs
    ctx.lineWidth = 6; const la = h.state === 'chase' ? Math.sin(t * 18) * 0.9 : h.state === 'listen' ? 0 : Math.sin(t * 3) * 0.2;
    [[-8, 1], [6, -1]].forEach(([ox, sg]) => { ctx.beginPath(); ctx.moveTo(ox, -26 - bob); ctx.lineTo(ox + Math.sin(la * sg) * 18, -8); ctx.lineTo(ox + Math.sin(la * sg) * 26, 0); ctx.stroke(); });
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(14, -34 - bob); ctx.lineTo(30, -20 - bob + (alert ? -14 : 0)); ctx.lineTo(38, -6 - bob + (alert ? -20 : 0)); ctx.stroke();
    // head, no eyes: a smooth skull with big ear flaps
    ctx.beginPath(); ctx.ellipse(20, -44 - bob, 11, 9, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(12, -50 - bob); ctx.lineTo(4, -66 - bob - alert * 6); ctx.lineTo(16, -52 - bob); ctx.fill();
    ctx.beginPath(); ctx.moveTo(26, -50 - bob); ctx.lineTo(34, -66 - bob - alert * 6); ctx.lineTo(28, -52 - bob); ctx.fill();
    ctx.strokeStyle = '#7f9a90'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(20, -44 - bob, 10.5, -2.2, -0.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -42 - bob); ctx.quadraticCurveTo(-10, -30 - bob, -6, -18 - bob); ctx.stroke();
    if (h.state === 'listen') { ctx.strokeStyle = 'rgba(200,220,230,0.35)'; ctx.lineWidth = 1.5; for (let r = 1; r <= 2; r++) { ctx.beginPath(); ctx.arc(20, -44, 14 + r * 10 + (t * 30 % 10), -1.2, 1.2); ctx.stroke(); } }
    if (h.state === 'chase') { ctx.fillStyle = '#c93b2a'; ctx.beginPath(); ctx.arc(24, -42 - bob, 2.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // ---- story panel paintings ----
  const panelCache = {};
  function panel(id, W = 1280, H = 720) {
    if (panelCache[id]) return panelCache[id];
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); const rng = U.rng(id.length * 131 + 7), fbm = U.fbm1(id.length * 17);
    const sky = (a, b) => { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, W, H); };
    switch (id) {
      case 'ship': { sky('#08111a', '#1d3547'); dabs(x, rng, 0, 0, W, H * 0.6, '#2a4a5c', 1200, 0.06, 60); x.fillStyle = '#03080c'; x.fillRect(0, H * 0.62, W, H); // sea
        for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(120,170,190,${0.05 + rng() * 0.15})`; x.beginPath(); x.ellipse(rng() * W, H * 0.62 + rng() * H * 0.38, 60 + rng() * 120, 4 + rng() * 6, 0, 0, Math.PI * 2); x.fill(); }
        // ship silhouette
        x.fillStyle = '#05080a'; x.beginPath(); x.moveTo(420, 470); x.quadraticCurveTo(640, 520, 880, 460); x.lineTo(900, 400); x.lineTo(400, 400); x.closePath(); x.fill(); x.fillRect(630, 200, 8, 210); x.beginPath(); x.moveTo(640, 210); x.quadraticCurveTo(760, 300, 640, 390); x.fill(); // sail
        // tiger banner glow
        x.fillStyle = '#c9862c'; x.beginPath(); x.moveTo(640, 215); x.lineTo(700, 235); x.lineTo(640, 255); x.fill();
        // moon
        x.fillStyle = '#e8d8b0'; x.globalAlpha = 0.9; x.beginPath(); x.arc(1000, 150, 46, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
        break; }
      case 'fish': { sky('#1a0c05', '#3d1c0a'); dabs(x, rng, 0, 0, W, H, '#5a2a10', 1500, 0.07, 50);
        // temple interior with golden fish
        x.fillStyle = '#0d0603'; x.fillRect(0, 0, 120, H); x.fillRect(W - 120, 0, 120, H); for (let i = 0; i < 6; i++) { x.fillRect(200 + i * 160, 60, 28, H); }
        const g = x.createRadialGradient(640, 380, 10, 640, 380, 300); g.addColorStop(0, 'rgba(255,200,90,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.fillStyle = '#f0c040'; x.beginPath(); x.ellipse(640, 380, 110, 46, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.moveTo(740, 380); x.lineTo(800, 330); x.lineTo(800, 430); x.fill(); x.fillStyle = '#7a4a10'; x.beginPath(); x.arc(585, 372, 7, 0, Math.PI * 2); x.fill();
        // hands reaching
        x.fillStyle = '#0d0603'; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(300 + i * 170, H); x.lineTo(330 + i * 170, 520 - rng() * 60); x.lineTo(360 + i * 170, H); x.fill(); }
        break; }
      case 'harbour': { sky('#2a2f38', '#8a7a62'); dabs(x, rng, 0, 0, W, H * 0.5, '#5a5a60', 900, 0.08, 60);
        x.fillStyle = '#3d4450'; x.fillRect(0, H * 0.55, W, H); dabs(x, rng, 0, H * 0.55, W, H * 0.45, '#5a6472', 700, 0.12, 40);
        // boats
        for (let i = 0; i < 9; i++) { const bx = 80 + i * 140 + rng() * 40, by = 430 + rng() * 120; x.fillStyle = '#12151a'; x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo(bx + 50, by + 30, bx + 100, by); x.lineTo(bx + 90, by - 14); x.lineTo(bx + 10, by - 14); x.fill(); x.fillRect(bx + 48, by - 80, 3, 70); }
        // two figures on the pier
        x.fillStyle = '#0e0f12'; x.fillRect(0, 520, 520, 24); character(x, { x: 300, y: 460, w: 28, h: 60, face: 1, anim: 'idle', who: 'K' }, 0, 0, 0); character(x, { x: 350, y: 460, w: 26, h: 60, face: -1, anim: 'idle', who: 'S' }, 1, 0, 0);
        break; }
      case 'island': { sky('#0a1418', '#2b4a52'); dabs(x, rng, 0, 0, W, H, '#1e3a42', 1400, 0.06, 70);
        x.fillStyle = '#04090c'; x.fillRect(0, H * 0.7, W, H);
        ridge(x, rng, fbm, W, H * 0.7, 300, 0.003, '#0c1a1e', 50); ridge(x, rng, fbm, W, H * 0.72, 160, 0.006, '#071114', 800, 3);
        x.fillStyle = 'rgba(120,150,160,0.25)'; x.fillRect(0, H * 0.55, W, 60);
        // small boat
        x.fillStyle = '#020405'; x.beginPath(); x.moveTo(560, 600); x.quadraticCurveTo(640, 630, 720, 600); x.lineTo(710, 585); x.lineTo(570, 585); x.fill(); for (let i = 0; i < 4; i++) x.fillRect(590 + i * 30, 560, 6, 26);
        break; }
      case 'notebook': { sky('#2a2318', '#0f0c08'); x.fillStyle = '#c9b48a'; x.save(); x.translate(640, 380); x.rotate(-0.05); x.fillRect(-300, -200, 600, 400); x.fillStyle = '#3a2e1e'; x.lineWidth = 2; x.strokeStyle = '#3a2e1e'; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(-260, -150 + i * 26); x.lineTo(-260 + 200 + rng() * 300, -150 + i * 26 + (rng() - 0.5) * 6); x.stroke(); } x.strokeStyle = '#6b1f14'; x.lineWidth = 3; x.beginPath(); x.moveTo(-200, 60); x.quadraticCurveTo(-60, -80, 40, 20); x.quadraticCurveTo(140, 120, 240, -40); x.stroke(); x.beginPath(); x.arc(240, -40, 10, 0, Math.PI * 2); x.stroke(); x.restore(); dabs(x, rng, 0, 0, W, H, '#000', 500, 0.15, 80);
        break; }
      case 'tiger': { sky('#040608', '#101a22'); const g = x.createRadialGradient(640, 300, 20, 640, 300, 500); g.addColorStop(0, 'rgba(60,90,110,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.fillStyle = '#0a0d10'; x.fillRect(0, 560, W, H); // water
        // back with tiger mark
        x.fillStyle = '#1a1612'; x.beginPath(); x.moveTo(520, 560); x.lineTo(540, 300); x.quadraticCurveTo(640, 250, 740, 300); x.lineTo(760, 560); x.fill(); x.beginPath(); x.arc(640, 230, 40, 0, Math.PI * 2); x.fill();
        x.strokeStyle = '#e8a040'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(600, 340); x.quadraticCurveTo(640, 320, 690, 345); x.moveTo(590, 380); x.quadraticCurveTo(640, 355, 700, 385); x.moveTo(600, 420); x.quadraticCurveTo(640, 395, 690, 425); x.moveTo(615, 458); x.quadraticCurveTo(640, 440, 670, 460); x.stroke();
        x.fillStyle = '#e8a040'; x.beginPath(); x.arc(640, 300, 6, 0, Math.PI * 2); x.fill();
        break; }
      case 'kingdom': { sky('#1a0f0a', '#6a3416'); dabs(x, rng, 0, 0, W, H, '#8a4a20', 1500, 0.07, 60);
        x.fillStyle = '#120904'; for (let i = 0; i < 9; i++) { const bx = 40 + i * 150, bw = 50 + rng() * 60, bh = 200 + rng() * 300; x.fillRect(bx, H * 0.85 - bh, bw, bh); for (let t = 0; t < 4; t++) x.fillRect(bx + t * (bw / 4), H * 0.85 - bh - 16, bw / 6, 18); }
        x.fillStyle = '#0a0503'; x.fillRect(0, H * 0.85, W, H);
        // torches
        for (let i = 0; i < 12; i++) { const tx = 60 + i * 110, ty = 520 + rng() * 60; const tg = x.createRadialGradient(tx, ty, 2, tx, ty, 60); tg.addColorStop(0, 'rgba(255,190,90,0.9)'); tg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = tg; x.fillRect(tx - 60, ty - 60, 120, 120); }
        // crowd silhouettes
        x.fillStyle = '#0a0503'; for (let i = 0; i < 60; i++) { const px = rng() * W, py = 600 + rng() * 60; x.beginPath(); x.arc(px, py - 40, 7, 0, Math.PI * 2); x.fill(); x.fillRect(px - 6, py - 34, 12, 40); }
        break; }
      case 'boat': { sky('#0d1a24', '#4a5a5a'); dabs(x, rng, 0, 0, W, H * 0.6, '#6a7a78', 1200, 0.06, 70); x.fillStyle = '#0b1418'; x.fillRect(0, H * 0.6, W, H);
        const g = x.createRadialGradient(1100, 200, 10, 1100, 200, 400); g.addColorStop(0, 'rgba(230,180,110,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.fillStyle = '#020405'; x.beginPath(); x.moveTo(400, 520); x.quadraticCurveTo(640, 570, 880, 520); x.lineTo(860, 495); x.lineTo(420, 495); x.fill();
        character(x, { x: 560, y: 435, w: 28, h: 60, face: 1, anim: 'idle', who: 'K' }, 0, 0, 0); character(x, { x: 700, y: 435, w: 26, h: 60, face: -1, anim: 'idle', who: 'S' }, 1, 0, 0);
        x.fillStyle = '#1a1410'; x.beginPath(); x.arc(640, 460, 6, 0, Math.PI * 2); x.fill(); x.fillRect(634, 466, 12, 28);
        break; }
      default: sky('#000', '#111');
    }
    dabs(x, rng, 0, 0, W, H, '#000', 600, 0.12, 90); vignette(x, W, H, 0.85);
    panelCache[id] = c; return c;
  }

  function flash(ctx, t, seed = 0) { const ph = (t * 0.37 + seed) % 11; const a = ph < 0.12 ? (1 - ph / 0.12) * 0.55 : ph > 0.25 && ph < 0.32 ? 0.25 : 0; if (a > 0) { ctx.fillStyle = `rgba(200,220,240,${a})`; ctx.fillRect(0, 0, 1280, 720); } }
  return { PAL, flash, bg, drawLayers, fog, rain, shafts, vignette, water, platform, character, hunter, panel, dabs };
})();
