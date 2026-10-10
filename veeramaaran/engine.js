'use strict';
/* ===== Core ===== */
const W = 960, H = 540, GROUND_Y = 470;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let DPR = 1;
function fitCanvas() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * DPR; cv.height = H * DPR;
}
fitCanvas(); addEventListener('resize', fitCanvas);

const G = {
  state: 'boot', t: 0, stage: 0, cam: 0, camLock: false, shake: 0, slow: 1, slowT: 0,
  players: [], enemies: [], shots: [], eshots: [], parts: [], pickups: [], hazards: [],
  level: null, boss: null, spawnT: 2, flash: 0, banner: null, nPlayers: 1, paused: false, clickP: false
};
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647, (s - 1) / 2147483646); }
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

/* ===== Input ===== */
const keys = {}, pressed = {};
addEventListener('keydown', e => {
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.code)) e.preventDefault();
  AUDIO.unlock();
});
addEventListener('keyup', e => { keys[e.code] = false; });
cv.addEventListener('pointerdown', () => { G.clickP = true; AUDIO.unlock(); });

const BIND = [
  // P1 (and every online player on their own laptop): arrows move, ↑ jump, Space shoot, X / Shift aim up
  { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp', 'KeyX', 'ShiftLeft', 'ShiftRight'], down: ['ArrowDown'], jump: ['ArrowUp'], fire: ['Space'] },
  // P2 on the same keyboard: A D move, W jump, F shoot, E aim up, S crouch
  { left: ['KeyA'], right: ['KeyD'], up: ['KeyW', 'KeyE'], down: ['KeyS'], jump: ['KeyW'], fire: ['KeyF'] }
];
const touch = { left: false, right: false, up: false, down: false, jump: false, fire: false, jumpP: false, fireP: false, startP: false };
const padPrev = [{}, {}];
const padState = [null, null];

function pollPads() {
  let pads = [];
  try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : []; } catch (e) { pads = []; }
  for (let i = 0; i < 2; i++) {
    const gp = pads[i];
    if (!gp) { padState[i] = null; continue; }
    const bt = n => !!(gp.buttons[n] && gp.buttons[n].pressed);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const j = bt(0), f = bt(2) || bt(1) || bt(7) || bt(5), st = bt(9);
    const p = padPrev[i];
    padState[i] = {
      left: ax < -0.4 || bt(14), right: ax > 0.4 || bt(15), up: ay < -0.5 || bt(12), down: ay > 0.5 || bt(13),
      jump: j, fire: f, jumpP: j && !p.j, fireP: f && !p.f, startP: st && !p.st
    };
    padPrev[i] = { j, f, st };
  }
}
function readInput(i) {
  if (i === 1 && typeof NET !== 'undefined' && NET.mode === 'host') return NET.remoteInput();
  const b = BIND[i];
  const any = a => a.some(c => keys[c]), anyP = a => a.some(c => pressed[c]);
  const inp = { left: any(b.left), right: any(b.right), up: any(b.up), down: any(b.down), jump: any(b.jump), fire: any(b.fire), jumpP: anyP(b.jump), fireP: anyP(b.fire) };
  if (i === 0) for (const k in inp) inp[k] = inp[k] || touch[k];
  const pd = padState[i];
  if (pd) for (const k in inp) inp[k] = inp[k] || pd[k];
  return inp;
}
function startPressed() {
  return pressed.Enter || pressed.Space || pressed.KeyF || touch.fireP || touch.jumpP || touch.startP || G.clickP ||
    (padState[0] && (padState[0].fireP || padState[0].jumpP || padState[0].startP));
}
function p2JoinPressed() {
  return BIND[1].fire.some(c => pressed[c]) || BIND[1].jump.some(c => pressed[c]) || (padState[1] && (padState[1].fireP || padState[1].startP));
}
function endFrameInput() { for (const k in pressed) delete pressed[k]; touch.jumpP = touch.fireP = touch.startP = false; G.clickP = false; }

/* touch pad */
(function setupTouch() {
  const stick = document.getElementById('stick'), nub = stick.querySelector('.nub');
  let sid = null;
  const setStick = (e) => {
    const r = stick.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    touch.left = dx < -0.35; touch.right = dx > 0.35; touch.up = dy < -0.45; touch.down = dy > 0.45;
    nub.style.setProperty('--dx', clamp(dx, -1, 1) * 60 + '%'); nub.style.setProperty('--dy', clamp(dy, -1, 1) * 60 + '%');
  };
  const clearStick = () => { touch.left = touch.right = touch.up = touch.down = false; nub.style.setProperty('--dx', '0'); nub.style.setProperty('--dy', '0'); sid = null; };
  stick.addEventListener('pointerdown', e => { sid = e.pointerId; stick.setPointerCapture(e.pointerId); setStick(e); AUDIO.unlock(); e.preventDefault(); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === sid) setStick(e); });
  stick.addEventListener('pointerup', clearStick); stick.addEventListener('pointercancel', clearStick);
  const btn = (id, k) => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e => { touch[k] = true; touch[k + 'P'] = true; AUDIO.unlock(); e.preventDefault(); });
    const up = () => { touch[k] = false; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  };
  btn('bJump', 'jump'); btn('bFire', 'fire');
  document.getElementById('bStart').addEventListener('pointerdown', e => { touch.startP = true; G.togglePause = true; e.preventDefault(); });
})();

/* ===== Audio (synthesised parai drums, nadaswaram-ish lead, SFX) ===== */
const AUDIO = {
  ac: null, master: null, musicGain: null, nb: null, playing: null, step: 0, next: 0, timer: null,
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; this.ac = new AC();
      this.master = this.ac.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ac.destination);
      this.musicGain = this.ac.createGain(); this.musicGain.gain.value = 0.5; this.musicGain.connect(this.master);
      const len = this.ac.sampleRate; this.nb = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = this.nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (this.wanted) this.music(this.wanted);
    } catch (e) { this.ac = null; }
  },
  noise(t, dur, f, q, vol, type = 'bandpass', dest) {
    const a = this.ac, s = a.createBufferSource(); s.buffer = this.nb;
    const fl = a.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || this.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  tone(t, f, dur, vol, type = 'square', slide = 0, dest) {
    const a = this.ac, o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  sfx(n) {
    if (!this.ac) return; const t = this.ac.currentTime;
    switch (n) {
      case 'shoot': this.noise(t, 0.09, 2400, 2, 0.18, 'bandpass'); this.tone(t, 900, 0.06, 0.05, 'triangle', 0.5); break;
      case 'fire': this.noise(t, 0.18, 900, 1, 0.22, 'lowpass'); break;
      case 'vel': this.noise(t, 0.2, 600, 3, 0.3); this.tone(t, 220, 0.2, 0.12, 'sawtooth', 0.4); break;
      case 'hit': this.noise(t, 0.07, 1500, 4, 0.2); break;
      case 'kill': this.noise(t, 0.25, 400, 1, 0.35, 'lowpass'); this.tone(t, 160, 0.2, 0.15, 'square', 0.3); break;
      case 'boom': this.noise(t, 0.9, 180, 0.7, 0.8, 'lowpass'); this.tone(t, 70, 0.7, 0.4, 'sine', 0.3); break;
      case 'jump': this.tone(t, 300, 0.12, 0.06, 'triangle', 1.8); break;
      case 'hurt': this.tone(t, 400, 0.4, 0.18, 'sawtooth', 0.2); this.noise(t, 0.3, 700, 1, 0.3); break;
      case 'pick': [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.06, f, 0.12, 0.1, 'square')); break;
      case 'roar': this.noise(t, 1.2, 250, 0.6, 0.5, 'lowpass'); this.tone(t, 110, 1.1, 0.2, 'sawtooth', 0.6); break;
      case 'warn': this.tone(t, 880, 0.15, 0.08, 'square'); this.tone(t + 0.18, 880, 0.15, 0.08, 'square'); break;
      case 'parai': this.noise(t, 0.12, 300, 1, 0.5, 'lowpass'); this.tone(t, 90, 0.18, 0.4, 'sine', 0.5); break;
    }
  },
  // music: 'battle' | 'boss' | 'calm' | 'funeral' | null
  music(kind) {
    this.wanted = kind;
    if (!this.ac) return;
    this.playing = kind; this.step = 0; this.next = this.ac.currentTime + 0.05;
    if (this.timer) clearInterval(this.timer);
    if (!kind) return;
    this.timer = setInterval(() => this.schedule(), 30);
  },
  schedule() {
    const a = this.ac, k = this.playing; if (!a || !k) return;
    const bpm = k === 'boss' ? 150 : k === 'battle' ? 132 : k === 'funeral' ? 54 : 84;
    const st = 60 / bpm / 4;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16]; // mohanam
    const root = k === 'funeral' ? 146.8 : 196;
    while (this.next < a.currentTime + 0.12) {
      const s = this.step % 16, t = this.next, mg = this.musicGain;
      if (k === 'battle' || k === 'boss') {
        const parai = k === 'boss' ? 'x.xxx.x.x.xxx.xx' : 'x..x..x.x..x.x..';
        if (parai[s] === 'x') { this.noise(t, 0.1, 320, 1.2, 0.45, 'lowpass', mg); this.tone(t, 85, 0.16, 0.5, 'sine', 0.45, mg); }
        if (s % 4 === 2) this.noise(t, 0.05, 3200, 6, 0.12, 'bandpass', mg); // thappu slap
        if (s % 2 === 0 && Math.random() < 0.55) {
          const deg = scale[(Math.random() * scale.length) | 0];
          this.tone(t, root * 2 * Math.pow(2, deg / 12), st * (Math.random() < 0.3 ? 4 : 2), 0.045, 'sawtooth', 1, mg);
        }
        if (s === 0) this.tone(t, root / 2, st * 16, 0.06, 'sawtooth', 1, mg);
      } else if (k === 'calm') {
        if (s === 0) this.tone(t, root / 2, st * 16, 0.05, 'triangle', 1, mg);
        if (s % 4 === 0 && Math.random() < 0.7) this.tone(t, root * 2 * Math.pow(2, scale[(Math.random() * 6) | 0] / 12), st * 4, 0.04, 'triangle', 1, mg);
      } else if (k === 'funeral') {
        if (s === 0 || s === 6) { this.noise(t, 0.3, 200, 1, 0.5, 'lowpass', mg); this.tone(t, 70, 0.4, 0.5, 'sine', 0.6, mg); }
        if (s === 0) this.tone(t, root, st * 16, 0.05, 'sawtooth', 1, mg);
        if (s % 8 === 4 && Math.random() < 0.8) this.tone(t, root * 2 * Math.pow(2, [0, 3, 5, 7, 10][(Math.random() * 5) | 0] / 12), st * 6, 0.04, 'triangle', 0.98, mg);
      }
      this.next += st; this.step++;
    }
  }
};

/* ===== Particles ===== */
function part(o) {
  if (G.parts.length > 900) return;
  G.parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 1, max: 1, size: 3, color: '#fff', g: 0, drag: 0, add: false, shape: 'dot', rot: 0, vr: 0 }, o));
}
function burst(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(o.min || 60, o.max || 300), l = rand(o.lmin || 0.3, o.lmax || 0.8);
    part({ x, y, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp + (o.vy || 0), life: l, max: l, size: rand(o.smin || 2, o.smax || 5), color: o.colors ? o.colors[(Math.random() * o.colors.length) | 0] : '#fff', g: o.g ?? 600, drag: o.drag || 0, add: !!o.add, shape: o.shape || 'dot' });
  }
}
function bloodBurst(x, y, dir = 0, n = 18) {
  burst(x, y, n, { colors: ['#7a0d0a', '#a3150f', '#5c0806', '#c22a1a'], g: 1100, min: 80, max: 360, vx: dir * 140, smin: 2, smax: 5, lmin: 0.4, lmax: 0.9 });
}
function fireBurst(x, y, n = 30, big = 1) {
  burst(x, y, n, { colors: ['#ffd36b', '#ff9a2a', '#ff5a14', '#ffe9b0'], g: -80, min: 40, max: 260 * big, smin: 3, smax: 9 * big, add: true, drag: 2, lmin: 0.3, lmax: 0.9 });
  burst(x, y, n / 2, { colors: ['#2a1a14', '#3d2a20', '#1a100c'], g: -60, min: 20, max: 120 * big, smin: 8, smax: 18 * big, drag: 1.5, lmin: 0.8, lmax: 1.6, shape: 'smoke' });
}
function updateParts(dt) {
  const P = G.parts;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.life -= dt;
    if (p.life <= 0) { P.splice(i, 1); continue; }
    p.vy += p.g * dt; if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    if (p.ground && p.y > GROUND_Y && groundAt(p.x)) { p.y = GROUND_Y; p.vy *= -0.3; p.vx *= 0.6; }
  }
}
function drawParts(c) {
  for (const p of G.parts) {
    const k = p.life / p.max;
    c.globalAlpha = p.shape === 'smoke' ? k * 0.55 : Math.min(1, k * 1.6);
    c.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
    c.fillStyle = p.color;
    const s = p.shape === 'smoke' ? p.size * (2 - k) : p.size * (p.add ? k + 0.3 : 1);
    if (p.shape === 'shard') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-s, -s / 3, s * 2, s / 1.5); c.restore(); }
    else { c.beginPath(); c.arc(p.x, p.y, s, 0, 6.283); c.fill(); }
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}

/* ===== World collision ===== */
function groundAt(x) {
  const L = G.level; if (!L) return true;
  for (const s of L.ground) if (x >= s.x && x <= s.x + s.w) return true;
  return false;
}
function collideWorld(e, prevY) {
  e.ground = false; e.onPlat = false;
  if (e.y >= GROUND_Y && prevY <= GROUND_Y + 2 && groundAt(e.x)) { e.y = GROUND_Y; e.vy = 0; e.ground = true; return; }
  if (e.vy >= 0 && !(e.dropT > 0) && G.level) {
    for (const p of G.level.plats) {
      if (e.x >= p.x && e.x <= p.x + p.w && prevY <= p.y + 1 && e.y >= p.y) { e.y = p.y; e.vy = 0; e.ground = true; e.onPlat = true; return; }
    }
  }
}

/* ===== Player ===== */
const WEAPONS = {
  arrow: { cd: 0.17, speed: 1000, dmg: 1, ta: 'அம்பு', en: 'Arrow', col: '#f3e2b8' },
  fire: { cd: 0.3, speed: 820, dmg: 1, spread: true, ta: 'நெருப்பு அம்பு', en: 'Fire Arrows', col: '#ff8a2a' },
  vel: { cd: 0.4, speed: 1250, dmg: 4, pierce: true, ta: 'வேல்', en: 'Vel Spear', col: '#ffe08a' },
  chakra: { cd: 0.075, speed: 900, dmg: 1, ta: 'சக்கரம்', en: 'Chakra', col: '#9fe3ff' }
};
const PNAMES = [{ ta: 'வீரமாறன்', en: 'Veeramaaran' }, { ta: 'செங்கன்', en: 'Sengan' }];

class Player {
  constructor(i) {
    this.i = i; this.lives = 5; this.score = 0; this.out = false;
    this.reset(120 + i * 70);
  }
  reset(x) {
    this.x = x; this.y = GROUND_Y - 260; this.vx = 0; this.vy = 0; this.w = 24;
    this.face = 1; this.ground = false; this.inv = 2.5; this.dead = 0; this.weapon = this.weapon || 'arrow';
    this.cd = 0; this.phase = 0; this.aim = { x: 1, y: 0 }; this.crouch = false; this.dropT = 0; this.shootT = 0; this.spin = 0; this.fly = this.fly || 0;
  }
  get hb() {
    const fl = this.fly > 0;
    const h = this.crouch ? 34 : (this.ground || fl ? 64 : 40);
    return { x: this.x - this.w / 2, y: this.y - h - (this.ground || fl ? 0 : 12), w: this.w, h };
  }
  update(dt) {
    if (this.out) return;
    if (this.dead > 0) {
      this.dead -= dt; this.vy += 1600 * dt; this.y = Math.min(this.y + this.vy * dt, GROUND_Y); this.x -= this.face * 120 * dt * (this.y < GROUND_Y ? 1 : 0);
      if (this.dead <= 0) { if (this.lives > 0) this.reset(G.cam + 140); else this.out = true; }
      return;
    }
    const inp = readInput(this.i);
    this.inv -= dt; this.dropT -= dt; this.shootT -= dt; this.cd -= dt;
    const mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    this.crouch = this.ground && inp.down && !mx;
    if (mx) this.face = mx;
    this.vx = this.crouch ? 0 : mx * 255;
    let ax = 0, ay = 0;
    if (inp.up) { ay = -1; ax = mx; }
    else if (inp.down && (!this.ground || mx)) { ay = 1; ax = mx; }
    if (!ax && !ay) ax = this.face;
    const l = Math.hypot(ax, ay); this.aim = { x: ax / l, y: ay / l };
    if (inp.jumpP && this.ground) {
      if (inp.down && this.onPlat) { this.dropT = 0.25; this.ground = false; this.y += 3; }
      else { this.vy = -770; this.ground = false; AUDIO.sfx('jump'); burst(this.x, this.y, 6, { colors: ['#6a4a30', '#8a6a48'], g: 300, min: 20, max: 90, lmax: 0.4 }); }
    }
    if (this.fly > 0) {
      this.fly -= dt;
      if (inp.jump) { this.vy = Math.max(this.vy - 3400 * dt, -430); if (Math.random() < 0.6) part({ x: this.x + rand(-10, 10), y: this.y - 10, vx: rand(-30, 30), vy: rand(80, 200), life: 0.4, max: 0.4, size: rand(2, 4), color: '#cfefff', add: true, g: 0 }); }
      if (this.fly <= 0) G.banner = { ta: 'சிறகு மறைந்தது', en: 'Wings faded', t: 1.4, small: true };
    }
    this.vy = Math.min(this.vy + 2000 * dt, this.fly > 0 && !inp.down ? 420 : 1300);
    if (this.fly > 0 && this.y < 115) { this.y = 115; this.vy = Math.max(this.vy, 0); }
    this.x += this.vx * dt;
    const py = this.y; this.y += this.vy * dt;
    collideWorld(this, py);
    if (G.boss && G.boss.block) this.x = Math.min(this.x, G.boss.block() - 14);
    this.x = clamp(this.x, G.cam + 16, G.cam + W - 16);
    if (this.ground && mx) this.phase += dt * 13; else if (this.ground) this.phase = 0;
    if (!this.ground && !(this.fly > 0)) this.spin += dt * 16 * this.face;
    if (this.y > H + 60) this.hurt(true);
    if (inp.fire && this.cd <= 0) this.shoot();
  }
  muzzle() {
    const by = this.crouch ? 28 : this.ground || this.fly > 0 ? 48 : 34;
    return { x: this.x + this.aim.x * 30, y: this.y - by + this.aim.y * 24 };
  }
  shoot() {
    const w = WEAPONS[this.weapon], lv = this.wlvl || 1; this.cd = w.cd * (1 - 0.15 * (lv - 1)); this.shootT = 0.12;
    const m = this.muzzle(), base = Math.atan2(this.aim.y, this.aim.x);
    const spreads = w.spread ? (lv >= 3 ? [-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36] : [-0.24, -0.12, 0, 0.12, 0.24]) : lv >= 2 && !w.pierce ? [-0.05, 0.05] : [0];
    for (const da of spreads) {
      const a = base + da;
      G.shots.push({ x: m.x, y: m.y, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, dmg: w.dmg * (1 + 0.5 * (lv - 1)), pierce: !!w.pierce, kind: this.weapon, life: 1.1, owner: this, hit: new Set(), rot: 0 });
    }
    AUDIO.sfx(this.weapon === 'vel' ? 'vel' : this.weapon === 'fire' ? 'fire' : 'shoot');
  }
  hurt(pit) {
    if (this.dead > 0 || this.out) return;
    if (!pit && this.inv > 0) return;
    this.lives--; this.fly = 0; this.dead = 1.5; this.vy = -500; this.weapon = 'arrow'; this.wlvl = 1; this.inv = 0;
    bloodBurst(this.x, this.y - 40, -this.face, 30); AUDIO.sfx('hurt'); G.shake = 12;
    if (pit) { this.dead = 0.6; this.vy = 0; this.y = H + 100; }
  }
  draw(c) {
    if (this.out) return;
    if (this.inv > 0 && this.dead <= 0 && Math.floor(G.t * 20) % 2) c.globalAlpha = 0.45;
    const st = this.dead > 0 ? 'dead' : !this.ground ? (this.fly > 0 ? 'idle' : 'roll') : this.crouch ? 'crouch' : this.vx ? 'run' : 'idle';
    if (this.fly > 0 && this.dead <= 0) drawWings(c, this.x, this.y, G.t, this.face, this.fly);
    drawWarrior(c, this.x, this.y, {
      face: this.face, phase: this.phase, state: st, aim: this.aim, spin: this.spin, pal: this.i ? PAL.p2 : PAL.hero,
      weapon: 'bow', drawn: this.shootT > 0, deadT: 1.5 - this.dead, hero: true
    });
    c.globalAlpha = 1;
  }
}
