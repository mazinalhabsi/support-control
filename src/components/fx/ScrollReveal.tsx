/**
 * Text that brightens word by word as it scrolls through the viewport.
 * Adapted from React Bits "ScrollReveal" (MIT + Commons Clause © David Haz):
 * word split (safe for Arabic) + GSAP ScrollTrigger scrub.
 */
import { useMemo, useRef, type ElementType } from 'react';
import { gsap, useGSAP } from '../../motion/core';
import { useReducedMotion } from '../../motion/MotionProvider';

export function ScrollReveal({
  text,
  as: Tag = 'p',
  className,
  baseOpacity = 0.14,
  blur = 4,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  baseOpacity?: number;
  blur?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const words = useMemo(() => text.split(/(\s+)/), [text]);

  useGSAP(
    () => {
      if (reduced || !ref.current) return;
      const pieces = ref.current.querySelectorAll('.sr-word');
      gsap.fromTo(
        pieces,
        { opacity: baseOpacity, filter: `blur(${blur}px)` },
        {
          opacity: 1,
          filter: 'blur(0px)',
          ease: 'none',
          stagger: 0.05,
          scrollTrigger: { trigger: ref.current, start: 'top 85%', end: 'bottom 55%', scrub: 0.6 },
        },
      );
    },
    { scope: ref, dependencies: [text, reduced] },
  );

  return (
    <Tag ref={ref} className={className}>
      {words.map((w, i) =>
        w.trim() ? (
          <span key={i} className="sr-word">
            {w}
          </span>
        ) : (
          w
        ),
      )}
    </Tag>
  );
}
