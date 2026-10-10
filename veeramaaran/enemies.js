'use strict';
/* ===== Helpers ===== */
function alivePlayers() { return G.players.filter(p => !p.out && p.dead <= 0); }
function nearestPlayer(x, y = GROUND_Y - 40) {
  let best = null, bd = 1e9;
  for (const p of alivePlayers()) { const d = Math.hypot(p.x - x, (p.y - 40) - y); if (d < bd) { bd = d; best = p; } }
  return best;
}
function eshoot(x, y, vx, vy, kind, o = {}) {
  G.eshots.push(Object.assign({ x, y, vx, vy, kind, g: 0, life: 4, r: kind === 'arrow' ? 6 : 10 }, o));
}
// lob a projectile at a target so it lands there after time T
function lob(x, y, tx, ty, T, g, kind, o) { eshoot(x, y, (tx - x) / T, (ty - y - 0.5 * g * T * T) / T, kind, Object.assign({ g }, o)); }
function aimShot(x, y, speed, kind, o) {
  const p = nearestPlayer(x, y); if (!p) return;
  const a = Math.atan2((p.y - 36) - y, p.x - x);
  eshoot(x, y, Math.cos(a) * speed, Math.sin(a) * speed, kind, o);
}
function enemyPal() { return [PAL.bandit, PAL.pirate, PAL.soldier, PAL.dark][G.stage]; }

/* ===== Regular enemies ===== */
const ETYPES = {
  soldier: {
    hp: 1, w: 24, h: 62, score: 100,
    init(e) { e.dir = e.x > G.cam + W / 2 ? -1 : 1; e.speed = rand(130, 175) + G.stage * 12; e.thrower = G.stage >= 1 && Math.random() < 0.35; e.throwAt = rand(0.6, 1.6); e.weapon = e.thrower ? 'spear' : 'sword'; },
    update(e, dt) {
      e.phase += dt * 11;
      let mv = e.dir * e.speed;
      if (e.thrower && !e.thrown && e.t > e.throwAt && e.ground && e.x > G.cam + 60 && e.x < G.cam + W - 60) {
        const p = nearestPlayer(e.x); if (p) { e.dir = p.x < e.x ? -1 : 1; lob(e.x, e.y - 55, p.x, p.y - 30, 0.9, 900, 'spear'); }
        e.thrown = true; e.pause = 0.5; e.weapon = 'sword'; e.attack = 0.01;
      }
      if (e.pause > 0) { e.pause -= dt; mv = 0; e.attack = Math.min(1, (e.attack || 0) + dt * 3); }
      e.vx = mv;
      if (e.ground && !groundAt(e.x + e.dir * 30) && Math.random() < 0.6) { e.vy = -650; e.ground = false; }
    },
    draw(c, e) { drawWarrior(c, e.x, e.y, { face: e.dir, phase: e.phase, state: e.ground ? (e.vx ? 'run' : 'idle') : 'run', pal: enemyPal(), weapon: e.weapon, flash: e.flash, attack: e.attack }); }
  },
  archer: {
    hp: 2, w: 24, h: 62, score: 200, static: true,
    init(e) { e.cool = rand(0.8, 1.8); },
    update(e, dt) {
      const p = nearestPlayer(e.x, e.y - 50); if (!p) return;
      e.dir = p.x < e.x ? -1 : 1;
      const a = Math.atan2((p.y - 36) - (e.y - 48), p.x - e.x);
      e.aim = { x: Math.cos(a), y: Math.sin(a) };
      e.cool -= dt; e.drawn = e.cool < 0.35;
      if (e.cool <= 0 && e.x < G.cam + W - 20) { e.cool = rand(1.5, 2.3) - G.stage * 0.15; eshoot(e.x + e.aim.x * 26, e.y - 48 + e.aim.y * 26, e.aim.x * 430, e.aim.y * 430, 'arrow', { burning: G.stage >= 2 }); AUDIO.sfx('shoot'); }
    },
    draw(c, e) { drawWarrior(c, e.x, e.y, { face: e.dir, state: 'idle', aim: e.aim || { x: e.dir, y: 0 }, pal: enemyPal(), weapon: 'bow', drawn: e.cool > 1.2, flash: e.flash }); }
  },
  boar: {
    hp: 3, w: 58, h: 36, score: 300,
    init(e) { e.dir = -1; e.speed = 330; },
    update(e, dt) { e.phase += dt * 16; e.vx = e.dir * e.speed; if (Math.random() < 0.2) part({ x: e.x - e.dir * 30, y: e.y - 2, vx: -e.dir * 40, vy: -30, life: 0.5, max: 0.5, size: 6, color: '#3a2a1e', shape: 'smoke', g: -20 }); },
    draw(c, e) {
      c.save(); c.translate(e.x, e.y); c.scale(-e.dir, 1);
      if (e.flash > 0) c.filter = 'brightness(2.4)';
      const ph = e.phase;
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, 0, 30, 5, 0, 0, 6.283); c.fill();
      c.strokeStyle = '#120806'; c.lineWidth = 6; c.lineCap = 'round';
      [[-18, 0], [-10, Math.PI], [14, 0.5], [22, Math.PI + 0.5]].forEach(([lx, o]) => { const s = Math.sin(ph + o) * 7; c.beginPath(); c.moveTo(lx, -16); c.lineTo(lx + s, -1); c.stroke(); });
      c.fillStyle = '#2a1810'; c.beginPath(); c.ellipse(0, -24, 32, 16, -0.08, 0, 6.283); c.fill();
      c.fillStyle = '#1a0e08'; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(-20 + i * 5, -36); c.lineTo(-17 + i * 5, -46 - Math.sin(i) * 3); c.lineTo(-14 + i * 5, -36); c.fill(); }
      c.fillStyle = '#2e1a12'; c.beginPath(); c.ellipse(-30, -20, 15, 11, 0.3, 0, 6.283); c.fill();
      c.fillStyle = '#4a3024'; c.beginPath(); c.ellipse(-44, -15, 6, 5, 0, 0, 6.283); c.fill();
      c.fillStyle = '#efe2c4'; c.beginPath(); c.moveTo(-40, -14); c.quadraticCurveTo(-50, -20, -48, -30); c.lineTo(-44, -16); c.fill();
      c.fillStyle = '#ff4a1a'; c.fillRect(-36, -26, 3, 2);
      c.fillStyle = 'rgba(255,140,70,.35)'; c.beginPath(); c.ellipse(-4, -34, 22, 4, 0, 0, 6.283); c.fill();
      c.restore();
    }
  },
  kite: {
    hp: 2, w: 60, h: 40, score: 500, fly: true,
    init(e) { e.baseY = rand(130, 200); e.dir = -1; },
    update(e, dt) { e.vx = -160; e.vy = 0; e.y = e.baseY + Math.sin(e.t * 2.5) * 40 + 20; },
    draw(c, e) {
      c.save(); c.translate(e.x, e.y - 20); if (e.flash > 0) c.filter = 'brightness(2.4)';
      const fl = Math.sin(e.t * 12) * 16;
      c.fillStyle = '#0c0a10';
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-20, -10 - fl, -48, -4 - fl); c.lineTo(-40, -1 - fl * 0.6); c.lineTo(-44, 3 - fl * 0.4); c.lineTo(-10, 6); c.fill();
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(20, -10 - fl, 48, -4 - fl); c.lineTo(40, -1 - fl * 0.6); c.lineTo(44, 3 - fl * 0.4); c.lineTo(10, 6); c.fill();
      c.fillStyle = '#16141c'; c.beginPath(); c.ellipse(0, 2, 15, 7, 0, 0, 6.283); c.fill();
      c.beginPath(); c.moveTo(12, 0); c.lineTo(24, -3); c.lineTo(24, 6); c.fill();
      c.fillStyle = '#3a3a46'; c.beginPath(); c.arc(-14, -1, 6, 0, 6.283); c.fill();
      c.fillStyle = '#5a5a66'; c.beginPath(); c.moveTo(-19, -2); c.lineTo(-28, 1); c.lineTo(-19, 3); c.fill();
      c.fillStyle = '#ff3a1a'; c.beginPath(); c.arc(-16, -2, 1.4, 0, 6.283); c.fill();
      c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,200,90,.35)'; c.beginPath(); c.arc(0, 28, 16 + Math.sin(e.t * 8) * 3, 0, 6.283); c.fill(); c.globalCompositeOperation = 'source-over';
      // carried pot with glyph
      seg(c, 0, 8, 0, 18, 1.5, '#1a0c06');
      c.fillStyle = '#8a3a14'; c.beginPath(); c.arc(0, 28, 11, 0, 6.283); c.fill();
      c.fillStyle = '#e8b33a'; c.fillRect(-9, 18, 18, 3);
      c.fillStyle = '#ffe9b0'; c.font = '700 11px ' + "'Arima Madurai',serif"; c.textAlign = 'center'; c.fillText('?', 0, 32);
      c.restore();
    }
  },
  catapult: {
    hp: 6, w: 70, h: 60, score: 600, static: true,
    init(e) { e.cool = 1.5; e.arm = 0; },
    update(e, dt) {
      e.cool -= dt; e.arm = Math.max(0, e.arm - dt * 2);
      if (e.cool <= 0 && e.x < G.cam + W + 20) {
        const p = nearestPlayer(e.x); e.cool = 2.6;
        if (p) { lob(e.x - 10, e.y - 70, p.x + rand(-30, 30), GROUND_Y, 1.25, 700, 'pot'); e.arm = 1; AUDIO.sfx('fire'); }
      }
    },
    draw(c, e) {
      c.save(); c.translate(e.x, e.y); if (e.flash > 0) c.filter = 'brightness(2.4)';
      c.fillStyle = '#2a1408'; c.fillRect(-34, -18, 68, 12);
      c.fillStyle = '#120804'; [-24, 24].forEach(wx => { c.beginPath(); c.arc(wx, -8, 9, 0, 6.283); c.fill(); });
      c.strokeStyle = '#3a1e0c'; c.lineWidth = 6; c.beginPath(); c.moveTo(-20, -18); c.lineTo(0, -54); c.lineTo(20, -18); c.stroke();
      const a = -0.4 - e.arm * 1.3;
      c.save(); c.translate(0, -48); c.rotate(a); c.fillStyle = '#5a3418'; c.fillRect(-46, -3, 60, 6);
      c.fillStyle = '#2a1408'; c.beginPath(); c.arc(-46, -6, 8, 0, Math.PI); c.fill();
      if (e.cool < 1) drawFlame(c, -46, -6, 14, G.t, 3);
      c.restore(); c.restore();
    }
  }
};

function spawnEnemy(type, x, y, o = {}) {
  const T = ETYPES[type];
  const e = Object.assign({ type, x, y, vx: 0, vy: 0, hp: T.hp + (G.stage >= 2 && type === 'soldier' && Math.random() < 0.3 ? 1 : 0), w: T.w, h: T.h, dir: -1, phase: 0, flash: 0, t: 0, ground: false }, o);
  e.id = (G.eid = (G.eid || 0) + 1);
  T.init(e); G.enemies.push(e); return e;
}
function ehb(e) { return { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h }; }

function killEnemy(e, s) {
  e.dead = true;
  const T = ETYPES[e.type];
  if (s && s.owner) s.owner.score += T.score;
  const cx = e.x, cy = e.y - e.h / 2, dir = s ? Math.sign(s.vx) || 1 : 1;
  if (e.type === 'kite') {
    burst(cx, cy, 14, { colors: ['#2a1408', '#4a2a14'], g: 400, smin: 2, smax: 4, shape: 'shard' });
    const lifeP = G.boss ? 0.3 : 0.18;
    G.pickups.push({ x: cx, y: cy, vy: -200, kind: Math.random() < lifeP ? 'life' : ['fire', 'vel', 'chakra'][(Math.random() * 3) | 0], t: 0 });
  } else if (e.type === 'catapult') { fireBurst(cx, cy, 40, 1.4); AUDIO.sfx('boom'); G.shake = 8; }
  else {
    bloodBurst(cx, cy - 10, dir, 22);
    // severed-limb / helmet shards
    for (let i = 0; i < 3; i++) part({ x: cx, y: cy, vx: dir * rand(80, 260), vy: rand(-420, -200), life: 1.2, max: 1.2, size: rand(3, 6), color: i ? '#4a2a1a' : '#7a0d0a', g: 1200, shape: 'shard', vr: rand(-12, 12), ground: true });
    if (s && s.kind === 'fire') fireBurst(cx, cy, 16);
  }
  AUDIO.sfx('kill');
}

function updateEnemies(dt) {
  for (const e of G.enemies) {
    const T = ETYPES[e.type];
    e.t += dt; e.flash -= dt;
    T.update(e, dt);
    if (!T.static && !T.fly) {
      e.vy = Math.min(e.vy + 2000 * dt, 1300);
      e.x += e.vx * dt; const py = e.y; e.y += e.vy * dt;
      collideWorld(e, py);
    } else if (T.fly) e.x += e.vx * dt;
    if (e.y > H + 100 || e.x < G.cam - 160 || e.x > G.cam + W + 500) e.gone = true;
    if (!T.fly || true) for (const p of alivePlayers()) if (p.inv <= 0 && e.type !== 'kite' && overlap(ehb(e), p.hb)) p.hurt();
  }
  G.enemies = G.enemies.filter(e => !e.dead && !e.gone);
}
