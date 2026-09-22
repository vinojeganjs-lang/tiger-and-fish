// ---------- util.js : small helpers, RNG, noise ----------
const U = (() => {
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  // Mulberry32 seeded RNG
  function rng(seed) {
    let s = seed >>> 0;
    const r = () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.range = (a, b) => a + r() * (b - a);
    r.int = (a, b) => Math.floor(r.range(a, b + 1));
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    return r;
  }

  // 1-D value noise with seeded gradient table
  function noise1(seed) {
    const r = rng(seed), tab = new Float32Array(512);
    for (let i = 0; i < 512; i++) tab[i] = r();
    return x => {
      const i = Math.floor(x), f = x - i, a = tab[i & 511], b = tab[(i + 1) & 511];
      return lerp(a, b, smooth(f));
    };
  }
  // fractal
  function fbm1(seed, oct = 4) {
    const layers = []; for (let i = 0; i < oct; i++) layers.push(noise1(seed * 31 + i * 977));
    return (x, persistence = 0.5) => { let v = 0, amp = 1, fr = 1, norm = 0; for (let i = 0; i < oct; i++) { v += layers[i](x * fr) * amp; norm += amp; amp *= persistence; fr *= 2; } return v / norm; };
  }

  const hex = (h, a = 1) => { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const mix = (h1, h2, t) => { const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16); const c = [16, 8, 0].map(s => Math.round(lerp((a >> s) & 255, (b >> s) & 255, t))); return `rgb(${c[0]},${c[1]},${c[2]})`; };

  const roomCode = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };

  const aabb = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  return { clamp, lerp, smooth, dist, rng, noise1, fbm1, hex, mix, roomCode, aabb };
})();
