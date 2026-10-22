/**
 * Content registry: one place to look up levels, units, lessons and words.
 */
import type { CEFR, GrammarPoint, Lesson, Level, Unit, VocabItem } from './types';
import { A1 } from './levels/a1';
import { A2 } from './levels/a2';
import { B1 } from './levels/b1';
import { B2 } from './levels/b2';
import { C1 } from './levels/c1';
import { C2 } from './levels/c2';

export const LEVELS: Level[] = [A1, A2, B1, B2, C1, C2];

// Assign globally unique vocabulary ids: `<lessonId>:<word>`.
for (const level of LEVELS)
  for (const unit of level.units)
    for (const lesson of unit.lessons)
      for (const item of lesson.vocab) item.id = `${lesson.id}:${item.word}`;

export interface LessonRef {
  lesson: Lesson;
  unit: Unit;
  level: Level;
  /** Position in the whole course (0-based). */
  index: number;
}

export const LESSONS: LessonRef[] = LEVELS.flatMap((level) =>
  level.units.flatMap((unit) => unit.lessons.map((lesson) => ({ lesson, unit, level, index: 0 }))),
).map((ref, index) => ({ ...ref, index }));

const lessonMap = new Map(LESSONS.map((r) => [r.lesson.id, r]));
export const getLesson = (id: string): LessonRef | undefined => lessonMap.get(id);

export interface VocabRef {
  item: VocabItem;
  lessonId: string;
  level: CEFR;
}

export const VOCAB: VocabRef[] = LESSONS.flatMap(({ lesson, level }) =>
  lesson.vocab.map((item) => ({ item, lessonId: lesson.id, level: level.id })),
);
const vocabMap = new Map(VOCAB.map((r) => [r.item.id, r]));
export const getVocab = (id: string): VocabRef | undefined => vocabMap.get(id);

export interface GrammarRef {
  grammar: GrammarPoint;
  lessonId: string;
  lessonTitle: Lesson['title'];
  level: CEFR;
}

export const GRAMMAR: GrammarRef[] = LESSONS.filter((r) => r.lesson.grammar).map(({ lesson, level }) => ({
  grammar: lesson.grammar!,
  lessonId: lesson.id,
  lessonTitle: lesson.title,
  level: level.id,
}));

export const getLevel = (id: CEFR): Level => LEVELS.find((l) => l.id === id)!;

export function lessonsOfLevel(id: CEFR): LessonRef[] {
  return LESSONS.filter((r) => r.level.id === id);
}

/**
 * The lesson to continue with: the first unfinished lesson at or after the
 * learner's starting level; if everything there is done, the first unfinished
 * lesson anywhere.
 */
export function nextLesson(completed: Record<string, unknown>, startLevel: CEFR = 'A1'): LessonRef | undefined {
  const startIdx = LESSONS.findIndex((r) => r.level.id === startLevel);
  return (
    LESSONS.slice(Math.max(0, startIdx)).find((r) => !completed[r.lesson.id]) ??
    LESSONS.find((r) => !completed[r.lesson.id])
  );
}

export const COURSE_STATS = {
  levels: LEVELS.length,
  units: LEVELS.reduce((n, l) => n + l.units.length, 0),
  lessons: LESSONS.length,
  words: VOCAB.length,
  exercises: LESSONS.reduce((n, r) => n + r.lesson.exercises.length, 0),
};
