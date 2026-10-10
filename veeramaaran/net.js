'use strict';
/* ===== Online co-op over the artifact "room" (presence channel) =====
   Host laptop runs the whole game and publishes a compact snapshot in its presence ~20×/s.
   Guest laptop sends its keys in its own presence and draws the host's snapshots. */
const WK = ['arrow', 'fire', 'vel', 'chakra'];
const ETK = ['soldier', 'archer', 'boar', 'kite', 'catapult'];
const EWK = ['sword', 'spear', 'bow', 'axe'];
const ESK = ['arrow', 'spear', 'javelin', 'axe', 'pot', 'fireball', 'wave', 'slash', 'flame'];
const BXK = ['', 'wave', 'slash', 'flame'];
const BOSS_KEYS = ['x', 'y', 'st', 'stT', 't', 'face', 'phase', 'flash', 'rear', 'attack', 'dir', 'wheel', 'p2', 'hp', 'max', 'n'];
const r0 = v => Math.round(v || 0), r1 = v => Math.round((v || 0) * 10) / 10, r2 = v => Math.round((v || 0) * 100) / 100;
const enc = new TextEncoder();

const NET = {
  mode: null, room: null, avail: null, msg: '', lastSend: 0, seq: 0, fx: [], lastFx: 0, wrapped: false,
  lastSnap: null, music: undefined, jc: 0, lastJc: 0, sentIn: '', lostT: 0, hostPeer: null, emap: new Map(),

  async connect() {
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      for (let i = 0; i < 6 && !(window.claude && window.claude.use); i++) await new Promise(r => setTimeout(r, 250));
      if (window.claude && window.claude.use) {
        try { this.room = await window.claude.use('room'); } catch (e) { this.room = null; }
        if (this.room) { this.kind = 'claude'; this.avail = true; return; }
      }
      if (window.Peer) { try { this.room = makePeerRoom(); this.kind = 'peer'; this.avail = true; return; } catch (e) { } }
      this.avail = false;
    })();
    return this.connecting;
  },
  me() { const p = this.room && this.room.peers().find(q => q.sameTab); return p ? p.peer : null; },
  setPresence(o) { if (this.room) this.room.presence(o).catch(() => { }); },

  wrapFx() {
    if (this.wrapped) return; this.wrapped = true;
    const push = (k, x, y, a, b) => { if (NET.mode === 'host') { NET.fx.push([++NET.seq, k, r0(x), r0(y), a, b]); if (NET.fx.length > 24) NET.fx.shift(); } };
    const bb = bloodBurst, fb = fireBurst, sp = sparks, sx = AUDIO.sfx.bind(AUDIO);
    this.raw = { bb, fb, sp, sx };
    bloodBurst = (x, y, dir = 0, n = 18) => { push(1, x, y, dir, n); return bb(x, y, dir, n); };
    fireBurst = (x, y, n = 30, big = 1) => { push(2, x, y, r0(n), r1(big)); return fb(x, y, n, big); };
    sparks = (x, y, col) => { push(3, x, y, col || 0, 0); return sp(x, y, col); };
    AUDIO.sfx = (n) => { if (n !== 'parai') push(4, 0, 0, n, 0); return sx(n); };
  },

  enterLobby() {
    this.wrapFx(); G.state = 'lobby'; this.mode = null; this.msg = ''; AUDIO.music('calm');
    if (this.avail === null) this.connect().then(() => this.setPresence({ role: 'idle', in: null, s: null, host: null }));
    else this.setPresence({ role: 'idle', in: null, s: null, host: null });
  },
  hosts() { return this.room ? this.room.peers().filter(p => !p.sameTab && p.presence && p.presence.role === 'host' && !p.presence.busy) : []; },
  guestPeer() {
    if (!this.room) return null; const me = this.me();
    return this.room.peers().find(p => !p.sameTab && p.presence && p.presence.role === 'guest' && p.presence.host === me) || null;
  },

  lobbyFrame(raw) {
    G.t += raw;
    const back = pressed.Escape;
    if (back) { if (this.mode === 'host') this.setPresence({ role: 'idle', s: null }); this.mode = null; G.state = 'title'; return; }
    const hosts = this.hosts(), gp = this.mode === 'host' ? this.guestPeer() : null;
    if (this.room && this.room.connected()) {
      if (!this.mode) {
        if (hosts.length && startPressed()) {
          this.mode = 'guest'; this.hostPeer = hosts[0].peer; this.lastSnap = null; this.lastFx = 0; this.lostT = 0; this.emap.clear();
          G.state = 'gwait'; G.players = [new Player(0), new Player(1)]; G.players.forEach(p => p.inv = 0);
          this.setPresence({ role: 'guest', host: this.hostPeer, in: { l: 0, r: 0, u: 0, d: 0, j: 0, f: 0, jc: 0 }, s: null });
          return;
        }
        if ((!hosts.length && startPressed()) || pressed.KeyH) { this.mode = 'host'; this.setPresence({ role: 'host', busy: false, in: null }); }
      } else if (this.mode === 'host' && gp && startPressed()) {
        this.setPresence({ role: 'host', busy: true }); startGame(2); return;
      }
    }
    this.drawLobby(hosts, gp);
  },
  drawLobby(hosts, gp) {
    const c = ctx;
    drawBackground(c, THEMES[1], G.t * 20, G.t); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, W, H); drawEmbers(c, 0.016, G.t, 0.6);
    c.textAlign = 'center';
    c.font = `900 50px ${TA}`; c.fillStyle = '#ffe2b0'; c.shadowColor = 'rgba(255,80,10,.8)'; c.shadowBlur = 24; c.fillText('ஆன்லைன் போர்க்களம்', W / 2, 140); c.shadowBlur = 0;
    c.font = `600 16px ${EN}`; c.fillStyle = '#ffb066'; c.fillText('ONLINE CO-OP · TWO LAPTOPS, ONE LINK', W / 2, 172);
    let l1 = '', l2 = '', l3 = '';
    if (this.avail === null || (this.room && !this.room.connected())) { l1 = 'இணைக்கிறது…'; l2 = 'Connecting to the room'; }
    else if (!this.avail) { l1 = 'இந்த பார்வையில் ஆன்லைன் இணைப்பு கிடைக்கவில்லை'; l2 = 'Open this game in Claude while signed in. Your friend must be invited to it from the Share menu.'; }
    else if (this.mode === 'host') {
      if (gp) { l1 = 'செங்கன் இணைந்தான்!'; l2 = 'Player 2 connected. Press Space to begin the saga.'; }
      else { l1 = 'நண்பருக்காக காத்திருக்கிறது…'; l2 = 'Waiting for Player 2. Send your friend the link (below on GitHub, or the Claude page link); they pick Online and press Space.'; }
      l3 = 'நீங்கள் = வீரமாறன் (Host)';
    } else if (hosts.length) { l1 = 'ஒரு போர் காத்திருக்கிறது!'; l2 = 'A host is waiting. Press Space to join as Sengan (Player 2).'; l3 = 'H — நானே Host ஆகிறேன்'; }
    else { l1 = 'Space — புதிய போரை தொடங்கு (Host)'; l2 = 'Press Space to host. Your friend opens the same link and joins.'; }
    c.font = `700 28px ${TA}`; c.fillStyle = '#f4e4c8'; c.fillText(l1, W / 2, 270);
    c.font = `400 16px ${BODY}`; c.fillStyle = '#d9c7a8'; wrapText(c, l2, W / 2, 306, 700, 22);
    if (l3) { c.font = `700 17px ${TA}`; c.fillStyle = '#9fb8ff'; c.fillText(l3, W / 2, 370); }
    if (this.kind === 'peer' && this.room) {
      const R = this.room;
      if (this.mode === 'host' && R.link && !gp) {
        c.font = `700 18px ${BODY}`; c.fillStyle = '#ffe08a'; c.fillText(R.link, W / 2, 410);
        c.font = `400 13px ${BODY}`; c.fillStyle = '#c9a882'; c.fillText(this.copied ? 'Copied! Send it to your friend.' : 'C — link-ஐ copy செய் · Press C to copy this link and send it to your friend', W / 2, 434);
        if (pressed.KeyC && navigator.clipboard) navigator.clipboard.writeText(R.link).then(() => { this.copied = true; }, () => { });
      }
      if (R.joinCode && !hosts.length && !this.mode) {
        c.font = `400 14px ${BODY}`; c.fillStyle = R.err ? '#ff8a6a' : '#c9a882';
        c.fillText(R.err ? `Host ${R.joinCode} not found. Ask your friend to open Online first, then reload.` : `Host ${R.joinCode}-உடன் இணைக்கிறது… connecting to your friend`, W / 2, 410);
      }
    }
    const n = this.room ? this.room.peers().length : 0;
    c.font = `400 13px ${BODY}`; c.fillStyle = '#8a7a66';
    c.fillText(`இப்போது இந்த link-ல் ${n} பேர் · ${n} here now   ·   Esc — பின் செல்`, W / 2, 470);
    c.fillText('Keys on both laptops: ← → move · ↑ jump · Space shoot · ↓ crouch · X / Shift aim up', W / 2, 494);
  },

  /* ----- host side ----- */
  remoteInput() {
    const gp = this.guestPeer(), i = (gp && gp.presence.in) || {};
    const jc = i.jc || 0, jumpP = jc !== this.lastJc && this.lastJc !== undefined; this.lastJc = jc;
    return { left: !!i.l, right: !!i.r, up: !!i.u, down: !!i.d, jump: !!i.j, fire: !!i.f, jumpP, fireP: false };
  },
  snapshot() {
    const s = { m: G.state, st: G.stage, c: r0(G.cam), sh: r0(G.shake), fl: r2(G.flash), pa: G.paused ? 1 : 0, mu: AUDIO.wanted || 0, go: r1(G.goT) };
    if (G.state === 'scene') { s.sc = G.sq[G.si]; s.t = r2(G.st); }
    s.p = G.players.map(p => [r0(p.x), r0(p.y), p.face, r1(p.phase), p.ground ? 1 : 0, p.crouch ? 1 : 0, r0(p.vx), r2(p.aim.x), r2(p.aim.y), r1(p.spin), r1(p.inv), r2(p.dead), p.out ? 1 : 0, p.lives, p.score, WK.indexOf(p.weapon), p.shootT > 0 ? 1 : 0, r0(p.vy)]);
    if (G.state === 'play' || G.state === 'gameover') {
      s.e = G.enemies.slice(0, 22).map(e => [e.id, ETK.indexOf(e.type), r0(e.x), r0(e.y), e.dir || -1, r0(e.vx), e.flash > 0 ? 1 : 0, EWK.indexOf(e.weapon || 'sword'), r1(e.attack), e.aim ? r2(e.aim.x) : 0, e.aim ? r2(e.aim.y) : 0, r1(e.cool), r1(e.arm), r1(e.t), e.ground ? 1 : 0]);
      s.s = G.shots.slice(0, 28).map(q => [r0(q.x), r0(q.y), r0(q.vx), r0(q.vy), WK.indexOf(q.kind)]);
      s.q = G.eshots.slice(0, 26).map(q => [r0(q.x), r0(q.y), r0(q.vx), r0(q.vy), ESK.indexOf(q.kind), r0(q.g), q.burning ? 1 : 0, BXK.indexOf(q.box || '')]);
      s.k = G.pickups.map(k => [r0(k.x), r0(k.y), WK.indexOf(k.kind), r1(k.t)]);
      if (G.boss) {
        const b = G.boss, o = {};
        for (const k of BOSS_KEYS) if (b[k] !== undefined) o[k] = typeof b[k] === 'number' ? r2(b[k]) : b[k];
        if (b.parts) o.parts = b.parts.map(q => [q.hp, r1(q.arm), r1(q.attack), q.flash > 0 ? 1 : 0, r1(q.cool)]);
        if (b.marks) o.marks = b.marks.map(m => [r0(m.x), r2(m.t), m.done ? 1 : 0]);
        if (b.wreck) o.wreck = r0(b.wreck.x);
        s.b = o; s.bg = G.bossGone ? 1 : 0;
      }
    }
    if (G.banner && G.banner.t > 0) s.bn = [G.banner.ta, G.banner.en, r1(G.banner.t), G.banner.boss ? 1 : 0, G.banner.small ? 1 : 0];
    s.fx = this.fx.slice(-12);
    const size = () => enc.encode(JSON.stringify(s)).length;
    while (size() > 3700) {
      if (s.s && s.s.length > 4) s.s.length = Math.floor(s.s.length * 0.7);
      else if (s.q && s.q.length > 6) s.q.length = Math.floor(s.q.length * 0.7);
      else if (s.fx.length > 4) s.fx = s.fx.slice(-4);
      else if (s.e && s.e.length > 6) s.e.length = Math.floor(s.e.length * 0.7);
      else { delete s.bn; break; }
    }
    return s;
  },
  hostSend() {
    const now = performance.now();
    if (now - this.lastSend < 50) return; this.lastSend = now;
    if (G.state === 'lobby') return;
    this.setPresence({ role: 'host', busy: true, s: this.snapshot() });
    if (G.state === 'play' && G.players[1] && !this.guestPeer()) { if (!this.warned) { this.warned = true; G.banner = { ta: 'செங்கன் இணைப்பு துண்டிக்கப்பட்டது', en: 'Player 2 disconnected', t: 2.5, small: true }; } }
    else this.warned = false;
  },

  /* ----- guest side ----- */
  sendInput() {
    const i = readInput(0);
    if (i.jumpP) this.jc++;
    const o = { l: i.left ? 1 : 0, r: i.right ? 1 : 0, u: i.up ? 1 : 0, d: i.down ? 1 : 0, j: i.jump ? 1 : 0, f: i.fire ? 1 : 0, jc: this.jc };
    const k = JSON.stringify(o);
    if (k !== this.sentIn) { this.sentIn = k; this.setPresence({ in: o }); }
  },
  applySnap(s) {
    const live = s.m === 'play' || s.m === 'gameover';
    if (live && (!G.level || G.level.i !== s.st)) { G.level = buildLevel(s.st); G.stage = s.st; G.boss = null; G.parts = []; }
    G.state = live || s.m === 'scene' ? s.m : 'gwait';
    G.stage = s.st; G.cam = s.c; G.shake = Math.max(G.shake, s.sh); G.flash = Math.max(G.flash, s.fl); G.paused = !!s.pa; G.goT = s.go;
    if (s.mu !== this.music) { this.music = s.mu; AUDIO.music(s.mu || null); }
    if (s.m === 'scene') { if (G.sceneName !== s.sc) { G.sceneName = s.sc; G.scene = SCENES[s.sc]; G.st = s.t; } else if (Math.abs(G.st - s.t) > 0.35) G.st = s.t; }
    else G.sceneName = null;
    while (G.players.length < s.p.length) G.players.push(new Player(G.players.length));
    s.p.forEach((a, i) => Object.assign(G.players[i], { x: a[0], y: a[1], face: a[2], phase: a[3], ground: !!a[4], crouch: !!a[5], vx: a[6], aim: { x: a[7], y: a[8] }, spin: a[9], inv: a[10], dead: a[11], out: !!a[12], lives: a[13], score: a[14], weapon: WK[a[15]] || 'arrow', shootT: a[16] ? 0.1 : 0, vy: a[17] }));
    if (live) {
      const nm = new Map();
      G.enemies = (s.e || []).map(a => {
        const e = this.emap.get(a[0]) || { phase: 0 };
        Object.assign(e, { id: a[0], type: ETK[a[1]], x: a[2], y: a[3], dir: a[4], vx: a[5], flash: a[6] ? 0.05 : 0, weapon: EWK[a[7]], attack: a[8], aim: { x: a[9] || a[4], y: a[10] }, cool: a[11], arm: a[12], t: a[13], ground: !!a[14], w: ETYPES[ETK[a[1]]].w, h: ETYPES[ETK[a[1]]].h });
        nm.set(e.id, e); return e;
      });
      this.emap = nm;
      G.shots = (s.s || []).map(a => ({ x: a[0], y: a[1], vx: a[2], vy: a[3], kind: WK[a[4]] }));
      G.eshots = (s.q || []).map(a => ({ x: a[0], y: a[1], vx: a[2], vy: a[3], kind: ESK[a[4]], g: a[5], burning: !!a[6], box: BXK[a[7]] || undefined }));
      G.pickups = (s.k || []).map(a => ({ x: a[0], y: a[1], kind: WK[a[2]], t: a[3], vy: 0 }));
      if (s.b) {
        if (!G.boss || G.bossStage !== s.st) { G.boss = makeBoss(s.st); G.bossStage = s.st; }
        const b = G.boss; for (const k of BOSS_KEYS) if (k in s.b) b[k] = s.b[k];
        if (s.b.parts && b.parts) s.b.parts.forEach((a, i) => Object.assign(b.parts[i], { hp: a[0], arm: a[1], attack: a[2], flash: a[3] ? 0.05 : 0, cool: a[4] }));
        if (s.b.marks) b.marks = s.b.marks.map(a => ({ x: a[0], t: a[1], done: !!a[2] }));
        if (s.b.wreck !== undefined) b.wreck = { x: s.b.wreck };
        G.bossGone = !!s.bg;
      } else { G.boss = null; G.bossGone = false; }
    }
    if (s.bn) G.banner = { ta: s.bn[0], en: s.bn[1], t: s.bn[2], boss: !!s.bn[3], small: !!s.bn[4] };
    let maxSeq = this.lastFx;
    for (const f of s.fx || []) {
      if (f[0] <= this.lastFx) continue; maxSeq = Math.max(maxSeq, f[0]);
      const R = this.raw;
      if (f[1] === 1) R.bb(f[2], f[3], f[4], f[5]); else if (f[1] === 2) R.fb(f[2], f[3], f[4], f[5]);
      else if (f[1] === 3) R.sp(f[2], f[3], f[4] || undefined); else if (f[1] === 4) R.sx(f[4]);
    }
    this.lastFx = maxSeq;
  },
  guestFrame(raw) {
    G.t += raw; G.shake = Math.max(0, G.shake - raw * 40); G.flash = Math.max(0, G.flash - raw * 2); if (G.banner) G.banner.t -= raw;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const hp = this.room && this.room.peers().find(p => p.peer === this.hostPeer);
    if (!hp) { this.lostT += raw; if (this.lostT > 5) { this.mode = null; this.enterLobby(); return; } } else this.lostT = 0;
    if (pressed.Escape && G.state !== 'play') { this.mode = null; this.enterLobby(); return; }
    this.sendInput();
    const s = hp && hp.presence && hp.presence.s;
    if (s && s !== this.lastSnap) { this.lastSnap = s; try { this.applySnap(s); } catch (e) { console.error(e); } }
    // smooth motion between snapshots
    for (const q of G.shots) { q.x += q.vx * raw; q.y += q.vy * raw; }
    for (const q of G.eshots) { q.vy += (q.g || 0) * raw; q.x += q.vx * raw; q.y += q.vy * raw; }
    for (const e of G.enemies) { e.x += (e.vx || 0) * raw; if (e.vx) e.phase += raw * (e.type === 'boar' ? 16 : 11); e.t += raw; }
    for (const p of G.players) { p.x += (p.vx || 0) * raw; if (!p.ground && !(p.dead > 0)) { p.vy = (p.vy || 0) + 2000 * raw; p.y += p.vy * raw; } if (p.ground && p.vx) p.phase += raw * 13; if (!p.ground) p.spin += raw * 16 * p.face; }
    for (const k of G.pickups) k.t += raw;
    updateParts(raw);
    if (G.state === 'scene' && G.scene) { G.st += raw; drawScene(ctx); }
    else if ((G.state === 'play' || G.state === 'gameover') && G.level) renderPlay(ctx, raw);
    else this.drawWait();
  },
  drawWait() {
    const c = ctx;
    drawBackground(c, THEMES[0], G.t * 20, G.t); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, W, H); drawEmbers(c, 0.016, G.t, 0.8);
    c.textAlign = 'center';
    c.font = `900 46px ${TA}`; c.fillStyle = '#9fb8ff'; c.shadowColor = 'rgba(60,90,255,.6)'; c.shadowBlur = 20; c.fillText('நீங்கள் — செங்கன்', W / 2, 200); c.shadowBlur = 0;
    c.font = `600 16px ${EN}`; c.fillStyle = '#c9d2e8'; c.fillText('YOU ARE SENGAN · PLAYER 2', W / 2, 232);
    c.font = `400 17px ${BODY}`; c.fillStyle = '#d9c7a8';
    c.fillText('Host (வீரமாறன்) Space அழுத்தி தொடங்கும் வரை காத்திருங்கள்…', W / 2, 300);
    c.fillText('Waiting for the host to start. Cutscenes are skipped from the host laptop.', W / 2, 326);
    c.font = `400 13px ${BODY}`; c.fillStyle = '#8a7a66'; c.fillText('← → move · ↑ jump · Space shoot · ↓ crouch · X / Shift aim up   ·   Esc — leave', W / 2, 470);
  }
};
/* PeerJS fallback (GitHub Pages etc.): a direct laptop-to-laptop link that looks like the room API.
   Host gets id veeran-<code>; the friend opens the same page with #<code> and connects to it. */
function makePeerRoom() {
  const joinCode = (location.hash.match(/[a-z0-9]{6}/) || [])[0] || null;
  const myCode = joinCode ? null : Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  const st = { mine: {}, others: new Map(), conns: new Set(), ok: false, id: null };
  const peer = myCode ? new Peer('veeran-' + myCode) : new Peer();
  const send = () => { const msg = JSON.stringify(st.mine); for (const c of st.conns) if (c.open) { try { c.send(msg); } catch (e) { } } };
  const wire = c => {
    c.on('open', () => { st.conns.add(c); send(); });
    c.on('data', d => { try { st.others.set(c.peer, Object.freeze(JSON.parse(d))); } catch (e) { } });
    c.on('close', () => { st.conns.delete(c); st.others.delete(c.peer); });
    c.on('error', () => { });
  };
  const room = {
    joinCode, err: null,
    link: myCode ? location.origin + location.pathname + '#' + myCode : null,
    peers() { const a = [{ peer: st.id || 'me', sameTab: true, presence: st.mine }]; for (const [k, v] of st.others) a.push({ peer: k, sameTab: false, presence: v }); return a; },
    connected() { return st.ok; },
    presence(patch) { const m = Object.assign({}, st.mine); for (const k in patch) { if (patch[k] === null) delete m[k]; else m[k] = patch[k]; } st.mine = m; send(); return Promise.resolve(); }
  };
  peer.on('open', id => { st.id = id; st.ok = true; if (joinCode) wire(peer.connect('veeran-' + joinCode, { serialization: 'json' })); });
  peer.on('connection', c => wire(c));
  peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { } });
  peer.on('error', e => { room.err = e.type; });
  return room;
}
NET.connect();
