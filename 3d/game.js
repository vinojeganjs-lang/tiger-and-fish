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
function makeHunter() {
  const g = new THREE.Group(); const m = MAT.hunter;
  const body = new THREE.Group(); body.position.y = 1.0; g.add(body);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.6, 3, 8), m); chest.rotation.x = 1.1; chest.position.set(0, 0.15, 0.1); chest.castShadow = true; body.add(chest);
  const spine = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 3, 8), m); spine.rotation.x = 0.6; spine.position.set(0, -0.15, -0.3); spine.castShadow = true; body.add(spine);
  const neck = new THREE.Group(); neck.position.set(0, 0.35, 0.5); body.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), m); head.scale.set(0.8, 0.9, 1.3); head.castShadow = true; neck.add(head);
  for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 5), m); ear.position.set(sx * 0.2, 0.22, -0.05); ear.rotation.z = -sx * 0.7; ear.rotation.x = -0.4; neck.add(ear); }
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.3), m); jaw.position.set(0, -0.14, 0.2); neck.add(jaw);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), MAT.eye); eye.position.set(0, 0.02, 0.3); eye.visible = false; neck.add(eye);
  const mkArm = (side) => { const sh = new THREE.Group(); sh.position.set(side * 0.38, 0.2, 0.25); body.add(sh); const up = limb(0.6, 0.13, m); sh.add(up); const el = new THREE.Group(); el.position.y = -0.6; up.add(el); const fo = limb(0.62, 0.11, m); el.add(fo); const claw = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 4), m); claw.position.y = -0.7; claw.rotation.x = Math.PI; fo.add(claw); return { sh, up, el, fo }; };
  const mkLeg = (side) => { const hp = new THREE.Group(); hp.position.set(side * 0.22, -0.35, -0.35); body.add(hp); const th = limb(0.5, 0.15, m); hp.add(th); const kn = new THREE.Group(); kn.position.y = -0.5; th.add(kn); const sh = limb(0.45, 0.11, m); kn.add(sh); return { hp, th, kn, sh }; };
  return { g, body, neck, head, eye, L: mkArm(-1), R: mkArm(1), LL: mkLeg(-1), RL: mkLeg(1) };
}
function poseHunter(r, h, gt) {
  const set = (o, x, y, z) => o.rotation.set(x, y, z); const s = Math.sin;
  const moving = h.state === 'chase' || h.state === 'investigate' || h.state === 'patrol'; const sp = h.state === 'chase' ? 13 : h.state === 'investigate' ? 8 : 4; const ph = h.ph;
  r.body.position.y = 1.0 + (moving ? Math.abs(s(ph)) * 0.06 : s(gt * 2) * 0.02); set(r.body, 0, 0, 0);
  const amp = moving ? (h.state === 'chase' ? 1.0 : 0.5) : 0.05;
  set(r.L.sh, 0.6 - s(ph) * amp, 0, 0.35); set(r.R.sh, 0.6 + s(ph) * amp, 0, -0.35); set(r.L.el, -0.4, 0, 0); set(r.R.el, -0.4, 0, 0);
  set(r.LL.hp, s(ph) * amp * 0.8, 0, 0); set(r.RL.hp, -s(ph) * amp * 0.8, 0, 0); set(r.LL.kn, 0.6 + Math.max(0, -s(ph)) * amp, 0, 0); set(r.RL.kn, 0.6 + Math.max(0, s(ph)) * amp, 0, 0);
  if (h.state === 'listen') { set(r.neck, -0.5 + s(gt * 3) * 0.1, s(gt * 1.3) * 0.9, 0); r.body.position.y = 1.15; set(r.L.sh, -0.2, 0, 0.5); set(r.R.sh, -0.2, 0, -0.5); }
  else if (h.state === 'attack') { const k = U.clamp(h.st / 0.75, 0, 1); const anti = U.smooth(U.clamp(k / 0.6, 0, 1)), lunge = U.smooth(U.clamp((k - 0.6) / 0.25, 0, 1)); set(r.L.sh, -2.2 * anti + 3.2 * lunge, 0, 0.6); set(r.R.sh, -2.2 * anti + 3.2 * lunge, 0, -0.6); set(r.body, -0.3 * anti + 0.7 * lunge, 0, 0); set(r.neck, -0.4 * anti + 0.5 * lunge, 0, 0); r.body.position.y = 1.0 + 0.25 * anti - 0.3 * lunge; }
  else if (h.state === 'stagger') { const k = U.clamp(h.st / 0.35, 0, 1); const f = s(k * Math.PI); set(r.body, -0.5 * f, 0.3 * f, 0); set(r.neck, 0.5 * f, 0, 0); }
  else if (h.state === 'dead') { const k = U.clamp(h.st / 0.8, 0, 1); set(r.body, 1.3 * k, 0, 0.5 * k); r.body.position.y = U.lerp(1.0, 0.35, k); set(r.L.sh, 1.5 * k, 0, 0.8); set(r.R.sh, 1.5 * k, 0, -0.8); }
  else set(r.neck, moving && h.state === 'chase' ? 0.3 : -0.2, s(gt * 0.7 + ph) * 0.2, 0);
  r.eye.visible = h.state === 'chase' || h.state === 'attack';
}

// ---------------- game state ----------------
const G = { started: false, complete: false, restarting: false, solo: false, readyMe: false, readyOther: false, t: 0, kills: 0, hunters: [], stones: [], sounds: [], cueT: 0, dlgT: 0, netAcc: 0, wsAcc: 0, camYaw: 0, camPitch: -0.18, dragging: false, lastHostHp: 5, lastGuestHp: 5 };
function makePlayer(who) { const rig = makeRig(who); scene.add(rig.g); return { who, rig, x: 0, z: 0, y: 0, yaw: Math.PI, vx: 0, vz: 0, anim: 'idle', at: 0, phase: 0, combo: 0, comboT: 0, hp: 5, noise: 0, dodgeT: 0, dodgeDir: [0, -1], atkT: 0, hitT: 0, dead: false, stoneCd: 0, tx: null, tz: null, tyaw: 0, inv: 0, hitApplied: false, sneak: false, torch: who === 'K' }; }
let me, other, meera;
const K = () => Net.isHost || G.solo ? me : other, S = () => Net.isHost || G.solo ? other : me;

// ---------------- input ----------------
const keys = {}; const inp = { mx: 0, mz: 0, sneak: false, atk: false, hvy: false, dodge: false, stone: false };
const edge = { atk: false, hvy: false, dodge: false, stone: false };
window.addEventListener('keydown', e => { if (e.target && e.target.tagName === 'INPUT') return; if (!keys[e.code]) { if (e.code === 'KeyJ') edge.atk = true; if (e.code === 'KeyK') edge.hvy = true; if (e.code === 'Space') edge.dodge = true; if (e.code === 'KeyE') edge.stone = true; } keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
let lastMX = 0, lastMY = 0;
canvas.addEventListener('mousedown', e => { if (!G.started) return; if (e.button === 0) edge.atk = true; if (e.button === 2) edge.hvy = true; G.dragging = true; lastMX = e.clientX; lastMY = e.clientY; });
window.addEventListener('mouseup', () => G.dragging = false);
window.addEventListener('mousemove', e => { if (G.dragging) { G.camYaw -= (e.clientX - lastMX) * 0.005; G.camPitch = U.clamp(G.camPitch - (e.clientY - lastMY) * 0.003, -0.6, 0.25); G.camManualT = 1.5; lastMX = e.clientX; lastMY = e.clientY; } });
// touch: joystick + look drag + buttons
const stick = { active: false, id: null, cx: 0, cy: 0, dx: 0, dy: 0 }; const look = { id: null, lx: 0, ly: 0 };
const stickEl = $('stick'), knob = stickEl.querySelector('i');
stickEl.addEventListener('touchstart', e => { const t = e.changedTouches[0]; stick.active = true; stick.id = t.identifier; const r = stickEl.getBoundingClientRect(); stick.cx = r.left + r.width / 2; stick.cy = r.top + r.height / 2; e.preventDefault(); }, { passive: false });
window.addEventListener('touchmove', e => { for (const t of e.changedTouches) { if (t.identifier === stick.id) { let dx = t.clientX - stick.cx, dy = t.clientY - stick.cy; const d = Math.hypot(dx, dy); if (d > 50) { dx *= 50 / d; dy *= 50 / d; } stick.dx = dx / 50; stick.dy = dy / 50; knob.style.transform = `translate(${dx}px,${dy}px)`; } else if (t.identifier === look.id) { G.camYaw -= (t.clientX - look.lx) * 0.006; G.camPitch = U.clamp(G.camPitch - (t.clientY - look.ly) * 0.004, -0.6, 0.25); G.camManualT = 1.5; look.lx = t.clientX; look.ly = t.clientY; } } }, { passive: false });
window.addEventListener('touchend', e => { for (const t of e.changedTouches) { if (t.identifier === stick.id) { stick.active = false; stick.id = null; stick.dx = stick.dy = 0; knob.style.transform = ''; } if (t.identifier === look.id) look.id = null; } });
canvas.addEventListener('touchstart', e => { for (const t of e.changedTouches) { if (t.clientX > window.innerWidth * 0.4 && look.id === null) { look.id = t.identifier; look.lx = t.clientX; look.ly = t.clientY; } } }, { passive: true });
document.querySelectorAll('#touch [data-btn]').forEach(b => { const k = b.dataset.btn; const on = ev => { ev.preventDefault(); if (k === 'sneak') keys.Tsneak = true; else edge[k] = true; b.classList.add('on'); }; const off = ev => { ev.preventDefault(); if (k === 'sneak') keys.Tsneak = false; b.classList.remove('on'); }; b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off); b.addEventListener('touchcancel', off); });
function pollInput() { let mx = 0, mz = 0; if (keys.KeyW || keys.ArrowUp) mz -= 1; if (keys.KeyS || keys.ArrowDown) mz += 1; if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1; if (stick.active) { mx = stick.dx; mz = stick.dy; } const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; } inp.mx = mx; inp.mz = mz; inp.sneak = !!(keys.ShiftLeft || keys.ShiftRight || keys.Tsneak); inp.atk = edge.atk; inp.hvy = edge.hvy; inp.dodge = edge.dodge; inp.stone = edge.stone; edge.atk = edge.hvy = edge.dodge = edge.stone = false; }

// ---------------- HUD helpers ----------------
function cue(id, dur = 3.2) { $('cue-text').textContent = T(id); $('cue').style.opacity = 1; G.cueT = dur; A.sfx('cue'); }
function say(sp, id, dur = 4) { $('dlg-sp').textContent = sp; $('dlg-sp').style.color = sp === 'MEERA' ? '#d9b48a' : sp === 'SELVAM' ? '#8fc0c8' : sp === 'KUMARAN' ? '#c9a15c' : '#c96a5a'; $('dlg-tx').textContent = T(id); $('dialog').style.opacity = 1; G.dlgT = dur; }
function hint(t) { $('hint').textContent = t; }
function hostCue(id, dur) { cue(id, dur); Net.send({ t: 'ev', k: 'cue', id, dur }); }
function hostSay(sp, id, dur) { say(sp, id, dur); Net.send({ t: 'ev', k: 'say', sp, id, dur }); }
const script = []; let scriptT = 0;
function runScript(dt) { if (!script.length) return; scriptT += dt; while (script.length && script[0].at <= scriptT) { const L = script.shift(); if (L.cue) cue(L.cue, L.dur); else say(L.sp, L.id, L.dur); } }

// ---------------- world helpers ----------------
function blocked(x, z, r = 0.5) { for (const t of window.__trees) { const d = Math.hypot(t[0] - x, t[1] - z); if (d < t[2] + r) return t; } return null; }
function moveWithCollision(p, nx, nz) { const t = blocked(nx, nz); if (!t) { p.x = nx; p.z = nz; return; } // slide
  const t2 = blocked(nx, p.z); if (!t2) { p.x = nx; return; } const t3 = blocked(p.x, nz); if (!t3) { p.z = nz; return; } }
function addSound(x, z, r, kind, p) { G.sounds.push({ x, z, r, kind, p, life: 0.12 }); }

// ---------------- hunters (host authoritative) ----------------
const HUNTER_SPOTS = [[-6, -55, 18], [10, -95, 14], [-12, -150, 20], [8, -152, 16], [0, -215, 24], [-14, -280, 18], [12, -330, 20], [-4, -390, 22], [14, -440, 16], [-10, -470, 18], [3, -505, 14]];
function spawnHunters() { for (const h of G.hunters) scene.remove(h.rig.g); G.hunters = HUNTER_SPOTS.map((s, i) => { const rig = makeHunter(); scene.add(rig.g); return { id: i, rig, x: s[0], z: s[1], ax: s[0], az: s[1], range: s[2], yaw: rng() * 6.28, state: 'patrol', st: 0, tx: s[0] + s[2] * 0.5, tz: s[1], hp: 4, ph: rng() * 6, alert: 0, target: null, gx: null, gz: null }; }); }
function hunterUpdate(dt) {
  const players = [me, other].filter(p => p && (p === me || p.tx != null || G.solo));
  for (const h of G.hunters) {
    h.st += dt; if (h.state === 'dead') { if (h.st > 3) { h.rig.g.visible = false; } continue; }
    // hearing
    let heard = null, best = 1e9; for (const s of G.sounds) { const d = Math.hypot(s.x - h.x, s.z - h.z); const rr = s.r * (h.state === 'listen' ? 1.7 : 1); if (d < rr && d < best) { best = d; heard = s; } }
    if (heard && h.state !== 'attack' && h.state !== 'stagger') { if (heard.kind === 'stone') { if (h.state !== 'chase') { h.state = 'investigate'; h.tx = heard.x; h.tz = heard.z; h.st = 0; } } else { if (h.state !== 'chase') { A.sfx('growl', 0.5); Net.send({ t: 'ev', k: 'sfx', n: 'growl', x: h.x, z: h.z }); } h.state = 'chase'; h.tx = heard.x; h.tz = heard.z; h.target = heard.p; h.st = 0; } }
    const sp = h.state === 'chase' ? 5.6 : h.state === 'investigate' ? 3.4 : 1.4;
    if (h.state === 'patrol') { const dx = h.tx - h.x, dz = h.tz - h.z, d = Math.hypot(dx, dz); if (d < 0.5) { const a = rng() * 6.28; h.tx = h.ax + Math.cos(a) * h.range * rng(); h.tz = h.az + Math.sin(a) * h.range * rng() * 0.6; if (rng() < 0.5) { h.state = 'listen'; h.st = 0; } } else { h.x += dx / d * sp * dt; h.z += dz / d * sp * dt; h.yaw = Math.atan2(dx, dz); h.ph += dt * 4; } }
    else if (h.state === 'listen') { if (h.st > 1.6) { h.state = 'patrol'; h.st = 0; } }
    else if (h.state === 'investigate' || h.state === 'chase') {
      if (h.state === 'chase' && h.target) { // keep updating target position if target is still noisy
        const tp = h.target; const d = Math.hypot(tp.x - h.x, tp.z - h.z); if (tp.noise > 0.15 && d < 18) { h.tx = tp.x; h.tz = tp.z; h.st = Math.min(h.st, 0.3); }
        if (d < 1.9 && !tp.dead) { h.state = 'attack'; h.st = 0; h.yaw = Math.atan2(tp.x - h.x, tp.z - h.z); h.hitDone = false; continue; }
      }
      const dx = h.tx - h.x, dz = h.tz - h.z, d = Math.hypot(dx, dz);
      if (d > 0.4) { const nx = h.x + dx / d * sp * dt, nz = h.z + dz / d * sp * dt; const b = blocked(nx, nz, 0.4); if (!b) { h.x = nx; h.z = nz; } else { h.x += dz / d * sp * dt * 0.7; h.z -= dx / d * sp * dt * 0.7; } h.yaw = Math.atan2(dx, dz); h.ph += dt * (h.state === 'chase' ? 12 : 7); }
      else if (h.st > (h.state === 'chase' ? 1.3 : 2.5)) { h.state = 'listen'; h.st = 0; h.target = null; }
      if (h.state === 'chase' && h.st > 6) { h.state = 'listen'; h.st = 0; h.target = null; }
    }
    else if (h.state === 'attack') { const tp = h.target; if (h.st > 0.45 && h.st < 0.62 && !h.hitDone && tp) { h.hitDone = true; const d = Math.hypot(tp.x - h.x, tp.z - h.z); const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw); const dot = ((tp.x - h.x) * fx + (tp.z - h.z) * fz) / Math.max(0.01, d); if (d < 2.4 && dot > 0.3 && tp.inv <= 0) damagePlayer(tp, 1, h); } if (h.st > 0.45 && h.st < 0.6) { h.x += Math.sin(h.yaw) * 6 * dt; h.z += Math.cos(h.yaw) * 6 * dt; } if (h.st > 0.9) { h.state = 'chase'; h.st = 0; if (tp) { h.tx = tp.x; h.tz = tp.z; } } }
    else if (h.state === 'stagger') { if (h.st > 0.35) { h.state = 'chase'; h.st = 0; } }
    h.x = U.clamp(h.x, -HALF - 4, HALF + 4);
  }
}
function damageHunter(h, dmg, from) { if (h.state === 'dead') return; h.hp -= dmg; A.sfx('thud', 0.5); Net.send({ t: 'ev', k: 'sfx', n: 'thud', x: h.x, z: h.z }); if (h.hp <= 0) { h.state = 'dead'; h.st = 0; G.kills++; A.sfx('death', 0.5); Net.send({ t: 'ev', k: 'sfx', n: 'death', x: h.x, z: h.z }); } else { h.state = 'stagger'; h.st = 0; h.target = from.__real || from; h.tx = from.x; h.tz = from.z; const d = Math.hypot(h.x - from.x, h.z - from.z) || 1; h.x += (h.x - from.x) / d * (dmg >= 3 ? 1.6 : 0.5); h.z += (h.z - from.z) / d * (dmg >= 3 ? 1.6 : 0.5); } }
function damagePlayer(p, dmg, h) { if (p.dead || G.restarting) return; p.hp -= dmg; p.hitT = 0.35; p.anim = 'hit'; p.at = 0; p.inv = 0.8; const d = Math.hypot(p.x - h.x, p.z - h.z) || 1; p.x += (p.x - h.x) / d * 1.2; p.z += (p.z - h.z) / d * 1.2; if (p === me) { hurtFlash(); } A.sfx('thud', 0.5); Net.send({ t: 'ev', k: 'hurt', who: p.who, hp: p.hp, x: p.x, z: p.z }); if (p.hp <= 0) { p.dead = true; p.anim = 'dead'; p.at = 0; restart(p.who); } }
function hurtFlash() { $('hurt').style.opacity = 1; setTimeout(() => $('hurt').style.opacity = 0, 250); }
async function restart(who) { if (G.restarting) return; G.restarting = true; if (Net.isHost) Net.send({ t: 'ev', k: 'restart', who }); A.sfx('death', 0.5); await new Promise(r => setTimeout(r, 1100)); $('fade').style.opacity = 1; await new Promise(r => setTimeout(r, 900)); resetAll(); $('fade').style.opacity = 0; G.restarting = false; say('MEERA', 'restart', 3.5); }
function resetAll() { for (const p of [me, other]) { if (!p) continue; p.x = p.who === 'K' ? -1.5 : 1.5; p.z = -4; p.yaw = Math.PI; p.hp = 5; p.dead = false; p.anim = 'idle'; p.at = 0; p.inv = 0; p.hitT = 0; p.atkT = 0; p.dodgeT = 0; p.noise = 0; } other.tx = null; spawnHunters(); G.stones.forEach(s => scene.remove(s.m)); G.stones = []; G.sounds = []; G.camYaw = 0; meera.x = 0; meera.z = 0; updateHP(); }

// ---------------- player update ----------------
function playerUpdate(p, dt) {
  p.inv = Math.max(0, p.inv - dt); p.stoneCd = Math.max(0, p.stoneCd - dt); p.at += dt; p.comboT = Math.max(0, p.comboT - dt);
  if (p.dead) return;
  const busy = p.anim === 'attack' || p.anim === 'heavy' || p.anim === 'dodge' || p.anim === 'hit' || p.anim === 'throw';
  // finish timed anims
  const dur = { attack: 0.42, heavy: 0.8, dodge: 0.5, hit: 0.35, throw: 0.45 }[p.anim];
  if (busy && p.at >= dur) { p.anim = 'idle'; p.at = 0; }
  // camera-relative move
  const cy = G.camYaw; const fx = -Math.sin(cy), fz = -Math.cos(cy); const rx = Math.cos(cy), rz = -Math.sin(cy);
  let mx = inp.mx * rx + (-inp.mz) * fx, mz = inp.mx * rz + (-inp.mz) * fz; const ml = Math.hypot(mx, mz);
  const canAct = !busy || (p.anim === 'attack' && p.at > 0.25);
  // dodge
  if (inp.dodge && !busy || (inp.dodge && p.anim === 'attack' && p.at > 0.2)) { p.anim = 'dodge'; p.at = 0; p.inv = 0.35; if (ml > 0.1) { p.dodgeDir = [mx / ml, mz / ml]; } else { p.dodgeDir = [Math.sin(p.yaw), Math.cos(p.yaw)]; } p.yaw = Math.atan2(p.dodgeDir[0], p.dodgeDir[1]); A.sfx('whoosh', 0.5); p.noise = Math.max(p.noise, 0.8); }
  else if ((inp.atk || inp.hvy) && canAct) {
    if (inp.hvy) { p.anim = 'heavy'; p.combo = 0; } else { p.combo = p.anim === 'attack' || p.comboT > 0 ? (p.combo + 1) % 3 : 0; p.anim = 'attack'; p.comboT = 0.7; }
    p.at = 0; p.hitApplied = false; p.noise = Math.max(p.noise, 1.1);
    // lock on nearest hunter
    let best = null, bd = 7; for (const h of G.hunters) { if (h.state === 'dead') continue; const d = Math.hypot(h.x - p.x, h.z - p.z); if (d < bd) { bd = d; best = h; } }
    if (best) p.yaw = Math.atan2(best.x - p.x, best.z - p.z); else if (ml > 0.1) p.yaw = Math.atan2(mx, mz);
    A.sfx('whoosh', 0.5);
  }
  else if (inp.stone && !busy && p.stoneCd <= 0) { p.anim = 'throw'; p.at = 0; p.stoneCd = 2.5; if (ml > 0.1) p.yaw = Math.atan2(mx, mz); setTimeout(() => throwStone(p), 200); }
  // movement
  const busy2 = p.anim === 'attack' || p.anim === 'heavy' || p.anim === 'dodge' || p.anim === 'hit' || p.anim === 'throw';
  if (p.anim === 'dodge') { const k = p.at / 0.5; const sp = 9 * (1 - k * 0.6); moveWithCollision(p, p.x + p.dodgeDir[0] * sp * dt, p.z + p.dodgeDir[1] * sp * dt); }
  else if (busy2) { if (p.anim === 'attack' && p.at < 0.3) { moveWithCollision(p, p.x + Math.sin(p.yaw) * 2.2 * dt, p.z + Math.cos(p.yaw) * 2.2 * dt); } if (p.anim === 'heavy' && p.at < 0.5) { moveWithCollision(p, p.x + Math.sin(p.yaw) * 1.8 * dt, p.z + Math.cos(p.yaw) * 1.8 * dt); } }
  else if (ml > 0.05) { const sneak = inp.sneak; const sp = (sneak ? 2.0 : 4.6) * Math.min(1, ml * 1.2); const ny = Math.atan2(mx, mz); let dy = ny - p.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; p.yaw += dy * Math.min(1, dt * 12); moveWithCollision(p, p.x + mx / ml * sp * dt, p.z + mz / ml * sp * dt); p.anim = sneak ? 'sneak' : 'run'; p.phase += dt * (sneak ? 6 : 11); p.noise = Math.max(p.noise, sneak ? 0.3 : 0.75); p.sneak = sneak; if (Math.sin(p.phase) > 0.98 && !p.stepped) { p.stepped = true; A.sfx('step', 0.5); } if (Math.sin(p.phase) < 0) p.stepped = false; }
  else { p.anim = 'idle'; }
  p.x = U.clamp(p.x, -HALF, HALF); p.z = U.clamp(p.z, GATE_Z - 12, 6);
  p.noise = Math.max(0, p.noise - dt * 2.2);
  // attack hit detection (host applies; guest reports)
  if ((p.anim === 'attack' && p.at > 0.14 && p.at < 0.26 || p.anim === 'heavy' && p.at > 0.42 && p.at < 0.56) && !p.hitApplied) {
    p.hitApplied = true; const dmg = p.anim === 'heavy' ? 3 : 1; const reach = p.anim === 'heavy' ? 3.0 : 2.3;
    if (Net.isHost || G.solo) applyHit(p, dmg, reach); else Net.send({ t: 'act', k: 'hit', x: p.x, z: p.z, yaw: p.yaw, dmg, reach });
  }
}
function applyHit(p, dmg, reach) { const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw); let any = false; for (const h of G.hunters) { if (h.state === 'dead') continue; const dx = h.x - p.x, dz = h.z - p.z, d = Math.hypot(dx, dz); if (d < reach && (dx * fx + dz * fz) / (d || 1) > 0.35) { damageHunter(h, dmg, p); any = true; } } if (any && p === me) { shake = dmg >= 3 ? 0.5 : 0.2; } }
function throwStone(p) { const s = { x: p.x + Math.sin(p.yaw) * 0.6, y: terrainH(p.x, p.z) + 1.4, z: p.z + Math.cos(p.yaw) * 0.6, vx: Math.sin(p.yaw) * 14, vy: 5.5, vz: Math.cos(p.yaw) * 14, m: new THREE.Mesh(new THREE.DodecahedronGeometry(0.09), MAT.steel), id: Math.random() }; scene.add(s.m); G.stones.push(s); A.sfx('whoosh', 0.5); if (!(Net.isHost || G.solo)) Net.send({ t: 'act', k: 'stone', s: { x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz, id: s.id } }); }
function stonesUpdate(dt) { for (const s of G.stones) { if (s.done) continue; s.vy -= 16 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.m.position.set(s.x, s.y, s.z); s.m.rotation.x += dt * 10; const g = terrainH(s.x, s.z); if (s.y <= g + 0.08 || blocked(s.x, s.z, 0.05)) { s.done = true; s.y = g + 0.08; s.m.position.y = s.y; A.sfx('stone', 0.5); if (Net.isHost || G.solo) { addSound(s.x, s.z, 22, 'stone'); Net.send({ t: 'ev', k: 'sfx', n: 'stone', x: s.x, z: s.z }); } s.ttl = 6; } } G.stones = G.stones.filter(s => { if (s.done && (s.ttl -= dt) <= 0) { scene.remove(s.m); return false; } return true; }); }

// ---------------- meera ----------------
function meeraUpdate(dt) { const trail = (other && other.tx != null && !G.solo) ? ((me.z > other.z) ? me : other) : me; const tx = trail.x + Math.sin(trail.yaw + Math.PI) * 2.2 + 1.2, tz = trail.z + Math.cos(trail.yaw + Math.PI) * 2.2; const dx = tx - meera.x, dz = tz - meera.z, d = Math.hypot(dx, dz); if (d > 1.2) { const sp = Math.min(5.5, d * 1.5); meera.x += dx / d * sp * dt; meera.z += dz / d * sp * dt; meera.yaw = Math.atan2(dx, dz); meera.anim = sp > 3 ? 'run' : 'walk'; meera.phase += dt * (sp > 3 ? 11 : 7); } else meera.anim = 'idle'; }

// ---------------- net ----------------
function pack(p) { return { t: 'av', x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(3), a: p.anim, at: +p.at.toFixed(2), c: p.combo, n: +p.noise.toFixed(2), hp: p.hp, d: p.dead ? 1 : 0, ph: +p.phase.toFixed(2) }; }
function applyRemote(p, m) { if (p.tx == null || Math.hypot(m.x - p.x, m.z - p.z) > 8) { p.x = m.x; p.z = m.z; } p.tx = m.x; p.tz = m.z; p.tyaw = m.yaw; if (p.anim !== m.a || (m.a === 'attack' && m.c !== p.combo)) { p.at = m.at; } p.anim = m.a; p.combo = m.c; p.noise = m.n; p.phase = m.ph; if (!Net.isHost) { /* guest trusts host for hp */ } else { p.dead = !!m.d; } }
function remoteTick(p, dt) { if (p.tx == null) return; p.x += (p.tx - p.x) * Math.min(1, dt * 14); p.z += (p.tz - p.z) * Math.min(1, dt * 14); let dy = p.tyaw - p.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; p.yaw += dy * Math.min(1, dt * 14); p.at += dt; }
function onMessage(m) {
  if (m.t === 'av') applyRemote(other, m);
  else if (m.t === 'ready') { G.readyOther = true; tryStart(); }
  else if (m.t === 'ws') { m.h.forEach((v, i) => { const h = G.hunters[i]; if (!h) return; h.gx = v[0]; h.gz = v[1]; h.yaw = v[2]; if (h.state !== v[3]) { h.state = v[3]; h.st = 0; } h.hp = v[4]; if (h.gx != null && (Math.hypot(h.gx - h.x, h.gz - h.z) > 6)) { h.x = h.gx; h.z = h.gz; } }); if (m.hp) { const [hk, hs] = m.hp; K().hp = hk; S().hp = hs; } G.kills = m.k; }
  else if (m.t === 'ev') { if (m.k === 'start') start(); else if (m.k === 'cue') cue(m.id, m.dur); else if (m.k === 'say') say(m.sp, m.id, m.dur); else if (m.k === 'sfx') A.sfx(m.n, 0.5); else if (m.k === 'hurt') { const p = m.who === 'K' ? K() : S(); p.hp = m.hp; if (p === me) { p.hitT = 0.35; p.anim = 'hit'; p.at = 0; p.inv = 0.8; p.x = m.x; p.z = m.z; hurtFlash(); } if (m.hp <= 0) { p.dead = true; p.anim = 'dead'; p.at = 0; } } else if (m.k === 'restart') restart(m.who); else if (m.k === 'complete') complete(); }
  else if (m.t === 'act') { if (m.k === 'hit') { applyHit({ x: m.x, z: m.z, yaw: m.yaw, who: other.who, __real: other }, m.dmg, m.reach); } else if (m.k === 'stone') { const s = Object.assign({ m: new THREE.Mesh(new THREE.DodecahedronGeometry(0.09), MAT.steel) }, m.s); scene.add(s.m); G.stones.push(s); } }
}
Net.S.onMessage = onMessage;

// ---------------- flow ----------------
function tryStart() { if ((Net.isHost || G.solo) && G.readyMe && (G.readyOther || G.solo) && !G.started) { start(); Net.send({ t: 'ev', k: 'start' }); } }
function start() { G.started = true; $('rules').classList.add('hidden'); $('hud').classList.remove('hidden'); if (isTouch) $('touch').classList.remove('hidden'); A.ambience('forest'); A.drone(true, 49, 0.25); A.drumsStart(64, 'heart', 0.35); script.push({ at: 0.5, sp: 'MEERA', id: 'm2', dur: 5.5 }, { at: 6.3, sp: 'SELVAM', id: 's2', dur: 3 }, { at: 9.6, cue: 'c_listen', dur: 3.5 }); }
function complete() { if (G.complete) return; G.complete = true; A.sfx('success', 0.5); say('MEERA', 't2_done', 5); setTimeout(() => { $('fade').style.opacity = 1; setTimeout(() => { $('end-title').textContent = 'TRIAL II — 3D PROOF OF CONCEPT'; $('end-text').textContent = (E.st.lang === 'ta' ? `முடிச்சிட்டீங்க. வேட்டைக்காரர்கள் கொல்லப்பட்டது: ${G.kills} / ${HUNTER_SPOTS.length}.\n\nஇது 3D-ஓட proof of concept. இதே look & feel-ல முழு game-ஐயும் கட்டலாமா? உங்க decision.` : `You made it. Hunters killed: ${G.kills} / ${HUNTER_SPOTS.length}.\n\nThis is the 3D proof of concept. Same look and feel for the full game? Your call.`); $('endcard').classList.remove('hidden'); $('fade').style.opacity = 0; }, 1000); }, 5000); }

// ---------------- camera ----------------
let shake = 0; const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function cameraUpdate(dt) {
  const p = me; G.camManualT = Math.max(0, (G.camManualT || 0) - dt);
  // auto-follow yaw toward player's facing when moving and not dragging
  if (G.camManualT <= 0 && (p.anim === 'run' || p.anim === 'sneak' || p.anim === 'walk')) { let dy = (p.yaw + Math.PI) - G.camYaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; G.camYaw += dy * Math.min(1, dt * 1.6); }
  const cy = G.camYaw, cp = G.camPitch; const dist = 5.2, height = 2.2;
  const px = p.x, pz = p.z, py = terrainH(p.x, p.z);
  const bx = px + Math.sin(cy) * dist * Math.cos(cp), bz = pz + Math.cos(cy) * dist * Math.cos(cp), by = py + height - Math.sin(cp) * dist;
  // shoulder offset (right)
  const ox = Math.cos(cy) * 0.8, oz = -Math.sin(cy) * 0.8;
  const tx = bx + ox, tz = bz + oz; let ty = Math.max(by, terrainH(tx, tz) + 0.6);
  camPos.lerp(new THREE.Vector3(tx, ty, tz), Math.min(1, dt * 7));
  camLook.lerp(new THREE.Vector3(px - Math.sin(cy) * 1.5 + ox * 0.5, py + 1.35, pz - Math.cos(cy) * 1.5 + oz * 0.5), Math.min(1, dt * 9));
  camera.position.copy(camPos); if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake * 0.3; camera.position.y += (Math.random() - 0.5) * shake * 0.2; shake = Math.max(0, shake - dt * 2); }
  camera.lookAt(camLook);
}

// ---------------- HUD state ----------------
function updateHP() { const mine = me.hp, oth = other ? other.hp : 5; $('hp-me').style.width = Math.max(0, mine) * 20 + '%'; $('hp-other').style.width = Math.max(0, oth) * 20 + '%'; }
function hudUpdate(dt) { if (G.cueT > 0) { G.cueT -= dt; if (G.cueT <= 0) $('cue').style.opacity = 0; } if (G.dlgT > 0) { G.dlgT -= dt; if (G.dlgT <= 0) $('dialog').style.opacity = 0; } updateHP(); $('noise').textContent = me.noise > 0.6 ? 'LOUD' : me.noise > 0.1 ? 'quiet' : 'silent'; $('noise').style.color = me.noise > 0.6 ? '#e07060' : '#9ab'; const near = G.hunters.find(h => h.state !== 'dead' && Math.hypot(h.x - me.x, h.z - me.z) < 10); hint(near ? (near.state === 'chase' || near.state === 'attack' ? (E.st.lang === 'ta' ? 'சண்டை — J தாக்கு · K கனமா · Space dodge' : 'FIGHT — J attack · K heavy · Space dodge') : (E.st.lang === 'ta' ? 'பதுங்கு (Shift) · E கல் எறி' : 'Sneak (Shift) · E throw stone')) : (E.st.lang === 'ta' ? 'காட்டோட முடிவுல இருக்கிற வாசலை அடையுங்க' : 'Reach the gate at the end of the forest')); }
// Meera cues from host
let cueFreeze = 0, cueMove = 0;
function meeraCues(dt) { cueFreeze -= dt; cueMove -= dt; const near = G.hunters.find(h => h.state !== 'dead' && Math.hypot(h.x - me.x, h.z - me.z) < 14); if (!near) return; if (near.state === 'listen' && cueFreeze <= 0) { cueFreeze = 8; hostCue('c_freeze', 1.8); } if (near.state === 'investigate' && cueMove <= 0) { cueMove = 9; hostCue('c_move', 2); } }

// ---------------- main loop ----------------
let last = performance.now(), fpsAcc = 0, fpsN = 0;
function frame(now) {
  if (!window.__paused) requestAnimationFrame(frame); window.__frames = (window.__frames || 0) + 1; window.__lastFrameMs = now - last; const dt = Math.min(0.05, (now - last) / 1000); last = now; G.t += dt; fpsAcc += dt; fpsN++; if (fpsAcc > 1) { $('fps').textContent = Math.round(fpsN / fpsAcc) + ' fps'; fpsAcc = 0; fpsN = 0; }
  if (!me) { renderer.render(scene, camera); return; }
  pollInput();
  if (G.started && !G.restarting && !G.complete) {
    playerUpdate(me, dt);
    // my noise → sounds (host/solo evaluates)
    if (Net.isHost || G.solo) { for (const p of [me, other]) { if (!p || (p === other && p.tx == null && !G.solo)) continue; if (p.noise > 0.1) addSound(p.x, p.z, p.noise * 13, 'player', p); } hunterUpdate(dt); G.sounds = G.sounds.filter(s => (s.life -= dt) > 0); meeraCues(dt); }
    stonesUpdate(dt);
    if (other) remoteTick(other, dt);
    // completion: both near gate
    if (Net.isHost || G.solo) { const near = p => p && Math.hypot(p.x, p.z - GATE_Z) < 7; if (near(me) && (G.solo || (other.tx != null && near(other)))) { Net.send({ t: 'ev', k: 'complete' }); complete(); } }
    meeraUpdate(dt); runScript(dt);
    // networking
    G.netAcc += dt; if (G.netAcc >= 0.05) { G.netAcc = 0; Net.send(pack(me)); }
    if (Net.isHost) { G.wsAcc += dt; if (G.wsAcc >= 0.066) { G.wsAcc = 0; Net.send({ t: 'ws', h: G.hunters.map(h => [+h.x.toFixed(2), +h.z.toFixed(2), +h.yaw.toFixed(2), h.state, h.hp]), hp: [K().hp, S().hp], k: G.kills }); } }
    else if (!G.solo) { for (const h of G.hunters) { if (h.gx != null) { h.x += (h.gx - h.x) * Math.min(1, dt * 12); h.z += (h.gz - h.z) * Math.min(1, dt * 12); } h.st += dt; if (h.state === 'dead' && h.st > 3) h.rig.g.visible = false; if (h.state === 'chase' || h.state === 'investigate' || h.state === 'patrol') h.ph += dt * (h.state === 'chase' ? 12 : h.state === 'investigate' ? 7 : 4); } }
  } else if (me) { me.at += dt; }
  // place & pose
  for (const p of [me, other, meera]) { if (!p) continue; if (p === other && p.tx == null && !G.solo) { p.rig.g.visible = false; continue; } p.rig.g.visible = !(p === other && G.solo); const y = terrainH(p.x, p.z); p.rig.g.position.set(p.x, y, p.z); p.rig.g.rotation.y = p.yaw; poseRig(p.rig, { anim: p.anim, t: p.at, phase: p.phase, combo: p.combo, globalT: G.t + (p.who === 'S' ? 1.3 : 0) }); }
  for (const h of G.hunters) { if (!h.rig.g.visible) continue; h.rig.g.position.set(h.x, terrainH(h.x, h.z), h.z); h.rig.g.rotation.y = h.yaw; poseHunter(h.rig, h, G.t + h.id); }
  // torch on Kumaran
  const k = K(); if (k) { const ky = terrainH(k.x, k.z); torch.position.set(k.x + Math.sin(k.yaw + 0.5) * 0.5, ky + 1.6, k.z + Math.cos(k.yaw + 0.5) * 0.5); torch.intensity = (k.rig.g.visible ? 1 : 0) * (3.2 + Math.sin(G.t * 17) * 0.35 + Math.sin(G.t * 31) * 0.2); }
  // moon shadow follows me
  moon.position.set(me.x - 30, 60, me.z - 20); moon.target.position.set(me.x, 0, me.z); moon.target.updateMatrixWorld();
  // fireflies drift
  { const pos = flies.geometry.attributes.position, base = flies.userData.base; for (let i = 0; i < base.length; i++) { const b = base[i]; if (Math.abs(b[2] - me.z) > 60) continue; pos.setX(i, b[0] + Math.sin(G.t * 0.7 + b[3]) * 0.8); pos.setY(i, b[1] + Math.sin(G.t * 1.1 + b[3] * 2) * 0.4); pos.setZ(i, b[2] + Math.cos(G.t * 0.5 + b[3]) * 0.8); } pos.needsUpdate = true; flies.material.opacity = 0.6 + Math.sin(G.t * 3) * 0.3; }
  for (const m of mists) { m.position.x = m.userData.x + Math.sin(G.t * 0.15 + m.userData.ph) * 2; }
  cameraUpdate(dt); hudUpdate(dt);
  if (fx) composer.render(); else renderer.render(scene, camera);
  if (window.__capture) { window.__capture = false; window.__shot = canvas.toDataURL('image/jpeg', 0.85); }
}
requestAnimationFrame(frame); window.__resume = () => { window.__paused = false; requestAnimationFrame(frame); };

// ---------------- lobby ----------------
function setLang(l) { E.st.lang = l; document.documentElement.lang = l; document.querySelectorAll('[data-en]').forEach(el => el.textContent = l === 'ta' ? el.dataset.ta : el.dataset.en); $('lang-en').classList.toggle('on', l === 'en'); $('lang-ta').classList.toggle('on', l === 'ta'); try { localStorage.setItem('tf_lang', l); } catch (e) { } }
$('lang-en').onclick = () => setLang('en'); $('lang-ta').onclick = () => setLang('ta'); try { setLang(localStorage.getItem('tf_lang') || 'en'); } catch (e) { setLang('en'); }
function rules() { $('rules-title').textContent = T('r2_title') + ' · 3D'; const ul = $('rules-lines'); ul.innerHTML = ''; const lines = T('r2').slice(0, 4).concat([E.st.lang === 'ta' ? 'இந்த 3D version-ல சண்டை போடலாம்: J/click தாக்கு (3-hit combo), K/right-click கனமான தாக்குதல், Space dodge. வேட்டைக்காரன் 4 hits. நீங்க 5.' : 'In this 3D version you can fight: J / click to attack (3-hit combo), K / right-click heavy, Space to dodge. A hunter takes 4 hits. You take 5.', E.st.lang === 'ta' ? 'இருவரும் காட்டின் முடிவில் இருக்கும் வாசலை அடையணும். ஒருவர் இறந்தால் இருவரும் மறுபடி.' : 'Both of you must reach the gate at the end. If one dies, both restart.']); lines.forEach(l => { const li = document.createElement('li'); li.textContent = l; ul.appendChild(li); }); $('rules').classList.remove('hidden'); $('rules-ok').onclick = () => { $('rules').classList.add('hidden'); A.ensure(); G.readyMe = true; Net.send({ t: 'ready' }); $('lobby-status').textContent = ''; tryStart(); if (!G.started) { $('hud').classList.remove('hidden'); hint(T('ready')); } }; }
function beginGame() { $('lobby').classList.add('hidden'); me = makePlayer(Net.isHost || G.solo ? 'K' : 'S'); other = makePlayer(Net.isHost || G.solo ? 'S' : 'K'); other.tx = null; meera = { who: 'M', rig: makeRig('M'), x: 1, z: 1, yaw: Math.PI, anim: 'idle', at: 0, phase: 0, combo: 0, hp: 5, noise: 0, inv: 0 }; scene.add(meera.rig.g); $('hp-me-name').textContent = T(me.who === 'K' ? 'hud_k' : 'hud_s'); $('hp-other-name').textContent = T(other.who === 'K' ? 'hud_k' : 'hud_s'); $('hp-me-name').style.color = me.who === 'K' ? '#c9a15c' : '#8fc0c8'; $('hp-other-name').style.color = other.who === 'K' ? '#c9a15c' : '#8fc0c8'; resetAll(); camPos.set(0, 3, 6); $('fade').style.opacity = 0; rules(); }
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
if (qs.has('solo')) { setTimeout(() => $('btn-solo').click(), 200); }
window.__G = G; window.__me = () => me; window.__other = () => other; window.__scene = scene;
