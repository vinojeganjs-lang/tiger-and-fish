// The Tiger and the Fish — 3D campaign: level definitions (the Seven Trials)
// Each level receives the engine ctx `c` (see game.js CTX).
const ST = {}; // per-level mutable state, reset in build()

// ================= shared builders =================
function fernTexture(c, seed, g1, g2) {
  const T = c.THREE, cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const x = cv.getContext('2d'); const r = c.U.rng(seed);
  for (let f = 0; f < 9; f++) { const a = -Math.PI / 2 + (f - 4) * 0.28 + (r() - 0.5) * 0.1; const len = 90 + r() * 60; x.strokeStyle = `rgb(${g1[0] + r() * 20 | 0},${g1[1] + r() * 50 | 0},${g1[2] + r() * 20 | 0})`; x.lineWidth = 3; x.beginPath(); x.moveTo(128, 250); x.quadraticCurveTo(128 + Math.cos(a) * len * 0.5, 250 + Math.sin(a) * len * 0.5 - 20, 128 + Math.cos(a) * len, 250 + Math.sin(a) * len); x.stroke(); for (let k = 0.15; k < 1; k += 0.08) { const px = 128 + Math.cos(a) * len * k, py = 250 + Math.sin(a) * len * k - 20 * Math.sin(k * 3.14); const w = 22 * (1 - k) + 4; x.fillStyle = `rgba(${g2[0] + r() * 25 | 0},${g2[1] + r() * 60 | 0},${g2[2] + r() * 25 | 0},0.95)`; x.beginPath(); x.ellipse(px, py, w, 4, a + 1.2, 0, 6.28); x.fill(); x.beginPath(); x.ellipse(px, py, w, 4, a - 1.2, 0, 6.28); x.fill(); } }
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
}
function scatterFerns(c, n, tint, g1, g2) {
  const T = c.THREE, r = c.rng();
  const geo = new T.PlaneGeometry(1.8, 1.8); geo.translate(0, 0.9, 0);
  const mat = new T.MeshStandardMaterial({ map: fernTexture(c, 5, g1 || [20, 70, 30], g2 || [25, 80, 35]), alphaTest: 0.5, roughness: 1, side: T.DoubleSide, color: tint || 0x9ab08a });
  const m = new T.InstancedMesh(geo, mat, n); const d = new T.Object3D();
  for (let i = 0; i < n; i++) { const z = c.W.zMin + r() * (c.W.zMax - c.W.zMin), x = (r() - 0.5) * c.W.half * 2.4; d.position.set(x, c.terrainH(x, z) - 0.05, z); d.rotation.set(0, r() * 6.28, 0); const s = 0.5 + r() * 0.9; d.scale.set(s, s, s); d.updateMatrix(); m.setMatrixAt(i, d.matrix); }
  c.add(m);
}
function scatterTrees(c, opts) {
  const T = c.THREE, r = c.rng(); const o = Object.assign({ n: 700, trunk: 0x15110c, can1: 0x1c4a2c, can2: 0x163e24, minR: 4.5, clearMid: true }, opts);
  const trunkGeo = new T.CylinderGeometry(0.22, 0.5, 9, 6); trunkGeo.translate(0, 4.5, 0);
  const canGeo = new T.IcosahedronGeometry(2.4, 1); const canGeo2 = new T.ConeGeometry(2.2, 5, 7);
  const trunkMat = new T.MeshStandardMaterial({ color: o.trunk, roughness: 1 }); const canMat = new T.MeshStandardMaterial({ color: o.can1, roughness: 1, flatShading: true }); const canMat2 = new T.MeshStandardMaterial({ color: o.can2, roughness: 1, flatShading: true });
  const trunks = new T.InstancedMesh(trunkGeo, trunkMat, o.n), cans = new T.InstancedMesh(canGeo, canMat, o.n), cans2 = new T.InstancedMesh(canGeo2, canMat2, o.n);
  trunks.castShadow = cans.castShadow = cans2.castShadow = true; trunks.receiveShadow = true;
  const d = new T.Object3D(); let placed = 0, tries = 0; const len = c.W.zMax - c.W.zMin;
  while (placed < o.n && tries < 20000) {
    tries++; const z = c.W.zMin - 20 + r() * (len + 40); let x; const side = r();
    if (side < 0.55) x = (r() < 0.5 ? -1 : 1) * (c.W.half - 6 + r() * 40); else { x = (r() - 0.5) * (c.W.half * 2 - 8); if (o.clearMid && Math.abs(x) < o.minR) continue; }
    if (z > c.W.zMax - 18 && Math.abs(x) < 12) continue; if (o.avoid && o.avoid(x, z)) continue;
    const y = c.terrainH(x, z); const s = 0.8 + r() * 0.9;
    d.position.set(x, y - 0.4, z); d.rotation.set(0, r() * 6.28, (r() - 0.5) * 0.12); d.scale.set(s, s * (0.9 + r() * 0.6), s); d.updateMatrix(); trunks.setMatrixAt(placed, d.matrix);
    d.position.y = y + 7.5 * d.scale.y + r() * 2; d.scale.multiplyScalar(1 + r() * 0.5); d.updateMatrix();
    if (r() < 0.6) { cans.setMatrixAt(placed, d.matrix); cans2.setMatrixAt(placed, new T.Matrix4().makeScale(0, 0, 0)); } else { cans2.setMatrixAt(placed, d.matrix); cans.setMatrixAt(placed, new T.Matrix4().makeScale(0, 0, 0)); }
    c.addCol(x, z, 0.55 * s); placed++;
  }
  trunks.count = cans.count = cans2.count = placed; c.add(trunks); c.add(cans); c.add(cans2);
}
function scatterRocks(c, n, color) {
  const T = c.THREE, r = c.rng();
  const geo = new T.DodecahedronGeometry(1, 0); const mat = new T.MeshStandardMaterial({ color: color || 0x2a3230, roughness: 0.9, flatShading: true });
  const m = new T.InstancedMesh(geo, mat, n); m.castShadow = true; m.receiveShadow = true; const d = new T.Object3D();
  for (let i = 0; i < n; i++) { const z = c.W.zMin + r() * (c.W.zMax - c.W.zMin), x = (r() - 0.5) * c.W.half * 2.2; const y = c.terrainH(x, z); const s = 0.3 + r() * 1.3; d.position.set(x, y - s * 0.3, z); d.rotation.set(r() * 3, r() * 3, r() * 3); d.scale.set(s * (1 + r()), s, s * (1 + r())); d.updateMatrix(); m.setMatrixAt(i, d.matrix); if (s > 0.9 && Math.abs(x) < c.W.half) c.addCol(x, z, s * 0.8); }
  c.add(m);
}
function fireflies(c, n, color) {
  const T = c.THREE, r = c.rng();
  const g = new T.BufferGeometry(), p = new Float32Array(n * 3), base = [];
  for (let i = 0; i < n; i++) { const x = (r() - 0.5) * c.W.half * 2.2, z = c.W.zMin + r() * (c.W.zMax - c.W.zMin); base.push([x, c.terrainH(x, z) + 0.6 + r() * 2.5, z, r() * 6.28]); p[i * 3] = x; p[i * 3 + 1] = base[i][1]; p[i * 3 + 2] = z; }
  g.setAttribute('position', new T.BufferAttribute(p, 3));
  const m = new T.PointsMaterial({ color: color || 0xc8ff70, size: 0.18, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
  const pts = new T.Points(g, m); c.add(pts);
  c.anim((dt, t) => { const pos = g.attributes.position, mz = c.me().z; for (let i = 0; i < base.length; i++) { const b = base[i]; if (Math.abs(b[2] - mz) > 60) continue; pos.setX(i, b[0] + Math.sin(t * 0.7 + b[3]) * 0.8); pos.setY(i, b[1] + Math.sin(t * 1.1 + b[3] * 2) * 0.4); pos.setZ(i, b[2] + Math.cos(t * 0.5 + b[3]) * 0.8); } pos.needsUpdate = true; m.opacity = 0.6 + Math.sin(t * 3) * 0.3; });
}
function groundMist(c, n, rgba, y = 0.35) {
  const T = c.THREE, r = c.rng();
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, rgba); g.addColorStop(1, rgba.replace(/[\d.]+\)$/, '0)')); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const mm = new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.55, fog: true });
  const mists = [];
  for (let i = 0; i < n; i++) { const m = new T.Mesh(new T.PlaneGeometry(14, 14), mm); m.rotation.x = -Math.PI / 2; const px = (r() - 0.5) * c.W.half * 2, pz = c.W.zMin + r() * (c.W.zMax - c.W.zMin); m.position.set(px, c.terrainH(px, pz) + y, pz); m.userData = { x: px, ph: r() * 6 }; c.add(m); mists.push(m); }
  c.anim((dt, t) => { for (const m of mists) m.position.x = m.userData.x + Math.sin(t * 0.15 + m.userData.ph) * 2; });
}
function flamePoint(c, x, y, z, color, dist, base) {
  const T = c.THREE; const l = new T.PointLight(color || 0xff9a30, base || 2.2, dist || 18, 1.7); l.position.set(x, y, z); c.add(l);
  c.anim((dt, t) => { l.intensity = (l.userData.on === false ? 0 : 1) * ((base || 2.2) + Math.sin(t * 13 + x) * 0.4 + Math.sin(t * 29 + z) * 0.25); });
  return l;
}
function firepit(c, x, z, scale = 1) {
  const T = c.THREE; const y = c.terrainH(x, z); const g = new T.Group(); g.position.set(x, y, z);
  const ring = new T.Mesh(new T.TorusGeometry(0.6 * scale, 0.12, 5, 10), new T.MeshStandardMaterial({ color: 0x3a3230, roughness: 1 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; g.add(ring);
  const fl = new T.Mesh(new T.ConeGeometry(0.28 * scale, 0.9 * scale, 6), c.MAT.flame); fl.position.y = 0.5; g.add(fl);
  c.anim((dt, t) => { fl.scale.y = 1 + Math.sin(t * 11 + x) * 0.25; fl.rotation.y = t * 2; });
  c.add(g); flamePoint(c, x, y + 1.2, z, 0xff8a30, 16 * scale, 2.4 * scale); c.addCol(x, z, 0.7 * scale);
  return g;
}
function hut(c, x, z, s = 1) {
  const T = c.THREE; const y = c.terrainH(x, z); const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = c.rng()() * 6.28;
  const wall = new T.Mesh(new T.CylinderGeometry(1.6 * s, 1.8 * s, 1.8 * s, 8), new T.MeshStandardMaterial({ color: 0x4a3a26, roughness: 1 })); wall.position.y = 0.9 * s; wall.castShadow = true; g.add(wall);
  const roof = new T.Mesh(new T.ConeGeometry(2.4 * s, 1.8 * s, 8), new T.MeshStandardMaterial({ color: 0x2a2214, roughness: 1, flatShading: true })); roof.position.y = 2.6 * s; roof.castShadow = true; g.add(roof);
  c.add(g); c.addCol(x, z, 1.9 * s); return g;
}
function totem(c, x, z, color) {
  const T = c.THREE; const y = c.terrainH(x, z); const g = new T.Group(); g.position.set(x, y, z);
  const m = new T.MeshStandardMaterial({ color: 0x241a10, roughness: 1 });
  const pole = new T.Mesh(new T.BoxGeometry(0.5, 4.4, 0.5), m); pole.position.y = 2.2; pole.castShadow = true; g.add(pole);
  const skull = new T.Mesh(new T.SphereGeometry(0.34, 8, 6), new T.MeshStandardMaterial({ color: 0xcfc4a8, roughness: 0.9 })); skull.position.y = 4.6; skull.scale.set(0.9, 1, 1.1); g.add(skull);
  const eyeM = new T.MeshBasicMaterial({ color: color || 0xff4020 });
  for (const sx of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(0.06, 5, 5), eyeM); e.position.set(sx * 0.13, 4.65, 0.28); g.add(e); }
  c.add(g); c.addCol(x, z, 0.5); return g;
}
function ruinPillar(c, x, z, h, broken) {
  const T = c.THREE; const y = c.terrainH(x, z);
  const m = new T.MeshStandardMaterial({ color: 0x4a443c, roughness: 0.95, flatShading: true });
  const p = new T.Mesh(new T.CylinderGeometry(0.7, 0.85, h, 7), m); p.position.set(x, y + h / 2 - 0.2, z); p.rotation.z = broken ? (c.rng()() - 0.5) * 0.14 : 0; p.castShadow = true; c.add(p);
  if (broken) { const cap = new T.Mesh(new T.DodecahedronGeometry(0.8, 0), m); cap.position.set(x + 1.2, y + 0.3, z + 0.8); cap.castShadow = true; c.add(cap); }
  c.addCol(x, z, 1.0); return p;
}
function bones(c, x, z, s = 1) {
  const T = c.THREE; const y = c.terrainH(x, z); const m = new T.MeshStandardMaterial({ color: 0xd8ccb0, roughness: 0.9 }); const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = c.rng()() * 6.28;
  for (let i = 0; i < 5; i++) { const rib = new T.Mesh(new T.TorusGeometry(0.5 * s, 0.05 * s, 5, 10, Math.PI), m); rib.position.set(0, 0.1, (i - 2) * 0.3 * s); rib.rotation.set(0, 0, 0.2 * (i - 2) * 0.1); g.add(rib); }
  const sk = new T.Mesh(new T.SphereGeometry(0.28 * s, 7, 6), m); sk.position.set(0, 0.15, 1.0 * s); sk.scale.set(0.9, 0.8, 1.2); g.add(sk);
  c.add(g); return g;
}
function palmTree(c, x, z) {
  const T = c.THREE; const y = c.terrainH(x, z); const g = new T.Group(); g.position.set(x, y - 0.2, z);
  const lean = (c.rng()() - 0.5) * 0.5;
  const trunk = new T.Mesh(new T.CylinderGeometry(0.14, 0.24, 7, 6), new T.MeshStandardMaterial({ color: 0x6a5638, roughness: 1 })); trunk.position.y = 3.5; trunk.rotation.z = lean; trunk.castShadow = true; g.add(trunk);
  const top = new T.Group(); top.position.set(-Math.sin(lean) * 7 * 0.5, 3.5 + Math.cos(lean) * 3.4, 0); g.add(top);
  const lm = new T.MeshStandardMaterial({ color: 0x2c6a34, roughness: 1, side: T.DoubleSide, flatShading: true });
  for (let i = 0; i < 7; i++) { const leaf = new T.Mesh(new T.PlaneGeometry(0.7, 3.2, 1, 4), lm); const pos = leaf.geometry.attributes.position; for (let v = 0; v < pos.count; v++) { const yy = pos.getY(v); pos.setZ(v, -Math.pow(yy + 1.6, 2) * 0.12); } leaf.geometry.computeVertexNormals(); const a = i / 7 * 6.28; leaf.position.set(0, 0.2, 0); leaf.rotation.set(-0.9, a, 0); const hold = new T.Group(); hold.rotation.y = a; hold.add(leaf); leaf.position.z = 1.4; top.add(hold); leaf.castShadow = true; }
  c.add(g); c.addCol(x, z, 0.5); return g;
}
function skyDisc(c, color, size, ox, oy, oz) {
  const T = c.THREE;
  const m = new T.Mesh(new T.SphereGeometry(size, 26, 20), new T.MeshBasicMaterial({ color, fog: false, transparent: true, opacity: 0.92 }));
  const halo = new T.Mesh(new T.SphereGeometry(size * 1.18, 26, 20), new T.MeshBasicMaterial({ color, fog: false, transparent: true, opacity: 0.16, side: T.BackSide }));
  m.add(halo); c.add(m);
  c.anim((dt, t) => { const p = c.me(); if (!p) return; m.position.set(p.x + ox, oy, p.z + oz); });
  return m;
}
function rockSpire(c, x, z, h, color) {
  const T = c.THREE; const y = c.terrainH(x, z); const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = c.rng()() * 6.28;
  const m = new T.MeshStandardMaterial({ color: color || 0x8a6a42, roughness: 0.95, flatShading: true });
  let py = 0, r = h * 0.09;
  for (let i = 0; i < 4; i++) { const seg = new T.Mesh(new T.CylinderGeometry(r * (0.55 + Math.random() * 0.15), r, h * 0.28, 7), m); seg.position.y = py + h * 0.14; seg.rotation.y = Math.random(); seg.castShadow = true; g.add(seg); py += h * 0.26; r *= 0.72; }
  const tip = new T.Mesh(new T.ConeGeometry(r, h * 0.2, 6), m); tip.position.y = py + h * 0.1; tip.castShadow = true; g.add(tip);
  c.add(g); c.addCol(x, z, h * 0.1); return g;
}
function warBanner(c, x, z, color) {
  const T = c.THREE; const y = c.terrainH(x, z); const g = new T.Group(); g.position.set(x, y, z);
  const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.07, 4.4, 6), new T.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 })); pole.position.y = 2.2; pole.castShadow = true; g.add(pole);
  const arm = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1.1, 5), new T.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 })); arm.rotation.z = Math.PI / 2; arm.position.set(0.45, 4.1, 0); g.add(arm);
  const cloth = new T.Mesh(new T.PlaneGeometry(0.85, 2.2, 1, 5), new T.MeshStandardMaterial({ color: color || 0xc05020, roughness: 0.9, side: T.DoubleSide }));
  cloth.position.set(0.5, 2.95, 0); g.add(cloth);
  const pos = cloth.geometry.attributes.position;
  c.anim((dt, t) => { for (let i = 0; i < pos.count; i++) { const yy = pos.getY(i); pos.setZ(i, Math.sin(t * 2.2 + yy * 2.5 + x) * 0.12 * (1 - (yy + 1.1) / 2.2)); } pos.needsUpdate = true; });
  c.add(g); c.addCol(x, z, 0.3); return g;
}
function brazierObj(c, x, z, litAtStart) {
  const T = c.THREE; const y = c.terrainH(x, z); const g = new T.Group(); g.position.set(x, y, z);
  const pole = new T.Mesh(new T.CylinderGeometry(0.09, 0.12, 1.5, 6), new T.MeshStandardMaterial({ color: 0x2a2420, roughness: 1 })); pole.position.y = 0.75; g.add(pole);
  const bowl = new T.Mesh(new T.CylinderGeometry(0.42, 0.2, 0.3, 8), new T.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.8, metalness: 0.3 })); bowl.position.y = 1.6; g.add(bowl);
  const fl = new T.Mesh(new T.ConeGeometry(0.24, 0.7, 6), c.MAT.flame); fl.position.y = 2.1; fl.visible = !!litAtStart; g.add(fl);
  const light = flamePoint(c, x, y + 2.2, z, 0xff9a30, 20, 2.6); light.userData.on = !!litAtStart;
  c.anim((dt, t) => { fl.scale.y = 1 + Math.sin(t * 12 + x) * 0.3; });
  c.add(g); c.addCol(x, z, 0.45);
  const b = { x, z, lit: !!litAtStart, light: (on) => { light.userData.on = on; fl.visible = on; } };
  return b;
}

// helper: hp drain for own player (host applies directly, client reports)
function drainSelf(c, key, period) {
  ST._t = ST._t || {}; ST._t[key] = (ST._t[key] || 0);
  return (dt) => { ST._t[key] += dt; if (ST._t[key] >= period) { ST._t[key] = 0; if (c.isAuth()) c.damagePlayer(c.me(), 1, null); else { c.act({ k: 'selfhurt', dmg: 1 }); const p = c.me(); p.hp = Math.max(0, p.hp - 1); p.hitT = 0.3; } c.juice('hurt', c.me().x, 0, c.me().z); } };
}
const gauss = (v, cx, s) => Math.exp(-((v - cx) * (v - cx)) / (2 * s * s));

// ================= TRIAL I — THE SHORE OF TEETH =================
const T1 = {
  seed: 311, amb: 'sea', drums: ['heart', 62, 0.3],
  name: () => E.st.lang === 'ta' ? 'பல் கடற்கரை' : 'The Shore of Teeth',
  tip: () => E.st.lang === 'ta' ? 'தண்ணியில மெதுவா ஆகுவீங்க — மணல் முதுகுகள் வழியா தாவுங்க.' : 'You are slow in the water — hop between the backs of sand.',
  bossName: () => E.st.lang === 'ta' ? 'ஆழி' : 'AAZHI, THE OLD ONE',
  checkpoints: [4, -84, -196, -300],
  build(c) {
    ST[0] = { seen: {} };
    const W = c.W; W.half = 34; W.zMin = -420; W.zMax = 8;
    const nz = c.makeNoise(311);
    // channels: bands where the land dips under the sea
    const bands = [[-70, -112], [-150, -196], [-234, -286], [-318, -364]];
    // guaranteed sandbar islands (x, z, radius, height)
    const bars = [[-8, -82, 6, 1.4], [8, -100, 6, 1.4], [-2, -92, 4, 1.2],
      [10, -162, 6, 1.4], [-6, -176, 6, 1.5], [4, -190, 5, 1.3],
      [-12, -246, 6, 1.5], [0, -260, 5, 1.4], [12, -272, 6, 1.5], [-2, -280, 4, 1.2],
      [6, -330, 6, 1.5], [-8, -344, 5, 1.4], [2, -358, 5, 1.4]];
    c.setTerrain((x, z) => {
      let h = nz.fbm2(x * 0.05 + 9, z * 0.05 + 9, 3) * 1.6 - 0.2;
      const edge = Math.max(0, (Math.abs(x) - W.half) / 12); h += edge * edge * 4;
      for (const [z1, z2] of bands) { if (z < z1 + 14 && z > z2 - 14) { const mid = (z1 + z2) / 2, w = (z1 - z2) / 2; const t = Math.max(0, 1 - Math.abs(z - mid) / (w + 10)); h -= U.smooth(Math.min(1, t * 1.6)) * 3.4; } }
      for (const [bx, bz, br, bh] of bars) h += gauss(Math.hypot(x - bx, z - bz), 0, br * 0.55) * bh * 2.2;
      if (z < -376) h += U.smooth(Math.min(1, (-376 - z) / 18)) * 3.2; // reef shelf up to the gate
      if (z > -30) h += U.smooth(Math.min(1, (z + 30) / 26)) * 1.4;    // opening beach
      return h;
    });
    c.sky({ fog: 0x2c4452, fogD: 0.014, hemiSky: 0x8ab0c0, hemiGround: 0x3a3020, hemiI: 1.1, sun: 0xffc890, sunI: 2.4, rim: 0x88b0d0, rimI: 0.9, exposure: 1.65, bloom: 0.5 });
    c.ground({ base: '#4a3f2c', spots: [120, 105, 70], dark: [30, 28, 20], colorFn: (x, z, col) => { const wet = nz.fbm2(x * 0.2, z * 0.2, 2); const h = c.terrainH(x, z); const sand = U.clamp((h + 1.2) / 2.4, 0, 1); col.setRGB(0.55 + sand * 0.45 + wet * 0.1, 0.5 + sand * 0.4 + wet * 0.12, 0.38 + sand * 0.28 + wet * 0.08); } });
    c.water(-0.55, 0x1e4c58, 0.8);
    const r = c.rng();
    for (let i = 0; i < 26; i++) { const z = -r() * 400 + 4; const x = (r() < 0.5 ? -1 : 1) * (16 + r() * 16); if (c.terrainH(x, z) > 0.3) palmTree(c, x, z); }
    scatterRocks(c, 120, 0x3a4038); bones(c, -6, -228, 1.6); bones(c, 10, -140, 1.2);
    groundMist(c, 30, 'rgba(150,180,190,0.13)', 0.5);
    c.gate(-404, { seal: 0xffb040 });
    // enemies
    skyDisc(c, 0xd8e8f0, 34, -160, 120, -420);
    c.etype('ghoul', { hp: 3, speed: 6.4, scale: 0.72, windup: 0.28, dmg: 1, reach: 1.8, color: 0x35402e, poise: 0 });
    c.etype('croc', { hp: 9, speed: 8.5, scale: 1.1, windup: 0.5, dmg: 2, reach: 2.6, color: 0x2a3a28, poise: 1, rig: 'croc', exposedOnly: true, noStealth: true });
    c.etype('aazhi', { hp: 30, speed: 8.5, scale: 1.7, windup: 0.5, dmg: 2, reach: 3.4, color: 0x24301e, poise: 2, rig: 'croc', exposedOnly: true, noStealth: true, boss: true });
    c.enemy('ghoul', -5, -30, { state: 'listen', opts: { wander: true } }); c.enemy('ghoul', 8, -44, { state: 'listen', opts: { wander: true } }); c.enemy('ghoul', -10, -52, { state: 'listen', opts: { wander: true } });
    c.enemy('croc', -14, -95, { state: 'lurk' }); c.enemy('croc', 14, -88, { state: 'lurk' });
    c.enemy('croc', -10, -168, { state: 'lurk' }); c.enemy('croc', 14, -182, { state: 'lurk' });
    c.enemy('ghoul', 2, -215, { state: 'listen', afterCp: 0, opts: { wander: true } }); c.enemy('ghoul', -8, -222, { state: 'listen', opts: { wander: true } });
    c.enemy('croc', -16, -252, { state: 'lurk' }); c.enemy('croc', 6, -268, { state: 'lurk' }); c.enemy('croc', 16, -240, { state: 'lurk' });
    c.enemy('aazhi', 0, -342, { state: 'lurk', once: true, gateKeeper: true, opts: { senseR: 22, leash: 44, ward: true } });
    c.enemy('ghoul', -4, -388, { state: 'listen', opts: { wander: true } }); c.enemy('ghoul', 7, -394, { state: 'listen', opts: { wander: true } });
  },
  rules(c) { const l = c.L; return [
    l('Reach the reef gate at the far end of the shore. Four drowned channels block the way.', 'கரையின் கடைசியில் இருக்கும் பாறை வாசலை அடையணும். நாலு மூழ்கிய கால்வாய்கள் வழியை மறிக்கும்.'),
    l('THE WATER IS NOT YOURS. Things with old teeth wait in it. In water you are slow and loud — cross where the sand rises above the sea.', 'தண்ணி உங்களுடையது இல்ல. பழைய பற்கள் அதுக்குள்ள காத்திருக்கு. தண்ணியில நீங்க மெதுவும் சத்தமும் — மணல் மேடுகள் வழியா தாண்டுங்க.'),
    l('A ripple ring means one is beneath. On land they are slow and can be killed — bait them out, dodge the lunge, strike.', 'வளைய அலை தெரிஞ்சா அடியில ஒண்ணு இருக்கு. கரையில அவை மெதுவு — வெளிய இழுத்து, பாய்ச்சலை dodge பண்ணி, அடிங்க.'),
    l('J attack · K heavy · Space dodge · E stone (a stone in the water pulls their attention).', 'J தாக்கு · K கனமா · Space dodge · E கல் (தண்ணியில கல் விழுந்தா அவை அங்க போகும்).'),
  ]; },
  intro(c) { const l = c.L; return [
    { at: 0.6, sp: 'MEERA', id: () => l('This is where the map begins. My father crossed this shore — his notebook says: never swim. Walk the sandbacks.', 'இங்கதான் map ஆரம்பம். என் அப்பா இந்தக் கரையை கடந்தார் — அவர் notebook சொல்லுது: நீந்தாதே. மணல் முதுகுல நட.') , dur: 6 },
    { at: 7, sp: 'SELVAM', id: () => l('Sandbacks. And if the sand moves?', 'மணல் முதுகா. மணலே நகர்ந்தா?'), dur: 3.5 },
    { at: 10.8, sp: 'KUMARAN', id: () => l('Then it was never sand. Move.', 'அப்போ அது மணல் இல்ல. நடங்க.'), dur: 3.5 },
  ]; },
  objective(c) { const l = c.L; const p = c.me(); if (c.inWater(p.x, p.z)) return l('GET OUT OF THE WATER — reach dry sand', 'தண்ணியிலிருந்து வெளியேறு — காய்ஞ்ச மணலுக்கு போ'); const az = c.hunters().find(h => h.type === 'aazhi' && h.state !== 'dead'); if (az && Math.abs(az.z - p.z) < 40) return l('AAZHI hunts this channel — bait it onto land', 'இந்தக் கால்வாயில் ஆழி வேட்டையாடுது — கரைக்கு இழு'); return l('Cross the drowned channels — head for the reef gate', 'மூழ்கிய கால்வாய்களை கடந்து பாறை வாசலுக்கு போ'); },
  waypointFn(c) { return [0, -404, c.L('GATE', 'வாசல்')]; },
  update(c, dt) {
    const s = ST[0]; const p = c.me();
    if (!s.wetCue && c.inWater(p.x, p.z)) { s.wetCue = 1; c.cue(() => c.L('Not deep water. NOT deep water!', 'ஆழத்துக்கு போகாதே. ஆழம் வேண்டாம்!'), 3); }
    if (!s.aazhiSeen && c.isAuth()) { const az = c.hunters().find(h => h.type === 'aazhi'); if (az && Math.min(p.z, (c.partner() || p).z) < -300) { s.aazhiSeen = 1; c.banner(c.L('AAZHI, THE OLD ONE', 'ஆழி — பழையவன்'), c.L('It has eaten every swimmer for a hundred years', 'நூறு வருஷமா நீந்தினவங்க எல்லாரையும் அது தின்னிருக்கு'), 3.5); c.bc('lvlev', { e: 'aazhi' }); const A2 = c.audio(); A2.drumsSet('war', 108, 1.0); } }
  },
  onEvent(c, m) { if (m.e === 'aazhi') { ST[0].aazhiSeen = 1; c.banner(c.L('AAZHI, THE OLD ONE', 'ஆழி — பழையவன்'), c.L('It has eaten every swimmer for a hundred years', 'நூறு வருஷமா நீந்தினவங்க எல்லாரையும் அது தின்னிருக்கு'), 3.5); } },
};

// ================= TRIAL II — THE FACELESS =================
const T2 = {
  seed: 422, amb: 'forest', drums: ['heart', 58, 0.28], dynMusic: false,
  name: () => E.st.lang === 'ta' ? 'முகம் இல்லாதவர்கள்' : 'The Faceless',
  tip: () => E.st.lang === 'ta' ? 'அவங்க முகத்தை பார்க்காதீங்க. பின்னாடி நடந்து, ஓரமா போங்க.' : 'Never face them. Walk backwards, hug the edges.',
  bossName: () => E.st.lang === 'ta' ? 'காவலன்' : 'THE WATCHER',
  checkpoints: [4, -110, -230],
  build(c) {
    ST[1] = {};
    const W = c.W; W.half = 26; W.zMin = -360; W.zMax = 8;
    const nz = c.makeNoise(422);
    c.setTerrain((x, z) => { let h = nz.fbm2(x * 0.05 + 40, z * 0.05 + 40, 3) * 1.8 - 0.9; const edge = Math.max(0, (Math.abs(x) - W.half) / 10); return h + edge * edge * 4; });
    c.sky({ fog: 0x14121c, fogD: 0.028, hemiSky: 0x4a4460, hemiGround: 0x14100c, hemiI: 0.95, sun: 0x90a0d8, sunI: 1.5, rim: 0x705a95, rimI: 0.6, exposure: 1.5, bloom: 0.65 });
    c.ground({ base: '#2a2418', spots: [60, 55, 40], dark: [15, 14, 10], colorFn: (x, z, col) => { const wet = nz.fbm2(x * 0.2, z * 0.2, 2); col.setRGB(0.4 + wet * 0.25, 0.36 + wet * 0.22, 0.3 + wet * 0.15); } });
    scatterTrees(c, { n: 420, minR: 10 }); scatterFerns(c, 700, 0x8a9a7a); scatterRocks(c, 90);
    groundMist(c, 45, 'rgba(120,110,150,0.15)');
    const r = c.rng();
    // village: huts + fires + totems along the corridor
    const hutSpots = [[-14, -60], [12, -74], [-10, -96], [14, -120], [-16, -142], [10, -160], [-12, -186], [14, -204], [-8, -238], [12, -256], [-14, -282], [10, -300]];
    for (const [x, z] of hutSpots) hut(c, x, z, 0.9 + r() * 0.4);
    for (const [x, z] of [[-6, -70], [8, -108], [-4, -152], [6, -196], [-6, -248], [4, -292], [0, -330]]) firepit(c, x, z, 0.9);
    for (const [x, z] of [[-18, -50], [18, -90], [-19, -130], [18, -170], [-18, -210], [18, -250], [-18, -290], [6, -318]]) totem(c, x, z, 0xff4020);
    bones(c, 3, -86, 1.1); bones(c, -7, -170, 1.3); bones(c, 5, -262, 1.2);
    c.gate(-344, { seal: 0xc94a3a });
    c.etype('cannibal', { hp: 10, speed: 7.6, scale: 1.05, windup: 0.36, dmg: 2, reach: 2.2, color: 0x2c1c12, poise: 1, mask: 0xd8c8a0, noEars: true });
    c.etype('watcher', { hp: 24, speed: 8.0, scale: 1.35, windup: 0.4, dmg: 2, reach: 2.6, color: 0x1c1210, poise: 2, mask: 0xa03020, noEars: true, boss: true });
    const spots = [[-8, -58, 0.4], [10, -80, -2.4], [-3, -102, 0.1], [13, -114, 2.0], [-13, -136, 0.8], [6, -150, -2.8], [-6, -168, 0.3], [12, -192, 2.6], [-11, -212, -0.5], [3, -228, 0.2], [-14, -252, 1.2], [8, -270, -2.2], [-4, -288, 0.4], [12, -308, 2.8], [-9, -320, -0.3]];
    for (const [x, z, yaw] of spots) c.enemy('cannibal', x, z, { state: 'still', yaw, opts: { deaf: true, seeR: 19, aggroRate: 0.8, calmR: 26 } });
    c.enemy('watcher', 0, -334, { state: 'still', yaw: 0.05, once: true, gateKeeper: true, opts: { deaf: true, seeR: 24, aggroRate: 1.15, calmR: 40, ward: true } });
  },
  onStart(c) { ST[1].m = c.meter(c.L('SEEN', 'பார்த்துட்டாங்க'), '#e05040'); },
  onReset(c) { if (ST[1].m) ST[1].m(0, false); },
  rules(c) { const l = c.L; return [
    l('The village of the Faceless. They will not touch you — AS LONG AS YOU DO NOT LOOK AT THEIR FACE.', 'முகம் இல்லாதவர்களின் ஊர். அவங்க உங்களை தொட மாட்டாங்க — அவங்க முகத்தை நீங்க பார்க்காத வரைக்கும்.'),
    l('Your character\'s gaze is what counts. Walk backwards, strafe, keep your eyes on the ground — the red bar shows how long you have looked.', 'உங்க ஆளோட பார்வைதான் முக்கியம். பின்னாடி நடங்க, பக்கவாட்டா நகருங்க — சிவப்பு bar எவ்வளவு நேரம் பார்த்தீங்கன்னு காட்டும்.'),
    l('If the bar fills, they frenzy. Run beyond their ground and they forget. Getting close to one wakes it instantly.', 'Bar நிறைஞ்சா வெறி வந்துடும். அவங்க எல்லைக்கு வெளிய ஓடுனா மறந்துடுவாங்க. ரொம்ப பக்கத்துல போனாலும் உடனே எழுந்துடுவாங்க.'),
    l('From BEHIND, they have no face at all: sneak close and press E for a silent kill. The Watcher at the gate cannot be killed this way.', 'பின்னாடியிலிருந்து அவங்களுக்கு முகமே இல்ல: பதுங்கி போய் E அழுத்தி அமைதியா முடிங்க. வாசல்ல இருக்கிற காவலனை அப்படி முடிக்க முடியாது.'),
  ]; },
  intro(c) { const l = c.L; return [
    { at: 0.6, sp: 'MEERA', id: () => l('My father wrote one line about this place, in shaking letters: "They only exist when they are seen."', 'இந்த இடத்தை பத்தி அப்பா நடுங்குற எழுத்துல ஒரே வரி எழுதினார்: "பார்க்கப்படும்போது மட்டும்தான் அவங்க இருக்காங்க."'), dur: 6 },
    { at: 7, sp: 'KUMARAN', id: () => l('Then we walk through a village of no one. Eyes down. Slow feet.', 'அப்போ யாருமில்லாத ஊர் வழியா நடக்கப் போறோம். கண்ணு கீழ. மெதுவான கால்.'), dur: 5 },
  ]; },
  objective(c) { const l = c.L; const fren = c.hunters().some(h => (h.type === 'cannibal' || h.type === 'watcher') && h.state === 'frenzy'); if (fren) return l('RUN — leave their ground and they forget', 'ஓடு — அவங்க எல்லையை விட்டா மறந்துடுவாங்க'); return l('Cross the village. Do not look at their faces.', 'ஊரை கடக்கணும். அவங்க முகத்தை பார்க்காதே.'); },
  waypointFn(c) { return [0, -344, c.L('GATE', 'வாசல்')]; },
  hud(c, dt) { const s = ST[1]; if (!s.m) return; let mx = 0; for (const h of c.hunters()) if ((h.type === 'cannibal' || h.type === 'watcher') && h.state !== 'dead') mx = Math.max(mx, h.aggro || 0); s.m(mx, mx > 0.03); const fren = c.hunters().some(h => h.state === 'frenzy'); c.tint(fren ? 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(200,30,20,0.35) 100%)' : null); if (!s.gazeCue && mx > 0.45) { s.gazeCue = 1; c.cue(() => c.L('EYES DOWN. Turn around. Now.', 'கண்ணை கீழ போடு. திரும்பு. இப்பவே.'), 2.6); } if (mx < 0.1) s.gazeCue = 0; },
};

// ================= TRIAL III — THE BLIND HUNTERS =================
const T3 = {
  seed: 23, amb: 'forest', drums: ['heart', 64, 0.35], completeOnArenas: true,
  name: () => E.st.lang === 'ta' ? 'குருட்டு வேட்டைக்காரர்கள்' : 'The Blind Hunters',
  tip: () => E.st.lang === 'ta' ? 'அவங்களுக்கு கண் இல்ல — காது மட்டும். Shift-ல பதுங்கி, E-ல அமைதியா முடிங்க.' : 'They have no eyes — only ears. Sneak with Shift, silence them with E.',
  bossName: () => E.st.lang === 'ta' ? 'மூத்த வேட்டைக்காரன்' : 'THE ELDER HUNTER',
  checkpoints: [-4, -70, -178, -320], autoCp: false,
  arenas: null, // set in build
  build(c) {
    ST[2] = {};
    const W = c.W; W.half = 34; W.zMin = -560; W.zMax = 8;
    const nz = c.makeNoise(23);
    c.setTerrain((x, z) => { const edge = Math.max(0, (Math.abs(x) - W.half) / 12); return nz.fbm2(x * 0.045 + 50, z * 0.045 + 50, 3) * 2.2 - 1.1 + edge * edge * 3.5; });
    c.sky({ fog: 0x07130f, fogD: 0.03, hemiSky: 0x4a7a72, hemiGround: 0x0a1408, hemiI: 0.9, sun: 0xa8c8d8, sunI: 1.7, rim: 0x6a90a8, rimI: 0.6, exposure: 1.45, bloom: 0.55 });
    c.ground({ base: '#2a2418', spots: [40, 50, 25], dark: [10, 12, 8], colorFn: (x, z, col) => { const wet = nz.fbm2(x * 0.2, z * 0.2, 2); col.setRGB(0.55 + wet * 0.3, 0.6 + wet * 0.35, 0.5 + wet * 0.2); if (Math.abs(x) < 6) col.multiplyScalar(1.1); } });
    scatterTrees(c, { n: 820 }); scatterRocks(c, 200); scatterFerns(c, 1200); fireflies(c, 240); groundMist(c, 60, 'rgba(120,150,140,0.16)');
    c.gate(-542, { trigger: false });
    const T = c.THREE, r = c.rng();
    const ARENAS = this.arenas = [
      { z: -48, r: 15, spawn: [['stalker', -4, -46], ['stalker', 5, -52]], wall: -66, cp: 0, banner: cc => cc.banner(cc.L('AMBUSH — 2 hunters', 'திடீர் தாக்குதல் — 2'), cc.L('J attack · K heavy · Space dodge', 'J தாக்கு · K கனமா · Space dodge'), 2.6) },
      { z: -150, r: 18, spawn: [['hunter', -6, -146], ['hunter', 7, -152], ['stalker', 0, -160], ['stalker', -9, -157]], wall: -172, cp: 1, banner: cc => cc.banner(cc.L('AMBUSH — 4 hunters', 'திடீர் தாக்குதல் — 4'), '', 2.4) },
      { z: -290, r: 20, spawn: [['brute', 0, -296], ['hunter', -8, -286], ['hunter', 9, -288], ['stalker', -5, -302], ['stalker', 6, -303]], wall: -314, cp: 2, banner: cc => cc.banner(cc.L('AMBUSH — a big one leads them', 'திடீர் தாக்குதல் — பெரிசு ஒண்ணு வருது'), cc.L('Heavy attacks break it', 'கன அடிதான் அதை உடைக்கும்'), 2.8) },
      { z: -470, r: 24, spawn: [['elder', 0, -480, { ward: true }]], wall: -505, cp: 3, boss: true, banner: cc => { cc.banner(cc.L('THE ELDER HUNTER', 'மூத்த வேட்டைக்காரன்'), cc.L('It has heard every scream in this forest', 'இந்தக் காட்டோட எல்லா அலறலையும் இது கேட்டிருக்கு'), 3.5); cc.audio().horn(46, 4, 0.5); } },
    ];
    if (!c.G.solo) { ARENAS[1].spawn.push(['stalker', 3, -158]); ARENAS[2].spawn.push(['stalker', -3, -300], ['hunter', 3, -290]); ARENAS[3].spawn.push(['stalker', -7, -474], ['stalker', 7, -474]); }
    for (const [x, z] of [[-8, -30], [9, -66], [-9, -172], [10, -230], [-8, -314], [9, -440], [-6, -505]]) warBanner(c, x, z, 0xc05020);
    c.etype('elder', { hp: 56, speed: 4.8, scale: 2.1, windup: 0.72, dmg: 2, reach: 4.2, color: 0x241410, poise: 3, aoe: true, boss: true,
      onHurt: (cc, h) => { if (h.hp < h.maxHp * 0.5 && !h.phase2) { h.phase2 = true; h.speed *= 1.25; h.windup *= 0.8; h.state = 'roar'; h.st = 0; cc.sfx('growl', 0.5); cc.bc('sfx', { n: 'growl' }); cc.say('MEERA', () => cc.L('It is angry now! Stay behind it!', 'இப்போ கோபம் வந்துடுச்சு! பின்னாடியே இருங்க!'), 3.5); for (const s of [['stalker', -6, -472], ['stalker', 6, -472]]) { const nh = cc.spawnNow(s[0], s[1], s[2], 'rise'); nh.arena = 3; cc.juice('rise', s[1], 0, s[2]); } } } });
    // thorn walls
    { const geo = new T.ConeGeometry(0.5, 3.2, 5); const mat = new T.MeshStandardMaterial({ color: 0x0c1a10, roughness: 1, flatShading: true });
      for (const a of ARENAS) { const grp = new T.Group(); for (let i = 0; i < 60; i++) { const m = new T.Mesh(geo, mat); const x = (i / 60 - 0.5) * 2 * (W.half + 6) + (r() - 0.5) * 1.5, z = a.wall + (r() - 0.5) * 3; m.position.set(x, c.terrainH(x, z) + 1.2, z); m.rotation.set((r() - 0.5) * 0.9, r() * 6, (r() - 0.5) * 0.9); m.scale.setScalar(0.8 + r() * 1.2); m.castShadow = true; grp.add(m); } c.softWall(grp, a.wall); } }
    // standing stones + arena lights
    { const sm = new T.MeshStandardMaterial({ color: 0x3a3a38, roughness: 0.9, flatShading: true }); const rm = new T.MeshBasicMaterial({ color: 0xff9a40 });
      ARENAS.forEach((a, ai) => { for (let i = 0; i < (a.boss ? 8 : 4); i++) { const ang = i / (a.boss ? 8 : 4) * 6.28 + 0.5; const x = Math.cos(ang) * (a.r - 3), z = a.z + Math.sin(ang) * (a.r - 3) * 0.7; const st = new T.Mesh(new T.BoxGeometry(1.2, 4 + r() * 2, 0.8), sm); st.position.set(x, c.terrainH(x, z) + 2, z); st.rotation.y = ang; st.rotation.z = (r() - 0.5) * 0.15; st.castShadow = true; c.add(st); const rune = new T.Mesh(new T.PlaneGeometry(0.5, 1.4), rm); rune.position.set(0, 0.6, 0.41); st.add(rune); rune.visible = false; st.userData.rune = rune; c.runeStone(st); c.addCol(x, z, 0.9); }
        const l = new T.PointLight(0x8fb8c8, 0, 40, 1.4); l.position.set(0, c.terrainH(0, a.z) + 9, a.z); c.arenaLight(ai, l); });
    }
    // stealth hunters between arenas
    const SPOTS = [['hunter', -7, -105, 0.4], ['hunter', 8, -225, -2.6], ['hunter', -4, -245, 0.2], ['hunter', 6, -380, 3.0], ['brute', -8, -410, 0.6], ['hunter', 10, -430, -2.9]];
    for (const [t, x, z, yaw] of SPOTS) c.enemy(t, x, z, { state: 'listen', yaw });
  },
  rules(c) { const l = c.L; return [
    l('Get both of you through the forest to the gate. Four ambush clearings block the way — clear each one to open the thorns. The last one has something old in it.', 'இருவரும் காட்டைக் கடந்து வாசலை அடையணும். நாலு ambush clearings வழியை அடைக்கும் — ஒவ்வொண்ணையும் clear பண்ணா முள் திறக்கும். கடைசியில பழசான ஏதோ ஒண்ணு இருக்கு.'),
    l('FIGHT: J / click = attack (3-hit combo). K / right-click = heavy (breaks big ones). Space = dodge — enemies FLASH RED before they strike.', 'சண்டை: J / click = தாக்கு (3-hit combo). K / right-click = கனமா. Space = dodge — எதிரிகள் அடிக்கிறதுக்கு முன்னாடி சிவப்பா மின்னும்.'),
    l('STEALTH: between clearings, hunters stand listening. Sneak (Shift) behind one and press E — a silent kill. Loud steps wake them.', 'பதுங்கல்: clearings நடுவுல வேட்டைக்காரர்கள் கேட்டுட்டு நிப்பாங்க. Shift-ல பின்னாடி போய் E அழுத்துங்க. சத்தமா நடந்தா எழுந்துடுவாங்க.'),
    l('THE TIGER: every hit fills the meter. Full = press R — seven seconds of double damage.', 'புலி: ஒவ்வொரு hit-ம் meter-ஐ நிரப்பும். நிறைஞ்சா R — ஏழு நொடி double damage.'),
    l('If your partner falls, stand next to them and HOLD E to revive.', 'நண்பர் விழுந்தா பக்கத்துல நின்னு E பிடிச்சு எழுப்புங்க.'),
  ]; },
  intro(c) { const l = c.L; return [
    { at: 0.6, sp: 'MEERA', id: () => l('The forest of the blind hunters. They gave their eyes to the kingdom long ago. What is left hears a heartbeat at fifty paces.', 'குருட்டு வேட்டைக்காரர்களின் காடு. எப்பவோ ராஜ்யத்துக்காக கண்ணை கொடுத்தவங்க. மிச்சம் இருக்கிறது ஐம்பது அடியில இதயத்துடிப்பை கேட்கும்.'), dur: 6.5 },
    { at: 7.5, sp: 'SELVAM', id: () => l('Then let us give them nothing to hear.', 'அப்போ கேட்க எதுவும் கொடுக்காம போவோம்.'), dur: 3.5 },
  ]; },
  objective(c) { const l = c.L; const G = c.G; if (G.arenaActive) { const alive = c.hunters().filter(h => h.arena === G.arena && h.state !== 'dead').length; return this.arenas[G.arena].boss ? '' : l(`${alive} left`, `${alive} மீதி`); } const next = this.arenas.findIndex((a, i) => !G.cleared[i]); return next >= 0 ? l(next === 3 ? 'Something big is waiting ahead' : 'Move deeper into the forest', next === 3 ? 'பெரிசா ஏதோ முன்னாடி காத்திருக்கு' : 'காட்டுக்குள்ள இன்னும் போங்க') : l('Reach the gate', 'வாசலை அடையுங்க'); },
  waypointFn(c) { const G = c.G; if (G.arenaActive) return null; const next = this.arenas.findIndex((a, i) => !G.cleared[i]); if (next >= 0) { const a = this.arenas[next]; return [0, a.z + a.r - 2, '']; } return [0, -542, c.L('GATE', 'வாசல்')]; },
  update(c, dt) { const s = ST[2]; s.cf = (s.cf || 0) - dt; s.cm = (s.cm || 0) - dt; if (!c.isAuth()) return; const near = c.hunters().find(h => h.arena < 0 && h.state !== 'dead' && Math.hypot(h.x - c.me().x, h.z - c.me().z) < 14); if (!near) return; if (near.state === 'listen' && s.cf <= 0) { s.cf = 12; c.cue(() => c.L('Freeze. It is listening. Shift — slow feet.', 'அசையாதே. அது கேட்குது. Shift — மெதுவா.'), 2.4); } if (near.state === 'investigate' && s.cm <= 0) { s.cm = 9; c.cue(() => c.L('It heard the stone. Move around it now.', 'கல் சத்தம் கேட்டுடுச்சு. இப்போ சுத்தி போ.'), 2); } },
};

// ================= TRIAL IV — THE PIT OF SCALES =================
function deadTree(c, x, z, s = 1) {
  const T = c.THREE; const y = c.terrainH(x, z); const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = c.rng()() * 6.28;
  const m = new T.MeshStandardMaterial({ color: 0x241e16, roughness: 1 });
  const trunk = new T.Mesh(new T.CylinderGeometry(0.16 * s, 0.4 * s, 7 * s, 6), m); trunk.position.y = 3.5 * s; trunk.castShadow = true; g.add(trunk);
  for (let i = 0; i < 4; i++) { const br = new T.Mesh(new T.CylinderGeometry(0.05 * s, 0.12 * s, 2.6 * s, 5), m); br.position.y = (4 + i * 0.8) * s; br.rotation.z = (i % 2 ? 1 : -1) * (0.7 + c.rng()() * 0.5); br.position.x = (i % 2 ? 1 : -1) * 0.9 * s; br.castShadow = true; g.add(br); }
  c.add(g); c.addCol(x, z, 0.4 * s); return g;
}
const T4 = {
  seed: 533, amb: 'rain', drums: ['heart', 60, 0.3], torch: true,
  name: () => E.st.lang === 'ta' ? 'செதில் பள்ளம்' : 'The Pit of Scales',
  tip: () => E.st.lang === 'ta' ? 'Q பிடிச்சா தீப்பந்தம் — பாம்புகள் நெருங்காது. நெருப்புத் தட்டுகளை E-ல ஏத்துங்க.' : 'Hold Q to raise your torch — snakes will not strike. Light braziers with E.',
  checkpoints: [4, -130, -260],
  build(c) {
    ST[3] = { braz: [] };
    const W = c.W; W.half = 22; W.zMin = -400; W.zMax = 8;
    const nz = c.makeNoise(533);
    const trench = (x, z) => (z < -138 && z > -222) ? U.smooth(Math.max(0, 1 - Math.abs(x) / 4.5)) * 5 : 0;
    c.setTerrain((x, z) => { let h = nz.fbm2(x * 0.06 + 70, z * 0.06 + 70, 3) * 1.6 - 0.8; const edge = Math.max(0, (Math.abs(x) - W.half) / 9); h += edge * edge * 5; h -= trench(x, z); return h; });
    c.sky({ fog: 0x1a2812, fogD: 0.034, hemiSky: 0x5a7a48, hemiGround: 0x141a0a, hemiI: 1.05, sun: 0xaac89a, sunI: 1.7, rim: 0x7aaa6a, rimI: 0.6, exposure: 1.55, bloom: 0.6 });
    c.ground({ base: '#2c2a16', spots: [70, 80, 40], dark: [18, 20, 10], colorFn: (x, z, col) => { const wet = nz.fbm2(x * 0.18, z * 0.18, 2); col.setRGB(0.42 + wet * 0.2, 0.48 + wet * 0.3, 0.3 + wet * 0.15); if (trench(x, z) > 1) col.multiplyScalar(0.6); } });
    c.water(-1.15, 0x24401e, 0.86);
    const r = c.rng();
    for (let i = 0; i < 60; i++) { const z = -r() * 380, x = (r() - 0.5) * W.half * 2.1; if (Math.abs(x) < 6 && z < -138 && z > -222) continue; deadTree(c, x, z, 0.7 + r() * 0.8); }
    scatterFerns(c, 800, 0x7a9a5a, [30, 80, 20], [35, 90, 25]); scatterRocks(c, 110, 0x2c3626); groundMist(c, 55, 'rgba(140,170,110,0.16)', 0.4); fireflies(c, 160, 0xa8ff50);
    c.gate(-386, { seal: 0xffb040 });
    c.etype('snake', { hp: 3, speed: 2.4, scale: 1.0, windup: 0.5, dmg: 1, reach: 2.5, color: 0x3a5a20, poise: 0, rig: 'snake', noStealth: true });
    // nests: mound + snakes ringed around it
    const T = c.THREE; const nests = [[-8, -52], [10, -72], [-4, -100], [12, -122], [-12, -156], [12, -170], [-12, -200], [10, -214], [-6, -248], [12, -268], [-10, -292], [4, -318], [-4, -344]];
    const mm = new T.MeshStandardMaterial({ color: 0x3a3020, roughness: 1, flatShading: true });
    for (const [x, z] of nests) { const mound = new T.Mesh(new T.ConeGeometry(1.6, 1.1, 7), mm); mound.position.set(x, c.terrainH(x, z) + 0.3, z); c.add(mound); c.addCol(x, z, 1.0); const n = 3 + (r() < 0.5 ? 1 : 0); for (let i = 0; i < n; i++) { const a = r() * 6.28, d = 1.6 + r() * 1.6; c.enemy('snake', x + Math.cos(a) * d, z + Math.sin(a) * d, { state: 'nest', yaw: r() * 6.28 }); } }
    // snakes in the trench (death pit)
    for (let i = 0; i < 14; i++) { const z = -145 - r() * 70, x = (r() - 0.5) * 6; c.enemy('snake', x, z, { state: 'nest', yaw: r() * 6.28, opts: { senseR: 5 } }); }
    // braziers clear nearby nests
    for (const [x, z] of [[-4, -64], [8, -110], [-8, -182], [8, -230], [-2, -280], [6, -330]]) {
      const b = brazierObj(c, x, z, false); ST[3].braz.push(b);
      c.inter({ x, z, r: 2.4, hold: 1.2, once: true, label: () => c.L('HOLD E — light the brazier', 'E பிடி — தீ ஏத்து'), cb: (p, remote) => { b.lit = true; b.light(true); c.juice('fire', x, c.terrainH(x, z) + 2, z); if (c.isAuth()) { for (const h of c.hunters()) { if (h.type === 'snake' && h.state !== 'dead' && Math.hypot(h.x - x, h.z - z) < 10) { h.state = 'dead'; h.st = 0; c.juice('fire', h.x, 0.5, h.z); } } } c.banner(c.L('THE FIRE HOLDS THEM', 'தீ அவற்றை தடுக்கும்'), '', 1.8); } });
    }
    // warrior ambush mid-way
    c.enemy('stalker', -6, -238, { state: 'listen', yaw: 0.3, opts: { wander: true } }); c.enemy('stalker', 8, -252, { state: 'listen', yaw: -2.5, opts: { wander: true } });
    c.enemy('hunter', -4, -352, { state: 'listen', yaw: 0.2 }); c.enemy('hunter', 8, -360, { state: 'listen', yaw: 2.9 });
    c.enemy('brute', 0, -380, { state: 'listen', yaw: 0.1, once: true, gateKeeper: true, opts: { ward: true } });
    // shrine at the end
    const sh = new T.Group(); const sy = c.terrainH(0, -372); sh.position.set(0, sy, -372);
    const slab = new T.Mesh(new T.BoxGeometry(3, 0.5, 2), new T.MeshStandardMaterial({ color: 0x4a443c, roughness: 0.9 })); slab.position.y = 0.25; sh.add(slab);
    const tiger = new T.Mesh(new T.CircleGeometry(0.8, 20), new T.MeshBasicMaterial({ color: 0xffb040 })); tiger.position.set(0, 1.6, 0); tiger.rotation.y = Math.PI; sh.add(tiger); c.add(sh);
    const beam = new T.Mesh(new T.CylinderGeometry(0.5, 1.4, 16, 12, 1, true), new T.MeshBasicMaterial({ color: 0xffcf80, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false })); beam.position.set(0, sy + 8, -372); c.add(beam); ST[3].beam = beam;
  },
  rules(c) { const l = c.L; return [
    l('A drowned ravine, floor alive with snakes. They rear up and FLASH before they strike — step back or dodge.', 'மூழ்கிய பள்ளத்தாக்கு, தரை முழுக்க பாம்பு. அடிக்கிறதுக்கு முன்னாடி எழும்பி மின்னும் — பின்னாடி போ அல்லது dodge.'),
    l('HOLD Q to raise a torch: snakes near the flame will not strike, but you walk slowly and cannot swing.', 'Q பிடிச்சா தீப்பந்தம்: நெருப்புப் பக்கத்துல பாம்பு கடிக்காது, ஆனா மெதுவா நடப்பீங்க, அடிக்க முடியாது.'),
    l('Light the BRAZIERS (hold E) — the fire burns every nest around them, forever.', 'நெருப்புத் தட்டுகளை ஏத்துங்க (E பிடி) — சுத்தி இருக்கிற எல்லா கூடுகளையும் தீ எரிச்சுடும்.'),
    l('The centre trench is a pit of scales — do not fall in. Something waits at the far shrine.', 'நடு அகழி செதில் பள்ளம் — விழாதீங்க. தூரத்து சன்னதியில ஏதோ காத்திருக்கு.'),
  ]; },
  intro(c) { const l = c.L; return [
    { at: 0.6, sp: 'MEERA', id: () => l('Father drew this ravine and wrote: "the floor moves." Keep to the high mud. And Kumaran — the shrine at the end. His last page was about you.', 'அப்பா இந்த பள்ளத்தாக்கை வரைஞ்சு எழுதினார்: "தரை நகரும்." உயரமான சேற்றுல நடங்க. குமரா — கடைசியில இருக்கிற சன்னதி. அவரோட கடைசி பக்கம் உன்னைப் பத்தினது.'), dur: 7 },
    { at: 8, sp: 'KUMARAN', id: () => l('About me? I am a boatman, Meera.', 'என்னைப் பத்தியா? நான் படகோட்டி, மீரா.'), dur: 3.5 },
  ]; },
  objective(c) { const l = c.L; const p = c.me(); if (p.torch) return l('Torch raised — snakes hold back, you walk slow', 'பந்தம் உயர்த்தி — பாம்பு நிற்கும், நீ மெது'); return l('Cross the ravine. Fire clears the nests. The shrine waits.', 'பள்ளத்தாக்கை கடக்கணும். தீ கூடுகளை அழிக்கும். சன்னதி காத்திருக்கு.'); },
  waypointFn(c) { const s = ST[3]; const b = s.braz.find(b2 => !b2.lit && b2.z > c.me().z - 40 && b2.z < c.me().z + 5); if (b && Math.hypot(b.x - c.me().x, b.z - c.me().z) > 6) return [b.x, b.z, c.L('FIRE', 'தீ')]; return [0, -372, c.L('SHRINE', 'சன்னதி')]; },
  update(c, dt) {
    const s = ST[3];
    if (s.beam && s.beam.material.opacity > 0) s.beam.rotation.y += dt * 0.4;
    if (!s.reveal) { const lead = Math.min(c.me().z, (c.partner() || c.me()).z); if (lead < -364) { s.reveal = 1; if (c.isAuth()) c.bc('lvlev', { e: 'reveal' }); T4._doReveal(c); } }
  },
  onEvent(c, m) { if (m.e === 'reveal' && !ST[3].reveal) { ST[3].reveal = 1; T4._doReveal(c); } },
  _doReveal(c) {
    const s = ST[3]; s.beam.material.opacity = 0.35; c.audio().horn(60, 6, 0.5); c.shake(0.6); c.fov(50);
    c.juice('fire', 0, c.terrainH(0, -372) + 2, -372);
    const l = c.L;
    c.script([
      { at: 0.8, sp: 'MEERA', id: () => l('The seal answers you, Kumaran. Your back — the mark. The tiger mark of the lost kings.', 'முத்திரை உனக்கு பதில் சொல்லுது, கும்ரா. உன் முதுகு — அந்த அடையாளம். தொலைஞ்ச அரசர்களோட புலி முத்திரை.'), dur: 6 },
      { at: 7.2, sp: 'KUMARAN', id: () => l('My mother said it was a burn from the kitchen fire…', 'அம்மா சொன்னாங்க அது அடுப்புத் தீ சூடுன்னு…'), dur: 4.5 },
      { at: 12, sp: 'SELVAM', id: () => l('A kitchen fire shaped like a leaping tiger, machan? They were WAITING for you.', 'பாயுற புலி மாதிரி அடுப்புச் சூடா, மச்சான்? அவங்க உனக்காகக் காத்திருந்தாங்க.'), dur: 5 },
      { at: 17.5, sp: 'MEERA', id: () => l('Beyond this gate the land starves. Eat when you can. Go.', 'இந்த வாசலுக்கு அப்பால நிலம் பட்டினி. முடியும்போது சாப்பிடுங்க. போங்க.'), dur: 5 },
    ]);
  },
};

// ================= TRIAL V — THE HUNGER =================
const T5 = {
  seed: 644, amb: 'storm', drums: ['heart', 54, 0.25],
  name: () => E.st.lang === 'ta' ? 'பசி' : 'The Hunger',
  tip: () => E.st.lang === 'ta' ? 'பசி meter காலியானா உடம்பு விழும். பழம், தேன், மீன் — கண்டா சாப்பிடு.' : 'When the FOOD meter empties, your body fails. Fruit, honey, fish — eat when you find it.',
  checkpoints: [4, -160, -310],
  build(c) {
    ST[4] = { forage: [] };
    const W = c.W; W.half = 40; W.zMin = -440; W.zMax = 8;
    const nz = c.makeNoise(644);
    c.setTerrain((x, z) => { let h = nz.fbm2(x * 0.03 + 20, z * 0.03 + 20, 4) * 3.2 - 1.2; const edge = Math.max(0, (Math.abs(x) - W.half) / 12); h += edge * edge * 4; h += gauss(Math.hypot(x - 14, z + 250), 0, 9) * -1.6; return h; });
    c.sky({ fog: 0x8a7350, fogD: 0.012, hemiSky: 0xc0a880, hemiGround: 0x4a3a20, hemiI: 1.0, sun: 0xffd8a0, sunI: 2.6, rim: 0xd0b080, rimI: 0.7, exposure: 1.7, bloom: 0.4 });
    c.ground({ base: '#5a4526', spots: [150, 120, 70], dark: [50, 40, 22], colorFn: (x, z, col) => { const dry = nz.fbm2(x * 0.15, z * 0.15, 2); col.setRGB(0.7 + dry * 0.3, 0.58 + dry * 0.25, 0.4 + dry * 0.15); } });
    const r = c.rng();
    for (let i = 0; i < 40; i++) deadTree(c, (r() - 0.5) * W.half * 2, -r() * 420, 0.6 + r() * 0.9);
    scatterRocks(c, 160, 0x6a5a40); groundMist(c, 20, 'rgba(220,190,140,0.1)', 0.8);
    bones(c, -10, -80, 2.2); bones(c, 16, -190, 1.6); bones(c, -20, -330, 2.6); bones(c, 4, -260, 1.2);
    c.gate(-424, { seal: 0xffb040 });
    skyDisc(c, 0xffd9a0, 46, 120, 95, -430);
    for (const [x, z, h] of [[-34, -90, 26], [36, -150, 34], [-38, -230, 30], [34, -300, 38], [-30, -380, 28], [26, -60, 22]]) rockSpire(c, x, z, h);
    c.etype('jackal', { hp: 4, speed: 7.8, scale: 0.85, windup: 0.28, dmg: 1, reach: 2.0, color: 0x6a5230, belly: 0x9a8258, tint: 0xb08a58, poise: 0, rig: 'fox', noStealth: true });
    // fruit trees (green canopy = food)
    const T = c.THREE;
    const fruitSpots = [[-16, -60], [20, -130], [-24, -210], [8, -285], [-14, -368]];
    for (const [x, z] of fruitSpots) {
      const g = new T.Group(); const y = c.terrainH(x, z); g.position.set(x, y, z);
      const tr = new T.Mesh(new T.CylinderGeometry(0.2, 0.35, 4.5, 6), new T.MeshStandardMaterial({ color: 0x4a3a22, roughness: 1 })); tr.position.y = 2.2; tr.castShadow = true; g.add(tr);
      const can = new T.Mesh(new T.IcosahedronGeometry(2.1, 1), new T.MeshStandardMaterial({ color: 0x3a7a2c, roughness: 1, flatShading: true })); can.position.y = 5; can.castShadow = true; g.add(can);
      for (let i = 0; i < 6; i++) { const f = new T.Mesh(new T.SphereGeometry(0.14, 6, 6), new T.MeshBasicMaterial({ color: 0xffa020 })); const a = r() * 6.28; f.position.set(Math.cos(a) * 1.6, 4.2 + r() * 1.4, Math.sin(a) * 1.6); g.add(f); }
      c.add(g); c.addCol(x, z, 0.5);
      const spot = { x, z, used: false };
      ST[4].forage.push(spot);
      c.inter({ x, z, r: 2.6, hold: 0.9, once: true, label: () => c.L('HOLD E — pick fruit', 'E பிடி — பழம் பறி'), cb: (p) => { spot.used = true; p.hunger = Math.min(1, (p.hunger || 0) + 0.55); c.juice('eat', x, c.terrainH(x, z) + 1.5, z); } });
    }
    // honey rock guarded by jackals
    const honey = [[12, -168], [-18, -300]];
    for (const [x, z] of honey) { const rock = new T.Mesh(new T.DodecahedronGeometry(1.8, 0), new T.MeshStandardMaterial({ color: 0x7a6030, roughness: 0.8 })); rock.position.set(x, c.terrainH(x, z) + 0.8, z); c.add(rock); c.addCol(x, z, 1.6); const comb = new T.Mesh(new T.SphereGeometry(0.5, 7, 6), new T.MeshBasicMaterial({ color: 0xffc030 })); comb.position.set(x + 0.8, c.terrainH(x, z) + 1.8, z); c.add(comb);
      const spot = { x: x + 1, z, used: false }; ST[4].forage.push(spot);
      c.inter({ x: x + 1, z, r: 2.6, hold: 1.3, once: true, label: () => c.L('HOLD E — take honey', 'E பிடி — தேன் எடு'), cb: (p) => { spot.used = true; p.hunger = Math.min(1, (p.hunger || 0) + 0.8); c.juice('eat', x, c.terrainH(x, z) + 2, z); if (c.isAuth()) { for (let i = 0; i < 3; i++) c.spawnNow('jackal', x + (i - 1) * 3, z - 6 - i * 2, 'rise', { alwaysAggro: true }); c.banner(c.L('THE THIN ONES SMELL IT', 'ஒல்லியானவை மணம் பிடிச்சிடுச்சு'), '', 2.2); } } });
    }
    // the pond (fish) — noisy but rich
    { const px = 14, pz = -250; const spot = { x: px, z: pz, used: false }; ST[4].forage.push(spot);
      const wm = new T.Mesh(new T.CircleGeometry(7, 24), new T.MeshStandardMaterial({ color: 0x2c5a6a, roughness: 0.3, metalness: 0.3, transparent: true, opacity: 0.85 })); wm.rotation.x = -Math.PI / 2; wm.position.set(px, c.terrainH(px, pz) + 0.35, pz); c.add(wm);
      c.inter({ x: px, z: pz, r: 5, hold: 1.6, label: () => c.L('HOLD E — catch a fish (loud!)', 'E பிடி — மீன் புடி (சத்தம்!)'), cb: (p) => { p.hunger = 1; c.juice('splash', px, c.terrainH(px, pz) + 0.6, pz); if (c.isAuth()) { c.addSound(px, pz, 40, 'player', p); for (let i = 0; i < 2; i++) c.spawnNow('jackal', px + (i ? 9 : -9), pz - 8, 'rise', { alwaysAggro: true }); } } });
    }
    // roaming packs
    c.enemy('jackal', -8, -110, { state: 'listen', opts: { wander: true } }); c.enemy('jackal', -12, -116, { state: 'listen', opts: { wander: true } }); c.enemy('jackal', -4, -120, { state: 'listen', opts: { wander: true } });
    c.enemy('jackal', 16, -220, { state: 'listen', opts: { wander: true } }); c.enemy('jackal', 20, -226, { state: 'listen', opts: { wander: true } });
    c.enemy('jackal', -6, -350, { state: 'listen', opts: { wander: true } }); c.enemy('jackal', -12, -356, { state: 'listen', opts: { wander: true } }); c.enemy('jackal', 0, -360, { state: 'listen', opts: { wander: true } }); c.enemy('jackal', 6, -390, { state: 'listen', opts: { wander: true } });
    c.enemy('brute', 0, -416, { state: 'listen', yaw: 0.1, once: true, gateKeeper: true, opts: { ward: true } });
  },
  onStart(c) { ST[4].m = c.meter(c.L('FOOD', 'உணவு'), '#8adf5a'); ST[4].drain = drainSelf(c, 'hunger', 5.5); },
  onReset(c) { const s = ST[4]; if (s.m) s.m(1, true); },
  rules(c) { const l = c.L; return [
    l('The starving plateau. Your FOOD meter drains as you move — running drains it faster.', 'பட்டினி பீடபூமி. நடக்க நடக்க FOOD meter குறையும் — ஓடினா இன்னும் வேகமா.'),
    l('At zero: you slow down, the world greys out, and your body starts to fail.', 'பூஜ்யத்துல: வேகம் குறையும், உலகம் சாம்பலாகும், உடம்பு விழ ஆரம்பிக்கும்.'),
    l('Fruit trees, honey rocks and the fish pond refill you. Honey and fish bring the Thin Ones running.', 'பழ மரம், தேன் பாறை, மீன் குளம் — நிரப்பும். தேனும் மீனும் ஒல்லியானவங்களை கூட்டிட்டு வரும்.'),
    l('Share the land: each fruit tree feeds only the one who picks it.', 'நிலத்தை பங்கு போடுங்க: ஒவ்வொரு பழமும் பறிக்கிறவங்களுக்கு மட்டும்.'),
  ]; },
  intro(c) { const l = c.L; return [
    { at: 0.6, sp: 'MEERA', id: () => l('The fifth page is almost empty. Father only wrote: "We ate the ropes. Then the maps. Forgive me."', 'அஞ்சாவது பக்கம் கிட்டத்தட்ட காலி. அப்பா எழுதினது இவ்வளவுதான்: "கயிறுகளை சாப்பிட்டோம். அப்புறம் map-களை. மன்னிச்சிடு."'), dur: 6.5 },
    { at: 7.5, sp: 'SELVAM', id: () => l('We will not eat the maps, machan. I saw fruit. I can SMELL honey.', 'நாம map சாப்பிட மாட்டோம், மச்சான். பழம் பார்த்தேன். தேன் வாசனை வருது.'), dur: 4.5 },
  ]; },
  speedMul(c, p) { return (p.hunger || 0) <= 0.02 ? 0.55 : 1; },
  hook(c, p, dt) { const run = p.anim === 'run'; p.hunger = U.clamp((p.hunger == null ? 1 : p.hunger) - dt * (run ? 1 / 50 : 1 / 85), 0, 1); if (p.hunger <= 0.02) ST[4].drain && ST[4].drain(dt); },
  hud(c, dt) { const s = ST[4]; const p = c.me(); if (s.m) s.m(p.hunger, true); const h = p.hunger; c.filter(h < 0.35 ? `saturate(${0.35 + h * 1.8}) brightness(${0.92 + h * 0.2})` : null); if (!s.warn && h < 0.25) { s.warn = 1; c.cue(() => c.L('Your hands are shaking. Find food. NOW.', 'கை நடுங்குது. உணவு தேடு. இப்பவே.'), 3); } if (h > 0.5) s.warn = 0; },
  objective(c) { const l = c.L; return c.me().hunger < 0.35 ? l('STARVING — find fruit, honey, or the pond', 'பசி கொல்லுது — பழம், தேன், குளம் தேடு') : l('Cross the plateau before the land empties you', 'நிலம் உன்னை காலி பண்றதுக்குள்ள பீடபூமியை கடந்திடு'); },
  waypointFn(c) { const p = c.me(); if (p.hunger < 0.4) { let best = null, bd = 1e9; for (const f of ST[4].forage) { if (f.used) continue; const d = Math.hypot(f.x - p.x, f.z - p.z); if (d < bd) { bd = d; best = f; } } if (best && bd < 120) return [best.x, best.z, c.L('FOOD', 'உணவு')]; } return [0, -424, c.L('GATE', 'வாசல்')]; },
};

// ================= TRIAL VI — THE SINKING GROUND =================
const T6 = {
  seed: 755, amb: 'storm', drums: ['heart', 58, 0.3],
  name: () => E.st.lang === 'ta' ? 'விழுங்கும் மண்' : 'The Sinking Ground',
  tip: () => E.st.lang === 'ta' ? 'கல் எறிஞ்சு தரையை படிங்க — மண் விழுங்கினா அது ஆபத்து. ஆழத்துல மாட்டினா நண்பர் E-ல இழுப்பார்.' : 'Throw stones to read the ground — if the earth swallows the stone, it will swallow you. A partner pulls you from deep sand with E.',
  checkpoints: [4, -140, -270],
  build(c) {
    ST[5] = { qs: [] };
    const W = c.W; W.half = 30; W.zMin = -380; W.zMax = 8;
    const nz = c.makeNoise(755);
    c.setTerrain((x, z) => { let h = nz.fbm2(x * 0.04 + 33, z * 0.04 + 33, 3) * 1.4 - 0.6; const edge = Math.max(0, (Math.abs(x) - W.half) / 10); return h + edge * edge * 4; });
    c.sky({ fog: 0x565048, fogD: 0.02, hemiSky: 0x8a8478, hemiGround: 0x2a2620, hemiI: 0.85, sun: 0xb0a890, sunI: 1.5, rim: 0x909a98, rimI: 0.5, exposure: 1.4, bloom: 0.4 });
    c.ground({ base: '#3c362c', spots: [100, 92, 76], dark: [30, 28, 22], colorFn: (x, z, col) => { const wet = nz.fbm2(x * 0.16, z * 0.16, 2); col.setRGB(0.5 + wet * 0.22, 0.47 + wet * 0.2, 0.4 + wet * 0.16); } });
    const r = c.rng();
    // quicksand patches — leave a readable safe lane that snakes across
    const qs = [];
    for (let z = -36; z > -352; z -= 14) {
      const lane = Math.sin(z * 0.045) * 14; // safe lane centre
      for (let k = 0; k < 3; k++) { const x = (r() - 0.5) * W.half * 1.9; if (Math.abs(x - lane) < 7.5) continue; if (r() < 0.35) continue; qs.push({ x, z: z + (r() - 0.5) * 8, rx: 4 + r() * 4, rz: 3 + r() * 3, deep: r() < 0.45 }); }
      if (z < -60 && z > -330 && r() < 0.5) qs.push({ x: lane + (r() < 0.5 ? -11 : 11), z, rx: 4.5, rz: 3.5, deep: true });
    }
    ST[5].qs = qs;
    const T = c.THREE;
    const qmShallow = new T.MeshStandardMaterial({ color: 0x28221a, roughness: 0.55, metalness: 0.15, transparent: true, opacity: 0.92 });
    const qmDeep = new T.MeshStandardMaterial({ color: 0x1c1710, roughness: 0.4, metalness: 0.22, transparent: true, opacity: 0.95 });
    for (const q of qs) { const m = new T.Mesh(new T.CircleGeometry(1, 22), q.deep ? qmDeep : qmShallow); m.rotation.x = -Math.PI / 2; m.scale.set(q.rx, q.rz, 1); m.position.set(q.x, c.terrainH(q.x, q.z) + 0.07, q.z); c.add(m); }
    for (let i = 0; i < 30; i++) deadTree(c, (r() - 0.5) * W.half * 2, -r() * 360, 0.5 + r() * 0.6);
    scatterFerns(c, 500, 0x8a8468, [90, 85, 60], [100, 95, 70]); scatterRocks(c, 90, 0x4a443a);
    bones(c, 6, -96, 1.8); bones(c, -14, -200, 1.4); bones(c, 10, -310, 2.0); groundMist(c, 40, 'rgba(160,150,130,0.14)', 0.5);
    c.gate(-364, { seal: 0xffb040 });
    // half-sunk warrior statues as landmarks on the safe lane
    for (const z of [-70, -150, -230, -310]) { const lane = Math.sin(z * 0.045) * 14; ruinPillar(c, lane, z, 2.2 + r() * 1.4, true); }
    c.enemy('brute', Math.sin(-352 * 0.045) * 14, -352, { state: 'listen', yaw: 0.1, once: true, gateKeeper: true, opts: { ward: true } });
  },
  onStart(c) { ST[5].m = c.meter(c.L('SINKING', 'மூழ்குது'), '#c9a15c'); ST[5].drain = drainSelf(c, 'sink', 2.6); },
  rules(c) { const l = c.L; return [
    l('Flat, quiet, patient ground — and some of it is hungry. Dark, smooth patches are quicksand.', 'சமமான, அமைதியான, பொறுமையான தரை — அதுல கொஞ்சம் பசியோட இருக்கு. கருப்பா, வழவழப்பா தெரியிற இடங்கள் புதைமணல்.'),
    l('THROW STONES (E) to read the path: if the ground swallows the stone, it will swallow you.', 'கல் எறிஞ்சு (E) வழியை படிங்க: தரை கல்லை விழுங்கினா, உங்களையும் விழுங்கும்.'),
    l('Shallow sand slows you — keep moving to the edge. DEEP sand traps you: your partner must stand close and HOLD E to pull you out. Alone, struggle toward the edge — slowly.', 'ஆழம் இல்லாத மணல் மெதுவாக்கும் — ஓரம் நோக்கி நகருங்க. ஆழமான மணல் மாட்டி வைக்கும்: நண்பர் பக்கத்துல நின்னு E பிடிச்சு இழுக்கணும். தனியா இருந்தா ஓரம் பக்கம் மெல்ல போராடுங்க.'),
    l('The sunken statues stand on the safe lane. Things that chase you here have no fear of the ground — and the ground eats them too.', 'மூழ்கின சிலைகள் பாதுகாப்பான பாதையில நிக்குது. இங்க உங்களை துரத்துறவைக்கு பயம் இல்ல — தரை அவங்களையும் தின்னும்.'),
  ]; },
  intro(c) { const l = c.L; return [
    { at: 0.6, sp: 'MEERA', id: () => l('Father lost four men here in one hour. He wrote: "The statues do not sink. Walk where the kings walk."', 'ஒரே மணி நேரத்துல அப்பா இங்க நாலு பேரை இழந்தார். எழுதினார்: "சிலைகள் மூழ்காது. அரசர்கள் நடக்கிற இடத்துல நட."'), dur: 6.5 },
    { at: 7.5, sp: 'KUMARAN', id: () => l('Stones first. Feet second.', 'முதல்ல கல். அப்புறம்தான் கால்.'), dur: 3 },
  ]; },
  speedMul(c, p) { return 1 - 0.85 * Math.min(1, (p.sink || 0) * 1.3); },
  hook(c, p, dt) {
    const s = ST[5]; let inq = null;
    for (const q of s.qs) { const dx = (p.x - q.x) / q.rx, dz = (p.z - q.z) / q.rz; if (dx * dx + dz * dz < 1) { inq = q; break; } }
    const moving = Math.hypot(inp_move_x(), inp_move_z()) > 0.1;
    if (inq) {
      const solo = !c.partner();
      const cap = inq.deep ? (solo ? 0.9 : 0.95) : 0.72;
      const rate = inq.deep ? (moving && solo ? 0.24 : 0.34) : (moving ? 0.2 : 0.3);
      p.sink = Math.min(cap, (p.sink || 0) + dt * rate);
      if (!s.firstSink && p.sink > 0.2) { s.firstSink = 1; c.cue(() => c.L('It has you — move to the edge, do not stop!', 'மாட்டிட்ட — ஓரத்துக்கு நகரு, நிக்காதே!'), 2.8); }
      if (p.sink > 0.85) s.drain && s.drain(dt);
    } else p.sink = Math.max(0, (p.sink || 0) - dt * 1.4);
  },
  enemyHazard(c, h, dt) { if (h.state === 'dead' || h.state === 'hidden' || h.state === 'sink') return false; for (const q of ST[5].qs) { if (!q.deep) continue; const dx = (h.x - q.x) / q.rx, dz = (h.z - q.z) / q.rz; if (dx * dx + dz * dz < 0.7) { h.state = 'sink'; h.st = 0; c.banner(c.L('THE GROUND TAKES ONE', 'தரை ஒண்ணை எடுத்துக்கிச்சு'), '', 1.8); return true; } } return false; },
  onStoneLand(c, s) { let inq = false; for (const q of ST[5].qs) { const dx = (s.x - q.x) / q.rx, dz = (s.z - q.z) / q.rz; if (dx * dx + dz * dz < 1) { inq = true; break; } } if (inq) { c.sfx('wave', 0.5); c.parts.spawn(s.x, s.y + 0.1, s.z, 10, 0x3a3226, 1.5, 1.2, 0.8, 0.9); s.ttl = 0.7; } else c.sfx('stone', 0.5); },
  hud(c, dt) { const s = ST[5]; const p = c.me(); if (s.m) s.m(p.sink, p.sink > 0.03); c.tint(p.sink > 0.5 ? 'radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(40,32,20,0.6) 100%)' : null); },
  objective(c) { const l = c.L; const p = c.me(); const pt = c.partner(); if (pt && pt.sink > 0.5) return l('YOUR PARTNER IS SINKING — reach them, HOLD E', 'நண்பர் மூழ்குறார் — ஓடிப் போய் E பிடி'); if (p.sink > 0.5) return c.partner() ? l('TRAPPED — your partner must pull you (E)', 'மாட்டிட்டீங்க — நண்பர் இழுக்கணும் (E)') : l('TRAPPED — struggle toward the edge', 'மாட்டிட்டீங்க — ஓரம் நோக்கி போராடு'); return l('Follow the sunken statues. Test with stones.', 'மூழ்கின சிலைகளை பின்தொடர்ந்து போ. கல்லால சோதி.'); },
  waypointFn(c) { const z = c.me().z; const marks = [-70, -150, -230, -310]; for (const mz of marks) { if (mz < z - 4) return [Math.sin(mz * 0.045) * 14, mz, c.L('STATUE', 'சிலை')]; } return [0, -364, c.L('GATE', 'வாசல்')]; },
  update(c, dt) { const s = ST[5]; if (!s.chase && c.isAuth()) { const lead = Math.min(c.me().z, (c.partner() || c.me()).z); if (lead < -160) { s.chase = 1; c.bc('lvlev', { e: 'chase' }); T6._chase(c); } } },
  onEvent(c, m) { if (m.e === 'chase' && !ST[5].chase) { ST[5].chase = 1; T6._chase(c, true); } },
  _chase(c, clientOnly) { c.banner(c.L('THE HUNTERS FOUND YOUR TRAIL', 'வேட்டைக்காரர்கள் தடத்தை கண்டுபிடிச்சிட்டாங்க'), c.L('Lead them into the hungry ground', 'பசியுள்ள தரைக்குள்ள அவங்களை இழுத்துப் போ'), 3); c.audio().drumsSet('tense', 96, 0.9); if (!clientOnly && c.isAuth()) { const z = c.me().z + 16; for (const [t, x] of [['hunter', -6], ['stalker', 4], ['hunter', 10], ['stalker', -12]]) c.spawnNow(t, x, z, 'rise', { alwaysAggro: true }); } },
};
// movement input access for hooks (set each frame by engine input poll)
function inp_move_x() { return window.__inpx || 0; } function inp_move_z() { return window.__inpz || 0; }

// ================= TRIAL VII — THE SILENT CITY =================
const T7 = {
  seed: 866, amb: 'cave', drums: ['heart', 50, 0.25], dynMusic: false,
  name: () => E.st.lang === 'ta' ? 'அமைதி நகரம்' : 'The Silent City',
  tip: () => '',
  bossName: () => E.st.lang === 'ta' ? 'துப்பாக்கி காப்டன்' : 'THE RIFLE CAPTAIN',
  checkpoints: [4, -140, -300],
  build(c) {
    ST[6] = { braz: [], wave: 0 };
    const W = c.W; W.half = 26; W.zMin = -420; W.zMax = 8;
    const nz = c.makeNoise(866);
    c.setTerrain((x, z) => { let h = nz.fbm2(x * 0.05 + 77, z * 0.05 + 77, 3) * 1.2 - 0.5; const edge = Math.max(0, (Math.abs(x) - W.half) / 9); h += edge * edge * 5; if (z < -310) h *= 0.25; return h; });
    c.sky({ fog: 0x101a26, fogD: 0.022, hemiSky: 0x4a6480, hemiGround: 0x0c1218, hemiI: 1.05, sun: 0x9ac0e0, sunI: 1.9, rim: 0x5a80b0, rimI: 0.8, exposure: 1.55, bloom: 0.8 });
    c.ground({ base: '#2a2830', spots: [70, 68, 80], dark: [18, 16, 24], colorFn: (x, z, col) => { const wet = nz.fbm2(x * 0.18, z * 0.18, 2); col.setRGB(0.42 + wet * 0.18, 0.4 + wet * 0.17, 0.48 + wet * 0.2); } });
    const r = c.rng();
    // ruined avenue: pillar rows + arches + rubble
    for (let z = -30; z > -300; z -= 22) { for (const sx of [-1, 1]) { if (r() < 0.85) ruinPillar(c, sx * (9 + r() * 3), z + (r() - 0.5) * 6, 3 + r() * 4, r() < 0.5); } }
    const T = c.THREE;
    for (const z of [-70, -160, -250]) { const m = new T.MeshStandardMaterial({ color: 0x46404a, roughness: 0.95, flatShading: true }); for (const sx of [-5, 5]) { const p = new T.Mesh(new T.BoxGeometry(1.4, 8, 1.4), m); p.position.set(sx, c.terrainH(sx, z) + 4, z); p.castShadow = true; c.add(p); c.addCol(sx, z, 1.1); } const lin = new T.Mesh(new T.BoxGeometry(12, 1.1, 1.6), m); lin.position.set(0, c.terrainH(0, z) + 8.2, z); c.add(lin); }
    scatterRocks(c, 130, 0x3a3640); bones(c, -8, -120, 1.4); bones(c, 10, -220, 1.2);
    groundMist(c, 70, 'rgba(130,100,190,0.16)', 0.45); fireflies(c, 150, 0xb090ff);
    // madness bands
    ST[6].bands = [[-44, -128], [-158, -244], [-262, -302]];
    // braziers of clarity
    for (const [x, z] of [[-6, -60], [8, -100], [-8, -180], [6, -226], [-2, -284]]) {
      const b = brazierObj(c, x, z, false); ST[6].braz.push(b);
      c.inter({ x, z, r: 2.4, hold: 1.2, once: true, label: () => c.L('HOLD E — light the clarity fire', 'E பிடி — தெளிவு தீ ஏத்து'), cb: () => { b.lit = true; b.light(true); c.juice('fire', x, c.terrainH(x, z) + 2, z); c.banner(c.L('THE WHISPERS RETREAT', 'கிசுகிசு பின்வாங்குது'), '', 1.8); } });
    }
    // plaza: low cover walls
    for (const [x, z] of [[-8, -330], [6, -338], [-4, -352], [10, -356], [-12, -346], [2, -366]]) { const wall = new T.Mesh(new T.BoxGeometry(4.2, 1.3, 1), new T.MeshStandardMaterial({ color: 0x44404c, roughness: 1 })); wall.position.set(x, c.terrainH(x, z) + 0.6, z); wall.castShadow = true; c.add(wall); c.addCol(x - 1.4, z, 0.8); c.addCol(x, z, 0.8); c.addCol(x + 1.4, z, 0.8); }
    // the fish shrine at the very end
    { const g = new T.Group(); const y = c.terrainH(0, -400); g.position.set(0, y, -400);
      const plinth = new T.Mesh(new T.BoxGeometry(3, 1.2, 2), new T.MeshStandardMaterial({ color: 0x4a443c, roughness: 0.9 })); plinth.position.y = 0.6; g.add(plinth);
      const fish = new T.Mesh(new T.SphereGeometry(0.7, 10, 8), new T.MeshStandardMaterial({ color: 0xd8b040, roughness: 0.25, metalness: 0.9, emissive: 0x604010 })); fish.scale.set(1.5, 0.8, 0.5); fish.position.y = 1.9; g.add(fish);
      const tail = new T.Mesh(new T.ConeGeometry(0.5, 0.8, 4), new T.MeshStandardMaterial({ color: 0xd8b040, roughness: 0.25, metalness: 0.9 })); tail.rotation.z = Math.PI / 2; tail.position.set(-1.2, 1.9, 0); g.add(tail);
      c.add(g); flamePoint(c, 0, y + 3.4, -400, 0xffd060, 26, 2.8); }
    c.etype('illusion', { hp: 1, speed: 8, scale: 0.95, windup: 0.34, dmg: 1, reach: 2.0, color: 0x241436, emissive: 0x6a30c0, poise: 0, vanish: true, noStealth: true });
    c.etype('gunman', { hp: 6, speed: 5.4, scale: 1.0, windup: 1.05, dmg: 2, reach: 2.0, color: 0x30241a, poise: 1, gun: true, noStealth: true, mask: 0x181410 });
    c.etype('captain', { hp: 34, speed: 5.8, scale: 1.25, windup: 0.9, dmg: 2, reach: 2.4, color: 0x3a2014, poise: 2, gun: true, noStealth: true, boss: true, mask: 0x801818, opts: {},
      onDeath: (cc, h) => T7._ending(cc) });
  },
  onStart(c) { ST[6].m = c.meter(c.L('MADNESS', 'பைத்தியம்'), '#9a60e0'); },
  rules(c) { const l = c.L; return [
    l('The capital of the lost kingdom. Empty — and not. In the purple mist, the city gets INSIDE your head: the madness meter climbs, and what you see stops being true.', 'தொலைஞ்ச ராஜ்யத்தோட தலைநகரம். காலி — ஆனா காலி இல்ல. ஊதா மூடுபனியில நகரம் தலைக்குள்ள வந்துடும்: madness ஏறும், பார்க்கிறது உண்மையா இருக்காது.'),
    l('Light the CLARITY FIRES (hold E) — near a lit fire the whispers cannot reach you. High madness bleeds you.', 'தெளிவு தீயை ஏத்துங்க (E பிடி) — எரியிற தீ பக்கத்துல கிசுகிசு வராது. அதிக madness ரத்தத்தை உறிஞ்சும்.'),
    l('Shapes born of the mist die in one strike. Do not waste dodges on ghosts — but do not let them bite.', 'மூடுபனியில பிறந்த உருவங்கள் ஒரே அடியில சாகும். ஆனா கடிக்க விடாதீங்க.'),
    l('At the plaza: rifles. A red line means someone is aiming down it — DODGE when it steadies, close the gap, and end them up close.', 'மைதானத்துல: துப்பாக்கி. சிவப்புக் கோடு = யாரோ குறி பார்க்கிறாங்க — கோடு நிலைச்சதும் DODGE, நெருங்கி, பக்கத்துலயே முடிங்க.'),
  ]; },
  intro(c) { const l = c.L; return [
    { at: 0.6, sp: 'MEERA', id: () => l('The last page of the notebook is a drawing of this street. And under it, not in my father\'s hand: "TURN BACK. — Appa."', 'Notebook-ஓட கடைசி பக்கம் இந்த தெருவோட படம். அதுக்கு கீழ, அப்பாவோட கையெழுத்து இல்லாம: "திரும்பிப் போ. — அப்பா."'), dur: 6.5 },
    { at: 7.5, sp: 'KUMARAN', id: () => l('Not his hand. Then whose?', 'அவர் கை இல்லன்னா. யாருது?'), dur: 3.5 },
    { at: 11.5, sp: 'SELVAM', id: () => l('The city\'s. Walk, machan. Whatever speaks in there — we do not answer.', 'நகரத்தோது. நட மச்சான். உள்ள எது பேசுனாலும் — நாம பதில் சொல்றது இல்ல.'), dur: 5 },
  ]; },
  speedMul(c, p) { return (p.mad || 0) > 0.85 ? 0.8 : 1; },
  hook(c, p, dt) {
    const s = ST[6]; let inBand = false; for (const [z1, z2] of s.bands) if (p.z < z1 && p.z > z2) { inBand = true; break; }
    let safe = false; for (const b of s.braz) if (b.lit && Math.hypot(b.x - p.x, b.z - p.z) < 16) { safe = true; break; }
    p.mad = U.clamp((p.mad || 0) + dt * (inBand && !safe ? 0.10 : -0.16), 0, 1);
    if (p.mad > 0.85) { s.drain = s.drain || drainSelf(c, 'mad', 4); s.drain(dt); }
  },
  hud(c, dt) {
    const s = ST[6]; const p = c.me(); const m = p.mad || 0;
    if (s.m) s.m(m, m > 0.03);
    c.roll(Math.sin(c.G.t * 1.7) * 0.07 * m);
    c.filter(m > 0.15 ? `hue-rotate(${(m * 50) | 0}deg) contrast(${1 + m * 0.15}) brightness(${1 - m * 0.12})` : null);
    c.tint(m > 0.3 ? `radial-gradient(ellipse at center, rgba(0,0,0,0) ${60 - m * 25}%, rgba(90,40,160,${0.25 + m * 0.3}) 100%)` : null);
    if (m > 0.6 && Math.random() < dt * 0.5) c.sfx('creak', 0.25);
    if (!s.madCue && m > 0.5) { s.madCue = 1; c.cue(() => c.L('That is not my voice. Find fire. FIND FIRE.', 'அது என் குரல் இல்ல. தீயை தேடு. தீயை தேடு.'), 3); }
    if (m < 0.2) s.madCue = 0;
  },
  objective(c) { const l = c.L; const s = ST[6]; if (s.phase >= 1 && !s.done) return l('KILL THE RIFLEMEN — close the distance', 'துப்பாக்கிக்காரர்களை முடி — நெருங்கிப் போ'); if ((c.me().mad || 0) > 0.5) return l('MADNESS RISING — reach a clarity fire', 'பைத்தியம் ஏறுது — தெளிவு தீயை அடை'); return l('Walk the dead avenue. Light the fires. Reach the plaza.', 'செத்த தெருவுல நட. தீ ஏத்து. மைதானத்தை அடை.'); },
  waypointFn(c) { const s = ST[6]; if (s.phase >= 1) return null; const p = c.me(); if ((p.mad || 0) > 0.45) { let best = null, bd = 1e9; for (const b of s.braz) { if (b.lit) continue; const d = Math.hypot(b.x - p.x, b.z - p.z); if (d < bd) { bd = d; best = b; } } if (best) return [best.x, best.z, c.L('FIRE', 'தீ')]; } return [0, -340, c.L('PLAZA', 'மைதானம்')]; },
  update(c, dt) {
    const s = ST[6];
    // storm lightning (local visual, both sides)
    s.lit = (s.lit == null ? 4 : s.lit) - dt;
    if (s.lit <= 0) { s.lit = 5 + Math.random() * 9; const el = document.getElementById('lit'); if (el) { el.style.opacity = 0.85; setTimeout(() => el.style.opacity = 0.25, 70); setTimeout(() => el.style.opacity = 0.6, 140); setTimeout(() => el.style.opacity = 0, 230); } c.shake(0.25); setTimeout(() => c.sfx('thud', 0.35), 500 + Math.random() * 900); }
    if (!c.isAuth()) return;
    // illusion pressure
    s.illT = (s.illT || 0) - dt;
    if (s.illT <= 0) { s.illT = 5; for (const p of c.players()) { if ((p.mad || 0) > 0.5) { const alive = c.hunters().filter(h => h.type === 'illusion' && h.state !== 'dead').length; if (alive < 3) { const a = Math.random() * 6.28; c.spawnNow('illusion', p.x + Math.cos(a) * 10, p.z + Math.sin(a) * 10, 'rise'); } } } }
    // plaza phases
    const lead = Math.min(c.me().z, (c.partner() || c.me()).z);
    if (!s.phase && lead < -312) {
      s.phase = 1; c.bc('lvlev', { e: 'guns' }); T7._guns(c);
      for (const [x, z] of [[-7, -336], [5, -344], [12, -334]]) c.spawnNow('gunman', x, z, 'rise', { cd: 2.8 });
    } else if (s.phase === 1) {
      const alive = c.hunters().filter(h => (h.type === 'gunman' || h.type === 'captain') && h.state !== 'dead').length;
      if (alive === 0) { s.phase = 2; c.bc('lvlev', { e: 'captain' }); T7._captain(c); c.spawnNow('captain', 0, -358, 'rise', { cd: 2.0, ward: true }); for (const [x, z] of [[-10, -350], [10, -352]]) c.spawnNow('gunman', x, z, 'rise', { cd: 3.0 }); }
    }
  },
  onEvent(c, m) { if (m.e === 'guns') T7._guns(c); else if (m.e === 'captain') T7._captain(c); else if (m.e === 'ending') T7._endScript(c); },
  _guns(c) { ST[6].phase = ST[6].phase || 1; c.banner(c.L("YAZHINI'S RIFLEMEN", 'யாழினியின் துப்பாக்கிப் படை'), c.L('Old walls against new guns', 'புது துப்பாக்கிக்கு எதிரா பழைய சுவர்கள்'), 3.2); c.audio().drumsSet('war', 116, 1.1); c.script([{ at: 0.5, sp: 'YAZHINI', id: () => c.L('The fish came home by itself. Kill the escort.', 'மீன் தானா வீட்டுக்கு வந்துடுச்சு. கூட வந்தவங்களை முடிங்க.'), dur: 4.5 }]); },
  _captain(c) { ST[6].phase = 2; c.banner(c.L('THE RIFLE CAPTAIN', 'துப்பாக்கி காப்டன்'), '', 3); c.audio().horn(44, 4, 0.5); },
  _ending(c) {
    const s = ST[6]; if (s.done) return; s.done = true;
    if (c.isAuth()) c.bc('lvlev', { e: 'ending' });
    T7._endScript(c);
    setTimeout(() => c.complete(), 16000);
  },
  _endScript(c) {
    const s = ST[6]; s.done = true; const l = c.L;
    c.audio().drumsStop(); c.audio().horn(52, 8, 0.4);
    c.script([
      { at: 1.5, sp: 'YAZHINI', id: () => l('Enough. Look at what you are bleeding for, boatman. A dead kingdom and a golden fish.', 'போதும். எதுக்காக ரத்தம் சிந்துறன்னு பாரு, படகோட்டி. செத்த ராஜ்யம், ஒரு தங்க மீன்.'), dur: 6 },
      { at: 8, sp: 'KUMARAN', id: () => l('Not for the fish. For the ones still breathing behind that shrine.', 'மீனுக்காக இல்ல. அந்த சன்னதிக்கு பின்னாடி இன்னும் மூச்சு விடுறவங்களுக்காக.'), dur: 5.5 },
      { at: 14, sp: 'MEERA', id: () => l('Kumaran… there is a child. A child with your mark.', 'கும்ரா… ஒரு குழந்தை. உன் முத்திரையோட ஒரு குழந்தை.'), dur: 5 },
      { at: 19.5, sp: 'SELVAM', id: () => l('Then we are not done walking, machan.', 'அப்போ நம்ம நடை இன்னும் முடியல, மச்சான்.'), dur: 4 },
    ]);
  },
};

// ================= interludes (shown after each trial) =================
const INTERLUDES = [
  { title: () => E.st.lang === 'ta' ? 'கரை எங்களை விட்டுச்சு' : 'The shore let us go',
    text: () => E.st.lang === 'ta' ? 'ஆழி எங்களுக்கு பின்னாடி கத்திட்டே இருந்தது — தண்ணி வரைக்கும்தான். மீரா notebook-ஐ கட்டி பிடிச்சிட்டு சொன்னாள்: "அடுத்தது ஒரு ஊர். அப்பா அதை பத்தி எழுதும்போது கை நடுங்கிருக்கு."' : 'Aazhi roared behind us all the way to the tide line — and no further. Meera held the notebook tight: "Next is a village. When my father wrote about it, his hand was shaking."' },
  { title: () => E.st.lang === 'ta' ? 'யாரும் திரும்பி பார்க்கல' : 'No one looked back',
    text: () => E.st.lang === 'ta' ? 'ஊர் எல்லை தாண்டினதும் அவங்க சிலை மாதிரி ஆயிட்டாங்க. செல்வம் ரொம்ப நேரம் பேசல. அப்புறம்: "காட்டுக்குள்ள கண் இல்லாதவங்க இருக்காங்களாம். பரவாயில்ல. கண் இருக்கிறவங்களை விட மேல்."' : 'Past the village boundary they turned still as stones again. Selvam was quiet a long time. Then: "They say the ones in the forest have no eyes. Good. Better than the ones with faces."' },
  { title: () => E.st.lang === 'ta' ? 'காடு அமைதியாச்சு' : 'The forest went quiet',
    text: () => E.st.lang === 'ta' ? 'மூத்தவன் விழுந்தப்போ காடே மூச்சு விட்ட மாதிரி இருந்தது. மீரா கல் வாசல்ல ஒரு பெயரை தடவிப் பார்த்தாள் — அவள் அப்பா அங்க தன் பெயரை செதுக்கியிருந்தார். "அவர் இந்த வரைக்கும் வந்திருக்கார். இன்னும் தூரம் போவோம்."' : 'When the Elder fell, the whole forest seemed to exhale. At the stone gate Meera traced a name carved low — her father\'s. "He made it this far. We go further."' },
  { title: () => E.st.lang === 'ta' ? 'புலி முத்திரை' : 'The tiger mark',
    text: () => E.st.lang === 'ta' ? 'சன்னதி வெளிச்சம் அணைஞ்சதும் யாரும் பேசல. ஒரு படகோட்டியோட முதுகுல ஒரு ராஜ்யத்தோட முத்திரை. குமரன் மட்டும் சிரிச்சான்: "சரி. அப்போ ராஜா பசியோட இருக்கார். நடங்க."' : 'When the shrine light faded, nobody spoke. A kingdom\'s seal on a boatman\'s back. Only Kumaran laughed: "Fine. Then the king is hungry. Walk."' },
  { title: () => E.st.lang === 'ta' ? 'பசி முடிஞ்சது' : 'The hunger ended',
    text: () => E.st.lang === 'ta' ? 'பீடபூமியோட கடைசி மேட்டுல மழை மேகம் தெரிஞ்சது. மீரா சொன்னாள்: "இனிமே தண்ணி பிரச்சனை இல்ல. இனிமே தரைதான் பிரச்சனை. அப்பா எழுதிருக்கார்: நிக்கிற இடத்தை நம்பாதே."' : 'From the last rise of the plateau we saw rain clouds. Meera said: "Water is no longer the problem. Now the problem is the ground itself. Father wrote: trust nothing you stand on."' },
  { title: () => E.st.lang === 'ta' ? 'தரை பசியோட இருந்தது' : 'The ground was hungry',
    text: () => E.st.lang === 'ta' ? 'எங்களை துரத்தினவங்களை தரையே தின்னுச்சு. செல்வம் திரும்பி பார்த்து சொன்னான்: "நகரம் தெரியுது, மச்சான். விளக்கே இல்லாத நகரம்." மீரா notebook-ஓட கடைசி பக்கத்தை திறந்தாள்.' : 'The ground ate the men who chased us. Selvam looked back once: "I can see the city, machan. A city with no lamps." Meera opened the notebook\'s final page.' },
  { title: () => E.st.lang === 'ta' ? 'பயணம் தொடரும்' : 'The journey continues',
    text: () => E.st.lang === 'ta' ? 'சன்னதிக்கு பின்னாடி, செத்த நகரத்தோட இதயத்துல — உயிரோட ஒரு குழந்தை. முதுகுல புலி முத்திரை. யாழினி துப்பாக்கிகளோட திரும்பி வருவாள். கடல் தாண்டி பழைய ரத்தம் இன்னும் காத்திருக்கு.\n\nகுமரன் குழந்தையை தூக்கிட்டான். "படகு எங்க?"\n\n— புலியும் மீனும்: முதல் பயணம் முடிந்தது —' : 'Behind the shrine, in the heart of the dead city — a living child. A tiger mark on its small back. Yazhini will return with more rifles. Across the sea, old blood still waits.\n\nKumaran lifted the child. "Where is my boat?"\n\n— THE TIGER AND THE FISH: the first journey ends —' },
];

const LEVELS = [T1, T2, T3, T4, T5, T6, T7];
export { LEVELS, INTERLUDES };
