/**
 * Pointer-driven surfaces.
 * SpotlightCard and Magnet are adapted from React Bits (https://github.com/DavidHDev/react-bits),
 * MIT + Commons Clause © David Haz.
 */
import { useRef, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { gsap, useGSAP } from '../../motion/core';
import { useReducedMotion } from '../../motion/MotionProvider';
import { cx } from '../../lib/util';

/** Card with a soft light that follows the pointer. */
export function SpotlightCard({
  children,
  className,
  color = 'color-mix(in srgb, var(--primary) 22%, transparent)',
  as: Tag = 'div',
  style,
}: {
  children: ReactNode;
  className?: string;
  color?: string;
  as?: ElementType;
  style?: CSSProperties;
}) {
  return (
    <Tag
      className={cx('spotlight-card', className)}
      style={{ '--spot-color': color, ...style } as CSSProperties}
      onPointerMove={(e: React.PointerEvent<HTMLElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </Tag>
  );
}

/** Pulls its child toward the pointer when it comes close (mouse only). */
export function Magnet({ children, strength = 4, padding = 60, className }: { children: ReactNode; strength?: number; padding?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reduced || !window.matchMedia?.('(pointer: fine)').matches) return;
      const inner = el.firstElementChild as HTMLElement | null;
      if (!inner) return;
      const xTo = gsap.quickTo(inner, 'x', { duration: 0.5, ease: 'power3.out' });
      const yTo = gsap.quickTo(inner, 'y', { duration: 0.5, ease: 'power3.out' });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const near = Math.abs(e.clientX - cx) < r.width / 2 + padding && Math.abs(e.clientY - cy) < r.height / 2 + padding;
        xTo(near ? (e.clientX - cx) / strength : 0);
        yTo(near ? (e.clientY - cy) / strength : 0);
      };
      window.addEventListener('pointermove', move, { passive: true });
      return () => window.removeEventListener('pointermove', move);
    },
    { scope: ref, dependencies: [reduced, strength, padding] },
  );

  return (
    <span ref={ref} className={cx('magnet', className)}>
      {children}
    </span>
  );
}

/** Fades and lifts its children in, once, as they enter the viewport (or on mount). */
export function Reveal({
  children,
  className,
  y = 28,
  delay = 0,
  stagger = 0,
  trigger = 'view',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  delay?: number;
  /** When > 0, children animate one after another. */
  stagger?: number;
  trigger?: 'view' | 'mount';
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reduced) return;
      const targets = stagger > 0 ? Array.from(el.children) : [el];
      gsap.from(targets, {
        y,
        opacity: 0,
        duration: 0.8,
        delay,
        stagger,
        clearProps: 'transform,opacity',
        scrollTrigger: trigger === 'view' ? { trigger: el, start: 'top 90%', once: true } : undefined,
      });
    },
    { scope: ref, dependencies: [reduced] },
  );
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
