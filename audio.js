// ---------- audio.js : procedural score & sfx (Web Audio, no assets) ----------
const A = (() => {
  let ctx = null, master, reverb, dryBus, wetBus, ambBus, musBus, sfxBus;
  let noiseBuf = null;
  const st = { drone: null, amb: null, drum: null, muted: false, vol: 0.8 };

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = st.vol; master.connect(ctx.destination);
    // simple reverb impulse
    reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    reverb.buffer = ir;
    wetBus = ctx.createGain(); wetBus.gain.value = 0.35; wetBus.connect(reverb); reverb.connect(master);
    dryBus = ctx.createGain(); dryBus.connect(master);
    const mk = (g) => { const n = ctx.createGain(); n.gain.value = g; n.connect(dryBus); n.connect(wetBus); return n; };
    ambBus = mk(0.8); musBus = mk(0.7); sfxBus = mk(0.9);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return true;
  }
  const now = () => ctx ? ctx.currentTime : 0;
  function noiseSrc() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }
  function env(g, t, a, peak, d, sus = 0, r = 0.1) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + d); if (sus > 0) g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r); }

  // ---- drone ----
  function drone(on, root = 55, color = 0.5) {
    if (!ensure()) return;
    if (st.drone) { const d = st.drone; d.g.gain.linearRampToValueAtTime(0.0001, now() + 2.5); setTimeout(() => d.nodes.forEach(n => { try { n.stop(); } catch (e) { } }), 2800); st.drone = null; }
    if (!on) return;
    const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(musBus);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180 + color * 400; f.Q.value = 2; f.connect(g);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 90 + color * 120; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    const nodes = [lfo];
    [[root, 'sawtooth', -6], [root * 1.005, 'sawtooth', 5], [root / 2, 'sine', 0], [root * 1.5, 'triangle', 3]].forEach(([fr, ty, det]) => { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = fr; o.detune.value = det; const og = ctx.createGain(); og.gain.value = ty === 'sine' ? 0.5 : 0.18; o.connect(og); og.connect(f); o.start(); nodes.push(o); });
    g.gain.exponentialRampToValueAtTime(0.5, now() + 4);
    st.drone = { g, nodes };
  }

  // ---- ambience ----
  function ambience(type) {
    if (!ensure()) return;
    if (st.amb) { const a = st.amb; a.g.gain.linearRampToValueAtTime(0.0001, now() + 2); setTimeout(() => a.nodes.forEach(n => { try { n.stop(); } catch (e) { } }), 2300); st.amb = null; }
    if (!type) return;
    const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(ambBus); const nodes = [];
    if (type === 'sea' || type === 'storm') {
      const n = noiseSrc(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 0.7; n.connect(f); f.connect(g);
      const lfo = ctx.createOscillator(); lfo.frequency.value = type === 'storm' ? 0.18 : 0.11; const lg = ctx.createGain(); lg.gain.value = type === 'storm' ? 700 : 350; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); n.start(); nodes.push(n, lfo);
      if (type === 'storm') { const n2 = noiseSrc(), f2 = ctx.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 3000; const g2 = ctx.createGain(); g2.gain.value = 0.12; n2.connect(f2); f2.connect(g2); g2.connect(g); n2.start(); nodes.push(n2); }
      g.gain.exponentialRampToValueAtTime(type === 'storm' ? 0.55 : 0.35, now() + 2);
    } else if (type === 'rain') {
      const n = noiseSrc(), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.5; n.connect(f); f.connect(g); n.start(); nodes.push(n);
      g.gain.exponentialRampToValueAtTime(0.28, now() + 2);
    } else if (type === 'forest') {
      const n = noiseSrc(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; const ng = ctx.createGain(); ng.gain.value = 0.25; n.connect(f); f.connect(ng); ng.connect(g); n.start(); nodes.push(n);
      // insect shimmer
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 4200; const og = ctx.createGain(); og.gain.value = 0.006; const lfo = ctx.createOscillator(); lfo.frequency.value = 9; const lg = ctx.createGain(); lg.gain.value = 0.006; lfo.connect(lg); lg.connect(og.gain); o.connect(og); og.connect(g); o.start(); lfo.start(); nodes.push(o, lfo);
      g.gain.exponentialRampToValueAtTime(0.5, now() + 2);
    } else if (type === 'cave') {
      const n = noiseSrc(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; n.connect(f); f.connect(g); n.start(); nodes.push(n);
      g.gain.exponentialRampToValueAtTime(0.4, now() + 2);
    }
    st.amb = { g, nodes, type };
  }

  // ---- drums (scheduler with lookahead; emits beat callbacks for gameplay) ----
  const drum = { bpm: 84, pattern: null, running: false, beat: 0, nextT: 0, onBeat: null, timer: null, intensity: 1 };
  function hitLow(t, v = 1) { // parai-ish: pitched noise thump
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.16);
    const g = ctx.createGain(); env(g, t, 0.004, 0.9 * v, 0.28); o.connect(g); g.connect(musBus); o.start(t); o.stop(t + 0.5);
    const n = noiseSrc(), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 240; f.Q.value = 1.2; const ng = ctx.createGain(); env(ng, t, 0.002, 0.5 * v, 0.09); n.connect(f); f.connect(ng); ng.connect(musBus); n.start(t); n.stop(t + 0.2);
  }
  function hitHigh(t, v = 1) { // thavil-ish crack
    const n = noiseSrc(), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 3; const g = ctx.createGain(); env(g, t, 0.001, 0.45 * v, 0.07); n.connect(f); f.connect(g); g.connect(musBus); n.start(t); n.stop(t + 0.15);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.05); const og = ctx.createGain(); env(og, t, 0.001, 0.25 * v, 0.06); o.connect(og); og.connect(musBus); o.start(t); o.stop(t + 0.12);
  }
  function hitUdukkai(t, v = 1) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.08); const g = ctx.createGain(); env(g, t, 0.002, 0.35 * v, 0.14); o.connect(g); g.connect(musBus); o.start(t); o.stop(t + 0.3); }
  // pattern: array of 16 steps, each string of hits: 'L' low, 'H' high, 'U' udukkai, '.' rest
  const PATTERNS = {
    walk: ['L', '.', 'H', '.', 'L', '.', 'H', 'H', 'L', '.', 'H', '.', 'L', 'U', 'H', '.'],
    tense: ['L', '.', '.', 'H', 'L', '.', 'H', '.', 'L', '.', '.', 'H', 'L', 'H', '.', 'U'],
    marsh: ['L', '.', '.', '.', 'H', '.', '.', '.', 'L', '.', '.', '.', 'H', '.', '.', '.'],
    war: ['LH', 'H', 'L', 'H', 'LH', 'H', 'L', 'HH', 'LH', 'H', 'L', 'H', 'LH', 'H', 'LL', 'HH'],
    heart: ['L', '.', 'L', '.', '.', '.', '.', '.', 'L', '.', 'L', '.', '.', '.', '.', '.'],
  };
  function drumsStart(bpm = 84, patName = 'walk', intensity = 1) {
    if (!ensure()) return;
    drum.bpm = bpm; drum.pattern = PATTERNS[patName] || PATTERNS.walk; drum.intensity = intensity;
    if (drum.running) return; drum.running = true; drum.beat = 0; drum.nextT = now() + 0.1;
    const step = () => {
      if (!drum.running) return;
      const spb = 60 / drum.bpm / 4; // 16th
      while (drum.nextT < now() + 0.15) {
        const s = drum.pattern[drum.beat % 16]; const t = drum.nextT; const v = drum.intensity;
        for (const c of s) { if (c === 'L') hitLow(t, v); else if (c === 'H') hitHigh(t, v * 0.8); else if (c === 'U') hitUdukkai(t, v); }
        if (drum.onBeat) { const b = drum.beat, dt = Math.max(0, (t - now()) * 1000); setTimeout(() => drum.onBeat(b, s), dt); }
        drum.beat++; drum.nextT += spb;
      }
      drum.timer = setTimeout(step, 50);
    };
    step();
  }
  function drumsStop() { drum.running = false; clearTimeout(drum.timer); }
  function drumsSet(patName, bpm, intensity) { if (patName) drum.pattern = PATTERNS[patName] || drum.pattern; if (bpm) drum.bpm = bpm; if (intensity != null) drum.intensity = intensity; }

  // ---- melodic ----
  function pluck(freq = 220, v = 0.5, t = null) { // yaazh-like
    if (!ensure()) return; t = t == null ? now() : t;
    [0, 1].forEach(i => { const o = ctx.createOscillator(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = freq * (i ? 2.002 : 1); const g = ctx.createGain(); env(g, t, 0.003, v * (i ? 0.25 : 0.6), 1.4); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(600, t + 1.2); o.connect(f); f.connect(g); g.connect(musBus); o.start(t); o.stop(t + 1.8); });
  }
  const SCALE = [0, 2, 3, 5, 7, 8, 10]; // natural minor-ish (Tamil-flavoured pentachords used in phrases)
  function phrase(root = 220, notes = [0, 2, 3, 5, 3, 2, 0], gap = 0.28, v = 0.45) { if (!ensure()) return; let t = now() + 0.05; notes.forEach(n => { pluck(root * Math.pow(2, SCALE[((n % 7) + 7) % 7] / 12 + Math.floor(n / 7)), v, t); t += gap; }); }
  function horn(freq = 65, dur = 3.5, v = 0.5) {
    if (!ensure()) return; const t = now();
    [1, 1.5].forEach((m, i) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq * m; const vib = ctx.createOscillator(); vib.frequency.value = 5.5; const vg = ctx.createGain(); vg.gain.value = 3; vib.connect(vg); vg.connect(o.frequency); vib.start(t); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1200, t + dur * 0.5); f.frequency.linearRampToValueAtTime(400, t + dur); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * (i ? 0.3 : 0.7), t + dur * 0.35); g.gain.setValueAtTime(v * (i ? 0.3 : 0.7), t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur); o.connect(f); f.connect(g); g.connect(musBus); o.start(t); o.stop(t + dur + 0.1); vib.stop(t + dur + 0.1); });
  }

  // ---- sfx ----
  function sfx(name, x = 0.5) {
    if (!ensure()) return; const t = now();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (pan) { pan.pan.value = (x - 0.5) * 1.4; pan.connect(sfxBus); }
    const out = pan || sfxBus;
    const nz = (fType, fr, q, peak, d, a = 0.003) => { const n = noiseSrc(), f = ctx.createBiquadFilter(); f.type = fType; f.frequency.value = fr; f.Q.value = q; const g = ctx.createGain(); env(g, t, a, peak, d); n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + a + d + 0.1); return f; };
    const tone = (ty, f0, f1, peak, d, a = 0.003) => { const o = ctx.createOscillator(); o.type = ty; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d); const g = ctx.createGain(); env(g, t, a, peak, d); o.connect(g); g.connect(out); o.start(t); o.stop(t + a + d + 0.1); };
    switch (name) {
      case 'step': nz('lowpass', 500 + Math.random() * 300, 1, 0.12, 0.05); break;
      case 'jump': tone('sine', 220, 440, 0.15, 0.12); break;
      case 'land': nz('lowpass', 300, 1, 0.25, 0.08); tone('sine', 90, 50, 0.3, 0.1); break;
      case 'splash': nz('bandpass', 900, 0.8, 0.6, 0.5, 0.01); nz('lowpass', 200, 1, 0.5, 0.3); break;
      case 'wave': { const f = nz('lowpass', 300, 0.5, 0.7, 1.6, 0.4); f.frequency.linearRampToValueAtTime(1400, t + 0.6); f.frequency.linearRampToValueAtTime(200, t + 2); break; }
      case 'stone': nz('highpass', 2500, 1, 0.3, 0.05); tone('square', 900, 300, 0.12, 0.06); break;
      case 'clatter': nz('bandpass', 1500, 2, 0.5, 0.25, 0.005); tone('triangle', 700, 200, 0.2, 0.2); break;
      case 'growl': tone('sawtooth', 70, 45, 0.5, 0.7, 0.05); nz('lowpass', 250, 2, 0.4, 0.6, 0.05); break;
      case 'rope': nz('bandpass', 700, 4, 0.25, 0.3, 0.02); break;
      case 'creak': tone('sawtooth', 180, 120, 0.12, 0.4, 0.1); break;
      case 'whoosh': { const f = nz('bandpass', 400, 1, 0.4, 0.35, 0.05); f.frequency.exponentialRampToValueAtTime(2500, t + 0.2); break; }
      case 'thud': tone('sine', 120, 40, 0.8, 0.25); nz('lowpass', 200, 1, 0.5, 0.15); break;
      case 'death': tone('sawtooth', 300, 40, 0.5, 0.9, 0.01); nz('lowpass', 400, 1, 0.5, 0.6); break;
      case 'success': [0, 4, 7, 12].forEach((n, i) => pluck(330 * Math.pow(2, n / 12), 0.5, t + i * 0.09)); break;
      case 'cue': pluck(440, 0.35, t); pluck(660, 0.2, t + 0.12); break;
      case 'tick': tone('square', 1200, 1200, 0.06, 0.03); break;
      case 'bell': [1, 2.4, 3.9].forEach((m, i) => tone('sine', 196 * m, 196 * m * 0.995, 0.5 / (i + 1), 3.5 - i * 0.6, 0.005)); break;
      case 'gun': nz('lowpass', 1500, 0.5, 0.9, 0.12, 0.001); tone('sine', 150, 40, 0.6, 0.15, 0.001); break;
    }
  }

  function setVolume(v) { st.vol = v; if (master) master.gain.value = v; }
  function stopAll() { drone(false); ambience(null); drumsStop(); }

  return { ensure, drone, ambience, drumsStart, drumsStop, drumsSet, drum, pluck, phrase, horn, sfx, setVolume, stopAll, now, get ctx() { return ctx; } };
})();
