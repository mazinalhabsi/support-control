/**
 * Number that counts up to its value (on view, and again whenever it changes).
 * Inspired by React Bits "CountUp" (MIT + Commons Clause © David Haz), rebuilt on GSAP
 * with Arabic-Indic digit formatting.
 */
import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '../../motion/core';
import { useReducedMotion } from '../../motion/MotionProvider';
import { useT } from '../../i18n';

export interface CountUpProps {
  to: number;
  from?: number;
  duration?: number;
  /** Start when scrolled into view (default) or immediately. */
  trigger?: 'view' | 'mount';
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function CountUp({ to, from = 0, duration = 1.6, trigger = 'view', prefix = '', suffix = '', className }: CountUpProps) {
  const { num } = useT();
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const shown = useRef<number | null>(null);
  const format = (v: number) => `${prefix}${num(Math.round(v))}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      el.textContent = format(to);
      shown.current = to;
      return;
    }
    const state = { v: shown.current ?? from };
    el.textContent = format(state.v);
    const tween = gsap.to(state, {
      v: to,
      duration: shown.current === null ? duration : Math.min(duration, 0.8),
      ease: 'power2.out',
      paused: true,
      onUpdate: () => {
        el.textContent = format(state.v);
        shown.current = state.v;
      },
    });
    let st: ScrollTrigger | undefined;
    if (trigger === 'view' && shown.current === null) {
      st = ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => tween.play() });
    } else tween.play();
    return () => {
      st?.kill();
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, reduced, num]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {format(reduced ? to : from)}
    </span>
  );
}
