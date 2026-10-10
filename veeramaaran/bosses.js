'use strict';
/* ===== Bosses ===== */
function baseBoss(o) {
  return Object.assign({
    t: 0, stT: 0, flash: 0, phase: 0, n: 0, face: -1, vx: 0, vy: 0,
    go(st, T) { this.st = st; this.stT = T || 0; this.n = 0; this.attack = 0; },
    damage(d) { this.hp -= d; this.flash = 0.07; },
    body() { return this.boxes(); }
  }, o);
}
function groundWave(x, dir, speed = 430) { eshoot(x, GROUND_Y, dir * speed, 0, 'wave', { life: 2.4, box: 'wave' }); }

/* 1 · Karunagan, raider chief */
function bossChief() {
  const AL = G.cam, AR = G.cam + W;
  return baseBoss({
    name: { ta: 'கருநாகன் · கொள்ளைத் தலைவன்', en: 'Karunagan, the Raider Chief' }, hp: 70,
    x: AR - 170, y: GROUND_Y, st: 'intro', stT: 1.4,
    update(dt) {
      this.t += dt; this.stT -= dt; this.flash -= dt;
      const p = nearestPlayer(this.x) || { x: AL + 200, y: GROUND_Y };
      const rage = this.hp < this.max * 0.45 ? 1.35 : 1;
      if (this.st !== 'leap') this.face = p.x < this.x ? -1 : 1;
      if (this.st === 'intro') { if (this.stT <= 0) { AUDIO.sfx('roar'); G.shake = 10; this.go('walk', 1.2); } }
      else if (this.st === 'walk') {
        this.x += this.face * 120 * rage * dt; this.phase += dt * 8;
        if (this.stT <= 0) this.go(Math.random() < 0.5 ? 'throw' : 'leap', 1.4);
        if (this.st === 'leap') { this.vy = -950; this.vx = clamp((p.x - this.x) / 0.95, -520, 520); AUDIO.sfx('jump'); }
      } else if (this.st === 'throw') {
        this.attack = Math.min(1, this.attack + dt * 5);
        const due = 1.1 - this.n * 0.38;
        if (this.n < 3 && this.stT < due) {
          this.n++; this.attack = 0;
          lob(this.x + this.face * 30, this.y - 120, p.x + rand(-60, 60), GROUND_Y - 30, 0.85 / rage, 1100, 'axe');
          AUDIO.sfx('shoot');
        }
        if (this.stT <= 0) this.go('walk', 0.9);
      } else if (this.st === 'leap') {
        this.vy += 2000 * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.phase += dt * 10;
        if (this.y >= GROUND_Y && this.vy > 0) {
          this.y = GROUND_Y; G.shake = 16; AUDIO.sfx('boom');
          burst(this.x, GROUND_Y, 30, { colors: ['#6a4a30', '#3a2a1e', '#ffb066'], g: 700, min: 100, max: 400, vy: -200 });
          groundWave(this.x - 40, -1); groundWave(this.x + 40, 1);
          this.go('walk', 1.0);
        }
      }
      this.x = clamp(this.x, AL + 60, AR - 60);
    },
    boxes() { return [{ x: this.x - 26, y: this.y - 122, w: 52, h: 122 }]; },
    draw(c) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.3 + Math.sin(this.t * 5) * 0.1;
      const g = c.createRadialGradient(this.x, this.y - 60, 10, this.x, this.y - 60, 120); g.addColorStop(0, '#ff5a14'); g.addColorStop(1, 'rgba(255,40,0,0)');
      c.fillStyle = g; c.fillRect(this.x - 120, this.y - 180, 240, 200); c.restore();
      drawWarrior(c, this.x, this.y, { scale: 1.9, face: this.face, phase: this.phase, state: this.st === 'walk' ? 'run' : 'idle', pal: PAL.bandit, weapon: 'axe', attack: this.st === 'throw' ? this.attack : 0, flash: this.flash });
    }
  });
}

/* 2 · Pirate war-ship */
function bossShip() {
  const AL = G.cam, AR = G.cam + W, xL = AR - 330, deck = 300;
  const parts = [
    { k: 'cat', x: xL + 70, hp: 26, cool: 1.2 },
    { k: 'cap', x: xL + 178, hp: 40, cool: 2.2 },
    { k: 'cat', x: xL + 272, hp: 26, cool: 2.6 }
  ];
  const b = baseBoss({
    name: { ta: 'கடற்கொள்ளை மரக்கலம்', en: 'The Corsair War-Ship' }, hp: 92, parts, xL, deck, spawnT: 3,
    bob() { return Math.sin(this.t * 1.4) * 4; },
    update(dt) {
      this.t += dt; this.flash -= dt; this.spawnT -= dt;
      const dy = this.bob();
      for (const q of parts) {
        q.flash = (q.flash || 0) - dt;
        if (q.hp <= 0) { if (Math.random() < 0.3) part({ x: q.x + rand(-20, 20), y: deck + dy - 20, vx: rand(-20, 20), vy: rand(-90, -40), life: 1, max: 1, size: rand(8, 14), color: '#2a1a14', shape: 'smoke', g: -30 }); continue; }
        q.cool -= dt;
        const p = nearestPlayer(q.x, deck); if (!p || q.cool > 0) continue;
        if (q.k === 'cat') { q.cool = rand(2.0, 2.8); q.arm = 1; lob(q.x - 30, deck + dy - 70, p.x + rand(-40, 40), GROUND_Y, 1.3, 700, 'pot'); AUDIO.sfx('fire'); }
        else { q.cool = 1.3; q.attack = 0.01; const a = Math.atan2(p.y - 40 - (deck - 90), p.x - q.x); eshoot(q.x, deck + dy - 90, Math.cos(a) * 520, Math.sin(a) * 520, 'javelin'); AUDIO.sfx('shoot'); }
      }
      for (const q of parts) { q.arm = Math.max(0, (q.arm || 0) - dt * 2); if (q.attack) q.attack = Math.min(1, q.attack + dt * 4); }
      if (this.spawnT <= 0 && G.enemies.length < 6) { this.spawnT = rand(2.6, 3.8); spawnEnemy('soldier', xL + 10, deck, { dir: -1 }); }
      this.hp = parts.reduce((s, q) => s + Math.max(0, q.hp), 0);
    },
    block() { return xL - 10; },
    boxes() {
      const dy = this.bob();
      return parts.map(q => q.hp <= 0 ? null : q.k === 'cat' ? { x: q.x - 34, y: deck + dy - 64, w: 68, h: 64 } : { x: q.x - 20, y: deck + dy - 96, w: 40, h: 96 });
    },
    body() { return []; },
    damage(d, i) { const q = parts[i]; if (!q || q.hp <= 0) return; q.hp -= d; q.flash = 0.07; if (q.hp <= 0) { fireBurst(q.x, deck - 30, 60, 1.6); AUDIO.sfx('boom'); G.shake = 14; } },
    draw(c) {
      const dy = this.bob(), d = deck + dy;
      // mast and sail
      const mx = xL + 178;
      c.fillStyle = '#1a0c06'; c.fillRect(mx - 5, d - 300, 10, 300);
      c.strokeStyle = 'rgba(30,14,6,.9)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(mx, d - 300); c.lineTo(xL - 40, d - 40); c.moveTo(mx, d - 300); c.lineTo(AR + 40, d - 10); c.stroke();
      const sw = Math.sin(this.t * 2) * 8;
      const sg = c.createLinearGradient(mx - 90, 0, mx + 90, 0); sg.addColorStop(0, '#5a120c'); sg.addColorStop(0.5, '#9a2416'); sg.addColorStop(1, '#4a0e08');
      c.fillStyle = sg; c.beginPath(); c.moveTo(mx - 90, d - 280); c.lineTo(mx + 90, d - 280); c.quadraticCurveTo(mx + 100 + sw, d - 190, mx + 84, d - 110); c.lineTo(mx - 84, d - 110); c.quadraticCurveTo(mx - 70 + sw, d - 190, mx - 90, d - 280); c.fill();
      c.fillStyle = '#1a0c06'; c.fillRect(mx - 96, d - 284, 192, 6); c.fillRect(mx - 90, d - 112, 180, 5);
      c.strokeStyle = '#e8b33a'; c.lineWidth = 3; c.beginPath(); c.arc(mx, d - 195, 26, 0, 6.283); c.stroke(); // sun emblem
      for (let i = 0; i < 12; i++) { const a = i * 0.5236; seg(c, mx + Math.cos(a) * 32, d - 195 + Math.sin(a) * 32, mx + Math.cos(a) * 42, d - 195 + Math.sin(a) * 42, 3, '#e8b33a'); }
      // hull
      const hg = c.createLinearGradient(0, d, 0, GROUND_Y + 60); hg.addColorStop(0, '#5a3418'); hg.addColorStop(0.4, '#3a200e'); hg.addColorStop(1, '#120804');
      c.fillStyle = hg; c.beginPath();
      c.moveTo(xL - 70, d - 70); c.quadraticCurveTo(xL - 40, d - 10, xL - 10, d); c.lineTo(AR + 220, d);
      c.lineTo(AR + 200, GROUND_Y + 70); c.lineTo(xL + 60, GROUND_Y + 70); c.quadraticCurveTo(xL - 20, GROUND_Y - 20, xL - 10, d + 10); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 2;
      for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(xL + i * 6, d + i * 30); c.lineTo(AR + 220, d + i * 30); c.stroke(); }
      c.fillStyle = 'rgba(255,170,90,.4)'; c.fillRect(xL - 10, d, AR + 230 - xL, 2);
      // painted eye on the prow
      c.fillStyle = '#efe2c4'; c.beginPath(); c.ellipse(xL + 30, d + 40, 18, 9, 0, 0, 6.283); c.fill();
      c.fillStyle = '#7a0d0a'; c.beginPath(); c.arc(xL + 26, d + 40, 6, 0, 6.283); c.fill();
      // shields along rail
      for (let x = xL + 10; x < AR + 200; x += 46) { c.fillStyle = '#2a1408'; c.beginPath(); c.arc(x, d + 6, 13, 0, 6.283); c.fill(); c.fillStyle = (x / 46 | 0) % 2 ? '#8a1a10' : '#c9a23a'; c.beginPath(); c.arc(x, d + 6, 9, 0, 6.283); c.fill(); }
      // parts
      for (const q of parts) {
        if (q.hp <= 0) { drawFlame(c, q.x, d, 34, G.t, q.x); continue; }
        if (q.k === 'cat') ETYPES.catapult.draw(c, { x: q.x, y: d, flash: q.flash, arm: q.arm || 0, cool: q.cool });
        else drawWarrior(c, q.x, d, { scale: 1.45, face: -1, state: 'idle', pal: PAL.pirate, weapon: 'spear', attack: q.attack, flash: q.flash });
      }
    }
  });
  b.max = b.hp; return b;
}

/* 3 · War elephant of the Kaarmalai king */
function drawElephant(c, x, y, ph, rear, flash, t) {
  c.save(); c.translate(x, y);
  if (flash > 0) c.filter = 'brightness(2.2)';
  c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(0, 2, 150, 10, 0, 0, 6.283); c.fill();
  c.translate(110, 0); c.rotate(rear * 0.32); c.translate(-110, 0);
  const legs = [[-90, 0], [-50, Math.PI], [60, Math.PI * 0.5], [100, Math.PI * 1.5]];
  const skin = '#3a3438', dark = '#1e1a1e';
  legs.forEach(([lx, o], i) => {
    const s = Math.sin(ph + o) * 12 * (rear ? 0.2 : 1);
    c.fillStyle = i % 2 ? dark : skin; c.beginPath();
    c.moveTo(lx - 20, -100); c.lineTo(lx + 20, -100); c.lineTo(lx + 18 + s, -6); c.lineTo(lx - 18 + s, -6); c.fill();
    c.fillStyle = '#e8b33a'; c.fillRect(lx - 19 + s, -22, 38, 6);
    c.fillStyle = '#1a1416'; c.fillRect(lx - 20 + s, -6, 40, 6);
  });
  // body
  const bg = c.createLinearGradient(0, -210, 0, -80); bg.addColorStop(0, '#5a5258'); bg.addColorStop(1, '#262024');
  c.fillStyle = bg; c.beginPath(); c.ellipse(10, -140, 130, 72, 0, 0, 6.283); c.fill();
  // caparison
  c.fillStyle = '#7a1410'; c.beginPath(); c.moveTo(-70, -196); c.lineTo(90, -196); c.lineTo(110, -100); c.lineTo(-90, -100); c.fill();
  c.fillStyle = '#e8b33a'; c.fillRect(-90, -106, 200, 6);
  for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(-86 + i * 22, -100); c.lineTo(-76 + i * 22, -86); c.lineTo(-66 + i * 22, -100); c.fill(); }
  c.strokeStyle = '#e8b33a'; c.lineWidth = 2; c.beginPath(); c.arc(10, -150, 22, 0, 6.283); c.stroke();
  // head
  c.fillStyle = skin; c.beginPath(); c.ellipse(-120, -150, 52, 58, -0.2, 0, 6.283); c.fill();
  c.fillStyle = dark; c.beginPath(); c.ellipse(-92, -150, 34, 50, 0.2, 0, 6.283); c.fill(); // ear
  c.fillStyle = '#8a1a10'; c.beginPath(); c.moveTo(-160, -205); c.lineTo(-96, -200); c.lineTo(-110, -150); c.lineTo(-165, -160); c.fill(); // head plate
  c.fillStyle = '#e8b33a'; c.beginPath(); c.arc(-132, -180, 7, 0, 6.283); c.fill();
  // trunk
  const tw = Math.sin(t * 2.2) * 0.3 - rear * 0.9;
  c.strokeStyle = skin; c.lineCap = 'round'; c.lineWidth = 26; c.beginPath(); c.moveTo(-150, -130);
  c.quadraticCurveTo(-178 + tw * 30, -70, -168 + tw * 60, -20 - rear * 80); c.stroke();
  c.lineWidth = 2; c.strokeStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(-160 + tw * 8 * i / 6, -110 + i * 14, 10, 0.2, 2.6); c.stroke(); }
  // tusk
  c.fillStyle = '#efe2c4'; c.beginPath(); c.moveTo(-146, -118); c.quadraticCurveTo(-196, -96, -206, -132); c.quadraticCurveTo(-190, -106, -142, -128); c.fill();
  c.fillStyle = '#e8b33a'; c.fillRect(-206, -136, 8, 8);
  c.fillStyle = '#ff6a2a'; c.beginPath(); c.arc(-130, -160, 3.5, 0, 6.283); c.fill();
  // howdah
  c.fillStyle = '#2a1408'; c.fillRect(-40, -236, 90, 44);
  c.fillStyle = '#c9a23a'; c.fillRect(-44, -240, 98, 6); c.fillRect(-44, -196, 98, 5);
  for (let i = 0; i < 5; i++) c.fillRect(-38 + i * 20, -234, 4, 38);
  c.restore();
}
function bossElephant() {
  const AL = G.cam, AR = G.cam + W, home = AR - 190;
  return baseBoss({
    name: { ta: 'கார்மலை மன்னனின் போர் யானை', en: "The King of Kaarmalai's War Elephant" }, hp: 130,
    x: AR + 220, y: GROUND_Y, st: 'enter', rear: 0,
    update(dt) {
      this.t += dt; this.stT -= dt; this.flash -= dt;
      const p = nearestPlayer(this.x) || { x: AL + 200 };
      if (this.st === 'enter') { this.x -= 160 * dt; this.phase += dt * 5; if (this.x <= home) { this.x = home; AUDIO.sfx('roar'); G.shake = 12; this.go('trumpet', 1.1); } }
      else if (this.st === 'trumpet') { this.rear = Math.sin((1.1 - this.stT) / 1.1 * Math.PI) * 0.6; if (this.stT <= 0) { this.rear = 0; this.go(Math.random() < 0.6 ? 'charge' : 'volley', 2.2); } }
      else if (this.st === 'charge') {
        this.x -= 440 * dt; this.phase += dt * 11;
        if (Math.random() < 0.6) part({ x: this.x + rand(-100, 120), y: GROUND_Y - 4, vx: rand(40, 120), vy: rand(-80, -20), life: 0.8, max: 0.8, size: rand(8, 16), color: '#4a3424', shape: 'smoke', g: -10 });
        if (this.x <= AL + 330) { this.x = AL + 330; this.go('stomp', 1.0); AUDIO.sfx('roar'); }
      } else if (this.st === 'stomp') {
        const k = 1 - this.stT;
        this.rear = k < 0.6 ? Math.sin(k / 0.6 * Math.PI / 2) * 0.9 : Math.max(0, 0.9 - (k - 0.6) * 9);
        if (k >= 0.66 && !this.n) { this.n = 1; G.shake = 18; AUDIO.sfx('boom'); groundWave(this.x - 150, -1, 400); groundWave(this.x + 140, 1, 400); burst(this.x - 120, GROUND_Y, 30, { colors: ['#5a4030', '#3a2a1e'], g: 700, min: 80, max: 380, vy: -200 }); }
        if (this.stT <= 0) { this.rear = 0; this.go('volley', 2.2); }
      } else if (this.st === 'volley') {
        if (this.n < 3 && this.stT < 2.0 - this.n * 0.6) {
          this.n++; AUDIO.sfx('shoot');
          for (let i = -1; i <= 1; i++) lob(this.x + 5, this.y - 250, p.x + i * 70, GROUND_Y - 20, 1.0, 800, 'arrow', { burning: true });
        }
        if (this.stT <= 0) this.go(this.x < home - 10 ? 'back' : 'trumpet', 1.1);
      } else if (this.st === 'back') { this.x += 170 * dt; this.phase += dt * 5; if (this.x >= home) { this.x = home; this.go('trumpet', 1.0); } }
    },
    boxes() { return [{ x: this.x - 180, y: this.y - 215, w: 80, h: 120 }, { x: this.x - 40, y: this.y - 300, w: 90, h: 100 }]; },
    body() { return [{ x: this.x - 170, y: this.y - 200, w: 290, h: 200 }]; },
    draw(c) {
      drawElephant(c, this.x, this.y, this.phase, this.rear, this.flash, this.t);
      // king + archer in howdah (follow rear tilt roughly)
      const hy = this.y - 236 - this.rear * 40, hx = this.x + 5 + this.rear * 10;
      drawWarrior(c, hx + 22, hy, { scale: 1.0, face: -1, state: 'idle', pal: PAL.soldier, weapon: 'bow', drawn: this.st === 'volley' && this.stT % 0.6 > 0.45 });
      drawWarrior(c, hx - 14, hy, { scale: 1.15, face: -1, state: 'idle', pal: PAL.dark, weapon: 'sword', flash: this.flash });
      c.fillStyle = '#e8b33a'; c.beginPath(); c.moveTo(hx - 22, hy - 80); c.lineTo(hx - 18, hy - 92); c.lineTo(hx - 12, hy - 84); c.lineTo(hx - 6, hy - 92); c.lineTo(hx - 3, hy - 80); c.fill();
    }
  });
}

/* 4 · Irulmannan, emperor of the dark north */
function drawHorse(c, x, y, ph, dir) {
  c.save(); c.translate(x, y); c.scale(dir, 1);
  const col = '#1a1012';
  c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = 7;
  [[-28, 0], [-20, 2.4], [24, 1.2], [32, 3.6]].forEach(([lx, o]) => {
    const a = Math.sin(ph + o) * 0.8;
    const kx = lx + Math.sin(a) * 22, ky = -56 + Math.cos(a) * 22;
    c.beginPath(); c.moveTo(lx, -64); c.lineTo(kx, ky); c.lineTo(kx + Math.sin(a - 0.8) * 22, Math.min(-2, ky + Math.cos(a - 0.8) * 22)); c.stroke();
  });
  c.fillStyle = col; c.beginPath(); c.ellipse(0, -72, 44, 20, 0, 0, 6.283); c.fill();
  c.beginPath(); c.moveTo(28, -84); c.lineTo(50, -122); c.lineTo(64, -116); c.lineTo(44, -72); c.fill();
  c.beginPath(); c.ellipse(64, -118, 18, 9, 0.5, 0, 6.283); c.fill();
  c.fillStyle = '#5a1010'; c.beginPath(); c.moveTo(30, -88); c.lineTo(50, -126); c.lineTo(42, -96); c.fill();
  c.fillStyle = '#ff5a2a'; c.fillRect(64, -122, 3, 2);
  c.strokeStyle = col; c.lineWidth = 5; c.beginPath(); c.moveTo(-42, -76); c.quadraticCurveTo(-64, -70 + Math.sin(ph) * 6, -70, -46); c.stroke();
  c.fillStyle = '#c9a23a'; c.fillRect(-10, -92, 26, 5);
  c.fillStyle = 'rgba(255,120,60,.3)'; c.beginPath(); c.ellipse(0, -88, 34, 4, 0, 0, 6.283); c.fill();
  c.restore();
}
function bossEmperor() {
  const AL = G.cam, AR = G.cam + W;
  return baseBoss({
    name: { ta: 'இருள்மன்னன் · வடபுலப் பேரரசன்', en: 'Irulmannan, Emperor of the Dark North' }, hp: 220,
    x: AR + 320, y: GROUND_Y, st: 'ride', side: 1, dir: -1, wheel: 0, marks: [], p2: false,
    target() { return this.side === 1 ? AR - 170 : AL + 170; },
    update(dt) {
      this.t += dt; this.stT -= dt; this.flash -= dt;
      const p = nearestPlayer(this.x) || { x: AL + 300, y: GROUND_Y };
      // arrow rain markers
      for (const m of this.marks) { m.t -= dt; if (m.t <= 0 && !m.done) { m.done = true; for (let i = 0; i < 3; i++) eshoot(m.x + rand(-14, 14), -30 - i * 40, 0, 950, 'arrow'); } }
      this.marks = this.marks.filter(m => m.t > -1);
      if (!this.p2 && this.hp <= this.max * 0.5) {
        this.p2 = true; this.wreck = { x: this.x, dir: this.dir }; fireBurst(this.x, this.y - 50, 80, 2); AUDIO.sfx('boom'); G.shake = 22; G.flash = 0.6;
        this.x = clamp(this.x, AL + 100, AR - 100); this.y = GROUND_Y; this.go('stalk', 1.4); return;
      }
      if (!this.p2) {
        if (this.st === 'ride') {
          const tx = this.target(); this.x += this.dir * 420 * dt; this.phase += dt * 14; this.wheel += dt * 12 * this.dir;
          if ((this.dir < 0 && this.x <= tx) || (this.dir > 0 && this.x >= tx)) { this.x = tx; this.go('park', 3.0); }
        } else if (this.st === 'park') {
          this.phase += dt * 3;
          if (this.n < 3 && this.stT < 2.6 - this.n * 0.7) { this.n++; this.attack = 0.01; const a = Math.atan2(p.y - 40 - (this.y - 120), p.x - this.x); eshoot(this.x, this.y - 120, Math.cos(a) * 560, Math.sin(a) * 560, 'javelin'); AUDIO.sfx('shoot'); }
          if (this.attack) this.attack = Math.min(1, this.attack + dt * 4);
          if (this.stT < 1.8 && !this.rained) { this.rained = true; AUDIO.sfx('warn'); for (let i = 0; i < 6; i++) this.marks.push({ x: AL + 60 + i * (W - 120) / 5 + rand(-30, 30), t: 1.1 }); }
          if (this.stT <= 0) { this.rained = false; this.go('charge', 0.7); AUDIO.sfx('warn'); }
        } else if (this.st === 'charge') {
          this.phase += dt * 18; this.wheel += dt * 18 * this.dir;
          if (this.stT <= 0) { this.x += this.dir * 640 * dt; }
          if (this.x < AL - 380 || this.x > AR + 380) { this.side = -this.side; this.dir = -this.dir; this.go('ride'); }
        }
      } else {
        if (this.st !== 'dash' && this.st !== 'slam') this.face = p.x < this.x ? -1 : 1;
        if (this.st === 'stalk') { this.x += this.face * 130 * dt; this.phase += dt * 9; if (this.stT <= 0) { const r = Math.random(); this.go(r < 0.36 ? 'dash' : r < 0.7 ? 'slash' : 'slam', r < 0.36 ? 0.5 : 1.4); if (this.st === 'slam') { this.vy = -1000; this.vx = clamp((p.x - this.x) / 1.0, -560, 560); } } }
        else if (this.st === 'dash') {
          if (this.stT > 0) { if (Math.random() < 0.5) burst(this.x, this.y - 10, 2, { colors: ['#5a4030', '#3a2a1e'], g: 300, min: 20, max: 90, lmax: 0.4 }); }
          else {
            this.x += this.face * 780 * dt; this.phase += dt * 20;
            if (this.x < AL + 70 || this.x > AR - 70) { this.x = clamp(this.x, AL + 70, AR - 70); this.go('stalk', 0.9); }
          }
        } else if (this.st === 'slash') {
          this.attack = Math.min(1, this.attack + dt * 5);
          if (this.n < 3 && this.stT < 1.2 - this.n * 0.4) { this.n++; this.attack = 0; const tp = nearestPlayer(this.x) || { x: this.x + this.face * 300, y: GROUND_Y }; const a = Math.atan2(tp.y - 40 - (this.y - 110), tp.x - this.x); eshoot(this.x, this.y - 110, Math.cos(a) * 560, Math.sin(a) * 560, 'javelin'); AUDIO.sfx('shoot'); }
          if (this.stT <= 0) this.go('stalk', 1.0);
        } else if (this.st === 'slam') {
          this.vy += 2000 * dt; this.x += this.vx * dt; this.y += this.vy * dt;
          if (this.y >= GROUND_Y && this.vy > 0) { this.y = GROUND_Y; G.shake = 16; AUDIO.sfx('boom'); burst(this.x, GROUND_Y, 30, { colors: ['#6a4a30', '#3a2a1e', '#8a6a48'], g: 700, min: 100, max: 380, vy: -200 }); groundWave(this.x - 30, -1, 470); groundWave(this.x + 30, 1, 470); this.go('stalk', 1.1); }
          this.x = clamp(this.x, AL + 50, AR - 50);
        }
      }
    },
    boxes() { return this.p2 ? [{ x: this.x - 24, y: this.y - 100, w: 48, h: 100 }] : [{ x: this.x - 18, y: this.y - 150, w: 36, h: 90 }]; },
    body() {
      if (this.p2) return this.boxes();
      const hx = this.x + this.dir * 150;
      return [{ x: Math.min(this.x - 60, hx - 80), y: this.y - 120, w: 290, h: 120 }];
    },
    draw(c) {
      for (const m of this.marks) if (!m.done) {
        const a = 0.4 + Math.sin(G.t * 30) * 0.3;
        c.fillStyle = `rgba(255,60,20,${a})`; c.beginPath(); c.ellipse(m.x, GROUND_Y, 26, 6, 0, 0, 6.283); c.fill();
        c.fillStyle = `rgba(255,60,20,${a * 0.25})`; c.fillRect(m.x - 3, 0, 6, GROUND_Y);
      }
      if (this.wreck) { const w = this.wreck; c.fillStyle = '#140a06'; c.save(); c.translate(w.x, GROUND_Y); c.rotate(0.3); c.fillRect(-60, -40, 110, 40); c.restore(); drawFlame(c, w.x, GROUND_Y, 50, G.t, 4); drawFlame(c, w.x + 30, GROUND_Y, 34, G.t, 9); }
      if (this.p2) {
        c.save(); c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(this.x, this.y - 50, 5, this.x, this.y - 50, 110); g.addColorStop(0, 'rgba(120,90,200,.35)'); g.addColorStop(1, 'rgba(60,40,120,0)');
        c.fillStyle = g; c.fillRect(this.x - 110, this.y - 160, 220, 200); c.restore();
        drawWarrior(c, this.x, this.y, { scale: 1.55, face: this.face, phase: this.phase, state: this.st === 'stalk' || this.st === 'dash' ? 'run' : 'idle', pal: PAL.dark, weapon: 'sword', attack: this.attack, flash: this.flash });
        return;
      }
      const d = this.dir, x = this.x, y = this.y;
      drawHorse(c, x + d * 120, y, this.phase, d); drawHorse(c, x + d * 180, y, this.phase + 1.3, d);
      seg(c, x + d * 20, y - 60, x + d * 150, y - 78, 4, '#3a1e0c');
      // chariot box
      c.fillStyle = '#2a1408'; c.fillRect(x - 50, y - 90, 100, 44);
      c.fillStyle = '#c9a23a'; c.fillRect(x - 54, y - 94, 108, 6); c.fillRect(x - 54, y - 50, 108, 4);
      for (let i = 0; i < 4; i++) { c.fillStyle = '#7a1410'; c.fillRect(x - 44 + i * 24, y - 84, 14, 30); }
      // wheel
      c.save(); c.translate(x, y - 34); c.rotate(this.wheel);
      c.strokeStyle = '#1a0c06'; c.lineWidth = 7; c.beginPath(); c.arc(0, 0, 33, 0, 6.283); c.stroke();
      c.strokeStyle = '#c9a23a'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 30, 0, 6.283); c.stroke();
      c.strokeStyle = '#3a1e0c'; c.lineWidth = 3; for (let i = 0; i < 8; i++) { c.rotate(0.785); c.beginPath(); c.moveTo(0, 0); c.lineTo(30, 0); c.stroke(); }
      c.restore();
      // parasol of kingship
      seg(c, x - d * 30, y - 90, x - d * 30, y - 200, 3, '#c9a23a');
      c.fillStyle = '#1a1018'; c.beginPath(); c.moveTo(x - d * 30 - 46, y - 190); c.quadraticCurveTo(x - d * 30, y - 232, x - d * 30 + 46, y - 190); c.fill();
      c.fillStyle = '#c9a23a'; for (let i = -4; i <= 4; i++) c.fillRect(x - d * 30 + i * 11 - 2, y - 192, 4, 8);
      drawWarrior(c, x, y - 88, { scale: 1.25, face: d, state: 'idle', pal: PAL.dark, weapon: 'spear', attack: this.attack, flash: this.flash });
      if (this.st === 'charge' || this.st === 'ride') for (let i = 0; i < 2; i++) part({ x: x - d * 60, y: y - 4, vx: -d * rand(40, 140), vy: rand(-90, -20), life: 0.7, max: 0.7, size: rand(8, 15), color: '#3a2a1e', shape: 'smoke', g: -10 });
    }
  });
}
const BOSSES = [bossChief, bossShip, bossElephant, bossEmperor];
function makeBoss(i) {
  const b = BOSSES[i](); const mult = 1 + 0.5 * (G.nPlayers - 1);
  if (b.parts) { b.parts.forEach(q => q.hp = Math.round(q.hp * mult)); b.hp = b.parts.reduce((s, q) => s + q.hp, 0); }
  else b.hp = Math.round(b.hp * mult);
  b.max = b.hp; return b;
}
