import { describe, expect, it } from 'vitest';
import {
  AGAIN,
  EASY,
  GOOD,
  HARD,
  formatInterval,
  initDifficulty,
  initStability,
  intervalDays,
  isDue,
  isMastered,
  newCard,
  previewIntervals,
  retrievability,
  review,
} from '../src/lib/srs/fsrs';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 1);

describe('FSRS-4.5 scheduler', () => {
  it('calibrates retrievability to 90% at t = S', () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 6);
    expect(retrievability(0, 10)).toBe(1);
    expect(retrievability(20, 10)).toBeLessThan(0.9);
  });

  it('interval equals stability at 90% retention', () => {
    expect(intervalDays(10)).toBe(10);
    expect(intervalDays(0.2)).toBe(1); // never less than a day
    expect(intervalDays(1e6)).toBe(365 * 3); // capped
  });

  it('orders initial stability and difficulty by rating', () => {
    expect(initStability(AGAIN)).toBeLessThan(initStability(HARD));
    expect(initStability(HARD)).toBeLessThan(initStability(GOOD));
    expect(initStability(GOOD)).toBeLessThan(initStability(EASY));
    expect(initDifficulty(AGAIN)).toBeGreaterThan(initDifficulty(EASY));
  });

  it('schedules a first "Good" a few days out', () => {
    const c = review(newCard(T0), GOOD, T0);
    const days = (c.due - T0) / DAY;
    expect(days).toBeGreaterThanOrEqual(3);
    expect(days).toBeLessThanOrEqual(5);
    expect(c.state).toBe('review');
    expect(c.reps).toBe(1);
  });

  it('grows intervals with successive on-time "Good" reviews', () => {
    let c = review(newCard(T0), GOOD, T0);
    const intervals: number[] = [];
    let now = T0;
    for (let i = 0; i < 5; i++) {
      now = c.due;
      const next = review(c, GOOD, now);
      intervals.push((next.due - now) / DAY);
      c = next;
    }
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1]);
  });

  it('a lapse shortens stability, counts the lapse and relearns in minutes', () => {
    const learned = review(review(newCard(T0), GOOD, T0), GOOD, T0 + 4 * DAY);
    const now = learned.due;
    const lapsed = review(learned, AGAIN, now);
    expect(lapsed.stability).toBeLessThan(learned.stability);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.state).toBe('relearning');
    expect(lapsed.due - now).toBe(10 * 60 * 1000);
  });

  it('keeps difficulty within [1, 10]', () => {
    let c = review(newCard(T0), AGAIN, T0);
    for (let i = 0; i < 30; i++) c = review(c, AGAIN, T0 + i * DAY);
    expect(c.difficulty).toBeLessThanOrEqual(10);
    let e = review(newCard(T0), EASY, T0);
    for (let i = 0; i < 30; i++) e = review(e, EASY, e.due);
    expect(e.difficulty).toBeGreaterThanOrEqual(1);
  });

  it('previews strictly increasing intervals Again < Hard < Good < Easy', () => {
    const c = review(newCard(T0), GOOD, T0);
    const p = previewIntervals(c, c.due);
    expect(p[AGAIN]).toBeLessThan(p[HARD]);
    expect(p[HARD]).toBeLessThan(p[GOOD]);
    expect(p[GOOD]).toBeLessThan(p[EASY]);
  });

  it('does not mutate the input card', () => {
    const c = newCard(T0);
    const copy = { ...c };
    review(c, GOOD, T0);
    expect(c).toEqual(copy);
  });

  it('reports due and mastered states', () => {
    const c = newCard(T0);
    expect(isDue(c, T0)).toBe(true);
    expect(isMastered(c)).toBe(false);
    expect(isMastered({ ...c, state: 'review', stability: 30 })).toBe(true);
  });

  it('formats intervals in English and Arabic', () => {
    expect(formatInterval(10 / 1440)).toBe('10m');
    expect(formatInterval(3)).toBe('3d');
    expect(formatInterval(21)).toBe('3w');
    expect(formatInterval(90)).toBe('3mo');
    expect(formatInterval(400)).toBe('1.1y');
    expect(formatInterval(3, 'ar')).toBe('٣ يوم');
  });
});
