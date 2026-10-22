// Shared studio for the offline 3D icon renders: renderer, lighting,
// the material palette and small geometry helpers. Runs in a browser page
// (see index.html) driven by render.mjs.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import opentype from './.cache/opentype.module.js';

export { THREE, RoundedBoxGeometry };

/** The Talaqa palette as physical colours (sRGB hex). */
export const C = {
  night: '#15233c',
  ink: '#0c1628',
  onyx: '#111a2b',
  sage: '#5b9177',
  garnet: '#7c1d37',
  brass: '#d8ae62',
  porcelain: '#efece5',
  paper: '#e9e4d8',
  jade: '#1c7a56',
  verdigris: '#157471',
  cobalt: '#2347a8',
  amethyst: '#4a3798',
  amber: '#d98a1c',
  wax: '#7a1a2f',
  wood: '#c99a64',
  graphite: '#2b2d33',
  leather: '#1b2236',
};

let renderer, pmrem, roomEnv, warmEnv;
const fonts = {};

export async function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps brand colours true
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.setClearColor(0x000000, 0);
  document.body.appendChild(renderer.domElement);
  pmrem = new THREE.PMREMGenerator(renderer);
  roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  const hdr = await new HDRLoader().loadAsync('./.cache/venice_sunset_1k.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  warmEnv = pmrem.fromEquirectangular(hdr).texture;
  for (const [name, file] of [
    ['bodoni', 'bodoni-700.ttf'],
    ['kufam', 'kufam-700.ttf'],
  ]) {
    const buf = await (await fetch(`./.cache/${file}`)).arrayBuffer();
    fonts[name] = opentype.parse(buf);
  }
}

/* ---------- materials ---------- */

export const mat = {
  lacquer: (color, o = {}) =>
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.07, ...o }),
  brass: (o = {}) =>
    new THREE.MeshPhysicalMaterial({ color: C.brass, metalness: 1, roughness: 0.27, envMap: warmEnv, envMapIntensity: 1.2, ...o }),
  porcelain: (o = {}) =>
    new THREE.MeshPhysicalMaterial({ color: C.porcelain, roughness: 0.45, clearcoat: 0.55, clearcoatRoughness: 0.18, ...o }),
  paper: (o = {}) => new THREE.MeshPhysicalMaterial({ color: C.paper, roughness: 0.85, sheen: 0.4, sheenColor: '#ffffff', ...o }),
  /** Faceted gem: transmissive, refracting whatever sits inside it. */
  gem: (color, o = {}) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.03,
      transmission: 1,
      thickness: 1.6,
      ior: 2.0,
      attenuationColor: color,
      attenuationDistance: 0.7,
      specularIntensity: 1,
      clearcoat: 1,
      flatShading: true,
      envMapIntensity: 1.8,
      ...o,
    }),
  glass: (o = {}) =>
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, transmission: 1, thickness: 0.12, ior: 1.5, ...o }),
  matte: (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o }),
  glow: (color, intensity = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }),
};

/* ---------- geometry helpers ---------- */

export function mesh(geo, material, { pos, rot, scale } = {}) {
  const m = new THREE.Mesh(geo, material);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) (typeof scale === 'number' ? m.scale.setScalar(scale) : m.scale.set(...scale));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function group(...children) {
  const g = new THREE.Group();
  children.flat().forEach((c) => c && g.add(c));
  return g;
}

export function rbox(w, h, d, r = 0.06, seg = 5) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
}

/** Lathe from [x, y] pairs (profile in the XY plane, revolved around Y). */
export function lathe(points, segments = 64) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

/** Smooth lathe: profile passed through a Catmull-Rom spline first. */
export function smoothLathe(points, segments = 72, divisions = 60) {
  const curve = new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.LatheGeometry(curve.getPoints(divisions), segments);
}

export function tube(points, radius, { closed = false, tubular = 80, radial = 16 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'centripetal');
  return new THREE.TubeGeometry(curve, tubular, radius, radial, closed);
}

/** Rounded-rectangle THREE.Shape centred on the origin. */
export function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function extrude(shapes, depth, bevel = 0.02, opts = {}) {
  const g = new THREE.ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 5,
    curveSegments: 24,
    ...opts,
  });
  g.computeVertexNormals();
  return g;
}

/** Glyph outlines from a real typeface, centred, `size` units tall (cap height-ish). */
export function glyphShapes(fontName, text, size = 1) {
  const font = fonts[fontName];
  const path = font.getPath(text, 0, 0, 100);
  const sp = new THREE.ShapePath();
  for (const c of path.commands) {
    if (c.type === 'M') sp.moveTo(c.x, -c.y);
    else if (c.type === 'L') sp.lineTo(c.x, -c.y);
    else if (c.type === 'Q') sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
    else if (c.type === 'C') sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
  }
  const shapes = sp.toShapes(true);
  // normalise: centre and scale
  const box = new THREE.Box2();
  shapes.forEach((s) => s.getPoints(12).forEach((p) => box.expandByPoint(p)));
  const k = size / (box.max.y - box.min.y);
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;
  const t = (v) => v.set((v.x - cx) * k, (v.y - cy) * k);
  const fix = (curve) => {
    for (const key of ['v0', 'v1', 'v2', 'v3']) if (curve[key]) t(curve[key]);
  };
  shapes.forEach((s) => {
    s.curves.forEach(fix);
    s.holes.forEach((h) => h.curves.forEach(fix));
  });
  return shapes;
}

export function text3d(fontName, text, size, depth, material, bevel = 0.012) {
  const geo = extrude(glyphShapes(fontName, text, size), depth, bevel, { curveSegments: 16 });
  geo.translate(0, 0, -depth / 2);
  return mesh(geo, material);
}

/* ---------- the studio ---------- */

/**
 * Renders `obj` from a three-quarter view onto a transparent square canvas,
 * with a soft key light and a contact shadow under it.
 */
export function shoot(obj, { size = 768, az = -32, el = 22, fov = 26, fill = 0.8, shadow = 0.24, env = 'room', exposure = 1 } = {}) {
  renderer.setSize(size, size, false);
  renderer.toneMappingExposure = exposure;
  const scene = new THREE.Scene();
  scene.environment = env === 'warm' ? warmEnv : roomEnv;
  scene.add(obj);
  obj.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(obj);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const centre = sphere.center;

  // key light from upper-left-front, casting the contact shadow
  const key = new THREE.DirectionalLight('#fff6e8', 2.2);
  key.position.set(centre.x - 3, centre.y + 6, centre.z + 3);
  key.target.position.copy(centre);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 14;
  key.shadow.blurSamples = 24;
  key.shadow.bias = -0.0004;
  const s = sphere.radius * 1.8;
  Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.1, far: 30 });
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#cfe0ff', 0.7);
  rim.position.set(centre.x + 4, centre.y + 2, centre.z - 5);
  scene.add(rim);

  if (shadow > 0) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(sphere.radius * 8, sphere.radius * 8), new THREE.ShadowMaterial({ opacity: shadow }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = box.min.y - 0.001;
    ground.receiveShadow = true;
    scene.add(ground);
  }

  const cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  frame(obj, cam, centre, sphere.radius, az, el, fov, fill);

  renderer.render(scene, cam);
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
  return renderer.domElement;
}

/**
 * Places the camera on the (az, el) bearing and then adjusts distance and
 * aim from the object's projected silhouette, so every icon fills the same
 * share of the frame and sits optically centred whatever its shape.
 */
function frame(obj, cam, centre, radius, az, el, fov, fill) {
  const pts = [];
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 1500));
    for (let i = 0; i < pos.count; i += step) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
  });
  const a = THREE.MathUtils.degToRad(az);
  const e = THREE.MathUtils.degToRad(el);
  const dir = new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
  const target = centre.clone();
  let dist = (radius * 1.1) / Math.sin(THREE.MathUtils.degToRad(fov / 2));
  const v = new THREE.Vector3();
  for (let k = 0; k < 4; k++) {
    cam.position.copy(target).addScaledVector(dir, dist);
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      v.copy(p).project(cam);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    const extent = Math.max(maxX - minX, maxY - minY) / 2;
    // re-aim at the silhouette's centre (NDC → world at the target plane)
    const halfH = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * dist;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    target.addScaledVector(right, ((minX + maxX) / 2) * halfH).addScaledVector(up, ((minY + maxY) / 2) * halfH);
    dist *= extent / fill;
  }
  cam.position.copy(target).addScaledVector(dir, dist);
  cam.lookAt(target);
}

/** Downscale a canvas with high-quality smoothing and encode it. */
export function encode(canvas, out = 384, type = 'image/webp', quality = 0.9) {
  const c = document.createElement('canvas');
  c.width = c.height = out;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, out, out);
  return c.toDataURL(type, quality);
}
