// ---------- scenes.js : story panels, act end, UI overlays ----------
const UI = (() => {
  const $ = id => document.getElementById(id);
  function rules(titleId, linesId, cb) { const box = $('rules'); $('rules-title').textContent = Story.t(titleId); const ul = $('rules-lines'); ul.innerHTML = ''; Story.t(linesId).forEach(l => { const li = document.createElement('li'); li.textContent = l; ul.appendChild(li); }); box.classList.remove('hidden'); const b = $('rules-ok'); b.onclick = () => { box.classList.add('hidden'); A.ensure(); cb(); }; }
  function hideRules() { $('rules').classList.add('hidden'); }
  function show(id, on) { $(id).classList.toggle('hidden', !on); }
  return { rules, hideRules, show, $ };
})();

class PanelScene {
  constructor(panels, onDone) { this.panels = panels; this.i = 0; this.t = 0; this.shown = 0; this.onDone = onDone; this.advT = 0; this.done = false; }
  enter() { E.fadeIn(0.7); A.ambience('sea'); A.drone(true, 49, 0.3); A.drumsStop(); A.horn(58, 5, 0.35); this.shown = 0; this.t = 0; this.advT = 0; }
  next() { if (this.done) return; if (this.i >= this.panels.length - 1) { this.done = true; if (Net.isHost) Net.send({ t: 'ev', k: 'panel', i: -1 }); E.fadeOut(1.4).then(() => this.onDone()); return; } this.i++; this.t = 0; this.shown = 0; if (Net.isHost) Net.send({ t: 'ev', k: 'panel', i: this.i }); const id = this.panels[this.i].img; if (id === 'fish') A.sfx('bell'); if (id === 'harbour') { A.ambience('sea'); A.phrase(196, [0, 2, 3, 2, 0, -2, 0], 0.32, 0.4); } if (id === 'island') { A.ambience('storm'); A.horn(46, 4, 0.4); } if (id === 'notebook') A.pluck(330, 0.4); }
  onMessage(m) { if (m.t === 'ev' && m.k === 'panel') { if (m.i === -1) { if (!this.done) { this.done = true; E.fadeOut(1.4).then(() => this.onDone()); } } else if (m.i !== this.i) { this.i = m.i; this.t = 0; this.shown = 0; A.pluck(220 + this.i * 40, 0.35); } } else if (m.t === 'act' && m.k === 'next' && Net.isHost) this.next(); }
  update(dt) { this.t += dt; this.advT += dt; if ((E.input._actEdge || E.input._jumpEdge) && this.advT > 0.5) { this.advT = 0; if (this.t < 1.5) { this.t = 20; return; } if (Net.isHost) this.next(); else Net.send({ t: 'act', k: 'next' }); } }
  render(ctx) {
    const p = this.panels[this.i]; const img = Art.panel(p.img); const k = 1 + Math.min(this.t, 14) * 0.006; ctx.save(); ctx.translate(E.W / 2, E.H / 2); ctx.scale(k, k); ctx.drawImage(img, -E.W / 2, -E.H / 2); ctx.restore();
    const text = Story.t(p.id); const a = Math.min(1, this.t * 1.2); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, E.H - 170, E.W, 170); ctx.font = '500 21px "Inter", system-ui, sans-serif'; ctx.fillStyle = '#ece6da'; ctx.textAlign = 'center'; const lines = E.wrap(ctx, text, 900); const shown = Math.floor(this.t * 40); let c = 0; lines.forEach((ln, i) => { ctx.fillText(ln.slice(0, Math.max(0, shown - c)), E.W / 2, E.H - 120 + i * 30); c += ln.length + 1; }); ctx.restore();
    E.label(ctx, `${this.i + 1} / ${this.panels.length}`, E.W - 50, 30, { color: '#888', font: '600 12px "Inter", system-ui, sans-serif' });
    if (this.t > 2) E.keyHint(ctx, E.W / 2, E.H - 22, 'E', Net.isHost ? null : null);
    Art.vignette(ctx, E.W, E.H, 0.5);
  }
}

class TitleCard { // brief in-between card (e.g. act titles)
  constructor(title, sub, dur, onDone) { this.title = title; this.sub = sub; this.dur = dur; this.onDone = onDone; this.t = 0; this.fired = false; }
  enter() { E.fadeIn(1); A.horn(52, 4, 0.3); }
  update(dt) { this.t += dt; if (this.t > this.dur && !this.fired) { this.fired = true; E.fadeOut(1).then(() => this.onDone()); } }
  onMessage() { }
  render(ctx) { ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, E.W, E.H); ctx.save(); ctx.textAlign = 'center'; ctx.globalAlpha = Math.min(1, this.t); ctx.fillStyle = '#c9a15c'; ctx.font = '700 12px "Inter", system-ui, sans-serif'; ctx.letterSpacing = '6px'; ctx.fillText(this.sub, E.W / 2, E.H / 2 - 30); ctx.letterSpacing = '1px'; ctx.fillStyle = '#ece6da'; ctx.font = '600 40px "Inter", system-ui, sans-serif'; ctx.fillText(this.title, E.W / 2, E.H / 2 + 22); ctx.restore(); }
}

class EndScene {
  constructor() { this.t = 0; }
  enter() { E.fadeIn(0.6); A.ambience('sea'); A.drone(true, 49, 0.35); A.drumsStop(); A.horn(65, 6, 0.4); setTimeout(() => A.phrase(220, [0, 2, 3, 5, 3, 2, 0, -2], 0.36, 0.45), 2500); UI.show('endcard', true); UI.$('end-title').textContent = Story.t('act1_end_title'); UI.$('end-text').textContent = Story.t('act1_end') + (Flow.kindness ? '\n\n' + (E.st.lang === 'ta' ? 'நீங்கள் சுமைக்காரனுக்கு தண்ணி கொடுத்தீர்கள். அரசு அதை நினைவில் வைக்கும்.' : 'You gave the porter your water. The Kingdom will remember that.') : ''); }
  update(dt) { this.t += dt; }
  onMessage() { }
  render(ctx) { const img = Art.panel('tiger'); const k = 1 + Math.min(this.t, 20) * 0.004; ctx.save(); ctx.translate(E.W / 2, E.H / 2); ctx.scale(k, k); ctx.drawImage(img, -E.W / 2, -E.H / 2); ctx.restore(); Art.vignette(ctx, E.W, E.H, 0.6); }
}
