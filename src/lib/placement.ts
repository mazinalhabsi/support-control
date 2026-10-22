/**
 * Placement test logic: a staged test that climbs one CEFR level at a time.
 *
 * Each stage has 5 questions at one level. The learner moves up while they
 * score ≥ 60 % (3/5) at the current stage. The first failed stage stops the
 * test, so a beginner answers ~5–10 questions and an advanced learner ~30.
 */
import { CEFR_LEVELS, type CEFR, type PlacementQuestion } from '../content/types';

export const PASS_RATIO = 0.6;
export const QUESTIONS_PER_STAGE = 5;

export interface StageResult {
  level: CEFR;
  correct: number;
  total: number;
}

export function stagePassed(r: StageResult): boolean {
  return r.total > 0 && r.correct / r.total >= PASS_RATIO;
}

/** Level to *start learning at*, given the stage results so far. */
export function placementLevel(results: StageResult[]): CEFR {
  let highestPassed = -1;
  for (const r of results) {
    if (!stagePassed(r)) break;
    highestPassed = CEFR_LEVELS.indexOf(r.level);
  }
  // Start one level above the last passed one (that's where learning happens),
  // capped at C2. Nothing passed → start at A1.
  return CEFR_LEVELS[Math.min(highestPassed + 1, CEFR_LEVELS.length - 1)];
}

/** Next stage to run, or null when the test is finished. */
export function nextStage(results: StageResult[]): CEFR | null {
  const last = results[results.length - 1];
  if (last && !stagePassed(last)) return null;
  const idx = results.length;
  return idx < CEFR_LEVELS.length ? CEFR_LEVELS[idx] : null;
}

export function questionsFor(level: CEFR, bank: PlacementQuestion[]): PlacementQuestion[] {
  return bank.filter((q) => q.level === level).slice(0, QUESTIONS_PER_STAGE);
}
