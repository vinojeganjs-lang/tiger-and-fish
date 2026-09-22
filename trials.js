// ---------- trials.js : base co-op scene + Trial I (Drowned Reef), II (Blind Hunters), III (Rope Gorge) ----------

// Flow-level helpers shared by scenes
const Flow = { next: null, send: m => Net.send(m), isHost: () => Net.isHost };

class CoopScene {
  constructor(opts) {
    this.id = opts.id; this.sceneArt = opts.art; this.seed = opts.seed || 1; this.level = opts.level; this.rule = opts.rule; this.amb = opts.amb; this.drone = opts.drone; this.drum = opts.drum;
    this.W = this.level.W; this.t = 0; this.started = false; this.readyMe = false; this.readyOther = false; this.complete = false; this.restarting = false;
    this.me = E.makePlayer(Net.isHost ? 'K' : 'S', 0, 0); this.other = E.makePlayer(Net.isHost ? 'S' : 'K', 0, 0); this.other.tx = null;
    this.K = Net.isHost ? this.me : this.other; this.S = Net.isHost ? this.other : this.me;
    this.meera = { who: 'M', x: 0, y: 0, w: 22, h: 56, face: 1, anim: 'idle', animT: 0 };
    this.netAcc = 0; this.wsAcc = 0; this.script = []; this.scriptT = 0; this.deathFlash = 0; this.endX = this.level.endX;
  }
  enter() {
    this.bg = Art.bg(this.sceneArt, this.seed, this.W);
    this.resetPositions();
    E.cam.x = E.cam.tx = U.clamp(this.me.x - 500, 0, this.W - E.W); E.cam.y = E.cam.ty = 0;
    A.ambience(this.amb); if (this.drone) A.drone(true, this.drone[0], this.drone[1]); if (this.drum) A.drumsStart(this.drum[0], this.drum[1], this.drum[2]); else A.drumsStop();
    E.fadeIn(0.8);
    UI.rules(this.rule.title, this.rule.lines, () => { this.readyMe = true; Net.send({ t: 'ready' }); E.toast(Story.t('ready'), 30); this.tryStart(); });
  }
  exit() { UI.hideRules(); }
  resetPositions() { const sp = this.level.spawn; this.K.x = sp[0].x; this.K.y = sp[0].y; this.S.x = sp[1].x; this.S.y = sp[1].y; for (const p of [this.K, this.S]) { p.vx = p.vy = 0; p.dead = false; p.holding = false; p.onVine = null; p.frozen = false; p.anim = 'idle'; } this.other.tx = null; this.meera.x = sp[0].x - 50; this.meera.y = E.groundY(this.level, this.meera.x) - this.meera.h; this.onReset(); }
  onReset() { }
  tryStart() { if (Net.isHost && this.readyMe && this.readyOther && !this.started) { this.start(); Net.send({ t: 'ev', k: 'start' }); } }
  start() { this.started = true; E.st.toast = null; UI.hideRules(); this.onStart(); }
  onStart() { }
  // scripted dialogue: array of {at, sp, id, dur} or {at, cue}
  playScript(lines) { this.script = lines.slice(); this.scriptT = 0; }
  runScript(dt) { if (!this.script.length) return; this.scriptT += dt; while (this.script.length && this.script[0].at <= this.scriptT) { const L = this.script.shift(); if (L.cue) E.cue(Story.t(L.cue), L.dur); else if (L.fn) L.fn(); else E.say(L.sp, Story.t(L.id), L.dur || 4); } }
  // net
  onMessage(m) {
    if (m.t === 'av') { E.remoteApply(this.other, m); this.other.noise = m.n || 0; this.other.grounded = !!m.g; this.other.rope = m.r == null ? -1 : m.r; }
    else if (m.t === 'ready') { this.readyOther = true; this.tryStart(); }
    else if (m.t === 'ev') {
      if (m.k === 'start') this.start();
      else if (m.k === 'restart') this.doRestart(m.why);
      else if (m.k === 'complete') this.doComplete();
      else if (m.k === 'cue') E.cue(Story.t(m.id), m.dur);
      else if (m.k === 'say') E.say(m.sp, Story.t(m.id), m.dur);
      else if (m.k === 'shake') E.st.shake = m.v;
      else this.onEvent(m);
    }
    else if (m.t === 'ws') this.applyWorld(m);
    else if (m.t === 'act') this.onAct(m);
  }
  onEvent(m) { } applyWorld(m) { } onAct(m) { } packWorld() { return null; }
  bcast(k, data = {}) { const m = Object.assign({ t: 'ev', k }, data); Net.send(m); }
  hostSay(sp, id, dur = 4) { E.say(sp, Story.t(id), dur); this.bcast('say', { sp, id, dur }); }
  hostCue(id, dur = 3.2) { E.cue(Story.t(id), dur); this.bcast('cue', { id, dur }); }
  kill(p, why) { if (!Net.isHost || this.restarting || this.complete) return; p.dead = true; this.restarting = true; A.sfx('death', 0.5); E.st.shake = 1; this.bcast('shake', { v: 1 }); setTimeout(() => { this.bcast('restart', { why }); this.doRestart(why); }, 900); }
  async doRestart(why) { this.restarting = true; A.sfx('death', 0.5); await E.fadeOut(2.5); this.resetPositions(); this.restarting = false; E.fadeIn(1.2); E.say('MEERA', Story.t('restart'), 3.5); }
  hostComplete() { if (!Net.isHost || this.complete) return; this.complete = true; this.bcast('complete'); this.doComplete(); }
  doComplete() { this.complete = true; A.sfx('success', 0.5); this.onComplete(); }
  onComplete() { }
  finish(delay = 4.5) { setTimeout(async () => { await E.fadeOut(0.9); A.drumsStop(); if (Flow.next) Flow.next(); }, delay * 1000); }

  update(dt) {
    this.t += dt;
    if (this.started && !this.restarting && !this.complete) {
      this.me.frozen = false; E.moveBody(this.me, this.level, dt, { input: E.input, speedMul: this.speedMul(this.me) }); this.customMove(dt);
      if (this.me.y > E.H + 80) { if (Net.isHost) this.kill(this.me, 'fall'); else this.me.y = E.H + 80; }
    } else { this.me.frozen = true; this.me.anim = 'idle'; this.me.animT += dt; }
    E.remoteTick(this.other, dt);
    // meera follows the trailing player
    { const trail = Math.min(this.K.x, this.S.x); const tx = trail - 56; const gy = E.groundY(this.level, tx + this.meera.w / 2); const m = this.meera; if (gy < 9000) { const dx = tx - m.x; m.x += dx * Math.min(1, dt * 3); m.face = dx > 2 ? 1 : dx < -2 ? -1 : m.face; m.anim = Math.abs(dx) > 8 ? 'run' : 'idle'; m.y += (gy - m.h - m.y) * Math.min(1, dt * 8); } else { m.anim = 'idle'; } m.animT += dt; }
    this.runScript(dt);
    // camera
    E.cam.tx = U.clamp(this.me.x + this.me.w / 2 - E.W * 0.45, 0, this.W - E.W);
    // networking
    this.netAcc += dt; if (this.netAcc >= 0.05) { this.netAcc = 0; const pk = E.packPlayer(this.me); pk.n = Math.round(this.me.noise * 100) / 100; pk.g = this.me.grounded ? 1 : 0; pk.r = this.me.rope == null ? -1 : this.me.rope; Net.send(pk); }
    if (Net.isHost) { this.hostUpdate(dt); this.wsAcc += dt; if (this.wsAcc >= 0.066) { this.wsAcc = 0; const w = this.packWorld(); if (w) { w.t = 'ws'; Net.send(w); } } if (this.started && !this.complete && !this.restarting && this.K.x > this.endX && this.S.x > this.endX && this.other.tx != null) this.hostComplete(); }
    else this.guestUpdate(dt);
  }
  speedMul(p) { return 1; } customMove(dt) { } hostUpdate(dt) { } guestUpdate(dt) { }

  render(ctx) {
    const cx = E.cam.x, cy = E.cam.y, t = this.t;
    Art.drawLayers(ctx, this.bg, cx, cy, t, false);
    this.renderBack(ctx, cx, cy);
    for (const pl of this.level.platforms) if (!pl.hidden) Art.platform(ctx, pl, this.sceneArt, cx, cy);
    this.renderMid(ctx, cx, cy);
    Art.character(ctx, this.meera, t, cx, cy);
    const order = [this.other, this.me];
    for (const p of order) { if (p.tx === null && p === this.other && !Net.connected) continue; Art.character(ctx, p, t, cx, cy); const nm = Story.t(p.who === 'K' ? 'hud_k' : 'hud_s'); E.label(ctx, nm, p.x - cx + p.w / 2, p.y - cy - 10, { font: '700 10px "Inter", system-ui, sans-serif', color: p.who === 'K' ? '#c9a15c' : '#8fc0c8', alpha: 0.85 }); }
    this.renderFront(ctx, cx, cy);
    Art.drawLayers(ctx, this.bg, cx, cy, t, true);
    this.renderFx(ctx, cx, cy);
    // partner off-screen indicator
    const o = this.other; if (o.tx != null) { const sx = o.x - cx + o.w / 2; if (sx < -10 || sx > E.W + 10) { const ax = U.clamp(sx, 30, E.W - 30); ctx.save(); ctx.fillStyle = o.who === 'K' ? '#c9a15c' : '#8fc0c8'; ctx.beginPath(); if (sx < 0) { ctx.moveTo(ax - 12, o.y - cy + 20); ctx.lineTo(ax + 4, o.y - cy + 8); ctx.lineTo(ax + 4, o.y - cy + 32); } else { ctx.moveTo(ax + 12, o.y - cy + 20); ctx.lineTo(ax - 4, o.y - cy + 8); ctx.lineTo(ax - 4, o.y - cy + 32); } ctx.fill(); ctx.restore(); } }
    Art.vignette(ctx, E.W, E.H, 0.45);
    this.renderHUD(ctx);
    if (!Net.connected && this.started && !Net.S.solo) E.label(ctx, 'Connection lost — waiting for partner…', E.W / 2, 40, { color: '#f0a0a0' });
  }
  renderBack() { } renderMid() { } renderFront() { } renderFx() { } renderHUD() { }
}

// ================= TRIAL I — THE DROWNED REEF =================
const T1_LEVEL = (() => {
  const P = [];
  const add = (x, y, w, h, type = 'rock', extra = {}) => { const pl = Object.assign({ x, y, w, h, type }, extra); P.push(pl); return pl; };
  add(0, 530, 470, 200, 'rock');
  add(478, 612, 162, 18, 'wood', { low: true, oneway: true });
  add(710, 540, 160, 18, 'wood', { oneway: true });
  add(900, 552, 230, 16, 'brace', { oneway: true, disabled: true, braceZone: { x: 830, w: 60 }, tieZone: { x: 1250, w: 130 } });
  add(1130, 552, 92, 18, 'wood', { oneway: true });
  add(1224, 380, 16, 172, 'vine');
  add(1240, 380, 360, 200, 'rock');
  add(1650, 470, 140, 18, 'wood', { oneway: true });
  add(1850, 605, 150, 18, 'wood', { low: true, oneway: true });
  add(2060, 545, 140, 18, 'wood', { oneway: true });
  add(2260, 618, 150, 18, 'wood', { low: true, oneway: true });
  add(2470, 530, 150, 18, 'wood', { oneway: true });
  add(2660, 540, 220, 16, 'brace', { oneway: true, disabled: true, braceZone: { x: 2570, w: 50 }, tieZone: { x: 3060, w: 130 } });
  add(2880, 540, 150, 18, 'wood', { oneway: true });
  add(3034, 400, 16, 140, 'vine');
  add(3050, 400, 340, 200, 'rock');
  add(3450, 490, 140, 18, 'wood', { oneway: true });
  add(3650, 612, 150, 18, 'wood', { low: true, oneway: true });
  add(3860, 540, 500, 200, 'rock');
  return { W: 4360, platforms: P, spawn: [{ x: 120, y: 470 }, { x: 200, y: 470 }], endX: 3960, porter: { x: 4120, y: 480 } };
})();

class Trial1 extends CoopScene {
  constructor() { super({ id: 't1', art: 'reef', seed: 11, level: T1_LEVEL, rule: { title: 'r1_title', lines: 'r1' }, amb: 'storm', drone: [55, 0.4], drum: null }); this.cycle = 0; this.CYCLE = 8.5; this.water = 680; this.porterDone = false; this.braces = this.level.platforms.filter(p => p.type === 'brace');  this.cuedSurge = false; this.cuedGo = false; }
  onReset() { this.cycle = 0; for (const b of this.braces) { b.locked = false; b.disabled = true; } }
  onStart() { this.playScript([{ at: 0.5, sp: 'YAZHINI', id: 'y1', dur: 4 }, { at: 4.8, sp: 'MEERA', id: 'm1', dur: 4.5 }, { at: 9.6, sp: 'KUMARAN', id: 'k1', dur: 3 }, { at: 12.8, sp: 'SELVAM', id: 's1', dur: 3 }]); A.drumsStart(76, 'heart', 0.6); }
  waterLevel() { const c = this.cycle; if (c < 5.2) return 680; if (c < 5.9) return U.lerp(680, 555, U.smooth((c - 5.2) / 0.7)); if (c < 7.6) return 555; return U.lerp(555, 680, U.smooth((c - 7.6) / 0.9)); }
  hostUpdate(dt) {
    if (!this.started || this.restarting || this.complete) return;
    const prev = this.cycle; this.cycle = (this.cycle + dt) % this.CYCLE;
    if (prev < 4.4 && this.cycle >= 4.4) { this.hostCue('c_surge', 2.4); A.sfx('wave', 0.5); this.bcast('sfx', { n: 'wave' }); }
    if (prev < 7.7 && this.cycle >= 7.7) this.hostCue('c_go', 2.2);
    // braces: Kumaran holding in zone & grounded
    for (const b of this.braces) { const z = b.braceZone; const inZone = this.K.grounded && this.K.x + this.K.w / 2 > z.x && this.K.x + this.K.w / 2 < z.x + z.w; const braced = b.locked || (inZone && this.K.holding); if (braced !== !b.disabled) { b.disabled = !braced; if (!braced) A.sfx('creak', 0.5); else A.sfx('thud', 0.5); } }
    // deaths: water
    const wl = this.waterLevel(); for (const p of [this.K, this.S]) { if (p === this.other && p.tx == null) continue; if (p.y + p.h > wl + 6 && p.y + p.h < 900) { A.sfx('splash', 0.5); this.kill(p, 'water'); } }
    // porter kindness
    if (!this.porterDone) { const pr = this.level.porter; for (const p of [this.K, this.S]) { if (Math.abs(p.x - pr.x) < 50 && Math.abs(p.y - pr.y) < 80) { if ((p === this.me && E.input._actEdge) || (p === this.other && this._remoteAct)) { this.porterDone = true; this._remoteAct = false; this.hostSay('MEERA', 'porter_done', 4); Flow.kindness = (Flow.kindness || 0) + 1; A.sfx('cue'); } } } }
    this._remoteAct = false;
  }
  onAct(m) { if (m.k === 'tie') { const b = this.braces[m.i]; if (b && !b.locked) { b.locked = true; A.sfx('rope', 0.5); } } else if (m.k === 'porter') this._remoteAct = true; }
  customMove(dt) {
    // Kumaran (host) brace hold
    if (this.me.who === 'K') { const inZone = this.braces.some(b => this.me.grounded && this.me.x + this.me.w / 2 > b.braceZone.x && this.me.x + this.me.w / 2 < b.braceZone.x + b.braceZone.w); this.me.holding = inZone && E.input.sp; }
    // Selvam (guest) ties the plank from the cliff top
    if (this.me.who === 'S' && E.input._actEdge) { this.braces.forEach((b, i) => { const z = b.tieZone; if (!b.locked && this.me.grounded && this.me.x > z.x && this.me.x < z.x + z.w) { b.locked = true; Net.send({ t: 'act', k: 'tie', i }); A.sfx('rope', 0.5); } }); }
    // porter (either)
    if (!this.porterDone && E.input._actEdge) { const pr = this.level.porter; if (Math.abs(this.me.x - pr.x) < 50) { if (!Net.isHost) Net.send({ t: 'act', k: 'porter' }); } }
    this.me.frozen = false;
  }
  applyWorld(m) { this.cycle = m.c; m.b.forEach((v, i) => { const b = this.braces[i]; if (b) { const was = b.disabled; b.disabled = !(v & 1); b.locked = !!(v & 2); if (was !== b.disabled) A.sfx(b.disabled ? 'creak' : 'thud', 0.5); } }); this.porterDone = !!m.p; }
  onEvent(m) { if (m.k === 'sfx') A.sfx(m.n, 0.5); }
  packWorld() { return { c: Math.round(this.cycle * 100) / 100, b: this.braces.map(b => (b.disabled ? 0 : 1) | (b.locked ? 2 : 0)), p: this.porterDone ? 1 : 0 }; }
  onComplete() { this.hostSay && Net.isHost && this.hostSay('MEERA', 't1_done', 4.5); if (!Net.isHost) { } this.finish(5); }
  renderBack(ctx, cx, cy) {
    // braced planks drawn tilted when disabled
    for (const b of this.braces) { if (b.disabled) { ctx.save(); ctx.translate(b.x - cx, b.y - cy); ctx.rotate(0.42); Art.platform(ctx, { id: b.id + 'tilt', x: 0, y: 0, w: b.w, h: b.h, type: 'wood' }, 'reef', 0, 0); ctx.restore(); b.hidden = true; } else { b.hidden = false; if (b.locked) { ctx.save(); ctx.strokeStyle = '#3d6330'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x + b.w - 10 - cx, b.y - cy); ctx.quadraticCurveTo(b.x + b.w + 40 - cx, b.y - 120 - cy, b.tieZone.x + 10 - cx, b.y - 172 - cy); ctx.stroke(); ctx.restore(); } } }
    // anchor posts at brace zones
    for (const b of this.braces) { const z = b.braceZone; ctx.fillStyle = '#3a2a18'; ctx.fillRect(z.x + z.w / 2 - 5 - cx, b.y - 60 - cy, 10, 70); }
    // porter
    const pr = this.level.porter; Art.character(ctx, { x: pr.x, y: pr.y + 30, w: 24, h: 50, face: -1, anim: 'hold', who: 'P' }, this.t, cx, cy, { dark: '#1a1512', rim: '#8a7a60' });
  }
  renderFront(ctx, cx, cy) { Art.water(ctx, this.t, this.waterLevel() - cy, cx, this.W, 0.86); }
  renderFx(ctx, cx, cy) { Art.rain(ctx, this.t, 1.2, cx, 0.45); Art.fog(ctx, this.t, 'rgba(90,120,130,0.5)', 0.25, 380, 260, cx); Art.flash(ctx, this.t, 3); }
  renderHUD(ctx) {
    const cx = E.cam.x, cy = E.cam.y;
    // surge meter
    const c = this.cycle / this.CYCLE; ctx.save(); ctx.translate(E.W - 230, 24); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(0, 0, 210, 30, 6); ctx.fill(); ctx.fillStyle = '#4a7a88'; ctx.fillRect(8 + 194 * (5.2 / 8.5), 8, 194 * ((7.6 - 5.2) / 8.5), 14); ctx.fillStyle = '#e8e2d6'; ctx.fillRect(8 + c * 194, 5, 3, 20); ctx.font = '700 9px "Inter", system-ui, sans-serif'; ctx.fillStyle = '#9ab'; ctx.letterSpacing = '2px'; ctx.fillText('SEA', 10, 12 + 0); ctx.restore();
    // hints
    if (this.me.who === 'K') for (const b of this.braces) { const z = b.braceZone; const near = Math.abs(this.me.x + this.me.w / 2 - (z.x + z.w / 2)) < 90; if (near) E.keyHint(ctx, z.x + z.w / 2 - cx, b.y - 118 - cy, 'SHIFT', Story.t('brace')); }
    if (this.me.who === 'S') for (const b of this.braces) { const z = b.tieZone; if (!b.locked && this.me.x > z.x - 80 && this.me.x < z.x + z.w + 80) E.keyHint(ctx, z.x + z.w / 2 - cx, 380 - cy - 40, 'E', Story.t('vine_drop')); }
    const pr = this.level.porter; if (!this.porterDone && Math.abs(this.me.x - pr.x) < 120) E.keyHint(ctx, pr.x - cx, pr.y - cy - 20, 'E', Story.t('porter'));
  }
}

// ================= TRIAL II — THE BLIND HUNTERS =================
const T2_LEVEL = (() => {
  const P = []; const add = (x, y, w, h, type = 'rock', extra = {}) => { const pl = Object.assign({ x, y, w, h, type }, extra); P.push(pl); return pl; };
  add(0, 600, 3800, 200, 'rock', { ground: true });
  add(520, 520, 160, 80, 'rock'); add(1180, 500, 200, 100, 'rock'); add(1900, 530, 140, 70, 'rock'); add(2500, 500, 220, 100, 'rock'); add(3100, 525, 160, 75, 'rock');
  const hunters = [{ a: 380, b: 900 }, { a: 1000, b: 1500 }, { a: 1650, b: 2300 }, { a: 2300, b: 2900 }, { a: 2900, b: 3450 }];
  return { W: 3800, platforms: P, spawn: [{ x: 80, y: 540 }, { x: 150, y: 540 }], endX: 3560, hunters };
})();

class Trial2 extends CoopScene {
  constructor() { super({ id: 't2', art: 'forest', seed: 23, level: T2_LEVEL, rule: { title: 'r2_title', lines: 'r2' }, amb: 'forest', drone: [49, 0.25], drum: null }); this.hunters = []; this.stones = []; this.sounds = []; this.cuedListen = false; }
  onReset() { this.hunters = this.level.hunters.map((h, i) => ({ id: i, x: h.a + (h.b - h.a) * 0.5, y: 600, a: h.a, b: h.b, dir: i % 2 ? -1 : 1, state: 'patrol', st: 0, tx: null, face: 1, alert: 0 })); this.stones = []; this.sounds = []; }
  onStart() { this.playScript([{ at: 0.4, sp: 'MEERA', id: 'm2', dur: 5.5 }, { at: 6.2, sp: 'SELVAM', id: 's2', dur: 3 }, { at: 9.5, cue: 'c_listen', dur: 3.5 }]); A.drumsStart(64, 'heart', 0.35); }
  customMove(dt) {
    if (this.me.who === 'S' && E.input._actEdge && this.started && !this.restarting) { const s = { x: this.me.x + this.me.w / 2, y: this.me.y + 20, vx: this.me.face * 420, vy: -300 }; if (Net.isHost) this.spawnStone(s); else { Net.send({ t: 'act', k: 'stone', s }); } A.sfx('whoosh', 0.5); }
  }
  spawnStone(s) { this.stones.push(Object.assign({ id: Math.random(), alive: true }, s)); }
  onAct(m) { if (m.k === 'stone') this.spawnStone(m.s); }
  hostUpdate(dt) {
    if (!this.started || this.restarting || this.complete) return;
    // stones
    for (const s of this.stones) { if (!s.alive) continue; s.vy += 1800 * dt; s.x += s.vx * dt; s.y += s.vy * dt; const gy = E.groundY(this.level, s.x); if (s.y >= gy - 4) { s.alive = false; s.y = gy - 4; this.sounds.push({ x: s.x, y: gy, r: 430, life: 0.4, kind: 'stone' }); A.sfx('stone', 0.5); this.bcast('sfx', { n: 'stone', x: s.x }); } }
    this.stones = this.stones.filter(s => s.alive);
    // player noises
    for (const p of [this.K, this.S]) { if (p === this.other && p.tx == null) continue; if (p.noise > 0.05) this.sounds.push({ x: p.x + p.w / 2, y: p.y + p.h, r: p.noise * 330, life: 0.05, kind: 'player', p }); }
    // hunters
    for (const h of this.hunters) {
      h.st += dt; let heard = null, best = 1e9;
      for (const s of this.sounds) { const d = Math.hypot(s.x - h.x, s.y - h.y); const rr = s.r * (h.state === 'listen' ? 1.6 : 1); if (d < rr && d < best) { best = d; heard = s; } }
      if (heard) { if (heard.kind === 'stone') { h.state = 'investigate'; h.tx = heard.x; h.st = 0; } else if (h.state !== 'investigate' || heard.kind === 'player') { if (h.state !== 'chase') { A.sfx('growl', 0.5); this.bcast('sfx', { n: 'growl', x: h.x }); } h.state = 'chase'; h.tx = heard.x; h.st = 0; } }
      const sp = h.state === 'chase' ? 300 : h.state === 'investigate' ? 190 : 62;
      if (h.state === 'patrol') { h.x += h.dir * sp * dt; if (h.x > h.b) { h.x = h.b; h.dir = -1; } if (h.x < h.a) { h.x = h.a; h.dir = 1; } h.face = h.dir; if (h.st > 3.5 + (h.id % 3)) { h.state = 'listen'; h.st = 0; } }
      else if (h.state === 'listen') { if (h.st > 1.4) { h.state = 'patrol'; h.st = 0; } }
      else if (h.state === 'investigate' || h.state === 'chase') { const dx = h.tx - h.x; if (Math.abs(dx) > 6) { h.x += Math.sign(dx) * sp * dt; h.face = Math.sign(dx); } else { if (h.st > (h.state === 'chase' ? 1.2 : 2.2)) { h.state = 'listen'; h.st = 0; } } if (h.x < 40) h.x = 40; if (h.x > this.W - 40) h.x = this.W - 40; }
      // catch
      for (const p of [this.K, this.S]) { if (p === this.other && p.tx == null) continue; const d = Math.hypot(p.x + p.w / 2 - h.x, p.y + p.h - h.y); if (d < 34 && p.y + p.h > h.y - 50) { this.kill(p, 'caught'); } }
    }
    this.sounds = this.sounds.filter(s => (s.life -= dt) > 0);
    // Meera cues
    const near = this.hunters.find(h => Math.abs(h.x - this.me.x) < 420);
    if (near && near.state === 'listen' && !this.cuedFreeze) { this.cuedFreeze = true; this.hostCue('c_freeze', 1.6); setTimeout(() => this.cuedFreeze = false, 6000); }
    if (near && near.state === 'investigate' && !this.cuedMove) { this.cuedMove = true; this.hostCue('c_move', 2); setTimeout(() => this.cuedMove = false, 7000); }
  }
  guestUpdate(dt) { for (const h of this.hunters) { if (h.gx != null) { h.x += (h.gx - h.x) * Math.min(1, dt * 15); } } for (const s of this.stones) { s.vy += 1800 * dt; s.x += s.vx * dt; s.y += s.vy * dt; } }
  applyWorld(m) { m.h.forEach((v, i) => { const h = this.hunters[i]; if (!h) return; h.gx = v[0]; h.face = v[1]; if (h.state !== v[2]) { h.state = v[2]; } }); const ids = new Set(m.s.map(s => s.i)); this.stones = this.stones.filter(s => ids.has(s.id)); for (const s of m.s) { let st = this.stones.find(q => q.id === s.i); if (!st) { st = { id: s.i, x: s.x, y: s.y, vx: s.vx, vy: s.vy }; this.stones.push(st); } else { st.x = s.x; st.y = s.y; st.vx = s.vx; st.vy = s.vy; } } }
  packWorld() { return { h: this.hunters.map(h => [Math.round(h.x), h.face, h.state]), s: this.stones.map(s => ({ i: s.id, x: Math.round(s.x), y: Math.round(s.y), vx: Math.round(s.vx), vy: Math.round(s.vy) })) }; }
  onEvent(m) { if (m.k === 'sfx') A.sfx(m.n, U.clamp((m.x - E.cam.x) / E.W, 0, 1)); }
  onComplete() { if (Net.isHost) this.hostSay('MEERA', 't2_done', 5); this.finish(5.5); }
  renderMid(ctx, cx, cy) {
    for (const h of this.hunters) Art.hunter(ctx, h, this.t, cx, cy);
    for (const s of this.stones) { ctx.fillStyle = '#c8bca8'; ctx.beginPath(); ctx.arc(s.x - cx, s.y - cy, 4, 0, Math.PI * 2); ctx.fill(); }
    // my noise ring
    const p = this.me; if (p.noise > 0.05) { ctx.save(); ctx.strokeStyle = `rgba(230,220,200,${0.25 * p.noise})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x + p.w / 2 - cx, p.y + p.h - cy, p.noise * 330, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  }
  renderFx(ctx, cx, cy) { Art.shafts(ctx, this.t, cx, '#b99a55'); Art.fog(ctx, this.t, 'rgba(60,90,70,0.6)', 0.35, 420, 300, cx); }
  renderHUD(ctx) { if (this.me.who === 'S') E.keyHint(ctx, E.W - 120, E.H - 40, 'E', Story.t('stone')); const p = this.me; E.label(ctx, p.noise > 0.4 ? 'LOUD' : p.noise > 0.05 ? 'quiet' : 'silent', 80, E.H - 30, { color: p.noise > 0.4 ? '#e07060' : '#9ab', font: '700 12px "Inter", system-ui, sans-serif' }); }
}

// ================= TRIAL III — THE ROPE GORGE =================
const T3_LEVEL = (() => {
  const P = []; const add = (x, y, w, h, type = 'rock', extra = {}) => { const pl = Object.assign({ x, y, w, h, type }, extra); P.push(pl); return pl; };
  add(0, 480, 700, 300, 'rock'); add(1700, 480, 700, 300, 'rock');
  return { W: 2400, platforms: P, spawn: [{ x: 300, y: 420 }, { x: 380, y: 420 }], endX: 1705, ropeA: { x: 660, y: 400 }, ropeB: { x: 1740, y: 400 }, postA: { x: 610, w: 60 }, postB: { x: 1730, w: 60 }, grabA: { x: 640, w: 60 }, grabB: { x: 1700, w: 60 } };
})();

class Trial3 extends CoopScene {
  constructor() { super({ id: 't3', art: 'gorge', seed: 37, level: T3_LEVEL, rule: { title: 'r3_title', lines: 'r3' }, amb: 'sea', drone: [41, 0.6], drum: null }); this.phase = 1; this.T = 0; this.jerk = 0; this.jerkT = 0; this.nextJerk = 3; this.crossing = false; this.s = 0; this.holderOK = false; this.tied = false; this.pullFlash = 0; }
  onReset() { this.phase = 1; this.T = 0; this.jerk = 0; this.nextJerk = 3; this.s = 0; this.crossing = false; this.holderOK = false; this.tied = false; for (const p of [this.K, this.S]) p.rope = -1; }
  onStart() { this.playScript([{ at: 0.4, sp: 'MEERA', id: 'm3', dur: 4.5 }, { at: 5.2, sp: 'KUMARAN', id: 'k3', dur: 3 }, { at: 8.6, cue: 'c_hold', dur: 3 }]); A.drumsStart(70, 'tense', 0.45); }
  holder() { return this.phase === 1 ? this.K : this.S; } crosser() { return this.phase === 1 ? this.S : this.K; }
  holderZone() { return this.phase === 1 ? this.level.postA : this.level.postB; } grabZone() { return this.level.grabA; }
  inZone(p, z) { const cx = p.x + p.w / 2; return p.grounded && cx > z.x && cx < z.x + z.w; }
  ropePoint(s) { const a = this.level.ropeA, b = this.level.ropeB; const sag = 40 + (1 - this.T) * 260; const x = U.lerp(a.x, b.x, s), y = U.lerp(a.y, b.y, s) + Math.sin(s * Math.PI) * sag; return { x, y }; }
  customMove(dt) {
    const me = this.me;
    if (me === this.holder()) {
      const inZ = this.inZone(me, this.holderZone()); me.holding = inZ && E.input.sp;
      if (this.phase === 2 && me.who === 'S' && !this.tied && inZ && E.input._actEdge) { Net.send({ t: 'act', k: 'tie' }); }
      if (me.holding && E.input._jumpEdge) { if (Net.isHost) this.pull(); else Net.send({ t: 'act', k: 'pull' }); }
    }
    if (me === this.crosser()) {
      if (!this.crossing) { me.rope = -1; if (this.inZone(me, this.grabZone()) && E.input._actEdge && (this.phase === 1 || this.tied)) { this.crossing = true; this.s = 0; me.onVine = null; A.sfx('rope', 0.5); if (!Net.isHost) Net.send({ t: 'act', k: 'grab' }); } }
      else {
        // move along rope
        const dir = 1; const taut = this.T >= 0.5; const spd = 0.075 * (me.who === 'K' ? 0.85 : 1);
        if (taut) { if ((dir > 0 && E.input.r) || (dir < 0 && E.input.l)) { this.s += dir * spd * dt; me.anim = 'climb'; me.animT += dt; } else me.anim = 'climb'; }
        else { this.s -= dir * 0.06 * dt; me.anim = 'climb'; }
        this.s = U.clamp(this.s, 0, 1);
        const pt = this.ropePoint(this.s); me.x = pt.x - me.w / 2; me.y = pt.y + 6; me.vx = me.vy = 0; me.frozen = true; me.rope = this.s; me.face = dir;
        if ((dir > 0 && this.s >= 1) || (dir < 0 && this.s <= 0)) { this.crossing = false; me.rope = -1; me.frozen = false; me.y = 480 - me.h - 2; me.x = dir > 0 ? this.level.ropeB.x + 20 : this.level.ropeA.x - 60; A.sfx('land', 0.5); if (!Net.isHost) Net.send({ t: 'act', k: 'landed' }); else this.onLanded(); }
      }
    }
  }
  pull() { if (this.jerk > 0) { this.T = Math.min(1, this.T + 0.32); this.jerk = 0; this.pullFlash = 0.3; A.sfx('rope', 0.5); this.bcast('sfx', { n: 'rope' }); } }
  onLanded() { if (this.phase === 1) { this.phase = 2; this.T = 0; this.crossing = false; this.hostCue('c_tie', 3); } }
  onAct(m) { if (m.k === 'pull') this.pull(); else if (m.k === 'tie') { if (this.phase === 2) { this.tied = true; A.sfx('thud', 0.5); this.hostSay('MEERA', 'c_rope', 3); } } else if (m.k === 'grab') { this.crossing = true; } else if (m.k === 'landed') { this.onLanded(); } }
  hostUpdate(dt) {
    if (!this.started || this.restarting || this.complete) return;
    const holder = this.holder(); const holding = holder === this.me ? this.me.holding : this.other.holding;
    const crosserOn = this.crosser() === this.me ? this.crossing : (this.other.rope >= 0);
    const heavy = this.phase === 2 ? 1.5 : 1;
    if (holding) this.T = Math.min(1, this.T + 0.55 * dt); else this.T = Math.max(0, this.T - (crosserOn ? 0.5 * heavy : 0.35) * dt);
    if (crosserOn) { this.T = Math.max(0, this.T - 0.12 * heavy * dt); this.nextJerk -= dt; if (this.nextJerk <= 0 && this.jerk <= 0) { this.jerk = 0.75; this.nextJerk = 2.2 + Math.random() * 2.2; A.sfx('creak', 0.5); this.bcast('sfx', { n: 'creak' }); E.st.shake = 0.4; this.bcast('shake', { v: 0.4 }); } }
    if (this.jerk > 0) { this.jerk -= dt; if (this.jerk <= 0) { this.T = Math.max(0, this.T - 0.3 * heavy); this.jerk = 0; } }
    if (crosserOn && this.T <= 0.01) { const c = this.crosser(); this.kill(c, 'fall'); }
    this.pullFlash = Math.max(0, this.pullFlash - dt);
  }
  applyWorld(m) { this.T = m.T; this.jerk = m.j; if (this.phase !== m.ph) { this.phase = m.ph; this.crossing = false; this.s = 0; } this.tied = !!m.td; if (this.crosser() === this.other) this.s = m.s; }
  packWorld() { return { T: Math.round(this.T * 1000) / 1000, j: Math.round(this.jerk * 100) / 100, ph: this.phase, td: this.tied ? 1 : 0, s: Math.round((this.crosser() === this.me ? this.s : (this.other.rope >= 0 ? this.other.rope : this.s)) * 1000) / 1000 }; }
  onEvent(m) { if (m.k === 'sfx') A.sfx(m.n, 0.5); }
  onComplete() { if (Net.isHost) this.hostSay('MEERA', 't3_done', 5); this.finish(5.5); }
  update(dt) { super.update(dt); if (!Net.isHost && this.crosser() === this.other && this.other.rope >= 0) { const pt = this.ropePoint(this.other.rope); this.other.x = pt.x - this.other.w / 2; this.other.y = pt.y + 6; this.other.anim = 'climb'; } if (Net.isHost && this.crosser() === this.other && this.other.rope >= 0) { const pt = this.ropePoint(this.other.rope); this.other.x = pt.x - this.other.w / 2; this.other.y = pt.y + 6; this.other.anim = 'climb'; } }
  renderBack(ctx, cx, cy) {
    // mist in gorge
    ctx.save(); const g = ctx.createLinearGradient(0, 520 - cy, 0, 720); g.addColorStop(0, 'rgba(70,85,100,0)'); g.addColorStop(1, 'rgba(70,85,100,0.9)'); ctx.fillStyle = g; ctx.fillRect(700 - cx, 480 - cy, 1000, 300); ctx.restore();
    // posts
    for (const z of [this.level.postA, this.level.postB]) { ctx.fillStyle = '#2a1e12'; ctx.fillRect(z.x + z.w / 2 - 6 - cx, 400 - cy, 12, 80); ctx.fillStyle = '#6b5233'; ctx.fillRect(z.x + z.w / 2 - 6 - cx, 400 - cy, 12, 3); }
    // rope
    const a = this.level.ropeA, b = this.level.ropeB; ctx.save(); ctx.strokeStyle = this.jerk > 0 ? '#c94a3a' : '#b8a070'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x - cx, a.y - cy); for (let s = 0; s <= 1.001; s += 0.04) { const p = this.ropePoint(s); ctx.lineTo(p.x - cx, p.y - cy); } ctx.stroke(); ctx.restore();
  }
  renderFx(ctx, cx, cy) { Art.fog(ctx, this.t, 'rgba(120,140,160,0.5)', 0.3, 300, 400, cx); Art.rain(ctx, this.t, 0.5, cx, 0.2); }
  renderHUD(ctx) {
    const cx = E.cam.x, cy = E.cam.y;
    // tension gauge
    ctx.save(); ctx.translate(E.W / 2 - 160, 26); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.roundRect(0, 0, 320, 34, 6); ctx.fill(); ctx.fillStyle = 'rgba(201,161,92,0.35)'; ctx.fillRect(8 + 304 * 0.5, 6, 304 * 0.5, 22); ctx.fillStyle = this.T >= 0.5 ? '#c9a15c' : '#c94a3a'; ctx.fillRect(8, 10, 304 * this.T, 14); if (this.jerk > 0) { ctx.fillStyle = `rgba(230,70,50,${0.4 + 0.4 * Math.sin(this.t * 30)})`; ctx.fillRect(0, 0, 320, 34); } ctx.fillStyle = '#e8e2d6'; ctx.font = '700 9px "Inter", system-ui, sans-serif'; ctx.letterSpacing = '2px'; ctx.fillText(Story.t('tension'), 10, 8); ctx.restore();
    if (this.jerk > 0 && this.me === this.holder()) E.keyHint(ctx, E.W / 2, 90, 'SPACE', null);
    const me = this.me;
    if (me === this.holder()) { const z = this.holderZone(); if (Math.abs(me.x + me.w / 2 - (z.x + z.w / 2)) < 120) { if (this.phase === 2 && !this.tied) E.keyHint(ctx, z.x + z.w / 2 - cx, 370 - cy, 'E', Story.t('tie')); else E.keyHint(ctx, z.x + z.w / 2 - cx, 370 - cy, 'SHIFT', Story.t('brace')); } }
    if (me === this.crosser() && !this.crossing) { const z = this.grabZone(); if (Math.abs(me.x + me.w / 2 - (z.x + z.w / 2)) < 120 && (this.phase === 1 || this.tied)) E.keyHint(ctx, z.x + z.w / 2 - cx, 370 - cy, 'E', Story.t('grab')); }
    E.label(ctx, this.phase === 1 ? 'PART 1' : 'PART 2', E.W - 60, 40, { color: '#9ab', font: '700 11px "Inter", system-ui, sans-serif' });
  }
}
