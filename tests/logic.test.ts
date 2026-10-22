import { describe, expect, it } from 'vitest';
import { nextStage, placementLevel, questionsFor } from '../src/lib/placement';
import { PLACEMENT } from '../src/content/placement';
import { activeStreak, bumpStreak, weakestSkill, initialData } from '../src/store/progress';
import { arrangeByTier, buildLessonSession, buildMixedSession, generateVocabDrills, tierOf } from '../src/lib/practice';
import { LESSONS, getLesson, nextLesson } from '../src/content';
import { evaluateAchievements } from '../src/lib/achievements';
import { rng } from '../src/lib/util';

describe('placement', () => {
  it('starts complete beginners at A1', () => {
    expect(placementLevel([{ level: 'A1', correct: 1, total: 5 }])).toBe('A1');
    expect(placementLevel([])).toBe('A1');
  });

  it('starts learners one level above the last stage they passed', () => {
    expect(
      placementLevel([
        { level: 'A1', correct: 5, total: 5 },
        { level: 'A2', correct: 4, total: 5 },
        { level: 'B1', correct: 2, total: 5 },
      ]),
    ).toBe('B1');
  });

  it('caps at C2', () => {
    const all = (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((level) => ({ level, correct: 5, total: 5 }));
    expect(placementLevel(all)).toBe('C2');
    expect(nextStage(all)).toBeNull();
  });

  it('stops after the first failed stage', () => {
    expect(nextStage([{ level: 'A1', correct: 2, total: 5 }])).toBeNull();
    expect(nextStage([{ level: 'A1', correct: 3, total: 5 }])).toBe('A2');
    expect(nextStage([])).toBe('A1');
  });

  it('has five valid questions per level', () => {
    for (const lvl of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const) {
      const qs = questionsFor(lvl, PLACEMENT);
      expect(qs).toHaveLength(5);
      for (const q of qs) {
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
        expect(new Set(q.options).size).toBe(q.options.length);
      }
    }
  });
});

describe('streaks', () => {
  it('extends on consecutive days and resets after a gap', () => {
    let s = { current: 0, longest: 0, lastDay: null as string | null };
    s = bumpStreak(s, '2026-03-01');
    s = bumpStreak(s, '2026-03-01');
    expect(s.current).toBe(1);
    s = bumpStreak(s, '2026-03-02');
    s = bumpStreak(s, '2026-03-03');
    expect(s).toEqual({ current: 3, longest: 3, lastDay: '2026-03-03' });
    s = bumpStreak(s, '2026-03-06');
    expect(s.current).toBe(1);
    expect(s.longest).toBe(3);
  });

  it('crosses month boundaries', () => {
    const s = bumpStreak({ current: 4, longest: 4, lastDay: '2026-02-28' }, '2026-03-01');
    expect(s.current).toBe(5);
  });

  it('shows the streak as broken once a full day is missed', () => {
    const s = { current: 5, longest: 5, lastDay: '2026-03-03' };
    expect(activeStreak(s, '2026-03-03')).toBe(5);
    expect(activeStreak(s, '2026-03-04')).toBe(5);
    expect(activeStreak(s, '2026-03-05')).toBe(0);
  });
});

describe('skills', () => {
  it('finds the weakest skill among those with enough attempts', () => {
    const skills = initialData().skills;
    skills.grammar = { correct: 9, total: 10 };
    skills.listening = { correct: 4, total: 10 };
    skills.speaking = { correct: 0, total: 2 }; // too few attempts to judge
    expect(weakestSkill(skills)).toBe('listening');
    expect(weakestSkill(initialData().skills)).toBeNull();
  });
});

describe('practice sessions', () => {
  const lesson = getLesson('a1-u1-l1')!.lesson;

  it('generates valid vocabulary drills', () => {
    const drills = generateVocabDrills(lesson);
    expect(drills.length).toBeGreaterThan(5);
    for (const d of drills) {
      if (d.exercise.type === 'mcq') {
        expect(d.exercise.answer).toBeGreaterThanOrEqual(0);
        expect(new Set(d.exercise.options).size).toBe(d.exercise.options.length);
      }
    }
    expect(drills.some((d) => d.exercise.type === 'match')).toBe(true);
    expect(drills.some((d) => d.skill === 'listening')).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    const a = buildLessonSession(lesson, 42).map((i) => i.key);
    const b = buildLessonSession(lesson, 42).map((i) => i.key);
    expect(a).toEqual(b);
  });

  it('orders from recognition to production', () => {
    const tiers = buildLessonSession(lesson, 7).map((i) => i.tier);
    expect([...tiers].sort((x, y) => x - y)).toEqual(tiers);
    expect(tierOf({ type: 'match', pairs: [] })).toBeLessThan(tierOf({ type: 'translate', ar: '', answers: [] }));
  });

  it('arrangeByTier keeps every item', () => {
    const items = buildLessonSession(lesson, 1);
    expect(arrangeByTier(items, rng(3))).toHaveLength(items.length);
  });

  it('mixed sessions put past mistakes in and respect the size', () => {
    const lessons = LESSONS.slice(0, 5).map((r) => r.lesson);
    const mistake = `${lessons[2].id}#ex0`;
    const items = buildMixedSession(lessons, [mistake], 'grammar', 12, 5);
    expect(items).toHaveLength(12);
    expect(items.some((i) => i.key === mistake)).toBe(true);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
    expect(new Set(items.map((i) => i.lessonId)).size).toBeGreaterThan(1);
  });
});

describe('course navigation & achievements', () => {
  it('recommends the first unfinished lesson at the start level', () => {
    expect(nextLesson({}, 'A1')?.lesson.id).toBe('a1-u1-l1');
    expect(nextLesson({ 'a1-u1-l1': {} }, 'A1')?.lesson.id).toBe('a1-u1-l2');
    expect(nextLesson({}, 'B2')?.level.id).toBe('B2');
  });

  it('unlocks achievements from progress data', () => {
    const s = initialData();
    expect(evaluateAchievements(s)).toEqual([]);
    s.lessons = { x: { completedAt: 1, bestScore: 1, attempts: 1 } };
    s.streak = { current: 3, longest: 3, lastDay: null };
    expect(evaluateAchievements(s)).toEqual(expect.arrayContaining(['first-lesson', 'streak-3']));
  });
});
