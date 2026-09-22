// ---------- engine.js : loop, input, camera, physics, HUD ----------
const E = (() => {
  const W = 1280, H = 720;
  let canvas, ctx, scene = null, last = 0, acc = 0; const FIXED = 1 / 120;
  const st = { t: 0, lang: 'en', fade: 1, fadeTo: 0, fadeSpeed: 1.2, shake: 0, dialog: null, cue: null, toast: null, paused: false, debug: false };
  const input = { l: false, r: false, up: false, down: false, jump: false, act: false, sp: false, _jumpEdge: false, _actEdge: false, _spEdge: false, any: false };
  const keys = {};
  const cam = { x: 0, y: 0, tx: 0, ty: 0 };

  function init(cv) {
    canvas = cv; ctx = cv.getContext('2d'); canvas.width = W; canvas.height = H;
    const map = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'jump', KeyE: 'act', Enter: 'act', ShiftLeft: 'sp', ShiftRight: 'sp', KeyF: 'sp' };
    window.addEventListener('keydown', e => { if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return; const k = map[e.code]; if (k) { if (!keys[e.code]) { if (k === 'jump' || k === 'up') input._jumpEdge = true; if (k === 'act') input._actEdge = true; if (k === 'sp') input._spEdge = true; } keys[e.code] = true; e.preventDefault(); } input.any = true; if (e.code === 'F3') st.debug = !st.debug; if (scene && scene.onKey) scene.onKey(e.code); });
    window.addEventListener('keyup', e => { const k = map[e.code]; if (k) { keys[e.code] = false; } });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
    // touch buttons
    document.querySelectorAll('[data-btn]').forEach(b => { const k = b.dataset.btn; const on = ev => { ev.preventDefault(); if (!keys['T' + k]) { if (k === 'jump') input._jumpEdge = true; if (k === 'act') input._actEdge = true; if (k === 'sp') input._spEdge = true; } keys['T' + k] = true; b.classList.add('on'); input.any = true; }; const off = ev => { ev.preventDefault(); keys['T' + k] = false; b.classList.remove('on'); }; b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off); b.addEventListener('touchcancel', off); b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off); });
    requestAnimationFrame(frame);
  }
  function pollInput() {
    const has = (...codes) => codes.some(c => keys[c]);
    input.l = has('ArrowLeft', 'KeyA', 'Tl'); input.r = has('ArrowRight', 'KeyD', 'Tr'); input.up = has('ArrowUp', 'KeyW', 'Tup'); input.down = has('ArrowDown', 'KeyS', 'Tdown');
    input.jump = has('Space', 'ArrowUp', 'KeyW', 'Tjump'); input.act = has('KeyE', 'Enter', 'Tact'); input.sp = has('ShiftLeft', 'ShiftRight', 'KeyF', 'Tsp');
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    const now = ts / 1000; let dt = Math.min(0.1, now - (last || now)); last = now; st.t += dt;
    pollInput();
    if (scene && !st.paused) { acc += dt; let n = 0; while (acc >= FIXED && n < 12) { scene.update(FIXED); acc -= FIXED; n++; input._jumpEdge = input._actEdge = input._spEdge = false; } }
    // camera smoothing
    cam.x += (cam.tx - cam.x) * Math.min(1, dt * 6); cam.y += (cam.ty - cam.y) * Math.min(1, dt * 6);
    if (st.shake > 0) { st.shake = Math.max(0, st.shake - dt * 2); }
    // fade
    if (st.fade !== st.fadeTo) { const d = Math.sign(st.fadeTo - st.fade) * st.fadeSpeed * dt; st.fade = Math.abs(st.fadeTo - st.fade) <= Math.abs(d) ? st.fadeTo : st.fade + d; }
    if (st.dialog && (st.dialog.until -= dt) <= 0) st.dialog = null;
    if (st.cue && (st.cue.until -= dt) <= 0) st.cue = null;
    if (st.toast && (st.toast.until -= dt) <= 0) st.toast = null;
    ctx.save(); if (st.shake > 0) ctx.translate((Math.random() - 0.5) * 14 * st.shake, (Math.random() - 0.5) * 10 * st.shake);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (scene) scene.render(ctx, dt);
    ctx.restore();
    drawHUD(ctx, dt);
    if (st.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${st.fade})`; ctx.fillRect(0, 0, W, H); }
  }
  function setScene(s) { if (scene && scene.exit) scene.exit(); scene = s; st.dialog = null; st.cue = null; if (s.enter) s.enter(); }
  function fadeOut(speed = 1.2) { st.fadeTo = 1; st.fadeSpeed = speed; return new Promise(r => { const iv = setInterval(() => { if (st.fade >= 1) { clearInterval(iv); r(); } }, 30); }); }
  function fadeIn(speed = 1.2) { st.fadeTo = 0; st.fadeSpeed = speed; }

  // ---- physics ----
  const GRAV = 2000, MOVE = 250, JUMP = 690;
  function makePlayer(who, x, y) { return { who, x, y, w: who === 'K' ? 28 : 24, h: 60, vx: 0, vy: 0, face: 1, anim: 'idle', animT: 0, grounded: false, coyote: 0, jumpBuf: 0, holding: false, climbing: false, onVine: null, dead: false, noise: 0, frozen: false, torch: false, tiger: false, groundPl: null, stepT: 0 }; }
  function moveBody(p, level, dt, opts = {}) {
    if (p.frozen || p.dead) { p.anim = p.dead ? 'dead' : p.anim; p.vx = 0; return; }
    const inp = opts.input; let ax = 0;
    if (inp) { if (inp.l) ax -= 1; if (inp.r) ax += 1; }
    const speedMul = opts.speedMul == null ? 1 : opts.speedMul;
    // vine climbing
    if (p.onVine) {
      p.vx = 0; p.vy = 0; p.anim = 'climb';
      if (inp) { if (inp.up) p.y -= 140 * dt; if (inp.down) p.y += 140 * dt; p.x += (p.onVine.x + p.onVine.w / 2 - p.w / 2 - p.x) * Math.min(1, dt * 10); if (ax) p.animT += dt; if (inp.up || inp.down) p.animT += dt; }
      const v = p.onVine; if (p.y + p.h < v.y || p.y > v.y + v.h) p.onVine = null;
      if (inp && inp._jumpEdge) { p.onVine = null; p.vy = -JUMP * 0.8; p.vx = ax * MOVE; }
      else if (inp && ax && p.y + p.h <= v.y + 10) { p.onVine = null; p.y = v.y - p.h; p.vx = ax * MOVE; p.vy = 0; }
      if (p.onVine && p.y + p.h < v.y) p.y = v.y - p.h;
      if (p.y + p.h > v.y + v.h - 4 && inp && inp.down) { p.onVine = null; }
      p.grounded = false; return;
    }
    if (p.holding) { p.vx = 0; p.anim = 'hold'; ax = 0; }
    const target = ax * MOVE * speedMul; p.vx += (target - p.vx) * Math.min(1, dt * (p.grounded ? 14 : 6));
    if (ax) p.face = ax > 0 ? 1 : -1;
    p.vy += GRAV * dt; if (p.vy > 900) p.vy = 900;
    if (p.grounded) p.coyote = 0.1; else p.coyote -= dt;
    if (inp && inp._jumpEdge) p.jumpBuf = 0.12; else p.jumpBuf -= dt;
    if (p.jumpBuf > 0 && p.coyote > 0 && !p.holding) { p.vy = -JUMP; p.grounded = false; p.coyote = 0; p.jumpBuf = 0; p.noise = Math.max(p.noise, 1); A.sfx('jump', 0.5); }
    if (inp && !inp.jump && p.vy < -200) p.vy += GRAV * 0.9 * dt; // variable jump
    // x
    p.x += p.vx * dt;
    for (const pl of level.platforms) { if (pl.type === 'vine' || pl.oneway || pl.disabled) continue; if (U.aabb(p, pl)) { if (p.vx > 0) p.x = pl.x - p.w; else if (p.vx < 0) p.x = pl.x + pl.w; p.vx = 0; } }
    if (p.x < 0) p.x = 0; if (p.x + p.w > level.W) p.x = level.W - p.w;
    // y
    const wasGrounded = p.grounded; p.grounded = false; p.groundPl = null; const py = p.y; p.y += p.vy * dt;
    for (const pl of level.platforms) {
      if (pl.type === 'vine' || pl.disabled) continue;
      if (U.aabb(p, pl)) {
        if (p.vy > 0 && py + p.h <= pl.y + 1) { p.y = pl.y - p.h; p.vy = 0; p.grounded = true; p.groundPl = pl; }
        else if (!pl.oneway) { if (p.vy < 0 && py >= pl.y + pl.h - 1) { p.y = pl.y + pl.h; p.vy = 0; } else if (p.vy > 0) { p.y = pl.y - p.h; p.vy = 0; p.grounded = true; p.groundPl = pl; } }
      }
    }
    if (!wasGrounded && p.grounded) { A.sfx('land', 0.5); p.noise = Math.max(p.noise, 0.7); }
    // vine grab
    if (inp && (inp.up || inp.down) && !p.grounded || (inp && inp.up && p.grounded)) { for (const pl of level.platforms) { if (pl.type === 'vine' && !pl.disabled && U.aabb({ x: p.x + p.w / 2 - 6, y: p.y, w: 12, h: p.h }, pl)) { if (!(p.grounded && inp.down)) { p.onVine = pl; p.vy = 0; break; } } } }
    // anim
    if (!p.grounded) p.anim = 'jump'; else if (Math.abs(p.vx) > 30) { p.anim = 'run'; p.animT += dt; p.stepT += dt; if (p.stepT > 0.28) { p.stepT = 0; A.sfx('step', 0.5); p.noise = Math.max(p.noise, 0.5); } } else { p.anim = 'idle'; p.animT += dt; }
    if (p.holding) p.anim = 'hold';
    p.noise = Math.max(0, p.noise - dt * 2);
  }
  function groundY(level, x, fromY = -9999) { let best = 9999; for (const pl of level.platforms) { if (pl.type === 'vine' || pl.disabled) continue; if (x >= pl.x && x <= pl.x + pl.w && pl.y >= fromY && pl.y < best) best = pl.y; } return best; }

  // remote player interpolation
  function remoteApply(p, m) { p.tx = m.x; p.ty = m.y; p.face = m.f; p.anim = m.a; p.animT = m.at; p.holding = !!m.h; p.dead = !!m.d; p.torch = !!m.tc; if (p.tx == null) return; if (p.x == null || Math.abs(p.tx - p.x) > 300) { p.x = p.tx; p.y = p.ty; } }
  function remoteTick(p, dt) { if (p.tx == null) return; p.x += (p.tx - p.x) * Math.min(1, dt * 18); p.y += (p.ty - p.y) * Math.min(1, dt * 18); if (p.anim === 'run' || p.anim === 'climb' || p.anim === 'idle') p.animT += dt; }
  function packPlayer(p) { return { t: 'av', x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, f: p.face, a: p.anim, at: Math.round(p.animT * 100) / 100, h: p.holding ? 1 : 0, d: p.dead ? 1 : 0, tc: p.torch ? 1 : 0 }; }

  // ---- HUD ----
  function say(speaker, text, dur = 4) { st.dialog = { speaker, text, until: dur, born: st.t }; }
  function cue(text, dur = 3.2) { st.cue = { text, until: dur, born: st.t }; A.sfx('cue'); }
  function toast(text, dur = 2.5) { st.toast = { text, until: dur, born: st.t }; }
  function wrap(ctx, text, maxW) { const words = text.split(' '), lines = []; let line = ''; for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; } if (line) lines.push(line); return lines; }
  function drawHUD(ctx, dt) {
    const d = st.dialog;
    if (d) { const age = st.t - d.born, a = Math.min(1, age * 4, d.until * 3); ctx.save(); ctx.globalAlpha = a; ctx.font = '600 15px "Inter", system-ui, sans-serif'; const lines = wrap(ctx, d.text, 760); const h = 44 + lines.length * 24; const y = H - 40 - h; ctx.fillStyle = 'rgba(6,8,10,0.78)'; ctx.beginPath(); ctx.roundRect(W / 2 - 420, y, 840, h, 6); ctx.fill(); ctx.fillStyle = d.speaker === 'MEERA' ? '#d9b48a' : d.speaker === 'YAZHINI' ? '#c96a5a' : d.speaker === 'KUMARAN' ? '#c9a15c' : d.speaker === 'SELVAM' ? '#8fc0c8' : '#aaa'; ctx.font = '700 12px "Inter", system-ui, sans-serif'; ctx.letterSpacing = '2px'; ctx.fillText(d.speaker, W / 2 - 400, y + 22); ctx.letterSpacing = '0px'; ctx.fillStyle = '#e8e2d6'; ctx.font = '500 17px "Inter", system-ui, sans-serif'; const shown = Math.floor(age * 45); let count = 0; lines.forEach((ln, i) => { const seg = ln.slice(0, Math.max(0, shown - count)); count += ln.length + 1; ctx.fillText(seg, W / 2 - 400, y + 46 + i * 24); }); ctx.restore(); }
    const c = st.cue;
    if (c) { const age = st.t - c.born, a = Math.min(1, age * 5, c.until * 3); ctx.save(); ctx.globalAlpha = a; ctx.font = 'italic 600 22px "Inter", system-ui, sans-serif'; ctx.textAlign = 'center'; const tw = ctx.measureText(c.text).width; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2 - 22, 78, tw + 44, 44, 22); ctx.fill(); ctx.fillStyle = '#f0d9a8'; ctx.fillText(c.text, W / 2, 108); ctx.fillStyle = '#d9b48a'; ctx.font = '700 10px "Inter", system-ui, sans-serif'; ctx.letterSpacing = '3px'; ctx.fillText('MEERA', W / 2, 70); ctx.letterSpacing = '0px'; ctx.restore(); }
    const tt = st.toast;
    if (tt) { ctx.save(); ctx.globalAlpha = Math.min(1, tt.until * 2); ctx.font = '600 14px "Inter", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#c8c0b0'; ctx.fillText(tt.text, W / 2, H - 14); ctx.restore(); }
    if (st.debug) { ctx.fillStyle = '#0f0'; ctx.font = '12px monospace'; ctx.fillText(`t=${st.t.toFixed(1)} net s${Net.S.stats.sent} r${Net.S.stats.recv} ${Net.role || '-'} ${Net.connected ? 'ON' : 'off'}`, 8, 14); }
  }
  function label(ctx, text, x, y, opts = {}) { ctx.save(); ctx.font = opts.font || '600 13px "Inter", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = opts.color || '#e8e2d6'; ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6; ctx.fillText(text, x, y); ctx.restore(); }
  function keyHint(ctx, x, y, key, text) { ctx.save(); ctx.font = '700 11px "Inter", system-ui, sans-serif'; ctx.textAlign = 'center'; const w = ctx.measureText(key).width + 14; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 12, w, 18, 4); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillText(key, x, y + 1); if (text) { ctx.font = '500 12px "Inter", system-ui, sans-serif'; ctx.fillStyle = '#e0d8c8'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(text, x, y + 20); } ctx.restore(); }
  function progressBar(ctx, x, y, w, h, v, col = '#c9a15c', bg = 'rgba(0,0,0,0.6)') { ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, Math.max(0, (w - 4) * U.clamp(v, 0, 1)), h - 4, (h - 4) / 2); ctx.fill(); }

  return { W, H, st, input, cam, init, setScene, fadeOut, fadeIn, makePlayer, moveBody, groundY, remoteApply, remoteTick, packPlayer, say, cue, toast, label, keyHint, progressBar, wrap, get ctx() { return ctx; }, get scene() { return scene; }, GRAV, MOVE, JUMP };
})();
