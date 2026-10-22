// The Talaqa object set. Every icon is modelled here from primitives and
// real glyph outlines, then rendered by lib.shoot() — nothing is traced
// from stock art. Builders return { obj, view } where view tunes the shot.
import { THREE, C, mat, mesh, group, rbox, lathe, smoothLathe, tube, roundedRect, extrude, text3d } from './lib.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Brass wire along every hard edge of `geo` — the cloisonné frame. */
function wireEdges(geo, radius, material, threshold = 12) {
  const edges = new THREE.EdgesGeometry(geo, threshold);
  const pos = edges.attributes.position;
  const parts = [];
  const verts = new Map();
  for (let i = 0; i < pos.count; i += 2) {
    const a = V(0, 0, 0).fromBufferAttribute(pos, i);
    const b = V(0, 0, 0).fromBufferAttribute(pos, i + 1);
    const len = a.distanceTo(b);
    if (len < 1e-4) continue;
    const m = mesh(new THREE.CylinderGeometry(radius, radius, len, 12, 1, true), material);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    parts.push(m);
    for (const v of [a, b]) verts.set(v.toArray().map((x) => x.toFixed(3)).join(), v);
  }
  for (const v of verts.values()) parts.push(mesh(new THREE.SphereGeometry(radius * 1.35, 16, 12), material, { pos: v.toArray() }));
  return parts;
}

/* ---------------- level gems: facets grow with the level ---------------- */

function brilliant(r = 1, facets = 12) {
  return lathe(
    [
      [0, -1.0 * r],
      [0.98 * r, -0.12 * r],
      [1.0 * r, 0],
      [0.64 * r, 0.4 * r],
      [0, 0.4 * r],
    ],
    facets,
  );
}

const LEVELS = {
  A1: () => new THREE.TetrahedronGeometry(1.1, 0),
  A2: () => new THREE.BoxGeometry(1.1, 1.1, 1.1),
  B1: () => new THREE.OctahedronGeometry(1.1, 0),
  B2: () => new THREE.DodecahedronGeometry(1.0, 0),
  C1: () => new THREE.IcosahedronGeometry(1.0, 0),
  C2: () => brilliant(1.0, 12),
};
const LEVEL_COLOR = { A1: C.jade, A2: C.verdigris, B1: C.cobalt, B2: C.amethyst, C1: C.garnet, C2: '#22314f' };
const LEVEL_ROT = { A1: [-0.5, 0.5, 0.25], A2: [0.55, 0.7, 0.1], B1: [0.15, 0.45, 0.12], B2: [0.45, 0.3, 0], C1: [0.3, 0.2, 0.15], C2: [0.12, 0.2, 0.08] };

function levelGem(level) {
  const geo = LEVELS[level]();
  const enamel = mat.lacquer(LEVEL_COLOR[level], { flatShading: true, roughness: 0.2, clearcoatRoughness: 0.03, sheen: 0.2 });
  const g = group(mesh(geo, enamel), wireEdges(geo, level === 'C2' ? 0.022 : 0.03, mat.brass()));
  g.rotation.set(...LEVEL_ROT[level]);
  return { obj: g, view: { el: level === 'C2' ? 12 : 18, fill: 0.74, shadow: 0.2 } };
}

/* ---------------- sections ---------------- */

function astrolabe() {
  const brass = mat.brass();
  const mater = mesh(new THREE.CylinderGeometry(1, 1, 0.12, 96), brass, { rot: [PI / 2, 0, 0] });
  const limb = mesh(new THREE.TorusGeometry(1.0, 0.07, 20, 120), brass);
  const plate = mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.03, 96), mat.lacquer(C.night), { pos: [0, 0, 0.07], rot: [PI / 2, 0, 0] });
  const ticks = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * PI * 2;
    ticks.push(mesh(new THREE.BoxGeometry(0.018, i % 6 ? 0.06 : 0.11, 0.02), brass, { pos: [Math.sin(a) * 0.82, Math.cos(a) * 0.82, 0.1], rot: [0, 0, -a] }));
  }
  const rete = [
    mesh(new THREE.TorusGeometry(0.62, 0.022, 12, 96), brass, { pos: [0, 0, 0.11] }),
    mesh(new THREE.TorusGeometry(0.46, 0.026, 12, 96), brass, { pos: [0.05, 0.18, 0.12] }),
    mesh(new THREE.TorusGeometry(0.26, 0.018, 12, 64), brass, { pos: [0, 0, 0.12] }),
  ];
  const stars = [0.4, 1.3, 2.5, 3.6, 4.4, 5.5].map((a, i) =>
    mesh(new THREE.ConeGeometry(0.035, 0.18, 12), brass, { pos: [Math.sin(a) * (0.66 + (i % 2) * 0.08), Math.cos(a) * (0.66 + (i % 2) * 0.08), 0.13], rot: [0, 0, -a + PI] }),
  );
  const rule = mesh(rbox(1.84, 0.075, 0.03, 0.012), brass, { pos: [0, 0, 0.16], rot: [0, 0, 0.6] });
  const pin = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 32), mat.lacquer(C.garnet), { pos: [0, 0, 0.19], rot: [PI / 2, 0, 0] });
  const throne = mesh(rbox(0.32, 0.2, 0.1, 0.04), brass, { pos: [0, 1.08, 0] });
  const shackle = mesh(new THREE.TorusGeometry(0.14, 0.035, 16, 48), brass, { pos: [0, 1.3, 0] });
  const g = group(mater, limb, plate, ticks, rete, stars, rule, pin, throne, shackle);
  g.rotation.set(-0.12, 0.42, 0.05);
  return { obj: g, view: { az: -18, el: 8, env: 'warm' } };
}

function books() {
  const book = (w, h, d, color, y, rotY) => {
    const cover = mesh(rbox(w, h, d, 0.045), mat.lacquer(color));
    const pages = mesh(rbox(w * 0.97, h * 0.74, d * 0.95, 0.015), mat.paper(), { pos: [0.035, 0, 0] });
    const bands = [0.13, 0.23].map((x) => mesh(rbox(0.04, h * 1.03, d * 1.02, 0.01), mat.brass(), { pos: [-w / 2 + x, 0, 0] }));
    const b = group(cover, pages, bands);
    b.position.y = y;
    b.rotation.y = rotY;
    return b;
  };
  const g = group(book(1.9, 0.34, 1.3, C.night, 0, 0.05), book(1.75, 0.3, 1.2, C.sage, 0.33, -0.14), book(1.6, 0.28, 1.12, C.garnet, 0.62, 0.1));
  return { obj: g, view: { az: -38, el: 26 } };
}

function cards() {
  const card = (rotZ, z, top) => {
    const face = mesh(rbox(1.5, 1.0, 0.05, 0.08), mat.porcelain());
    const back = mesh(rbox(1.56, 1.06, 0.03, 0.1), mat.brass(), { pos: [0, 0, -0.03] });
    const parts = [face, back];
    if (top) {
      const aa = text3d('bodoni', 'Aa', 0.42, 0.05, mat.lacquer(C.night));
      aa.position.set(0, 0.05, 0.05);
      const rule = mesh(rbox(0.5, 0.025, 0.02, 0.01), mat.brass(), { pos: [0, -0.28, 0.035] });
      parts.push(aa, rule);
    }
    const c = group(parts);
    const pivot = group(c);
    c.position.set(0, 0.45, z);
    pivot.rotation.z = rotZ;
    return pivot;
  };
  const g = group(card(0.42, -0.12, false), card(0.16, -0.06, false), card(-0.12, 0, true));
  g.rotation.x = -0.35;
  return { obj: g, view: { az: -14, el: 20 } };
}

function metronome() {
  const h = 1.9;
  const body = mesh(new THREE.CylinderGeometry(0.3, 0.8, h, 4, 1), mat.lacquer(C.night, { flatShading: true }), { rot: [0, PI / 4, 0] });
  const tilt = Math.atan((0.8 * Math.SQRT1_2 - 0.3 * Math.SQRT1_2) / h);
  const trap = new THREE.Shape();
  trap.moveTo(-0.42, -0.72);
  trap.lineTo(0.42, -0.72);
  trap.lineTo(0.16, 0.7);
  trap.lineTo(-0.16, 0.7);
  trap.closePath();
  const face = mesh(extrude(trap, 0.02, 0.008), mat.porcelain(), { pos: [0, -0.02, (0.8 + 0.3) * Math.SQRT1_2 * 0.5 + 0.005], rot: [-tilt, 0, 0] });
  const scale = [];
  for (let i = 0; i < 9; i++) {
    const y = -0.15 + i * 0.09;
    const z = (0.8 + 0.3) * Math.SQRT1_2 * 0.5 + 0.03 - Math.tan(tilt) * y;
    scale.push(mesh(new THREE.BoxGeometry(i % 2 ? 0.07 : 0.12, 0.012, 0.01), mat.lacquer(C.night), { pos: [0.16, y, z], rot: [-tilt, 0, 0] }));
  }
  const arm = group(
    mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.45, 16), mat.brass(), { pos: [0, 0.72, 0] }),
    mesh(rbox(0.2, 0.15, 0.09, 0.03), mat.brass(), { pos: [0, 0.98, 0] }),
  );
  arm.position.set(0, -0.62, (0.8 + 0.3) * Math.SQRT1_2 * 0.5 + 0.12);
  arm.rotation.set(-tilt, 0, 0.38);
  const plinth = mesh(rbox(1.36, 0.16, 1.36, 0.04), mat.brass(), { pos: [0, -h / 2 - 0.08, 0] });
  const g = group(body, face, scale, arm, plinth);
  return { obj: g, view: { az: -26, el: 14 } };
}

function microphone() {
  const head = mesh(new THREE.CapsuleGeometry(0.42, 0.5, 16, 64), mat.brass({ roughness: 0.5 }), { pos: [0, 0.62, 0] });
  const grille = [];
  for (let i = 0; i < 11; i++) {
    const y = 0.4 + i * 0.045;
    grille.push(mesh(new THREE.TorusGeometry(0.426, 0.007, 8, 72), mat.lacquer(C.ink), { pos: [0, y, 0], rot: [PI / 2, 0, 0] }));
  }
  for (let i = 0; i < 6; i++) {
    const phi = 0.2 + i * 0.22;
    const r = 0.426 * Math.sin(phi + 0.15);
    const y = 0.87 + 0.426 * Math.cos(phi + 0.15);
    grille.push(mesh(new THREE.TorusGeometry(r, 0.007, 8, 72), mat.lacquer(C.ink), { pos: [0, y, 0], rot: [PI / 2, 0, 0] }));
  }
  const band = mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.16, 72), mat.lacquer(C.night), { pos: [0, 0.32, 0] });
  const body = mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.75, 72), mat.lacquer(C.night), { pos: [0, -0.12, 0] });
  const ring = mesh(new THREE.TorusGeometry(0.31, 0.03, 12, 64), mat.brass(), { pos: [0, -0.5, 0], rot: [PI / 2, 0, 0] });
  const tail = mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.2, 72), mat.lacquer(C.night), { pos: [0, -0.6, 0] });
  const g = group(head, grille, band, body, ring, tail);
  g.rotation.set(0.12, 0, -0.32);
  return { obj: g, view: { el: 14 } };
}

function openBook() {
  const W = 1.05;
  const D = 1.45;
  const page = (side) => {
    const geo = new THREE.PlaneGeometry(W, D, 32, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + W / 2; // 0 at spine → W at edge
      const t = x / W;
      p.setZ(i, 0.16 * Math.sin(Math.min(1, t * 1.6) * PI * 0.5) - 0.05 * t * t);
    }
    geo.computeVertexNormals();
    geo.rotateX(-PI / 2);
    geo.translate(W / 2, 0, 0);
    const m = mesh(geo, mat.paper({ side: THREE.DoubleSide }));
    const block = mesh(rbox(W * 0.98, 0.12, D * 0.98, 0.02), mat.paper(), { pos: [W / 2, -0.07, 0] });
    const lines = [];
    for (let i = 0; i < 7; i++) {
      const len = i === 6 ? 0.36 : 0.7;
      lines.push(mesh(new THREE.BoxGeometry(len, 0.004, 0.022), mat.lacquer(C.night, { roughness: 0.6 }), { pos: [0.18 + len / 2, 0.19 - 0.012, -0.48 + i * 0.13] }));
    }
    const s = group(m, block, lines);
    s.rotation.z = side * 0.16;
    if (side < 0) s.scale.x = -1;
    return s;
  };
  const cover = (side) => {
    const c = mesh(rbox(W * 1.06, 0.05, D * 1.08, 0.02), mat.lacquer(C.garnet), { pos: [(W * 1.06) / 2, -0.15, 0] });
    const s = group(c);
    s.rotation.z = side * 0.16;
    if (side < 0) s.scale.x = -1;
    return s;
  };
  const ribbon = mesh(rbox(0.08, 0.01, 0.9, 0.004), mat.lacquer(C.sage), { pos: [0.04, 0.0, 0.95], rot: [0.6, 0, 0] });
  const g = group(page(1), page(-1), cover(1), cover(-1), ribbon);
  return { obj: g, view: { az: -8, el: 42 } };
}

function arch() {
  const parts = [];
  const n = 7;
  const gap = 0.025;
  for (let i = 0; i < n; i++) {
    const a0 = PI - (i / n) * PI - gap;
    const a1 = PI - ((i + 1) / n) * PI + gap;
    const s = new THREE.Shape();
    const ri = 0.62;
    const ro = 1.02;
    s.moveTo(Math.cos(a0) * ri, Math.sin(a0) * ri);
    s.lineTo(Math.cos(a0) * ro, Math.sin(a0) * ro);
    s.absarc(0, 0, ro, a0, a1, true);
    s.lineTo(Math.cos(a1) * ri, Math.sin(a1) * ri);
    s.absarc(0, 0, ri, a1, a0, false);
    const keystone = i === 3;
    parts.push(mesh(extrude(s, 0.5, 0.02), keystone ? mat.brass() : mat.porcelain(), { pos: [0, 0.6, -0.25] }));
  }
  for (const x of [-0.82, 0.82]) parts.push(mesh(rbox(0.4, 0.6, 0.5, 0.03), mat.porcelain(), { pos: [x, 0.28, 0] }));
  parts.push(mesh(rbox(2.3, 0.16, 0.8, 0.04), mat.lacquer(C.night), { pos: [0, -0.1, 0] }));
  return { obj: group(parts), view: { az: -28, el: 16 } };
}

function tiles() {
  const tile = (glyphFont, ch, letterMat, size) => {
    const body = mesh(rbox(1.05, 1.05, 0.36, 0.13), mat.porcelain());
    const letter = text3d(glyphFont, ch, size, 0.08, letterMat);
    letter.position.z = 0.2;
    return group(body, letter);
  };
  const a = tile('bodoni', 'A', mat.lacquer(C.night), 0.66);
  a.position.set(-0.52, 0, 0.1);
  a.rotation.set(-0.06, 0.3, 0.07);
  const b = tile('kufam', 'ب', mat.brass(), 0.5);
  b.position.set(0.56, 0.24, -0.3);
  b.rotation.set(-0.04, -0.22, -0.09);
  return { obj: group(a, b), view: { az: -10, el: 12 } };
}

function seal() {
  const geo = smoothLathe([[0, 0.2], [0.82, 0.2], [0.97, 0.13], [1.0, 0.02], [0.94, -0.06], [0, -0.06]], 160, 30);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.7) continue;
    const a = Math.atan2(z, x);
    const k = 1 + (0.05 * Math.sin(5 * a + 1) + 0.03 * Math.sin(9 * a + 2) + 0.02 * Math.sin(17 * a)) * ((r - 0.7) / 0.3);
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  const wax = mat.lacquer(C.wax, { roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const blob = mesh(geo, wax);
  const ring = mesh(new THREE.TorusGeometry(0.64, 0.03, 12, 96), mat.brass(), { pos: [0, 0.2, 0], rot: [PI / 2, 0, 0] });
  const glyph = text3d('kufam', 'ط', 0.8, 0.06, mat.brass(), 0.015);
  glyph.rotation.x = -PI / 2;
  glyph.position.y = 0.24;
  const g = group(blob, ring, glyph);
  g.rotation.set(1.05, 0, 0);
  return { obj: g, view: { az: -6, el: 16 } };
}

function compass() {
  const brass = mat.brass();
  const caseGeo = smoothLathe([[0, -0.12], [0.92, -0.12], [1.02, -0.05], [1.02, 0.08], [0.95, 0.13], [0.9, 0.06], [0, 0.06]], 120, 40);
  const body = mesh(caseGeo, brass);
  const dial = mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.02, 96), mat.porcelain(), { pos: [0, 0.07, 0] });
  const rose = new THREE.Shape();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * PI * 2;
    const r = i % 4 === 0 ? 0.72 : i % 2 === 0 ? 0.44 : 0.16;
    const x = Math.sin(a) * r;
    const y = Math.cos(a) * r;
    if (i === 0) rose.moveTo(x, y);
    else rose.lineTo(x, y);
  }
  rose.closePath();
  const roseM = mesh(extrude(rose, 0.01, 0.004), mat.lacquer(C.sage), { pos: [0, 0.085, 0], rot: [-PI / 2, 0, 0] });
  const ticks = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * PI * 2;
    ticks.push(mesh(new THREE.BoxGeometry(0.012, 0.01, i % 4 ? 0.05 : 0.1), mat.lacquer(C.night), { pos: [Math.sin(a) * 0.79, 0.085, Math.cos(a) * 0.79], rot: [0, a, 0] }));
  }
  const needle = (color, dir) => mesh(new THREE.OctahedronGeometry(1, 0), mat.lacquer(color, { flatShading: true }), { pos: [0, 0.13, dir * 0.33], scale: [0.09, 0.03, 0.34] });
  const hub = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 32), brass, { pos: [0, 0.15, 0] });
  const bow = mesh(new THREE.TorusGeometry(0.17, 0.04, 16, 48), brass, { pos: [0, 0, -1.18], rot: [0, 0, 0] });
  const stem = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 32), brass, { pos: [0, 0, -1.04], rot: [PI / 2, 0, 0] });
  const needles = group(needle(C.garnet, 1), needle(C.night, -1));
  needles.rotation.y = 0.7;
  const g = group(body, dial, roseM, ticks, needles, hub, bow, stem);
  g.rotation.set(0.62, 0.3, 0);
  return { obj: g, view: { az: -12, el: 26 } };
}

function headphones() {
  const brass = mat.brass();
  const band = mesh(new THREE.TorusGeometry(1.0, 0.07, 24, 120, PI), brass);
  const pad = mesh(new THREE.TorusGeometry(0.95, 0.07, 20, 100, PI * 0.6), mat.lacquer(C.leather, { roughness: 0.62, clearcoat: 0.2 }), { rot: [0, 0, PI * 0.2] });
  pad.scale.z = 1.6;
  const cup = (side) => {
    const shell = mesh(new THREE.CylinderGeometry(0.42, 0.4, 0.3, 72), mat.lacquer(C.night), { rot: [0, 0, PI / 2] });
    const cushion = mesh(new THREE.TorusGeometry(0.33, 0.11, 24, 72), mat.lacquer(C.leather, { roughness: 0.6, clearcoat: 0.15 }), { pos: [-side * 0.17, 0, 0], rot: [0, PI / 2, 0] });
    const ring = mesh(new THREE.TorusGeometry(0.33, 0.028, 12, 72), brass, { pos: [side * 0.16, 0, 0], rot: [0, PI / 2, 0] });
    const cap = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 64), mat.lacquer(C.garnet), { pos: [side * 0.16, 0, 0], rot: [0, 0, PI / 2] });
    const fork = mesh(new THREE.TorusGeometry(0.45, 0.03, 12, 64, PI), brass, { rot: [PI / 2, PI / 2, 0], pos: [0, 0.02, 0] });
    const c = group(shell, cushion, ring, cap, fork);
    c.position.set(side * 1.0, -0.12, 0);
    return c;
  };
  const g = group(band, pad, cup(1), cup(-1));
  g.rotation.set(0.1, 0.55, 0);
  return { obj: g, view: { az: -16, el: 12 } };
}

/* ---------------- learning modes ---------------- */

function bubbles() {
  const bubble = (w, h, tailSide) => {
    const s = roundedRect(w, h, 0.32);
    const t = new THREE.Shape();
    const x = tailSide * (w / 2 - 0.45);
    t.moveTo(x - 0.16, -h / 2 + 0.05);
    t.lineTo(x + tailSide * 0.3, -h / 2 - 0.32);
    t.lineTo(x + 0.16, -h / 2 + 0.05);
    t.closePath();
    return [s, t];
  };
  const a = mesh(extrude(bubble(1.5, 1.0, -1), 0.22, 0.06), mat.lacquer(C.sage));
  const b = mesh(extrude(bubble(1.35, 0.9, 1), 0.2, 0.06), mat.porcelain());
  const dots = (m, color, z) => [-0.32, 0, 0.32].map((x) => mesh(new THREE.SphereGeometry(0.085, 32, 16), color, { pos: [x, 0, z], scale: [1, 1, 0.5] }));
  const ga = group(a, dots(a, mat.porcelain(), 0.29));
  ga.position.set(-0.36, -0.28, 0.25);
  const gb = group(b, dots(b, mat.brass(), 0.27));
  gb.position.set(0.42, 0.42, -0.25);
  const g = group(ga, gb);
  g.rotation.set(-0.05, 0.28, 0);
  return { obj: g, view: { az: -10, el: 10 } };
}

function tuningFork() {
  const brass = mat.brass();
  const fork = mesh(
    tube(
      [
        [-0.26, 1.7, 0],
        [-0.26, 0.9, 0],
        [-0.25, 0.45, 0],
        [-0.15, 0.2, 0],
        [0, 0.14, 0],
        [0.15, 0.2, 0],
        [0.25, 0.45, 0],
        [0.26, 0.9, 0],
        [0.26, 1.7, 0],
      ],
      0.075,
      { tubular: 160 },
    ),
    brass,
  );
  const caps = [-0.26, 0.26].map((x) => mesh(new THREE.SphereGeometry(0.075, 24, 16), brass, { pos: [x, 1.7, 0] }));
  const stem = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 32), brass, { pos: [0, -0.3, 0] });
  const knob = mesh(new THREE.SphereGeometry(0.13, 32, 24), mat.lacquer(C.night), { pos: [0, -0.8, 0] });
  const waves = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const r = 0.32 + i * 0.2;
      const arc = mesh(new THREE.TorusGeometry(r, 0.022, 12, 64, PI / 2.6), mat.lacquer(C.sage, { emissive: C.sage, emissiveIntensity: 0.25 }), {
        pos: [side * 0.26, 1.25, 0],
        rot: [0, 0, side > 0 ? -PI / 5.2 : PI - PI / 5.2],
      });
      waves.push(arc);
    }
  }
  const g = group(fork, caps, stem, knob, waves);
  g.rotation.set(0, 0.25, -0.18);
  return { obj: g, view: { az: -8, el: 8 } };
}

function vinyl() {
  const sleeve = mesh(rbox(2.0, 2.0, 0.05, 0.03), mat.porcelain(), { pos: [-0.38, 0, -0.08] });
  const print = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.01, 64), mat.lacquer(C.garnet), { pos: [-0.75, 0.42, -0.05], rot: [PI / 2, 0, 0] });
  const stripe = mesh(rbox(1.2, 0.07, 0.01, 0.01), mat.brass(), { pos: [-0.5, -0.6, -0.05] });
  const disc = mesh(new THREE.CylinderGeometry(1, 1, 0.035, 128), mat.lacquer(C.ink, { roughness: 0.3, clearcoatRoughness: 0.12 }), { rot: [PI / 2, 0, 0] });
  const grooves = [];
  for (let i = 0; i < 9; i++) grooves.push(mesh(new THREE.TorusGeometry(0.42 + i * 0.06, 0.003, 6, 128), mat.lacquer('#26324a'), { pos: [0, 0, 0.019] }));
  const label = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 96), mat.lacquer(C.sage), { rot: [PI / 2, 0, 0] });
  const spindle = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.07, 24), mat.brass(), { rot: [PI / 2, 0, 0] });
  const record = group(disc, grooves, label, spindle);
  record.position.set(0.45, 0, 0.02);
  const g = group(sleeve, print, stripe, record);
  g.rotation.set(-0.1, 0.42, 0.05);
  return { obj: g, view: { az: -16, el: 10 } };
}

function stopwatch() {
  const brass = mat.brass();
  const caseM = mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.28, 96), brass, { rot: [PI / 2, 0, 0] });
  const bezel = mesh(new THREE.TorusGeometry(0.88, 0.06, 20, 120), brass, { pos: [0, 0, 0.14] });
  const face = mesh(new THREE.CylinderGeometry(0.84, 0.84, 0.02, 96), mat.porcelain(), { pos: [0, 0, 0.14], rot: [PI / 2, 0, 0] });
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * PI * 2;
    const big = i % 5 === 0;
    ticks.push(mesh(new THREE.BoxGeometry(big ? 0.022 : 0.01, big ? 0.11 : 0.05, 0.01), mat.lacquer(C.night), { pos: [Math.sin(a) * (big ? 0.7 : 0.73), Math.cos(a) * (big ? 0.7 : 0.73), 0.16], rot: [0, 0, -a] }));
  }
  const arcGeo = new THREE.RingGeometry(0.3, 0.62, 64, 1, PI / 2 - 0.0, -1.25);
  const sweep = mesh(arcGeo, mat.lacquer(C.sage, { transparent: true, opacity: 0.55 }), { pos: [0, 0, 0.155] });
  const hand = mesh(rbox(0.035, 0.72, 0.015, 0.008), mat.lacquer(C.garnet), { pos: [Math.sin(1.25) * 0.3, Math.cos(1.25) * 0.3, 0.175], rot: [0, 0, -1.25] });
  const hub = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 32), mat.lacquer(C.garnet), { pos: [0, 0, 0.18], rot: [PI / 2, 0, 0] });
  const crown = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 32), brass, { pos: [0, 1.0, 0] });
  const button = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 32), brass, { pos: [0, 1.12, 0] });
  const bow = mesh(new THREE.TorusGeometry(0.2, 0.04, 16, 48), brass, { pos: [0, 1.32, 0] });
  const side = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 24), brass, { pos: [0.72, 0.72, 0], rot: [0, 0, -PI / 4] });
  const g = group(caseM, bezel, face, ticks, sweep, hand, hub, crown, button, bow, side);
  g.rotation.set(-0.08, 0.38, 0.06);
  return { obj: g, view: { az: -14, el: 8 } };
}

function pen() {
  const lacquer = mat.lacquer(C.night);
  const brass = mat.brass();
  const barrel = mesh(new THREE.CapsuleGeometry(0.15, 1.7, 12, 48), lacquer, { pos: [0, 0.25, 0] });
  const bands = [0.12, 0.2].map((y) => mesh(new THREE.CylinderGeometry(0.156, 0.156, 0.05, 48), brass, { pos: [0, y, 0] }));
  const clip = mesh(rbox(0.06, 0.8, 0.04, 0.02), brass, { pos: [0, 0.75, 0.17] });
  const clipBall = mesh(new THREE.SphereGeometry(0.04, 16, 12), brass, { pos: [0, 0.36, 0.19] });
  const section = mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.32, 48), mat.lacquer(C.ink), { pos: [0, -0.74, 0] });
  const nibGeo = new THREE.ConeGeometry(0.11, 0.5, 48, 1, true);
  const nib = mesh(nibGeo, mat.brass({ side: THREE.DoubleSide }), { pos: [0, -1.12, 0], rot: [PI, 0, 0], scale: [1, 1, 0.45] });
  const slit = mesh(new THREE.BoxGeometry(0.008, 0.3, 0.06), mat.lacquer(C.ink), { pos: [0, -1.2, 0.02] });
  const hole = mesh(new THREE.SphereGeometry(0.018, 16, 12), mat.lacquer(C.ink), { pos: [0, -1.04, 0.045] });
  const g = group(barrel, bands, clip, clipBall, section, nib, slit, hole);
  g.rotation.set(0.25, 0.3, -0.72);
  const drop = mesh(smoothLathe([[0, 0], [0.11, 0.06], [0.13, 0.16], [0.06, 0.3], [0, 0.38]], 48), mat.lacquer(C.cobalt, { roughness: 0.1 }), { pos: [-0.95, -0.95, 0.2] });
  return { obj: group(g, drop), view: { az: -10, el: 10 } };
}

/* ---------------- motivation ---------------- */

function flame() {
  const outerGeo = smoothLathe([[0, 0], [0.3, 0.1], [0.4, 0.36], [0.32, 0.74], [0.16, 1.12], [0.03, 1.52], [0, 1.62]], 64);
  const flameMat = new THREE.ShaderMaterial({
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float f = pow(1. - abs(dot(vN, vV)), 1.25);
        vec3 core = vec3(1.0, 0.96, 0.82); vec3 mid = vec3(1.0, 0.70, 0.22); vec3 edge = vec3(0.86, 0.26, 0.12);
        vec3 c = mix(core, mid, smoothstep(0.0, 0.5, f));
        c = mix(c, edge, smoothstep(0.45, 1.0, f));
        c = mix(c, edge * 0.95, smoothstep(0.7, 1.6, vY) * 0.7);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const outer = mesh(outerGeo, flameMat, { pos: [0, 0.27, 0] });
  outer.castShadow = false;
  const p = outerGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) + 0.08 * Math.sin(y * 2.4) * (y / 1.6));
  }
  outerGeo.computeVertexNormals();
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 64),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec2 vUv; void main(){ float d = distance(vUv, vec2(.5)); float a = smoothstep(.5, .0, d); gl_FragColor = vec4(1.0, .62, .2, a*a*.45); }`,
    }),
  );
  halo.position.set(0, 0.95, -0.25);
  const dish = mesh(smoothLathe([[0, 0], [0.55, 0.02], [0.78, 0.1], [0.86, 0.26], [0.8, 0.3], [0.62, 0.2], [0, 0.18]], 72), mat.brass());
  const foot = mesh(lathe([[0, -0.12], [0.36, -0.12], [0.3, 0], [0, 0]], 64), mat.lacquer(C.night));
  return { obj: group(outer, halo, dish, foot), view: { el: 14, fill: 0.78 } };
}

function amberJewel() {
  const geo = lathe([[0, -1.05], [0.42, -0.62], [0.6, -0.1], [0.5, 0.35], [0.22, 0.7], [0, 0.82]], 10);
  const stone = mesh(geo, mat.lacquer(C.amber, { flatShading: true, roughness: 0.12, clearcoatRoughness: 0.02, emissive: C.amber, emissiveIntensity: 0.12 }));
  const cap = mesh(smoothLathe([[0, 0.98], [0.2, 0.9], [0.24, 0.76], [0.2, 0.68], [0, 0.66]], 48), mat.brass());
  const ring = mesh(new THREE.TorusGeometry(0.12, 0.035, 12, 32), mat.brass(), { pos: [0, 1.1, 0] });
  const g = group(stone, cap, ring);
  g.rotation.set(0, 0.2, 0.18);
  return { obj: g, view: { el: 14 } };
}

function hourglass() {
  const brass = mat.brass();
  const plate = (y) => mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.12, 72), mat.lacquer(C.night), { pos: [0, y, 0] });
  const trim = (y) => mesh(new THREE.TorusGeometry(0.72, 0.03, 12, 72), brass, { pos: [0, y, 0], rot: [PI / 2, 0, 0] });
  const posts = [0, 1, 2].map((i) => {
    const a = (i / 3) * PI * 2 + 0.4;
    return mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.9, 24), brass, { pos: [Math.sin(a) * 0.6, 0, Math.cos(a) * 0.6] });
  });
  const glass = mesh(smoothLathe([[0.02, -0.9], [0.44, -0.82], [0.48, -0.5], [0.3, -0.18], [0.06, -0.02], [0.06, 0.02], [0.3, 0.18], [0.48, 0.5], [0.44, 0.82], [0.02, 0.9]], 72, 80), mat.glass({ thickness: 0.05 }));
  const sand = mat.lacquer(C.wood, { roughness: 0.9, clearcoat: 0 });
  const pile = mesh(smoothLathe([[0, -0.86], [0.42, -0.84], [0.35, -0.7], [0.12, -0.55], [0, -0.5]], 64), sand);
  const top = mesh(smoothLathe([[0, 0.05], [0.12, 0.12], [0.3, 0.26], [0.4, 0.38], [0, 0.4]], 64), sand);
  const stream = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 8), sand, { pos: [0, -0.24, 0] });
  const g = group(plate(-1.0), plate(1.0), trim(-0.94), trim(0.94), posts, glass, pile, top, stream);
  g.rotation.set(0, 0, 0.1);
  return { obj: g, view: { el: 10 } };
}

function target() {
  const ringM = (r, color, z) => mesh(new THREE.CylinderGeometry(r, r, 0.04, 96), color, { pos: [0, 0, z], rot: [PI / 2, 0, 0] });
  const board = mesh(new THREE.CylinderGeometry(1, 1, 0.16, 96), mat.porcelain(), { rot: [PI / 2, 0, 0] });
  const rim = mesh(new THREE.TorusGeometry(1.0, 0.04, 12, 96), mat.brass());
  const rings = [ringM(0.8, mat.lacquer(C.garnet), 0.08), ringM(0.6, mat.porcelain(), 0.1), ringM(0.4, mat.lacquer(C.garnet), 0.12), ringM(0.2, mat.brass(), 0.14)];
  const arrow = group(
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 16), mat.lacquer(C.night), { pos: [0, 0.75, 0] }),
    ...[0, 1, 2].map((i) => {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.lineTo(0.16, 0.08);
      s.lineTo(0.16, 0.36);
      s.lineTo(0, 0.3);
      s.closePath();
      const f = mesh(extrude(s, 0.005, 0.004), mat.lacquer(C.sage), { pos: [0, 1.15, 0], rot: [0, (i / 3) * PI * 2, 0] });
      return f;
    }),
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 16), mat.brass(), { pos: [0, 0.05, 0] }),
  );
  arrow.rotation.set(PI / 2 - 0.5, 0, -0.55);
  arrow.position.set(0, 0, 0.14);
  const g = group(board, rim, rings, arrow);
  g.rotation.set(-0.08, 0.5, 0);
  return { obj: g, view: { az: -16, el: 10 } };
}

function trophy() {
  const brass = mat.brass();
  const cup = mesh(smoothLathe([[0, 0.25], [0.18, 0.3], [0.5, 0.55], [0.7, 0.95], [0.78, 1.45], [0.72, 1.48], [0.64, 1.0], [0, 0.95]], 96, 80), brass);
  const stem = mesh(smoothLathe([[0, -0.4], [0.14, -0.35], [0.08, -0.05], [0.12, 0.2], [0.2, 0.3], [0, 0.32]], 64, 40), brass);
  const handle = (s) => mesh(new THREE.TorusGeometry(0.3, 0.045, 16, 64, PI * 1.1), brass, { pos: [s * 0.72, 1.05, 0], rot: [0, s > 0 ? 0 : PI, -PI * 0.55] });
  const base = mesh(rbox(0.95, 0.42, 0.95, 0.05), mat.lacquer(C.night), { pos: [0, -0.62, 0] });
  const plaque = mesh(rbox(0.5, 0.16, 0.02, 0.01), brass, { pos: [0, -0.62, 0.48] });
  const g = group(cup, stem, handle(1), handle(-1), base, plaque);
  return { obj: g, view: { az: -22, el: 14 } };
}

function padlock() {
  const body = mesh(rbox(1.2, 1.0, 0.5, 0.14), mat.brass());
  const shackle = mesh(
    tube(
      [
        [-0.36, 0.3, 0],
        [-0.36, 0.75, 0],
        [-0.25, 1.05, 0],
        [0, 1.14, 0],
        [0.25, 1.05, 0],
        [0.36, 0.75, 0],
        [0.36, 0.3, 0],
      ],
      0.08,
      { tubular: 120 },
    ),
    mat.lacquer('#9aa3b2', { metalness: 1, roughness: 0.3, clearcoat: 0 }),
  );
  const hole = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 32), mat.lacquer(C.ink), { pos: [0, 0.02, 0.25], rot: [PI / 2, 0, 0] });
  const slot = mesh(new THREE.BoxGeometry(0.06, 0.2, 0.04), mat.lacquer(C.ink), { pos: [0, -0.1, 0.25] });
  const g = group(body, shackle, hole, slot);
  g.rotation.set(0.05, 0.4, 0.06);
  return { obj: g, view: { el: 14 } };
}

/* ---------------- goals ---------------- */

function leafShape(len, wid) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(wid, len * 0.25, wid * 0.8, len * 0.8, 0, len);
  s.bezierCurveTo(-wid * 0.8, len * 0.8, -wid, len * 0.25, 0, 0);
  return s;
}

function sprout() {
  const pot = mesh(smoothLathe([[0, -0.6], [0.48, -0.6], [0.6, 0.0], [0.66, 0.1], [0.6, 0.12], [0.55, 0.06], [0, 0.04]], 96, 50), mat.porcelain());
  const band = mesh(new THREE.TorusGeometry(0.6, 0.025, 12, 96), mat.brass(), { pos: [0, -0.02, 0], rot: [PI / 2, 0, 0] });
  const soil = mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.04, 64), mat.lacquer('#3a2a20', { roughness: 0.95, clearcoat: 0 }), { pos: [0, 0.06, 0] });
  const stem = mesh(tube([[0, 0.05, 0], [0.02, 0.4, 0], [-0.02, 0.7, 0], [0, 0.95, 0]], 0.035), mat.lacquer(C.jade));
  const leaf = (side, color, y, s) => {
    const l = mesh(extrude(leafShape(0.75 * s, 0.32 * s), 0.02, 0.015), mat.lacquer(color));
    l.position.set(0, y, 0);
    l.rotation.set(0.3, side > 0 ? 0.2 : PI - 0.2, side * -1.0);
    return l;
  };
  const g = group(pot, band, soil, stem, leaf(1, C.jade, 0.9, 1), leaf(-1, C.sage, 0.8, 0.85));
  return { obj: g, view: { az: -20, el: 16 } };
}

function plane() {
  const N = [0, 0.05, 1.3];
  const L = [-0.9, 0.16, -0.7];
  const R = [0.9, 0.16, -0.7];
  const K = [0, -0.3, -0.7];
  const S = [0, 0.05, -0.7];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...N, ...S, ...L, ...N, ...R, ...S, ...N, ...K, ...S, ...N, ...S, ...K], 3));
  geo.computeVertexNormals();
  const p = mesh(geo, mat.porcelain({ side: THREE.DoubleSide, flatShading: true }));
  const trail = [];
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    trail.push(mesh(new THREE.SphereGeometry(0.045, 16, 12), mat.brass(), { pos: [Math.sin(t * PI) * 0.35, -0.12 - t * 0.25, -0.95 - t * 0.7] }));
  }
  const g = group(p, trail);
  g.rotation.set(0.35, 0.6, -0.25);
  return { obj: g, view: { az: -30, el: 30 } };
}

function briefcase() {
  const leather = mat.lacquer(C.leather, { roughness: 0.55, clearcoat: 0.35, sheen: 0.4, sheenColor: '#556' });
  const body = mesh(rbox(1.9, 1.25, 0.6, 0.1), leather);
  const flap = mesh(rbox(1.92, 0.04, 0.62, 0.02), mat.lacquer(C.ink), { pos: [0, 0.3, 0] });
  const clasps = [-0.55, 0.55].map((x) => mesh(rbox(0.22, 0.16, 0.06, 0.03), mat.brass(), { pos: [x, 0.3, 0.31] }));
  const handle = mesh(
    tube(
      [
        [-0.32, 0.62, 0],
        [-0.3, 0.86, 0],
        [0, 0.92, 0],
        [0.3, 0.86, 0],
        [0.32, 0.62, 0],
      ],
      0.06,
    ),
    leather,
  );
  const fittings = [-0.32, 0.32].map((x) => mesh(rbox(0.14, 0.06, 0.16, 0.02), mat.brass(), { pos: [x, 0.64, 0] }));
  const g = group(body, flap, clasps, handle, fittings);
  g.rotation.set(0.04, 0.42, 0);
  return { obj: g, view: { az: -16, el: 14 } };
}

function mortarboard() {
  const night = mat.lacquer(C.night, { roughness: 0.5, clearcoat: 0.5 });
  const board = mesh(rbox(1.9, 0.07, 1.9, 0.02), night, { pos: [0, 0.42, 0], rot: [0, PI / 4, 0] });
  const cap = mesh(smoothLathe([[0, -0.12], [0.6, -0.12], [0.64, 0.1], [0.6, 0.4], [0, 0.4]], 72, 30), night);
  const button = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 32), mat.brass(), { pos: [0, 0.48, 0] });
  const cord = mesh(tube([[0, 0.49, 0], [0.5, 0.48, 0.2], [1.0, 0.46, 0.36], [1.12, 0.3, 0.38], [1.14, 0.0, 0.38]], 0.022), mat.brass());
  const tassel = mesh(smoothLathe([[0, 0.02], [0.05, 0], [0.09, -0.25], [0.11, -0.42], [0, -0.44]], 32, 24), mat.brass({ roughness: 0.55 }), { pos: [1.14, 0, 0.38] });
  const g = group(board, cap, button, cord, tassel);
  g.rotation.set(0.12, -0.15, 0.05);
  return { obj: g, view: { az: -20, el: 22 } };
}

function pencil() {
  const body = mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.9, 6), mat.lacquer(C.sage, { flatShading: true }));
  const wood = mesh(new THREE.CylinderGeometry(0.16, 0.035, 0.38, 6), mat.matte(C.wood, { flatShading: true }), { pos: [0, -1.14, 0] });
  const lead = mesh(new THREE.ConeGeometry(0.035, 0.1, 16), mat.lacquer(C.graphite), { pos: [0, -1.38, 0], rot: [PI, 0, 0] });
  const ferrule = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.24, 48), mat.brass(), { pos: [0, 1.07, 0] });
  const grooves = [1.0, 1.07, 1.14].map((y) => mesh(new THREE.TorusGeometry(0.172, 0.008, 8, 48), mat.brass({ roughness: 0.5 }), { pos: [0, y, 0], rot: [PI / 2, 0, 0] }));
  const eraser = mesh(new THREE.CapsuleGeometry(0.155, 0.12, 8, 32), mat.lacquer(C.garnet, { roughness: 0.6, clearcoat: 0.2 }), { pos: [0, 1.28, 0] });
  const p = group(body, wood, lead, ferrule, grooves, eraser);
  p.rotation.set(0.2, 0, -0.75);
  const tick = new THREE.Shape();
  tick.moveTo(-0.3, 0.02);
  tick.lineTo(-0.1, -0.2);
  tick.lineTo(0.34, 0.3);
  tick.lineTo(0.26, 0.38);
  tick.lineTo(-0.1, -0.04);
  tick.lineTo(-0.22, 0.1);
  tick.closePath();
  const t = mesh(extrude(tick, 0.08, 0.025), mat.brass(), { pos: [-0.75, -0.55, 0.3] });
  return { obj: group(p, t), view: { az: -10, el: 12 } };
}

export const ICONS = {
  'level-A1': () => levelGem('A1'),
  'level-A2': () => levelGem('A2'),
  'level-B1': () => levelGem('B1'),
  'level-B2': () => levelGem('B2'),
  'level-C1': () => levelGem('C1'),
  'level-C2': () => levelGem('C2'),
  today: astrolabe,
  learn: books,
  review: cards,
  practice: metronome,
  pronunciation: microphone,
  library: openBook,
  grammar: arch,
  vocabulary: tiles,
  profile: seal,
  placement: compass,
  studio: headphones,
  roleplay: bubbles,
  shadowing: tuningFork,
  listening: vinyl,
  sprint: stopwatch,
  spelling: pen,
  streak: flame,
  xp: amberJewel,
  goal: hourglass,
  accuracy: target,
  trophy,
  lock: padlock,
  'goal-general': sprout,
  'goal-travel': plane,
  'goal-work': briefcase,
  'goal-study': mortarboard,
  'goal-exam': pencil,
};
