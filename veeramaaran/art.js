'use strict';
/* ===== Palettes ===== */
const PAL = {
  hero:   { skin: '#7a4423', rim: '#ffb066', cloth: '#a3221a', clothHi: '#e8502c', gold: '#e8b33a', hair: '#150a06', band: '#e8b33a', out: '#140604' },
  p2:     { skin: '#6b3b20', rim: '#ffc27a', cloth: '#25407e', clothHi: '#4c79d0', gold: '#d9b44a', hair: '#120806', band: '#c9d2e8', out: '#0c0606' },
  bandit: { skin: '#5a3220', rim: '#ff8a4a', cloth: '#2b2622', clothHi: '#4a3e34', gold: '#7a5a30', hair: '#0e0806', band: '#7a1a12', out: '#0a0504' },
  pirate: { skin: '#5e3824', rim: '#ffa06a', cloth: '#1d4a4a', clothHi: '#2f7a72', gold: '#9a7a3a', hair: '#0e0806', band: '#b8b0a0', out: '#080606' },
  soldier:{ skin: '#56301e', rim: '#ff7a40', cloth: '#4a1414', clothHi: '#7a2a20', gold: '#8a8f99', hair: '#0e0806', band: '#3b4048', out: '#060404', helmet: '#3b4048' },
  dark:   { skin: '#3e2418', rim: '#ff5a2a', cloth: '#16121a', clothHi: '#3a2a40', gold: '#b08a3a', hair: '#050303', band: '#5a1010', out: '#020101', helmet: '#24222a' }
};

/* ===== Warrior figure ===== */
function seg(c, x1, y1, x2, y2, w, col) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
function limb(c, pts, w, p) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  const path = () => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); };
  c.strokeStyle = p.out; c.lineWidth = w + 3; path(); c.stroke();
  c.strokeStyle = p.skin; c.lineWidth = w; path(); c.stroke();
  c.save(); c.translate(-1, -1.2); c.globalAlpha *= 0.55; c.strokeStyle = p.rim; c.lineWidth = Math.max(1, w * 0.28); path(); c.stroke(); c.restore();
}
const rotp = (len, a) => [Math.sin(a) * len, Math.cos(a) * len];

function drawWarrior(c, x, y, o) {
  const p = o.pal || PAL.hero, s = o.scale || 1, f = o.face || 1;
  c.save(); c.translate(x, y); c.scale(s * f, s);
  const ax = (o.aim ? o.aim.x : 1) * f, ay = o.aim ? o.aim.y : 0;
  if (o.flash > 0) c.filter = 'brightness(2.4)';
  // ground shadow
  if (o.state !== 'roll') { c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, 1, 16, 4, 0, 0, 6.283); c.fill(); }

  if (o.state === 'roll') {
    c.translate(0, -34); c.rotate((o.spin || 0) * f);
    limb(c, [-6, 4, 8, 10, 4, 18], 7, p); limb(c, [6, 4, 14, -2, 8, -10], 7, p);
    c.fillStyle = p.cloth; c.beginPath(); c.arc(0, 0, 12, 0, 6.283); c.fill();
    c.strokeStyle = p.out; c.lineWidth = 2; c.stroke();
    c.fillStyle = p.skin; c.beginPath(); c.arc(-9, -9, 7, 0, 6.283); c.fill();
    c.fillStyle = p.hair; c.beginPath(); c.arc(-12, -13, 5, 0, 6.283); c.fill();
    c.restore(); return;
  }
  if (o.state === 'dead') {
    const k = Math.min(1, (o.deadT || 0) * 2.2);
    c.rotate(-k * 1.45); c.translate(0, k * 4);
  }
  const ph = o.phase || 0;
  const run = o.state === 'run', crouch = o.state === 'crouch';
  const hipY = crouch ? -24 : -36 + (run ? -Math.abs(Math.sin(ph)) * 2.5 : 0);
  const lean = run ? 4 : 0;
  const shX = 2 + lean, shY = crouch ? -46 : -59 + (run ? -Math.abs(Math.sin(ph)) * 2.5 : 0);

  // legs
  const leg = (phase, back) => {
    let th, bend;
    if (run) { th = Math.sin(phase) * 0.75; bend = 0.25 + Math.max(0, Math.sin(phase + 1.7)) * 1.1; }
    else if (crouch) { th = back ? -0.2 : 1.25; bend = back ? 1.9 : 1.6; }
    else { th = back ? -0.12 : 0.14; bend = 0.08; }
    const [kx, ky] = rotp(17, th), [fx, fy] = rotp(18, th - bend);
    const hx = back ? -3 : 3;
    const k1x = hx + kx, k1y = hipY + ky, f1x = k1x + fx, f1y = Math.min(0, k1y + fy);
    c.globalAlpha *= back ? 0.82 : 1;
    limb(c, [hx, hipY, k1x, k1y, f1x, f1y], 7.5, p);
    seg(c, f1x - 1, f1y, f1x + 6, f1y, 4, p.out);
    c.globalAlpha /= back ? 0.82 : 1;
  };
  leg(ph + Math.PI, true);

  // back arm (string hand)
  const dirA = Math.atan2(ay, ax);
  const dx = Math.cos(dirA), dy = Math.sin(dirA);
  const weapon = o.weapon || 'bow';
  if (weapon === 'bow') {
    const pull = o.drawn ? 4 : 10;
    limb(c, [shX - 3, shY + 1, shX - 3 - dx * 6 + dy * 6, shY + 4 - dy * 6 - dx * 2, shX + dx * pull, shY + 2 + dy * pull], 6, p);
  } else {
    const sw = run ? Math.sin(ph + Math.PI) * 0.9 : 0.3;
    const [ex, ey] = rotp(13, sw), [hx2, hy2] = rotp(12, sw - 0.6);
    limb(c, [shX - 3, shY + 1, shX - 3 + ex, shY + 1 + ey, shX - 3 + ex + hx2, shY + 1 + ey + hy2], 6, p);
  }

  // torso
  c.fillStyle = p.out; c.beginPath();
  c.moveTo(-9, hipY - 1); c.lineTo(9, hipY - 1); c.lineTo(shX + 12, shY - 1); c.lineTo(shX - 11, shY - 1); c.closePath(); c.fill();
  const tg = c.createLinearGradient(-10, shY, 12, hipY); tg.addColorStop(0, p.rim); tg.addColorStop(0.18, p.skin); tg.addColorStop(1, p.skin);
  c.fillStyle = tg; c.beginPath();
  c.moveTo(-7, hipY); c.lineTo(7, hipY); c.lineTo(shX + 10, shY); c.lineTo(shX - 9, shY); c.closePath(); c.fill();
  if (p.helmet) { // iron cuirass
    c.fillStyle = p.helmet; c.beginPath(); c.moveTo(-7, hipY - 2); c.lineTo(7, hipY - 2); c.lineTo(shX + 9, shY + 3); c.lineTo(shX - 8, shY + 3); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,190,120,.35)'; c.lineWidth = 1; for (let i = 0; i < 3; i++) seg(c, -6, hipY - 6 - i * 6, 8 + lean, hipY - 6 - i * 6, 1, 'rgba(255,190,120,.3)');
  } else {
    seg(c, shX - 9, shY + 2, shX + 10, hipY - 6, 2, p.band); // sash
  }
  // belt + veshti
  c.fillStyle = p.gold; c.fillRect(-8, hipY - 3, 17, 4);
  const fl = run ? Math.sin(ph * 2) * 2 : 0;
  c.fillStyle = p.out; c.beginPath(); c.moveTo(-10, hipY); c.lineTo(10, hipY); c.lineTo(12, hipY + 15); c.lineTo(-13 - fl, hipY + 17); c.closePath(); c.fill();
  c.fillStyle = p.cloth; c.beginPath(); c.moveTo(-9, hipY + 1); c.lineTo(9, hipY + 1); c.lineTo(11, hipY + 14); c.lineTo(-12 - fl, hipY + 16); c.closePath(); c.fill();
  c.fillStyle = p.clothHi; c.beginPath(); c.moveTo(-2, hipY + 1); c.lineTo(3, hipY + 1); c.lineTo(1, hipY + 15); c.lineTo(-4, hipY + 15); c.closePath(); c.fill();
  c.fillStyle = p.gold; c.fillRect(-12 - fl, hipY + 13, 23 + fl, 2);

  leg(ph, false);

  // head
  const hx = shX + 2, hy = shY - 9;
  c.fillStyle = p.out; c.fillRect(hx - 3, hy + 2, 6, 7);
  c.fillStyle = p.skin; c.fillRect(hx - 2, hy + 2, 4, 7);
  c.fillStyle = p.out; c.beginPath(); c.arc(hx, hy, 8.6, 0, 6.283); c.fill();
  c.fillStyle = p.skin; c.beginPath(); c.arc(hx, hy, 7.4, 0, 6.283); c.fill();
  c.fillStyle = p.rim; c.globalAlpha *= 0.5; c.beginPath(); c.arc(hx - 1.5, hy - 1.5, 6, Math.PI * 0.9, Math.PI * 1.6); c.lineTo(hx, hy); c.fill(); c.globalAlpha /= 0.5;
  // eye + moustache
  c.fillStyle = o.hero ? '#fff2d8' : '#ffdd99'; c.fillRect(hx + 3, hy - 2, 2.6, 1.6);
  c.fillStyle = p.hair; c.fillRect(hx + 2, hy + 3, 6, 1.6);
  if (p.helmet) {
    c.fillStyle = p.helmet; c.beginPath(); c.arc(hx, hy - 1, 8.4, Math.PI, 0); c.lineTo(hx + 9, hy + 1); c.lineTo(hx - 9, hy + 1); c.fill();
    c.fillStyle = p.band; c.fillRect(hx - 1, hy - 14, 3, 6);
    c.fillStyle = '#a3150f'; c.beginPath(); c.moveTo(hx, hy - 14); c.quadraticCurveTo(hx - 12, hy - 18, hx - 16, hy - 6); c.lineTo(hx - 2, hy - 10); c.fill();
  } else {
    c.fillStyle = p.hair; c.beginPath(); c.arc(hx, hy - 2, 7.8, Math.PI * 0.95, Math.PI * 2.05); c.fill();
    c.beginPath(); c.arc(hx - 5, hy - 9, 4.6, 0, 6.283); c.fill(); // topknot
    const wave = Math.sin(G.t * 8 + x * 0.01) * 2 + (run ? 3 : 0);
    c.beginPath(); c.moveTo(hx - 6, hy - 4); c.quadraticCurveTo(hx - 14, hy + 2 + wave, hx - 18 - (run ? 4 : 0), hy + 8 + wave); c.lineTo(hx - 7, hy + 2); c.fill();
    c.fillStyle = p.band; c.fillRect(hx - 8, hy - 5, 15, 2.2);
  }

  // front arm + weapon
  if (weapon === 'bow') {
    const ex = shX + 1 + dx * 12, ey = shY + 2 + dy * 12, hx3 = shX + 1 + dx * 24, hy3 = shY + 2 + dy * 24;
    // bow
    const px = -dy, py = dx, R = 22;
    const pull = o.drawn ? 4 : 10;
    c.lineCap = 'round';
    c.strokeStyle = '#2a1408'; c.lineWidth = 4.5; c.beginPath();
    c.moveTo(hx3 + px * R - dx * 6, hy3 + py * R - dy * 6); c.quadraticCurveTo(hx3 + dx * 9, hy3 + dy * 9, hx3 - px * R - dx * 6, hy3 - py * R - dy * 6); c.stroke();
    c.strokeStyle = '#b07a3a'; c.lineWidth = 2.2; c.stroke();
    c.strokeStyle = 'rgba(255,240,210,.7)'; c.lineWidth = 1; c.beginPath();
    c.moveTo(hx3 + px * R - dx * 6, hy3 + py * R - dy * 6); c.lineTo(shX + dx * pull, shY + 2 + dy * pull); c.lineTo(hx3 - px * R - dx * 6, hy3 - py * R - dy * 6); c.stroke();
    if (!o.drawn) { seg(c, shX + dx * pull, shY + 2 + dy * pull, hx3 + dx * 12, hy3 + dy * 12, 1.6, '#e8d6b0'); }
    limb(c, [shX + 1, shY + 2, ex, ey, hx3, hy3], 6.5, p);
    c.fillStyle = p.gold; c.beginPath(); c.arc(ex - dx * 4, ey - dy * 4, 2.4, 0, 6.283); c.fill();
  } else {
    const swing = o.attack ? Math.sin(o.attack * Math.PI) * 2.2 - 1 : (run ? Math.sin(ph) * 0.6 : -0.3);
    const a = -0.9 + swing;
    const [ex, ey] = rotp(12, a + 0.5), [h2x, h2y] = rotp(12, a);
    const hx4 = shX + 1 + ex + h2x, hy4 = shY + 2 + ey + h2y;
    limb(c, [shX + 1, shY + 2, shX + 1 + ex, shY + 2 + ey, hx4, hy4], 6.5, p);
    c.save(); c.translate(hx4, hy4); c.rotate(-a + Math.PI);
    if (weapon === 'spear') { seg(c, 0, 18, 0, -40, 2.5, '#5a3a1e'); c.fillStyle = '#c9ccd2'; c.beginPath(); c.moveTo(0, -52); c.lineTo(4, -40); c.lineTo(-4, -40); c.fill(); }
    else if (weapon === 'axe') {
      seg(c, 0, 8, 0, -34, 3.5, '#4a2c16');
      c.fillStyle = '#9aa0aa'; c.beginPath(); c.moveTo(0, -34); c.quadraticCurveTo(18, -40, 16, -22); c.lineTo(0, -26); c.fill();
      c.strokeStyle = '#e8eef5'; c.lineWidth = 1; c.beginPath(); c.moveTo(17, -36); c.quadraticCurveTo(19, -30, 16, -22); c.stroke();
    } else if (weapon === 'fsword') {
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) { c.fillStyle = ['#ff5a14', '#ff9a2a', '#ffe08a'][i]; c.globalAlpha = 0.35; c.fillRect(-3 + i, -48 + Math.random() * 3, 6 - i * 2, 46); }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      seg(c, 0, 0, 0, -46, 3, '#ffe9c0');
    } else {
      seg(c, 0, 0, 0, -34, 3.5, '#aab0b8'); seg(c, 0.8, -2, 0.8, -32, 1, '#f2f6fa');
      seg(c, -5, 0, 5, 0, 3, p.gold);
    }
    c.restore();
  }
  c.restore();
}

/* ===== Garuda wings (flight power) ===== */
function drawWings(c, x, y, t, face, left) {
  const flap = Math.sin(t * 16) * 0.5, fade = left < 2 && Math.floor(t * 10) % 2 ? 0.35 : 1;
  c.save(); c.translate(x - face * 4, y - 56); c.globalAlpha = fade;
  const g = c.createRadialGradient(0, 0, 4, 0, 0, 70); g.addColorStop(0, 'rgba(255,240,190,.45)'); g.addColorStop(1, 'rgba(160,220,255,0)');
  c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(-70, -70, 140, 140); c.globalCompositeOperation = 'source-over';
  for (const side of [-1, 1]) {
    c.save(); c.scale(side * -face, 1); c.rotate(-0.5 + flap * side * 0.3 + (side < 0 ? 0.1 : 0));
    for (let i = 0; i < 6; i++) {
      const a = -0.2 - i * 0.22, L = 52 - i * 4;
      c.fillStyle = i % 2 ? '#e8b33a' : '#fff2c8';
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(a) * L * 0.6, Math.sin(a) * L * 0.6 - 10, Math.cos(a) * L, Math.sin(a) * L);
      c.quadraticCurveTo(Math.cos(a) * L * 0.5 + 6, Math.sin(a) * L * 0.5 + 4, 0, 4); c.fill();
    }
    c.restore();
  }
  c.restore();
}

/* ===== Flames ===== */
function drawFlame(c, x, y, sz, t, seed = 0) {
  if (!(sz > 1)) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  const cols = ['rgba(255,70,10,.55)', 'rgba(255,140,30,.6)', 'rgba(255,220,120,.7)'];
  for (let i = 0; i < 3; i++) {
    const k = 1 - i * 0.28, fl = Math.sin(t * 11 + seed + i) * 0.12 + Math.sin(t * 17 + seed * 2) * 0.08;
    const h = sz * k * (1 + fl), w = sz * 0.42 * k;
    c.fillStyle = cols[i]; c.beginPath();
    c.moveTo(x - w, y); c.quadraticCurveTo(x - w * 1.1, y - h * 0.5, x + Math.sin(t * 6 + seed) * w * 0.5, y - h);
    c.quadraticCurveTo(x + w * 1.1, y - h * 0.5, x + w, y); c.closePath(); c.fill();
  }
  const g = c.createRadialGradient(x, y - sz * 0.4, 0, x, y - sz * 0.4, sz * 1.6);
  g.addColorStop(0, 'rgba(255,120,30,.25)'); g.addColorStop(1, 'rgba(255,60,0,0)');
  c.fillStyle = g; c.fillRect(x - sz * 1.6, y - sz * 2, sz * 3.2, sz * 3.2);
  c.restore();
}

/* ===== Backgrounds ===== */
const THEMES = [
  { key: 'forest', sky: ['#12060f', '#4a1418', '#b8401a', '#f39a3c'], sun: [700, 300, 70, '#ffd27a'], far: '#3a1424', mid: '#1c0a0e', near: '#0f0506', soil: ['#2a120a', '#120604'], top: '#4a2a12', fire: true },
  { key: 'sea', sky: ['#0a1228', '#2a2f5a', '#a8483a', '#f0a050'], sun: [520, 330, 90, '#ffd890'], far: '#2a2240', mid: '#141020', near: '#0a0810', soil: ['#5a4028', '#1e140c'], top: '#b8925a', sea: true },
  { key: 'fort', sky: ['#0a0506', '#2e0b0a', '#7a1e10', '#d0501a'], sun: [260, 250, 55, '#ff9a50'], far: '#2a0e0e', mid: '#160808', near: '#0c0404', soil: ['#3a2216', '#140a06'], top: '#6a4a30', fire: true, fort: true },
  { key: 'war', sky: ['#060508', '#1e1416', '#5a1e12', '#a8401a'], sun: [480, 290, 110, '#ff7a3a'], far: '#20141a', mid: '#120a0c', near: '#080506', soil: ['#2e1c12', '#0e0806'], top: '#4a3020', war: true }
];

function ridge(x, seed, amp, freq) {
  return Math.sin(x * freq + seed) * amp * 0.55 + Math.sin(x * freq * 2.31 + seed * 1.7) * amp * 0.3 + Math.sin(x * freq * 5.13 + seed * 0.3) * amp * 0.15;
}
function drawRange(c, cam, par, base, amp, freq, seed, col) {
  c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W + 8; x += 8) c.lineTo(x, base - ridge(x + cam * par, seed, amp, freq));
  c.lineTo(W, H); c.closePath(); c.fill();
}
function palm(c, x, y, h, col, t, k) {
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 5 * k; c.lineCap = 'round';
  const bend = 18 * k, tx = x + bend, ty = y - h;
  c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 6 * k, y - h * 0.6, tx, ty); c.stroke();
  const sway = Math.sin(t * 1.3 + x * 0.01) * 0.08;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.55 + sway, L = 46 * k;
    c.lineWidth = 3.4 * k; c.beginPath(); c.moveTo(tx, ty);
    c.quadraticCurveTo(tx + Math.cos(a) * L * 0.6, ty + Math.sin(a) * L * 0.6 - 10 * k, tx + Math.cos(a) * L, ty + Math.sin(a) * L + 18 * k); c.stroke();
  }
}
function hut(c, x, y, k, col) {
  c.fillStyle = col; c.fillRect(x - 26 * k, y - 34 * k, 52 * k, 34 * k);
  c.beginPath(); c.moveTo(x - 40 * k, y - 30 * k); c.lineTo(x, y - 78 * k); c.lineTo(x + 40 * k, y - 30 * k); c.fill();
}
function tower(c, x, y, k, col) {
  c.fillStyle = col; c.fillRect(x - 22 * k, y - 170 * k, 44 * k, 170 * k);
  c.fillRect(x - 32 * k, y - 190 * k, 64 * k, 22 * k);
  for (let i = 0; i < 4; i++) c.fillRect(x - 32 * k + i * 18 * k, y - 204 * k, 10 * k, 14 * k);
}
const EMBERS = Array.from({ length: 70 }, () => ({ x: rand(0, W), y: rand(0, H), v: rand(20, 70), s: rand(0.8, 2.6), p: rand(0, 6) }));

function drawBackground(c, th, cam, t, dt = 0.016) {
  const g = c.createLinearGradient(0, 0, 0, H * 0.78);
  th.sky.forEach((col, i) => g.addColorStop(i / (th.sky.length - 1), col));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // sun + glow
  const [sx0, sy, sr, scol] = th.sun, sx = sx0 - cam * 0.02;
  const sg = c.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 5);
  sg.addColorStop(0, 'rgba(255,200,120,.55)'); sg.addColorStop(0.3, 'rgba(255,120,40,.18)'); sg.addColorStop(1, 'rgba(255,80,20,0)');
  c.fillStyle = sg; c.fillRect(0, 0, W, H);
  c.fillStyle = scol; c.beginPath(); c.arc(sx, sy, sr, 0, 6.283); c.fill();
  // haze bands across the sun
  c.fillStyle = 'rgba(40,10,10,.35)';
  for (let i = 0; i < 4; i++) c.fillRect(0, sy - sr * 0.4 + i * sr * 0.32 + Math.sin(t * 0.3 + i) * 3, W, 3 + i);
  drawRange(c, cam, 0.08, 330, 70, 0.004, 1.3, th.far);
  if (th.sea) {
    const sea = c.createLinearGradient(0, 340, 0, H);
    sea.addColorStop(0, '#5a3a4a'); sea.addColorStop(0.2, '#2a2440'); sea.addColorStop(1, '#0a0a18');
    c.fillStyle = sea; c.fillRect(0, 340, W, H - 340);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const yy = 345 + i * 6 + i * i * 0.3, ww = (60 - i) * 2 + Math.sin(t * 2 + i) * 20;
      c.fillStyle = `rgba(255,170,90,${0.25 - i * 0.008})`; c.fillRect(sx - ww / 2 + Math.sin(t + i * 1.7) * 8, yy, ww, 2);
    }
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 4; i++) { // distant ships
      const bx = ((i * 420 - cam * 0.12 + t * 6) % 1700 + 1700) % 1700 - 200, by = 352 + i * 4;
      c.fillStyle = '#120c18'; c.beginPath(); c.moveTo(bx - 40, by); c.lineTo(bx + 40, by); c.lineTo(bx + 30, by + 8); c.lineTo(bx - 32, by + 8); c.fill();
      c.fillRect(bx - 1, by - 50, 2, 50); c.beginPath(); c.moveTo(bx + 2, by - 48); c.quadraticCurveTo(bx + 30, by - 30, bx + 2, by - 8); c.fill();
    }
  } else {
    drawRange(c, cam, 0.2, 380, 50, 0.007, 4.1, th.mid);
  }
  // mid layer silhouettes
  const par = 0.35, sp = 150, off = cam * par;
  for (let i = Math.floor(off / sp) - 1; i < Math.floor((off + W) / sp) + 2; i++) {
    const x = i * sp - off + hash(i) * 60, r = hash(i + 7);
    const base = th.sea ? 420 : 400;
    if (th.fort) {
      if (r < 0.35) tower(c, x, base + 10, 0.9 + hash(i + 3) * 0.4, th.mid);
      else { c.fillStyle = th.mid; c.fillRect(x - 80, base - 90, 160, 100); for (let k = 0; k < 8; k++) c.fillRect(x - 80 + k * 20, base - 104, 12, 14); }
      if (r > 0.7) drawFlame(c, x, base - 104, 30 + hash(i) * 20, t, i);
    } else if (th.war) {
      if (r < 0.5) { // smoke column
        c.fillStyle = 'rgba(20,12,12,.2)';
        for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(x + Math.sin(t * 0.5 + k + i) * 10 + k * 8, base - k * 45 - (t * 20 % 45), 22 + k * 8, 0, 6.283); c.fill(); }
        drawFlame(c, x, base, 26, t, i);
      } else { // banners & spear forest
        c.fillStyle = th.mid; for (let k = 0; k < 12; k++) { c.fillRect(x - 60 + k * 10, base - 70 - hash(i * k) * 20, 2, 80); }
        c.fillRect(x - 70, base - 20, 140, 30);
        c.fillStyle = '#5a1010'; c.beginPath(); c.moveTo(x, base - 120); c.lineTo(x + 30 + Math.sin(t * 3 + i) * 4, base - 110); c.lineTo(x, base - 98); c.fill();
        c.fillStyle = th.mid; c.fillRect(x - 1, base - 122, 3, 130);
      }
    } else {
      if (r < 0.55) palm(c, x, base + 20, 130 + hash(i + 2) * 90, th.mid, t, 1);
      else { hut(c, x, base + 20, 1, th.mid); if (th.fire && r > 0.75) drawFlame(c, x, base - 40, 40, t, i); }
    }
  }
  // near layer
  const par2 = 0.65, sp2 = 260, off2 = cam * par2;
  for (let i = Math.floor(off2 / sp2) - 1; i < Math.floor((off2 + W) / sp2) + 2; i++) {
    const x = i * sp2 - off2 + hash(i + 31) * 120;
    if (th.sea) { c.fillStyle = th.near; c.beginPath(); c.ellipse(x, 470, 90, 30 + hash(i) * 20, 0, Math.PI, 0); c.fill(); continue; }
    if (hash(i + 5) < 0.5) palm(c, x, 480, 210 + hash(i) * 80, th.near, t, 1.5);
    else { c.fillStyle = th.near; c.beginPath(); c.ellipse(x, 470, 120, 60 + hash(i) * 30, 0, Math.PI, 0); c.fill(); }
  }
  // atmospheric depth fog
  const fog = c.createLinearGradient(0, 300, 0, H);
  fog.addColorStop(0, 'rgba(255,110,40,0)'); fog.addColorStop(1, th.sea ? 'rgba(40,30,70,.35)' : 'rgba(120,30,10,.28)');
  c.fillStyle = fog; c.fillRect(0, 300, W, H - 300);
}

function drawEmbers(c, dt, t, amount = 1) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < EMBERS.length * amount; i++) {
    const e = EMBERS[i];
    e.y -= e.v * dt; e.x += Math.sin(t * 1.5 + e.p) * 20 * dt - 10 * dt;
    if (e.y < -10) { e.y = H + 10; e.x = rand(0, W); }
    if (e.x < -10) e.x = W + 10;
    const fl = 0.5 + 0.5 * Math.sin(t * 6 + e.p);
    c.fillStyle = `rgba(255,${120 + fl * 100 | 0},40,${0.4 + fl * 0.5})`;
    c.beginPath(); c.arc(e.x, e.y, e.s, 0, 6.283); c.fill();
  }
  c.restore();
}

/* ===== World layer (ground, ledges, foreground) ===== */
function drawWorld(c, L, th, cam, t) {
  // abyss / water under pits
  if (th.sea) {
    c.fillStyle = '#0c1024'; c.fillRect(cam, GROUND_Y - 4, W, H);
    c.fillStyle = 'rgba(255,160,90,.25)';
    for (let i = 0; i < 12; i++) c.fillRect(cam + ((i * 97 + t * 30) % W), GROUND_Y + 10 + (i % 4) * 14, 40, 2);
  }
  for (const s of L.ground) {
    if (s.x + s.w < cam - 20 || s.x > cam + W + 20) continue;
    const g = c.createLinearGradient(0, GROUND_Y, 0, H);
    g.addColorStop(0, th.soil[0]); g.addColorStop(1, th.soil[1]);
    c.fillStyle = g; c.fillRect(s.x, GROUND_Y, s.w, H - GROUND_Y);
    c.fillStyle = th.top; c.fillRect(s.x, GROUND_Y, s.w, 5);
    c.fillStyle = 'rgba(255,170,90,.35)'; c.fillRect(s.x, GROUND_Y, s.w, 1.5);
    // stones / laterite blocks
    const x0 = Math.max(s.x, cam - 40), x1 = Math.min(s.x + s.w, cam + W + 40);
    for (let x = Math.floor(x0 / 46) * 46; x < x1; x += 46) {
      if (x < s.x || x > s.x + s.w - 20) continue;
      const h1 = hash(x * 0.37);
      c.fillStyle = `rgba(0,0,0,${0.15 + h1 * 0.2})`;
      c.fillRect(x + h1 * 10, GROUND_Y + 14 + h1 * 26, 20 + h1 * 16, 6 + h1 * 6);
      if (h1 > 0.6) { c.fillStyle = th.top; c.fillRect(x + 8, GROUND_Y - 4 - h1 * 4, 3, 6 + h1 * 4); }
    }
    // pit edge shading
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(s.x, GROUND_Y, 6, H); c.fillRect(s.x + s.w - 6, GROUND_Y, 6, H);
  }
  for (const p of L.plats) {
    if (p.x + p.w < cam - 20 || p.x > cam + W + 20) continue;
    if (th.fort || th.war) { // timber scaffold
      c.fillStyle = '#1a0c06'; c.fillRect(p.x + 10, p.y, 8, GROUND_Y - p.y); c.fillRect(p.x + p.w - 18, p.y, 8, GROUND_Y - p.y);
      c.fillStyle = '#4a2a14'; c.fillRect(p.x, p.y, p.w, 12);
      c.fillStyle = '#7a4a24'; c.fillRect(p.x, p.y, p.w, 3);
      for (let x = p.x; x < p.x + p.w; x += 22) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x, p.y + 3, 2, 9); }
    } else { // carved stone slab
      c.fillStyle = '#1e120c'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + p.w, p.y); c.lineTo(p.x + p.w - 10, p.y + 22); c.lineTo(p.x + 10, p.y + 26); c.fill();
      c.fillStyle = th.top; c.fillRect(p.x, p.y, p.w, 5);
      c.fillStyle = 'rgba(255,170,90,.4)'; c.fillRect(p.x, p.y, p.w, 1.5);
      c.fillStyle = 'rgba(0,0,0,.4)'; for (let x = p.x + 18; x < p.x + p.w - 10; x += 38) c.fillRect(x, p.y + 6, 2, 14);
    }
  }
}
function drawForeground(c, th, cam, t) {
  const par = 1.35, sp = 520, off = cam * par;
  for (let i = Math.floor(off / sp) - 1; i < Math.floor((off + W) / sp) + 2; i++) {
    if (hash(i + 99) < 0.45) continue;
    const x = i * sp - off + hash(i) * 200;
    c.fillStyle = '#050202';
    c.beginPath(); c.moveTo(x - 90, H);
    for (let k = 0; k <= 12; k++) { const bx = x - 90 + k * 15; c.lineTo(bx, H - 40 - hash(i * 13 + k) * 70 - Math.sin(t * 2 + k) * 4); c.lineTo(bx + 7, H - 10); }
    c.lineTo(x + 100, H); c.fill();
  }
}
function drawGrade(c) {
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
}

/* ===== Projectile art ===== */
function drawShot(c, s) {
  const a = Math.atan2(s.vy, s.vx);
  c.save(); c.translate(s.x, s.y); c.rotate(a);
  if (s.kind === 'arrow') {
    seg(c, -22, 0, 6, 0, 2, '#d8c49a'); c.fillStyle = '#c9ccd2'; c.beginPath(); c.moveTo(12, 0); c.lineTo(4, -4); c.lineTo(4, 4); c.fill();
    c.fillStyle = '#a3221a'; c.fillRect(-24, -3, 6, 2); c.fillRect(-24, 1, 6, 2);
  } else if (s.kind === 'fire') {
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(4, 0, 0, 4, 0, 18); g.addColorStop(0, 'rgba(255,230,140,1)'); g.addColorStop(0.4, 'rgba(255,120,30,.8)'); g.addColorStop(1, 'rgba(255,40,0,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(-4, 0, 24, 8, 0, 0, 6.283); c.fill();
    if (Math.random() < 0.5) part({ x: s.x, y: s.y, vx: rand(-30, 30), vy: rand(-60, -10), life: 0.3, max: 0.3, size: 3, color: '#ff9a2a', add: true, g: -50 });
  } else if (s.kind === 'vel') {
    seg(c, -40, 0, 14, 0, 3.5, '#6a4220');
    c.fillStyle = '#ffe08a'; c.beginPath(); c.moveTo(30, 0); c.quadraticCurveTo(16, -9, 8, -2); c.lineTo(8, 2); c.quadraticCurveTo(16, 9, 30, 0); c.fill();
    c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,220,120,.35)'; c.beginPath(); c.ellipse(14, 0, 22, 10, 0, 0, 6.283); c.fill();
  } else if (s.kind === 'chakra') {
    c.rotate(G.t * 30); c.strokeStyle = '#9fe3ff'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, 7, 0, 6.283); c.stroke();
    c.fillStyle = '#e8fbff'; for (let i = 0; i < 6; i++) { c.rotate(1.047); c.fillRect(6, -1.5, 5, 3); }
  }
  c.restore(); c.globalCompositeOperation = 'source-over';
}
function drawEShot(c, s) {
  c.save(); c.translate(s.x, s.y);
  if (s.kind === 'arrow' || s.kind === 'spear' || s.kind === 'javelin') {
    c.rotate(Math.atan2(s.vy, s.vx));
    const L = s.kind === 'arrow' ? 20 : 44;
    seg(c, -L, 0, 6, 0, s.kind === 'arrow' ? 2 : 3, '#3a2412'); c.fillStyle = '#d0d4da'; c.beginPath(); c.moveTo(14, 0); c.lineTo(4, -4); c.lineTo(4, 4); c.fill();
    if (s.burning) drawFlame(c, -L, 0, 10, G.t, 1);
  } else if (s.kind === 'axe') {
    c.rotate(G.t * 14); seg(c, -14, 0, 14, 0, 3.5, '#4a2c16');
    c.fillStyle = '#b0b6c0'; c.beginPath(); c.moveTo(10, -2); c.quadraticCurveTo(22, -14, 18, 10); c.lineTo(10, 4); c.fill();
  } else if (s.kind === 'pot' || s.kind === 'fireball') {
    drawFlame(c, 0, 6, s.kind === 'pot' ? 24 : 18, G.t, s.x);
    c.fillStyle = s.kind === 'pot' ? '#5a2a14' : '#ffcf6a'; c.beginPath(); c.arc(0, 0, s.kind === 'pot' ? 9 : 7, 0, 6.283); c.fill();
  } else if (s.kind === 'wave' || s.kind === 'slash') {
    c.globalCompositeOperation = 'lighter';
    const h = s.kind === 'wave' ? 26 : 70;
    const g = c.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, 'rgba(255,90,20,0)'); g.addColorStop(1, 'rgba(255,190,90,.9)');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, -h / 2, s.kind === 'wave' ? 16 : 12, h / 2, 0, 0, 6.283); c.fill();
  } else if (s.kind === 'flame') {
    drawFlame(c, 0, 0, 34, G.t, s.x);
  }
  c.restore();
}
