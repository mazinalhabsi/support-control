/**
 * Cycles through words in place, resizing smoothly.
 * Inspired by React Bits "RotatingText" (MIT + Commons Clause © David Haz), rebuilt on GSAP.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from '../../motion/core';
import { useReducedMotion } from '../../motion/MotionProvider';

export function RotatingText({ words, interval = 2400, className }: { words: string[]; interval?: number; className?: string }) {
  const [index, setIndex] = useState(0);
  const wrap = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const lastWidth = useRef<number | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || words.length < 2) return;
    const id = setInterval(() => {
      if (!inner.current) return;
      gsap.to(inner.current, {
        yPercent: -100,
        opacity: 0,
        filter: 'blur(6px)',
        duration: 0.35,
        ease: 'power2.in',
        onComplete: () => setIndex((i) => (i + 1) % words.length),
      });
    }, interval);
    return () => clearInterval(id);
  }, [reduced, words.length, interval]);

  useLayoutEffect(() => {
    const w = wrap.current;
    const el = inner.current;
    if (!w || !el) return;
    const width = el.offsetWidth;
    if (!reduced && lastWidth.current !== null) {
      gsap.fromTo(w, { width: lastWidth.current }, { width, duration: 0.45, ease: 'power3.out', clearProps: 'width' });
      gsap.fromTo(el, { yPercent: 100, opacity: 0, filter: 'blur(6px)' }, { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power3.out' });
    }
    lastWidth.current = width;
  }, [index, reduced]);

  return (
    <span ref={wrap} className={`rotating-text ${className ?? ''}`}>
      <span ref={inner} className="rotating-text-inner">
        {words[index]}
      </span>
    </span>
  );
}
