// The Tiger and the Fish — 3D campaign: the Seven Trials
// Engine core. Levels are defined in levels.js and receive a ctx object.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from './GLTFLoader.js';
import { clone as skeletonClone } from './SkeletonUtils.js';
import { LEVELS, INTERLUDES } from './levels.js';

const $ = id => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const T = Story.t;
const L = (en, ta) => E.st.lang === 'ta' ? ta : en;
const isTouch = ('ontouchstart' in window) && window.matchMedia('(pointer: coarse)').matches;

// ---------------- mutable world state (set per level) ----------------
const W = { half: 30, zMin: -400, zMax: 8, waterY: null };
let terrainFn = () => 0;
const terrainH = (x, z) => terrainFn(x, z);
function makeNoise(seed) {
  const r = U.rng(seed * 7 + 1), tab = new Float32Array(256 * 256);
  for (let i = 0; i < tab.length; i++) tab[i] = r();
  const at = (x, y) => tab[((y & 255) << 8) | (x & 255)];
  const n2 = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = U.smooth(x - ix), fy = U.smooth(y - iy); return U.lerp(U.lerp(at(ix, iy), at(ix + 1, iy), fx), U.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), fx), fy); };
  const fbm2 = (x, y, o = 4) => { let v = 0, a = 1, f = 1, n = 0; for (let i = 0; i < o; i++) { v += n2(x * f, y * f) * a; n += a; a *= 0.5; f *= 2; } return v / n; };
  return { n2, fbm2 };
}

// ---------------- renderer / scene ----------------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.45;
const scene = new THREE.Scene();
const FOG = new THREE.Color(0x07130f);
scene.background = FOG; scene.fog = new THREE.FogExp2(FOG, 0.03);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 260);
let fx = !qs.has('lowfx') && !isTouch; const LOWQ = qs.has('lowfx') || qs.has('lite'); if (LOWQ) renderer.shadowMap.enabled = false;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.5, 0.72); composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();

// lights (persistent, retuned per level via sky())
const hemi = new THREE.HemisphereLight(0x4a7a72, 0x0a1408, 0.9); scene.add(hemi);
const rim = new THREE.DirectionalLight(0x6a90a8, 0.6); rim.position.set(20, 30, 40); scene.add(rim);
const moon = new THREE.DirectionalLight(0xa8c8d8, 1.7); moon.position.set(-30, 60, -20); moon.castShadow = !LOWQ;
moon.shadow.mapSize.set(isTouch ? 2048 : 4096, isTouch ? 2048 : 4096); moon.shadow.camera.near = 1; moon.shadow.camera.far = 200;
{ const sc = moon.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; } moon.shadow.bias = -0.0015;
scene.add(moon); scene.add(moon.target);
const torchL = new THREE.PointLight(0xffa040, 0, 26, 1.7); scene.add(torchL);
const torchL2 = new THREE.PointLight(0xffa040, 0, 18, 1.8); scene.add(torchL2);
function sky(o) {
  FOG.setHex(o.fog); scene.fog.density = o.fogD ?? 0.03;
  hemi.color.setHex(o.hemiSky ?? 0x4a7a72); hemi.groundColor.setHex(o.hemiGround ?? 0x0a1408); hemi.intensity = o.hemiI ?? 0.9;
  moon.color.setHex(o.sun ?? 0xa8c8d8); moon.intensity = o.sunI ?? 1.7;
  rim.color.setHex(o.rim ?? 0x6a90a8); rim.intensity = o.rimI ?? 0.6;
  renderer.toneMappingExposure = o.exposure ?? 1.45;
  bloom.strength = o.bloom ?? 0.55;
}

// ---------------- level containers ----------------
let LV = null, LVI = 0;            // current level def + index
let LG = null;                     // THREE.Group holding level content
let rng = U.rng(1);                // level-seeded rng
let cols = [];                     // colliders [x,z,r]
let ANIM = [];                     // per-frame fns(dt, t)
let INTERS = [];                   // E-interactions
let ZONES = {};                    // named hazard zones
let softWalls = [];                // arena thorn walls {grp, wallZ, open}
let stoneLights = [];              // rune stones
let EDEFS = [];                    // enemy spawn definitions
let arenaLights = [];

function groundTexture(base, spots, dark) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); const r = U.rng(99);
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  const [s1, s2, s3] = spots, [d1, d2, d3] = dark;
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${s1 + r() * 50 | 0},${s2 + r() * 60 | 0},${s3 + r() * 30 | 0},${0.25 + r() * 0.5})`; x.beginPath(); x.ellipse(r() * 512, r() * 512, 3 + r() * 14, 2 + r() * 5, r() * 3, 0, 6.28); x.fill(); }
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${d1 + r() * 20 | 0},${d2 + r() * 20 | 0},${d3 + r() * 10 | 0},${0.3 + r() * 0.5})`; x.beginPath(); x.ellipse(r() * 512, r() * 512, 4 + r() * 18, 2 + r() * 8, r() * 3, 0, 6.28); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(24, 120); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildGround(opts) {
  const len = W.zMax - W.zMin + 60, Wd = W.half * 2 + 60, segX = 90, segZ = 240;
  const geo = new THREE.PlaneGeometry(Wd, len, segX, segZ); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, (W.zMax + W.zMin) / 2);
  const pos = geo.attributes.position; const col = new Float32Array(pos.count * 3); const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, terrainH(x, z)); opts.colorFn(x, z, c); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: groundTexture(opts.base, opts.spots, opts.dark), vertexColors: true, roughness: 0.95, metalness: 0 }));
  m.receiveShadow = true; LG.add(m); return m;
}
function buildWater(y, color, opacity = 0.82) {
  const len = W.zMax - W.zMin + 100;
  const geo = new THREE.PlaneGeometry(W.half * 2 + 120, len, 40, 110); geo.rotateX(-Math.PI / 2); geo.translate(0, y, (W.zMax + W.zMin) / 2);
  const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.25, metalness: 0.35, flatShading: true });
  const m = new THREE.Mesh(geo, mat); LG.add(m); W.waterY = y;
  const pos = geo.attributes.position, n = pos.count, bx = new Float32Array(n), bz = new Float32Array(n);
  for (let i = 0; i < n; i++) { bx[i] = pos.getX(i); bz[i] = pos.getZ(i); }
  ANIM.push((dt, t) => { for (let i = 0; i < n; i++) pos.setY(i, y + Math.sin(bx[i] * 0.25 + t * 1.4) * 0.12 + Math.sin(bz[i] * 0.2 + t * 0.9) * 0.14); pos.needsUpdate = true; geo.computeVertexNormals(); });
  return m;
}
const inWater = (x, z) => W.waterY != null && terrainH(x, z) < W.waterY - 0.45;

// ---------------- character rigs ----------------
const MAT = { skinK: new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.85 }), skinS: new THREE.MeshStandardMaterial({ color: 0x3d2e22, roughness: 0.85 }), clothK: new THREE.MeshStandardMaterial({ color: 0x9a6a28, roughness: 0.9 }), clothS: new THREE.MeshStandardMaterial({ color: 0x2f5a6a, roughness: 0.9 }), clothM: new THREE.MeshStandardMaterial({ color: 0x6a4a3a, roughness: 0.9 }), dark: new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.9 }), red: new THREE.MeshStandardMaterial({ color: 0x8a2a2a, roughness: 0.8 }), steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.4, metalness: 0.8 }), wood: new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.9 }), eye: new THREE.MeshBasicMaterial({ color: 0xff3020 }), flame: new THREE.MeshBasicMaterial({ color: 0xffa040 }) };
for (const k in MAT) MAT[k].userData.shared = true;
const _veshti = {};
function veshtiTex(base) {
  if (_veshti[base]) return _veshti[base];
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 128, 128);
  x.globalAlpha = 0.12; x.fillStyle = '#000';
  for (let i = 0; i < 128; i += 8) x.fillRect(i, 0, 1, 128);
  x.globalAlpha = 1; x.fillStyle = '#d8b040'; x.fillRect(0, 108, 128, 6); x.fillRect(0, 120, 128, 4);
  x.fillStyle = '#8a1a12'; x.fillRect(0, 116, 128, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1);
  _veshti[base] = t; return t;
}
function box(w, h, d, m, x = 0, y = 0, z = 0) { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.castShadow = true; return me; }
function limb(len, thick, m) { const j = new THREE.Group(); const me = new THREE.Mesh(new THREE.CapsuleGeometry(thick / 2, len - thick, 3, 6), m); me.position.y = -len / 2; me.castShadow = true; j.add(me); j.userData.len = len; return j; }
function makeRig(kind) {
  const g = new THREE.Group(); const skin = kind === 'K' ? MAT.skinK : MAT.skinS, cloth = kind === 'K' ? MAT.clothK : kind === 'S' ? MAT.clothS : MAT.clothM;
  const broad = kind === 'K' ? 1.15 : kind === 'S' ? 0.92 : 0.85;
  const hips = new THREE.Group(); hips.position.y = 0.98; g.add(hips);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2 * broad, 0.42, 3, 8), kind === 'M' ? cloth : skin); torso.scale.set(1.35, 1, 0.75); torso.position.y = 0.38; torso.castShadow = true; hips.add(torso);
  const waist = box(0.46 * broad, 0.18, 0.3, cloth, 0, 0.12, 0); hips.add(waist);
  { const baseCol = kind === 'K' ? '#7a4e16' : kind === 'S' ? '#24485a' : '#54382a';
    const skirtMat = new THREE.MeshStandardMaterial({ map: veshtiTex(baseCol), roughness: 0.9 });
    const slen = kind === 'M' ? 0.78 : 0.44;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.185 * broad, 0.225 * broad, slen, 12, 1, true), skirtMat); skirt.position.y = 0.03 - slen / 2; skirt.castShadow = true; skirt.material.side = THREE.DoubleSide; hips.add(skirt);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.19 * broad, 0.03, 6, 14), new THREE.MeshStandardMaterial({ color: 0xc9a15c, metalness: 0.65, roughness: 0.35 })); belt.rotation.x = Math.PI / 2; belt.position.y = 0.05; hips.add(belt);
    if (kind !== 'M') for (const sx of [-1, 1]) { const pec = new THREE.Mesh(new THREE.SphereGeometry(0.09 * broad, 9, 7), skin); pec.position.set(sx * 0.1 * broad, 0.49, 0.095); pec.scale.set(1.15, 0.75, 0.5); pec.castShadow = true; hips.add(pec); }
    if (kind === 'M') { const blouse = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.3, 3, 8), MAT.red); blouse.scale.set(1.25, 0.85, 0.72); blouse.position.y = 0.44; blouse.castShadow = true; hips.add(blouse); }
  }
  const neck = new THREE.Group(); neck.position.y = 0.72; hips.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), skin); head.position.y = 0.16; head.scale.set(0.9, 1.1, 0.95); head.castShadow = true; neck.add(head);
  // face
  { const eyeW = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.35 });
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 6), eyeW); e.position.set(sx * 0.052, 0.185, 0.127); neck.add(e);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 6, 5), MAT.dark); pu.position.set(sx * 0.052, 0.185, 0.146); neck.add(pu);
      const br = box(0.055, 0.011, 0.018, MAT.dark, sx * 0.057, 0.223, 0.128); br.rotation.z = -sx * 0.18; neck.add(br);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 5), skin); ear.position.set(sx * 0.135, 0.155, 0.01); ear.scale.set(0.5, 1, 0.7); neck.add(ear);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.021, 0.055, 5), skin); nose.rotation.x = Math.PI / 2 - 0.3; nose.position.set(0, 0.155, 0.142); neck.add(nose);
    const mouth = box(0.05, 0.008, 0.014, new THREE.MeshStandardMaterial({ color: 0x4a201a, roughness: 0.7 }), 0, 0.103, 0.13); neck.add(mouth);
    if (kind === 'K') { const mo = box(0.078, 0.02, 0.018, MAT.dark, 0, 0.126, 0.134); neck.add(mo); }
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.152, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), MAT.dark); hair.position.set(0, 0.185, -0.012); neck.add(hair);
    if (kind === 'K') { const knot = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), MAT.dark); knot.position.set(0, 0.315, -0.04); neck.add(knot); }
  }
  if (kind === 'S') { const band = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 14), MAT.red); band.rotation.x = Math.PI / 2; band.position.y = 0.2; neck.add(band); }
  if (kind === 'M') { const hair = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), MAT.dark); hair.position.set(0, 0.2, -0.05); hair.scale.set(1, 0.9, 1.1); neck.add(hair); const tail = box(0.08, 0.35, 0.08, MAT.dark, 0, 0.02, -0.18); neck.add(tail); }
  // shoulders / neck definition
  for (const sx of [-1, 1]) { const del = new THREE.Mesh(new THREE.SphereGeometry(0.11 * broad, 8, 6), kind === 'M' ? cloth : skin); del.position.set(sx * 0.3 * broad, 0.63, 0); del.castShadow = true; hips.add(del); }
  { const neckC = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.12, 8), skin); neckC.position.y = 0.03; neck.add(neckC); }
  // Kumaran's tiger mark — a golden pounce of stripes across his back
  let mark = null;
  if (kind === 'K') {
    const c = document.createElement('canvas'); c.width = 128; c.height = 160; const x = c.getContext('2d');
    x.strokeStyle = '#ffc24a'; x.lineCap = 'round'; x.lineWidth = 9;
    const strokes = [[20, 130, 55, 88, 96, 74], [26, 100, 60, 66, 100, 52], [40, 74, 72, 46, 104, 36], [62, 132, 88, 108, 112, 92], [86, 140, 102, 120, 116, 108]];
    for (const [x1, y1, cx2, cy2, x2, y2] of strokes) { x.beginPath(); x.moveTo(x1, y1); x.quadraticCurveTo(cx2, cy2, x2, y2); x.stroke(); }
    x.lineWidth = 6; x.beginPath(); x.arc(100, 44, 9, 0, 6.28); x.stroke(); // the eye of the leap
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const mm = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    mark = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.38), mm); mark.position.set(0, 0.42, -0.205); mark.rotation.y = Math.PI; hips.add(mark);
  }
  const mk = (side) => { const sh = new THREE.Group(); sh.position.set(side * 0.3 * broad, 0.62, 0); hips.add(sh); const up = limb(0.34, 0.11 * broad, skin); sh.add(up); if (kind === 'K') { const band = new THREE.Mesh(new THREE.TorusGeometry(0.062 * broad, 0.016, 6, 10), new THREE.MeshStandardMaterial({ color: 0xd8b040, metalness: 0.7, roughness: 0.3 })); band.rotation.x = Math.PI / 2; band.position.y = -0.1; up.add(band); } const el = new THREE.Group(); el.position.y = -0.34; up.add(el); const fo = limb(0.32, 0.095 * broad, skin); el.add(fo); const hand = new THREE.Group(); hand.position.y = -0.32; fo.add(hand); const palm = box(0.065, 0.09, 0.042, skin, 0, -0.02, 0); hand.add(palm); const thumb = box(0.024, 0.05, 0.024, skin, -side * 0.042, -0.005, 0.015); thumb.rotation.z = -side * 0.45; hand.add(thumb); return { sh, up, el, fo, hand }; };
  const Lm = mk(-1), R = mk(1);
  const mkLeg = (side) => { const hp = new THREE.Group(); hp.position.set(side * 0.13 * broad, -0.02, 0); hips.add(hp); const th = limb(0.48, 0.15 * broad, cloth); hp.add(th); const kn = new THREE.Group(); kn.position.y = -0.48; th.add(kn); const sh = limb(0.46, 0.12 * broad, skin); kn.add(sh); const foot = box(0.12, 0.08, 0.26, MAT.dark, 0, -0.46, 0.06); kn.add(foot); return { hp, th, kn, sh }; };
  const LL = mkLeg(-1), RL = mkLeg(1);
  let weapon = null, wmats = null;
  if (kind === 'K') { const wWood = MAT.wood.clone(); wWood.userData = { base: new THREE.Color(0x5a3a1c) }; const wSteel = MAT.steel.clone(); wSteel.userData = { base: new THREE.Color(0x9aa0a8) }; wmats = [wWood, wSteel]; weapon = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.5, 6), wWood); pole.position.y = 0.35; weapon.add(pole); const hook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI * 1.3), wSteel); hook.position.y = 1.1; hook.rotation.z = -0.4; weapon.add(hook); const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.3, 6), wSteel); spike.position.y = 1.25; weapon.add(spike); weapon.rotation.x = Math.PI / 2 + 0.2; R.hand.add(weapon); }
  if (kind === 'S') { const wWood = MAT.wood.clone(); wWood.userData = { base: new THREE.Color(0x5a3a1c) }; wmats = [wWood]; weapon = new THREE.Group(); const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.3, 6), wWood); stick.position.y = 0.3; weapon.add(stick); weapon.rotation.x = Math.PI / 2 + 0.2; R.hand.add(weapon); }
  // hand torch (hidden unless level enables)
  const htorch = new THREE.Group(); { const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.7, 5), MAT.wood); stick.position.y = 0.2; htorch.add(stick); const fl = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 6), MAT.flame); fl.position.y = 0.65; htorch.add(fl); htorch.visible = false; htorch.rotation.x = Math.PI / 2 + 0.3; Lm.hand.add(htorch); }
  return { g, hips, torso, neck, head, L: Lm, R, LL, RL, weapon, htorch, mark, wmats, kind };
}
function poseRig(r, a) {
  const s = (v) => Math.sin(v); const st = a.t;
  const set = (o, x, y, z) => { o.rotation.set(x, y, z); };
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
  else if (a.anim === 'attack') {
    const k = U.clamp(st / 0.42, 0, 1); const anti = U.smooth(U.clamp(k / 0.3, 0, 1)), swing = U.smooth(U.clamp((k - 0.3) / 0.35, 0, 1)), rec = U.smooth(U.clamp((k - 0.65) / 0.35, 0, 1));
    const arm = a.combo === 1 ? r.L : r.R, other = a.combo === 1 ? r.R : r.L; const sgn = a.combo === 1 ? -1 : 1;
    if (a.combo === 2) {
      const raise = -2.6 * anti + (2.6 + 0.9) * swing - 0.9 * rec; set(r.L.sh, raise, 0, 0.3); set(r.R.sh, raise, 0, -0.3); set(r.L.el, -0.6 + 0.4 * swing, 0, 0); set(r.R.el, -0.6 + 0.4 * swing, 0, 0); set(r.torso, -0.25 * anti + 0.55 * swing - 0.3 * rec, 0, 0); r.hips.position.y = 0.98 - 0.12 * swing + 0.12 * rec;
    } else {
      set(arm.sh, -1.9 * anti + (1.9 + 0.7) * swing - 0.7 * rec, sgn * (0.9 * anti - 1.6 * swing + 0.7 * rec), -sgn * 0.6); set(arm.el, -0.9 + 0.7 * swing - 0.5 * rec, 0, 0);
      set(other.sh, 0.4 * anti - 0.4 * swing, 0, sgn * 0.3); set(r.torso, 0.05, sgn * (-0.6 * anti + 1.1 * swing - 0.5 * rec), 0); set(r.hips, 0, sgn * (-0.3 * anti + 0.55 * swing - 0.25 * rec), 0);
      set(r.LL.hp, -0.25 * swing, 0, 0); set(r.RL.hp, 0.25 * swing, 0, 0);
    }
  }
  else if (a.anim === 'heavy') {
    const k = U.clamp(st / 0.8, 0, 1); const anti = U.smooth(U.clamp(k / 0.5, 0, 1)), swing = U.smooth(U.clamp((k - 0.5) / 0.18, 0, 1)), rec = U.smooth(U.clamp((k - 0.72) / 0.28, 0, 1));
    const raise = -3.0 * anti + (3.0 + 1.1) * swing - 1.1 * rec; set(r.L.sh, raise, 0, 0.35); set(r.R.sh, raise, 0, -0.35); set(r.L.el, -0.4, 0, 0); set(r.R.el, -0.4, 0, 0); set(r.torso, -0.35 * anti + 0.9 * swing - 0.55 * rec, 0, 0); r.hips.position.y = 0.98 + 0.06 * anti - 0.3 * swing + 0.24 * rec; set(r.LL.hp, -0.4 * swing + 0.4 * rec, 0, 0); set(r.RL.hp, 0.5 * swing - 0.5 * rec, 0, 0); set(r.LL.kn, 0.6 * swing - 0.6 * rec, 0, 0); set(r.RL.kn, 0.3 * swing - 0.3 * rec, 0, 0);
  }
  else if (a.anim === 'dodge') { const k = U.clamp(st / 0.5, 0, 1); set(r.hips, k * Math.PI * 2, 0, 0); r.hips.position.y = 0.7 + s(k * Math.PI) * 0.2; set(r.LL.hp, -1.2, 0, 0); set(r.RL.hp, -1.2, 0, 0); set(r.LL.kn, 2.0, 0, 0); set(r.RL.kn, 2.0, 0, 0); set(r.L.sh, -1.5, 0, 0.3); set(r.R.sh, -1.5, 0, -0.3); set(r.L.el, -1.8, 0, 0); set(r.R.el, -1.8, 0, 0); set(r.neck, 0.6, 0, 0); }
  else if (a.anim === 'hit') { const k = U.clamp(st / 0.35, 0, 1); const f = s(k * Math.PI); set(r.torso, -0.5 * f, 0, 0.2 * f); set(r.neck, -0.4 * f, 0, 0); set(r.L.sh, -0.8 * f, 0, 0.6); set(r.R.sh, -0.8 * f, 0, -0.6); r.hips.position.y = 0.98 - 0.08 * f; }
  else if (a.anim === 'dead') { const k = U.clamp(st / 0.7, 0, 1); set(r.hips, -1.5 * k, 0, 0.3 * k); r.hips.position.y = U.lerp(0.98, 0.3, k); set(r.L.sh, -1.2 * k, 0, 0.9); set(r.R.sh, -1.2 * k, 0, -0.9); set(r.LL.kn, 0.6 * k, 0, 0); set(r.RL.kn, 0.3 * k, 0, 0); }
  else if (a.anim === 'throw') { const k = U.clamp(st / 0.45, 0, 1); const anti = U.smooth(U.clamp(k / 0.4, 0, 1)), sw = U.smooth(U.clamp((k - 0.4) / 0.3, 0, 1)); set(r.L.sh, -0.5 - 2.4 * anti + 3.6 * sw, 0, 0.5); set(r.L.el, -1.6 + 1.4 * sw, 0, 0); set(r.torso, -0.2 * anti + 0.35 * sw, 0.5 * anti - 0.8 * sw, 0); }
  else if (a.anim === 'channel' || a.anim === 'revive') { // kneel, hands forward
    r.hips.position.y = 0.62; set(r.LL.hp, -1.6, 0, 0); set(r.LL.kn, 2.2, 0, 0); set(r.RL.hp, -0.5, 0, 0); set(r.RL.kn, 1.2, 0, 0);
    const b = s(g * 6) * 0.06; set(r.L.sh, -1.1 + b, 0, 0.25); set(r.R.sh, -1.1 - b, 0, -0.25); set(r.L.el, -0.5, 0, 0); set(r.R.el, -0.5, 0, 0); set(r.torso, 0.3, 0, 0); set(r.neck, -0.2, 0, 0);
  }
  else if (a.anim === 'trapped') { // struggling in sand
    const f = s(g * 5); r.hips.position.y = 0.95; set(r.torso, -0.15 + f * 0.1, f * 0.15, 0); set(r.L.sh, -2.4 + f * 0.3, 0, 0.5); set(r.R.sh, -2.4 - f * 0.3, 0, -0.5); set(r.L.el, -0.6, 0, 0); set(r.R.el, -0.6, 0, 0); set(r.neck, -0.3, 0, 0);
  }
  // torch raised overrides left arm
  if (a.torch) { set(r.L.sh, -2.2, 0, 0.35); set(r.L.el, -0.5, 0, 0); }
  if (r.htorch) r.htorch.visible = !!a.torch;
}

// ---------------- enemy types & rigs ----------------
const ETYPES = {
  stalker: { hp: 4, speed: 7.2, scale: 0.8, windup: 0.3, dmg: 1, reach: 2.0, color: 0x1a2420, poise: 0 },
  hunter: { hp: 7, speed: 5.8, scale: 1.0, windup: 0.42, dmg: 1, reach: 2.3, color: 0x141a16, poise: 0 },
  brute: { hp: 18, speed: 4.1, scale: 1.55, windup: 0.8, dmg: 2, reach: 3.4, color: 0x1e1a14, poise: 2, aoe: true },
  boss: { hp: 52, speed: 4.8, scale: 2.1, windup: 0.72, dmg: 2, reach: 4.2, color: 0x241410, poise: 3, aoe: true, boss: true },
};
const BRAINS = {};   // type -> fn(h, dt, players)
function regType(name, def) { ETYPES[name] = def; }
function regBrain(name, fn) { BRAINS[name] = fn; }
function makeHunter(type) {
  const T_ = ETYPES[type];
  if (T_.rig === 'croc') return makeCroc(T_);
  if (T_.rig === 'snake') return makeSnake(T_);
  if (T_.rig === 'fox') return FOX.ready ? makeFox(T_) : makeBeast(T_);
  if (T_.rig === 'beast') return makeBeast(T_);
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: T_.color, roughness: 0.95, emissive: 0x000000 });
  if (T_.emissive) { m.emissive.setHex(T_.emissive); m.emissiveIntensity = 0.35; }
  const body = new THREE.Group(); body.position.y = 1.0; g.add(body);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.6, 3, 8), m); chest.rotation.x = 1.1; chest.position.set(0, 0.15, 0.1); chest.castShadow = true; body.add(chest);
  const spine = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 3, 8), m); spine.rotation.x = 0.6; spine.position.set(0, -0.15, -0.3); spine.castShadow = true; body.add(spine);
  if (T_.aoe || T_.boss) { for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 4), m); sp.position.set((i - 2) * 0.12, 0.42 - Math.abs(i - 2) * 0.05, -0.05 - Math.abs(i - 2) * 0.1); sp.rotation.x = -0.6; body.add(sp); } }
  const neck = new THREE.Group(); neck.position.set(0, 0.35, 0.5); body.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), m); head.scale.set(0.8, 0.9, 1.3); head.castShadow = true; neck.add(head);
  if (!T_.noEars) for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, T_.boss ? 0.8 : 0.5, 5), m); ear.position.set(sx * 0.2, 0.22, -0.05); ear.rotation.z = -sx * 0.7; ear.rotation.x = -0.4; neck.add(ear); }
  if (T_.mask) { const mask = new THREE.Mesh(new THREE.CircleGeometry(0.2, 8), new THREE.MeshStandardMaterial({ color: T_.mask, roughness: 0.6 })); mask.position.set(0, 0.02, 0.29); neck.add(mask); }
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.3), m); jaw.position.set(0, -0.14, 0.2); neck.add(jaw);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), MAT.eye); eye.position.set(0, 0.02, 0.3); eye.visible = false; neck.add(eye);
  const mkArm = (side) => { const sh = new THREE.Group(); sh.position.set(side * 0.38, 0.2, 0.25); body.add(sh); const up = limb(0.6, 0.13, m); sh.add(up); const el = new THREE.Group(); el.position.y = -0.6; up.add(el); const fo = limb(0.62, 0.11, m); el.add(fo); const claw = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 4), m); claw.position.y = -0.7; claw.rotation.x = Math.PI; fo.add(claw); return { sh, up, el, fo }; };
  const mkLeg = (side) => { const hp = new THREE.Group(); hp.position.set(side * 0.22, -0.35, -0.35); body.add(hp); const th = limb(0.5, 0.15, m); hp.add(th); const kn = new THREE.Group(); kn.position.y = -0.5; th.add(kn); const sh = limb(0.45, 0.11, m); kn.add(sh); return { hp, th, kn, sh }; };
  const rig = { g, body, neck, head, eye, mat: m, L: mkArm(-1), R: mkArm(1), LL: mkLeg(-1), RL: mkLeg(1) };
  if (T_.gun) { const gun = new THREE.Group(); const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.15, 6), MAT.steel); barrel.position.y = 0.45; gun.add(barrel); const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.4, 0.12), MAT.wood); stock.position.y = -0.05; gun.add(stock); gun.rotation.x = Math.PI / 2; rig.R.fo.add(gun); gun.position.y = -0.5; rig.gun = gun;
    const lgeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.4, 0.8), new THREE.Vector3(0, 1.4, 30)]);
    const line = new THREE.Line(lgeo, new THREE.LineBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.7 })); line.visible = false; g.add(line); rig.aim = line; }
  return rig;
}
let _repTex = null;
function reptileTex() {
  if (_repTex) return _repTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const r = U.rng(31);
  x.fillStyle = '#5a6a4a'; x.fillRect(0, 0, 256, 256);
  for (let ry = 0; ry < 16; ry++) for (let cx = 0; cx < 16; cx++) { const ox = (ry % 2) * 8; const sh = 0.75 + r() * 0.5; x.fillStyle = `rgba(${52 * sh | 0},${66 * sh | 0},${40 * sh | 0},1)`; x.beginPath(); x.ellipse(cx * 16 + 8 + ox, ry * 16 + 8, 7, 6, 0, 0, 6.28); x.fill(); x.strokeStyle = 'rgba(20,26,16,0.7)'; x.stroke(); }
  _repTex = new THREE.CanvasTexture(c); _repTex.wrapS = _repTex.wrapT = THREE.RepeatWrapping; _repTex.repeat.set(2, 2); _repTex.colorSpace = THREE.SRGBColorSpace;
  return _repTex;
}
function makeCroc(T_) {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: T_.color, roughness: 0.8, map: reptileTex() });
  const body = new THREE.Group(); body.position.y = 0.45; g.add(body);
  const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.8, 3, 8), m); trunk.rotation.x = Math.PI / 2; trunk.scale.set(1.15, 1, 0.6); trunk.castShadow = true; body.add(trunk);
  for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 4), m); sp.position.set(0, 0.3, -0.9 + i * 0.35); body.add(sp); }
  const neck = new THREE.Group(); neck.position.set(0, 0.05, 1.15); body.add(neck);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 1.1), m); snout.position.set(0, 0.05, 0.5); snout.castShadow = true; neck.add(snout);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 1.0), m); jaw.position.set(0, -0.12, 0.45); neck.add(jaw);
  for (const sx of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), MAT.eye); eye.position.set(sx * 0.18, 0.2, 0.15); neck.add(eye); }
  const tail = []; let par = body, tz = -1.2, sc = 0.34;
  for (let i = 0; i < 3; i++) { const j = new THREE.Group(); j.position.set(0, 0, tz); par.add(j); const seg = new THREE.Mesh(new THREE.CapsuleGeometry(sc, 0.7, 3, 6), m); seg.rotation.x = Math.PI / 2; seg.position.z = -0.35; seg.castShadow = true; j.add(seg); tail.push(j); par = j; tz = -0.75; sc *= 0.65; }
  const mkLeg = (sx, z) => { const hp = new THREE.Group(); hp.position.set(sx * 0.55, -0.25, z); body.add(hp); const th = limb(0.4, 0.16, m); th.rotation.z = sx * 0.9; hp.add(th); return { hp, th }; };
  const rig = { g, body, neck, jaw, tail, mat: m, legs: [mkLeg(-1, 0.7), mkLeg(1, 0.7), mkLeg(-1, -0.7), mkLeg(1, -0.7)], custom: 'croc' };
  g.scale.setScalar(T_.scale);
  // ripple ring shown while lurking
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.0, 24), new THREE.MeshBasicMaterial({ color: 0x9ad8e0, transparent: true, opacity: 0.5, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring); rig.ring = ring;
  return rig;
}
function poseCroc(r, h, gt) {
  const s = Math.sin; const lurk = h.state === 'lurk';
  r.body.position.y = lurk ? -0.25 : 0.45;
  r.ring.visible = lurk; if (lurk) { const k = (gt * 0.8 + h.ph) % 1; r.ring.scale.setScalar(0.6 + k * 1.4); r.ring.material.opacity = 0.5 * (1 - k); }
  r.body.rotation.set(0, 0, 0); r.neck.rotation.set(0, 0, 0); r.jaw.rotation.x = 0;
  const moving = h.state === 'surge' || h.state === 'chase' || h.state === 'stalk';
  const ph = h.ph;
  r.tail.forEach((j, i) => j.rotation.y = s(gt * (moving ? 9 : 2) + i * 0.9) * (moving ? 0.5 : 0.15));
  r.legs.forEach((lg, i) => lg.th.rotation.x = moving ? s(ph * 2 + i * 1.6) * 0.7 : 0);
  if (h.state === 'attack') { const wu = h.windup, k = U.clamp(h.st / (wu + 0.3), 0, 1), wk = wu / (wu + 0.3); const anti = U.smooth(U.clamp(k / wk, 0, 1)), lunge = U.smooth(U.clamp((k - wk) / 0.4, 0, 1)); r.jaw.rotation.x = 0.8 * anti - 0.8 * lunge; r.neck.rotation.x = -0.3 * anti + 0.45 * lunge; r.body.position.y = 0.45 + 0.3 * anti - 0.2 * lunge; }
  else if (h.state === 'stagger') { const f = s(U.clamp(h.st / 0.35, 0, 1) * Math.PI); r.body.rotation.z = f * 0.5; }
  else if (h.state === 'dead') { const k = U.clamp(h.st / 0.8, 0, 1); r.body.rotation.z = k * Math.PI * 0.9; r.body.position.y = 0.45 - k * 0.15; }
  const flash = (h.state === 'attack' && h.st < h.windup) ? (0.35 + 0.65 * Math.abs(s(gt * 28))) * (h.st / h.windup) : h.flashT > 0 ? h.flashT * 3 : 0;
  r.mat.emissive.setRGB(flash * 0.9, flash * 0.12, flash * 0.05);
}
function makeSnake(T_) {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: T_.color, roughness: 0.65, map: reptileTex() });
  const segs = []; let par = g, sc = 0.16;
  for (let i = 0; i < 7; i++) { const j = new THREE.Group(); j.position.set(0, i === 0 ? 0.16 : 0, i === 0 ? 0 : 0.34); par.add(j); const seg = new THREE.Mesh(new THREE.CapsuleGeometry(sc, 0.3, 3, 6), m); seg.rotation.x = Math.PI / 2; seg.position.z = 0.17; seg.castShadow = i < 4; j.add(seg); segs.push(j); par = j; sc *= 0.92; }
  const headG = new THREE.Group(); headG.position.z = 0.4; par.add(headG);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.45, 6), m); head.rotation.x = Math.PI / 2; headG.add(head);
  for (const sx of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 5), MAT.eye); eye.position.set(sx * 0.09, 0.07, 0.1); headG.add(eye); }
  g.scale.setScalar(T_.scale);
  return { g, segs, headG, mat: m, custom: 'snake' };
}
function poseSnake(r, h, gt) {
  const s = Math.sin; const wave = h.state === 'chase' || h.state === 'return' ? 6 : 2;
  r.segs.forEach((j, i) => { if (i > 0) j.rotation.y = s(gt * wave + i * 1.1 + h.ph) * 0.35; });
  const rise = h.state === 'coil' ? U.clamp(h.st / h.windup, 0, 1) : h.state === 'attack' ? 1 : h.state === 'recoil' ? 0.3 : 0;
  r.segs[0].rotation.x = -rise * 1.1; r.segs[1].rotation.x = -rise * 0.5; r.segs[2].rotation.x = rise * 0.55; // rear up
  if (h.state === 'attack') { const k = U.clamp(h.st / 0.22, 0, 1); r.segs[0].position.z = k * 0.9; } else r.segs[0].position.z = 0;
  if (h.state === 'dead') { const k = U.clamp(h.st / 0.6, 0, 1); r.g.scale.y = Math.max(0.12, (1 - k)) * ETYPES[h.type].scale; }
  const flash = (h.state === 'coil') ? (0.3 + 0.7 * Math.abs(s(gt * 24))) * U.clamp(h.st / h.windup, 0, 1) : h.flashT > 0 ? h.flashT * 3 : 0;
  r.mat.emissive.setRGB(flash * 0.9, flash * 0.1, flash * 0.05);
}
function makeBeast(T_) {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: T_.color, roughness: 0.9, emissive: 0x000000 });
  const belly = T_.belly ? new THREE.MeshStandardMaterial({ color: T_.belly, roughness: 0.95 }) : m;
  const body = new THREE.Group(); body.position.y = 0.62; g.add(body);
  const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.75, 4, 8), m); trunk.rotation.x = Math.PI / 2; trunk.scale.set(1, 0.92, 1.12); trunk.castShadow = true; body.add(trunk);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 7), m); chest.position.set(0, 0.03, 0.42); chest.scale.set(0.95, 1, 0.9); chest.castShadow = true; body.add(chest);
  const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 7), m); haunch.position.set(0, 0.02, -0.4); haunch.scale.set(1, 0.95, 1.1); haunch.castShadow = true; body.add(haunch);
  const bellyM = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 3, 6), belly); bellyM.rotation.x = Math.PI / 2; bellyM.position.y = -0.12; body.add(bellyM);
  const neck = new THREE.Group(); neck.position.set(0, 0.14, 0.58); body.add(neck);
  const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.3, 7), m); nk.rotation.x = 1.1; nk.position.set(0, 0.06, 0.08); nk.castShadow = true; neck.add(nk);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 9, 7), m); head.position.set(0, 0.14, 0.22); head.scale.set(0.85, 0.9, 1.05); head.castShadow = true; neck.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.22), m); snout.position.set(0, 0.09, 0.38); neck.add(snout);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.045, 0.16), m); jaw.position.set(0, 0.02, 0.36); neck.add(jaw);
  for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), m); ear.position.set(sx * 0.09, 0.27, 0.14); ear.rotation.x = -0.3; neck.add(ear); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 5, 5), MAT.eye); eye.position.set(sx * 0.07, 0.17, 0.32); eye.visible = false; neck.add(eye); if (sx === 1) var eyeR = eye; else var eyeL = eye; }
  const tail = new THREE.Group(); tail.position.set(0, 0.1, -0.62); body.add(tail);
  const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.5, 5), m); tl.rotation.x = -2.2; tl.position.set(0, 0.12, -0.16); tl.castShadow = true; tail.add(tl);
  const mkLeg = (sx, z, front) => { const hp = new THREE.Group(); hp.position.set(sx * 0.2, -0.08, z); body.add(hp); const th = limb(0.34, 0.11, m); hp.add(th); const kn = new THREE.Group(); kn.position.y = -0.34; th.add(kn); const sh = limb(0.3, 0.07, m); kn.add(sh); const paw = box(0.09, 0.05, 0.14, m, 0, -0.3, 0.03); kn.add(paw); return { hp, th, kn, sh, front }; };
  const rig = { g, body, neck, tail, mat: m, eye: { get visible() { return eyeL.visible; }, set visible(v) { eyeL.visible = eyeR.visible = v; } }, legs: [mkLeg(-1, 0.42, 1), mkLeg(1, 0.42, 1), mkLeg(-1, -0.42, 0), mkLeg(1, -0.42, 0)], custom: 'beast' };
  g.scale.setScalar(T_.scale || 1);
  return rig;
}
function poseBeast(r, h, gt) {
  const s = Math.sin; const set = (o, x, y, z) => o.rotation.set(x, y, z);
  const moving = ['chase', 'investigate', 'patrol', 'charge', 'frenzy', 'reposition'].includes(h.state);
  const run = h.state === 'chase' || h.state === 'frenzy' || h.state === 'charge';
  const ph = h.ph; const amp = moving ? (run ? 1.0 : 0.5) : 0;
  r.body.position.y = 0.62 + (moving ? Math.abs(s(ph)) * (run ? 0.09 : 0.035) : s(gt * 1.8) * 0.015);
  set(r.body, 0, 0, 0); set(r.neck, 0, 0, 0); set(r.tail, 0, s(gt * (moving ? 8 : 2)) * 0.4, 0);
  r.legs.forEach((lg, i) => { const pair = (i === 0 || i === 3) ? 0 : Math.PI; set(lg.hp, s(ph + pair) * amp * 0.85, 0, 0); set(lg.kn, 0.25 + Math.max(0, -s(ph + pair - 0.6)) * amp * 0.9, 0, 0); });
  const wu = h.windup || 0.3, atkDur = wu + 0.3;
  if (h.state === 'listen') { set(r.neck, -0.25 + s(gt * 2.6) * 0.08, s(gt * 1.2) * 0.7, 0); }
  else if (h.state === 'rise') { const k = U.clamp(h.st / 0.7, 0, 1); r.body.position.y = U.lerp(0.1, 0.62, U.smooth(k)); set(r.body, -0.6 * (1 - k), 0, 0); set(r.neck, -0.5 * s(k * Math.PI), 0, 0); }
  else if (h.state === 'attack') { const k = U.clamp(h.st / atkDur, 0, 1); const wk = wu / atkDur; const anti = U.smooth(U.clamp(k / wk, 0, 1)), lunge = U.smooth(U.clamp((k - wk) / 0.5, 0, 1)); r.body.position.y = 0.62 - 0.22 * anti + 0.3 * lunge; set(r.body, 0.35 * anti - 0.55 * lunge, 0, 0); set(r.neck, -0.4 * anti + 0.6 * lunge, 0, 0); r.legs.forEach((lg) => { if (lg.front) { set(lg.hp, -0.8 * anti + 1.6 * lunge, 0, 0); set(lg.kn, 0.9 * anti - 0.3 * lunge, 0, 0); } }); }
  else if (h.state === 'stagger') { const f = s(U.clamp(h.st / 0.35, 0, 1) * Math.PI); set(r.body, -0.25 * f, 0.35 * f, 0.3 * f); }
  else if (h.state === 'dead') { const k = U.clamp(h.st / 0.7, 0, 1); set(r.body, 0, 0, k * Math.PI * 0.52); r.body.position.y = U.lerp(0.62, 0.3, k); r.legs.forEach((lg, i) => set(lg.hp, 0.4 + i * 0.15, 0, 0)); }
  else if (h.state === 'sink') { const k = U.clamp(h.st / 2.2, 0, 1); r.body.position.y = 0.62 - k * 1.4; set(r.neck, -0.6, 0, 0); }
  r.eye.visible = ['chase', 'attack', 'frenzy', 'charge'].includes(h.state);
  const flash = (h.state === 'attack' && h.st < wu) ? (0.35 + 0.65 * Math.abs(s(gt * 28))) * (h.st / wu) : h.flashT > 0 ? h.flashT * 3 : 0;
  r.mat.emissive.setRGB(flash * 0.9, flash * 0.12, flash * 0.05);
}
// ---- real animated quadruped (Khronos Fox sample model, CC0) ----
const FOX = { ready: false, glb: null, clips: {}, h: 1 };
new GLTFLoader().load('./Fox.glb', g => {
  g.scene.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const bb = new THREE.Box3().setFromObject(g.scene); FOX.h = Math.max(0.001, bb.max.y - bb.min.y);
  for (const c of g.animations) FOX.clips[c.name] = c;
  FOX.glb = g; FOX.ready = true;
  // upgrade any already-spawned beasts to the real model
  for (const h of G.hunters) { if (ETYPES[h.type] && ETYPES[h.type].rig === 'fox' && h.rig && h.rig.custom === 'beast') { const nr = makeFox(ETYPES[h.type]); nr.g.position.copy(h.rig.g.position); nr.g.rotation.copy(h.rig.g.rotation); scene.remove(h.rig.g); scene.add(nr.g); h.rig = nr; } }
}, undefined, () => { FOX.ready = false; });
function makeFox(T_) {
  const g = new THREE.Group();
  const inner = skeletonClone(FOX.glb.scene);
  const s = (1.3 * (T_.scale || 1)) / FOX.h;
  inner.scale.setScalar(s); inner.rotation.y = 0;
  const mats = [];
  inner.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); o.material.color = new THREE.Color(T_.tint || 0xb99468); mats.push(o.material); } });
  g.add(inner);
  const mixer = new THREE.AnimationMixer(inner);
  const act = {}; for (const k in FOX.clips) { act[k] = mixer.clipAction(FOX.clips[k]); }
  if (act.Survey) act.Survey.play();
  return { g, inner, mixer, act, cur: 'Survey', mats, custom: 'fox' };
}
function foxClip(r, name, fade = 0.16) { if (!r.act[name] || r.cur === name) return; if (r.act[r.cur]) r.act[r.cur].fadeOut(fade); r.act[name].reset().fadeIn(fade).play(); r.cur = name; }
function poseFox(r, h, gt) {
  const s = Math.sin;
  if (h.state === 'dead') { if (!r.deadDone) { r.deadDone = true; for (const k in r.act) r.act[k].fadeOut(0.15); } const k = U.clamp(h.st / 0.6, 0, 1); r.inner.rotation.z = k * Math.PI * 0.5; r.inner.position.y = -k * 0.12; }
  else if (h.state === 'sink') { const k = U.clamp(h.st / 2.2, 0, 1); r.inner.position.y = -k * 1.3; foxClip(r, 'Walk'); }
  else if (h.state === 'attack') { foxClip(r, 'Run', 0.08); const wu = h.windup, k = U.clamp(h.st / (wu + 0.3), 0, 1); const wk = wu / (wu + 0.3); const anti = U.smooth(U.clamp(k / wk, 0, 1)), lunge = U.smooth(U.clamp((k - wk) / 0.5, 0, 1)); r.inner.rotation.x = 0.28 * anti - 0.5 * lunge; r.inner.position.y = 0.12 * anti + 0.12 * lunge; }
  else if (h.state === 'stagger') { foxClip(r, 'Survey'); r.inner.rotation.x = s(U.clamp(h.st / 0.35, 0, 1) * Math.PI) * -0.3; }
  else if (h.state === 'chase' || h.state === 'frenzy' || h.state === 'charge') { foxClip(r, 'Run'); r.inner.rotation.x = 0; r.inner.position.y = 0; }
  else if (h.state === 'investigate' || h.state === 'patrol' || h.state === 'reposition' || h.state === 'return') { foxClip(r, 'Walk'); r.inner.rotation.x = 0; r.inner.position.y = 0; }
  else { foxClip(r, 'Survey'); r.inner.rotation.x = 0; r.inner.position.y = 0; }
  const flash = (h.state === 'attack' && h.st < h.windup) ? (0.35 + 0.65 * Math.abs(s(gt * 28))) * (h.st / h.windup) : h.flashT > 0 ? h.flashT * 3 : 0;
  for (const m of r.mats) if (m.emissive) m.emissive.setRGB(flash * 0.9, flash * 0.12, flash * 0.05);
}
function poseHunter(r, h, gt) {
  if (r.custom === 'fox') return poseFox(r, h, gt);
  if (r.custom === 'croc') return poseCroc(r, h, gt);
  if (r.custom === 'snake') return poseSnake(r, h, gt);
  if (r.custom === 'beast') return poseBeast(r, h, gt);
  const set = (o, x, y, z) => o.rotation.set(x, y, z); const s = Math.sin;
  const moving = h.state === 'chase' || h.state === 'investigate' || h.state === 'patrol' || h.state === 'charge' || h.state === 'reposition' || h.state === 'frenzy'; const ph = h.ph;
  r.body.position.y = 1.0 + (moving ? Math.abs(s(ph)) * 0.06 : s(gt * 2) * 0.02); set(r.body, 0, 0, 0);
  const amp = moving ? (h.state === 'chase' || h.state === 'charge' ? 1.0 : 0.5) : 0.05;
  set(r.L.sh, 0.6 - s(ph) * amp, 0, 0.35); set(r.R.sh, 0.6 + s(ph) * amp, 0, -0.35); set(r.L.el, -0.4, 0, 0); set(r.R.el, -0.4, 0, 0);
  set(r.LL.hp, s(ph) * amp * 0.8, 0, 0); set(r.RL.hp, -s(ph) * amp * 0.8, 0, 0); set(r.LL.kn, 0.6 + Math.max(0, -s(ph)) * amp, 0, 0); set(r.RL.kn, 0.6 + Math.max(0, s(ph)) * amp, 0, 0);
  const wu = h.windup || 0.45, atkDur = wu + 0.3;
  if (h.state === 'hidden') { r.body.position.y = -1.6; set(r.body, 1.2, 0, 0); }
  else if (h.state === 'rise') { const k = U.clamp(h.st / 0.7, 0, 1); const e = U.smooth(k); r.body.position.y = U.lerp(-1.6, 1.25, e); set(r.body, 1.2 * (1 - e) - 0.3 * s(k * Math.PI), 0, 0); set(r.L.sh, -2.0 * s(k * Math.PI), 0, 0.8); set(r.R.sh, -2.0 * s(k * Math.PI), 0, -0.8); set(r.neck, -0.6 * s(k * Math.PI), 0, 0); }
  else if (h.state === 'listen') { set(r.neck, -0.5 + s(gt * 3) * 0.1, s(gt * 1.3) * 0.9, 0); r.body.position.y = 1.15; set(r.L.sh, -0.2, 0, 0.5); set(r.R.sh, -0.2, 0, -0.5); }
  else if (h.state === 'aim') { set(r.body, 0.15, 0, 0); set(r.neck, -0.15, 0, 0); set(r.R.sh, -1.5, 0, -0.15); set(r.R.el, -0.15, 0, 0); set(r.L.sh, -1.3, 0.4, 0.3); set(r.L.el, -0.9, 0, 0); }
  else if (h.state === 'attack') { const k = U.clamp(h.st / atkDur, 0, 1); const wk = wu / atkDur; const anti = U.smooth(U.clamp(k / wk, 0, 1)), lunge = U.smooth(U.clamp((k - wk) / 0.5, 0, 1)); if (h.aoe) { set(r.L.sh, -2.8 * anti + 4.0 * lunge, 0, 0.5); set(r.R.sh, -2.8 * anti + 4.0 * lunge, 0, -0.5); set(r.body, -0.5 * anti + 1.0 * lunge, 0, 0); r.body.position.y = 1.0 + 0.5 * anti - 0.55 * lunge; set(r.neck, -0.5 * anti + 0.4 * lunge, 0, 0); } else { set(r.L.sh, -2.2 * anti + 3.2 * lunge, 0, 0.6); set(r.R.sh, -2.2 * anti + 3.2 * lunge, 0, -0.6); set(r.body, -0.3 * anti + 0.7 * lunge, 0, 0); set(r.neck, -0.4 * anti + 0.5 * lunge, 0, 0); r.body.position.y = 1.0 + 0.25 * anti - 0.3 * lunge; } }
  else if (h.state === 'charge') { set(r.body, 0.6, 0, 0); set(r.neck, 0.5, 0, 0); set(r.L.sh, 1.4 - s(ph) * 0.3, 0, 0.5); set(r.R.sh, 1.4 + s(ph) * 0.3, 0, -0.5); }
  else if (h.state === 'stagger') { const k = U.clamp(h.st / 0.35, 0, 1); const f = s(k * Math.PI); set(r.body, -0.5 * f, 0.3 * f, 0); set(r.neck, 0.5 * f, 0, 0); }
  else if (h.state === 'sink') { const k = U.clamp(h.st / 2.2, 0, 1); r.body.position.y = 1.0 - k * 2.2; set(r.body, -0.3, 0, 0); set(r.L.sh, -2.5 + s(gt * 6) * 0.3, 0, 0.7); set(r.R.sh, -2.5 - s(gt * 6) * 0.3, 0, -0.7); }
  else if (h.state === 'dead') { const k = U.clamp(h.st / 0.8, 0, 1); set(r.body, 1.3 * k, 0, 0.5 * k); r.body.position.y = U.lerp(1.0, 0.35, k); set(r.L.sh, 1.5 * k, 0, 0.8); set(r.R.sh, 1.5 * k, 0, -0.8); }
  else if (h.state === 'roar') { const k = U.clamp(h.st / 1.4, 0, 1); const f = s(k * Math.PI); r.body.position.y = 1.0 + 0.5 * f; set(r.body, -0.7 * f, 0, 0); set(r.neck, -0.9 * f, 0, 0); set(r.L.sh, -2.6 * f, 0, 1.0); set(r.R.sh, -2.6 * f, 0, -1.0); }
  else set(r.neck, moving && (h.state === 'chase') ? 0.3 : -0.2, s(gt * 0.7 + ph) * 0.2, 0);
  r.eye.visible = h.state === 'chase' || h.state === 'attack' || h.state === 'charge' || h.state === 'roar' || h.state === 'aim';
  if (r.aim) { r.aim.visible = h.state === 'aim'; if (r.aim.visible) { r.aim.material.opacity = 0.25 + 0.55 * Math.abs(s(gt * 20)) * U.clamp(h.st / (h.windup || 1), 0, 1); } }
  const flash = (h.state === 'attack' && h.st < wu) ? (0.35 + 0.65 * Math.abs(s(gt * 28))) * (h.st / wu) : h.state === 'charge' ? 0.6 : h.flashT > 0 ? h.flashT * 3 : 0;
  r.mat.emissive.setRGB(flash * 0.9, flash * 0.12, flash * 0.05);
}

// ---------------- particles ----------------
const PARTS = (() => { const N = 400; const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09); const mat = new THREE.MeshBasicMaterial({ color: 0xffffff }); const im = new THREE.InstancedMesh(geo, mat, N); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; scene.add(im); const P = []; for (let i = 0; i < N; i++) P.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1, c: new THREE.Color() }); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); let head = 0; const d = new THREE.Object3D();
  return { spawn(x, y, z, n, col, spd = 4, up = 3, size = 1, life = 0.7) { for (let i = 0; i < n; i++) { const p = P[head]; head = (head + 1) % N; p.life = life * (0.6 + Math.random() * 0.6); p.maxLife = p.life; p.x = x; p.y = y; p.z = z; const a = Math.random() * 6.28, r = Math.random() * spd; p.vx = Math.cos(a) * r; p.vz = Math.sin(a) * r; p.vy = Math.random() * up; p.s = size * (0.5 + Math.random()); p.c.set(col).multiplyScalar(0.6 + Math.random() * 0.8); } },
    jet(x, y, z, dx, dz, n, col, spd = 6, size = 1, life = 0.7) { const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl; for (let i = 0; i < n; i++) { const p = P[head]; head = (head + 1) % N; p.life = life * (0.5 + Math.random() * 0.7); p.maxLife = p.life; p.x = x; p.y = y; p.z = z; const sp2 = spd * (0.4 + Math.random()); const a = (Math.random() - 0.5) * 0.9; const ca = Math.cos(a), sa = Math.sin(a); p.vx = (dx * ca - dz * sa) * sp2; p.vz = (dx * sa + dz * ca) * sp2; p.vy = 1 + Math.random() * 3.5; p.s = size * (0.4 + Math.random()); p.c.set(col).multiplyScalar(0.5 + Math.random() * 0.6); } },
    update(dt) { for (let i = 0; i < N; i++) { const p = P[i]; if (p.life <= 0) { d.scale.setScalar(0); d.position.set(0, -50, 0); } else { p.life -= dt; p.vy -= 12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const g = terrainH(p.x, p.z); if (p.y < g) { p.y = g; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; if (p.blood && p.s > 0.7) { BLOOD.spawn(p.x, p.z, 0.25 + Math.random() * 0.3, false); p.blood = false; } } d.position.set(p.x, p.y, p.z); d.scale.setScalar(p.s * Math.min(1, p.life / p.maxLife * 2)); d.rotation.set(p.life * 5, p.life * 3, 0); im.setColorAt(i, p.c); } d.updateMatrix(); im.setMatrixAt(i, d.matrix); } im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; },
    markBlood(n) { for (let i = 0; i < n; i++) P[(head - 1 - i + N) % N].blood = true; } }; })();

// ---------------- blood decals (splats & pools) ----------------
const BLOOD = (() => {
  const N = 140;
  const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const r = U.rng(77); for (let i = 0; i < 22; i++) { const a = r() * 6.28, d = r() * r() * 52; const px = 64 + Math.cos(a) * d, py = 64 + Math.sin(a) * d; const g = x.createRadialGradient(px, py, 1, px, py, 6 + r() * 22); g.addColorStop(0, 'rgba(70,6,4,0.95)'); g.addColorStop(0.7, 'rgba(90,10,6,0.55)'); g.addColorStop(1, 'rgba(90,10,6,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, 6 + r() * 22, 0, 6.28); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 });
  const im = new THREE.InstancedMesh(geo, mat, N); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.renderOrder = 1; scene.add(im);
  const P = []; for (let i = 0; i < N; i++) P.push({ on: 0 });
  let head = 0; const d = new THREE.Object3D();
  return {
    spawn(x, z, s, pool) { const p = P[head]; head = (head + 1) % N; p.on = 1; p.x = x; p.z = z; p.s = s * (0.8 + Math.random() * 0.6); p.grow = pool ? s * 1.7 : p.s; p.rot = Math.random() * 6.28; p.age = 0; p.max = pool ? 9999 : 50; },
    clear() { for (const p of P) p.on = 0; },
    update(dt) { for (let i = 0; i < N; i++) { const p = P[i]; if (!p.on) { d.scale.setScalar(0); d.position.set(0, -60, 0); } else { p.age += dt; if (p.s < p.grow) p.s = Math.min(p.grow, p.s + dt * 0.9); const fade = p.age > p.max - 6 ? Math.max(0, (p.max - p.age) / 6) : 1; if (fade <= 0) { p.on = 0; continue; } let y = terrainH(p.x, p.z); if (W.waterY != null && y < W.waterY - 0.2) y = W.waterY; d.position.set(p.x, y + 0.045, p.z); d.rotation.set(0, p.rot, 0); d.scale.set(p.s * fade * 0.4 + p.s * 0.6, 1, p.s * fade * 0.4 + p.s * 0.6); } d.updateMatrix(); im.setMatrixAt(i, d.matrix); } im.instanceMatrix.needsUpdate = true; }
  };
})();

// ---------------- game state ----------------
const G = { started: false, complete: false, restarting: false, solo: false, readyMe: false, readyOther: false, t: 0, kills: 0, deaths: 0, lvlT: 0,
  hunters: [], stones: [], sounds: [], cueT: 0, dlgT: 0, netAcc: 0, wsAcc: 0, camYaw: 0, camPitch: -0.18, dragging: false,
  arena: -1, arenaActive: false, cleared: [], checkpoint: 0, hitStop: 0, slowmo: 0, combo: 0, comboT: 0, fovT: 58, roll: 0, music: 'calm', level: 0, interlude: false };
function makePlayer(who) { const rig = makeRig(who); scene.add(rig.g); return { who, rig, x: 0, z: 0, y: 0, yaw: Math.PI, anim: 'idle', at: 0, phase: 0, combo: 0, comboT: 0, hp: 5, maxHp: 5, noise: 0, dodgeDir: [0, -1], hitT: 0, dead: false, down: false, downT: 0, stoneCd: 0, tx: null, tz: null, tyaw: 0, inv: 0, hitApplied: false, sneak: false, rage: 0, rageOn: 0, torch: false, sink: 0, hunger: 1, mad: 0, gaze: 0, chan: null, chanT: 0 }; }
let me, other, meera;
const K = () => Net.isHost || G.solo ? me : other, S = () => Net.isHost || G.solo ? other : me;
const isAuth = () => Net.isHost || G.solo;

// ---------------- input ----------------
const keys = {}; const inp = { mx: 0, mz: 0, sneak: false, atk: false, hvy: false, dodge: false, use: false, rage: false, useHeld: false, torch: false };
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
document.querySelectorAll('#touch [data-btn]').forEach(b => { const k = b.dataset.btn; const on = ev => { ev.preventDefault(); if (k === 'sneak') keys.Tsneak = true; else if (k === 'torch') keys.Ttorch = true; else if (k === 'stone') { edge.use = true; keys.Tuse = true; } else edge[k] = true; b.classList.add('on'); }; const off = ev => { ev.preventDefault(); if (k === 'sneak') keys.Tsneak = false; if (k === 'torch') keys.Ttorch = false; if (k === 'stone') keys.Tuse = false; b.classList.remove('on'); }; b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off); b.addEventListener('touchcancel', off); });
function pollInput() { let mx = 0, mz = 0; if (keys.KeyW || keys.ArrowUp) mz -= 1; if (keys.KeyS || keys.ArrowDown) mz += 1; if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1; if (stick.active) { mx = stick.dx; mz = stick.dy; } const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; } inp.mx = mx; inp.mz = mz; inp.sneak = !!(keys.ShiftLeft || keys.ShiftRight || keys.Tsneak); inp.useHeld = !!(keys.KeyE || keys.Tuse); inp.torch = !!(keys.KeyQ || keys.Ttorch); inp.atk = edge.atk; inp.hvy = edge.hvy; inp.dodge = edge.dodge; inp.use = edge.use; inp.rage = edge.rage; edge.atk = edge.hvy = edge.dodge = edge.use = edge.rage = false; window.__inpx = mx; window.__inpz = mz; }

// ---------------- HUD helpers ----------------
function cue(id, dur = 3.2) { $('cue-text').textContent = typeof id === 'function' ? id() : T(id); $('cue').style.opacity = 1; G.cueT = dur; A.sfx('cue'); }
function say(sp, id, dur = 4) { $('dlg-sp').textContent = sp; $('dlg-sp').style.color = sp === 'MEERA' ? '#d9b48a' : sp === 'SELVAM' ? '#8fc0c8' : sp === 'KUMARAN' ? '#c9a15c' : '#c96a5a'; $('dlg-tx').textContent = typeof id === 'function' ? id() : T(id); $('dialog').style.opacity = 1; G.dlgT = dur; }
function hint(t) { $('hint').textContent = t; }
function hostCue(id, dur) { cue(id, dur); if (typeof id === 'string') Net.send({ t: 'ev', k: 'cue', id, dur }); }
function hostSay(sp, id, dur) { say(sp, id, dur); if (typeof id === 'string') Net.send({ t: 'ev', k: 'say', sp, id, dur }); }
let script = []; let scriptT = 0;
function runScript(dt) { if (!script.length) return; scriptT += dt; while (script.length && script[0].at <= scriptT) { const Ln = script.shift(); if (Ln.cue) cue(Ln.cue, Ln.dur); else if (Ln.fn) Ln.fn(); else say(Ln.sp, Ln.id, Ln.dur); } }
function banner(text, sub = '', dur = 2.6) { $('banner-t').textContent = text; $('banner-s').textContent = sub; $('banner').style.opacity = 1; clearTimeout(banner._t); banner._t = setTimeout(() => $('banner').style.opacity = 0, dur * 1000); }
function meter(label, color) { $('m1wrap').classList.remove('hidden'); $('m1lbl').textContent = label; $('m1').style.background = color; return (v, show = true) => { $('m1wrap').style.opacity = show ? 1 : 0; $('m1lbl').style.opacity = show ? 1 : 0; $('m1').style.width = U.clamp(v, 0, 1) * 100 + '%'; }; }
function hideMeter() { $('m1wrap').classList.add('hidden'); $('m1lbl').style.opacity = 0; }
function tintFx(css) { $('fxa').style.background = css || 'none'; $('fxa').style.opacity = css ? 1 : 0; }
function canvasFilter(f) { canvas.style.filter = f || ''; }
function hurtFlash() { $('hurt').style.opacity = 1; setTimeout(() => $('hurt').style.opacity = 0, 250); }

// ---------------- world helpers ----------------
function blocked(x, z, r = 0.5) { for (const t of cols) { const d = Math.hypot(t[0] - x, t[1] - z); if (d < t[2] + r) return t; } for (const w of softWalls) { if (w.open < 0.9 && Math.abs(z - w.wallZ) < 1.6 + r) return [x, w.wallZ, 1]; } return null; }
function moveWithCollision(p, nx, nz) { const t = blocked(nx, nz); if (!t) { p.x = nx; p.z = nz; return; } const t2 = blocked(nx, p.z); if (!t2) { p.x = nx; return; } const t3 = blocked(p.x, nz); if (!t3) { p.z = nz; return; } }
function addSound(x, z, r, kind, p) { G.sounds.push({ x, z, r, kind, p, life: 0.12 }); }
let shake = 0;
function juice(kind, x, y, z, dx, dz) {
  const hasDir = dx != null;
  if (kind === 'hit') { G.hitStop = Math.max(G.hitStop, 0.055); shake = Math.max(shake, 0.25); if (hasDir) { PARTS.jet(x, y, z, dx, dz, 16, 0x6a0d08, 7, 0.5, 0.7); PARTS.markBlood(12); } PARTS.spawn(x, y, z, 14, 0x5a0a06, 3, 3, 0.5, 0.6); PARTS.markBlood(6); PARTS.spawn(x, y, z, 4, 0xffb060, 5, 4, 0.5, 0.25); BLOOD.spawn(x, z, 0.5, false); A.sfx('clatter', 0.5); }
  else if (kind === 'heavy') { G.hitStop = Math.max(G.hitStop, 0.11); shake = Math.max(shake, 0.7); if (hasDir) { PARTS.jet(x, y, z, dx, dz, 28, 0x6a0d08, 10, 0.65, 0.9); PARTS.markBlood(22); } PARTS.spawn(x, y, z, 26, 0x5a0a06, 5, 5, 0.6, 0.8); PARTS.markBlood(12); PARTS.spawn(x, y, z, 8, 0xffb060, 7, 5, 0.6, 0.3); BLOOD.spawn(x, z, 0.9, false); A.sfx('thud', 0.5); A.sfx('clatter', 0.5); }
  else if (kind === 'kill') { G.slowmo = 0.45; G.fovT = 50; shake = Math.max(shake, 0.5); if (hasDir) { PARTS.jet(x, y, z, dx, dz, 32, 0x5a0a06, 9, 0.7, 1.1); PARTS.markBlood(26); } PARTS.spawn(x, y, z, 36, 0x4a0806, 5, 6, 0.65, 1.1); PARTS.markBlood(18); BLOOD.spawn(x, z, 1.7, true); A.sfx('death', 0.5); }
  else if (kind === 'slam') { shake = Math.max(shake, 1.0); PARTS.spawn(x, terrainH(x, z) + 0.2, z, 40, 0x4a5a30, 8, 5, 1.2, 0.8); A.sfx('thud', 0.5); A.sfx('wave', 0.5); }
  else if (kind === 'hurt') { G.hitStop = Math.max(G.hitStop, 0.08); shake = Math.max(shake, 0.6); hurtFlash(); A.sfx('thud', 0.5); }
  else if (kind === 'rise') { PARTS.spawn(x, terrainH(x, z) + 0.3, z, 30, 0x3a4a28, 5, 6, 1.2, 0.9); A.sfx('growl', 0.5); shake = Math.max(shake, 0.3); }
  else if (kind === 'stealth') { G.slowmo = 0.6; G.fovT = 48; PARTS.spawn(x, y, z, 30, 0x4a0806, 3, 4, 0.6, 1.0); PARTS.markBlood(16); BLOOD.spawn(x, z, 1.4, true); A.sfx('rope', 0.5); A.sfx('death', 0.5); }
  else if (kind === 'wardbreak') { G.hitStop = Math.max(G.hitStop, 0.09); shake = Math.max(shake, 0.8); PARTS.spawn(x, y, z, 44, 0xffd060, 8, 7, 1.1, 0.9); A.sfx('bell', 0.7); A.sfx('clatter', 0.4); }
  else if (kind === 'wardhit') { PARTS.spawn(x, y, z, 8, 0xffd060, 3, 2.5, 0.6, 0.35); A.sfx('tick', 0.5); }
  else if (kind === 'splash') { PARTS.spawn(x, y, z, 22, 0x8ac8d8, 4, 5, 0.9, 0.7); A.sfx('splash', 0.5); }
  else if (kind === 'shot') { shake = Math.max(shake, 0.45); A.sfx('gun', 0.6); }
  else if (kind === 'vanish') { PARTS.spawn(x, y, z, 26, 0x8a5adf, 3, 4, 1.0, 0.8); A.sfx('whoosh', 0.5); }
  else if (kind === 'eat') { PARTS.spawn(x, y, z, 12, 0x8adf5a, 2, 3, 0.7, 0.6); A.sfx('success', 0.4); }
  else if (kind === 'fire') { PARTS.spawn(x, y, z, 20, 0xffa040, 3, 5, 0.9, 0.7); A.sfx('cue', 0.4); }
}
function bc(k, data = {}) { Net.send(Object.assign({ t: 'ev', k }, data)); }

// ---------------- severed-limb debris ----------------
const DEBRIS = [];
function spawnLimb(x, y, z, dx, dz, scale = 1) {
  if (DEBRIS.length > 18) { const o = DEBRIS.shift(); scene.remove(o.m); }
  const g = new THREE.Group();
  const lm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06 * scale, 0.3 * scale, 3, 6), new THREE.MeshStandardMaterial({ color: 0x362419, roughness: 0.85 })); lm.castShadow = true; g.add(lm);
  const stump = new THREE.Mesh(new THREE.SphereGeometry(0.068 * scale, 7, 6), new THREE.MeshStandardMaterial({ color: 0x4a0806, roughness: 0.55 })); stump.position.y = 0.18 * scale; g.add(stump);
  scene.add(g); g.position.set(x, y, z);
  const dl = Math.hypot(dx, dz) || 1;
  DEBRIS.push({ m: g, x, y, z, vx: dx / dl * (3 + Math.random() * 3.5), vy: 4 + Math.random() * 3, vz: dz / dl * (3 + Math.random() * 3.5), rx: Math.random() * 10 - 5, rz: Math.random() * 10 - 5, life: 9 });
}
function debrisUpdate(dt) {
  for (let i = DEBRIS.length - 1; i >= 0; i--) { const d = DEBRIS[i]; d.life -= dt; d.vy -= 14 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; const g2 = terrainH(d.x, d.z) + 0.06; if (d.y < g2) { if (Math.abs(d.vy) > 1.2) BLOOD.spawn(d.x, d.z, 0.35, false); d.y = g2; d.vy *= -0.35; d.vx *= 0.55; d.vz *= 0.55; d.rx *= 0.4; d.rz *= 0.4; } d.m.position.set(d.x, d.y, d.z); d.m.rotation.x += d.rx * dt; d.m.rotation.z += d.rz * dt; if (d.life <= 0) { scene.remove(d.m); DEBRIS.splice(i, 1); } }
}
function clearDebris() { for (const d of DEBRIS) scene.remove(d.m); DEBRIS.length = 0; }
let _bfxT = null;
function bloodSplash() { const el = $('bloodfx'); if (!el) return; el.style.transition = 'none'; el.style.opacity = 0.85; clearTimeout(_bfxT); _bfxT = setTimeout(() => { el.style.transition = 'opacity 1.3s'; el.style.opacity = 0; }, 60); }

// ---------------- enemies ----------------
function instEnemy(type, x, z, state, yaw, arena, opts = {}) {
  const T_ = ETYPES[type]; const rig = makeHunter(type); scene.add(rig.g);
  const h = { id: G.hunters.length, type, rig, x, z, ax: x, az: z, range: opts.range || 10, yaw: yaw == null ? rng() * 6.28 : yaw, state, st: 0, tx: x, tz: z, hp: T_.hp, maxHp: T_.hp, ph: Math.random() * 6, target: null, gx: null, gz: null, windup: T_.windup, dmg: T_.dmg, reach: T_.reach, speed: T_.speed, aoe: !!T_.aoe, poise: T_.poise || 0, boss: !!T_.boss, arena: arena == null ? -1 : arena, flashT: 0, nextCharge: 6, aggro: 0, opts, def: opts.def || null, ward: !!opts.ward, wardDown: 0, lastHitK: 0, lastHitS: 0, soloT: 0 };
  if (h.ward) { const wm = new THREE.Mesh(new THREE.SphereGeometry(1.15, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })); wm.position.y = 1.1; wm.scale.setScalar((T_.scale || 1) * 1.35); rig.g.add(wm); h.wardMesh = wm; }
  G.hunters.push(h); return h;
}
function spawnEnemies() {
  for (const h of G.hunters) scene.remove(h.rig.g); G.hunters = [];
  const arenas = LV.arenas || [];
  arenas.forEach((a, ai) => { if (G.cleared[ai]) return; for (const s of a.spawn) instEnemy(s[0], s[1], s[2], 'hidden', null, ai, s[3] || {}); });
  for (const d of EDEFS) { if (d.done) continue; if (d.afterCp != null && d.afterCp > G.checkpoint) continue; instEnemy(d.type, d.x, d.z, d.state || 'listen', d.yaw, -1, Object.assign({ def: d }, d.opts || {})); }
}
function nearestPlayer(h, players) { let best = null, bd = 1e9; for (const p of players) { const d = Math.hypot(p.x - h.x, p.z - h.z); if (d < bd) { bd = d; best = p; } } return best; }
function sep(h) { let sx = 0, sz = 0; for (const o of G.hunters) { if (o === h || o.state === 'dead' || o.state === 'hidden') continue; const ox = h.x - o.x, oz = h.z - o.z, od = Math.hypot(ox, oz); if (od < 2.2 && od > 0.01) { sx += ox / od * (2.2 - od); sz += oz / od * (2.2 - od); } } return [sx, sz]; }
function stepTo(h, tx, tz, sp, dt) { const dx = tx - h.x, dz = tz - h.z, d = Math.hypot(dx, dz); if (d < 0.05) return d; const [sx, sz] = sep(h); const nx = h.x + (dx / d + sx) * sp * dt, nz = h.z + (dz / d + sz) * sp * dt; const b = blocked(nx, nz, 0.4); if (!b) { h.x = nx; h.z = nz; } else { h.x += dz / d * sp * dt * 0.7; h.z -= dx / d * sp * dt * 0.7; } h.yaw = Math.atan2(dx, dz); return d; }
function brainHumanoid(h, dt, players) {
  const arenas = LV.arenas || [];
  if (h.state === 'rise') { if (h.st > 0.7) { h.state = 'chase'; h.st = 0; h.target = nearestPlayer(h, players); } return; }
  if (h.state === 'roar') { if (h.st > 1.4) { h.state = 'chase'; h.st = 0; h.target = nearestPlayer(h, players); } return; }
  if (h.arena < 0 && !h.opts.deaf) { let heard = null, best = 1e9; for (const s of G.sounds) { const d = Math.hypot(s.x - h.x, s.z - h.z); const rr = s.r * (h.state === 'listen' ? 1.7 : 1); if (d < rr && d < best) { best = d; heard = s; } }
    if (heard && h.state !== 'attack' && h.state !== 'stagger') { if (heard.kind === 'stone') { if (h.state !== 'chase') { h.state = 'investigate'; h.tx = heard.x; h.tz = heard.z; h.st = 0; } } else { if (h.state !== 'chase') { A.sfx('growl', 0.5); bc('sfx', { n: 'growl' }); } h.state = 'chase'; h.tx = heard.x; h.tz = heard.z; h.target = heard.p; h.st = 0; } } }
  else if (h.arena >= 0 && h.state !== 'attack' && h.state !== 'stagger' && h.state !== 'charge') { if (!h.target || h.target.down || h.target.dead) h.target = nearestPlayer(h, players); if (h.target) { h.state = 'chase'; h.tx = h.target.x; h.tz = h.target.z; } }
  if (h.opts.alwaysAggro && h.state !== 'attack' && h.state !== 'stagger' && h.state !== 'charge') { if (!h.target || h.target.down || h.target.dead) h.target = nearestPlayer(h, players); if (h.target) { h.state = 'chase'; h.tx = h.target.x; h.tz = h.target.z; } }
  const sp = h.state === 'chase' ? h.speed : h.state === 'charge' ? h.speed * 2.6 : h.state === 'investigate' ? 3.4 : 1.4;
  if (h.state === 'patrol') { const dx = h.tx - h.x, dz = h.tz - h.z, d = Math.hypot(dx, dz); if (d < 0.5) { const a = rng() * 6.28; h.tx = h.ax + Math.cos(a) * h.range * rng(); h.tz = h.az + Math.sin(a) * h.range * rng() * 0.6; if (rng() < 0.5) { h.state = 'listen'; h.st = 0; } } else { h.x += dx / d * sp * dt; h.z += dz / d * sp * dt; h.yaw = Math.atan2(dx, dz); h.ph += dt * 4; } }
  else if (h.state === 'listen') { if (h.st > 1.6 && h.arena < 0 && h.opts.wander) { h.state = 'patrol'; h.st = 0; } }
  else if (h.state === 'investigate' || h.state === 'chase') {
    if (h.state === 'chase' && h.target) { const tp = h.target; const d = Math.hypot(tp.x - h.x, tp.z - h.z); if (h.arena >= 0 || h.opts.alwaysAggro || (tp.noise > 0.15 && d < 18)) { h.tx = tp.x; h.tz = tp.z; h.st = Math.min(h.st, 0.3); }
      if (h.boss && !h.opts.noCharge && d > 9 && h.nextCharge <= 0) { h.state = 'charge'; h.st = 0; h.yaw = Math.atan2(tp.x - h.x, tp.z - h.z); h.nextCharge = 7; A.sfx('growl', 0.5); bc('sfx', { n: 'growl' }); return; }
      if (d < h.reach * 0.85 && !tp.dead && !tp.down) { h.state = 'attack'; h.st = 0; h.yaw = Math.atan2(tp.x - h.x, tp.z - h.z); h.hitDone = false; return; } }
    const d = stepTo(h, h.tx, h.tz, sp, dt); h.ph += dt * (h.state === 'chase' ? 12 : 7);
    if (d <= 0.4 && h.st > (h.state === 'chase' ? 1.3 : 2.5) && h.arena < 0 && !h.opts.alwaysAggro) { h.state = 'listen'; h.st = 0; h.target = null; }
    if (h.state === 'chase' && h.st > 6 && h.arena < 0 && !h.opts.alwaysAggro) { h.state = 'listen'; h.st = 0; h.target = null; }
  }
  else if (h.state === 'charge') { h.x += Math.sin(h.yaw) * sp * dt; h.z += Math.cos(h.yaw) * sp * dt; h.ph += dt * 14; for (const tp of players) { const d = Math.hypot(tp.x - h.x, tp.z - h.z); if (d < 2.4 && tp.inv <= 0) damagePlayer(tp, 2, h); } if (h.st > 1.1 || blocked(h.x + Math.sin(h.yaw) * 1.5, h.z + Math.cos(h.yaw) * 1.5, 0.5)) { h.state = 'stagger'; h.st = 0; juice('slam', h.x, 0, h.z); bc('juice', { j: 'slam', x: h.x, z: h.z }); } }
  else if (h.state === 'attack') { const tp = h.target; const wu = h.windup; if (h.st > wu && h.st < wu + 0.18 && !h.hitDone) { h.hitDone = true; if (h.aoe) { juice('slam', h.x + Math.sin(h.yaw) * 1.5, 0, h.z + Math.cos(h.yaw) * 1.5); bc('juice', { j: 'slam', x: h.x + Math.sin(h.yaw) * 1.5, z: h.z + Math.cos(h.yaw) * 1.5 }); for (const p of players) { const d = Math.hypot(p.x - h.x, p.z - h.z); if (d < h.reach + 0.5 && p.inv <= 0) damagePlayer(p, h.dmg, h); } } else if (tp) { const d = Math.hypot(tp.x - h.x, tp.z - h.z); const fx2 = Math.sin(h.yaw), fz2 = Math.cos(h.yaw); const dot = ((tp.x - h.x) * fx2 + (tp.z - h.z) * fz2) / Math.max(0.01, d); if (d < h.reach + 0.3 && dot > 0.3 && tp.inv <= 0) damagePlayer(tp, h.dmg, h); } } if (h.st > wu && h.st < wu + 0.15 && !h.aoe) { h.x += Math.sin(h.yaw) * 7 * dt; h.z += Math.cos(h.yaw) * 7 * dt; } if (h.st > wu + 0.45) { h.state = 'chase'; h.st = 0; if (tp) { h.tx = tp.x; h.tz = tp.z; } } }
  else if (h.state === 'stagger') { if (h.st > (h.boss ? 0.6 : 0.35)) { h.state = 'chase'; h.st = 0; } }
  h.nextCharge -= dt;
}
function brainGunman(h, dt, players) {
  if (h.state === 'rise') { if (h.st > 0.7) { h.state = 'reposition'; h.st = 0; h.nextCharge = 1.0 + Math.random() * 1.2; } return; }
  if (!h.target || h.target.down || h.target.dead) { h.target = nearestPlayer(h, players); if (!h.target) return; }
  const tp = h.target, d = Math.hypot(tp.x - h.x, tp.z - h.z);
  if (h.state === 'stagger') { if (h.st > 0.5) { h.state = 'reposition'; h.st = 0; } return; }
  if (h.state === 'attack') { brainHumanoid(h, dt, players); return; } // melee bash fallback via humanoid attack timing
  if (h.state === 'reposition') {
    h.yaw = Math.atan2(tp.x - h.x, tp.z - h.z); h.ph += dt * 8;
    if (d < 6) { const bx = h.x + (h.x - tp.x) / d * 4, bzz = h.z + (h.z - tp.z) / d * 4; stepTo(h, bx, bzz, h.speed, dt); h.yaw = Math.atan2(tp.x - h.x, tp.z - h.z); }
    else if (d > 17) stepTo(h, tp.x, tp.z, h.speed, dt);
    if (d < 2.4) { h.state = 'attack'; h.st = 0; h.hitDone = false; return; }
    if (h.nextCharge <= 0 && d >= 5 && d < 26) { h.state = 'aim'; h.st = 0; }
  }
  else if (h.state === 'aim') {
    const want = Math.atan2(tp.x - h.x, tp.z - h.z); let dy = want - h.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; h.yaw += dy * Math.min(1, dt * (h.st > h.windup * 0.6 ? 0.6 : 2.2));
    if (h.st >= h.windup) { // fire
      h.state = 'reposition'; h.st = 0; h.nextCharge = h.opts.cd || 2.6;
      const fx2 = Math.sin(h.yaw), fz2 = Math.cos(h.yaw);
      juice('shot', h.x, 1.4, h.z); bc('juice', { j: 'shot', x: h.x, y: 1.4, z: h.z });
      PARTS.spawn(h.x + fx2 * 1.2, terrainH(h.x, h.z) + 1.4, h.z + fz2 * 1.2, 8, 0xffd080, 2, 1, 0.5, 0.25);
      for (const p of players) { const px = p.x - h.x, pz = p.z - h.z; const along = px * fx2 + pz * fz2; if (along < 0 || along > 30) continue; const perp = Math.abs(px * fz2 - pz * fx2); if (perp < 1.0 && p.inv <= 0) { damagePlayer(p, h.dmg, h); break; } }
    }
  }
  else { h.state = 'reposition'; h.st = 0; }
  h.nextCharge -= dt;
}
function brainCroc(h, dt, players) {
  const tp = nearestPlayer(h, players); const d = tp ? Math.hypot(tp.x - h.x, tp.z - h.z) : 1e9;
  const tgtInWater = tp && inWater(tp.x, tp.z);
  if (h.state === 'stagger') { if (h.st > 0.4) { h.state = 'lurk'; h.st = 0; } return; }
  if (h.state === 'lurk') {
    const dd = Math.hypot(h.tx - h.x, h.tz - h.z); if (dd < 0.5) { const a = rng() * 6.28; h.tx = h.ax + Math.cos(a) * 5; h.tz = h.az + Math.sin(a) * 5; if (!inWater(h.tx, h.tz)) { h.tx = h.ax; h.tz = h.az; } } else stepTo(h, h.tx, h.tz, 1.2, dt);
    if (tp && tgtInWater && d < (h.opts.senseR || 17)) { h.state = 'surge'; h.target = tp; h.st = 0; A.sfx('splash', 0.5); bc('sfx', { n: 'splash' }); }
    else if (tp && d < 3.5) { h.state = 'surge'; h.target = tp; h.st = 0; }
  }
  else if (h.state === 'surge') {
    const t2 = h.target; if (!t2 || t2.down || t2.dead) { h.state = 'lurk'; h.st = 0; return; }
    const dd = Math.hypot(t2.x - h.x, t2.z - h.z); const onLand = !inWater(h.x, h.z);
    const spd = onLand ? 2.3 : 8.5; stepTo(h, t2.x, t2.z, spd, dt); h.ph += dt * (onLand ? 6 : 12);
    if (dd < h.reach * 0.8) { h.state = 'attack'; h.st = 0; h.yaw = Math.atan2(t2.x - h.x, t2.z - h.z); h.hitDone = false; }
    else if (Math.hypot(h.x - h.ax, h.z - h.az) > (h.opts.leash || 26) || (!inWater(t2.x, t2.z) && onLand && dd > 7)) { h.state = 'return'; h.st = 0; }
  }
  else if (h.state === 'return') { const dd = stepTo(h, h.ax, h.az, 4, dt); h.ph += dt * 8; if (dd < 1) { h.state = 'lurk'; h.st = 0; } if (tp && tgtInWater && d < 14) { h.state = 'surge'; h.target = tp; h.st = 0; } }
  else if (h.state === 'attack') { const wu = h.windup; if (h.st > wu && h.st < wu + 0.2 && !h.hitDone) { h.hitDone = true; const t2 = h.target; if (t2) { const dd = Math.hypot(t2.x - h.x, t2.z - h.z); if (dd < h.reach + 0.5 && t2.inv <= 0) damagePlayer(t2, h.dmg, h); } juice('splash', h.x, 0.6, h.z); bc('juice', { j: 'splash', x: h.x, y: 0.6, z: h.z }); } if (h.st > wu + 0.5) { h.state = inWater(h.x, h.z) ? 'surge' : 'return'; h.st = 0; } }
}
function brainSnake(h, dt, players) {
  const tp = nearestPlayer(h, players); const d = tp ? Math.hypot(tp.x - h.x, tp.z - h.z) : 1e9;
  const torchNear = players.some(p => p.torch && Math.hypot(p.x - h.x, p.z - h.z) < 5.5);
  if (h.state === 'nest' || h.state === 'recoil') {
    if (torchNear) { if (h.state !== 'recoil') { h.state = 'recoil'; h.st = 0; } const away = tp; if (away) { const dd = Math.hypot(away.x - h.x, away.z - h.z); if (dd < 4.5) stepTo(h, h.x + (h.x - away.x) / dd * 2, h.z + (h.z - away.z) / dd * 2, 2.2, dt); } }
    else if (h.state === 'recoil' && h.st > 0.6) { h.state = 'nest'; h.st = 0; }
    else if (h.state === 'nest' && tp && d < (h.opts.senseR || 3.4) && !tp.down && !tp.dead) { h.state = 'coil'; h.st = 0; h.target = tp; h.yaw = Math.atan2(tp.x - h.x, tp.z - h.z); A.sfx('creak', 0.4); }
  }
  else if (h.state === 'coil') { const t2 = h.target; if (t2) h.yaw = Math.atan2(t2.x - h.x, t2.z - h.z); if (torchNear) { h.state = 'recoil'; h.st = 0; } else if (h.st >= h.windup) { h.state = 'attack'; h.st = 0; h.hitDone = false; } }
  else if (h.state === 'attack') { if (h.st > 0.08 && h.st < 0.26 && !h.hitDone) { const t2 = h.target; if (t2) { const dd = Math.hypot(t2.x - h.x, t2.z - h.z); const fx2 = Math.sin(h.yaw), fz2 = Math.cos(h.yaw); const dot = ((t2.x - h.x) * fx2 + (t2.z - h.z) * fz2) / (dd || 1); if (dd < h.reach + 0.4 && dot > 0.2 && t2.inv <= 0) { h.hitDone = true; damagePlayer(t2, h.dmg, h); } } } if (h.st > 0.5) { h.state = 'cooldown'; h.st = 0; } }
  else if (h.state === 'cooldown') { if (h.st > 1.1) { h.state = 'nest'; h.st = 0; } }
  else if (h.state === 'stagger') { if (h.st > 0.3) { h.state = 'nest'; h.st = 0; } }
}
function brainCannibal(h, dt, players) {
  if (h.state === 'frenzy') {
    const tp = h.target; if (!tp || tp.down || tp.dead) { h.state = 'still'; h.st = 0; h.aggro = 0; return; }
    const d = Math.hypot(tp.x - h.x, tp.z - h.z);
    if (d > (h.opts.calmR || 26)) { h.state = 'still'; h.st = 0; h.aggro = 0; h.tx = h.ax; h.tz = h.az; return; }
    if (d < h.reach * 0.85) { h.state = 'attack'; h.st = 0; h.yaw = Math.atan2(tp.x - h.x, tp.z - h.z); h.hitDone = false; return; }
    stepTo(h, tp.x, tp.z, h.speed, dt); h.ph += dt * 13; return;
  }
  if (h.state === 'attack' || h.state === 'stagger') { const keep = h.state; brainHumanoid(h, dt, players); if (h.state === 'chase') { h.state = 'frenzy'; h.st = 0; } return; }
  // still / patrol: build aggro from being looked at or touched
  let looked = null;
  for (const p of players) { const dx = h.x - p.x, dz = h.z - p.z, d = Math.hypot(dx, dz); if (d < 2.2) { looked = p; h.aggro = 1; break; } if (d > (h.opts.seeR || 19)) continue; const dot = (Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) / (d || 1); if (dot > 0.82) looked = p; }
  if (looked) { h.aggro = Math.min(1, h.aggro + dt * (h.opts.aggroRate || 0.75)); h.target = looked; }
  else h.aggro = Math.max(0, h.aggro - dt * 0.5);
  const loud = G.sounds.find(s => s.kind === 'player' && s.r > 9 && Math.hypot(s.x - h.x, s.z - h.z) < 7);
  if (loud) { h.aggro = 1; h.target = loud.p; }
  if (h.aggro >= 1 && h.target) { h.state = 'frenzy'; h.st = 0; A.sfx('growl', 0.6); bc('sfx', { n: 'growl' }); juice('rise', h.x, 0, h.z); bc('juice', { j: 'rise', x: h.x, z: h.z }); return; }
  if (h.opts.wander) { if (h.state !== 'patrol' && h.st > 3 && rng() < 0.005) { h.state = 'patrol'; h.st = 0; const a = rng() * 6.28; h.tx = h.ax + Math.cos(a) * h.range; h.tz = h.az + Math.sin(a) * h.range * 0.5; } if (h.state === 'patrol') { const d = stepTo(h, h.tx, h.tz, 1.3, dt); h.ph += dt * 4; if (d < 0.6) { h.state = 'still'; h.st = 0; } } }
}
function brainIllusion(h, dt, players) {
  const tp = nearestPlayer(h, players); if (!tp) return;
  if (h.state === 'rise') { if (h.st > 0.5) { h.state = 'chase'; h.st = 0; } return; }
  h.life = (h.life || 9) - dt;
  if (h.life <= 0) { h.state = 'dead'; h.st = 0; juice('vanish', h.x, 1.2, h.z); bc('juice', { j: 'vanish', x: h.x, y: 1.2, z: h.z }); return; }
  if (h.state === 'attack') { brainHumanoid(h, dt, players); if (h.state === 'chase') h.st = 0; return; }
  const d = stepTo(h, tp.x, tp.z, h.speed, dt); h.ph += dt * 13; h.target = tp;
  if (d < h.reach * 0.85) { h.state = 'attack'; h.st = 0; h.yaw = Math.atan2(tp.x - h.x, tp.z - h.z); h.hitDone = false; }
}
regBrain('gunman', brainGunman); regBrain('captain', brainGunman); regBrain('croc', brainCroc); regBrain('aazhi', brainCroc); regBrain('snake', brainSnake); regBrain('cannibal', brainCannibal); regBrain('watcher', brainCannibal); regBrain('illusion', brainIllusion);
function enemyUpdate(dt) {
  const players = [me, other].filter(p => p && !p.down && !p.dead && (p === me || p.tx != null));
  const coopNow = !G.solo && other && other.tx != null;
  for (const h of G.hunters) {
    h.st += dt; h.flashT = Math.max(0, h.flashT - dt);
    if (h.ward) h.wardDown = Math.max(0, h.wardDown - dt);
    if (h.state === 'dead') { if (h.st > 3) h.rig.g.visible = false; continue; }
    if (h.state === 'hidden') continue;
    if (h.state === 'sink') { if (h.st > 2.2) { h.state = 'dead'; h.st = 0; G.kills++; bc('juice', { j: 'splash', x: h.x, y: 0.5, z: h.z }); juice('splash', h.x, 0.5, h.z); } continue; }
    if (LV.enemyHazard && LV.enemyHazard(CTX, h, dt)) continue;
    (BRAINS[h.type] || brainHumanoid)(h, dt, players);
    h.x = U.clamp(h.x, -W.half - 6, W.half + 6);
  }
}
function damageHunter(h, dmg, from, kind = 'hit') {
  if (h.state === 'dead' || h.state === 'hidden' || h.state === 'sink') return;
  const T_ = ETYPES[h.type]; if (T_.exposedOnly && h.state === 'lurk') return; // can't hit a lurking croc
  const src = from.__real || from;
  const ddx = h.x - from.x, ddz = h.z - from.z;
  const y = terrainH(h.x, h.z) + 1.2 * (T_.scale || 1);
  // Twin Strike ward: full damage only while the ward is down
  if (h.ward && h.wardDown <= 0) {
    const t = G.t; if (src.who === 'K') h.lastHitK = t; else if (src.who === 'S') h.lastHitS = t;
    const coop = !G.solo && other && other.tx != null;
    if (coop && h.lastHitK && h.lastHitS && Math.abs(h.lastHitK - h.lastHitS) < 1.25) {
      h.wardDown = 6.5; h.lastHitK = h.lastHitS = 0;
      juice('wardbreak', h.x, y, h.z); bc('juice', { j: 'wardbreak', x: h.x, y, z: h.z });
      banner(L('TWIN STRIKE — THE WARD SHATTERS', 'இரட்டை வெட்டு — கவசம் உடைந்தது'), L('Six breaths of open flesh', 'ஆறு மூச்சுக்கு அது வெறும் சதை'), 2.2);
      Net.send({ t: 'ev', k: 'twin' });
    } else {
      dmg = Math.min(dmg, 1); h.flashT = 0.12;
      juice('wardhit', h.x, y, h.z); bc('juice', { j: 'wardhit', x: h.x, y, z: h.z });
    }
  }
  h.hp -= dmg; h.flashT = 0.12;
  if (h.hp <= 0) {
    h.state = 'dead'; h.st = 0; G.kills++; if (h.def && h.def.once) h.def.done = true;
    juice(T_.vanish ? 'vanish' : 'kill', h.x, y, h.z, ddx, ddz); bc('juice', { j: T_.vanish ? 'vanish' : 'kill', x: h.x, y, z: h.z, dx: ddx, dz: ddz });
    if (!T_.rig && !T_.vanish) { const nL = kind === 'heavy' ? 2 : (Math.random() < 0.4 ? 1 : 0); if (nL) { for (let i = 0; i < nL; i++) spawnLimb(h.x, y, h.z, ddx + (Math.random() - 0.5), ddz + (Math.random() - 0.5), T_.scale || 1); bc('limb', { x: h.x, y, z: h.z, dx: ddx, dz: ddz, n: nL, s: T_.scale || 1 }); } }
    if (Math.hypot(h.x - me.x, h.z - me.z) < 9) bloodSplash();
    if (h.boss) setTimeout(() => A.horn(52, 5, 0.5), 400);
    if (T_.onDeath) T_.onDeath(CTX, h);
  } else {
    juice(kind === 'heavy' ? 'heavy' : 'hit', h.x, y, h.z, ddx, ddz); bc('juice', { j: kind === 'heavy' ? 'heavy' : 'hit', x: h.x, y, z: h.z, dx: ddx, dz: ddz });
    const heavy = kind === 'heavy';
    if (h.poise === 0 || heavy || (h.poise <= 2 && h.hp < h.maxHp * 0.3)) { h.state = 'stagger'; h.st = 0; }
    h.target = src; h.tx = src.x; h.tz = src.z;
    const d = Math.hypot(h.x - from.x, h.z - from.z) || 1; const kb = (heavy ? 1.8 : 0.6) / (1 + h.poise * 0.6);
    h.x += (h.x - from.x) / d * kb; h.z += (h.z - from.z) / d * kb;
    if (h.type === 'cannibal' || h.type === 'watcher') { h.aggro = 1; h.state = 'frenzy'; h.st = 0; }
    if (T_.onHurt) T_.onHurt(CTX, h);
  }
}
function damagePlayer(p, dmg, h) { if (p.dead || p.down || G.restarting || p.inv > 0) return; if (p.rageOn > 0) dmg = Math.max(1, dmg - 1); p.hp -= dmg; p.hitT = 0.35; p.anim = 'hit'; p.at = 0; p.inv = 0.9; if (h) { const d = Math.hypot(p.x - h.x, p.z - h.z) || 1; p.x += (p.x - h.x) / d * 1.4; p.z += (p.z - h.z) / d * 1.4; } if (p === me) juice('hurt', p.x, 0, p.z); bc('hurt', { who: p.who, hp: p.hp, x: p.x, z: p.z }); if (p.hp <= 0) { p.hp = 0; p.down = true; p.downT = 20; p.anim = 'dead'; p.at = 0; bc('down', { who: p.who }); const partner = p === me ? other : me; const partnerAbsent = partner === other && other.tx == null; if (G.solo || partnerAbsent || partner.down) { restart(p.who); } else { hostSay('MEERA', p.who === 'K' ? 'down_k' : 'down_s', 4); } } }

// ---------------- restart / checkpoints ----------------
async function restart(who) { if (G.restarting) return; G.restarting = true; G.deaths++; if (Net.isHost) bc('restart', { who, cp: G.checkpoint }); A.sfx('death', 0.5); await new Promise(r => setTimeout(r, 1300)); $('fade').style.opacity = 1; await new Promise(r => setTimeout(r, 900)); resetAll(); $('fade').style.opacity = 0; G.restarting = false; say('MEERA', 'restart', 3.5); }
function resetAll() {
  const cps = LV.checkpoints || [0]; const cz = cps[Math.min(G.checkpoint, cps.length - 1)];
  for (const p of [me, other]) { if (!p) continue; p.x = (p.who === 'K' ? -1.5 : 1.5) + (Array.isArray(cz) ? cz[0] : 0); p.z = Array.isArray(cz) ? cz[1] : cz; p.yaw = Math.PI; p.hp = p.maxHp; p.dead = false; p.down = false; p.anim = 'idle'; p.at = 0; p.inv = 0; p.hitT = 0; p.noise = 0; p.rageOn = 0; p.sink = 0; p.hunger = 1; p.mad = 0; p.gaze = 0; p.torch = false; p.chan = null; }
  other.tx = null; spawnEnemies(); G.stones.forEach(s => scene.remove(s.m)); G.stones = []; G.sounds = []; G.camYaw = 0; G.arena = -1; G.arenaActive = false; G.combo = 0;
  meera.x = me.x + 2; meera.z = me.z + 2;
  softWalls.forEach((w, i) => { w.open = G.cleared[i] ? 1 : 0; });
  if (LV.onReset) LV.onReset(CTX);
  updateHP();
}

// ---------------- arena system (levels may define LV.arenas) ----------------
function arenaUpdate(dt) {
  if (!isAuth() || !LV.arenas) return;
  const lead = Math.min(me.z, other && other.tx != null ? other.z : me.z);
  if (!G.arenaActive) { LV.arenas.forEach((a, i) => { if (G.cleared[i] || G.arenaActive) return; if (lead < a.z + a.r) { G.arena = i; G.arenaActive = true; G.checkpoint = Math.max(G.checkpoint, a.cp != null ? a.cp : i); bc('arena', { i, cp: G.checkpoint }); arenaStart(i); } }); }
  else { const alive = G.hunters.filter(h => h.arena === G.arena && h.state !== 'dead').length; if (alive === 0) { G.cleared[G.arena] = true; G.arenaActive = false; bc('cleared', { i: G.arena }); arenaCleared(G.arena); } }
}
function arenaStart(i) { const a = LV.arenas[i]; for (const h of G.hunters) if (h.arena === i && h.state === 'hidden') { h.state = a.boss ? 'roar' : 'rise'; h.st = -0.15 * (h.id % 4); juice('rise', h.x, 0, h.z); } if (arenaLights[i]) arenaLights[i].intensity = 3; A.drumsSet(a.boss ? 'war' : 'tense', a.boss ? 112 : 96, 1.1); G.music = 'war'; if (a.banner) a.banner(CTX); shake = Math.max(shake, 0.5); }
function arenaCleared(i) { const a = LV.arenas[i]; if (arenaLights[i]) arenaLights[i].intensity = 0.8; A.drumsSet('heart', 64, 0.35); G.music = 'calm'; A.sfx('success', 0.5); banner(L('CLEARED', 'முடிஞ்சது'), L('The way is open. Move.', 'வழி திறந்துச்சு. நகருங்க.'), 2.4); stoneLights.forEach(s => { if (Math.abs(s.position.z - a.z) < a.r + 5) s.userData.rune.visible = true; }); for (const p of [me, other]) { if (p && !p.dead && !p.down) p.hp = Math.min(p.maxHp, p.hp + 2); } if (a.onClear) a.onClear(CTX); if (a.boss && LV.completeOnArenas) setTimeout(() => levelComplete(), 2500); }

// ---------------- player update ----------------
function playerUpdate(p, dt) {
  p.inv = Math.max(0, p.inv - dt); p.stoneCd = Math.max(0, p.stoneCd - dt); p.at += dt; p.comboT = Math.max(0, p.comboT - dt); p.rageOn = Math.max(0, p.rageOn - dt);
  if (p.dead || p.down) { p.anim = 'dead'; return; }
  const isBusy = a => a === 'attack' || a === 'heavy' || a === 'dodge' || a === 'hit' || a === 'throw' || a === 'stealth' || a === 'revive' || a === 'channel';
  const busy = isBusy(p.anim); const rageMul = p.rageOn > 0 ? 1.45 : 1;
  const dur = { attack: 0.42 / rageMul, heavy: 0.8 / rageMul, dodge: 0.5, hit: 0.35, throw: 0.45, stealth: 1.0, revive: 2.0, channel: p.chanT || 1.2 }[p.anim];
  if (busy && p.at >= dur) { if (p.anim === 'stealth' && p.stealthTargetH) p.stealthTargetH = null; if (p.anim === 'channel' && p.chan) { const it = p.chan; p.chan = null; if (!it.done) { if (it.once) it.done = true; it.cb(p, false); if (it.id != null) bc('inter', { id: it.id }); } } p.anim = 'idle'; p.at = 0; }
  const cy = G.camYaw; const fxv = -Math.sin(cy), fzv = -Math.cos(cy); const rxv = Math.cos(cy), rzv = -Math.sin(cy);
  let mx = inp.mx * rxv + (-inp.mz) * fxv, mz = inp.mx * rzv + (-inp.mz) * fzv; const ml = Math.hypot(mx, mz);
  const canAct = !busy || (p.anim === 'attack' && p.at > 0.22 / rageMul);
  p.torch = !!(LV.torch && inp.torch && !busy);
  const partner = other && other.tx != null && !G.solo ? other : null;
  const canRevive = partner && partner.down && Math.hypot(partner.x - p.x, partner.z - p.z) < 2.2;
  const canPull = partner && partner.sink > 0.5 && Math.hypot(partner.x - p.x, partner.z - p.z) < 3.0 && p.sink < 0.3;
  const stealthT = stealthTarget(p);
  let inter = null, interD = 3;
  for (const it of INTERS) { if (it.done || (it.cond && !it.cond(CTX))) continue; const d = Math.hypot(it.x - p.x, it.z - p.z); if (d < (it.r || 2.2) && d < interD) { interD = d; inter = it; } }
  p.nearInter = inter;
  if (canRevive && inp.useHeld && !busy) { p.anim = 'revive'; p.at = 0; }
  if (p.anim === 'revive') { if (!inp.useHeld || !canRevive) { p.anim = 'idle'; p.at = 0; } else if (p.at >= 1.85) { if (isAuth()) revive(partner); else Net.send({ t: 'act', k: 'revive' }); p.anim = 'idle'; p.at = 0; } }
  else if (canPull && inp.useHeld && !busy) { p.anim = 'channel'; p.chanT = 1.4; p.chan = { cb: () => { if (isAuth()) unstick(partner); else Net.send({ t: 'act', k: 'pull' }); }, done: false }; p.at = 0; }
  else if (inp.use && stealthT && !busy) { p.anim = 'stealth'; p.at = 0; p.yaw = Math.atan2(stealthT.x - p.x, stealthT.z - p.z); p.x = stealthT.x - Math.sin(p.yaw) * 0.9; p.z = stealthT.z - Math.cos(p.yaw) * 0.9; p.stealthTargetH = stealthT; p.noise = Math.max(p.noise, 0.3); if (isAuth()) stealthKill(p, stealthT); else Net.send({ t: 'act', k: 'stealth', id: stealthT.id }); }
  else if (inter && ((inter.hold && inp.useHeld && !busy) || (!inter.hold && inp.use && !busy))) {
    if (inter.hold) { p.anim = 'channel'; p.chanT = inter.hold; p.chan = inter; p.at = 0; }
    else { if (inter.once) inter.done = true; inter.cb(p, false); if (inter.id != null) bc('inter', { id: inter.id }); }
  }
  else if (inp.rage && p.rage >= 1 && p.rageOn <= 0) { p.rage = 0; p.rageOn = 7; A.horn(58, 2.5, 0.5); A.sfx('growl', 0.5); shake = 0.8; G.fovT = 52; banner(L('THE TIGER WAKES', 'புலி விழிக்கிறது'), L('7 seconds. Take them.', '7 நொடி. முடிச்சிடுங்க.'), 2); PARTS.spawn(p.x, terrainH(p.x, p.z) + 1, p.z, 40, 0xff8a20, 5, 6, 1, 1); }
  else if (inp.dodge && p.sink < 0.4 && (!busy || (p.anim === 'attack' && p.at > 0.18))) { p.anim = 'dodge'; p.at = 0; p.inv = 0.4; if (ml > 0.1) p.dodgeDir = [mx / ml, mz / ml]; else p.dodgeDir = [Math.sin(p.yaw), Math.cos(p.yaw)]; p.yaw = Math.atan2(p.dodgeDir[0], p.dodgeDir[1]); A.sfx('whoosh', 0.5); p.noise = Math.max(p.noise, 0.8); }
  else if ((inp.atk || inp.hvy) && canAct && !p.torch) {
    if (inp.hvy) { p.anim = 'heavy'; p.combo = 0; } else { p.combo = (p.anim === 'attack' || p.comboT > 0) ? (p.combo + 1) % 3 : 0; p.anim = 'attack'; p.comboT = 0.8; }
    p.at = 0; p.hitApplied = false; p.noise = Math.max(p.noise, 1.1);
    let best = null, bd = 7.5; for (const h of G.hunters) { if (h.state === 'dead' || h.state === 'hidden' || (ETYPES[h.type].exposedOnly && h.state === 'lurk')) continue; const d = Math.hypot(h.x - p.x, h.z - p.z); if (d < bd) { bd = d; best = h; } }
    if (best) p.yaw = Math.atan2(best.x - p.x, best.z - p.z); else if (ml > 0.1) p.yaw = Math.atan2(mx, mz);
    A.sfx('whoosh', 0.5);
  }
  else if (inp.use && !busy && p.stoneCd <= 0 && !canRevive && !inter && LV.stones !== false) { p.anim = 'throw'; p.at = 0; p.stoneCd = 2.0; if (ml > 0.1) p.yaw = Math.atan2(mx, mz); setTimeout(() => throwStone(p), 200); }
  const busy2 = isBusy(p.anim);
  let spdMul = 1; if (p.torch) spdMul *= 0.55; if (inWater(p.x, p.z)) spdMul *= 0.48;
  if (LV.speedMul) spdMul *= LV.speedMul(CTX, p);
  if (p.anim === 'dodge') { const k = p.at / 0.5; const sp = 9.5 * (1 - k * 0.6) * Math.max(spdMul, 0.5); moveWithCollision(p, p.x + p.dodgeDir[0] * sp * dt, p.z + p.dodgeDir[1] * sp * dt); }
  else if (busy2) { if (p.anim === 'attack' && p.at < 0.3) moveWithCollision(p, p.x + Math.sin(p.yaw) * 2.6 * dt, p.z + Math.cos(p.yaw) * 2.6 * dt); if (p.anim === 'heavy' && p.at < 0.5) moveWithCollision(p, p.x + Math.sin(p.yaw) * 2.0 * dt, p.z + Math.cos(p.yaw) * 2.0 * dt); }
  else if (ml > 0.05) { const sneak = inp.sneak; const sp = (sneak ? 2.2 : 5.0) * Math.min(1, ml * 1.2) * spdMul; const ny = Math.atan2(mx, mz); let dy = ny - p.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; p.yaw += dy * Math.min(1, dt * 12); moveWithCollision(p, p.x + mx / ml * sp * dt, p.z + mz / ml * sp * dt); p.anim = p.sink > 0.5 ? 'trapped' : sneak ? 'sneak' : 'run'; p.phase += dt * (sneak ? 6 : 11.5) * spdMul; p.noise = Math.max(p.noise, inWater(p.x, p.z) ? 1.0 : sneak ? 0.3 : 0.75); p.sneak = sneak; if (Math.sin(p.phase) > 0.98 && !p.stepped) { p.stepped = true; A.sfx(inWater(p.x, p.z) ? 'splash' : 'step', 0.4); } if (Math.sin(p.phase) < 0) p.stepped = false; }
  else p.anim = p.sink > 0.5 ? 'trapped' : 'idle';
  p.x = U.clamp(p.x, -W.half, W.half); p.z = U.clamp(p.z, W.zMin - 12, W.zMax);
  p.noise = Math.max(0, p.noise - dt * 2.2);
  if (LV.hook) LV.hook(CTX, p, dt);
  const aw = p.anim === 'attack' && p.at > 0.14 / rageMul && p.at < 0.26 / rageMul, hw = p.anim === 'heavy' && p.at > 0.42 / rageMul && p.at < 0.56 / rageMul;
  if ((aw || hw) && !p.hitApplied) { p.hitApplied = true; const dmg = (hw ? 4 : 1) * (p.rageOn > 0 ? 2 : 1); const reach = hw ? 3.2 : 2.5; if (isAuth()) applyHit(p, dmg, reach, hw ? 'heavy' : 'hit'); else Net.send({ t: 'act', k: 'hit', x: p.x, z: p.z, yaw: p.yaw, dmg, reach, kind: hw ? 'heavy' : 'hit' }); }
}
function stealthTarget(p) { for (const h of G.hunters) { const okState = h.state === 'listen' || h.state === 'patrol' || h.state === 'investigate' || h.state === 'still'; if (!okState || h.boss || ETYPES[h.type].noStealth) continue; const d = Math.hypot(h.x - p.x, h.z - p.z); if (d > 1.9 * (ETYPES[h.type].scale || 1)) continue; const fx2 = Math.sin(h.yaw), fz2 = Math.cos(h.yaw); const dot = ((p.x - h.x) * fx2 + (p.z - h.z) * fz2) / (d || 1); if (dot < -0.2) return h; } return null; }
function stealthKill(p, h) { if (!h || h.state === 'dead') return; h.hp = 0; h.state = 'dead'; h.st = -0.5; G.kills++; if (h.def && h.def.once) h.def.done = true; const y = terrainH(h.x, h.z) + 1.0; juice('stealth', h.x, y, h.z); bc('juice', { j: 'stealth', x: h.x, y, z: h.z }); addRage(p, 0.25); banner(L('SILENT KILL', 'அமைதியான கொலை'), '', 1.6); }
function revive(pt) { pt.down = false; pt.dead = false; pt.hp = 3; pt.anim = 'idle'; pt.at = 0; pt.inv = 1.5; bc('revived', { who: pt.who }); A.sfx('success', 0.5); }
function unstick(pt) { const pu = pt === me ? other : me; pt.sink = 0; pt.inv = 1; const d = Math.hypot(pt.x - pu.x, pt.z - pu.z) || 1; pt.x += (pu.x - pt.x) / d * 2.2; pt.z += (pu.z - pt.z) / d * 2.2; bc('unstick', { who: pt.who, x: pt.x, z: pt.z }); A.sfx('rope', 0.6); banner(L('PULLED OUT', 'இழுத்துட்டோம்'), '', 1.4); }
function addRage(p, v) { if (p.rageOn > 0) return; p.rage = Math.min(1, p.rage + v); if (p.rage >= 1 && !p.rageReady) { p.rageReady = true; if (p === me) { A.sfx('cue'); banner(L('TIGER READY — press R', 'புலி தயார் — R அழுத்து'), '', 2); } } if (p.rage < 1) p.rageReady = false; }
function applyHit(p, dmg, reach, kind) { const fx2 = Math.sin(p.yaw), fz2 = Math.cos(p.yaw); let any = 0; for (const h of G.hunters) { if (h.state === 'dead' || h.state === 'hidden') continue; const dx = h.x - p.x, dz = h.z - p.z, d = Math.hypot(dx, dz); const R = reach + ((ETYPES[h.type].scale || 1) - 1) * 1.2; if (d < R && (dx * fx2 + dz * fz2) / (d || 1) > 0.3) { damageHunter(h, dmg, p, kind); any++; } } const real = p.__real || p; if (any) { real.gore = Math.min(1, (real.gore || 0) + 0.22 * any); addRage(real, (kind === 'heavy' ? 0.14 : 0.07) * any); if (real === me) { G.combo++; G.comboT = 1.6; } else bc('combo', { who: real.who }); } }
function throwStone(p) { const s = { x: p.x + Math.sin(p.yaw) * 0.6, y: terrainH(p.x, p.z) + 1.4, z: p.z + Math.cos(p.yaw) * 0.6, vx: Math.sin(p.yaw) * 15, vy: 5.5, vz: Math.cos(p.yaw) * 15, m: new THREE.Mesh(new THREE.DodecahedronGeometry(0.09), MAT.steel), id: Math.random() }; scene.add(s.m); G.stones.push(s); A.sfx('whoosh', 0.5); if (!isAuth()) Net.send({ t: 'act', k: 'stone', s: { x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz, id: s.id } }); }
function stonesUpdate(dt) { for (const s of G.stones) { if (s.done) continue; s.vy -= 16 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.m.position.set(s.x, s.y, s.z); s.m.rotation.x += dt * 10; const g = terrainH(s.x, s.z); let hitE = null; if (isAuth()) for (const h of G.hunters) { if (h.state === 'dead' || h.state === 'hidden') continue; if (Math.hypot(h.x - s.x, h.z - s.z) < 0.9 * (ETYPES[h.type].scale || 1) && Math.abs(s.y - g - 1) < 1.5) { hitE = h; break; } } if (hitE) { damageHunter(hitE, 1, { x: s.x - s.vx, z: s.z - s.vz, __real: me }); s.done = true; s.ttl = 0; } else if (s.y <= g + 0.08 || blocked(s.x, s.z, 0.05)) { s.done = true; s.y = g + 0.08; s.m.position.y = s.y; if (LV.onStoneLand) LV.onStoneLand(CTX, s); else A.sfx('stone', 0.5); if (isAuth()) { addSound(s.x, s.z, 22, 'stone'); bc('sfx', { n: 'stone' }); } s.ttl = 6; } } G.stones = G.stones.filter(s => { if (s.done && (s.ttl -= dt) <= 0) { scene.remove(s.m); return false; } return true; }); }
function meeraUpdate(dt) { const trail = (other && other.tx != null && !G.solo) ? ((me.z > other.z) ? me : other) : me; const tx = trail.x + Math.sin(trail.yaw + Math.PI) * 2.4 + 1.2, tz = trail.z + Math.cos(trail.yaw + Math.PI) * 2.4; const dx = tx - meera.x, dz = tz - meera.z, d = Math.hypot(dx, dz); if (d > 1.2) { const sp = Math.min(6, d * 1.5); meera.x += dx / d * sp * dt; meera.z += dz / d * sp * dt; meera.yaw = Math.atan2(dx, dz); meera.anim = sp > 3 ? 'run' : 'walk'; meera.phase += dt * (sp > 3 ? 11 : 7); } else meera.anim = 'idle'; }

// ---------------- level ctx ----------------
function buildGate(z, opts = {}) {
  const gm = new THREE.MeshStandardMaterial({ color: opts.stone || 0x3a3430, roughness: 0.9 });
  for (const sx of [-4, 4]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 1.6), gm); p.position.set(sx, terrainH(sx, z) + 4.5, z); p.castShadow = true; LG.add(p); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(11, 1.2, 1.8), gm); lintel.position.set(0, terrainH(0, z) + 9, z); LG.add(lintel);
  const seal = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshBasicMaterial({ color: opts.seal || 0xffb040 })); seal.position.set(0, terrainH(0, z) + 9, z + 0.95); LG.add(seal);
  const gl = new THREE.PointLight(opts.seal || 0xff9a30, 3, 30, 1.6); gl.position.set(0, terrainH(0, z) + 8, z + 2); LG.add(gl);
  if (opts.trigger !== false) G.gateZ = z;
}
const CTX = {
  THREE, U, W, G, MAT, L, box, limb,
  setTerrain: fn => { terrainFn = fn; }, terrainH, makeNoise, sky,
  ground: buildGround, water: buildWater, inWater, gate: buildGate,
  add: o => LG.add(o), rng: () => rng, addCol: (x, z, r) => cols.push([x, z, r]),
  anim: fn => ANIM.push(fn),
  etype: regType, brain: regBrain,
  enemy: (type, x, z, o = {}) => { const d = Object.assign({ type, x, z }, o); EDEFS.push(d); return d; },
  spawnNow: (type, x, z, state, opts) => instEnemy(type, x, z, state || 'rise', null, -1, opts || {}),
  inter: def => { def.id = INTERS.length; INTERS.push(def); return def; },
  zone: (kind, o) => { (ZONES[kind] = ZONES[kind] || []).push(o); return o; }, zones: k => ZONES[k] || [],
  banner, say, cue, hint, meter, tint: tintFx, filter: canvasFilter, sfx: (n, v) => A.sfx(n, v), audio: () => A,
  script: lines => { script = lines.slice(); scriptT = 0; },
  juice, parts: PARTS, bc, isAuth, addSound, act: o => Net.send(Object.assign({ t: 'act' }, o)),
  shake: v => shake = Math.max(shake, v), fov: v => G.fovT = v, roll: v => G.roll = v,
  me: () => me, other: () => other, partner: () => (other && other.tx != null && !G.solo) ? other : null, meeraP: () => meera,
  players: () => [me, other].filter(p => p && !p.dead && !p.down && (p === me || p.tx != null)),
  hunters: () => G.hunters, damageHunter, damagePlayer, addRage, blocked,
  softWall: (grp, wallZ) => { softWalls.push({ grp, wallZ, open: 0 }); LG.add(grp); },
  runeStone: s => stoneLights.push(s), arenaLight: (i, l) => { arenaLights[i] = l; LG.add(l); },
  complete: () => levelComplete(),
  heal: n => { for (const p of [me, other]) if (p && !p.dead && !p.down) p.hp = Math.min(p.maxHp, p.hp + n); },
};

// ---------------- level flow ----------------
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
function getUnlock() { try { return Math.min(parseInt(localStorage.getItem('tf3d_unlock') || '0', 10) || 0, LEVELS.length - 1); } catch (e) { return 0; } }
function setUnlock(i) { try { const c = getUnlock(); if (i > c) localStorage.setItem('tf3d_unlock', String(i)); } catch (e) { } }
function loadLevel(i) {
  LVI = i; LV = LEVELS[i]; G.level = i;
  LG = new THREE.Group(); scene.add(LG);
  rng = U.rng(LV.seed || (100 + i * 37));
  cols = []; ANIM = []; INTERS = []; ZONES = {}; softWalls = []; stoneLights = []; EDEFS = []; arenaLights = [];
  G.cleared = []; G.checkpoint = 0; G.arena = -1; G.arenaActive = false; G.kills = 0; G.lvlT = 0; G.gateZ = null; G.roll = 0; G.music = 'calm';
  W.waterY = null; W.half = 30; W.zMin = -400; W.zMax = 8;
  terrainFn = () => 0;
  hideMeter(); tintFx(null); canvasFilter(null); $('bossbar').style.opacity = 0; $('bossbar').querySelector('.n').textContent = LV.bossName ? LV.bossName() : '';
  $('touch-torch').style.display = 'none';
  LV.build(CTX);
  if (LV.torch && isTouch) $('touch-torch').style.display = 'block';
  spawnEnemies();
  if (G.started) { if (LV.amb) A.ambience(LV.amb); const dr = LV.drums || ['heart', 64, 0.35]; A.drumsSet(dr[0], dr[1], dr[2]); }
}
function unloadLevel() {
  BLOOD.clear(); clearDebris();
  if (!LG) return; scene.remove(LG);
  LG.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !(o.material.userData && o.material.userData.shared)) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  LG = null;
  for (const h of G.hunters) scene.remove(h.rig.g); G.hunters = [];
  G.stones.forEach(s => scene.remove(s.m)); G.stones = [];
}
function levelComplete() { if (G.complete || G.interlude) return; G.complete = true; if (isAuth()) bc('lvldone'); A.sfx('success', 0.5); A.horn(65, 5, 0.5); setTimeout(showInterlude, 1800); }
function showInterlude() {
  if (G.interlude) return; G.interlude = true; G.started = false; setUnlock(LVI + 1);
  $('fade').style.opacity = 1;
  setTimeout(() => {
    const last = LVI >= LEVELS.length - 1; const it = INTERLUDES[LVI];
    $('inter-kicker').textContent = last ? L('THE SEVENTH TRIAL IS DONE', 'ஏழாவது சோதனை முடிந்தது') : `${L('TRIAL', 'சோதனை')} ${ROMAN[LVI]} — ${L('CLEARED', 'முடிந்தது')}`;
    $('inter-title').textContent = it.title();
    $('inter-text').textContent = it.text() + `\n\n${L('Kills', 'கொலைகள்')}: ${G.kills} · ${L('Falls', 'விழுந்தது')}: ${G.deaths} · ${Math.floor(G.lvlT / 60)}:${String(Math.floor(G.lvlT % 60)).padStart(2, '0')}`;
    $('inter-tips').textContent = last ? '' : (LEVELS[LVI + 1].tip ? LEVELS[LVI + 1].tip() : '');
    const b = $('btn-inter');
    b.textContent = last ? L('Play again from Trial I', 'மறுபடி சோதனை I-லிருந்து') : `${L('TRIAL', 'சோதனை')} ${ROMAN[LVI + 1]} — ${LEVELS[LVI + 1].name()}`;
    b.disabled = !(isAuth());
    $('inter-wait').textContent = isAuth() ? '' : L('Waiting for the host…', 'Host-க்காக காத்திருக்கோம்…');
    b.onclick = () => { if (last) { location.href = location.pathname; return; } bc('golvl', { i: LVI + 1 }); goLevel(LVI + 1); };
    $('interlude').classList.remove('hidden'); $('fade').style.opacity = 0;
    A.drumsSet('heart', 56, 0.25);
  }, 900);
}
function goLevel(i) {
  if (!G.interlude && G.started) return; $('interlude').classList.add('hidden'); $('fade').style.opacity = 1;
  setTimeout(() => {
    unloadLevel(); loadLevel(i); G.complete = false; G.interlude = false; G.restarting = false;
    resetAll(); G.started = true;
    if (LV.amb) A.ambience(LV.amb); const dr = LV.drums || ['heart', 64, 0.35]; A.drumsSet(dr[0], dr[1], dr[2]);
    $('fade').style.opacity = 0;
    banner(`${L('TRIAL', 'சோதனை')} ${ROMAN[i]}`, LV.name(), 3.2);
    if (LV.intro) CTX.script(LV.intro(CTX));
    if (LV.onStart) LV.onStart(CTX);
  }, 950);
}

// ---------------- net ----------------
function pack(p) { return { t: 'av', x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(3), a: p.anim, at: +p.at.toFixed(2), c: p.combo, n: +p.noise.toFixed(2), ph: +p.phase.toFixed(2), r: p.rageOn > 0 ? 1 : 0, sk: +p.sink.toFixed(2), md: +p.mad.toFixed(2), fl: (p.torch ? 1 : 0) }; }
function applyRemote(p, m) { if (p.tx == null || Math.hypot(m.x - p.x, m.z - p.z) > 8) { p.x = m.x; p.z = m.z; } p.tx = m.x; p.tz = m.z; p.tyaw = m.yaw; if (p.anim !== m.a || (m.a === 'attack' && m.c !== p.combo)) p.at = m.at; if (!p.down && !p.dead) p.anim = m.a; p.combo = m.c; p.noise = m.n; p.phase = m.ph; p.rageOn = m.r ? 1 : 0; p.sink = m.sk || 0; p.mad = m.md || 0; p.torch = !!(m.fl & 1); }
function remoteTick(p, dt) { if (p.tx == null) return; p.x += (p.tx - p.x) * Math.min(1, dt * 14); p.z += (p.tz - p.z) * Math.min(1, dt * 14); let dy = p.tyaw - p.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; p.yaw += dy * Math.min(1, dt * 14); p.at += dt; }
function syncRoster(list) { for (const h of G.hunters) scene.remove(h.rig.g); G.hunters = list.map((v, i) => { const type = v[5] || 'hunter'; const T_ = ETYPES[type]; const rig = makeHunter(type); scene.add(rig.g); return { id: i, type, rig, x: v[0], z: v[1], yaw: v[2], state: v[3], st: 0, hp: v[4], maxHp: T_.hp, ph: 0, gx: v[0], gz: v[1], windup: T_.windup, aoe: !!T_.aoe, boss: !!T_.boss, arena: v[6] == null ? -1 : v[6], flashT: 0, aggro: v[7] || 0, opts: {} }; }); }
function onMessage(m) {
  if (m.t === 'av') applyRemote(other, m);
  else if (m.t === 'ready') { G.readyOther = true; tryStart(); }
  else if (m.t === 'ws') { if (m.h.length !== G.hunters.length) syncRoster(m.h); m.h.forEach((v, i) => { const h = G.hunters[i]; if (!h) return; h.gx = v[0]; h.gz = v[1]; h.yaw = v[2]; if (h.state !== v[3]) { h.state = v[3]; h.st = 0; } h.hp = v[4]; h.aggro = v[7] || 0; const w = v[8] || 0; if (w > 0 && !h.wardMesh) { const wm = new THREE.Mesh(new THREE.SphereGeometry(1.15, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })); wm.position.y = 1.1; h.rig.g.add(wm); h.wardMesh = wm; h.ward = true; } h.wardDown = w === 2 ? 1 : 0; if (h.gx != null && Math.hypot(h.gx - h.x, h.gz - h.z) > 6) { h.x = h.gx; h.z = h.gz; } }); if (m.hp) { K().hp = m.hp[0]; S().hp = m.hp[1]; } G.kills = m.k; G.arena = m.a; G.arenaActive = !!m.aa; (m.cl || []).forEach((c, i) => { G.cleared[i] = !!c; }); G.checkpoint = m.cp; }
  else if (m.t === 'ev') {
    if (m.k === 'start') start();
    else if (m.k === 'cue') cue(m.id, m.dur); else if (m.k === 'say') say(m.sp, m.id, m.dur); else if (m.k === 'sfx') A.sfx(m.n, 0.5);
    else if (m.k === 'juice') juice(m.j, m.x, m.y || terrainH(m.x, m.z) + 1, m.z, m.dx, m.dz);
    else if (m.k === 'twin') banner(L('TWIN STRIKE — THE WARD SHATTERS', 'இரட்டை வெட்டு — கவசம் உடைந்தது'), L('Six breaths of open flesh', 'ஆறு மூச்சுக்கு அது வெறும் சதை'), 2.2);
    else if (m.k === 'limb') { for (let i = 0; i < (m.n || 1); i++) spawnLimb(m.x, m.y, m.z, m.dx + (Math.random() - 0.5), m.dz + (Math.random() - 0.5), m.s || 1); if (Math.hypot(m.x - me.x, m.z - me.z) < 9) bloodSplash(); }
    else if (m.k === 'hurt') { const p = m.who === 'K' ? K() : S(); p.hp = m.hp; if (p === me) { p.hitT = 0.35; p.anim = 'hit'; p.at = 0; p.inv = 0.9; p.x = m.x; p.z = m.z; juice('hurt', p.x, 0, p.z); } }
    else if (m.k === 'down') { const p = m.who === 'K' ? K() : S(); p.down = true; p.hp = 0; p.anim = 'dead'; p.at = 0; if (p === me) banner(L('DOWN — your partner can revive you (hold E)', 'விழுந்துட்டீங்க — நண்பர் E பிடிச்சு எழுப்பலாம்'), '', 4); }
    else if (m.k === 'revived') { const p = m.who === 'K' ? K() : S(); p.down = false; p.dead = false; p.hp = 3; p.anim = 'idle'; p.at = 0; p.inv = 1.5; A.sfx('success', 0.5); }
    else if (m.k === 'unstick') { const p = m.who === me.who ? me : other; p.sink = 0; p.inv = 1; if (m.x != null) { p.x = m.x; p.z = m.z; if (p === other) { p.tx = m.x; p.tz = m.z; } } A.sfx('rope', 0.6); if (p === me) banner(L('PULLED OUT', 'இழுத்துட்டோம்'), '', 1.4); }
    else if (m.k === 'restart') { G.checkpoint = m.cp; restart(m.who); }
    else if (m.k === 'arena') { G.arena = m.i; G.arenaActive = true; G.checkpoint = m.cp; arenaStart(m.i); }
    else if (m.k === 'cleared') { G.cleared[m.i] = true; G.arenaActive = false; arenaCleared(m.i); }
    else if (m.k === 'combo') { if (m.who === me.who) { G.combo++; G.comboT = 1.6; addRage(me, 0.07); } }
    else if (m.k === 'inter') { const it = INTERS[m.id]; if (it && !it.done) { if (it.once) it.done = true; it.cb(other, true); } }
    else if (m.k === 'lvldone') { G.complete = true; setTimeout(showInterlude, 1800); }
    else if (m.k === 'golvl') goLevel(m.i);
    else if (m.k === 'lvlev') { if (LV.onEvent) LV.onEvent(CTX, m); }
  }
  else if (m.t === 'act') {
    if (m.k === 'hit') applyHit({ x: m.x, z: m.z, yaw: m.yaw, who: other.who, __real: other }, m.dmg, m.reach, m.kind);
    else if (m.k === 'stone') { const s = Object.assign({ m: new THREE.Mesh(new THREE.DodecahedronGeometry(0.09), MAT.steel) }, m.s); scene.add(s.m); G.stones.push(s); }
    else if (m.k === 'stealth') { const h = G.hunters[m.id]; if (h) stealthKill(other, h); }
    else if (m.k === 'revive') { if (me.down) revive(me); }
    else if (m.k === 'pull') { if (me.sink > 0.3) unstick(me); }
    else if (m.k === 'selfhurt') { damagePlayer(other, m.dmg || 1, null); }
  }
}
Net.S.onMessage = onMessage;

// ---------------- start flow ----------------
function tryStart() { if (isAuth() && G.readyMe && (G.readyOther || G.solo) && !G.started) { start(); Net.send({ t: 'ev', k: 'start' }); } }
function start() {
  G.started = true; G.lvlT = 0; $('rules').classList.add('hidden'); $('hud').classList.remove('hidden'); if (isTouch) $('touch').classList.remove('hidden');
  if (LV.amb) A.ambience(LV.amb); A.drone(true, 49, 0.2); const dr = LV.drums || ['heart', 64, 0.35]; A.drumsStart(dr[1], dr[0], dr[2]);
  banner(`${L('TRIAL', 'சோதனை')} ${ROMAN[LVI]}`, LV.name(), 3.2);
  if (LV.intro) CTX.script(LV.intro(CTX));
  if (LV.onStart) LV.onStart(CTX);
}
function rules() {
  $('rules-title').textContent = `${L('TRIAL', 'சோதனை')} ${ROMAN[LVI]} — ${LV.name()}`;
  const ul = $('rules-lines'); ul.innerHTML = '';
  LV.rules(CTX).forEach(l => { const li = document.createElement('li'); li.textContent = l; ul.appendChild(li); });
  { const li = document.createElement('li'); li.textContent = L('THE GOLDEN WARD: this trial\'s keeper is warded — it barely bleeds, and ONE BLADE CAN NEVER BREAK IT. Only a TWIN STRIKE — both players hitting within a breath — shatters it for six. The gate stays sealed while the keeper lives, so the trial can only be CLEARED with a partner. Alone is practice.', 'தங்கக் கவசம்: இந்த சோதனையின் காவலனுக்கு கவசம் — அடி பட்டாலும் ரத்தம் வராது, ஒரு வாளால் அதை உடைக்கவே முடியாது. இரட்டை வெட்டு மட்டும்தான் — இருவரும் ஒரே மூச்சில் அடித்தால் — ஆறு மூச்சுக்கு உடையும். காவலன் உயிரோட இருக்கும் வரை வாசல் திறக்காது; சோதனையை முடிக்க நண்பர் கட்டாயம். தனியா என்றால் பயிற்சி மட்டும்.'); li.style.color = '#f0c060'; ul.appendChild(li); }
  $('rules').classList.remove('hidden');
  $('rules-ok').onclick = () => { $('rules').classList.add('hidden'); A.ensure(); G.readyMe = true; Net.send({ t: 'ready' }); $('lobby-status').textContent = ''; tryStart(); if (!G.started) { $('hud').classList.remove('hidden'); hint(T('ready')); } };
}
function beginGame(lvl) {
  $('lobby').classList.add('hidden');
  loadLevel(lvl);
  me = makePlayer(isAuth() ? 'K' : 'S'); other = makePlayer(isAuth() ? 'S' : 'K'); other.tx = null;
  meera = { who: 'M', rig: makeRig('M'), x: 1, z: 1, yaw: Math.PI, anim: 'idle', at: 0, phase: 0, combo: 0, hp: 5, noise: 0, inv: 0, sink: 0, torch: false, mad: 0 };
  scene.add(meera.rig.g);
  $('hp-me-name').textContent = T(me.who === 'K' ? 'hud_k' : 'hud_s'); $('hp-other-name').textContent = T(other.who === 'K' ? 'hud_k' : 'hud_s');
  $('hp-me-name').style.color = me.who === 'K' ? '#c9a15c' : '#8fc0c8'; $('hp-other-name').style.color = other.who === 'K' ? '#c9a15c' : '#8fc0c8';
  if (G.solo) $('hp-other-name').parentElement.style.display = 'none';
  resetAll(); camPos.set(0, 3, 6); $('fade').style.opacity = 0; rules();
}

// ---------------- camera ----------------
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const _goreCol = new THREE.Color(0x4a0d07);
function cameraUpdate(dt) {
  const p = me; G.camManualT = Math.max(0, (G.camManualT || 0) - dt);
  if (G.camManualT <= 0 && (p.anim === 'run' || p.anim === 'sneak' || p.anim === 'walk')) { let dy = (p.yaw + Math.PI) - G.camYaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; G.camYaw += dy * Math.min(1, dt * 1.8); }
  const fight = G.hunters.some(h => (h.state === 'chase' || h.state === 'attack' || h.state === 'charge' || h.state === 'rise' || h.state === 'roar' || h.state === 'frenzy' || h.state === 'surge' || h.state === 'aim') && Math.hypot(h.x - p.x, h.z - p.z) < 14);
  const cy = G.camYaw, cp = G.camPitch; const dist = fight ? 5.9 : 4.7, height = fight ? 2.35 : 2.0;
  const px = p.x, pz = p.z, py = terrainH(p.x, p.z);
  const bx = px + Math.sin(cy) * dist * Math.cos(cp), bz = pz + Math.cos(cy) * dist * Math.cos(cp), by = py + height - Math.sin(cp) * dist;
  const ox = Math.cos(cy) * 1.0, oz = -Math.sin(cy) * 1.0; const tx = bx + ox, tz = bz + oz; const ty = Math.max(by, terrainH(tx, tz) + 0.6, W.waterY != null ? W.waterY + 0.7 : -1e9);
  camPos.lerp(new THREE.Vector3(tx, ty, tz), Math.min(1, dt * 7));
  camLook.lerp(new THREE.Vector3(px - Math.sin(cy) * 1.5 + ox * 0.5, py + 1.35, pz - Math.cos(cy) * 1.5 + oz * 0.5), Math.min(1, dt * 9));
  camera.position.copy(camPos); if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake * 0.35; camera.position.y += (Math.random() - 0.5) * shake * 0.25; shake = Math.max(0, shake - dt * 2.5); }
  camera.lookAt(camLook);
  if (G.roll) camera.rotateZ(G.roll);
  G.fovT += (55 - G.fovT) * Math.min(1, dt * 2.5); camera.fov += (G.fovT - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix();
}

// ---------------- HUD ----------------
function updateHP() { $('hp-me').style.width = Math.max(0, me.hp) * 20 + '%'; $('hp-other').style.width = Math.max(0, other ? other.hp : 5) * 20 + '%'; $('rage').style.width = (me.rageOn > 0 ? 100 : me.rage * 100) + '%'; $('rage').style.background = me.rageOn > 0 ? '#ff6a20' : me.rage >= 1 ? '#ffb040' : '#c9a15c'; }
const wp = new THREE.Vector3();
function hudUpdate(dt) {
  if (G.cueT > 0) { G.cueT -= dt; if (G.cueT <= 0) $('cue').style.opacity = 0; } if (G.dlgT > 0) { G.dlgT -= dt; if (G.dlgT <= 0) $('dialog').style.opacity = 0; } updateHP();
  $('noise').textContent = me.noise > 0.6 ? 'LOUD' : me.noise > 0.1 ? 'quiet' : 'silent'; $('noise').style.color = me.noise > 0.6 ? '#e07060' : '#9ab';
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; } $('combo').textContent = G.combo >= 2 ? `${G.combo} HITS` : ''; $('combo').style.transform = `scale(${1 + Math.min(0.6, G.combo * 0.05)})`;
  let obj = null, target = null;
  const st = stealthTarget(me); const partner = other && other.tx != null && !G.solo ? other : null;
  if (partner && partner.down && Math.hypot(partner.x - me.x, partner.z - me.z) < 2.2) obj = L('HOLD E — revive', 'E பிடி — எழுப்பு');
  else if (partner && partner.sink > 0.5 && Math.hypot(partner.x - me.x, partner.z - me.z) < 3.0) obj = L('HOLD E — pull them out', 'E பிடி — இழு');
  else if (st) obj = L('E — SILENT KILL', 'E — அமைதியான கொலை');
  else if (me.nearInter) obj = me.nearInter.label();
  if (me.down) obj = partner ? L('DOWN — wait for your partner', 'விழுந்துட்டீங்க — நண்பருக்காக இருங்க') : '';
  if (obj == null) { const wd = G.hunters.find(h => h.ward && h.state !== 'dead' && h.state !== 'hidden' && Math.hypot(h.x - me.x, h.z - me.z) < 24); if (wd) obj = wd.wardDown > 0 ? L('THE WARD IS DOWN — CUT DEEP', 'கவசம் கீழ — ஆழமா வெட்டு') : (partner ? L('TWIN STRIKE — both of you hit it within a breath', 'இரட்டை வெட்டு — ரெண்டு பேரும் ஒரே மூச்சுல அடிங்க') : L('ONE BLADE CANNOT BREAK THIS WARD — bring a partner to clear the trial', 'ஒரு வாள் இந்தக் கவசத்தை உடைக்காது — சோதனையை முடிக்க நண்பரை கூட்டி வா')); }
  if (obj == null && G.gateZ != null && me.z < G.gateZ + 30) { const kAlive = EDEFS.some(d => d.gateKeeper && !d.done); if (kAlive) obj = L('THE GATE IS SEALED — its keeper still lives', 'வாசல் மூடியிருக்கு — காவலன் இன்னும் உயிரோட'); }
  if (obj == null && LV.objective) obj = LV.objective(CTX);
  if (LV.waypointFn) target = LV.waypointFn(CTX);
  hint(obj || '');
  const w = $('waypoint');
  if (target) { wp.set(target[0], terrainH(target[0], target[1]) + 2.2, target[1]); const d = Math.hypot(target[0] - me.x, target[1] - me.z); wp.project(camera); if (wp.z < 1) { const sx = (wp.x * 0.5 + 0.5) * innerWidth, sy = (-wp.y * 0.5 + 0.5) * innerHeight; w.style.left = U.clamp(sx, 40, innerWidth - 40) + 'px'; w.style.top = U.clamp(sy, 60, innerHeight - 80) + 'px'; w.style.opacity = 1; w.textContent = `◆ ${target[2] || ''} ${d | 0}m`; } else w.style.opacity = 0; } else w.style.opacity = 0;
  const bossActive = s2 => ['chase', 'surge', 'attack', 'charge', 'roar', 'stagger', 'aim', 'frenzy', 'reposition', 'rise'].includes(s2);
  const boss = G.hunters.find(h => h.boss && h.state !== 'hidden' && h.state !== 'dead' && (bossActive(h.state) || Math.hypot(h.x - me.x, h.z - me.z) < 38)); const bb = $('bossbar');
  if (boss) { bb.style.opacity = 1; $('bossbar-i').style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%'; } else bb.style.opacity = 0;
  $('ragefx').style.opacity = me.rageOn > 0 ? 0.6 : 0;
  if (LV.hud) LV.hud(CTX, dt);
  if (LV.dynMusic !== false) {
    const fight = G.hunters.some(h => (h.state === 'chase' || h.state === 'attack' || h.state === 'charge' || h.state === 'frenzy' || h.state === 'surge' || h.state === 'aim') && Math.hypot(h.x - me.x, h.z - me.z) < 22);
    if (fight && G.music !== 'war' && !G.arenaActive) { G.music = 'war'; A.drumsSet('tense', 92, 0.9); }
    else if (!fight && G.music === 'war' && !G.arenaActive) { G.music = 'calm'; const dr = LV.drums || ['heart', 64, 0.35]; A.drumsSet(dr[0], dr[1], dr[2]); }
  }
}

// ---------------- main loop ----------------
let last = performance.now(), fpsAcc = 0, fpsN = 0;
function frame(now) {
  if (!window.__paused) requestAnimationFrame(frame); window.__frames = (window.__frames || 0) + 1;
  const rdt = Math.min(0.05, (now - last) / 1000); last = now; fpsAcc += rdt; fpsN++; if (fpsAcc > 1) { $('fps').textContent = Math.round(fpsN / fpsAcc) + ' fps'; fpsAcc = 0; fpsN = 0; }
  if (!me || !LV) { renderer.render(scene, camera); return; }
  let dt = rdt; if (G.hitStop > 0) { G.hitStop -= rdt; dt = rdt * 0.05; } else if (G.slowmo > 0) { G.slowmo -= rdt; dt = rdt * 0.3; }
  G.t += dt; pollInput();
  if (G.started && !G.restarting && !G.complete && !G.interlude) {
    G.lvlT += rdt;
    playerUpdate(me, dt);
    if (isAuth()) {
      for (const p of [me, other]) { if (!p || (p === other && p.tx == null && !G.solo)) continue; if (p.noise > 0.1) addSound(p.x, p.z, p.noise * 13, 'player', p); }
      enemyUpdate(dt); G.sounds = G.sounds.filter(s => (s.life -= dt) > 0); arenaUpdate(dt);
      if (LV.checkpoints && LV.autoCp !== false) { const lead = Math.min(me.z, other && other.tx != null ? other.z : me.z); const cps = LV.checkpoints; while (G.checkpoint < cps.length - 1) { const nx = cps[G.checkpoint + 1]; const nz = Array.isArray(nx) ? nx[1] : nx; if (lead < nz + 2) G.checkpoint++; else break; } }
      for (const p of [me, other]) { if (p && p.down) { p.downT -= dt; if (p.downT <= 0) restart(p.who); } }
      if (G.gateZ != null) { const keepersDead = EDEFS.every(d => !d.gateKeeper || d.done); if (keepersDead) { const ps = [me]; if (other && other.tx != null && !G.solo) ps.push(other); if (ps.every(p => p.z < G.gateZ + 3)) levelComplete(); } }
    }
    stonesUpdate(dt); if (other) remoteTick(other, dt); meeraUpdate(dt); runScript(dt);
    if (LV.update) LV.update(CTX, dt);
    G.netAcc += rdt; if (G.netAcc >= 0.05) { G.netAcc = 0; Net.send(pack(me)); }
    if (Net.isHost) { G.wsAcc += rdt; if (G.wsAcc >= 0.066) { G.wsAcc = 0; Net.send({ t: 'ws', h: G.hunters.map(h => [+h.x.toFixed(2), +h.z.toFixed(2), +h.yaw.toFixed(2), h.state, h.hp, h.type, h.arena, +(h.aggro || 0).toFixed(2), h.ward ? (h.wardDown > 0 ? 2 : 1) : 0]), hp: [K().hp, S().hp], k: G.kills, a: G.arena, aa: G.arenaActive ? 1 : 0, cl: (LV.arenas || []).map((a, i) => G.cleared[i] ? 1 : 0), cp: G.checkpoint }); } }
    else if (!G.solo) { for (const h of G.hunters) { if (h.gx != null) { h.x += (h.gx - h.x) * Math.min(1, dt * 12); h.z += (h.gz - h.z) * Math.min(1, dt * 12); } h.st += dt; h.flashT = Math.max(0, (h.flashT || 0) - dt); if (h.state === 'dead' && h.st > 3) h.rig.g.visible = false; if (h.state === 'chase' || h.state === 'investigate' || h.state === 'patrol' || h.state === 'charge' || h.state === 'frenzy' || h.state === 'surge' || h.state === 'reposition') h.ph += dt * (h.state === 'chase' || h.state === 'frenzy' ? 12 : h.state === 'charge' ? 14 : 7); } }
  } else if (me) me.at += dt;
  softWalls.forEach((w, i) => { const want = G.cleared[i] ? 1 : 0; if (w.open !== want) w.open = U.clamp(w.open + (want ? dt * 0.5 : -dt), 0, 1); w.grp.position.y = -4.5 * U.smooth(w.open); w.grp.visible = w.open < 1; });
  for (const fn of ANIM) fn(dt, G.t);
  for (const p of [me, other, meera]) {
    if (!p) continue; if (p === other && (p.tx == null || G.solo)) { p.rig.g.visible = false; continue; }
    p.rig.g.visible = true; let y = terrainH(p.x, p.z);
    if (W.waterY != null && y < W.waterY - 0.45) y = Math.max(y, W.waterY - 1.02);
    p.rig.g.position.set(p.x, y - (p.sink || 0) * 1.15, p.z); p.rig.g.rotation.y = p.yaw;
    poseRig(p.rig, { anim: p.anim, t: p.at, phase: p.phase, combo: p.combo, globalT: G.t + (p.who === 'S' ? 1.3 : 0), torch: p.torch });
    if (p.rig.mark) p.rig.mark.material.opacity = p.rageOn > 0 ? 0.85 + Math.sin(G.t * 9) * 0.15 : 0.5 + Math.sin(G.t * 1.6) * 0.08;
  }
  for (const h of G.hunters) { if (!h.rig.g.visible) continue; let hy = terrainH(h.x, h.z); if (ETYPES[h.type].rig === 'croc' && inWater(h.x, h.z)) hy = Math.min(hy, W.waterY - 0.5); if (h.state === 'sink') hy -= Math.min(1, h.st / 2.2) * 1.6; h.rig.g.position.set(h.x, hy, h.z); h.rig.g.rotation.y = h.yaw; poseHunter(h.rig, h, G.t + h.id); if (h.rig.mixer && h.state !== 'dead') h.rig.mixer.update(dt * (h.state === 'chase' || h.state === 'frenzy' ? 1.5 : 1)); if (h.wardMesh) { const up = h.wardDown <= 0 && h.state !== 'dead'; h.wardMesh.visible = up; if (up) { h.wardMesh.material.opacity = 0.12 + 0.08 * Math.abs(Math.sin(G.t * 3 + h.id)); h.wardMesh.scale.setScalar((ETYPES[h.type].scale || 1) * (1.3 + Math.sin(G.t * 2.2 + h.id) * 0.06)); } } }
  PARTS.update(dt); BLOOD.update(dt); debrisUpdate(dt);
  for (const p of [me, other]) { if (!p || !p.rig.wmats) continue; p.gore = Math.max(0, (p.gore || 0) - dt * 0.015); for (const wm of p.rig.wmats) { wm.color.copy(wm.userData.base).lerp(_goreCol, Math.min(1, p.gore)); } }
  const k = K(); if (k && LV.heroLight !== false) { const ky = terrainH(k.x, k.z); torchL.position.set(k.x + Math.sin(k.yaw + 0.5) * 0.5, ky + 1.6, k.z + Math.cos(k.yaw + 0.5) * 0.5); torchL.intensity = (k.rig.g.visible ? 1 : 0) * (3.2 + Math.sin(G.t * 17) * 0.35 + Math.sin(G.t * 31) * 0.2) * (me.rageOn > 0 ? 1.6 : 1); torchL.color.setHex(me.rageOn > 0 ? 0xff6a30 : 0xffa040); } else torchL.intensity = 0;
  if (me.torch) { torchL2.position.set(me.x - Math.sin(me.yaw) * 0.3, terrainH(me.x, me.z) + 2.1, me.z - Math.cos(me.yaw) * 0.3); torchL2.intensity = 2.6 + Math.sin(G.t * 21) * 0.5; } else torchL2.intensity = 0;
  moon.position.set(me.x - 30, 60, me.z - 20); moon.target.position.set(me.x, 0, me.z); moon.target.updateMatrixWorld();
  cameraUpdate(rdt); hudUpdate(rdt);
  if (fx) composer.render(); else renderer.render(scene, camera);
  if (window.__capture) { window.__capture = false; window.__shot = canvas.toDataURL('image/jpeg', 0.85); }
}
requestAnimationFrame(frame); window.__resume = () => { window.__paused = false; requestAnimationFrame(frame); };

// ---------------- lobby / menu ----------------
function setLang(l) { E.st.lang = l; document.documentElement.lang = l; document.querySelectorAll('[data-en]').forEach(el => el.textContent = l === 'ta' ? el.dataset.ta : el.dataset.en); $('lang-en').classList.toggle('on', l === 'en'); $('lang-ta').classList.toggle('on', l === 'ta'); try { localStorage.setItem('tf_lang', l); } catch (e) { } buildLevelGrid(); }
let pickedLevel = 0;
function buildLevelGrid() {
  const grid = $('lvlgrid'); if (!grid) return; grid.innerHTML = '';
  const unlocked = qs.has('unlock') ? LEVELS.length - 1 : getUnlock();
  LEVELS.forEach((lv, i) => {
    const b = document.createElement('button'); b.className = 'lvl' + (i === pickedLevel ? ' on' : '') + (i > unlocked ? ' lock' : '');
    b.innerHTML = `<b>${ROMAN[i]}</b><span>${i > unlocked ? '🔒' : lv.name()}</span>`;
    b.disabled = i > unlocked;
    b.onclick = () => { pickedLevel = i; buildLevelGrid(); };
    grid.appendChild(b);
  });
}
$('lang-en').onclick = () => setLang('en'); $('lang-ta').onclick = () => setLang('ta'); try { setLang(localStorage.getItem('tf_lang') || 'en'); } catch (e) { setLang('en'); }
if (qs.has('level')) pickedLevel = U.clamp(parseInt(qs.get('level'), 10) - 1 || 0, 0, LEVELS.length - 1);
buildLevelGrid();
Net.S.onConnect = () => { $('lobby-status').textContent = 'Connected! Starting…'; if (Net.isHost) setTimeout(() => { Net.send({ t: 'go', lvl: pickedLevel }); beginGame(pickedLevel); }, 600); };
const rawOnMessage = Net.S.onMessage; Net.S.onMessage = m => { if (m.t === 'go') { if (!me) { pickedLevel = m.lvl || 0; beginGame(pickedLevel); } return; } rawOnMessage(m); };
Net.S.onDisconnect = () => hint('Partner disconnected');
$('btn-create').onclick = async () => { A.ensure(); const code = U.roomCode(); $('btn-create').disabled = true; try { await Net.host(code); $('room-code').textContent = code; $('room-box').classList.remove('hidden'); $('join-box').classList.add('hidden'); $('lobby-status').textContent = 'Send this code to your friend. The game starts when they join.'; $('room-link').value = location.origin + location.pathname + '?join=' + code + (Net.S.local ? '&local' : ''); } catch (e) { $('lobby-status').textContent = 'Could not create room: ' + (e.message || e.type || e); $('btn-create').disabled = false; } };
$('btn-copy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('room-link').value); };
async function join(code) { code = (code || '').trim().toUpperCase(); if (code.length !== 4) return; A.ensure(); $('btn-join').disabled = true; $('lobby-status').textContent = 'Connecting…'; try { await Net.join(code); } catch (e) { $('lobby-status').textContent = 'Could not connect (' + (e.message || e.type || e) + ')'; $('btn-join').disabled = false; } }
$('btn-join').onclick = () => join($('join-code').value); $('join-code').addEventListener('keydown', e => { if (e.key === 'Enter') join($('join-code').value); });
if (qs.get('join')) $('join-code').value = qs.get('join').toUpperCase();
$('btn-solo').onclick = () => { A.ensure(); G.solo = true; Net.S.role = 'host'; beginGame(pickedLevel); };
$('btn-mute').onclick = () => { A.ensure(); const m = $('btn-mute').classList.toggle('muted'); A.setVolume(m ? 0 : 0.8); };
$('btn-fs').onclick = () => { const el = document.documentElement; if (!document.fullscreenElement) el.requestFullscreen && el.requestFullscreen(); else document.exitFullscreen(); };
$('btn-fx').onclick = () => { fx = !fx; $('btn-fx').style.opacity = fx ? 1 : 0.5; };
if (qs.has('solo')) setTimeout(() => $('btn-solo').click(), 200);
window.__G = G; window.__me = () => me; window.__other = () => other; window.__scene = scene; window.__W = W; window.__LV = () => LV; window.__hunters = () => G.hunters; window.__goLevel = i => { G.interlude = true; goLevel(i); };
