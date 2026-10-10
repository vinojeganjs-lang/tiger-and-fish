'use strict';
/* ===== Levels ===== */
function buildLevel(i) {
  const len = [7000, 6600, 7200, 5800][i];
  const r = rng(1000 + i * 77);
  const gaps = [[[2150, 130], [4300, 150]], [[1500, 140], [3100, 150], [4700, 140]], [[2500, 130], [5000, 140]], [[1900, 150], [3600, 140]]][i];
  const L = { i, len, ground: [], plats: [], spawns: [], bossX: len - W };
  let x = -300;
  for (const [gx, gw] of gaps) { L.ground.push({ x, w: gx - x }); x = gx + gw; }
  L.ground.push({ x, w: len + 800 - x });
  for (let px = 700; px < L.bossX - 300; px += 360 + r() * 440) {
    const hi = r() < 0.35; L.plats.push({ x: px, y: GROUND_Y - (hi ? 200 : 118), w: 130 + r() * 110 });
  }
  if (i !== 2) L.plats.push({ x: L.bossX + 190, y: GROUND_Y - 150, w: 150 }, { x: L.bossX + 450, y: GROUND_Y - 150, w: 140 });
  for (const p of L.plats) if (p.x < L.bossX - 250 && r() < 0.5) L.spawns.push({ x: p.x + p.w / 2, y: p.y, type: 'archer' });
  for (let sx = 1150; sx < L.bossX - 600; sx += 800 + r() * 700) L.spawns.push({ x: sx, y: GROUND_Y, type: i >= 2 && r() < 0.55 ? 'catapult' : 'boar' });
  for (let sx = 650; sx < L.bossX - 200; sx += 650 + r() * 350) L.spawns.push({ x: sx, y: 150, type: 'kite' });
  L.spawns.sort((a, b) => a.x - b.x);
  return L;
}
const STAGE_NAMES = [['கானகம்', 'The Burning Forest'], ['கடல்', 'The Corsair Sea'], ['கார்மலைக் கோட்டை', 'The Fortress of Kaarmalai'], ['பெரும்போர்', 'The Great War']];
const POST = [['after1', 'ch2'], ['after2', 'ch3'], ['after3', 'pre4', 'ch4'], ['victory', 'aging', 'funeral', 'credits']];

/* ===== Flow ===== */
let menuSel = /#[a-z0-9]{6}/.test(location.hash) ? 2 : 0;
function startGame(n, stage = 0) {
  G.nPlayers = n; G.players = [new Player(0)]; if (n === 2) G.players.push(new Player(1));
  if (stage > 0) { startStage(stage); return; }
  runScenes(['birth', 'youth', 'ch1'], () => startStage(0));
}
function startStage(i) {
  G.stage = i; G.level = buildLevel(i); G.cam = 0; G.boss = null; G.clearT = 0; G.bossGone = false;
  G.enemies = []; G.shots = []; G.eshots = []; G.parts = []; G.pickups = []; G.spawnT = 2.5; G.slow = 1; G.crowT = 4;
  G.players.forEach((p, k) => { if (p.out) { p.out = false; p.lives = 3; } p.weapon = p.weapon || 'arrow'; p.reset(120 + k * 70); });
  G.state = 'play'; AUDIO.music('battle');
  G.banner = { ta: STAGE_NAMES[i][0], en: STAGE_NAMES[i][1], t: 3 };
}
function toTitle() {
  G.t = 0; AUDIO.music('calm'); G.cam = 0;
  if (typeof NET !== 'undefined' && NET.mode === 'host') {
    G.state = 'lobby';
    NET.setPresence({ role: 'host', busy: false, s: { m: 'lobby', st: 0, c: 0, sh: 0, fl: 0, pa: 0, mu: 'calm', go: 0, p: [] } });
    return;
  }
  G.state = 'title';
}
function onBossDown() {
  G.clearT = 3.6; G.slow = 0.3; G.slowT = 1.3; G.flash = 1; G.shake = 20; AUDIO.sfx('boom'); AUDIO.music(null);
  for (const e of G.enemies) killEnemy(e, null);
  G.enemies = []; G.eshots = [];
  G.players.forEach(p => { if (!p.out) p.score += 5000; });
}

/* ===== Update ===== */
function esBox(s) {
  if (s.box === 'wave') return { x: s.x - 14, y: GROUND_Y - 26, w: 28, h: 26 };
  if (s.box === 'slash') return { x: s.x - 12, y: GROUND_Y - 70, w: 24, h: 70 };
  if (s.box === 'flame') return { x: s.x - 15, y: GROUND_Y - 40, w: 30, h: 40 };
  const r = s.r || 8; return { x: s.x - r, y: s.y - r, w: r * 2, h: r * 2 };
}
function sparks(x, y, col = '#ffd890') { burst(x, y, 6, { colors: [col, '#fff'], g: 500, min: 60, max: 240, smin: 1, smax: 2.5, add: true, lmax: 0.35 }); }

function updatePlay(dt) {
  const L = G.level;
  if (G.togglePause || pressed.Escape || pressed.KeyP || (padState[0] && padState[0].startP)) { G.togglePause = false; G.paused = !G.paused; }
  if (G.paused) return;
  if (G.players.length < 2 && NET.mode !== 'host' && p2JoinPressed()) { const p = new Player(1); p.reset(G.cam + 100); G.players.push(p); G.nPlayers = 2; G.banner = { ta: 'செங்கன் இணைந்தான்!', en: 'Sengan joins the fight', t: 2 }; }
  G.players.forEach(p => p.update(dt));
  const alive = alivePlayers();
  if (alive.length && !G.boss) {
    const lead = Math.max(...alive.map(p => p.x));
    G.cam = Math.min(Math.max(G.cam, lead - W * 0.42), L.bossX);
  }
  if (!G.boss && G.cam >= L.bossX) {
    G.boss = makeBoss(G.stage); AUDIO.music('boss');
    G.banner = { ta: G.boss.name.ta, en: G.boss.name.en, t: 3, boss: true };
  }
  // scripted spawns
  while (L.spawns.length && L.spawns[0].x < G.cam + W + 60) {
    const s = L.spawns.shift();
    if (s.type === 'boar') spawnEnemy('boar', G.cam + W + 60, GROUND_Y);
    else if (s.type === 'kite') spawnEnemy('kite', G.cam + W + 50, 150);
    else if (s.type === 'catapult') { if (groundAt(s.x)) spawnEnemy('catapult', Math.max(s.x, G.cam + W + 40), GROUND_Y); }
    else spawnEnemy(s.type, s.x, s.y);
  }
  // endless foot soldiers, Contra style
  G.spawnT -= dt;
  if (G.spawnT <= 0 && !G.boss) {
    G.spawnT = rand(1.0, 2.1) - G.stage * 0.12;
    const side = Math.random() < 0.22 ? -1 : 1, n = 1 + ((Math.random() * (G.stage >= 2 ? 3 : 2)) | 0);
    for (let k = 0; k < n; k++) { const x = side > 0 ? G.cam + W + 30 + k * 40 : G.cam - 30 - k * 40; if (groundAt(x)) spawnEnemy('soldier', x, GROUND_Y - 4); }
  }
  if (G.boss && !G.clearT) {
    G.crowT = (G.crowT ?? 4) - dt;
    if (G.crowT <= 0) { G.crowT = G.stage === 3 ? 7 : 10; spawnEnemy('kite', G.cam + W + 40, 150); }
  }
  updateEnemies(dt);
  if (G.boss && !G.bossGone) {
    if (!G.clearT) G.boss.update(dt);
    if (!G.clearT && G.boss.hp <= 0) onBossDown();
  }
  if (G.clearT) {
    G.clearT -= dt / Math.max(G.slow, 0.3);
    if (!G.bossGone && Math.random() < 0.35) { const b = G.boss.boxes().concat(G.boss.body()).filter(Boolean)[0] || { x: G.cam + W - 200, y: 300, w: 100, h: 100 }; fireBurst(b.x + rand(0, b.w), b.y + rand(0, b.h), 20, 1.3); if (Math.random() < 0.3) AUDIO.sfx('boom'); G.shake = 8; }
    if (!G.bossGone && G.clearT < 1.6) { G.bossGone = true; const b = G.boss.boxes().concat(G.boss.body()).filter(Boolean)[0]; if (b) { fireBurst(b.x + b.w / 2, b.y + b.h / 2, 120, 2.4); bloodBurst(b.x + b.w / 2, b.y + b.h / 2, 0, 40); } G.flash = 0.8; AUDIO.sfx('boom'); }
    if (G.clearT <= 0) { G.clearT = 0; const i = G.stage; runScenes(POST[i], i < 3 ? () => startStage(i + 1) : toTitle); return; }
  }
  // player shots
  for (const s of G.shots) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.x < G.cam - 40 || s.x > G.cam + W + 40 || s.y < -40 || s.y > H + 20) s.dead = true;
    if (s.y > GROUND_Y + 2 && groundAt(s.x)) { s.dead = true; sparks(s.x, GROUND_Y); }
    if (s.dead) continue;
    const sb = { x: s.x - 7, y: s.y - 7, w: 14, h: 14 };
    for (const e of G.enemies) {
      if (e.dead || s.hit.has(e) || !overlap(sb, ehb(e))) continue;
      s.hit.add(e); e.hp -= s.dmg; e.flash = 0.06; sparks(s.x, s.y); AUDIO.sfx('hit');
      if (s.kind === 'fire') fireBurst(s.x, s.y, 6, 0.5);
      if (e.hp <= 0) killEnemy(e, s);
      if (!s.pierce) { s.dead = true; break; }
    }
    if (!s.dead && G.boss && !G.clearT && !G.bossGone) {
      G.boss.boxes().forEach((b, i) => {
        if (s.dead || !b || s.hit.has('b' + i) || !overlap(sb, b)) return;
        s.hit.add('b' + i); G.boss.damage(s.dmg, i); sparks(s.x, s.y, '#ff9a50'); AUDIO.sfx('hit');
        if (Math.random() < 0.4) bloodBurst(s.x, s.y, Math.sign(s.vx), 5);
        if (!s.pierce) s.dead = true;
      });
    }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
  G.shots = G.shots.filter(s => !s.dead && s.life > 0);
  // enemy shots
  for (const s of G.eshots) {
    s.vy += (s.g || 0) * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.box === 'wave' || s.box === 'slash') { if (!groundAt(s.x)) s.dead = true; if (Math.random() < 0.5) part({ x: s.x, y: GROUND_Y - rand(0, 20), vx: -s.vx * 0.1, vy: -rand(40, 120), life: 0.4, max: 0.4, size: rand(2, 5), color: '#ff9a40', add: true, g: 0 }); }
    else if (!s.box && s.y >= GROUND_Y - 2 && groundAt(s.x)) {
      s.dead = true;
      if (s.kind === 'pot') { fireBurst(s.x, GROUND_Y, 26); AUDIO.sfx('fire'); eshoot(s.x, GROUND_Y, 0, 0, 'flame', { life: 1.4, box: 'flame' }); }
      else sparks(s.x, GROUND_Y, '#c9ccd2');
    }
    if (s.x < G.cam - 200 || s.x > G.cam + W + 200 || s.y > H + 50) s.dead = true;
    if (s.dead) continue;
    const b = esBox(s);
    for (const p of alivePlayers()) if (p.inv <= 0 && overlap(b, p.hb)) { p.hurt(); if (!s.box) s.dead = true; }
  }
  G.eshots = G.eshots.filter(s => !s.dead && s.life > 0);
  if (G.boss && !G.clearT && !G.bossGone) for (const b of G.boss.body()) if (b) for (const p of alivePlayers()) if (p.inv <= 0 && overlap(b, p.hb)) p.hurt();
  // pickups
  for (const k of G.pickups) {
    k.t += dt; k.vy = Math.min(k.vy + 900 * dt, 500); const py = k.y; k.y += k.vy * dt;
    if (k.y >= GROUND_Y - 14 && groundAt(k.x)) { k.y = GROUND_Y - 14; k.vy = 0; }
    for (const p of G.plats || []) {}
    for (const p of alivePlayers()) if (Math.abs(p.x - k.x) < 30 && Math.abs(p.y - 30 - k.y) < 50) {
      k.dead = true; AUDIO.sfx('pick');
      if (k.kind === 'jet') { p.fly = 15; G.banner = { ta: 'கருடச் சிறகு!', en: 'Garuda wings: hold ↑ to fly', t: 2.2, small: true }; }
      else if (k.kind === 'life') { p.lives = Math.min(9, p.lives + 1); G.banner = { ta: 'உயிர் +1', en: 'Extra life', t: 1.6, small: true }; }
      else if (p.weapon === k.kind) { p.wlvl = Math.min(3, (p.wlvl || 1) + 1); G.banner = { ta: `${WEAPONS[k.kind].ta} · சக்தி ${p.wlvl}`, en: `${WEAPONS[k.kind].en} power ${p.wlvl}`, t: 1.6, small: true }; }
      else { p.weapon = k.kind; p.wlvl = 1; G.banner = { ta: WEAPONS[k.kind].ta, en: WEAPONS[k.kind].en, t: 1.6, small: true }; }
      burst(k.x, k.y, 20, { colors: [WEAPONS[k.kind] ? WEAPONS[k.kind].col : k.kind === 'jet' ? '#9fe3ff' : '#ff6a5a', '#fff'], g: -100, add: true, lmax: 0.6 });
    }
    if (k.t > 12 || k.y > H + 40 || k.x < G.cam - 40) k.dead = true;
  }
  G.pickups = G.pickups.filter(k => !k.dead);
  updateParts(dt);
  if (G.players.every(p => p.out)) { G.state = 'gameover'; G.goT = 0; AUDIO.music(null); }
}

/* ===== Render ===== */
const GLYPH = { fire: 'நெ', vel: 'வே', chakra: 'ச', life: 'உ', jet: 'சி' };
function drawPickup(c, k) {
  const w = WEAPONS[k.kind] || { col: k.kind === 'jet' ? '#9fe3ff' : '#ff5a4a' }, bob = Math.sin(k.t * 5) * 3;
  c.save(); c.translate(k.x, k.y + bob);
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(0, 0, 2, 0, 0, 34); g.addColorStop(0, w.col); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.globalAlpha = 0.6 + Math.sin(k.t * 8) * 0.2; c.fillRect(-34, -34, 68, 68);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.fillStyle = '#2a1408'; c.beginPath(); c.arc(0, 0, 14, 0, 6.283); c.fill();
  c.strokeStyle = '#e8b33a'; c.lineWidth = 2; c.stroke();
  c.fillStyle = '#ffe9b0'; c.font = `700 14px ${TA}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(GLYPH[k.kind], 0, 1);
  c.textBaseline = 'alphabetic'; c.restore();
}
function drawHUD(c) {
  G.players.forEach((p, i) => {
    const right = i === 1, x = right ? W - 20 : 20;
    c.textAlign = right ? 'right' : 'left';
    c.font = `700 19px ${TA}`; c.fillStyle = i ? '#9fb8ff' : '#ffcf80'; c.shadowColor = '#000'; c.shadowBlur = 6;
    c.fillText(PNAMES[i].ta, x, 34);
    c.shadowBlur = 0;
    for (let l = 0; l < Math.max(0, p.lives); l++) {
      const lx = right ? x - 6 - l * 13 : x + 6 + l * 13;
      seg(c, lx, 44, lx, 62, 2, '#6a4220'); c.fillStyle = '#ffe08a'; c.beginPath(); c.moveTo(lx, 40); c.lineTo(lx + 3.5, 47); c.lineTo(lx - 3.5, 47); c.fill();
    }
    c.font = `600 13px ${BODY}`; c.fillStyle = WEAPONS[p.weapon].col;
    c.fillText(`${WEAPONS[p.weapon].ta} ${'★'.repeat(p.wlvl || 1)} · ${String(p.score).padStart(7, '0')}`, x, 82);
    if (p.fly > 0) { c.fillStyle = '#9fe3ff'; c.fillText(`சிறகு ${Math.ceil(p.fly)}s · ↑ பற`, x, 100); }
    if (p.out) { c.fillStyle = '#a3221a'; c.fillText('வீழ்ந்தான்', x, 100); }
  });
  if (G.players.length < 2 && Math.floor(G.t * 1.5) % 2) {
    c.textAlign = 'right'; c.font = `600 13px ${BODY}`; c.fillStyle = 'rgba(159,184,255,.8)'; c.fillText('2-ஆம் வீரர்: F அழுத்தி சேருங்கள்', W - 20, 34);
  }
  const b = G.boss;
  if (b && !G.bossGone) {
    const bw = 460, bx = W / 2 - bw / 2, by = H - 40, k = clamp(b.hp / b.max, 0, 1);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(bx - 4, by - 4, bw + 8, 16);
    const g = c.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#5a0a06'); g.addColorStop(1, '#ff5a14');
    c.fillStyle = g; c.fillRect(bx, by, bw * k, 8);
    c.strokeStyle = '#e8b33a'; c.lineWidth = 1; c.strokeRect(bx - 4.5, by - 4.5, bw + 9, 17);
    c.textAlign = 'center'; c.font = `700 15px ${TA}`; c.fillStyle = '#ffd8a8'; c.fillText(b.name.ta, W / 2, by - 12);
  }
  if (G.banner && G.banner.t > 0) {
    const bn = G.banner, a = clamp(bn.t, 0, 1) * clamp((3.2 - bn.t) * 3, 0, 1);
    c.globalAlpha = bn.small ? clamp(bn.t, 0, 1) : a; c.textAlign = 'center';
    const y = bn.small ? 150 : 210;
    c.font = `900 ${bn.small ? 30 : 54}px ${TA}`; c.fillStyle = bn.boss ? '#ff8a5a' : '#ffe2b0'; c.shadowColor = 'rgba(255,70,10,.9)'; c.shadowBlur = 24;
    c.fillText(bn.ta, W / 2, y); c.shadowBlur = 0;
    c.font = `600 ${bn.small ? 13 : 17}px ${EN}`; c.fillStyle = '#ffb066'; c.fillText(bn.en.toUpperCase(), W / 2, y + (bn.small ? 22 : 34));
    c.globalAlpha = 1;
  }
}
function renderPlay(c, dt) {
  const L = G.level, th = THEMES[G.stage];
  const sh = G.shake; const sx = sh ? rand(-sh, sh) : 0, sy = sh ? rand(-sh, sh) * 0.6 : 0;
  c.save(); c.translate(sx, sy);
  drawBackground(c, th, G.cam, G.t);
  drawEmbers(c, G.paused ? 0 : dt, G.t, th.sea ? 0.3 : 0.8);
  c.save(); c.translate(-G.cam, 0);
  drawWorld(c, L, th, G.cam, G.t);
  G.pickups.forEach(k => drawPickup(c, k));
  G.enemies.forEach(e => ETYPES[e.type].draw(c, e));
  if (G.boss && !G.bossGone) G.boss.draw(c);
  G.players.forEach(p => p.draw(c));
  G.shots.forEach(s => drawShot(c, s));
  G.eshots.forEach(s => drawEShot(c, s));
  drawParts(c);
  c.restore();
  drawForeground(c, th, G.cam, G.t);
  c.restore();
  drawGrade(c);
  if (G.flash > 0) { c.fillStyle = `rgba(255,220,170,${Math.min(0.8, G.flash)})`; c.fillRect(0, 0, W, H); }
  drawHUD(c);
  if (G.paused) {
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, W, H); c.textAlign = 'center';
    c.font = `900 48px ${TA}`; c.fillStyle = '#ffe2b0'; c.fillText('இடைநிறுத்தம்', W / 2, H / 2 - 10);
    c.font = `600 16px ${EN}`; c.fillStyle = '#ffb066'; c.fillText('PAUSED · P / ESC TO RESUME', W / 2, H / 2 + 26);
  }
  if (G.state === 'gameover') {
    c.fillStyle = `rgba(0,0,0,${Math.min(0.75, G.goT)})`; c.fillRect(0, 0, W, H); c.textAlign = 'center';
    c.font = `900 60px ${TA}`; c.fillStyle = '#c22a1a'; c.shadowColor = '#000'; c.shadowBlur = 20; c.fillText('வீரன் வீழ்ந்தான்', W / 2, H / 2 - 20); c.shadowBlur = 0;
    c.font = `600 18px ${EN}`; c.fillStyle = '#d9c7a8'; c.fillText('THE HERO HAS FALLEN', W / 2, H / 2 + 18);
    if (G.goT > 1.5) { c.font = `600 16px ${BODY}`; c.fillStyle = '#ffcf80'; c.fillText('மீண்டும் எழ — Space / Enter / தட்டு   ·   Continue this chapter', W / 2, H / 2 + 70); }
  }
}
function renderTitle(c, dt) {
  drawBackground(c, THEMES[0], G.t * 30, G.t);
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#060203'; c.beginPath(); c.moveTo(560, H); c.lineTo(660, 420); c.quadraticCurveTo(760, 390, 860, 430); c.lineTo(960, H); c.fill();
  drawWarrior(c, 750, 404, { face: -1, state: 'idle', pal: PAL.hero, weapon: 'bow', aim: { x: -0.7, y: -0.7 }, scale: 2.6, hero: true });
  drawEmbers(c, dt, G.t, 1);
  c.textAlign = 'left';
  c.font = `600 15px ${EN}`; c.fillStyle = '#ffb066'; c.fillText('1600 BCE · A TAMIL WARRIOR SAGA', 64, 120);
  c.save(); c.font = `900 92px ${TA}`; c.shadowColor = 'rgba(255,80,10,.9)'; c.shadowBlur = 36 + Math.sin(G.t * 3) * 10;
  const g = c.createLinearGradient(0, 140, 0, 230); g.addColorStop(0, '#fff2c8'); g.addColorStop(1, '#ff8a2a');
  c.fillStyle = g; c.fillText('வீரமாறன்', 56, 220); c.restore();
  c.font = `900 26px ${EN}`; c.fillStyle = '#e8b33a'; c.fillText('VEERAMAARAN', 62, 260);
  c.font = `400 17px ${BODY}`; c.fillStyle = '#d9c7a8'; c.fillText('பிறப்பு முதல் இறப்பு வரை · ஒரு வீரனின் கதை', 62, 292);
  const opts = [['ஒரு வீரர்', '1 PLAYER'], ['இரு வீரர்கள் · ஒரே திரை', '2P · SAME KEYBOARD'], ['ஆன்லைன் · இரு லேப்டாப்', '2P · ONLINE LINK']];
  opts.forEach((o, i) => {
    const y = 330 + i * 38, sel = i === menuSel;
    c.fillStyle = sel ? 'rgba(255,120,40,.18)' : 'rgba(0,0,0,0)'; c.fillRect(56, y - 26, 470, 36);
    if (sel) { c.fillStyle = '#ff8a2a'; c.fillRect(56, y - 26, 3, 36); }
    c.font = `700 20px ${TA}`; c.fillStyle = sel ? '#ffe2b0' : '#a8957a'; c.fillText(o[0], 72, y);
    c.font = `600 12px ${EN}`; c.fillStyle = sel ? '#ffb066' : '#7a6a56'; c.fillText(o[1], 360, y - 2);
  });
  c.font = `400 12.5px ${BODY}`; c.fillStyle = '#9a8a74';
  c.fillText('← → நகர் · ↑ தாவு · Space எய் · ↓ குனி · ↑ பிடித்தால் மேலே குறி   (online-லும் இதே keys)', 62, 460);
  c.fillText('ஒரே கீபோர்டில் 2-ஆம் வீரர்: A D நகர் · W தாவு · F எய் · S குனி · W பிடித்தால் மேலே குறி   ·   Gamepad ✓', 62, 480);
  c.fillText('1 – 4 : நேரடியாக அத்தியாயம் தேர்வு', 62, 500);
  if (Math.floor(G.t * 2) % 2) { c.font = `700 15px ${TA}`; c.fillStyle = '#ffcf80'; c.fillText('Space / Enter / தட்டு — தொடங்கு', 62, 530 - 4); }
}

/* ===== Main loop ===== */
let last = performance.now();
function frame(now) {
  let raw = Math.min(0.033, (now - last) / 1000); last = now;
  pollPads();
  if (G.slowT > 0) { G.slowT -= raw; if (G.slowT <= 0) G.slow = 1; }
  const dt = raw * G.slow;
  G.t += dt; G.shake = Math.max(0, G.shake - raw * 40); G.flash = Math.max(0, G.flash - raw * 2);
  if (G.banner) G.banner.t -= raw;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  try {
    if (NET.mode === 'guest') { NET.guestFrame(raw); endFrameInput(); requestAnimationFrame(frame); return; }
    if (G.state === 'lobby') NET.lobbyFrame(raw);
    else if (G.state === 'boot') { ctx.fillStyle = '#070302'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#ffb066'; ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.fillText('…', W / 2, H / 2); }
    else if (G.state === 'title') {
      if (pressed.KeyW || pressed.ArrowUp || touch.up && !G._tu) menuSel = (menuSel + 2) % 3;
      if (pressed.KeyS || pressed.ArrowDown || touch.down && !G._td) menuSel = (menuSel + 1) % 3;
      G._tu = touch.up; G._td = touch.down;
      for (let d = 1; d <= 4; d++) if (pressed['Digit' + d] && menuSel < 2) { startGame(menuSel + 1, d - 1); break; }
      if (G.state === 'title' && startPressed()) { if (menuSel === 2) NET.enterLobby(); else startGame(menuSel + 1); }
      if (G.state === 'title') renderTitle(ctx, raw);
    } else if (G.state === 'scene') { updateScene(raw); if (G.state === 'scene') { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); drawScene(ctx); } }
    else if (G.state === 'play') { updatePlay(dt); if (G.state === 'play' || G.state === 'gameover') renderPlay(ctx, dt); }
    else if (G.state === 'gameover') {
      G.goT += raw; updateParts(dt); renderPlay(ctx, dt);
      if (G.goT > 1.5 && startPressed()) { G.players.forEach(p => { p.out = false; p.lives = 5; p.score = 0; p.weapon = 'arrow'; }); startStage(G.stage); }
    }
    if (NET.mode === 'host') NET.hostSend();
  } catch (err) { console.error(err); }
  endFrameInput();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(async () => {
  try {
    await Promise.race([
      Promise.all(['900 40px "Arima Madurai"', '700 20px "Arima Madurai"', '400 16px "Hind Madurai"', '600 16px "Cinzel"', '900 20px "Cinzel"'].map(f => document.fonts.load(f, 'வீரமாறன் A'))),
      new Promise(r => setTimeout(r, 2500))
    ]);
  } catch (e) { }
  toTitle();
})();
