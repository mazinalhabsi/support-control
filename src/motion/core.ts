/**
 * Single animation engine for the whole app: GSAP (+ plugins), with one
 * switch for reduced motion that every effect respects.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Physics2DPlugin } from 'gsap/Physics2DPlugin';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, SplitText, Physics2DPlugin, useGSAP);
gsap.defaults({ ease: 'power3.out', duration: 0.6 });

let reduced = false;

/** True when the learner (or their OS) asked for less motion. */
export function motionReduced(): boolean {
  return reduced;
}

export function setMotionReduced(value: boolean): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.motion = value ? 'reduced' : 'full';
  reduced = value;
}

export function systemPrefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Light haptic tick on supporting phones (ignored elsewhere). */
export function haptic(pattern: number | number[]): void {
  try {
    if (!reduced) navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

export { gsap, ScrollTrigger, SplitText, useGSAP };
