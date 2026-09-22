// The Tiger and the Fish — 3D proof of concept: Trial II, The Blind Hunters
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = id => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const T = Story.t;
const isTouch = ('ontouchstart' in window) && window.matchMedia('(pointer: coarse)').matches;

// ---------------- world constants ----------------
const LEN = 560;           // corridor length along -z
const HALF = 34;           // half width of playable corridor
const GATE_Z = -LEN + 18;
const SEED = 23;

// 2D value noise
const N2 = (() => { const r = U.rng(SEED * 7 + 1), tab = new Float32Array(256 * 256); for (let i = 0; i < tab.length; i++) tab[i] = r(); const at = (x, y) => tab[((y & 255) << 8) | (x & 255)]; return (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = U.smooth(x - ix), fy = U.smooth(y - iy); return U.lerp(U.lerp(at(ix, iy), at(ix + 1, iy), fx), U.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), fx), fy); }; })();
const fbm2 = (x, y, o = 4) => { let v = 0, a = 1, f = 1, n = 0; for (let i = 0; i < o; i++) { v += N2(x * f, y * f) * a; n += a; a *= 0.5; f *= 2; } return v / n; };
const terrainH = (x, z) => { const edge = Math.max(0, (Math.abs(x) - HALF) / 12); return fbm2(x * 0.045 + 50, z * 0.045 + 50, 3) * 2.2 - 1.1 + edge * edge * 3.5; };

// ---------------- renderer / scene ----------------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.45;
const scene = new THREE.Scene();
const FOG = new THREE.Color(0x07130f);
scene.background = FOG; scene.fog = new THREE.FogExp2(FOG, 0.03);
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
let fx = !qs.has('lowfx') && !isTouch; const LOWQ = qs.has('lowfx'); if (LOWQ) renderer.shadowMap.enabled = false;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.5, 0.72); composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();

// lights
scene.add(new THREE.HemisphereLight(0x4a7a72, 0x0a1408, 0.9)); { const rim = new THREE.DirectionalLight(0x6a90a8, 0.6); rim.position.set(20, 30, 40); scene.add(rim); }
const moon = new THREE.DirectionalLight(0xa8c8d8, 1.7); moon.position.set(-30, 60, -20); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.camera.near = 1; moon.shadow.camera.far = 200; const sc = moon.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; moon.shadow.bias = -0.0015; if (LOWQ) moon.castShadow = false; scene.add(moon); scene.add(moon.target);
const torch = new THREE.PointLight(0xffa040, 0, 26, 1.7); torch.castShadow = false; scene.add(torch);

// ---------------- terrain ----------------
function groundTexture() { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); const r = U.rng(99); x.fillStyle = '#2a2418'; x.fillRect(0, 0, 512, 512); for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${40 + r() * 50 | 0},${50 + r() * 60 | 0},${25 + r() * 30 | 0},${0.25 + r() * 0.5})`; x.beginPath(); x.ellipse(r() * 512, r() * 512, 3 + r() * 14, 2 + r() * 5, r() * 3, 0, 6.28); x.fill(); } for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${10 + r() * 20 | 0},${12 + r() * 20 | 0},${8 + r() * 10 | 0},${0.3 + r() * 0.5})`; x.beginPath(); x.ellipse(r() * 512, r() * 512, 4 + r() * 18, 2 + r() * 8, r() * 3, 0, 6.28); x.fill(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(24, 120); t.colorSpace = THREE.SRGBColorSpace; return t; }
{
  const W = HALF * 2 + 60, segX = 90, segZ = 240; const geo = new THREE.PlaneGeometry(W, LEN + 60, segX, segZ); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -LEN / 2 + 20);
  const pos = geo.attributes.position; const col = new Float32Array(pos.count * 3); const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); const h = terrainH(x, z); pos.setY(i, h); const wet = fbm2(x * 0.2, z * 0.2, 2); c.setRGB(0.55 + wet * 0.3, 0.6 + wet * 0.35, 0.5 + wet * 0.2); if (Math.abs(x) < 6) c.multiplyScalar(1.1); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: groundTexture(), vertexColors: true, roughness: 0.95, metalness: 0 })); m.receiveShadow = true; scene.add(m);
}
// trees & rocks (instanced)
const rng = U.rng(SEED);
{
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.5, 9, 6); trunkGeo.translate(0, 4.5, 0);
  const canGeo = new THREE.IcosahedronGeometry(2.4, 1); const canGeo2 = new THREE.ConeGeometry(2.2, 5, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x15110c, roughness: 1 }); const canMat = new THREE.MeshStandardMaterial({ color: 0x1c4a2c, roughness: 1, flatShading: true }); const canMat2 = new THREE.MeshStandardMaterial({ color: 0x163e24, roughness: 1, flatShading: true });
  const LITE = qs.has('lite'); const N = LITE ? 220 : 900; const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N), cans = new THREE.InstancedMesh(canGeo, canMat, N), cans2 = new THREE.InstancedMesh(canGeo2, canMat2, N);
  trunks.castShadow = true; cans.castShadow = true; cans2.castShadow = true; trunks.receiveShadow = true;
  const d = new THREE.Object3D(); let placed = 0, tries = 0;
  window.__trees = [];
  while (placed < N && tries < 20000) { tries++; const z = -rng() * (LEN + 40) + 20; let x; const side = rng(); if (side < 0.55) x = (rng() < 0.5 ? -1 : 1) * (HALF - 6 + rng() * 40); else { x = (rng() - 0.5) * (HALF * 2 - 8); if (Math.abs(x) < 4.5) continue; } if (z > -12 && Math.abs(x) < 12) continue; if (z < GATE_Z - 4 && Math.abs(x) < 10) continue; const y = terrainH(x, z); const s = 0.8 + rng() * 0.9; d.position.set(x, y - 0.4, z); d.rotation.set(0, rng() * 6.28, (rng() - 0.5) * 0.12); d.scale.set(s, s * (0.9 + rng() * 0.6), s); d.updateMatrix(); trunks.setMatrixAt(placed, d.matrix); d.position.y = y + 7.5 * d.scale.y + rng() * 2; d.scale.multiplyScalar(1 + rng() * 0.5); d.updateMatrix(); (rng() < 0.6 ? cans : cans2).setMatrixAt(placed, d.matrix); (rng() < 0.6 ? cans2 : cans).setMatrixAt(placed, new THREE.Matrix4().makeScale(0, 0, 0)); window.__trees.push([x, z, 0.55 * s]); placed++; }
  trunks.count = cans.count = cans2.count = placed; scene.add(trunks, cans, cans2);
  // rocks
  const rockGeo = new THREE.DodecahedronGeometry(1, 0); const rockMat = new THREE.MeshStandardMaterial({ color: 0x2a3230, roughness: 0.9, flatShading: true }); const R = LITE ? 60 : 220; const rocks = new THREE.InstancedMesh(rockGeo, rockMat, R); rocks.castShadow = true; rocks.receiveShadow = true;
  for (let i = 0; i < R; i++) { const z = -rng() * LEN + 10, x = (rng() - 0.5) * HALF * 2.2; const y = terrainH(x, z); const s = 0.3 + rng() * 1.3; d.position.set(x, y - s * 0.3, z); d.rotation.set(rng() * 3, rng() * 3, rng() * 3); d.scale.set(s * (1 + rng()), s, s * (1 + rng())); d.updateMatrix(); rocks.setMatrixAt(i, d.matrix); if (s > 0.9 && Math.abs(x) < HALF) window.__trees.push([x, z, s * 0.8]); }
  scene.add(rocks);
  // ferns / undergrowth: flat crossed planes
  const fernTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d'); x.clearRect(0, 0, 256, 256); const r = U.rng(5); for (let f = 0; f < 9; f++) { const a = -Math.PI / 2 + (f - 4) * 0.28 + (r() - 0.5) * 0.1; const len = 90 + r() * 60; x.strokeStyle = `rgb(${20 + r() * 20 | 0},${70 + r() * 50 | 0},${30 + r() * 20 | 0})`; x.lineWidth = 3; x.beginPath(); x.moveTo(128, 250); x.quadraticCurveTo(128 + Math.cos(a) * len * 0.5, 250 + Math.sin(a) * len * 0.5 - 20, 128 + Math.cos(a) * len, 250 + Math.sin(a) * len); x.stroke(); for (let k = 0.15; k < 1; k += 0.08) { const px = 128 + Math.cos(a) * len * k, py = 250 + Math.sin(a) * len * k - 20 * Math.sin(k * 3.14); const w = 22 * (1 - k) + 4; x.fillStyle = `rgba(${25 + r() * 25 | 0},${80 + r() * 60 | 0},${35 + r() * 25 | 0},0.95)`; x.beginPath(); x.ellipse(px, py, w, 4, a + 1.2, 0, 6.28); x.fill(); x.beginPath(); x.ellipse(px, py, w, 4, a - 1.2, 0, 6.28); x.fill(); } } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const fernGeo = new THREE.PlaneGeometry(1.8, 1.8); fernGeo.translate(0, 0.9, 0); const fernMat = new THREE.MeshStandardMaterial({ map: fernTex, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide, color: 0x9ab08a }); const F = LITE ? 150 : 1400; const ferns = new THREE.InstancedMesh(fernGeo, fernMat, F);
  for (let i = 0; i < F; i++) { const z = -rng() * LEN + 10, x = (rng() - 0.5) * HALF * 2.4; d.position.set(x, terrainH(x, z) - 0.05, z); d.rotation.set(0, rng() * 6.28, 0); const s = 0.5 + rng() * 0.9; d.scale.set(s, s, s); d.updateMatrix(); ferns.setMatrixAt(i, d.matrix); }
  scene.add(ferns);
}
// gate (goal): two stone pillars with a glowing tiger seal
const gate = new THREE.Group(); {
  const pm = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.9 }); for (const sx of [-4, 4]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 1.6), pm); p.position.set(sx, terrainH(sx, GATE_Z) + 4.5, GATE_Z); p.castShadow = true; gate.add(p); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(11, 1.2, 1.8), pm); lintel.position.set(0, terrainH(0, GATE_Z) + 9, GATE_Z); gate.add(lintel);
  const seal = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshBasicMaterial({ color: 0xffb040 })); seal.position.set(0, terrainH(0, GATE_Z) + 9, GATE_Z + 0.95); gate.add(seal);
  const gl = new THREE.PointLight(0xff9a30, 3, 30, 1.6); gl.position.set(0, terrainH(0, GATE_Z) + 8, GATE_Z + 2); gate.add(gl);
  scene.add(gate);
}
// fireflies
const flies = (() => { const n = qs.has('lite') ? 60 : 260, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), base = []; for (let i = 0; i < n; i++) { const x = (rng() - 0.5) * HALF * 2.2, z = -rng() * LEN + 10; base.push([x, terrainH(x, z) + 0.6 + rng() * 2.5, z, rng() * 6.28]); p[i * 3] = x; p[i * 3 + 1] = base[i][1]; p[i * 3 + 2] = z; } g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const m = new THREE.PointsMaterial({ color: 0xc8ff70, size: 0.18, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }); const pts = new THREE.Points(g, m); pts.userData.base = base; scene.add(pts); return pts; })();
// ground mist planes
const mists = []; { const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(120,150,140,0.16)'); g.addColorStop(1, 'rgba(120,150,140,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })(); const mm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.55, fog: true }); for (let i = 0; i < (qs.has('lite') ? 8 : 70); i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mm); m.rotation.x = -Math.PI / 2; const x = (rng() - 0.5) * HALF * 2, z = -rng() * LEN + 10; m.position.set(x, terrainH(x, z) + 0.35, z); m.userData = { x, z, ph: rng() * 6 }; scene.add(m); mists.push(m); } }

// ---------------- character rigs ----------------
const MAT = { skinK: new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.85 }), skinS: new THREE.MeshStandardMaterial({ color: 0x3d2e22, roughness: 0.85 }), clothK: new THREE.MeshStandardMaterial({ color: 0x9a6a28, roughness: 0.9 }), clothS: new THREE.MeshStandardMaterial({ color: 0x2f5a6a, roughness: 0.9 }), clothM: new THREE.MeshStandardMaterial({ color: 0x6a4a3a, roughness: 0.9 }), dark: new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.9 }), red: new THREE.MeshStandardMaterial({ color: 0x8a2a2a, roughness: 0.8 }), steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.4, metalness: 0.8 }), wood: new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.9 }), hunter: new THREE.MeshStandardMaterial({ color: 0x141a16, roughness: 0.95 }), eye: new THREE.MeshBasicMaterial({ color: 0xff3020 }) };
function box(w, h, d, m, x = 0, y = 0, z = 0) { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.castShadow = true; return me; }
function limb(len, thick, m, geoFn) { const j = new THREE.Group(); const me = new THREE.Mesh(new THREE.CapsuleGeometry(thick / 2, len - thick, 3, 6), m); me.position.y = -len / 2; me.castShadow = true; j.add(me); j.userData.len = len; return j; }
function makeRig(kind) {
  const g = new THREE.Group(); const skin = kind === 'K' ? MAT.skinK : MAT.skinS, cloth = kind === 'K' ? MAT.clothK : kind === 'S' ? MAT.clothS : MAT.clothM;
  const broad = kind === 'K' ? 1.15 : kind === 'S' ? 0.92 : 0.85;
  const hips = new THREE.Group(); hips.position.y = 0.98; g.add(hips);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2 * broad, 0.42, 3, 8), kind === 'M' ? cloth : skin); torso.scale.set(1.35, 1, 0.75); torso.position.y = 0.38; torso.castShadow = true; hips.add(torso);
  const waist = box(0.5 * broad, 0.34, 0.32, cloth, 0, 0.05, 0); hips.add(waist);
  const neck = new THREE.Group(); neck.position.y = 0.72; hips.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skin); head.position.y = 0.16; head.scale.set(0.9, 1.1, 0.95); head.castShadow = true; neck.add(head);
  if (kind === 'S') { const band = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 14), MAT.red); band.rotation.x = Math.PI / 2; band.position.y = 0.2; neck.add(band); }
  if (kind === 'M') { const hair = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), MAT.dark); hair.position.set(0, 0.2, -0.05); hair.scale.set(1, 0.9, 1.1); neck.add(hair); const tail = box(0.08, 0.35, 0.08, MAT.dark, 0, 0.02, -0.18); neck.add(tail); }
  if (kind === 'K') { const bag = box(0.28, 0.42, 0.16, MAT.wood, 0, 0.35, -0.24); hips.add(bag); }
  const mk = (side) => { const sh = new THREE.Group(); sh.position.set(side * 0.3 * broad, 0.62, 0); hips.add(sh); const up = limb(0.34, 0.11 * broad, skin); sh.add(up); const el = new THREE.Group(); el.position.y = -0.34; up.add(el); const fo = limb(0.32, 0.095 * broad, skin); el.add(fo); const hand = new THREE.Group(); hand.position.y = -0.32; fo.add(hand); return { sh, up, el, fo, hand }; };
  const L = mk(-1), R = mk(1);
  const mkLeg = (side) => { const hp = new THREE.Group(); hp.position.set(side * 0.13 * broad, -0.02, 0); hips.add(hp); const th = limb(0.48, 0.15 * broad, cloth); hp.add(th); const kn = new THREE.Group(); kn.position.y = -0.48; th.add(kn); const sh = limb(0.46, 0.12 * broad, skin); kn.add(sh); const foot = box(0.12, 0.08, 0.26, MAT.dark, 0, -0.46, 0.06); kn.add(foot); return { hp, th, kn, sh }; };
  const LL = mkLeg(-1), RL = mkLeg(1);
  let weapon = null;
  if (kind === 'K') { weapon = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.5, 6), MAT.wood); pole.position.y = 0.35; weapon.add(pole); const hook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI * 1.3), MAT.steel); hook.position.y = 1.1; hook.rotation.z = -0.4; weapon.add(hook); const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.3, 6), MAT.steel); spike.position.y = 1.25; weapon.add(spike); weapon.rotation.x = Math.PI / 2 + 0.2; R.hand.add(weapon); }
  if (kind === 'S') { weapon = new THREE.Group(); const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.3, 6), MAT.wood); stick.position.y = 0.3; weapon.add(stick); weapon.rotation.x = Math.PI / 2 + 0.2; R.hand.add(weapon); }
  return { g, hips, torso, neck, head, L, R, LL, RL, weapon, kind };
}
// pose the rig for an animation state; a = {anim, t (time in state), phase (walk cycle), speed, combo}
function poseRig(r, a) {
  const s = (v) => Math.sin(v); const st = a.t;
  const set = (o, x, y, z) => { o.rotation.set(x, y, z); };
  // defaults
  set(r.hips, 0, 0, 0); r.hips.position.y = 0.98; set(r.torso, 0, 0, 0); set(r.neck, 0, 0, 0);
  set(r.L.sh, 0, 0, 0.12); set(r.R.sh, 0, 0, -0.12); set(r.L.el, -0.35, 0, 0); set(r.R.el, -0.35, 0, 0); set(r.LL.hp, 0, 0, 0); set(r.RL.hp, 0, 0, 0); set(r.LL.kn, 0, 0, 0); set(r.RL.kn, 0, 0, 0);
  const g = a.globalT;
  if (a.anim === 'idle') { r.hips.position.y = 0.98 + s(g * 1.7) * 0.012; set(r.torso, 0.02 + s(g * 1.7) * 0.015, 0, 0); set(r.L.sh, 0.05 * s(g * 1.7), 0, 0.15); set(r.R.sh, -0.05 * s(g * 1.7), 0, -0.15); }
  else if (a.anim === 'walk' || a.anim === 'run' || a.anim === 'sneak') {
    const run = a.anim === 'run', sneak = a.anim === 'sneak'; const ph = a.phase; const amp = run ? 0.95 : sneak ? 0.45 : 0.65;
    set(r.LL.hp, s(ph) * amp, 0, 0); set(r.RL.hp, -s(ph) * amp, 0, 0); set(r.LL.kn, Math.max(0, -s(ph - 0.8)) * amp * 1.4 + (sneak ? 0.5 : 0.1), 0, 0); set(r.RL.kn, Math.max(0, s(ph - 0.8)) * amp * 1.4 + (sneak ? 0.5 : 0.1), 0, 0);
    set(r.L.sh, -s(ph) * amp * 0.7, 0, 0.15); set(r.R.sh, s(ph) * amp * 0.7, 0, -0.15); set(r.L.el, -0.5 - Math.max(0, -s(ph)) * 0.6, 0, 0); set(r.R.el, -0.5 - Math.max(0, s(ph)) * 0.6, 0, 0);
    r.hips.position.y = (sneak ? 0.8 : 0.98) + Math.abs(s(ph)) * (run ? 0.06 : 0.03); set(r.torso, run ? 0.28 : sneak ? 0.45 : 0.08, 0, 0); set(r.hips, sneak ? 0.2 : 0, s(ph) * 0.06, 0); set(r.neck, -(run ? 0.15 : sneak ? 0.3 : 0), 0, 0);
    if (sneak) { set(r.LL.hp, s(ph) * amp - 0.4, 0, 0); set(r.RL.hp, -s(ph) * amp - 0.4, 0, 0); }
  }
  else if (a.anim === 'attack') { // combo index a.combo (0,1,2), duration 0.42
    const k = U.clamp(st / 0.42, 0, 1); const anti = U.smooth(U.clamp(k / 0.3, 0, 1)), swing = U.smooth(U.clamp((k - 0.3) / 0.35, 0, 1)), rec = U.smooth(U.clamp((k - 0.65) / 0.35, 0, 1));
    const arm = a.combo === 1 ? r.L : r.R, other = a.combo === 1 ? r.R : r.L; const sgn = a.combo === 1 ? -1 : 1;
    if (a.combo === 2) { // overhead double
      const raise = -2.6 * anti + (2.6 + 0.9) * swing - 0.9 * rec; set(r.L.sh, raise, 0, 0.3); set(r.R.sh, raise, 0, -0.3); set(r.L.el, -0.6 + 0.4 * swing, 0, 0); set(r.R.el, -0.6 + 0.4 * swing, 0, 0); set(r.torso, -0.25 * anti + 0.55 * swing - 0.3 * rec, 0, 0); r.hips.position.y = 0.98 - 0.12 * swing + 0.12 * rec;
    } else {
      set(arm.sh, -1.9 * anti + (1.9 + 0.7) * swing - 0.7 * rec, sgn * (0.9 * anti - 1.6 * swing + 0.7 * rec), -sgn * 0.6); set(arm.el, -0.9 + 0.7 * swing - 0.5 * rec, 0, 0);
      set(other.sh, 0.4 * anti - 0.4 * swing, 0, sgn * 0.3); set(r.torso, 0.05, sgn * (-0.6 * anti + 1.1 * swing - 0.5 * rec), 0); set(r.hips, 0, sgn * (-0.3 * anti + 0.55 * swing - 0.25 * rec), 0);
      set(r.LL.hp, -0.25 * swing, 0, 0); set(r.RL.hp, 0.25 * swing, 0, 0);
    }
  }
  else if (a.anim === 'heavy') { // 0.8s: long windup, slam
    const k = U.clamp(st / 0.8, 0, 1); const anti = U.smooth(U.clamp(k / 0.5, 0, 1)), swing = U.smooth(U.clamp((k - 0.5) / 0.18, 0, 1)), rec = U.smooth(U.clamp((k - 0.72) / 0.28, 0, 1));
    const raise = -3.0 * anti + (3.0 + 1.1) * swing - 1.1 * rec; set(r.L.sh, raise, 0, 0.35); set(r.R.sh, raise, 0, -0.35); set(r.L.el, -0.4, 0, 0); set(r.R.el, -0.4, 0, 0); set(r.torso, -0.35 * anti + 0.9 * swing - 0.55 * rec, 0, 0); r.hips.position.y = 0.98 + 0.06 * anti - 0.3 * swing + 0.24 * rec; set(r.LL.hp, -0.4 * swing + 0.4 * rec, 0, 0); set(r.RL.hp, 0.5 * swing - 0.5 * rec, 0, 0); set(r.LL.kn, 0.6 * swing - 0.6 * rec, 0, 0); set(r.RL.kn, 0.3 * swing - 0.3 * rec, 0, 0);
  }
  else if (a.anim === 'dodge') { const k = U.clamp(st / 0.5, 0, 1); set(r.hips, k * Math.PI * 2, 0, 0); r.hips.position.y = 0.7 + s(k * Math.PI) * 0.2; set(r.LL.hp, -1.2, 0, 0); set(r.RL.hp, -1.2, 0, 0); set(r.LL.kn, 2.0, 0, 0); set(r.RL.kn, 2.0, 0, 0); set(r.L.sh, -1.5, 0, 0.3); set(r.R.sh, -1.5, 0, -0.3); set(r.L.el, -1.8, 0, 0); set(r.R.el, -1.8, 0, 0); set(r.neck, 0.6, 0, 0); }
  else if (a.anim === 'hit') { const k = U.clamp(st / 0.35, 0, 1); const f = s(k * Math.PI); set(r.torso, -0.5 * f, 0, 0.2 * f); set(r.neck, -0.4 * f, 0, 0); set(r.L.sh, -0.8 * f, 0, 0.6); set(r.R.sh, -0.8 * f, 0, -0.6); r.hips.position.y = 0.98 - 0.08 * f; }
  else if (a.anim === 'dead') { const k = U.clamp(st / 0.7, 0, 1); set(r.hips, -1.5 * k, 0, 0.3 * k); r.hips.position.y = U.lerp(0.98, 0.3, k); set(r.L.sh, -1.2 * k, 0, 0.9); set(r.R.sh, -1.2 * k, 0, -0.9); set(r.LL.kn, 0.6 * k, 0, 0); set(r.RL.kn, 0.3 * k, 0, 0); }
  else if (a.anim === 'throw') { const k = U.clamp(st / 0.45, 0, 1); const anti = U.smooth(U.clamp(k / 0.4, 0, 1)), sw = U.smooth(U.clamp((k - 0.4) / 0.3, 0, 1)); set(r.L.sh, -0.5 - 2.4 * anti + 3.6 * sw, 0, 0.5); set(r.L.el, -1.6 + 1.4 * sw, 0, 0); set(r.torso, -0.2 * anti + 0.35 * sw, 0.5 * anti - 0.8 * sw, 0); }
}

// hunter rig: hunched, long-armed, eyeless
// ---------------- enemy rigs ----------------
const ETYPES = {
  stalker: { hp: 3, speed: 7.0, scale: 0.8, windup: 0.32, dmg: 1, reach: 2.0, color: 0x1a2420, poise: 0 },
  hunter: { hp: 5, speed: 5.6, scale: 1.0, windup: 0.45, dmg: 1, reach: 2.3, color: 0x141a16, poise: 0 },
  brute: { hp: 14, speed: 3.9, scale: 1.55, windup: 0.85, dmg: 2, reach: 3.4, color: 0x1e1a14, poise: 2, aoe: true },
  boss: { hp: 42, speed: 4.6, scale: 2.1, windup: 0.75, dmg: 2, reach: 4.2, color: 0x241410, poise: 3, aoe: true, boss: true },
};
function makeHunter(type = 'hunter') {
  const T_ = ETYPES[type]; const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: T_.color, roughness: 0.95, emissive: 0x000000 });
  const body = new THREE.Group(); body.position.y = 1.0; g.add(body);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.6, 3, 8), m); chest.rotation.x = 1.1; chest.position.set(0, 0.15, 0.1); chest.castShadow = true; body.add(chest);
  const spine = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 3, 8), m); spine.rotation.x = 0.6; spine.position.set(0, -0.15, -0.3); spine.castShadow = true; body.add(spine);
  if (type === 'brute' || type === 'boss') { for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 4), m); sp.position.set((i - 2) * 0.12, 0.42 - Math.abs(i - 2) * 0.05, -0.05 - Math.abs(i - 2) * 0.1); sp.rotation.x = -0.6; body.add(sp); } }
  const neck = new THREE.Group(); neck.position.set(0, 0.35, 0.5); body.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), m); head.scale.set(0.8, 0.9, 1.3); head.castShadow = true; neck.add(head);
  for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, type === 'boss' ? 0.8 : 0.5, 5), m); ear.position.set(sx * 0.2, 0.22, -0.05); ear.rotation.z = -sx * 0.7; ear.rotation.x = -0.4; neck.add(ear); }
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.3), m); jaw.position.set(0, -0.14, 0.2); neck.add(jaw);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), MAT.eye); eye.position.set(0, 0.02, 0.3); eye.visible = false; neck.add(eye);
  const mkArm = (side) => { const sh = new THREE.Group(); sh.position.set(side * 0.38, 0.2, 0.25); body.add(sh); const up = limb(0.6, 0.13, m); sh.add(up); const el = new THREE.Group(); el.position.y = -0.6; up.add(el); const fo = limb(0.62, 0.11, m); el.add(fo); const claw = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 4), m); claw.position.y = -0.7; claw.rotation.x = Math.PI; fo.add(claw); return { sh, up, el, fo }; };
  const mkLeg = (side) => { const hp = new THREE.Group(); hp.position.set(side * 0.22, -0.35, -0.35); body.add(hp); const th = limb(0.5, 0.15, m); hp.add(th); const kn = new THREE.Group(); kn.position.y = -0.5; th.add(kn); const sh = limb(0.45, 0.11, m); kn.add(sh); return { hp, th, kn, sh }; };
  g.scale.setScalar(T_.scale);
  return { g, body, neck, head, eye, mat: m, L: mkArm(-1), R: mkArm(1), LL: mkLeg(-1), RL: mkLeg(1) };
}
function poseHunter(r, h, gt) {
  const set = (o, x, y, z) => o.rotation.set(x, y, z); const s = Math.sin;
  const moving = h.state === 'chase' || h.state === 'investigate' || h.state === 'patrol' || h.state === 'charge'; const ph = h.ph;
  r.body.position.y = 1.0 + (moving ? Math.abs(s(ph)) * 0.06 : s(gt * 2) * 0.02); set(r.body, 0, 0, 0);
  const amp = moving ? (h.state === 'chase' || h.state === 'charge' ? 1.0 : 0.5) : 0.05;
  set(r.L.sh, 0.6 - s(ph) * amp, 0, 0.35); set(r.R.sh, 0.6 + s(ph) * amp, 0, -0.35); set(r.L.el, -0.4, 0, 0); set(r.R.el, -0.4, 0, 0);
  set(r.LL.hp, s(ph) * amp * 0.8, 0, 0); set(r.RL.hp, -s(ph) * amp * 0.8, 0, 0); set(r.LL.kn, 0.6 + Math.max(0, -s(ph)) * amp, 0, 0); set(r.RL.kn, 0.6 + Math.max(0, s(ph)) * amp, 0, 0);
  const wu = h.windup || 0.45, atkDur = wu + 0.3;
  if (h.state === 'hidden') { r.body.position.y = -1.6; set(r.body, 1.2, 0, 0); }
  else if (h.state === 'rise') { const k = U.clamp(h.st / 0.7, 0, 1); const e = U.smooth(k); r.body.position.y = U.lerp(-1.6, 1.25, e); set(r.body, 1.2 * (1 - e) - 0.3 * s(k * Math.PI), 0, 0); set(r.L.sh, -2.0 * s(k * Math.PI), 0, 0.8); set(r.R.sh, -2.0 * s(k * Math.PI), 0, -0.8); set(r.neck, -0.6 * s(k * Math.PI), 0, 0); }
  else if (h.state === 'listen') { set(r.neck, -0.5 + s(gt * 3) * 0.1, s(gt * 1.3) * 0.9, 0); r.body.position.y = 1.15; set(r.L.sh, -0.2, 0, 0.5); set(r.R.sh, -0.2, 0, -0.5); }
  else if (h.state === 'attack') { const k = U.clamp(h.st / atkDur, 0, 1); const wk = wu / atkDur; const anti = U.smooth(U.clamp(k / wk, 0, 1)), lunge = U.smooth(U.clamp((k - wk) / 0.5, 0, 1)); if (h.aoe) { set(r.L.sh, -2.8 * anti + 4.0 * lunge, 0, 0.5); set(r.R.sh, -2.8 * anti + 4.0 * lunge, 0, -0.5); set(r.body, -0.5 * anti + 1.0 * lunge, 0, 0); r.body.position.y = 1.0 + 0.5 * anti - 0.55 * lunge; set(r.neck, -0.5 * anti + 0.4 * lunge, 0, 0); } else { set(r.L.sh, -2.2 * anti + 3.2 * lunge, 0, 0.6); set(r.R.sh, -2.2 * anti + 3.2 * lunge, 0, -0.6); set(r.body, -0.3 * anti + 0.7 * lunge, 0, 0); set(r.neck, -0.4 * anti + 0.5 * lunge, 0, 0); r.body.position.y = 1.0 + 0.25 * anti - 0.3 * lunge; } }
  else if (h.state === 'charge') { set(r.body, 0.6, 0, 0); set(r.neck, 0.5, 0, 0); set(r.L.sh, 1.4 - s(ph) * 0.3, 0, 0.5); set(r.R.sh, 1.4 + s(ph) * 0.3, 0, -0.5); }
  else if (h.state === 'stagger') { const k = U.clamp(h.st / 0.35, 0, 1); const f = s(k * Math.PI); set(r.body, -0.5 * f, 0.3 * f, 0); set(r.neck, 0.5 * f, 0, 0); }
  else if (h.state === 'dead') { const k = U.clamp(h.st / 0.8, 0, 1); set(r.body, 1.3 * k, 0, 0.5 * k); r.body.position.y = U.lerp(1.0, 0.35, k); set(r.L.sh, 1.5 * k, 0, 0.8); set(r.R.sh, 1.5 * k, 0, -0.8); }
  else if (h.state === 'roar') { const k = U.clamp(h.st / 1.4, 0, 1); const f = s(k * Math.PI); r.body.position.y = 1.0 + 0.5 * f; set(r.body, -0.7 * f, 0, 0); set(r.neck, -0.9 * f, 0, 0); set(r.L.sh, -2.6 * f, 0, 1.0); set(r.R.sh, -2.6 * f, 0, -1.0); }
  else set(r.neck, moving && (h.state === 'chase') ? 0.3 : -0.2, s(gt * 0.7 + ph) * 0.2, 0);
  r.eye.visible = h.state === 'chase' || h.state === 'attack' || h.state === 'charge' || h.state === 'roar';
  // telegraph flash during windup
  const flash = (h.state === 'attack' && h.st < wu) ? (0.35 + 0.65 * Math.abs(s(gt * 28))) * (h.st / wu) : h.state === 'charge' ? 0.6 : h.flashT > 0 ? h.flashT * 3 : 0;
  r.mat.emissive.setRGB(flash * 0.9, flash * 0.12, flash * 0.05);
}

// ---------------- particles ----------------
const PARTS = (() => { const N = 400; const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09); const mat = new THREE.MeshBasicMaterial({ color: 0xffffff }); const im = new THREE.InstancedMesh(geo, mat, N); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; scene.add(im); const P = []; for (let i = 0; i < N; i++) P.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1, c: new THREE.Color() }); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); let head = 0; const d = new THREE.Object3D();
  return { spawn(x, y, z, n, col, spd = 4, up = 3, size = 1, life = 0.7) { for (let i = 0; i < n; i++) { const p = P[head]; head = (head + 1) % N; p.life = life * (0.6 + Math.random() * 0.6); p.maxLife = p.life; p.x = x; p.y = y; p.z = z; const a = Math.random() * 6.28, r = Math.random() * spd; p.vx = Math.cos(a) * r; p.vz = Math.sin(a) * r; p.vy = Math.random() * up; p.s = size * (0.5 + Math.random()); p.c.set(col).multiplyScalar(0.6 + Math.random() * 0.8); } },
    update(dt) { for (let i = 0; i < N; i++) { const p = P[i]; if (p.life <= 0) { d.scale.setScalar(0); d.position.set(0, -50, 0); } else { p.life -= dt; p.vy -= 12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const g = terrainH(p.x, p.z); if (p.y < g) { p.y = g; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; } d.position.set(p.x, p.y, p.z); d.scale.setScalar(p.s * Math.min(1, p.life / p.maxLife * 2)); d.rotation.set(p.life * 5, p.life * 3, 0); im.setColorAt(i, p.c); } d.updateMatrix(); im.setMatrixAt(i, d.matrix); } im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; } }; })();

// ---------------- arenas / world dressing ----------------
const ARENAS = [
  { z: -48, r: 15, spawn: [['stalker', -4, -46], ['stalker', 5, -52]], wall: -66 },
  { z: -150, r: 18, spawn: [['hunter', -6, -146], ['hunter', 7, -152], ['stalker', 0, -160], ['stalker', -9, -157]], wall: -172 },
  { z: -290, r: 20, spawn: [['brute', 0, -296], ['hunter', -8, -286], ['hunter', 9, -288], ['stalker', -5, -302], ['stalker', 6, -303]], wall: -314 },
  { z: -470, r: 24, spawn: [['boss', 0, -480]], wall: -505, boss: true },
];
const STEALTH_SPOTS = [['hunter', -7, -105, 0.4], ['hunter', 8, -225, -2.6], ['hunter', -4, -245, 0.2], ['hunter', 6, -380, 3.0], ['brute', -8, -410, 0.6], ['hunter', 10, -430, -2.9]];
const CHECKPOINTS = [-4, -70, -178, -320];
const thornWalls = []; { const geo = new THREE.ConeGeometry(0.5, 3.2, 5); const mat = new THREE.MeshStandardMaterial({ color: 0x0c1a10, roughness: 1, flatShading: true }); for (const a of ARENAS) { const grp = new THREE.Group(); for (let i = 0; i < 60; i++) { const m = new THREE.Mesh(geo, mat); const x = (i / 60 - 0.5) * 2 * (HALF + 6) + (rng() - 0.5) * 1.5, z = a.wall + (rng() - 0.5) * 3; m.position.set(x, terrainH(x, z) + 1.2, z); m.rotation.set((rng() - 0.5) * 0.9, rng() * 6, (rng() - 0.5) * 0.9); m.scale.setScalar(0.8 + rng() * 1.2); m.castShadow = true; grp.add(m); } grp.userData = { wallZ: a.wall, open: 0 }; scene.add(grp); thornWalls.push(grp); } }
// standing stones with faint runes in arenas + arena moonlight
const stoneLights = []; { const sm = new THREE.MeshStandardMaterial({ color: 0x3a3a38, roughness: 0.9, flatShading: true }); const rm = new THREE.MeshBasicMaterial({ color: 0xff9a40 }); for (const a of ARENAS) { for (let i = 0; i < (a.boss ? 8 : 4); i++) { const ang = i / (a.boss ? 8 : 4) * 6.28 + 0.5; const x = Math.cos(ang) * (a.r - 3), z = a.z + Math.sin(ang) * (a.r - 3) * 0.7; const st = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4 + rng() * 2, 0.8), sm); st.position.set(x, terrainH(x, z) + 2, z); st.rotation.y = ang; st.rotation.z = (rng() - 0.5) * 0.15; st.castShadow = true; scene.add(st); const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.4), rm); rune.position.set(0, 0.6, 0.41); st.add(rune); rune.visible = false; st.userData.rune = rune; stoneLights.push(st); window.__trees.push([x, z, 0.9]); } const l = new THREE.PointLight(0x8fb8c8, 0, 40, 1.4); l.position.set(0, terrainH(0, a.z) + 9, a.z); scene.add(l); a.light = l; } }

// ---------------- game state ----------------
const G = { started: false, complete: false, restarting: false, solo: false, readyMe: false, readyOther: false, t: 0, kills: 0, hunters: [], stones: [], sounds: [], cueT: 0, dlgT: 0, netAcc: 0, wsAcc: 0, camYaw: 0, camPitch: -0.18, dragging: false, arena: -1, arenaActive: false, cleared: [], checkpoint: 0, hitStop: 0, slowmo: 0, combo: 0, comboT: 0, rage: 0, rageOn: 0, fovT: 58, music: 'calm', bossSeen: false, objective: '' };
function makePlayer(who) { const rig = makeRig(who); scene.add(rig.g); return { who, rig, x: 0, z: 0, y: 0, yaw: Math.PI, anim: 'idle', at: 0, phase: 0, combo: 0, comboT: 0, hp: 5, maxHp: 5, noise: 0, dodgeDir: [0, -1], hitT: 0, dead: false, down: false, downT: 0, stoneCd: 0, tx: null, tz: null, tyaw: 0, inv: 0, hitApplied: false, sneak: false, reviveT: 0, rage: 0, rageOn: 0 }; }
let me, other, meera;
const K = () => Net.isHost || G.solo ? me : other, S = () => Net.isHost || G.solo ? other : me;
const isAuth = () => Net.isHost || G.solo;

// ---------------- input ----------------
const keys = {}; const inp = { mx: 0, mz: 0, sneak: false, atk: false, hvy: false, dodge: false, use: false, rage: false, useHeld: false };
const edge = { atk: false, hvy: false, dodge: false, use: false, rage: false };
window.addEventListener('keydown', e => { if (e.target && e.target.tagName === 'INPUT') return; if (!keys[e.code]) { if (e.code === 'KeyJ') edge.atk = true; if (e.code === 'KeyK') edge.hvy = true; if (e.code === 'Space') edge.dodge = true; if (e.code === 'KeyE') edge.use = true; if (e.code === 'KeyR') edge.rage = true; } keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
let lastMX = 0, lastMY = 0;
canvas.addEventListener('mousedown', e => { if (!G.started) return; if (e.button === 0) edge.atk = true; if (e.button === 2) edge.hvy = true; G.dragging = true; lastMX = e.clientX; lastMY = e.clientY; });
window.addEventListener('mouseup', () => G.dragging = false);
window.addEventListener('mousemove', e => { if (G.dragging) { G.camYaw -= (e.clientX - lastMX) * 0.005; G.camPitch = U.clamp(G.camPitch - (e.clientY - lastMY) * 0.003, -0.6, 0.25); G.camManualT = 1.5; lastMX = e.clientX; lastMY = e.clientY; } });
const stick = { active: false, id: null, cx: 0, cy: 0, dx: 0, dy: 0 }; const look = { id: null, lx: 0, ly: 0 };
const stickEl = $('stick'), knob = stickEl.querySelector('i');
stickEl.addEventListener('touchstart', e => { const t = e.changedTouches[0]; stick.active = true; stick.id = t.identifier; const r = stickEl.getBoundingClientRect(); stick.cx = r.left + r.width / 2; stick.cy = r.top + r.height / 2; e.preventDefault(); }, { passive: false });
window.addEventListener('touchmove', e => { for (const t of e.changedTouches) { if (t.identifier === stick.id) { let dx = t.clientX - stick.cx, dy = t.clientY - stick.cy; const d = Math.hypot(dx, dy); if (d > 50) { dx *= 50 / d; dy *= 50 / d; } stick.dx = dx / 50; stick.dy = dy / 50; knob.style.transform = `translate(${dx}px,${dy}px)`; } else if (t.identifier === look.id) { G.camYaw -= (t.clientX - look.lx) * 0.006; G.camPitch = U.clamp(G.camPitch - (t.clientY - look.ly) * 0.004, -0.6, 0.25); G.camManualT = 1.5; look.lx = t.clientX; look.ly = t.clientY; } } }, { passive: false });
window.addEventListener('touchend', e => { for (const t of e.changedTouches) { if (t.identifier === stick.id) { stick.active = false; stick.id = null; stick.dx = stick.dy = 0; knob.style.transform = ''; } if (t.identifier === look.id) look.id = null; } });
canvas.addEventListener('touchstart', e => { for (const t of e.changedTouches) { if (t.clientX > window.innerWidth * 0.4 && look.id === null) { look.id = t.identifier; look.lx = t.clientX; look.ly = t.clientY; } } }, { passive: true });
document.querySelectorAll('#touch [data-btn]').forEach(b => { const k = b.dataset.btn; const on = ev => { ev.preventDefault(); if (k === 'sneak') keys.Tsneak = true; else if (k === 'stone') { edge.use = true; keys.Tuse = true; } else edge[k] = true; b.classList.add('on'); }; const off = ev => { ev.preventDefault(); if (k === 'sneak') keys.Tsneak = false; if (k === 'stone') keys.Tuse = false; b.classList.remove('on'); }; b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off); b.addEventListener('touchcancel', off); });
function pollInput() { let mx = 0, mz = 0; if (keys.KeyW || keys.ArrowUp) mz -= 1; if (keys.KeyS || keys.ArrowDown) mz += 1; if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1; if (stick.active) { mx = stick.dx; mz = stick.dy; } const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; } inp.mx = mx; inp.mz = mz; inp.sneak = !!(keys.ShiftLeft || keys.ShiftRight || keys.Tsneak); inp.useHeld = !!(keys.KeyE || keys.Tuse); inp.atk = edge.atk; inp.hvy = edge.hvy; inp.dodge = edge.dodge; inp.use = edge.use; inp.rage = edge.rage; edge.atk = edge.hvy = edge.dodge = edge.use = edge.rage = false; }

// ---------------- HUD helpers ----------------
function cue(id, dur = 3.2) { $('cue-text').textContent = T(id); $('cue').style.opacity = 1; G.cueT = dur; A.sfx('cue'); }
function say(sp, id, dur = 4) { $('dlg-sp').textContent = sp; $('dlg-sp').style.color = sp === 'MEERA' ? '#d9b48a' : sp === 'SELVAM' ? '#8fc0c8' : sp === 'KUMARAN' ? '#c9a15c' : '#c96a5a'; $('dlg-tx').textContent = T(id); $('dialog').style.opacity = 1; G.dlgT = dur; }
function hint(t) { $('hint').textContent = t; }
function hostCue(id, dur) { cue(id, dur); Net.send({ t: 'ev', k: 'cue', id, dur }); }
function hostSay(sp, id, dur) { say(sp, id, dur); Net.send({ t: 'ev', k: 'say', sp, id, dur }); }
const script = []; let scriptT = 0;
function runScript(dt) { if (!script.length) return; scriptT += dt; while (script.length && script[0].at <= scriptT) { const L = script.shift(); if (L.cue) cue(L.cue, L.dur); else say(L.sp, L.id, L.dur); } }
const L = (en, ta) => E.st.lang === 'ta' ? ta : en;
function banner(text, sub = '', dur = 2.6) { $('banner-t').textContent = text; $('banner-s').textContent = sub; $('banner').style.opacity = 1; clearTimeout(banner._t); banner._t = setTimeout(() => $('banner').style.opacity = 0, dur * 1000); }

// ---------------- world helpers ----------------
function blocked(x, z, r = 0.5) { for (const t of window.__trees) { const d = Math.hypot(t[0] - x, t[1] - z); if (d < t[2] + r) return t; } for (const w of thornWalls) { if (w.userData.open < 0.9 && Math.abs(z - w.userData.wallZ) < 1.6 + r) return [x, w.userData.wallZ, 1]; } return null; }
function moveWithCollision(p, nx, nz) { const t = blocked(nx, nz); if (!t) { p.x = nx; p.z = nz; return; } const t2 = blocked(nx, p.z); if (!t2) { p.x = nx; return; } const t3 = blocked(p.x, nz); if (!t3) { p.z = nz; return; } }
function addSound(x, z, r, kind, p) { G.sounds.push({ x, z, r, kind, p, life: 0.12 }); }
function juice(kind, x, y, z) { // local feedback only
  if (kind === 'hit') { G.hitStop = Math.max(G.hitStop, 0.055); shake = Math.max(shake, 0.25); PARTS.spawn(x, y, z, 14, 0x8a1a12, 3.5, 3, 1, 0.6); PARTS.spawn(x, y, z, 5, 0xffb060, 5, 4, 0.6, 0.3); A.sfx('clatter', 0.5); }
  else if (kind === 'heavy') { G.hitStop = Math.max(G.hitStop, 0.11); shake = Math.max(shake, 0.7); PARTS.spawn(x, y, z, 30, 0x8a1a12, 6, 5, 1.3, 0.8); PARTS.spawn(x, y, z, 12, 0xffb060, 7, 5, 0.7, 0.4); A.sfx('thud', 0.5); A.sfx('clatter', 0.5); }
  else if (kind === 'kill') { G.slowmo = 0.45; G.fovT = 50; shake = Math.max(shake, 0.5); PARTS.spawn(x, y, z, 40, 0x7a1410, 5, 6, 1.4, 1.1); A.sfx('death', 0.5); }
  else if (kind === 'slam') { shake = Math.max(shake, 1.0); PARTS.spawn(x, terrainH(x, z) + 0.2, z, 40, 0x4a5a30, 8, 5, 1.2, 0.8); A.sfx('thud', 0.5); A.sfx('wave', 0.5); }
  else if (kind === 'hurt') { G.hitStop = Math.max(G.hitStop, 0.08); shake = Math.max(shake, 0.6); hurtFlash(); A.sfx('thud', 0.5); }
  else if (kind === 'rise') { PARTS.spawn(x, terrainH(x, z) + 0.3, z, 30, 0x3a4a28, 5, 6, 1.2, 0.9); A.sfx('growl', 0.5); shake = Math.max(shake, 0.3); }
  else if (kind === 'stealth') { G.slowmo = 0.6; G.fovT = 48; PARTS.spawn(x, y, z, 30, 0x7a1410, 3, 4, 1.2, 1.0); A.sfx('rope', 0.5); A.sfx('death', 0.5); }
}
function bc(k, data = {}) { Net.send(Object.assign({ t: 'ev', k }, data)); }

// ---------------- enemies (authoritative on host/solo) ----------------
function spawnEnemies() {
  for (const h of G.hunters) scene.remove(h.rig.g); G.hunters = [];
  const add = (type, x, z, state, yaw, arena) => { const T_ = ETYPES[type]; const rig = makeHunter(type); scene.add(rig.g); const h = { id: G.hunters.length, type, rig, x, z, ax: x, az: z, range: 10, yaw: yaw == null ? rng() * 6.28 : yaw, state, st: 0, tx: x, tz: z, hp: T_.hp, maxHp: T_.hp, ph: rng() * 6, target: null, gx: null, gz: null, windup: T_.windup, dmg: T_.dmg, reach: T_.reach, speed: T_.speed, aoe: !!T_.aoe, poise: T_.poise, boss: !!T_.boss, arena, flashT: 0, nextCharge: 6 }; G.hunters.push(h); return h; };
  ARENAS.forEach((a, ai) => { if (G.cleared[ai]) return; for (const s of a.spawn) add(s[0], s[1], s[2], 'hidden', null, ai); });
  for (const s of STEALTH_SPOTS) { if (s[2] > CHECKPOINTS[G.checkpoint] + 10) continue; add(s[0], s[1], s[2], 'listen', s[3], -1); }
}
function enemyUpdate(dt) {
  const players = [me, other].filter(p => p && !p.down && !p.dead && (p === me || p.tx != null));
  for (const h of G.hunters) {
    h.st += dt; h.flashT = Math.max(0, h.flashT - dt);
    if (h.state === 'dead') { if (h.st > 3) h.rig.g.visible = false; continue; }
    if (h.state === 'hidden') continue;
    if (h.state === 'rise') { if (h.st > 0.7) { h.state = 'chase'; h.st = 0; h.target = nearestPlayer(h, players); } continue; }
    if (h.state === 'roar') { if (h.st > 1.4) { h.state = 'chase'; h.st = 0; h.target = nearestPlayer(h, players); } continue; }
    // hearing (non-arena enemies) / aggression (arena enemies always know)
    if (h.arena < 0) { let heard = null, best = 1e9; for (const s of G.sounds) { const d = Math.hypot(s.x - h.x, s.z - h.z); const rr = s.r * (h.state === 'listen' ? 1.7 : 1); if (d < rr && d < best) { best = d; heard = s; } }
      if (heard && h.state !== 'attack' && h.state !== 'stagger') { if (heard.kind === 'stone') { if (h.state !== 'chase') { h.state = 'investigate'; h.tx = heard.x; h.tz = heard.z; h.st = 0; } } else { if (h.state !== 'chase') { A.sfx('growl', 0.5); bc('sfx', { n: 'growl' }); } h.state = 'chase'; h.tx = heard.x; h.tz = heard.z; h.target = heard.p; h.st = 0; } } }
    else if (h.state !== 'attack' && h.state !== 'stagger' && h.state !== 'charge') { if (!h.target || h.target.down || h.target.dead) h.target = nearestPlayer(h, players); if (h.target) { h.state = 'chase'; h.tx = h.target.x; h.tz = h.target.z; } }
    const sp = h.state === 'chase' ? h.speed : h.state === 'charge' ? h.speed * 2.6 : h.state === 'investigate' ? 3.4 : 1.4;
    if (h.state === 'patrol') { const dx = h.tx - h.x, dz = h.tz - h.z, d = Math.hypot(dx, dz); if (d < 0.5) { const a = rng() * 6.28; h.tx = h.ax + Math.cos(a) * h.range * rng(); h.tz = h.az + Math.sin(a) * h.range * rng() * 0.6; if (rng() < 0.5) { h.state = 'listen'; h.st = 0; } } else { h.x += dx / d * sp * dt; h.z += dz / d * sp * dt; h.yaw = Math.atan2(dx, dz); h.ph += dt * 4; } }
    else if (h.state === 'listen') { if (h.st > 1.6 && h.arena < 0 && h.wander) { h.state = 'patrol'; h.st = 0; } }
    else if (h.state === 'investigate' || h.state === 'chase') {
      if (h.state === 'chase' && h.target) { const tp = h.target; const d = Math.hypot(tp.x - h.x, tp.z - h.z); if (h.arena >= 0 || (tp.noise > 0.15 && d < 18)) { h.tx = tp.x; h.tz = tp.z; h.st = Math.min(h.st, 0.3); }
        if (h.boss && d > 9 && h.nextCharge <= 0) { h.state = 'charge'; h.st = 0; h.yaw = Math.atan2(tp.x - h.x, tp.z - h.z); h.nextCharge = 7; A.sfx('growl', 0.5); bc('sfx', { n: 'growl' }); continue; }
        if (d < h.reach * 0.85 && !tp.dead && !tp.down) { h.state = 'attack'; h.st = 0; h.yaw = Math.atan2(tp.x - h.x, tp.z - h.z); h.hitDone = false; continue; } }
      const dx = h.tx - h.x, dz = h.tz - h.z, d = Math.hypot(dx, dz);
      // separation from other enemies
      let sx = 0, sz = 0; for (const o of G.hunters) { if (o === h || o.state === 'dead' || o.state === 'hidden') continue; const ox = h.x - o.x, oz = h.z - o.z, od = Math.hypot(ox, oz); if (od < 2.2 && od > 0.01) { sx += ox / od * (2.2 - od); sz += oz / od * (2.2 - od); } }
      if (d > 0.4) { const nx = h.x + (dx / d + sx) * sp * dt, nz = h.z + (dz / d + sz) * sp * dt; const b = blocked(nx, nz, 0.4); if (!b) { h.x = nx; h.z = nz; } else { h.x += dz / d * sp * dt * 0.7; h.z -= dx / d * sp * dt * 0.7; } h.yaw = Math.atan2(dx, dz); h.ph += dt * (h.state === 'chase' ? 12 : 7); }
      else if (h.st > (h.state === 'chase' ? 1.3 : 2.5) && h.arena < 0) { h.state = 'listen'; h.st = 0; h.target = null; }
      if (h.state === 'chase' && h.st > 6 && h.arena < 0) { h.state = 'listen'; h.st = 0; h.target = null; }
    }
    else if (h.state === 'charge') { h.x += Math.sin(h.yaw) * sp * dt; h.z += Math.cos(h.yaw) * sp * dt; h.ph += dt * 14; for (const tp of players) { const d = Math.hypot(tp.x - h.x, tp.z - h.z); if (d < 2.4 && tp.inv <= 0) { damagePlayer(tp, 2, h); } } if (h.st > 1.1 || blocked(h.x + Math.sin(h.yaw) * 1.5, h.z + Math.cos(h.yaw) * 1.5, 0.5)) { h.state = 'stagger'; h.st = 0; juice('slam', h.x, 0, h.z); bc('juice', { j: 'slam', x: h.x, z: h.z }); } }
    else if (h.state === 'attack') { const tp = h.target; const wu = h.windup; if (h.st > wu && h.st < wu + 0.18 && !h.hitDone) { h.hitDone = true; if (h.aoe) { juice('slam', h.x + Math.sin(h.yaw) * 1.5, 0, h.z + Math.cos(h.yaw) * 1.5); bc('juice', { j: 'slam', x: h.x + Math.sin(h.yaw) * 1.5, z: h.z + Math.cos(h.yaw) * 1.5 }); for (const p of players) { const d = Math.hypot(p.x - h.x, p.z - h.z); if (d < h.reach + 0.5 && p.inv <= 0) damagePlayer(p, h.dmg, h); } } else if (tp) { const d = Math.hypot(tp.x - h.x, tp.z - h.z); const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw); const dot = ((tp.x - h.x) * fx + (tp.z - h.z) * fz) / Math.max(0.01, d); if (d < h.reach + 0.3 && dot > 0.3 && tp.inv <= 0) damagePlayer(tp, h.dmg, h); } } if (h.st > wu && h.st < wu + 0.15 && !h.aoe) { h.x += Math.sin(h.yaw) * 7 * dt; h.z += Math.cos(h.yaw) * 7 * dt; } if (h.st > wu + 0.45) { h.state = 'chase'; h.st = 0; if (tp) { h.tx = tp.x; h.tz = tp.z; } } }
    else if (h.state === 'stagger') { if (h.st > (h.boss ? 0.6 : 0.35)) { h.state = 'chase'; h.st = 0; } }
    h.nextCharge -= dt;
    h.x = U.clamp(h.x, -HALF - 4, HALF + 4);
  }
}
function nearestPlayer(h, players) { let best = null, bd = 1e9; for (const p of players) { const d = Math.hypot(p.x - h.x, p.z - h.z); if (d < bd) { bd = d; best = p; } } return best; }
function damageHunter(h, dmg, from, kind = 'hit') {
  if (h.state === 'dead' || h.state === 'hidden') return; h.hp -= dmg; const y = terrainH(h.x, h.z) + 1.2 * ETYPES[h.type].scale;
  const src = from.__real || from; h.flashT = 0.12;
  if (h.hp <= 0) { h.state = 'dead'; h.st = 0; G.kills++; juice('kill', h.x, y, h.z); bc('juice', { j: 'kill', x: h.x, y, z: h.z }); if (h.boss) { setTimeout(() => { A.horn(52, 5, 0.5); }, 400); } }
  else { juice(kind === 'heavy' ? 'heavy' : 'hit', h.x, y, h.z); bc('juice', { j: kind === 'heavy' ? 'heavy' : 'hit', x: h.x, y, z: h.z }); const heavy = kind === 'heavy'; if (h.poise === 0 || heavy || (h.poise <= 2 && h.hp < h.maxHp * 0.3)) { h.state = 'stagger'; h.st = 0; } h.target = src; h.tx = src.x; h.tz = src.z; const d = Math.hypot(h.x - from.x, h.z - from.z) || 1; const kb = (heavy ? 1.8 : 0.6) / (1 + h.poise * 0.6); h.x += (h.x - from.x) / d * kb; h.z += (h.z - from.z) / d * kb; if (h.boss && h.hp < h.maxHp * 0.5 && !h.phase2) { h.phase2 = true; h.speed *= 1.25; h.windup *= 0.8; h.state = 'roar'; h.st = 0; A.sfx('growl', 0.5); bc('sfx', { n: 'growl' }); hostSay('MEERA', 'boss_p2', 3.5); const a = ARENAS[3]; for (const s of [['stalker', -6, -472], ['stalker', 6, -472]]) { const T_ = ETYPES[s[0]]; const rig = makeHunter(s[0]); scene.add(rig.g); G.hunters.push({ id: G.hunters.length, type: s[0], rig, x: s[1], z: s[2], ax: s[1], az: s[2], range: 10, yaw: 0, state: 'rise', st: 0, tx: s[1], tz: s[2], hp: T_.hp, maxHp: T_.hp, ph: 0, target: null, gx: null, gz: null, windup: T_.windup, dmg: T_.dmg, reach: T_.reach, speed: T_.speed, aoe: false, poise: 0, boss: false, arena: 3, flashT: 0, nextCharge: 99 }); juice('rise', s[1], 0, s[2]); } } }
}
function damagePlayer(p, dmg, h) { if (p.dead || p.down || G.restarting || p.inv > 0) return; if (p.rageOn > 0) dmg = Math.max(1, dmg - 1); p.hp -= dmg; p.hitT = 0.35; p.anim = 'hit'; p.at = 0; p.inv = 0.9; const d = Math.hypot(p.x - h.x, p.z - h.z) || 1; p.x += (p.x - h.x) / d * 1.4; p.z += (p.z - h.z) / d * 1.4; if (p === me) juice('hurt', p.x, 0, p.z); bc('hurt', { who: p.who, hp: p.hp, x: p.x, z: p.z }); if (p.hp <= 0) { p.hp = 0; p.down = true; p.downT = 20; p.anim = 'dead'; p.at = 0; bc('down', { who: p.who }); const partner = p === me ? other : me; const partnerAbsent = partner === other && other.tx == null; if (G.solo || partnerAbsent || partner.down) { restart(p.who); } else { hostSay('MEERA', p.who === 'K' ? 'down_k' : 'down_s', 4); } } }
function hurtFlash() { $('hurt').style.opacity = 1; setTimeout(() => $('hurt').style.opacity = 0, 250); }
async function restart(who) { if (G.restarting) return; G.restarting = true; if (Net.isHost) bc('restart', { who, cp: G.checkpoint }); A.sfx('death', 0.5); await new Promise(r => setTimeout(r, 1300)); $('fade').style.opacity = 1; await new Promise(r => setTimeout(r, 900)); resetAll(); $('fade').style.opacity = 0; G.restarting = false; say('MEERA', 'restart', 3.5); }
function resetAll() { const cz = CHECKPOINTS[G.checkpoint]; for (const p of [me, other]) { if (!p) continue; p.x = p.who === 'K' ? -1.5 : 1.5; p.z = cz; p.yaw = Math.PI; p.hp = p.maxHp; p.dead = false; p.down = false; p.anim = 'idle'; p.at = 0; p.inv = 0; p.hitT = 0; p.noise = 0; p.rage = 0; p.rageOn = 0; } other.tx = null; spawnEnemies(); G.stones.forEach(s => scene.remove(s.m)); G.stones = []; G.sounds = []; G.camYaw = 0; G.arena = -1; G.arenaActive = false; G.combo = 0; meera.x = 1; meera.z = cz + 2; thornWalls.forEach((w, i) => { w.userData.open = G.cleared[i] ? 1 : 0; }); updateHP(); }

// ---------------- arenas ----------------
function arenaUpdate(dt) {
  if (!isAuth()) return;
  const lead = Math.min(me.z, other && other.tx != null ? other.z : me.z);
  if (!G.arenaActive) { ARENAS.forEach((a, i) => { if (G.cleared[i] || G.arenaActive) return; if (lead < a.z + a.r) { G.arena = i; G.arenaActive = true; G.checkpoint = Math.max(G.checkpoint, i); bc('arena', { i, cp: G.checkpoint }); arenaStart(i); } }); }
  else { const a = ARENAS[G.arena]; const alive = G.hunters.filter(h => h.arena === G.arena && h.state !== 'dead'); if (alive.length === 0) { G.cleared[G.arena] = true; G.arenaActive = false; bc('cleared', { i: G.arena }); arenaCleared(G.arena); } }
}
function arenaStart(i) { const a = ARENAS[i]; for (const h of G.hunters) if (h.arena === i && h.state === 'hidden') { h.state = a.boss ? 'roar' : 'rise'; h.st = -0.15 * (h.id % 4); juice('rise', h.x, 0, h.z); } if (a.light) a.light.intensity = 3; A.drumsSet(a.boss ? 'war' : 'tense', a.boss ? 112 : 96, 1.1); G.music = 'war'; if (a.boss) { banner(L('THE ELDER HUNTER', 'மூத்த வேட்டைக்காரன்'), L('It has heard every scream in this forest', 'இந்தக் காட்டோட எல்லா அலறலையும் இது கேட்டிருக்கு'), 3.5); G.bossSeen = true; A.horn(46, 4, 0.5); } else banner(L(`AMBUSH — ${a.spawn.length} hunters`, `திடீர் தாக்குதல் — ${a.spawn.length} வேட்டைக்காரர்கள்`), i === 0 ? L('J attack · K heavy · Space dodge', 'J தாக்கு · K கனமா · Space dodge') : '', 2.6); shake = Math.max(shake, 0.5); }
function arenaCleared(i) { const a = ARENAS[i]; if (a.light) a.light.intensity = 0.8; A.drumsSet('heart', 64, 0.35); G.music = 'calm'; A.sfx('success', 0.5); banner(L('CLEARED', 'முடிஞ்சது'), L('The thorns pull back. Move.', 'முள் விலகுது. நகருங்க.'), 2.4); stoneLights.forEach(s => { if (Math.abs(s.position.z - a.z) < a.r + 5) s.userData.rune.visible = true; }); for (const p of [me, other]) { if (p && !p.dead && !p.down) p.hp = Math.min(p.maxHp, p.hp + 2); } if (a.boss) { setTimeout(() => complete(), 2500); } }

// ---------------- player update ----------------
function playerUpdate(p, dt) {
  p.inv = Math.max(0, p.inv - dt); p.stoneCd = Math.max(0, p.stoneCd - dt); p.at += dt; p.comboT = Math.max(0, p.comboT - dt); p.rageOn = Math.max(0, p.rageOn - dt);
  if (p.dead || p.down) { p.anim = 'dead'; return; }
  const isBusy = a => a === 'attack' || a === 'heavy' || a === 'dodge' || a === 'hit' || a === 'throw' || a === 'stealth' || a === 'revive';
  const busy = isBusy(p.anim); const rageMul = p.rageOn > 0 ? 1.45 : 1;
  const dur = { attack: 0.42 / rageMul, heavy: 0.8 / rageMul, dodge: 0.5, hit: 0.35, throw: 0.45, stealth: 1.0, revive: 2.0 }[p.anim];
  if (busy && p.at >= dur) { if (p.anim === 'stealth' && p.stealthTarget) { p.stealthTarget = null; } p.anim = 'idle'; p.at = 0; }
  const cy = G.camYaw; const fx = -Math.sin(cy), fz = -Math.cos(cy); const rx = Math.cos(cy), rz = -Math.sin(cy);
  let mx = inp.mx * rx + (-inp.mz) * fx, mz = inp.mx * rz + (-inp.mz) * fz; const ml = Math.hypot(mx, mz);
  const canAct = !busy || (p.anim === 'attack' && p.at > 0.22 / rageMul);
  // interactions: revive partner / stealth kill / stone
  const partner = other && other.tx != null && !G.solo ? other : null;
  const canRevive = partner && partner.down && Math.hypot(partner.x - p.x, partner.z - p.z) < 2.2;
  const stealthT = stealthTarget(p);
  if (canRevive && inp.useHeld && !busy) { p.anim = 'revive'; p.at = 0; p.reviveT = 0; }
  if (p.anim === 'revive') { if (!inp.useHeld || !canRevive) { p.anim = 'idle'; p.at = 0; } else if (p.at >= 1.85) { if (isAuth()) revive(partner); else Net.send({ t: 'act', k: 'revive' }); p.anim = 'idle'; p.at = 0; } }
  else if (inp.use && stealthT && !busy) { p.anim = 'stealth'; p.at = 0; p.yaw = Math.atan2(stealthT.x - p.x, stealthT.z - p.z); p.x = stealthT.x - Math.sin(p.yaw) * 0.9; p.z = stealthT.z - Math.cos(p.yaw) * 0.9; p.stealthTarget = stealthT; p.noise = Math.max(p.noise, 0.3); if (isAuth()) stealthKill(p, stealthT); else Net.send({ t: 'act', k: 'stealth', id: stealthT.id }); }
  else if (inp.rage && p.rage >= 1 && p.rageOn <= 0) { p.rage = 0; p.rageOn = 7; A.horn(58, 2.5, 0.5); A.sfx('growl', 0.5); shake = 0.8; G.fovT = 52; banner(L('THE TIGER WAKES', 'புலி விழிக்கிறது'), L('7 seconds. Take them.', '7 நொடி. முடிச்சிடுங்க.'), 2); PARTS.spawn(p.x, terrainH(p.x, p.z) + 1, p.z, 40, 0xff8a20, 5, 6, 1, 1); }
  else if (inp.dodge && (!busy || (p.anim === 'attack' && p.at > 0.18))) { p.anim = 'dodge'; p.at = 0; p.inv = 0.4; if (ml > 0.1) p.dodgeDir = [mx / ml, mz / ml]; else p.dodgeDir = [Math.sin(p.yaw), Math.cos(p.yaw)]; p.yaw = Math.atan2(p.dodgeDir[0], p.dodgeDir[1]); A.sfx('whoosh', 0.5); p.noise = Math.max(p.noise, 0.8); }
  else if ((inp.atk || inp.hvy) && canAct) {
    if (inp.hvy) { p.anim = 'heavy'; p.combo = 0; } else { p.combo = (p.anim === 'attack' || p.comboT > 0) ? (p.combo + 1) % 3 : 0; p.anim = 'attack'; p.comboT = 0.8; }
    p.at = 0; p.hitApplied = false; p.noise = Math.max(p.noise, 1.1);
    let best = null, bd = 7.5; for (const h of G.hunters) { if (h.state === 'dead' || h.state === 'hidden') continue; const d = Math.hypot(h.x - p.x, h.z - p.z); if (d < bd) { bd = d; best = h; } }
    if (best) p.yaw = Math.atan2(best.x - p.x, best.z - p.z); else if (ml > 0.1) p.yaw = Math.atan2(mx, mz);
    A.sfx('whoosh', 0.5);
  }
  else if (inp.use && !busy && p.stoneCd <= 0 && !canRevive) { p.anim = 'throw'; p.at = 0; p.stoneCd = 2.0; if (ml > 0.1) p.yaw = Math.atan2(mx, mz); setTimeout(() => throwStone(p), 200); }
  const busy2 = isBusy(p.anim);
  if (p.anim === 'dodge') { const k = p.at / 0.5; const sp = 9.5 * (1 - k * 0.6); moveWithCollision(p, p.x + p.dodgeDir[0] * sp * dt, p.z + p.dodgeDir[1] * sp * dt); }
  else if (busy2) { if (p.anim === 'attack' && p.at < 0.3) moveWithCollision(p, p.x + Math.sin(p.yaw) * 2.6 * dt, p.z + Math.cos(p.yaw) * 2.6 * dt); if (p.anim === 'heavy' && p.at < 0.5) moveWithCollision(p, p.x + Math.sin(p.yaw) * 2.0 * dt, p.z + Math.cos(p.yaw) * 2.0 * dt); }
  else if (ml > 0.05) { const sneak = inp.sneak; const sp = (sneak ? 2.2 : 5.0) * Math.min(1, ml * 1.2); const ny = Math.atan2(mx, mz); let dy = ny - p.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; p.yaw += dy * Math.min(1, dt * 12); moveWithCollision(p, p.x + mx / ml * sp * dt, p.z + mz / ml * sp * dt); p.anim = sneak ? 'sneak' : 'run'; p.phase += dt * (sneak ? 6 : 11.5); p.noise = Math.max(p.noise, sneak ? 0.3 : 0.75); p.sneak = sneak; if (Math.sin(p.phase) > 0.98 && !p.stepped) { p.stepped = true; A.sfx('step', 0.5); } if (Math.sin(p.phase) < 0) p.stepped = false; }
  else p.anim = 'idle';
  p.x = U.clamp(p.x, -HALF, HALF); p.z = U.clamp(p.z, GATE_Z - 12, 6);
  p.noise = Math.max(0, p.noise - dt * 2.2);
  // hits
  const aw = p.anim === 'attack' && p.at > 0.14 / rageMul && p.at < 0.26 / rageMul, hw = p.anim === 'heavy' && p.at > 0.42 / rageMul && p.at < 0.56 / rageMul;
  if ((aw || hw) && !p.hitApplied) { p.hitApplied = true; const dmg = (hw ? 4 : 1) * (p.rageOn > 0 ? 2 : 1); const reach = hw ? 3.2 : 2.5; if (isAuth()) applyHit(p, dmg, reach, hw ? 'heavy' : 'hit'); else Net.send({ t: 'act', k: 'hit', x: p.x, z: p.z, yaw: p.yaw, dmg, reach, kind: hw ? 'heavy' : 'hit' }); }
}
function stealthTarget(p) { for (const h of G.hunters) { if (h.state !== 'listen' && h.state !== 'patrol' && h.state !== 'investigate') continue; if (h.boss) continue; const d = Math.hypot(h.x - p.x, h.z - p.z); if (d > 1.9 * ETYPES[h.type].scale) continue; const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw); const dot = ((p.x - h.x) * fx + (p.z - h.z) * fz) / (d || 1); if (dot < -0.2) return h; } return null; }
function stealthKill(p, h) { if (!h || h.state === 'dead') return; h.hp = 0; h.state = 'dead'; h.st = -0.5; G.kills++; const y = terrainH(h.x, h.z) + 1.0; juice('stealth', h.x, y, h.z); bc('juice', { j: 'stealth', x: h.x, y, z: h.z }); addRage(p, 0.25); banner(L('SILENT KILL', 'அமைதியான கொலை'), '', 1.6); }
function revive(pt) { pt.down = false; pt.dead = false; pt.hp = 3; pt.anim = 'idle'; pt.at = 0; pt.inv = 1.5; bc('revived', { who: pt.who }); A.sfx('success', 0.5); }
function addRage(p, v) { if (p.rageOn > 0) return; p.rage = Math.min(1, p.rage + v); if (p.rage >= 1 && !p.rageReady) { p.rageReady = true; if (p === me) { A.sfx('cue'); banner(L('TIGER READY — press R', 'புலி தயார் — R அழுத்து'), '', 2); } } if (p.rage < 1) p.rageReady = false; }
function applyHit(p, dmg, reach, kind) { const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw); let any = 0; for (const h of G.hunters) { if (h.state === 'dead' || h.state === 'hidden') continue; const dx = h.x - p.x, dz = h.z - p.z, d = Math.hypot(dx, dz); const R = reach + (ETYPES[h.type].scale - 1) * 1.2; if (d < R && (dx * fx + dz * fz) / (d || 1) > 0.3) { damageHunter(h, dmg, p, kind); any++; } } const real = p.__real || p; if (any) { addRage(real, (kind === 'heavy' ? 0.14 : 0.07) * any); if (real === me) { G.combo++; G.comboT = 1.6; } else bc('combo', { who: real.who }); } }
function throwStone(p) { const s = { x: p.x + Math.sin(p.yaw) * 0.6, y: terrainH(p.x, p.z) + 1.4, z: p.z + Math.cos(p.yaw) * 0.6, vx: Math.sin(p.yaw) * 15, vy: 5.5, vz: Math.cos(p.yaw) * 15, m: new THREE.Mesh(new THREE.DodecahedronGeometry(0.09), MAT.steel), id: Math.random() }; scene.add(s.m); G.stones.push(s); A.sfx('whoosh', 0.5); if (!isAuth()) Net.send({ t: 'act', k: 'stone', s: { x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz, id: s.id } }); }
function stonesUpdate(dt) { for (const s of G.stones) { if (s.done) continue; s.vy -= 16 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.m.position.set(s.x, s.y, s.z); s.m.rotation.x += dt * 10; const g = terrainH(s.x, s.z); let hitE = null; if (isAuth()) for (const h of G.hunters) { if (h.state === 'dead' || h.state === 'hidden') continue; if (Math.hypot(h.x - s.x, h.z - s.z) < 0.9 * ETYPES[h.type].scale && Math.abs(s.y - g - 1) < 1.5) { hitE = h; break; } } if (hitE) { damageHunter(hitE, 1, { x: s.x - s.vx, z: s.z - s.vz, __real: me }); s.done = true; s.ttl = 0; } else if (s.y <= g + 0.08 || blocked(s.x, s.z, 0.05)) { s.done = true; s.y = g + 0.08; s.m.position.y = s.y; A.sfx('stone', 0.5); if (isAuth()) { addSound(s.x, s.z, 22, 'stone'); bc('sfx', { n: 'stone' }); } s.ttl = 6; } } G.stones = G.stones.filter(s => { if (s.done && (s.ttl -= dt) <= 0) { scene.remove(s.m); return false; } return true; }); }

// ---------------- meera ----------------
function meeraUpdate(dt) { const trail = (other && other.tx != null && !G.solo) ? ((me.z > other.z) ? me : other) : me; const tx = trail.x + Math.sin(trail.yaw + Math.PI) * 2.4 + 1.2, tz = trail.z + Math.cos(trail.yaw + Math.PI) * 2.4; const dx = tx - meera.x, dz = tz - meera.z, d = Math.hypot(dx, dz); if (d > 1.2) { const sp = Math.min(6, d * 1.5); meera.x += dx / d * sp * dt; meera.z += dz / d * sp * dt; meera.yaw = Math.atan2(dx, dz); meera.anim = sp > 3 ? 'run' : 'walk'; meera.phase += dt * (sp > 3 ? 11 : 7); } else meera.anim = 'idle'; }

// ---------------- net ----------------
function pack(p) { return { t: 'av', x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(3), a: p.anim, at: +p.at.toFixed(2), c: p.combo, n: +p.noise.toFixed(2), ph: +p.phase.toFixed(2), r: p.rageOn > 0 ? 1 : 0 }; }
function applyRemote(p, m) { if (p.tx == null || Math.hypot(m.x - p.x, m.z - p.z) > 8) { p.x = m.x; p.z = m.z; } p.tx = m.x; p.tz = m.z; p.tyaw = m.yaw; if (p.anim !== m.a || (m.a === 'attack' && m.c !== p.combo)) p.at = m.at; if (!p.down && !p.dead) p.anim = m.a; p.combo = m.c; p.noise = m.n; p.phase = m.ph; p.rageOn = m.r ? 1 : 0; }
function remoteTick(p, dt) { if (p.tx == null) return; p.x += (p.tx - p.x) * Math.min(1, dt * 14); p.z += (p.tz - p.z) * Math.min(1, dt * 14); let dy = p.tyaw - p.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; p.yaw += dy * Math.min(1, dt * 14); p.at += dt; }
function onMessage(m) {
  if (m.t === 'av') applyRemote(other, m);
  else if (m.t === 'ready') { G.readyOther = true; tryStart(); }
  else if (m.t === 'ws') { if (m.h.length !== G.hunters.length) { /* respawn to match host roster */ syncRoster(m.h); } m.h.forEach((v, i) => { const h = G.hunters[i]; if (!h) return; h.gx = v[0]; h.gz = v[1]; h.yaw = v[2]; if (h.state !== v[3]) { h.state = v[3]; h.st = 0; } h.hp = v[4]; if (h.gx != null && Math.hypot(h.gx - h.x, h.gz - h.z) > 6) { h.x = h.gx; h.z = h.gz; } }); if (m.hp) { K().hp = m.hp[0]; S().hp = m.hp[1]; } G.kills = m.k; G.arena = m.a; G.arenaActive = !!m.aa; m.cl.forEach((c, i) => { G.cleared[i] = !!c; }); G.checkpoint = m.cp; }
  else if (m.t === 'ev') { if (m.k === 'start') start(); else if (m.k === 'cue') cue(m.id, m.dur); else if (m.k === 'say') say(m.sp, m.id, m.dur); else if (m.k === 'sfx') A.sfx(m.n, 0.5); else if (m.k === 'juice') juice(m.j, m.x, m.y || terrainH(m.x, m.z) + 1, m.z); else if (m.k === 'hurt') { const p = m.who === 'K' ? K() : S(); p.hp = m.hp; if (p === me) { p.hitT = 0.35; p.anim = 'hit'; p.at = 0; p.inv = 0.9; p.x = m.x; p.z = m.z; juice('hurt', p.x, 0, p.z); } } else if (m.k === 'down') { const p = m.who === 'K' ? K() : S(); p.down = true; p.hp = 0; p.anim = 'dead'; p.at = 0; if (p === me) banner(L('DOWN — your partner can revive you (hold E)', 'விழுந்துட்டீங்க — நண்பர் E பிடிச்சு எழுப்பலாம்'), '', 4); } else if (m.k === 'revived') { const p = m.who === 'K' ? K() : S(); p.down = false; p.dead = false; p.hp = 3; p.anim = 'idle'; p.at = 0; p.inv = 1.5; A.sfx('success', 0.5); } else if (m.k === 'restart') { G.checkpoint = m.cp; restart(m.who); } else if (m.k === 'complete') complete(); else if (m.k === 'arena') { G.arena = m.i; G.arenaActive = true; G.checkpoint = m.cp; arenaStart(m.i); } else if (m.k === 'cleared') { G.cleared[m.i] = true; G.arenaActive = false; arenaCleared(m.i); } else if (m.k === 'combo') { if (m.who === me.who) { G.combo++; G.comboT = 1.6; addRage(me, 0.07); } } }
  else if (m.t === 'act') { if (m.k === 'hit') applyHit({ x: m.x, z: m.z, yaw: m.yaw, who: other.who, __real: other }, m.dmg, m.reach, m.kind); else if (m.k === 'stone') { const s = Object.assign({ m: new THREE.Mesh(new THREE.DodecahedronGeometry(0.09), MAT.steel) }, m.s); scene.add(s.m); G.stones.push(s); } else if (m.k === 'stealth') { const h = G.hunters[m.id]; if (h) stealthKill(other, h); } else if (m.k === 'revive') { if (me.down) revive(me); } }
}
function syncRoster(list) { for (const h of G.hunters) scene.remove(h.rig.g); G.hunters = list.map((v, i) => { const type = v[5] || 'hunter'; const T_ = ETYPES[type]; const rig = makeHunter(type); scene.add(rig.g); return { id: i, type, rig, x: v[0], z: v[1], yaw: v[2], state: v[3], st: 0, hp: v[4], maxHp: T_.hp, ph: 0, gx: v[0], gz: v[1], windup: T_.windup, aoe: !!T_.aoe, boss: !!T_.boss, arena: v[6] == null ? -1 : v[6], flashT: 0 }; }); }
Net.S.onMessage = onMessage;

// ---------------- flow ----------------
function tryStart() { if (isAuth() && G.readyMe && (G.readyOther || G.solo) && !G.started) { start(); Net.send({ t: 'ev', k: 'start' }); } }
function start() { G.started = true; $('rules').classList.add('hidden'); $('hud').classList.remove('hidden'); if (isTouch) $('touch').classList.remove('hidden'); A.ambience('forest'); A.drone(true, 49, 0.25); A.drumsStart(64, 'heart', 0.35); script.push({ at: 0.5, sp: 'MEERA', id: 'm2', dur: 5 }, { at: 5.8, sp: 'SELVAM', id: 's2', dur: 2.6 }); }
function complete() { if (G.complete) return; G.complete = true; A.sfx('success', 0.5); A.drumsStop(); A.horn(65, 6, 0.5); say('MEERA', 't2_done', 5); setTimeout(() => { $('fade').style.opacity = 1; setTimeout(() => { $('end-title').textContent = L('TRIAL II — THE FOREST IS QUIET', 'சோதனை II — காடு அமைதியாச்சு'); $('end-text').textContent = L(`Hunters killed: ${G.kills}. The Elder is dead. The gate is open.\n\nThis is the 3D direction: ambush arenas, stealth kills, heavy combat, the Tiger. Tell me what to push harder.`, `கொன்ன வேட்டைக்காரர்கள்: ${G.kills}. மூத்தவன் செத்தான். வாசல் திறந்தது.\n\nஇதுதான் 3D direction: ambush arenas, stealth kills, heavy combat, புலி. எதை இன்னும் அழுத்தணும்னு சொல்லுங்க.`); $('endcard').classList.remove('hidden'); $('fade').style.opacity = 0; }, 1000); }, 5000); }

// ---------------- camera ----------------
let shake = 0; const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function cameraUpdate(dt) {
  const p = me; G.camManualT = Math.max(0, (G.camManualT || 0) - dt);
  if (G.camManualT <= 0 && (p.anim === 'run' || p.anim === 'sneak' || p.anim === 'walk')) { let dy = (p.yaw + Math.PI) - G.camYaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; G.camYaw += dy * Math.min(1, dt * 1.8); }
  // in combat, pull back a bit and frame the nearest enemy
  const fight = G.hunters.some(h => (h.state === 'chase' || h.state === 'attack' || h.state === 'charge' || h.state === 'rise' || h.state === 'roar') && Math.hypot(h.x - p.x, h.z - p.z) < 14);
  const cy = G.camYaw, cp = G.camPitch; const dist = fight ? 6.4 : 5.2, height = fight ? 2.6 : 2.2;
  const px = p.x, pz = p.z, py = terrainH(p.x, p.z);
  const bx = px + Math.sin(cy) * dist * Math.cos(cp), bz = pz + Math.cos(cy) * dist * Math.cos(cp), by = py + height - Math.sin(cp) * dist;
  const ox = Math.cos(cy) * 0.8, oz = -Math.sin(cy) * 0.8; const tx = bx + ox, tz = bz + oz; const ty = Math.max(by, terrainH(tx, tz) + 0.6);
  camPos.lerp(new THREE.Vector3(tx, ty, tz), Math.min(1, dt * 7));
  camLook.lerp(new THREE.Vector3(px - Math.sin(cy) * 1.5 + ox * 0.5, py + 1.35, pz - Math.cos(cy) * 1.5 + oz * 0.5), Math.min(1, dt * 9));
  camera.position.copy(camPos); if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake * 0.35; camera.position.y += (Math.random() - 0.5) * shake * 0.25; shake = Math.max(0, shake - dt * 2.5); }
  camera.lookAt(camLook);
  G.fovT += (58 - G.fovT) * Math.min(1, dt * 2.5); camera.fov += (G.fovT - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix();
}

// ---------------- HUD ----------------
function updateHP() { $('hp-me').style.width = Math.max(0, me.hp) * 20 + '%'; $('hp-other').style.width = Math.max(0, other ? other.hp : 5) * 20 + '%'; $('rage').style.width = (me.rageOn > 0 ? 100 : me.rage * 100) + '%'; $('rage').style.background = me.rageOn > 0 ? '#ff6a20' : me.rage >= 1 ? '#ffb040' : '#c9a15c'; }
const wp = new THREE.Vector3();
function hudUpdate(dt) {
  if (G.cueT > 0) { G.cueT -= dt; if (G.cueT <= 0) $('cue').style.opacity = 0; } if (G.dlgT > 0) { G.dlgT -= dt; if (G.dlgT <= 0) $('dialog').style.opacity = 0; } updateHP();
  $('noise').textContent = me.noise > 0.6 ? 'LOUD' : me.noise > 0.1 ? 'quiet' : 'silent'; $('noise').style.color = me.noise > 0.6 ? '#e07060' : '#9ab';
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; } $('combo').textContent = G.combo >= 2 ? `${G.combo} HITS` : ''; $('combo').style.transform = `scale(${1 + Math.min(0.6, G.combo * 0.05)})`;
  // objective + waypoint
  let obj, target;
  const st = stealthTarget(me); const partner = other && other.tx != null && !G.solo ? other : null;
  if (partner && partner.down && Math.hypot(partner.x - me.x, partner.z - me.z) < 2.2) obj = L('HOLD E — revive', 'E பிடி — எழுப்பு');
  else if (st) obj = L('E — SILENT KILL', 'E — அமைதியான கொலை');
  else if (G.arenaActive) { const alive = G.hunters.filter(h => h.arena === G.arena && h.state !== 'dead').length; const a = ARENAS[G.arena]; obj = a.boss ? '' : L(`${alive} left`, `${alive} மீதி`); target = null; }
  else { const next = ARENAS.findIndex((a, i) => !G.cleared[i]); if (next >= 0) { const a = ARENAS[next]; target = [0, a.z + a.r - 2]; obj = L(next === 3 ? 'Something big is waiting ahead' : 'Move deeper into the forest', next === 3 ? 'பெரிசா ஏதோ முன்னாடி காத்திருக்கு' : 'காட்டுக்குள்ள இன்னும் போங்க'); } else { target = [0, GATE_Z]; obj = L('Reach the gate', 'வாசலை அடையுங்க'); } }
  if (me.down) obj = partner ? L('DOWN — wait for your partner', 'விழுந்துட்டீங்க — நண்பருக்காக இருங்க') : '';
  hint(obj);
  const w = $('waypoint'); if (target && !G.arenaActive) { wp.set(target[0], terrainH(target[0], target[1]) + 2, target[1]); const d = Math.hypot(target[0] - me.x, target[1] - me.z); wp.project(camera); if (wp.z < 1) { const sx = (wp.x * 0.5 + 0.5) * innerWidth, sy = (-wp.y * 0.5 + 0.5) * innerHeight; w.style.left = U.clamp(sx, 40, innerWidth - 40) + 'px'; w.style.top = U.clamp(sy, 60, innerHeight - 80) + 'px'; w.style.opacity = 1; w.textContent = `◆ ${d | 0}m`; } else w.style.opacity = 0; } else w.style.opacity = 0;
  // boss bar
  const boss = G.hunters.find(h => h.boss && h.state !== 'hidden'); const bb = $('bossbar'); if (boss && boss.state !== 'dead') { bb.style.opacity = 1; $('bossbar-i').style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%'; } else bb.style.opacity = 0;
  // rage tint
  $('ragefx').style.opacity = me.rageOn > 0 ? 0.6 : 0;
  // dynamic music
  const fight = G.hunters.some(h => (h.state === 'chase' || h.state === 'attack' || h.state === 'charge') && Math.hypot(h.x - me.x, h.z - me.z) < 22);
  if (fight && G.music !== 'war' && !G.arenaActive) { G.music = 'war'; A.drumsSet('tense', 92, 0.9); } else if (!fight && G.music === 'war' && !G.arenaActive) { G.music = 'calm'; A.drumsSet('heart', 64, 0.35); }
}
let cueFreeze = 0, cueMove = 0;
function meeraCues(dt) { cueFreeze -= dt; cueMove -= dt; const near = G.hunters.find(h => h.arena < 0 && h.state !== 'dead' && Math.hypot(h.x - me.x, h.z - me.z) < 14); if (!near) return; if (near.state === 'listen' && cueFreeze <= 0) { cueFreeze = 12; hostCue('c_sneak', 2.4); } if (near.state === 'investigate' && cueMove <= 0) { cueMove = 9; hostCue('c_move', 2); } }

// ---------------- main loop ----------------
let last = performance.now(), fpsAcc = 0, fpsN = 0;
function frame(now) {
  if (!window.__paused) requestAnimationFrame(frame); window.__frames = (window.__frames || 0) + 1; window.__lastFrameMs = now - last;
  const rdt = Math.min(0.05, (now - last) / 1000); last = now; fpsAcc += rdt; fpsN++; if (fpsAcc > 1) { $('fps').textContent = Math.round(fpsN / fpsAcc) + ' fps'; fpsAcc = 0; fpsN = 0; }
  if (!me) { renderer.render(scene, camera); return; }
  // time scale: hit-stop & slow-mo (local feel only)
  let dt = rdt; if (G.hitStop > 0) { G.hitStop -= rdt; dt = rdt * 0.05; } else if (G.slowmo > 0) { G.slowmo -= rdt; dt = rdt * 0.3; }
  G.t += dt; pollInput();
  if (G.started && !G.restarting && !G.complete) {
    playerUpdate(me, dt);
    if (isAuth()) { for (const p of [me, other]) { if (!p || (p === other && p.tx == null && !G.solo)) continue; if (p.noise > 0.1) addSound(p.x, p.z, p.noise * 13, 'player', p); } enemyUpdate(dt); G.sounds = G.sounds.filter(s => (s.life -= dt) > 0); meeraCues(dt); arenaUpdate(dt); for (const p of [me, other]) { if (p && p.down) { p.downT -= dt; if (p.downT <= 0) restart(p.who); } } }
    stonesUpdate(dt); if (other) remoteTick(other, dt); meeraUpdate(dt); runScript(dt);
    G.netAcc += rdt; if (G.netAcc >= 0.05) { G.netAcc = 0; Net.send(pack(me)); }
    if (Net.isHost) { G.wsAcc += rdt; if (G.wsAcc >= 0.066) { G.wsAcc = 0; Net.send({ t: 'ws', h: G.hunters.map(h => [+h.x.toFixed(2), +h.z.toFixed(2), +h.yaw.toFixed(2), h.state, h.hp, h.type, h.arena]), hp: [K().hp, S().hp], k: G.kills, a: G.arena, aa: G.arenaActive ? 1 : 0, cl: ARENAS.map((a, i) => G.cleared[i] ? 1 : 0), cp: G.checkpoint }); } }
    else if (!G.solo) { for (const h of G.hunters) { if (h.gx != null) { h.x += (h.gx - h.x) * Math.min(1, dt * 12); h.z += (h.gz - h.z) * Math.min(1, dt * 12); } h.st += dt; h.flashT = Math.max(0, (h.flashT || 0) - dt); if (h.state === 'dead' && h.st > 3) h.rig.g.visible = false; if (h.state === 'chase' || h.state === 'investigate' || h.state === 'patrol' || h.state === 'charge') h.ph += dt * (h.state === 'chase' ? 12 : h.state === 'charge' ? 14 : h.state === 'investigate' ? 7 : 4); } }
  } else if (me) me.at += dt;
  // thorn walls sink when open
  thornWalls.forEach((w, i) => { const want = G.cleared[i] ? 1 : 0; if (w.userData.open !== want) { w.userData.open = U.clamp(w.userData.open + (want ? dt * 0.5 : -dt), 0, 1); } w.position.y = -4.5 * U.smooth(w.userData.open); w.visible = w.userData.open < 1; });
  // place & pose
  for (const p of [me, other, meera]) { if (!p) continue; if (p === other && (p.tx == null || G.solo)) { p.rig.g.visible = false; continue; } p.rig.g.visible = true; const y = terrainH(p.x, p.z); p.rig.g.position.set(p.x, y, p.z); p.rig.g.rotation.y = p.yaw; poseRig(p.rig, { anim: p.anim, t: p.at, phase: p.phase, combo: p.combo, globalT: G.t + (p.who === 'S' ? 1.3 : 0) }); if (p.rig.weapon) p.rig.weapon.visible = true; }
  for (const h of G.hunters) { if (!h.rig.g.visible) continue; h.rig.g.position.set(h.x, terrainH(h.x, h.z), h.z); h.rig.g.rotation.y = h.yaw; poseHunter(h.rig, h, G.t + h.id); }
  PARTS.update(dt);
  const k = K(); if (k) { const ky = terrainH(k.x, k.z); torch.position.set(k.x + Math.sin(k.yaw + 0.5) * 0.5, ky + 1.6, k.z + Math.cos(k.yaw + 0.5) * 0.5); torch.intensity = (k.rig.g.visible ? 1 : 0) * (3.2 + Math.sin(G.t * 17) * 0.35 + Math.sin(G.t * 31) * 0.2) * (me.rageOn > 0 ? 1.6 : 1); torch.color.setHex(me.rageOn > 0 ? 0xff6a30 : 0xffa040); }
  moon.position.set(me.x - 30, 60, me.z - 20); moon.target.position.set(me.x, 0, me.z); moon.target.updateMatrixWorld();
  { const pos = flies.geometry.attributes.position, base = flies.userData.base; for (let i = 0; i < base.length; i++) { const b = base[i]; if (Math.abs(b[2] - me.z) > 60) continue; pos.setX(i, b[0] + Math.sin(G.t * 0.7 + b[3]) * 0.8); pos.setY(i, b[1] + Math.sin(G.t * 1.1 + b[3] * 2) * 0.4); pos.setZ(i, b[2] + Math.cos(G.t * 0.5 + b[3]) * 0.8); } pos.needsUpdate = true; flies.material.opacity = 0.6 + Math.sin(G.t * 3) * 0.3; }
  for (const m of mists) m.position.x = m.userData.x + Math.sin(G.t * 0.15 + m.userData.ph) * 2;
  cameraUpdate(rdt); hudUpdate(rdt);
  if (fx) composer.render(); else renderer.render(scene, camera);
  if (window.__capture) { window.__capture = false; window.__shot = canvas.toDataURL('image/jpeg', 0.85); }
}
requestAnimationFrame(frame); window.__resume = () => { window.__paused = false; requestAnimationFrame(frame); };

// ---------------- lobby ----------------
function setLang(l) { E.st.lang = l; document.documentElement.lang = l; document.querySelectorAll('[data-en]').forEach(el => el.textContent = l === 'ta' ? el.dataset.ta : el.dataset.en); $('lang-en').classList.toggle('on', l === 'en'); $('lang-ta').classList.toggle('on', l === 'ta'); try { localStorage.setItem('tf_lang', l); } catch (e) { } }
$('lang-en').onclick = () => setLang('en'); $('lang-ta').onclick = () => setLang('ta'); try { setLang(localStorage.getItem('tf_lang') || 'en'); } catch (e) { setLang('en'); }
function rules() { $('rules-title').textContent = T('r2_title') + ' · 3D'; const ul = $('rules-lines'); ul.innerHTML = ''; const lines = [
  L('Get both of you through the forest to the gate. Four ambush clearings block the way — clear each one to open the thorns. The last one has something old in it.', 'இருவரும் காட்டைக் கடந்து வாசலை அடையணும். நாலு ambush clearings வழியை அடைக்கும் — ஒவ்வொண்ணையும் clear பண்ணா முள் திறக்கும். கடைசியில பழசான ஏதோ ஒண்ணு இருக்கு.'),
  L('FIGHT: J / click = attack (3-hit combo). K / right-click = heavy (breaks big ones). Space = dodge — enemies FLASH RED before they strike. Roll then.', 'சண்டை: J / click = தாக்கு (3-hit combo). K / right-click = கனமா (பெரிசுகளை உடைக்கும்). Space = dodge — எதிரிகள் அடிக்கிறதுக்கு முன்னாடி சிவப்பா மின்னும். அப்போ உருளுங்க.'),
  L('STEALTH: between clearings, hunters stand listening. Sneak (Shift) behind one and press E — a silent kill. Loud steps wake them.', 'பதுங்கல்: clearings நடுவுல வேட்டைக்காரர்கள் கேட்டுட்டு நிப்பாங்க. Shift-ல பின்னாடி போய் E அழுத்து — அமைதியான கொலை. சத்தமா நடந்தா எழுந்துடுவாங்க.'),
  L('THE TIGER: every hit fills the meter. Full = press R. Seven seconds of double damage. Use it on the big ones.', 'புலி: ஒவ்வொரு hit-ம் meter-ஐ நிரப்பும். நிறைஞ்சா R அழுத்து. ஏழு நொடி double damage. பெரிசுகள் மேல use பண்ணுங்க.'),
  L('If your partner falls, stand next to them and HOLD E to revive. If you both fall, you restart at the last clearing.', 'நண்பர் விழுந்தா பக்கத்துல நின்னு E பிடிச்சு எழுப்புங்க. ரெண்டு பேரும் விழுந்தா கடைசி clearing-ல மறுபடி.'),
]; lines.forEach(l => { const li = document.createElement('li'); li.textContent = l; ul.appendChild(li); }); $('rules').classList.remove('hidden'); $('rules-ok').onclick = () => { $('rules').classList.add('hidden'); A.ensure(); G.readyMe = true; Net.send({ t: 'ready' }); $('lobby-status').textContent = ''; tryStart(); if (!G.started) { $('hud').classList.remove('hidden'); hint(T('ready')); } }; }
function beginGame() { $('lobby').classList.add('hidden'); me = makePlayer(isAuth() ? 'K' : 'S'); other = makePlayer(isAuth() ? 'S' : 'K'); other.tx = null; meera = { who: 'M', rig: makeRig('M'), x: 1, z: 1, yaw: Math.PI, anim: 'idle', at: 0, phase: 0, combo: 0, hp: 5, noise: 0, inv: 0 }; scene.add(meera.rig.g); $('hp-me-name').textContent = T(me.who === 'K' ? 'hud_k' : 'hud_s'); $('hp-other-name').textContent = T(other.who === 'K' ? 'hud_k' : 'hud_s'); $('hp-me-name').style.color = me.who === 'K' ? '#c9a15c' : '#8fc0c8'; $('hp-other-name').style.color = other.who === 'K' ? '#c9a15c' : '#8fc0c8'; if (G.solo) $('hp-other-name').parentElement.style.display = 'none'; resetAll(); camPos.set(0, 3, 6); $('fade').style.opacity = 0; rules(); }
Net.S.onConnect = () => { $('lobby-status').textContent = 'Connected! Starting…'; if (Net.isHost) setTimeout(() => { Net.send({ t: 'go' }); beginGame(); }, 600); };
const rawOnMessage = Net.S.onMessage; Net.S.onMessage = m => { if (m.t === 'go') { if (!me) beginGame(); return; } rawOnMessage(m); };
Net.S.onDisconnect = () => hint('Partner disconnected');
$('btn-create').onclick = async () => { A.ensure(); const code = U.roomCode(); $('btn-create').disabled = true; try { await Net.host(code); $('room-code').textContent = code; $('room-box').classList.remove('hidden'); $('join-box').classList.add('hidden'); $('lobby-status').textContent = 'Send this code to your friend. The game starts when they join.'; $('room-link').value = location.origin + location.pathname + '?join=' + code + (Net.S.local ? '&local' : ''); } catch (e) { $('lobby-status').textContent = 'Could not create room: ' + (e.message || e.type || e); $('btn-create').disabled = false; } };
$('btn-copy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('room-link').value); };
async function join(code) { code = (code || '').trim().toUpperCase(); if (code.length !== 4) return; A.ensure(); $('btn-join').disabled = true; $('lobby-status').textContent = 'Connecting…'; try { await Net.join(code); } catch (e) { $('lobby-status').textContent = 'Could not connect (' + (e.message || e.type || e) + ')'; $('btn-join').disabled = false; } }
$('btn-join').onclick = () => join($('join-code').value); $('join-code').addEventListener('keydown', e => { if (e.key === 'Enter') join($('join-code').value); });
if (qs.get('join')) $('join-code').value = qs.get('join').toUpperCase();
$('btn-solo').onclick = () => { A.ensure(); G.solo = true; Net.S.role = 'host'; beginGame(); };
$('btn-mute').onclick = () => { A.ensure(); const m = $('btn-mute').classList.toggle('muted'); A.setVolume(m ? 0 : 0.8); };
$('btn-fs').onclick = () => { const el = document.documentElement; if (!document.fullscreenElement) el.requestFullscreen && el.requestFullscreen(); else document.exitFullscreen(); };
$('btn-fx').onclick = () => { fx = !fx; $('btn-fx').style.opacity = fx ? 1 : 0.5; };
$('btn-again').onclick = () => location.reload();
if (qs.has('solo')) setTimeout(() => $('btn-solo').click(), 200);
window.__G = G; window.__me = () => me; window.__other = () => other; window.__scene = scene; window.__ARENAS = ARENAS;
