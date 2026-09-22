// ---------- main.js : lobby, flow, message routing ----------
(() => {
  const $ = id => document.getElementById(id);
  Flow.i = -1; Flow.queue = []; Flow.kindness = 0;
  const steps = [
    () => new PanelScene(Story.panels, () => Flow.next()),
    () => new TitleCard(E.st.lang === 'ta' ? 'மூழ்கிய பாறை' : 'THE DROWNED REEF', E.st.lang === 'ta' ? 'சோதனை I' : 'TRIAL I', 3.2, () => Flow.next()),
    () => new Trial1(),
    () => new TitleCard(E.st.lang === 'ta' ? 'குருட்டு வேட்டைக்காரர்கள்' : 'THE BLIND HUNTERS', E.st.lang === 'ta' ? 'சோதனை II' : 'TRIAL II', 3.2, () => Flow.next()),
    () => new Trial2(),
    () => new TitleCard(E.st.lang === 'ta' ? 'கயிற்றுப் பள்ளம்' : 'THE ROPE GORGE', E.st.lang === 'ta' ? 'சோதனை III' : 'TRIAL III', 3.2, () => Flow.next()),
    () => new Trial3(),
    () => new EndScene(),
  ];
  Flow.goto = i => { Flow.i = i; const s = steps[i](); E.setScene(s); const q = Flow.queue.filter(m => m.fi === i); Flow.queue = Flow.queue.filter(m => m.fi > i); q.forEach(m => s.onMessage && s.onMessage(m)); };
  Flow.next = () => { if (Flow.i + 1 < steps.length) Flow.goto(Flow.i + 1); };
  // wrap Net.send to stamp flow index
  const rawSend = Net.send; Net.send = m => { m.fi = Flow.i; rawSend(m); };
  Net.S.onMessage = m => { if (m.t === 'go') { if (Flow.i < 0) startGame(); return; } if (m.fi == null || m.fi === Flow.i) { E.scene && E.scene.onMessage && E.scene.onMessage(m); } else if (m.fi > Flow.i) Flow.queue.push(m); };
  Net.S.onConnect = () => { $('lobby-status').textContent = E.st.lang === 'ta' ? 'இணைந்தது! ஆரம்பிக்கிறோம்…' : 'Connected! Starting…'; if (Net.isHost) setTimeout(() => { rawSend({ t: 'go' }); startGame(); }, 800); };
  Net.S.onDisconnect = () => { E.toast(E.st.lang === 'ta' ? 'இணைப்பு துண்டிக்கப்பட்டது' : 'Partner disconnected', 6); };

  function startGame() { UI.show('lobby', false); UI.show('touch', isTouch()); A.ensure(); Flow.goto(0); }
  const isTouch = () => ('ontouchstart' in window) && window.matchMedia('(pointer: coarse)').matches;

  // ---- lobby ----
  function setLang(l) { E.st.lang = l; document.documentElement.lang = l; document.querySelectorAll('[data-en]').forEach(el => { el.textContent = l === 'ta' ? el.dataset.ta : el.dataset.en; }); $('lang-en').classList.toggle('on', l === 'en'); $('lang-ta').classList.toggle('on', l === 'ta'); try { localStorage.setItem('tf_lang', l); } catch (e) { } }
  $('lang-en').onclick = () => setLang('en'); $('lang-ta').onclick = () => setLang('ta');
  try { setLang(localStorage.getItem('tf_lang') || 'en'); } catch (e) { setLang('en'); }

  $('btn-create').onclick = async () => {
    A.ensure(); const code = U.roomCode(); $('btn-create').disabled = true; $('lobby-status').textContent = '…';
    try { await Net.host(code); $('room-code').textContent = code; UI.show('room-box', true); UI.show('join-box', false); $('lobby-status').textContent = E.st.lang === 'ta' ? 'நண்பருக்கு இந்த code அனுப்புங்க. அவர் join ஆனதும் ஆரம்பிக்கும்.' : 'Send this code to your friend. The game starts when they join.'; const link = location.origin + location.pathname + '?join=' + code + (Net.S.local ? '&local' : ''); $('room-link').value = link; }
    catch (e) { $('lobby-status').textContent = 'Could not create room: ' + (e.message || e.type || e); $('btn-create').disabled = false; }
  };
  $('btn-copy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('room-link').value); $('btn-copy').textContent = '✓'; setTimeout(() => $('btn-copy').textContent = 'Copy', 1500); };
  async function join(code) {
    code = (code || '').trim().toUpperCase(); if (code.length !== 4) { $('lobby-status').textContent = 'Enter the 4-letter code.'; return; }
    A.ensure(); $('btn-join').disabled = true; $('lobby-status').textContent = E.st.lang === 'ta' ? 'இணைக்கிறோம்…' : 'Connecting…';
    try { await Net.join(code); } catch (e) { $('lobby-status').textContent = (E.st.lang === 'ta' ? 'இணைக்க முடியல. Code சரியா? Host இன்னும் lobby-ல இருக்காரா?' : 'Could not connect. Check the code — and that the host is still on the lobby screen.') + ' (' + (e.message || e.type || e) + ')'; $('btn-join').disabled = false; }
  }
  $('btn-join').onclick = () => join($('join-code').value);
  $('join-code').addEventListener('keydown', e => { if (e.key === 'Enter') join($('join-code').value); });
  const qs = new URLSearchParams(location.search); if (qs.get('join')) { $('join-code').value = qs.get('join').toUpperCase(); }
  $('btn-mute').onclick = () => { A.ensure(); const m = $('btn-mute').classList.toggle('muted'); A.setVolume(m ? 0 : 0.8); };
  $('btn-fs').onclick = () => { const el = document.documentElement; if (!document.fullscreenElement) (el.requestFullscreen && el.requestFullscreen()); else document.exitFullscreen(); };
  $('btn-again').onclick = () => location.reload();

  // ---- boot ----
  E.init($('game'));
  // Lobby background: slow painted panel
  const lobbyBg = Art.panel('island'); let lt = 0;
  E.setScene({ update(dt) { lt += dt; }, render(ctx) { const k = 1 + (lt % 40) * 0.003; ctx.save(); ctx.translate(E.W / 2, E.H / 2); ctx.scale(k, k); ctx.drawImage(lobbyBg, -E.W / 2, -E.H / 2); ctx.restore(); Art.rain(ctx, lt, 0.6, 0, 0.3); Art.vignette(ctx, E.W, E.H, 0.8); }, onMessage() { } });
  E.fadeIn(0.5);
  // resize canvas to fit
  function fit() { const c = $('game'); const r = Math.min(window.innerWidth / E.W, window.innerHeight / E.H); c.style.width = Math.floor(E.W * r) + 'px'; c.style.height = Math.floor(E.H * r) + 'px'; }
  window.addEventListener('resize', fit); fit();
  // dev: ?solo=1 → play as host without partner (for screenshots); avatar of partner hidden
  if (qs.has('solo')) { Net.S.role = 'host'; Net.S.connected = false; Net.S.solo = true; setTimeout(() => { startGame(); if (qs.get('solo') !== '1') Flow.goto(parseInt(qs.get('solo'))); }, 300); }
})();
