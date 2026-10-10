'use strict';
/* ===== Cinematic painters ===== */
const SIL = { skin: '#0a0505', rim: '#ff9a4a', cloth: '#0a0505', clothHi: '#140808', gold: '#3a2010', hair: '#050202', band: '#2a1408', out: '#050202' };
const TA = "'Arima Madurai','Hind Madurai',serif", BODY = "'Hind Madurai',sans-serif", EN = "'Cinzel',serif";

function drawWoman(c, x, y, o = {}) {
  const s = o.scale || 1, f = o.face || 1, p = o.pal || { skin: '#7a4423', saree: '#c23a1a', saree2: '#e8b33a', hair: '#120806' };
  c.save(); c.translate(x, y); c.scale(s * f, s);
  const wv = Math.sin(G.t * 3 + x) * 3, ph = o.phase || 0;
  c.fillStyle = p.saree; c.beginPath(); c.moveTo(-8, -38); c.lineTo(8, -38); c.lineTo(13 + Math.sin(ph) * 2, 0); c.lineTo(-13 + Math.sin(ph) * 2, 0); c.fill();
  c.fillStyle = p.saree2; c.fillRect(-13, -4, 26, 3);
  c.fillStyle = p.skin; c.beginPath(); c.moveTo(-7, -38); c.lineTo(7, -38); c.lineTo(8, -58); c.lineTo(-7, -58); c.fill();
  c.fillStyle = p.saree; c.beginPath(); c.moveTo(6, -58); c.lineTo(-6, -38); c.lineTo(-24 - wv, -30); c.lineTo(-10, -58); c.fill(); // pallu
  c.strokeStyle = p.skin; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(4, -56); c.lineTo(9, -44); c.lineTo(o.reach ? 18 : 8, o.reach ? -50 : -34); c.stroke();
  c.fillStyle = p.skin; c.beginPath(); c.arc(2, -66, 7, 0, 6.283); c.fill();
  c.fillStyle = p.hair; c.beginPath(); c.arc(1, -68, 7, Math.PI * 0.9, Math.PI * 2.1); c.fill();
  c.beginPath(); c.arc(-5, -64, 4.5, 0, 6.283); c.fill();
  c.strokeStyle = p.hair; c.lineWidth = 3.5; c.beginPath(); c.moveTo(-6, -62); c.quadraticCurveTo(-10 - wv, -48, -8 - wv, -36); c.stroke();
  c.fillStyle = '#fff6e0'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-8 + i * 0.5, -66 + i * 2.5, 1.5, 0, 6.283); c.fill(); }
  c.restore();
}
function sky(c, cols, y1 = H) { const g = c.createLinearGradient(0, 0, 0, y1); cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col)); c.fillStyle = g; c.fillRect(0, 0, W, H); }
function sunGlow(c, x, y, r, col, a = 0.5) {
  const g = c.createRadialGradient(x, y, r * 0.2, x, y, r * 5); g.addColorStop(0, `rgba(255,190,110,${a})`); g.addColorStop(1, 'rgba(255,80,20,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H); c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
}

function paintStorm(c, t) {
  sky(c, ['#04050c', '#0c1020', '#1a1424']);
  const bolt = (t % 3.3) < 0.14 || (t % 3.3 > 0.22 && t % 3.3 < 0.3);
  if (bolt) { c.fillStyle = 'rgba(200,210,255,.55)'; c.fillRect(0, 0, W, H); c.strokeStyle = '#eef'; c.lineWidth = 3; c.beginPath(); let bx = 620 + Math.sin(Math.floor(t / 3.3)) * 200, by = 0; c.moveTo(bx, by); while (by < 300) { bx += rand(-30, 30); by += rand(20, 40); c.lineTo(bx, by); } c.stroke(); }
  drawRange(c, 0, 0, 360, 60, 0.006, 2, '#08060c');
  c.fillStyle = '#0c1424'; c.fillRect(0, 410, W, H);
  c.fillStyle = 'rgba(120,140,200,.15)'; for (let i = 0; i < 20; i++) c.fillRect((i * 83 + t * 40) % W, 420 + (i % 6) * 18, 50, 2);
  // hill with hut
  c.fillStyle = '#050407'; c.beginPath(); c.moveTo(80, H); c.quadraticCurveTo(300, 330, 560, 410); c.lineTo(560, H); c.fill();
  hut(c, 210, 392, 1.3, '#050407');
  const fl = 0.7 + Math.sin(t * 9) * 0.15 + Math.sin(t * 23) * 0.1;
  c.fillStyle = `rgba(255,140,50,${fl})`; c.fillRect(200, 360, 20, 30);
  drawFlame(c, 210, 392, 12, t, 2);
  // mother raising the newborn to the sky
  if (t > 7.5) {
    const k = Math.min(1, (t - 7.5) / 1.5);
    c.save(); c.translate(380, 372); c.fillStyle = '#050407';
    c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.lineTo(7, -40); c.lineTo(-7, -40); c.fill();
    c.beginPath(); c.arc(0, -48, 7, 0, 6.283); c.fill();
    c.strokeStyle = '#050407'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-5, -40); c.lineTo(-6, -40 - 30 * k); c.moveTo(5, -40); c.lineTo(6, -40 - 30 * k); c.stroke();
    c.beginPath(); c.ellipse(0, -74 * k - 40 * (1 - k), 9, 5, 0, 0, 6.283); c.fill();
    if (bolt) { c.strokeStyle = 'rgba(255,220,180,.8)'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, -48, 8, 3.6, 5.6); c.stroke(); }
    c.restore();
  }
  c.strokeStyle = 'rgba(160,180,230,.35)'; c.lineWidth = 1;
  for (let i = 0; i < 140; i++) { const x = (i * 53.7 + t * 300) % (W + 100) - 50, y = (i * 97.3 + t * 900) % H; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 6, y + 18); c.stroke(); }
}

function paintRiver(c, t) {
  const k = clamp((t - 8.5) / 2, 0, 1);
  sky(c, [k ? '#1a0406' : '#1a0e2a', k ? '#5a0e0a' : '#6a2a3a', k ? '#c0300e' : '#e0803a', k ? '#ff7a2a' : '#ffc070'], 380);
  sunGlow(c, 480, 330, 70, k ? '#ff9a50' : '#ffe0a0', 0.5);
  drawRange(c, 0, 0, 345, 40, 0.008, 5, '#2a0e14');
  for (let i = 0; i < 7; i++) { const x = 40 + i * 150; if (k > 0) drawFlame(c, x, 345, 40 * k + Math.sin(i) * 8, t, i); hut(c, x, 350, 0.7, '#14060a'); }
  c.fillStyle = '#1a1020'; c.fillRect(0, 380, W, H);
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 22; i++) { c.fillStyle = `rgba(255,${k ? 90 : 170},70,${0.3 - i * 0.012})`; const ww = 120 - i * 4 + Math.sin(t * 2 + i) * 14; c.fillRect(480 - ww / 2 + Math.sin(t + i) * 6, 384 + i * 7, ww, 2); }
  c.globalCompositeOperation = 'source-over';
  palm(c, 120, 470, 230, '#0a0406', t, 1.6); palm(c, 860, 480, 260, '#0a0406', t, 1.7);
  c.fillStyle = '#0a0406'; c.beginPath(); c.ellipse(560, 430, 130, 30, 0, Math.PI, 0); c.fill();
  if (t < 10) {
    drawWarrior(c, 520, 404, { face: 1, state: 'idle', pal: SIL, weapon: 'spear', scale: 1.4 });
    drawWoman(c, 590, 404, { face: -1, pal: { skin: '#0a0505', saree: '#0a0505', saree2: '#2a1408', hair: '#050202' }, scale: 1.4 });
  } else {
    // raiders dragging her away, hero running after
    const rx = 560 + (t - 10) * 70;
    drawWoman(c, rx + 30, 404, { face: -1, pal: { skin: '#0a0505', saree: '#0a0505', saree2: '#2a1408', hair: '#050202' }, scale: 1.4, reach: true, phase: t * 8 });
    for (let i = 0; i < 3; i++) drawWarrior(c, rx + 70 + i * 40, 404, { face: 1, state: 'run', phase: t * 12 + i, pal: SIL, weapon: 'sword', scale: 1.4 });
    drawWarrior(c, 300 + (t - 10) * 40, 404, { face: 1, state: 'run', phase: t * 12, pal: SIL, weapon: 'spear', scale: 1.4 });
  }
  drawEmbers(c, 0.016, t, k);
}

function paintTheme(i) {
  return (c, t) => { drawBackground(c, THEMES[i], t * 40, t); drawEmbers(c, 0.016, t, 0.6); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 0, W, H); };
}
function paintChapter(i) {
  const names = [['கானகம்', 'The Burning Forest'], ['கடல்', 'The Corsair Sea'], ['கார்மலைக் கோட்டை', 'The Fortress of Kaarmalai'], ['பெரும்போர்', 'The Great War']];
  const nums = ['ஒன்று', 'இரண்டு', 'மூன்று', 'நான்கு'], rom = ['I', 'II', 'III', 'IV'];
  return (c, t) => {
    drawBackground(c, THEMES[i], t * 25, t); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, W, H); drawEmbers(c, 0.016, t, 1);
    const a = clamp(t / 0.8, 0, 1) * clamp((4.5 - t) / 0.6, 0, 1);
    c.globalAlpha = a; c.textAlign = 'center';
    c.fillStyle = '#e8b33a'; c.font = `600 16px ${EN}`; c.fillText(`CHAPTER ${rom[i]}`, W / 2, 200);
    c.font = `700 22px ${TA}`; c.fillStyle = '#d9c7a8'; c.fillText(`அத்தியாயம் ${nums[i]}`, W / 2, 232);
    const sc = 1 + (1 - clamp(t / 1.2, 0, 1)) * 0.15;
    c.save(); c.translate(W / 2, 312); c.scale(sc, sc);
    c.font = `900 76px ${TA}`; c.shadowColor = 'rgba(255,90,20,.8)'; c.shadowBlur = 30; c.fillStyle = '#ffe2b0'; c.fillText(names[i][0], 0, 0);
    c.restore();
    c.font = `600 20px ${EN}`; c.fillStyle = '#ffb066'; c.fillText(names[i][1].toUpperCase(), W / 2, 356);
    c.fillStyle = '#e8b33a'; c.fillRect(W / 2 - 80 * a, 378, 160 * a, 2);
    c.globalAlpha = 1; c.shadowBlur = 0;
  };
}
function paintReunion(c, t) {
  drawBackground(c, THEMES[2], 300, t); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#120806'; c.fillRect(0, 440, W, H);
  const meet = clamp(t / 4, 0, 1), hx = lerp(260, 455, meet), wx = lerp(700, 492, meet);
  if (t > 4.2 && t < 4.6) burst(W / 2, 380, 3, { colors: ['#9aa0aa', '#e8eef5'], g: 900, min: 100, max: 300, shape: 'shard', lmax: 1 });
  drawWarrior(c, hx, 440, { face: 1, state: meet < 1 ? 'run' : 'idle', phase: t * 12, pal: PAL.hero, weapon: 'sword', scale: 2.2, hero: true });
  drawWoman(c, wx, 440, { face: -1, scale: 2.2, reach: meet >= 1, phase: t * 8 });
  drawEmbers(c, 0.016, t, 1);
}
function paintThrone(c, t) {
  sky(c, ['#0a0408', '#3a0e0e', '#b8401a', '#ffb050'], 420);
  sunGlow(c, 480, 300, 100, '#ffcf80', 0.6);
  c.fillStyle = '#0a0406'; c.beginPath(); c.moveTo(300, H); c.lineTo(420, 330); c.lineTo(540, 330); c.lineTo(660, H); c.fill();
  for (let i = 0; i < 60; i++) { const x = (i * 16.3) % W, by = 470 + (i % 3) * 18; if (x > 280 && x < 680) continue; c.fillStyle = '#0a0406'; c.fillRect(x, by - 50 - Math.abs(Math.sin(t * 6 + i)) * 10, 2, 60); c.beginPath(); c.arc(x + 1, by - 10, 8, 0, 6.283); c.fill(); }
  c.fillStyle = '#0a0406'; c.fillRect(0, 480, W, H);
  drawWarrior(c, 470, 330, { face: 1, state: 'idle', pal: SIL, weapon: 'sword', attack: 0.9, scale: 2.4 });
  seg(c, 540, 330, 540, 190, 4, '#0a0406');
  const w = Math.sin(t * 3) * 10;
  c.fillStyle = '#8a1a10'; c.beginPath(); c.moveTo(542, 190); c.quadraticCurveTo(600, 196 + w, 640, 186 + w); c.lineTo(636, 250 + w); c.quadraticCurveTo(600, 246 + w, 542, 250); c.fill();
  c.strokeStyle = '#e8b33a'; c.lineWidth = 2.5; c.beginPath(); c.arc(590, 219 + w * 0.5, 13, 0, 6.283); c.stroke();
  drawEmbers(c, 0.016, t, 1);
}
function paintAging(c, t) {
  sky(c, ['#0a0608', '#2a1218', '#7a3420', '#d08040'], 400);
  sunGlow(c, 640, 330, 60, '#ffc080', 0.4);
  c.fillStyle = '#0c0608'; c.fillRect(0, 0, W, 80); c.fillRect(0, 0, 160, H); c.fillRect(800, 0, 160, H); c.fillRect(0, 430, W, H);
  for (let i = 0; i < 4; i++) { c.fillStyle = '#140a0a'; c.fillRect(170 + i * 200, 80, 26, 350); }
  const old = clamp(t / 8, 0, 1);
  const pal = Object.assign({}, SIL, { hair: `rgb(${lerp(5, 210, old) | 0},${lerp(2, 200, old) | 0},${lerp(2, 190, old) | 0})` });
  c.save(); c.translate(380, 430); c.rotate(old * 0.18); drawWarrior(c, 0, 0, { face: 1, state: 'idle', pal, weapon: 'spear', scale: 2.3 }); c.restore();
  c.fillStyle = '#e8b33a'; c.globalAlpha = 0.8; c.beginPath(); c.moveTo(560, 424); c.lineTo(566, 404); c.lineTo(576, 416); c.lineTo(586, 400); c.lineTo(596, 416); c.lineTo(606, 404); c.lineTo(612, 424); c.fill(); c.globalAlpha = 1;
  c.textAlign = 'right'; c.font = `700 30px ${TA}`; c.fillStyle = 'rgba(255,200,140,.25)'; c.fillText(`${(20 + old * 52) | 0} ஆண்டுகள்`, 780, 130);
}
function drawHandClose(c, cx, top, sway, t) {
  c.save(); c.translate(cx, top); c.rotate(sway);
  const sk = c.createLinearGradient(-50, 0, 50, 0); sk.addColorStop(0, '#2a1208'); sk.addColorStop(0.3, '#6a3418'); sk.addColorStop(0.75, '#8a4a22'); sk.addColorStop(1, '#ffb066');
  c.fillStyle = sk; c.beginPath(); c.moveTo(-40, -40); c.lineTo(40, -40); c.lineTo(34, 200); c.lineTo(-34, 200); c.fill();
  c.fillStyle = '#c9a23a'; c.fillRect(-38, 40, 76, 10); // arm band of the king
  c.beginPath(); c.moveTo(-36, 196); c.quadraticCurveTo(-56, 250, -40, 300); c.lineTo(42, 300); c.quadraticCurveTo(56, 250, 36, 196); c.fill();
  c.fillStyle = sk; c.beginPath(); c.moveTo(-38, 200); c.quadraticCurveTo(-56, 250, -42, 300); c.lineTo(44, 300); c.quadraticCurveTo(56, 250, 38, 200); c.fill();
  // open fingers pointing down, palm facing us
  const fx = [-33, -12, 9, 30], fl = [70, 86, 82, 64];
  fx.forEach((x, i) => {
    c.fillStyle = sk; c.beginPath(); c.roundRect ? c.roundRect(x - 9, 290, 19, fl[i], 9) : c.rect(x - 9, 290, 19, fl[i]); c.fill();
    c.strokeStyle = 'rgba(30,10,4,.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 6, 290 + fl[i] * 0.45); c.lineTo(x + 6, 290 + fl[i] * 0.45); c.moveTo(x - 6, 290 + fl[i] * 0.72); c.lineTo(x + 6, 290 + fl[i] * 0.72); c.stroke();
  });
  c.save(); c.translate(-44, 236); c.rotate(0.5); c.fillStyle = sk; c.beginPath(); c.roundRect ? c.roundRect(-10, 0, 22, 70, 10) : c.rect(-10, 0, 22, 70); c.fill(); c.restore();
  c.strokeStyle = 'rgba(30,10,4,.45)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-30, 230); c.quadraticCurveTo(0, 262, 34, 240); c.moveTo(-26, 262); c.quadraticCurveTo(4, 276, 30, 268); c.stroke();
  // shroud edge
  c.restore();
  c.fillStyle = '#e8dccc'; c.beginPath(); c.moveTo(cx - 140, top - 60); c.lineTo(cx + 160, top - 60); c.quadraticCurveTo(cx + 90, top + 20, cx + 30, top + 6); c.quadraticCurveTo(cx - 40, top + 30, cx - 140, top - 10); c.fill();
  c.fillStyle = '#f0a020'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(cx - 110 + i * 30, top - 30 + Math.sin(i * 2) * 10, 7, 0, 6.283); c.fill(); }
}
function paintFuneral(c, t) {
  if (t < 13.5) {
    sky(c, ['#0a0612', '#2a1030', '#8a2a2a', '#ff8a3a'], 420);
    sunGlow(c, 480, 420, 150, '#ffb060', 0.55);
    c.fillStyle = '#060304'; c.fillRect(0, 410, W, H);
    const px = -60 + t * 46, ph = t * 5;
    // mourners with torches behind
    for (let i = 0; i < 9; i++) { const mx = px - 160 - i * 46; drawWarrior(c, mx, 412, { face: 1, state: 'run', phase: ph * 0.6 + i, pal: SIL, weapon: 'spear', scale: 1.15 }); if (i % 2 === 0) drawFlame(c, mx + 22, 340, 14, t, i); }
    drawWoman(c, px - 120, 412, { face: 1, pal: { skin: '#0a0505', saree: '#e8dccc', saree2: '#bbb', hair: '#bbb' }, scale: 1.2, phase: ph });
    // bier with four bearers
    const by = 340;
    [-80, -40, 50, 90].forEach((o, i) => drawWarrior(c, px + o, 412, { face: 1, state: 'run', phase: ph * 0.6 + i * 1.7, pal: SIL, weapon: 'spear', scale: 1.15 }));
    c.fillStyle = '#1a0c06'; c.fillRect(px - 110, by, 230, 8);
    c.fillStyle = '#e8dccc'; c.beginPath(); c.moveTo(px - 90, by); c.quadraticCurveTo(px - 80, by - 24, px - 40, by - 20); c.quadraticCurveTo(px + 20, by - 28, px + 92, by - 12); c.lineTo(px + 96, by); c.fill();
    c.fillStyle = '#f0a020'; for (let i = 0; i < 10; i++) { c.beginPath(); c.arc(px - 70 + i * 16, by - 16 - Math.sin(i) * 4, 3.5, 0, 6.283); c.fill(); }
    // the two hands, open and empty, hanging outside the bier
    const sw = Math.sin(t * 2.5) * 0.12;
    [[px + 6, '#5a2a14'], [px - 6, '#2a1208']].forEach(([hx, col], i) => {
      c.save(); c.translate(hx, by + 4); c.rotate(sw * (i ? -1 : 1)); c.fillStyle = col; c.fillRect(-3, 0, 6, 30); c.beginPath(); c.ellipse(0, 36, 5, 8, 0, 0, 6.283); c.fill(); c.restore();
    });
    // parai drummer leading
    drawWarrior(c, px + 170, 412, { face: 1, state: 'run', phase: ph * 0.6, pal: SIL, weapon: 'sword', scale: 1.15 });
    c.fillStyle = '#0a0505'; c.beginPath(); c.arc(px + 186, 372, 14, 0, 6.283); c.fill();
    const beat = Math.floor(t / 1.1); if (beat !== G.beat) { G.beat = beat; AUDIO.sfx('parai'); }
    drawEmbers(c, 0.016, t, 1);
  } else {
    const k = t - 13.5;
    sky(c, ['#1a0610', '#6a1a1a', '#e0602a', '#ffc070']);
    sunGlow(c, 620, 260, 220, '#ffd090', 0.6);
    drawHandClose(c, 430, -30 + Math.sin(k * 0.8) * 4, Math.sin(k * 1.2) * 0.05, k);
    drawEmbers(c, 0.016, t, 1);
    if (t > 22) { c.fillStyle = `rgba(0,0,0,${clamp((t - 22) / 2.5, 0, 1)})`; c.fillRect(0, 0, W, H); }
    if (t > 24.5) { c.textAlign = 'center'; c.globalAlpha = clamp((t - 24.5) / 1.5, 0, 1); c.font = `900 64px ${TA}`; c.fillStyle = '#e8dccc'; c.fillText('முற்றும்', W / 2, H / 2 + 20); c.globalAlpha = 1; }
  }
}
function paintCredits(c, t) {
  c.fillStyle = '#050202'; c.fillRect(0, 0, W, H); drawEmbers(c, 0.016, t, 0.5);
  c.textAlign = 'center'; c.globalAlpha = clamp(t, 0, 1);
  c.font = `900 56px ${TA}`; c.fillStyle = '#ffe2b0'; c.shadowColor = 'rgba(255,90,20,.7)'; c.shadowBlur = 24; c.fillText('வீரமாறன்', W / 2, 200); c.shadowBlur = 0;
  c.font = `600 18px ${EN}`; c.fillStyle = '#ffb066'; c.fillText('VEERAMAARAN', W / 2, 236);
  c.font = `400 18px ${BODY}`; c.fillStyle = '#d9c7a8';
  c.fillText('வெறுங்கையுடன் வந்தோம் · வெறுங்கையுடன் போவோம்', W / 2, 300);
  c.fillText('We come empty-handed. We leave empty-handed.', W / 2, 328);
  c.fillStyle = '#8a7a66'; c.font = `400 14px ${BODY}`; c.fillText(`Score  ${G.players.map(p => p.score).join('  ·  ')}`, W / 2, 400);
  c.globalAlpha = 1;
}

/* ===== Scene definitions ===== */
const SCENES = {
  birth: { dur: 13, music: 'calm', paint: paintStorm, lines: [
    [0.3, 'கி.மு. 1600 · பொருநை ஆற்றங்கரை', '1600 BCE · The banks of the Porunai'],
    [3.8, 'இடி முழங்கிய ஓர் இரவில், ஆதிச்சநல்லூர் குடியில் ஒரு வீரன் பிறந்தான்.', 'On a night of thunder, a warrior was born to the clan of Adichanallur.'],
    [8.8, 'அவன் பெயர் — வீரமாறன்.', 'His name: Veeramaaran.']] },
  youth: { dur: 17, music: 'calm', paint: paintRiver, lines: [
    [0.3, 'இருபது கோடைகள் கழிந்தன. வில்லிலும் வேலிலும் அவனுக்கு நிகர் இல்லை.', 'Twenty summers passed. No one matched him with bow or spear.'],
    [4.6, 'அவன் உயிர் — இளவேனில்.', 'His heart belonged to Ilavenil.'],
    [8.8, 'ஒரு நாள் கார்மலைக் கொள்ளையர் ஊரைக் கொளுத்தினர். இளவேனிலைக் கவர்ந்து சென்றனர்.', 'Then raiders of Kaarmalai burned the village and carried Ilavenil away.'],
    [13.4, '"அவளைத் தேடி உலகின் கடைசி வரை போவேன்."', '"I will search for her to the end of the world."']] },
  after1: { dur: 8, music: null, paint: paintTheme(0), lines: [
    [0.3, 'சாகும் முன் கருநாகன் சொன்னான்: "அவள் கடல் கடந்து கார்மலைக்குப் போகிறாள்…"', 'Dying, Karunagan spoke: "She sails across the sea, to Kaarmalai…"']] },
  after2: { dur: 8, music: null, paint: paintTheme(1), lines: [
    [0.3, 'மரக்கலம் எரிந்து மூழ்கியது. கார்மலைக் கோட்டை கண்முன் எழுந்தது.', 'The war-ship burned and sank. The fortress of Kaarmalai rose ahead.']] },
  after3: { dur: 13, music: 'calm', paint: paintReunion, lines: [
    [0.3, 'சங்கிலிகள் உடைந்தன. இளவேனில் அவன் கைகளில்.', 'The chains broke. Ilavenil was in his arms.'],
    [6.5, 'அன்றே கார்மலை வீழ்ந்தது. வீரமாறன் அதன் மன்னன் ஆனான்.', 'That day Kaarmalai fell, and Veeramaaran became its king.']] },
  pre4: { dur: 7, music: null, paint: paintTheme(3), lines: [
    [0.3, 'பத்து ஆண்டுகள் கழித்து… வடக்கிலிருந்து இருள்மன்னனின் பெரும்படை வந்தது.', "Ten years later, Irulmannan's great host marched from the north."]] },
  victory: { dur: 11, music: 'calm', paint: paintThrone, lines: [
    [0.3, 'இரு நாடுகள் மோதின. வீரமாறன் வென்றான்.', 'Two nations clashed. Veeramaaran prevailed.'],
    [5.2, 'பொன், மண், புகழ் — அனைத்தும் அவன் காலடியில்.', 'Gold, land and glory lay at his feet.']] },
  aging: { dur: 14, music: 'funeral', paint: paintAging, lines: [
    [0.3, 'ஆண்டுகள் உருண்டன. வாள் பிடித்த கை நடுங்கத் தொடங்கியது.', 'Years rolled on. The hand that held the sword began to tremble.'],
    [5, 'ஒரு நாள் காலை, மன்னன் தன் மக்களுக்கு ஒரு கடைசி ஆணை இட்டான்:', 'One morning, the king gave his people a last command:'],
    [9.5, '"என் பாடையில் என் இரு கைகளும் வெளியே தொங்கட்டும்."', '"Let both my hands hang outside my bier."']] },
  funeral: { dur: 28, music: 'funeral', paint: paintFuneral, noSkip: 6, lines: [
    [1.5, 'உலகை வென்றவன் இன்று போகிறான்.', 'The one who conquered the world departs today.'],
    [7, 'மக்கள் கண்டனர் — அவன் கைகள் திறந்திருந்தன. வெறுமையாக.', 'The people saw his hands: open, and empty.'],
    [15, '"நான் எதையும் எடுத்துச் செல்லவில்லை."', '"I take nothing with me."', true]] },
  credits: { dur: 9, music: 'calm', paint: paintCredits, lines: [] }
};
for (let i = 0; i < 4; i++) SCENES['ch' + (i + 1)] = { dur: 4.6, paint: paintChapter(i), lines: [] };

/* ===== Scene runner ===== */
function runScenes(list, after) { G.state = 'scene'; G.sq = list; G.si = 0; G.after = after; startScene(); }
function startScene() { const s = SCENES[G.sq[G.si]]; G.scene = s; G.st = 0; if ('music' in s) AUDIO.music(s.music); }
function nextScene() { G.si++; if (G.si >= G.sq.length) G.after(); else startScene(); }
function updateScene(dt) {
  G.st += dt;
  if (startPressed() && G.st > (G.scene.noSkip || 0.5)) { nextScene(); return; }
  if (G.st >= G.scene.dur) nextScene();
}
function wrapText(c, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = '', lines = [];
  for (const w of words) { const t2 = line ? line + ' ' + w : w; if (c.measureText(t2).width > maxW && line) { lines.push(line); line = w; } else line = t2; }
  lines.push(line); lines.forEach((l, i) => c.fillText(l, x, y + i * lh)); return lines.length;
}
function drawScene(c) {
  const s = G.scene, t = G.st;
  s.paint(c, t);
  const bar = 46;
  c.fillStyle = '#000'; c.fillRect(0, 0, W, bar); c.fillRect(0, H - bar, W, bar);
  let cur = null; for (const l of s.lines) if (t >= l[0]) cur = l;
  if (cur) {
    const lt = t - cur[0], n = Math.floor(lt * 30);
    c.textAlign = 'center'; c.globalAlpha = clamp(lt * 3, 0, 1);
    if (cur[3]) {
      c.font = `900 40px ${TA}`; c.fillStyle = '#fff0d8'; c.shadowColor = '#000'; c.shadowBlur = 18;
      wrapText(c, cur[1].slice(0, n), W / 2, H - 150, W - 120, 48);
      c.shadowBlur = 0; c.font = `italic 600 20px ${EN}`; c.fillStyle = '#ffb066'; if (lt > 1.4) c.fillText(cur[2], W / 2, H - 96);
    } else {
      c.font = `700 25px ${TA}`; c.fillStyle = '#f4e4c8'; c.shadowColor = '#000'; c.shadowBlur = 10;
      const nl = wrapText(c, cur[1].slice(0, n), W / 2, H - bar - 52, W - 140, 32);
      c.shadowBlur = 0; c.font = `italic 400 15px ${BODY}`; c.fillStyle = '#c9a882';
      if (n >= cur[1].length) c.fillText(cur[2], W / 2, H - bar - 52 + nl * 32 - 4);
    }
    c.globalAlpha = 1;
  }
  if (t > (s.noSkip || 0.5)) { c.textAlign = 'right'; c.font = `400 12px ${BODY}`; c.fillStyle = '#6a5a4a'; c.fillText('Space / Enter / தட்டு — தொடர்', W - 16, H - 18); }
}
