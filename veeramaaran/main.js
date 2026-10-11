'use strict';
/* ===== Levels ===== */
function buildLevel(i) {
  const len = [7000, 6600, 6800, 6800, 7200, 6400, 6200, 5800][i];
  const r = rng(1000 + i * 77);
  const gaps = [[[2150, 130], [4300, 150]], [[1500, 140], [3100, 150], [4700, 140]], [[1800, 140], [3900, 150], [5200, 130]], [[1500, 150], [2800, 140], [4300, 150], [5600, 130]], [[2500, 130], [5000, 140]], [[2300, 130], [4400, 140]], [[1600, 150], [3000, 150], [4500, 140]], [[1900, 150], [3600, 140]]][i];
  const L = { i, len, ground: [], plats: [], spawns: [], bossX: len - W };
  let x = -300;
  for (const [gx, gw] of gaps) { L.ground.push({ x, w: gx - x }); x = gx + gw; }
  L.ground.push({ x, w: len + 800 - x });
  for (let px = 700; px < L.bossX - 300; px += 360 + r() * 440) {
    const hi = r() < 0.35; L.plats.push({ x: px, y: GROUND_Y - (hi ? 168 : 112), w: 140 + r() * 110 });
  }
  if (i !== 4) L.plats.push({ x: L.bossX + 190, y: GROUND_Y - 140, w: 160 }, { x: L.bossX + 450, y: GROUND_Y - 140, w: 150 });
  for (const p of L.plats) if (p.x < L.bossX - 250 && r() < 0.5) L.spawns.push({ x: p.x + p.w / 2, y: p.y, type: 'archer' });
  for (let sx = 1150; sx < L.bossX - 600; sx += 800 + r() * 700) L.spawns.push({ x: sx, y: GROUND_Y, type: i >= 4 && r() < 0.55 ? 'catapult' : 'boar' });
  for (let sx = 650; sx < L.bossX - 200; sx += 650 + r() * 350) L.spawns.push({ x: sx, y: 150, type: 'kite' });
  L.spawns.sort((a, b) => a.x - b.x);
  return L;
}
const STAGE_NAMES = [['கானகம்', 'The Burning Forest'], ['கடல்', 'The Corsair Sea'], ['பாலை', 'The Red Desert'], ['குறிஞ்சி மலை', 'The Kurinji Hills'], ['கார்மலைக் கோட்டை', 'The Fortress of Kaarmalai'], ['மருத நிலம்', 'The Burning Fields'], ['இரவு ஆறு', 'The Night River'], ['பெரும்போர்', 'The Great War']];
const POST = [['after1', 'ch2'], ['after2', 'ch3'], ['afterDesert', 'ch4'], ['afterHills', 'ch5'], ['after3', 'pre4', 'ch6'], ['afterFields', 'ch7'], ['afterRiver', 'ch8'], ['victory', 'aging', 'funeral', 'credits']];
const CH_NAMES = [['பிறப்பும் கானகமும்', 'Birth · The Burning Forest']].concat(STAGE_NAMES.slice(1));
const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/* ===== Flow ===== */
let menuSel = (/^#[a-z0-9]{6}$/.test(location.hash) || /[?&]join=[a-z0-9]{6}/.test(location.search) || (() => { try { return (localStorage.getItem('veeran-friends') || '[]') !== '[]'; } catch (e) { return false; } })()) ? 2 : 0;
/* ===== Save progress (per browser) ===== */
const SAVE = {
  get() { try { const s = JSON.parse(localStorage.getItem('veeran-save') || '{}'); let ch = s.ch | 0; if (!s.v) ch = [0, 1, 4, 7][Math.max(0, Math.min(3, ch))]; return { ch: Math.max(0, Math.min(LAST, ch)), done: !!s.done }; } catch (e) { return { ch: 0, done: false }; } },
  put(s) { try { localStorage.setItem('veeran-save', JSON.stringify(Object.assign({}, s, { v: 2 }))); } catch (e) { } },
  reach(i) { const s = this.get(); if (i > s.ch) { s.ch = i; this.put(s); G.savedT = 3; } },
  finish() { const s = this.get(); s.done = true; this.put(s); }
};
function startGame(n, stage = 0, pick = true) {
  G.nPlayers = n; G.players = [new Player(0)]; if (n === 2) G.players.push(new Player(1));
  if (n === 1 && NET.mode !== 'host') { const bot = new Player(1); bot.bot = true; G.players.push(bot); }
  if (pick && stage === 0 && SAVE.get().ch > 0) { G.state = 'chapters'; G.chSel = SAVE.get().ch; G.chT = 0; return; }
  if (stage > 0) { startStage(stage); return; }
  runScenes(['birth', 'youth', 'ch1'], () => startStage(0));
}
function startStage(i) {
  SAVE.reach(i);
  G.stage = i; G.level = buildLevel(i); G.cam = 0; G.boss = null; G.clearT = 0; G.bossGone = false;
  G.enemies = []; G.shots = []; G.eshots = []; G.parts = []; G.pickups = []; G.spawnT = 2.5; G.slow = 1; G.crowT = 4;
  G.players.forEach((p, k) => { if (p.out) { p.out = false; p.lives = 3; } p.arms = p.arms || {}; p.reset(120 + k * 70); });
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
  if ((G.players.length < 2 || G.players[1].bot) && NET.mode !== 'host' && p2JoinPressed()) { if (G.players[1]) G.players[1].bot = false; else { const p = new Player(1); p.reset(G.cam + 100); G.players.push(p); } G.nPlayers = 2; G.banner = { ta: 'செங்கன் இணைந்தான்!', en: 'Sengan joins the fight', t: 2 }; }
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
    G.spawnT = rand(1.0, 2.1) - Math.min(G.stage, 5) * 0.1;
    const side = Math.random() < 0.22 ? -1 : 1, n = 1 + ((Math.random() * (G.stage >= 2 ? 3 : 2)) | 0);
    for (let k = 0; k < n; k++) { const x = side > 0 ? G.cam + W + 30 + k * 40 : G.cam - 30 - k * 40; if (groundAt(x)) spawnEnemy('soldier', x, GROUND_Y - 4); }
  }
  if (G.boss && !G.clearT) {
    G.crowT = (G.crowT ?? 4) - dt;
    if (G.crowT <= 0) { G.crowT = G.stage === LAST ? 7 : 10; spawnEnemy('kite', G.cam + W + 40, 150); }
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
    if (G.clearT <= 0) { G.clearT = 0; const i = G.stage; if (i === LAST) SAVE.finish(); runScenes(POST[i], i < LAST ? () => startStage(i + 1) : toTitle); return; }
  }
  // player shots
  for (const s of G.shots) {
    if (s.dead) continue;
    if (s.kind === 'bomb') { s.vy += 1150 * dt; s.rot = (s.rot || 0) + dt * 10; }
    const py = s.y;
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.kind === 'blaze') { s.tick -= dt; if (s.tick <= 0) { s.tick = 0.3; s.hit.clear(); } }
    if (s.x < G.cam - 40 || s.x > G.cam + W + 40 || (s.y < -40 && s.kind !== 'bomb') || s.y > H + 20) s.dead = true;
    if (s.kind === 'bomb' && s.vy > 0) for (const pl of G.level.plats) if (s.x >= pl.x && s.x <= pl.x + pl.w && py <= pl.y && s.y >= pl.y) { explodeBomb(s, pl.y); break; }
    if (!s.dead && s.y > GROUND_Y + 2 && groundAt(s.x)) { if (s.kind === 'bomb') explodeBomb(s, GROUND_Y); else { s.dead = true; sparks(s.x, GROUND_Y); } }
    if (s.dead) continue;
    const sb = s.kind === 'blaze' ? { x: s.x - 24, y: s.y - 56, w: 48, h: 56 } : s.kind === 'bomb' ? { x: s.x - 10, y: s.y - 10, w: 20, h: 20 } : { x: s.x - 7, y: s.y - 7, w: 14, h: 14 };
    for (const e of G.enemies) {
      if (e.dead || s.hit.has(e) || !overlap(sb, ehb(e))) continue;
      if (s.kind === 'bomb') { explodeBomb(s); break; }
      s.hit.add(e); e.hp -= s.dmg; e.flash = 0.06;
      if (s.kind !== 'blaze') { sparks(s.x, s.y); AUDIO.sfx('hit'); }
      if (s.kind === 'fire' || s.kind === 'blaze') fireBurst(s.x, s.y - (s.kind === 'blaze' ? 30 : 0), 6, 0.5);
      if (e.hp <= 0) killEnemy(e, s);
      if (!s.pierce) { s.dead = true; break; }
    }
    if (!s.dead && G.boss && !G.clearT && !G.bossGone) {
      G.boss.boxes().forEach((b, i) => {
        if (s.dead || !b || s.hit.has('b' + i) || !overlap(sb, b)) return;
        if (s.kind === 'bomb') { explodeBomb(s); return; }
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
    if (s.box === 'wave' || s.box === 'slash') { if (!groundAt(s.x)) s.dead = true; if (Math.random() < 0.5) part({ x: s.x, y: GROUND_Y - rand(0, 20), vx: -s.vx * 0.1, vy: -rand(40, 120), life: 0.4, max: 0.4, size: rand(2, 5), color: s.kind === 'claw' ? '#fff2dc' : '#ff9a40', add: true, g: 0 }); }
    else if (!s.box && s.y >= GROUND_Y - 2 && groundAt(s.x)) {
      s.dead = true;
      if (s.kind === 'pot') { fireBurst(s.x, GROUND_Y, 26); AUDIO.sfx('fire'); eshoot(s.x, GROUND_Y, 0, 0, 'flame', { life: 1.4, box: 'flame' }); }
      else if (s.kind === 'venom') burst(s.x, GROUND_Y, 14, { colors: ['#5ad03a', '#a8f070', '#2a8a1a'], g: 700, min: 60, max: 220, vy: -150, lmax: 0.6 });
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
    for (const p of alivePlayers()) if (!k.dead && Math.abs(p.x - k.x) < 30 && Math.abs(p.y - 30 - k.y) < 50) {
      k.dead = true; AUDIO.sfx('pick');
      if (k.kind === 'jet') { p.fly = 15; G.banner = { ta: 'கருடச் சிறகு!', en: 'Garuda wings: hold ↑ to fly', t: 2.2, small: true }; }
      else if (k.kind === 'life') { p.lives = Math.min(9, p.lives + 1); G.banner = { ta: 'உயிர் +1', en: 'Extra life', t: 1.6, small: true }; }
      else {
        // team power: with the AI partner, whoever grabs a weapon power, both warriors get it
        const team = G.players.some(q => q.bot) ? G.players.filter(q => !q.out) : [p];
        for (const q of team) { q.arms = q.arms || {}; q.arms[k.kind] = Math.min(3, (q.arms[k.kind] || 0) + 1); }
        const lv = p.arms[k.kind], both = team.length > 1 ? ' · இருவருக்கும்' : '';
        G.banner = lv > 1 ? { ta: `${WEAPONS[k.kind].ta} · சக்தி ${lv}${both}`, en: `${WEAPONS[k.kind].en} power ${lv}${team.length > 1 ? ' for both' : ''}`, t: 1.6, small: true }
                          : { ta: `+ ${WEAPONS[k.kind].ta}${both}`, en: `${WEAPONS[k.kind].en} added${team.length > 1 ? ' for both' : ''} · all powers fire together`, t: 1.8, small: true };
      }
      burst(k.x, k.y, 20, { colors: [WEAPONS[k.kind] ? WEAPONS[k.kind].col : k.kind === 'jet' ? '#9fe3ff' : '#ff6a5a', '#fff'], g: -100, add: true, lmax: 0.6 });
    }
    if (k.t > 12 || k.y > H + 40 || k.x < G.cam - 40) k.dead = true;
  }
  G.pickups = G.pickups.filter(k => !k.dead);
  updateParts(dt);
  if (G.players.filter(p => !p.bot).every(p => p.out)) { G.state = 'gameover'; G.goT = 0; AUDIO.music(null); }
}

/* Fire pot bomb: bursts, burns everything near it, and leaves flames on the ground for a few seconds */
function explodeBomb(s, gy) {
  if (s.dead) return; s.dead = true;
  const lv = s.lv || 1, y = gy ?? s.y, R = 80 + lv * 15;
  fireBurst(s.x, y, 40 + lv * 10, 1.2 + lv * 0.2); AUDIO.sfx('boom'); G.shake = Math.max(G.shake, 6);
  for (let i = 0; i < 6; i++) part({ x: s.x, y: y - 6, vx: rand(-220, 220), vy: rand(-380, -160), life: 0.8, max: 0.8, size: rand(2, 4), color: '#c9e4ee', g: 1100, shape: 'shard', vr: rand(-14, 14) });
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (Math.abs(e.x - s.x) < R && Math.abs((e.y - e.h / 2) - y) < R) { e.hp -= s.dmg; e.flash = 0.08; if (e.hp <= 0) killEnemy(e, { owner: s.owner, kind: 'fire', vx: e.x - s.x }); }
  }
  if (G.boss && !G.clearT && !G.bossGone) G.boss.boxes().forEach((b, i) => { if (b && s.x > b.x - R && s.x < b.x + b.w + R && y > b.y - R && y < b.y + b.h + R) G.boss.damage(s.dmg, i); });
  const onGround = Math.abs(y - GROUND_Y) < 4, n = lv >= 3 ? 5 : 3;
  for (let k = 0; k < n; k++) {
    const bx = s.x + (k - (n - 1) / 2) * 42;
    if (onGround ? groundAt(bx) : k === (n - 1) / 2) G.shots.push({ x: bx, y: y - 2, vx: 0, vy: 0, dmg: 0.6 + 0.3 * lv, pierce: true, kind: 'blaze', life: 2.4 + lv * 0.4, max: 2.4 + lv * 0.4, tick: 0, owner: s.owner, hit: new Set() });
  }
}

/* ===== Render ===== */
const GLYPH = { fire: 'நெ', vel: 'வே', chakra: 'ச', life: 'உ', jet: 'சி', bomb: 'கு' };
const SHORT = { fire: 'நெருப்பு', vel: 'வேல்', chakra: 'சக்கரம்', bomb: 'குடுவை' };
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
    c.fillText(PNAMES[i].ta + (p.bot ? ' · துணை' : ''), x, 34);
    c.shadowBlur = 0;
    for (let l = 0; l < (p.bot ? 0 : Math.max(0, p.lives)); l++) {
      const lx = right ? x - 6 - l * 13 : x + 6 + l * 13;
      seg(c, lx, 44, lx, 62, 2, '#6a4220'); c.fillStyle = '#ffe08a'; c.beginPath(); c.moveTo(lx, 40); c.lineTo(lx + 3.5, 47); c.lineTo(lx - 3.5, 47); c.fill();
    }
    { const owned = ['fire', 'vel', 'chakra', 'bomb'].filter(k => p.arms && p.arms[k]);
      c.font = `600 13px ${BODY}`; c.fillStyle = owned.length ? WEAPONS[owned[owned.length - 1]].col : WEAPONS.arrow.col;
      c.fillText(`${owned.length ? owned.map(k => SHORT[k] + '★'.repeat(p.arms[k])).join(' + ') : WEAPONS.arrow.ta} · ${String(p.score).padStart(7, '0')}`, x, 82); }
    if (p.fly > 0) { c.fillStyle = '#9fe3ff'; c.fillText(`சிறகு ${Math.ceil(p.fly)}s · ↑ பற`, x, 100); }
    if (p.out) { c.fillStyle = '#a3221a'; c.fillText('வீழ்ந்தான்', x, 100); }
  });
  if ((G.players.length < 2 || G.players[1].bot) && NET.mode !== 'host' && Math.floor(G.t * 1.5) % 2) {
    c.textAlign = 'right'; c.font = `600 13px ${BODY}`; c.fillStyle = 'rgba(159,184,255,.8)'; c.fillText('2-ஆம் வீரர்: F அழுத்தி சேருங்கள்', W - 20, H - 14);
  }
  if (G.savedT > 0) { G.savedT -= 1 / 60; c.textAlign = 'center'; c.font = `600 14px ${BODY}`; c.fillStyle = `rgba(159,227,160,${Math.min(1, G.savedT)})`; c.fillText('✓ முன்னேற்றம் சேமிக்கப்பட்டது · Progress saved', W / 2, 30); }
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
function chaptersFrame(raw) {
  G.t += raw; G.chT += raw;
  const max = SAVE.get().ch;
  if (pressed.ArrowLeft || pressed.KeyA || pressed.ArrowUp || touch.left && !G._tl) G.chSel = Math.max(0, G.chSel - 1);
  if (pressed.ArrowRight || pressed.KeyD || pressed.ArrowDown || touch.right && !G._tr) G.chSel = Math.min(max, G.chSel + 1);
  G._tl = touch.left; G._tr = touch.right;
  if (pressed.Escape) { if (NET.mode === 'host') { G.state = 'lobby'; } else G.state = 'title'; return; }
  if (G.chT > 0.3 && startPressed()) { const n = G.nPlayers; startGame(n, G.chSel, false); return; }
  const c = ctx;
  drawBackground(c, THEMES[G.chSel], G.t * 25, G.t); c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, W, H); drawEmbers(c, raw, G.t, 0.8);
  c.textAlign = 'center';
  c.font = `900 44px ${TA}`; c.fillStyle = '#ffe2b0'; c.shadowColor = 'rgba(255,80,10,.8)'; c.shadowBlur = 22; c.fillText('எங்கிருந்து தொடர?', W / 2, 110); c.shadowBlur = 0;
  c.font = `600 15px ${EN}`; c.fillStyle = '#ffb066'; c.fillText('YOUR PROGRESS IS SAVED · CHOOSE A CHAPTER', W / 2, 140);
  const cw = 200, chh = 120, gap = 14, x0 = W / 2 - (4 * cw + 3 * gap) / 2;
  for (let i = 0; i <= LAST; i++) {
    const x = x0 + (i % 4) * (cw + gap), y = 166 + Math.floor(i / 4) * (chh + 14), open = i <= max, sel = i === G.chSel;
    c.fillStyle = sel ? 'rgba(255,120,40,.22)' : 'rgba(0,0,0,.45)'; c.fillRect(x, y, cw, chh);
    c.strokeStyle = sel ? '#ff8a2a' : open ? 'rgba(232,179,58,.45)' : 'rgba(120,100,80,.3)'; c.lineWidth = sel ? 2 : 1; c.strokeRect(x + 0.5, y + 0.5, cw - 1, chh - 1);
    c.globalAlpha = open ? 1 : 0.35;
    c.font = `900 26px ${EN}`; c.fillStyle = sel ? '#ffe2b0' : '#c9a882'; c.fillText(ROM[i], x + cw / 2, y + 34);
    c.font = `700 16px ${TA}`; c.fillStyle = '#f4e4c8'; c.fillText(CH_NAMES[i][0], x + cw / 2, y + 62);
    c.font = `400 11px ${BODY}`; c.fillStyle = '#c9a882'; c.fillText(CH_NAMES[i][1], x + cw / 2, y + 82);
    if (!open) { c.font = `600 12px ${BODY}`; c.fillStyle = '#8a7a66'; c.fillText('🔒 பூட்டப்பட்டது', x + cw / 2, y + 106); }
    else if (i < max || (i === LAST && SAVE.get().done)) { c.font = `600 12px ${BODY}`; c.fillStyle = '#9fe3a0'; c.fillText('✓ முடிந்தது', x + cw / 2, y + 106); }
    c.globalAlpha = 1;
  }
  c.font = `400 14px ${BODY}`; c.fillStyle = '#d9c7a8';
  c.fillText('← → தேர்வு · Space தொடங்கு · Esc பின் செல்   ·   Chapter I = full story from birth', W / 2, 446);
  if (NET.mode === 'host') { c.fillStyle = '#9fb8ff'; c.fillText('செங்கன் இணைந்துள்ளான் · Player 2 is connected and will play this chapter with you', W / 2, 470); }
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
  const opts = [['ஒரு வீரர் + AI துணை', '1P + AI PARTNER'], ['இரு வீரர்கள் · ஒரே திரை', '2P · SAME KEYBOARD'], ['ஆன்லைன் · இரு லேப்டாப்', '2P · ONLINE LINK']];
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
  { const sv = SAVE.get(); c.fillText(sv.ch > 0 ? `சேமிப்பு: அத்தியாயம் ${ROM[sv.ch]} வரை திறந்துள்ளது · Saved up to Chapter ${ROM[sv.ch]}${sv.done ? ' · story finished ✓' : ''}` : 'அத்தியாயம் முடித்தால் தானாக சேமிக்கப்படும் · Progress saves when you clear a chapter', 62, 500); }
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
      for (let d = 1; d <= 8; d++) if (pressed['Digit' + d] && menuSel < 2 && d - 1 <= SAVE.get().ch) { startGame(menuSel + 1, d - 1, false); break; }
      if (G.state === 'title' && startPressed()) { if (menuSel === 2) NET.enterLobby(); else startGame(menuSel + 1); }
      if (G.state === 'title') renderTitle(ctx, raw);
    } else if (G.state === 'chapters') { chaptersFrame(raw); }
    else if (G.state === 'scene') { updateScene(raw); if (G.state === 'scene') { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); drawScene(ctx); } }
    else if (G.state === 'play') { updatePlay(dt); if (G.state === 'play' || G.state === 'gameover') renderPlay(ctx, dt); }
    else if (G.state === 'gameover') {
      G.goT += raw; updateParts(dt); renderPlay(ctx, dt);
      if (G.goT > 1.5 && startPressed()) { G.players.forEach(p => { p.out = false; p.lives = 5; p.score = 0; p.arms = {}; }); startStage(G.stage); }
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
