/**
 * Animated headline reveal.
 * Adapted from React Bits "SplitText" (https://github.com/DavidHDev/react-bits),
 * MIT + Commons Clause © David Haz — rewritten for RTL and this app's motion system.
 *
 * Arabic is cursive: splitting it into letters breaks letter joining, so
 * Arabic text is always split by word. Latin text can split by character.
 */
import { useRef, type ElementType } from 'react';
import { gsap, SplitText as GSAPSplitText, useGSAP } from '../../motion/core';
import { useReducedMotion } from '../../motion/MotionProvider';

const ARABIC = /[؀-ۿ]/;

export interface SplitTextProps {
  text: string;
  as?: ElementType;
  className?: string;
  /** auto = words for Arabic, chars for Latin. */
  by?: 'auto' | 'words' | 'chars' | 'lines';
  stagger?: number;
  delay?: number;
  duration?: number;
  /** Animate on mount, or when scrolled into view. */
  trigger?: 'load' | 'view';
}

export function SplitText({
  text,
  as: Tag = 'span',
  className,
  by = 'auto',
  stagger,
  delay = 0,
  duration = 1,
  trigger = 'load',
}: SplitTextProps) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || reduced) return;
      const arabic = ARABIC.test(text);
      const unit = by === 'auto' ? (arabic ? 'words' : 'chars') : arabic && by === 'chars' ? 'words' : by;
      // Masks clip Arabic marks above/below the line, so Arabic fades up with a blur instead.
      const masked = !arabic;
      const split = GSAPSplitText.create(el, {
        type: unit === 'chars' ? 'words,chars' : unit,
        mask: masked ? (unit === 'chars' ? 'words' : unit) : undefined,
        autoSplit: unit === 'lines',
        aria: 'auto',
        onSplit(self) {
          const targets = unit === 'chars' ? self.chars : unit === 'words' ? self.words : self.lines;
          const from: gsap.TweenVars = masked
            ? { yPercent: 110, opacity: 0 }
            : { y: '0.45em', opacity: 0, filter: 'blur(8px)' };
          return gsap.from(targets, {
            ...from,
            duration,
            delay,
            ease: 'power4.out',
            stagger: stagger ?? (unit === 'chars' ? 0.022 : 0.07),
            clearProps: 'filter',
            scrollTrigger: trigger === 'view' ? { trigger: el, start: 'top 88%', once: true } : undefined,
          });
        },
      });
      return () => split.revert();
    },
    { scope: ref, dependencies: [text, reduced, by, trigger], revertOnUpdate: true },
  );

  return (
    <Tag ref={ref} className={className}>
      {text}
    </Tag>
  );
}
