/**
 * Content integrity: hand-written curriculum is the riskiest part of the app,
 * so every exercise is validated mechanically.
 */
import { describe, expect, it } from 'vitest';
import { COURSE_STATS, LESSONS, LEVELS, VOCAB } from '../src/content';
import { READINGS } from '../src/content/readings';
import { PRONUNCIATION } from '../src/content/pronunciation';
import type { Exercise } from '../src/content/types';
import { bareWord, tokenize } from '../src/lib/answer';
import { allItemsForLesson } from '../src/lib/practice';

const ARABIC = /[؀-ۿ]/;

function validateExercise(ex: Exercise, where: string) {
  const ctx = `${where} (${ex.type})`;
  switch (ex.type) {
    case 'mcq':
      expect(ex.options.length, ctx).toBeGreaterThanOrEqual(2);
      expect(ex.answer, ctx).toBeGreaterThanOrEqual(0);
      expect(ex.answer, ctx).toBeLessThan(ex.options.length);
      expect(new Set(ex.options.map((o) => o.toLowerCase())).size, `${ctx} duplicate options`).toBe(ex.options.length);
      expect(ex.prompt || ex.audio, `${ctx} needs prompt or audio`).toBeTruthy();
      break;
    case 'gap':
      expect(ex.sentence.split('___').length, `${ctx} exactly one gap: ${ex.sentence}`).toBe(2);
      expect(ex.answers.length, ctx).toBeGreaterThan(0);
      ex.answers.forEach((a) => expect(a.trim(), ctx).not.toBe(''));
      break;
    case 'order':
      expect(tokenize(ex.en).length, ctx).toBeGreaterThanOrEqual(3);
      expect(ARABIC.test(ex.ar), `${ctx} Arabic prompt`).toBe(true);
      break;
    case 'translate':
      expect(ARABIC.test(ex.ar), `${ctx} Arabic prompt`).toBe(true);
      expect(ex.answers.length, ctx).toBeGreaterThan(0);
      ex.answers.forEach((a) => expect(ARABIC.test(a), `${ctx} English answer: ${a}`).toBe(false));
      break;
    case 'listen':
      expect(ex.text.trim(), ctx).not.toBe('');
      break;
    case 'match': {
      expect(ex.pairs.length, ctx).toBeGreaterThanOrEqual(3);
      expect(new Set(ex.pairs.map((p) => p[0])).size, `${ctx} unique left`).toBe(ex.pairs.length);
      expect(new Set(ex.pairs.map((p) => p[1])).size, `${ctx} unique right`).toBe(ex.pairs.length);
      break;
    }
    case 'speak':
      expect(ex.text.trim(), ctx).not.toBe('');
      break;
    case 'fix': {
      const hits = tokenize(ex.sentence).filter((t) => bareWord(t) === bareWord(ex.wrong)).length;
      expect(hits, `${ctx} wrong word "${ex.wrong}" must appear exactly once in "${ex.sentence}"`).toBe(1);
      expect(ex.correct.trim(), `${ctx} correction differs`).not.toBe(ex.sentence.trim());
      break;
    }
    case 'tf':
      expect(ex.statement.trim(), ctx).not.toBe('');
      break;
  }
}

describe('curriculum structure', () => {
  it('covers all six CEFR levels in order', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    LEVELS.forEach((l) => expect(l.units.length, l.id).toBeGreaterThan(0));
  });

  it('has a substantial course', () => {
    expect(COURSE_STATS.lessons).toBeGreaterThanOrEqual(50);
    expect(COURSE_STATS.words).toBeGreaterThanOrEqual(600);
    expect(COURSE_STATS.exercises).toBeGreaterThanOrEqual(500);
  });

  it('uses unique ids for units, lessons and words', () => {
    const units = LEVELS.flatMap((l) => l.units.map((u) => u.id));
    expect(new Set(units).size).toBe(units.length);
    const lessons = LESSONS.map((r) => r.lesson.id);
    expect(new Set(lessons).size).toBe(lessons.length);
    const words = VOCAB.map((v) => v.item.id);
    expect(new Set(words).size).toBe(words.length);
  });

  it('keeps lesson ids consistent with their level and unit', () => {
    for (const { lesson, unit, level } of LESSONS) {
      expect(unit.level).toBe(level.id);
      expect(lesson.id.startsWith(unit.id), lesson.id).toBe(true);
      expect(unit.id.startsWith(level.id.toLowerCase()), unit.id).toBe(true);
    }
  });
});

describe.each(LESSONS.map((r) => [r.lesson.id, r] as const))('lesson %s', (_id, { lesson }) => {
  it('has objectives, vocabulary, grammar, speaking and writing', () => {
    expect(lesson.objectives.length).toBeGreaterThanOrEqual(2);
    expect(lesson.vocab.length).toBeGreaterThanOrEqual(8);
    expect(lesson.grammar).toBeDefined();
    expect(lesson.grammar!.examples.length).toBeGreaterThanOrEqual(2);
    expect(ARABIC.test(lesson.grammar!.explanation.ar)).toBe(true);
    expect(lesson.speaking.length).toBeGreaterThanOrEqual(2);
    expect(lesson.writing?.minWords).toBeGreaterThan(0);
    expect(lesson.exercises.length).toBeGreaterThanOrEqual(8);
  });

  it('has well-formed vocabulary', () => {
    const seen = new Set<string>();
    for (const v of lesson.vocab) {
      expect(seen.has(v.word), `duplicate word ${v.word}`).toBe(false);
      seen.add(v.word);
      expect(ARABIC.test(v.ar), `${v.word} Arabic meaning`).toBe(true);
      expect(v.example.trim()).not.toBe('');
      if (v.ipa) expect(v.ipa, v.word).toMatch(/^\/.+\/$/);
    }
  });

  it('has a dialogue with translations', () => {
    expect(lesson.dialogue?.length ?? 0).toBeGreaterThanOrEqual(4);
    lesson.dialogue!.forEach((l) => expect(ARABIC.test(l.ar), l.en).toBe(true));
  });

  it('has valid hand-written and generated exercises', () => {
    lesson.exercises.forEach((ex, i) => validateExercise(ex, `${lesson.id}#ex${i}`));
    allItemsForLesson(lesson).forEach((it) => validateExercise(it.exercise, it.key));
  });

  it('covers several exercise types', () => {
    const types = new Set(lesson.exercises.map((e) => e.type));
    expect(types.size).toBeGreaterThanOrEqual(4);
  });
});

describe('library & pronunciation', () => {
  it('has readings for every level with valid questions', () => {
    for (const lvl of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) expect(READINGS.some((r) => r.level === lvl), lvl).toBe(true);
    for (const r of READINGS) {
      expect(r.paragraphs.length).toBeGreaterThanOrEqual(3);
      expect(r.questions.length).toBeGreaterThanOrEqual(4);
      r.questions.forEach((q, i) => validateExercise(q, `${r.id}#q${i}`));
      const text = r.paragraphs.join(' ').toLowerCase();
      r.glossary.forEach((g) => expect(text.includes(g.word.replace(/\s*\(.*\)$/, '').toLowerCase()), `${r.id}: ${g.word}`).toBe(true));
    }
  });

  it('has pronunciation topics with distinct minimal pairs', () => {
    expect(PRONUNCIATION.length).toBeGreaterThanOrEqual(10);
    const ids = PRONUNCIATION.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PRONUNCIATION) {
      expect(p.pairs.length, p.id).toBeGreaterThanOrEqual(4);
      p.pairs.forEach((pair) => expect(pair.a, p.id).not.toBe(pair.b));
      expect(ARABIC.test(p.arabicNote)).toBe(true);
      expect(p.sentences.length).toBeGreaterThanOrEqual(2);
    }
  });
});
