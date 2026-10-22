import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { motionReduced } from '../../motion/core';

/*
 * The six CEFR levels as cloisonné gems — enamel faces in brass wire —
 * orbiting in real time. The same models as the rendered icons
 * (scripts/render-3d/icons.js), built live so they catch real light,
 * follow the pointer and turn with the scroll.
 */

const ENAMEL = ['#1c7a56', '#157471', '#2347a8', '#4a3798', '#7c1d37', '#22314f'];

function brilliant(): THREE.BufferGeometry {
  const pts = [
    [0, -1.0],
    [0.98, -0.12],
    [1.0, 0],
    [0.64, 0.4],
    [0, 0.4],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 12);
}

const SHAPES: (() => THREE.BufferGeometry)[] = [
  () => new THREE.TetrahedronGeometry(1.1, 0),
  () => new THREE.BoxGeometry(1.1, 1.1, 1.1),
  () => new THREE.OctahedronGeometry(1.1, 0),
  () => new THREE.DodecahedronGeometry(1.0, 0),
  () => new THREE.IcosahedronGeometry(1.0, 0),
  brilliant,
];

/** One merged brass mesh for every edge (cylinders) and vertex (spheres). */
function wire(geo: THREE.BufferGeometry, radius: number): THREE.BufferGeometry {
  const edges = new THREE.EdgesGeometry(geo, 12);
  const pos = edges.attributes.position;
  const parts: THREE.BufferGeometry[] = [];
  const seen = new Set<string>();
  const up = new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 2) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    const len = a.distanceTo(b);
    if (len < 1e-4) continue;
    const cyl = new THREE.CylinderGeometry(radius, radius, len, 8, 1, true);
    const q = new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize());
    cyl.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
    parts.push(cyl);
    for (const v of [a, b]) {
      const key = v
        .toArray()
        .map((x) => x.toFixed(3))
        .join();
      if (seen.has(key)) continue;
      seen.add(key);
      parts.push(new THREE.SphereGeometry(radius * 1.35, 10, 8).translate(v.x, v.y, v.z));
    }
  }
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  parts.forEach((p) => p.dispose());
  edges.dispose();
  return merged;
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function GemOrbit({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      el.classList.add('gem-orbit-failed');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    const key = new THREE.DirectionalLight('#fff3dc', 2.4);
    key.position.set(-3, 5, 4);
    const rim = new THREE.DirectionalLight('#9fc0ff', 1.1);
    rim.position.set(4, 1, -4);
    scene.add(key, rim);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.6, 10.5);

    const brass = new THREE.MeshPhysicalMaterial({ color: '#e3bd74', metalness: 1, roughness: 0.26, envMapIntensity: 1.3 });
    const ring = new THREE.Group();
    ring.rotation.x = 0.32;
    scene.add(ring);
    const gems: { obj: THREE.Group; spin: THREE.Vector3; phase: number }[] = [];
    const disposables: (THREE.BufferGeometry | THREE.Material)[] = [brass];
    SHAPES.forEach((make, i) => {
      const geo = make();
      const enamel = new THREE.MeshPhysicalMaterial({
        color: ENAMEL[i],
        roughness: 0.2,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        sheen: 0.2,
        flatShading: true,
      });
      const w = wire(geo, i === 5 ? 0.022 : 0.03);
      disposables.push(geo, enamel, w);
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo, enamel), new THREE.Mesh(w, brass));
      const a = (i / SHAPES.length) * Math.PI * 2;
      g.position.set(Math.sin(a) * 2.7, 0, Math.cos(a) * 2.7);
      g.scale.setScalar(0.62 + i * 0.035);
      ring.add(g);
      gems.push({ obj: g, spin: new THREE.Vector3(0.2 + i * 0.04, 0.35 - i * 0.03, 0.1), phase: i * 1.1 });
    });

    // a faint brass orbit line
    const orbitGeo = new THREE.TorusGeometry(2.7, 0.008, 6, 160);
    const orbitMat = new THREE.MeshBasicMaterial({ color: '#d6b06a', transparent: true, opacity: 0.35 });
    const orbit = new THREE.Mesh(orbitGeo, orbitMat);
    orbit.rotation.x = Math.PI / 2;
    ring.add(orbit);
    disposables.push(orbitGeo, orbitMat);

    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // fit the ring's width (with the near gems' perspective growth) and its height
      camera.position.z = Math.max(8, 15 / camera.aspect);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    let raf = 0;
    let visible = true;
    let last = performance.now();
    let scrollSpin = 0;
    let lastScroll = window.scrollY;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sy = window.scrollY;
      scrollSpin += (sy - lastScroll) * 0.004;
      lastScroll = sy;
      scrollSpin *= 0.92;
      ring.rotation.y += dt * 0.18 + scrollSpin * dt * 6;
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
      ring.rotation.z = pointer.x * -0.12;
      ring.rotation.x = 0.32 + pointer.y * 0.1;
      const t = now / 1000;
      for (const g of gems) {
        g.obj.rotation.x += g.spin.x * dt;
        g.obj.rotation.y += g.spin.y * dt;
        g.obj.position.y = Math.sin(t * 0.9 + g.phase) * 0.18;
      }
      renderer.render(scene, camera);
      if (visible) raf = requestAnimationFrame(frame);
    };

    const still = motionReduced();
    if (still) {
      gems.forEach((g, i) => g.obj.rotation.set(i === 5 ? 0.15 : 0.4 + i * 0.3, 0.6 + i * 0.2, 0.1));
      ring.rotation.y = 0.4;
      renderer.render(scene, camera);
    } else {
      raf = requestAnimationFrame(frame);
    }
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !still) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      disposables.forEach((d) => d.dispose());
      scene.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className={className} aria-hidden="true" />;
}
