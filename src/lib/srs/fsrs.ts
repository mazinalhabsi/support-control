/**
 * FSRS-4.5 (Free Spaced Repetition Scheduler) — the open-source algorithm
 * that outperforms SM-2 (Anki's classic scheduler) in public benchmarks.
 *
 * Memory model per card:
 *   S (stability)  – days until recall probability drops to 90 %
 *   D (difficulty) – 1 (easy) … 10 (hard)
 *   R (retrievability) – current probability of recall
 *
 * Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 */

export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
export const AGAIN: Rating = 1;
export const HARD: Rating = 2;
export const GOOD: Rating = 3;
export const EASY: Rating = 4;

export type CardState = 'new' | 'review' | 'relearning';

export interface SrsCard {
  stability: number;
  difficulty: number;
  /** Due date as epoch milliseconds. */
  due: number;
  /** Last review as epoch milliseconds (0 = never). */
  lastReview: number;
  reps: number;
  lapses: number;
  state: CardState;
}

/** Default FSRS-4.5 parameters (trained on ~20k Anki collections). */
export const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246,
  1.587, 0.2272, 2.8755,
] as const;

const DECAY = -0.5;
const FACTOR = 19 / 81; // makes R(S, S) = 0.9
const DAY = 24 * 60 * 60 * 1000;
export const DESIRED_RETENTION = 0.9;
export const MAX_INTERVAL_DAYS = 365 * 3;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function newCard(now = Date.now()): SrsCard {
  return { stability: 0, difficulty: 0, due: now, lastReview: 0, reps: 0, lapses: 0, state: 'new' };
}

/** Probability of recall after `elapsedDays` for a memory of stability `s`. */
export function retrievability(elapsedDays: number, s: number): number {
  if (s <= 0) return 0;
  return Math.pow(1 + (FACTOR * elapsedDays) / s, DECAY);
}

export function initStability(g: Rating): number {
  return Math.max(W[g - 1], 0.1);
}

export function initDifficulty(g: Rating): number {
  return clamp(W[4] - (g - 3) * W[5], 1, 10);
}

function nextDifficulty(d: number, g: Rating): number {
  const delta = d - W[6] * (g - 3);
  // Mean reversion toward the default difficulty of a "Good" first answer.
  return clamp(W[7] * initDifficulty(GOOD) + (1 - W[7]) * delta, 1, 10);
}

function stabilityAfterRecall(d: number, s: number, r: number, g: Rating): number {
  const hardPenalty = g === HARD ? W[15] : 1;
  const easyBonus = g === EASY ? W[16] : 1;
  return (
    s *
    (Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hardPenalty * easyBonus + 1)
  );
}

function stabilityAfterLapse(d: number, s: number, r: number): number {
  const sf = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
  // A lapse can never make the memory *more* stable than before.
  return Math.min(sf, s);
}

/** Interval in whole days that keeps recall probability at `retention`. */
export function intervalDays(s: number, retention = DESIRED_RETENTION): number {
  const raw = (s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return clamp(Math.round(raw), 1, MAX_INTERVAL_DAYS);
}

/**
 * Apply a review. Returns a new card; the input is not mutated.
 * "Again" schedules the card for ~10 minutes later (same-session relearning);
 * every other answer schedules in whole days.
 */
export function review(card: SrsCard, g: Rating, now = Date.now()): SrsCard {
  let stability: number;
  let difficulty: number;
  let lapses = card.lapses;

  if (card.state === 'new' || card.reps === 0) {
    stability = initStability(g);
    difficulty = initDifficulty(g);
  } else {
    const elapsed = Math.max(0, (now - card.lastReview) / DAY);
    const r = retrievability(elapsed, card.stability);
    difficulty = nextDifficulty(card.difficulty, g);
    if (g === AGAIN) {
      stability = stabilityAfterLapse(card.difficulty, card.stability, r);
      lapses += 1;
    } else {
      stability = stabilityAfterRecall(card.difficulty, card.stability, r, g);
    }
  }

  const due = g === AGAIN ? now + 10 * 60 * 1000 : now + intervalDays(stability) * DAY;

  return {
    stability,
    difficulty,
    due,
    lastReview: now,
    reps: card.reps + 1,
    lapses,
    state: g === AGAIN ? 'relearning' : 'review',
  };
}

/** Preview the next interval for each rating (shown on the rating buttons). */
export function previewIntervals(card: SrsCard, now = Date.now()): Record<Rating, number> {
  const out = {} as Record<Rating, number>;
  for (const g of [AGAIN, HARD, GOOD, EASY] as Rating[]) {
    out[g] = (review(card, g, now).due - now) / DAY;
  }
  return out;
}

export function isDue(card: SrsCard, now = Date.now()): boolean {
  return card.due <= now;
}

/** A card counts as "mastered" once its memory lasts three weeks or more. */
export function isMastered(card: SrsCard): boolean {
  return card.state === 'review' && card.stability >= 21;
}

/** Human-friendly interval label: "10m", "3d", "2w", "4mo", "1.5y" (Arabic: "١٠ د", "٣ يوم"…). */
export function formatInterval(days: number, lang: 'ar' | 'en' = 'en'): string {
  const [n, unit] =
    days < 1
      ? [Math.max(1, Math.round(days * 24 * 60)), 'm']
      : days < 14
        ? [Math.round(days), 'd']
        : days < 60
          ? [Math.round(days / 7), 'w']
          : days < 365
            ? [Math.round(days / 30), 'mo']
            : [Math.round((days / 365) * 10) / 10, 'y'];
  if (lang === 'en') return `${n}${unit}`;
  const ar: Record<string, string> = { m: 'د', d: 'يوم', w: 'أسبوع', mo: 'شهر', y: 'سنة' };
  return `${new Intl.NumberFormat('ar-EG').format(n)} ${ar[unit]}`;
}
