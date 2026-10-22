/**
 * Celebration effects driven imperatively from anywhere in the app.
 *  - sparkAt(): radiating spark lines (adapted from React Bits "ClickSpark",
 *    MIT + Commons Clause © David Haz) on one shared canvas.
 *  - confetti(): paper confetti thrown with GSAP's Physics2DPlugin.
 * Both are no-ops when motion is reduced.
 */
import { useEffect, useRef } from 'react';
import { gsap, motionReduced } from '../../motion/core';

interface Spark {
  x: number;
  y: number;
  angle: number;
  start: number;
  color: string;
  size: number;
  radius: number;
}

const SPARK_MS = 520;
let pushSparks: ((s: Spark[]) => void) | null = null;

// gold leaf first, then the level enamels
const PALETTE = ['#e8c886', '#d4ad62', '#f3e3bb', '#1f8a5f', '#2b55b8', '#9e2a48', '#137f7b'];

type Origin = { x: number; y: number } | Element | null | undefined;

function centerOf(origin: Origin): { x: number; y: number } {
  if (!origin) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  if (origin instanceof Element) {
    const r = origin.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return origin;
}

/** Burst of spark lines around a point or element. */
export function sparkAt(origin: Origin, opts: { count?: number; color?: string; radius?: number } = {}): void {
  if (motionReduced() || !pushSparks) return;
  const { x, y } = centerOf(origin);
  const count = opts.count ?? 10;
  const now = performance.now();
  pushSparks(
    Array.from({ length: count }, (_, i) => ({
      x,
      y,
      angle: (2 * Math.PI * i) / count + Math.random() * 0.3,
      start: now,
      color: opts.color ?? PALETTE[i % PALETTE.length],
      size: 9 + Math.random() * 6,
      radius: opts.radius ?? 34 + Math.random() * 18,
    })),
  );
}

/** Full-screen canvas that renders sparks. Mount once. */
export function SparkLayer() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let sparks: Spark[] = [];
    let raf = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const draw = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparks = sparks.filter((s) => now - s.start < SPARK_MS);
      for (const s of sparks) {
        const t = (now - s.start) / SPARK_MS;
        const eased = 1 - Math.pow(1 - t, 3);
        const dist = eased * s.radius;
        const len = s.size * (1 - eased);
        const x1 = s.x + dist * Math.cos(s.angle);
        const y1 = s.y + dist * Math.sin(s.angle);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + len * Math.cos(s.angle), y1 + len * Math.sin(s.angle));
        ctx.stroke();
      }
      raf = sparks.length ? requestAnimationFrame(draw) : 0;
    };
    pushSparks = (s) => {
      sparks.push(...s);
      if (!raf) raf = requestAnimationFrame(draw);
    };
    window.addEventListener('resize', resize);
    return () => {
      pushSparks = null;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="spark-layer" aria-hidden="true" />;
}

/** Throw a handful of confetti from a point (default: lower middle of the screen). */
export function confetti(origin?: Origin, count = 70): void {
  if (motionReduced() || typeof document === 'undefined') return;
  const { x, y } = origin ? centerOf(origin) : { x: window.innerWidth / 2, y: window.innerHeight * 0.65 };
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  const pieces: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    const w = 6 + Math.random() * 6;
    p.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${w * (Math.random() < 0.5 ? 0.45 : 1)}px;background:${PALETTE[i % PALETTE.length]};border-radius:${Math.random() < 0.3 ? '50%' : '2px'}`;
    layer.appendChild(p);
    pieces.push(p);
  }
  const tl = gsap.timeline({ onComplete: () => layer.remove() });
  pieces.forEach((p) => {
    tl.to(
      p,
      {
        physics2D: { velocity: gsap.utils.random(520, 980), angle: gsap.utils.random(-150, -30), gravity: 1100, friction: 0.03 },
        rotation: gsap.utils.random(-540, 540),
        rotationX: gsap.utils.random(0, 720),
        duration: gsap.utils.random(1.8, 2.6),
        ease: 'none',
      },
      0,
    ).to(p, { opacity: 0, duration: 0.5 }, '>-0.6');
  });
}
