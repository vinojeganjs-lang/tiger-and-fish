// ---------- net.js : 2-player transport (PeerJS WebRTC, or BroadcastChannel for local testing) ----------
const Net = (() => {
  const S = { role: null, code: null, connected: false, local: false, peer: null, conn: null, bc: null, onMessage: null, onConnect: null, onDisconnect: null, stats: { sent: 0, recv: 0 } };
  const PREFIX = 'tigerfish-v1-';
  const isLocal = () => new URLSearchParams(location.search).has('local');

  function deliver(m) { S.stats.recv++; if (S.onMessage) S.onMessage(m); }

  function hostPeer(code) {
    return new Promise((res, rej) => {
      const peer = new Peer(PREFIX + code, { debug: 0 }); S.peer = peer;
      peer.on('open', () => res(code));
      peer.on('error', e => { if (e.type === 'unavailable-id') rej(new Error('code-taken')); else if (!S.connected) rej(e); else console.warn('peer error', e); });
      peer.on('connection', conn => {
        if (S.conn) { conn.close(); return; } // 2 players only
        S.conn = conn;
        conn.on('open', () => { S.connected = true; if (S.onConnect) S.onConnect(); });
        conn.on('data', deliver);
        conn.on('close', () => { S.connected = false; S.conn = null; if (S.onDisconnect) S.onDisconnect(); });
      });
    });
  }
  function joinPeer(code) {
    return new Promise((res, rej) => {
      const peer = new Peer({ debug: 0 }); S.peer = peer; let done = false;
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true }); S.conn = conn;
        const to = setTimeout(() => { if (!done) { done = true; rej(new Error('timeout')); } }, 12000);
        conn.on('open', () => { done = true; clearTimeout(to); S.connected = true; if (S.onConnect) S.onConnect(); res(code); });
        conn.on('data', deliver);
        conn.on('close', () => { S.connected = false; if (S.onDisconnect) S.onDisconnect(); });
      });
      peer.on('error', e => { if (!done) { done = true; rej(e); } else console.warn('peer error', e); });
    });
  }
  // Local transport: same browser, two tabs (dev/test only)
  function hostLocal(code) { return new Promise(res => { const bc = new BroadcastChannel(PREFIX + code); S.bc = bc; bc.onmessage = ev => { const m = ev.data; if (m.__from === 'host') return; if (m.t === '__hello') { bc.postMessage({ __from: 'host', t: '__ack' }); if (!S.connected) { S.connected = true; if (S.onConnect) S.onConnect(); } return; } deliver(m); }; res(code); }); }
  function joinLocal(code) { return new Promise((res, rej) => { const bc = new BroadcastChannel(PREFIX + code); S.bc = bc; let ok = false; bc.onmessage = ev => { const m = ev.data; if (m.__from === 'guest') return; if (m.t === '__ack') { if (!ok) { ok = true; S.connected = true; if (S.onConnect) S.onConnect(); res(code); } return; } deliver(m); }; const iv = setInterval(() => { if (ok) clearInterval(iv); else bc.postMessage({ __from: 'guest', t: '__hello' }); }, 300); setTimeout(() => { if (!ok) { clearInterval(iv); rej(new Error('timeout')); } }, 12000); }); }

  async function host(code) { S.role = 'host'; S.code = code; S.local = isLocal(); return S.local ? hostLocal(code) : hostPeer(code); }
  async function join(code) { S.role = 'guest'; S.code = code; S.local = isLocal(); return S.local ? joinLocal(code) : joinPeer(code); }
  function send(m) { if (!S.connected) return; S.stats.sent++; if (S.local) { m.__from = S.role; S.bc.postMessage(m); } else if (S.conn && S.conn.open) { try { S.conn.send(m); } catch (e) { } } }
  function close() { try { S.conn && S.conn.close(); S.peer && S.peer.destroy(); S.bc && S.bc.close(); } catch (e) { } S.connected = false; }
  return { S, host, join, send, close, get role() { return S.role; }, get isHost() { return S.role === 'host'; }, get connected() { return S.connected; } };
})();
