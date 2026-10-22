import type { RefObject } from 'react';
import { gsap, useGSAP } from './core';
import { useReducedMotion } from './MotionProvider';

/**
 * Staggered entrance for the matching descendants of `scope`, once on mount
 * (and again when `deps` change). Elements end in their natural state.
 */
export function useStaggerIn(scope: RefObject<HTMLElement | null>, selector: string, deps: unknown[] = [], opts: { y?: number; stagger?: number; delay?: number } = {}) {
  const reduced = useReducedMotion();
  useGSAP(
    () => {
      if (reduced || !scope.current) return;
      const targets = scope.current.querySelectorAll(selector);
      if (!targets.length) return;
      gsap.from(targets, {
        y: opts.y ?? 18,
        opacity: 0,
        duration: 0.55,
        delay: opts.delay ?? 0,
        stagger: { each: opts.stagger ?? 0.045, amount: Math.min(0.6, targets.length * (opts.stagger ?? 0.045)) },
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
    },
    { scope, dependencies: [reduced, ...deps] },
  );
}

/** Quick horizontal shake, e.g. for a wrong answer. */
export function shake(el: Element | null) {
  if (!el) return;
  gsap.fromTo(el, { x: -10 }, { x: 0, duration: 0.6, ease: 'elastic.out(1.2, 0.3)', clearProps: 'transform' });
}
