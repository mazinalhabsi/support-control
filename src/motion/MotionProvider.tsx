import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Lenis from 'lenis';
import { LazyMotion, MotionConfig, domMax } from 'motion/react';
import 'lenis/dist/lenis.css';
import { useProgress } from '../store/progress';
import { gsap, ScrollTrigger, setMotionReduced, systemPrefersReducedMotion } from './core';

const MotionContext = createContext(false);

/** Whether animations should be skipped. Re-renders when the preference changes. */
export function useReducedMotion(): boolean {
  return useContext(MotionContext);
}

let lenis: Lenis | null = null;

/** Scroll to the top of the page (instantly by default), Lenis-aware. */
export function scrollToTop(immediate = true): void {
  if (lenis) lenis.scrollTo(0, { immediate, force: true });
  else window.scrollTo({ top: 0, behavior: immediate ? 'auto' : 'smooth' });
}

/** Bring an element into view, smoothly unless motion is reduced. */
export function scrollToElement(el: HTMLElement | null, offset = 0): void {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset, duration: 0.8 });
  else el.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

/**
 * Resolves the motion preference (setting + OS) and runs Lenis smooth
 * scrolling in sync with GSAP's ticker so ScrollTrigger and Lenis never
 * disagree about the scroll position. GSAP drives timelines and scroll;
 * Motion (motion.dev) drives springs, gestures and layout transitions, and
 * both obey the same switch.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const pref = useProgress((s) => s.settings.motion);
  const [system, setSystem] = useState(systemPrefersReducedMotion);
  const reduced = pref === 'reduced' || (pref === 'system' && system);
  // Set synchronously (idempotent) so child effects that run before ours read the right value.
  setMotionReduced(reduced);

  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return;
    }
    const update = () => setSystem(mq!.matches);
    mq.addEventListener?.('change', update);
    return () => mq!.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const instance = new Lenis({ lerp: 0.12, smoothWheel: true, syncTouch: false, autoRaf: false });
    lenis = instance;
    instance.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      instance.destroy();
      if (lenis === instance) lenis = null;
    };
  }, [reduced]);

  return (
    <MotionContext.Provider value={reduced}>
      <LazyMotion features={domMax} strict>
        <MotionConfig reducedMotion={reduced ? 'always' : 'never'} transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
          {children}
        </MotionConfig>
      </LazyMotion>
    </MotionContext.Provider>
  );
}
