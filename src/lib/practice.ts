/**
 * Builds practice sessions from lesson content.
 *
 * Pedagogical ordering: recognition before recall before production.
 *   tier 1 – match / choose the meaning      (recognise)
 *   tier 2 – listening choice, grammar choice (discriminate)
 *   tier 3 – gap fill, word order, error hunt (controlled production)
 *   tier 4 – translation, dictation           (free production)
 * Vocabulary drills are generated from each lesson's word list so every
 * lesson gets listening + meaning practice without hand-writing it.
 */
import type { Exercise, Lesson, McqExercise, Skill, VocabItem } from '../content/types';
import { hashString, rng, sample, shuffle } from './util';

export interface PracticeItem {
  /** Stable key, used to remember mistakes across sessions. */
  key: string;
  lessonId: string;
  exercise: Exercise;
  skill: Skill;
  tier: number;
}

export function skillOf(ex: Exercise): Skill {
  switch (ex.type) {
    case 'mcq':
      return ex.audio ? 'listening' : ex.skill ?? 'grammar';
    case 'gap':
    case 'order':
    case 'fix':
      return 'grammar';
    case 'translate':
      return 'writing';
    case 'listen':
      return 'listening';
    case 'match':
      return 'vocabulary';
    case 'speak':
      return 'speaking';
    case 'tf':
      return 'reading';
  }
}

export function tierOf(ex: Exercise): number {
  switch (ex.type) {
    case 'match':
      return 1;
    case 'mcq':
      return ex.skill === 'vocabulary' && !ex.audio ? 1 : 2;
    case 'tf':
      return 2;
    case 'gap':
    case 'order':
    case 'fix':
      return 3;
    case 'translate':
    case 'listen':
    case 'speak':
      return 4;
  }
}

/** Distinct values other than `exclude` (two words may share a translation). */
function distinct(values: string[], exclude: string): string[] {
  return [...new Set(values)].filter((v) => v !== exclude);
}

function meaningMcq(item: VocabItem, pool: VocabItem[], random: () => number): McqExercise {
  const distractors = sample(
    distinct(
      pool.map((p) => p.ar),
      item.ar,
    ),
    3,
    random,
  );
  const options = shuffle([item.ar, ...distractors], random);
  return {
    type: 'mcq',
    prompt: item.word,
    promptAr: 'ما معنى هذه الكلمة؟',
    options,
    answer: options.indexOf(item.ar),
    skill: 'vocabulary',
    explain: { en: `${item.word} — ${item.example}`, ar: `${item.word} = ${item.ar}` },
  };
}

function reverseMcq(item: VocabItem, pool: VocabItem[], random: () => number): McqExercise {
  const distractors = sample(
    distinct(
      pool.map((p) => p.word),
      item.word,
    ),
    3,
    random,
  );
  const options = shuffle([item.word, ...distractors], random);
  return {
    type: 'mcq',
    prompt: item.ar,
    promptAr: 'اختر الكلمة الإنجليزية المناسبة',
    options,
    answer: options.indexOf(item.word),
    skill: 'vocabulary',
    explain: { en: `${item.word}: ${item.example}`, ar: `${item.ar} = ${item.word}` },
  };
}

function listenMcq(item: VocabItem, pool: VocabItem[], random: () => number): McqExercise {
  const distractors = sample(
    distinct(
      pool.map((p) => p.word),
      item.word,
    ),
    3,
    random,
  );
  const options = shuffle([item.word, ...distractors], random);
  return {
    type: 'mcq',
    prompt: '',
    promptAr: 'استمع واختر الكلمة التي سمعتها',
    audio: item.word,
    options,
    answer: options.indexOf(item.word),
    skill: 'listening',
    explain: { en: `${item.word} ${item.ipa ?? ''}`.trim(), ar: item.ar },
  };
}

/** Words per tile sentence: long sentences make tile puzzles tedious. */
const MAX_ORDER_WORDS = 10;

export function generateVocabDrills(lesson: Lesson, seed = hashString(lesson.id)): PracticeItem[] {
  const random = rng(seed);
  const vocab = lesson.vocab;
  if (vocab.length < 4) return [];
  const items: PracticeItem[] = [];
  const push = (key: string, exercise: Exercise) =>
    items.push({ key: `${lesson.id}#${key}`, lessonId: lesson.id, exercise, skill: skillOf(exercise), tier: tierOf(exercise) });

  // Matching game(s): 5 pairs per board.
  const boards = shuffle(vocab, random);
  for (let i = 0; i + 4 <= boards.length && i < 10; i += 5) {
    push(`match${i}`, { type: 'match', pairs: boards.slice(i, i + 5).map((w) => [w.word, w.ar] as [string, string]) });
  }

  const picks = shuffle(vocab, random);
  picks.slice(0, 3).forEach((w) => push(`mean:${w.word}`, meaningMcq(w, vocab, random)));
  picks.slice(3, 6).forEach((w) => push(`rev:${w.word}`, reverseMcq(w, vocab, random)));
  shuffle(vocab, random)
    .slice(0, 2)
    .forEach((w) => push(`ear:${w.word}`, listenMcq(w, vocab, random)));

  // Sentence building from the dialogue, dictation from a vocabulary example.
  const lines = (lesson.dialogue ?? []).filter((l) => l.en.split(/\s+/).length <= MAX_ORDER_WORDS && l.en.split(/\s+/).length >= 3);
  const orderLine = shuffle(lines, random)[0];
  if (orderLine) push(`dlg-order`, { type: 'order', en: orderLine.en, ar: orderLine.ar });
  const dictation = shuffle(
    vocab.filter((w) => w.example.split(/\s+/).length <= 9),
    random,
  )[0];
  if (dictation) push(`dict:${dictation.word}`, { type: 'listen', text: dictation.example, ar: dictation.exampleAr });

  return items;
}

export function handwrittenItems(lesson: Lesson): PracticeItem[] {
  return lesson.exercises.map((exercise, i) => ({
    key: `${lesson.id}#ex${i}`,
    lessonId: lesson.id,
    exercise,
    skill: skillOf(exercise),
    tier: tierOf(exercise),
  }));
}

/** Order by tier; shuffle within each tier so sessions don't feel scripted. */
export function arrangeByTier(items: PracticeItem[], random: () => number): PracticeItem[] {
  const tiers = new Map<number, PracticeItem[]>();
  for (const it of items) tiers.set(it.tier, [...(tiers.get(it.tier) ?? []), it]);
  return [...tiers.keys()].sort((a, b) => a - b).flatMap((t) => shuffle(tiers.get(t)!, random));
}

export function buildLessonSession(lesson: Lesson, seed = Date.now()): PracticeItem[] {
  const random = rng(seed);
  return arrangeByTier([...generateVocabDrills(lesson, seed), ...handwrittenItems(lesson)], random);
}

export function allItemsForLesson(lesson: Lesson): PracticeItem[] {
  return [...generateVocabDrills(lesson), ...handwrittenItems(lesson)];
}

/**
 * Mixed review across completed lessons (interleaving). Past mistakes come
 * first, then a spread of items from different lessons, weighted toward the
 * learner's weakest skill.
 */
export function buildMixedSession(
  lessons: Lesson[],
  mistakeKeys: string[],
  weakSkill: Skill | null,
  size = 15,
  seed = Date.now(),
): PracticeItem[] {
  const random = rng(seed);
  const pool = lessons.flatMap(allItemsForLesson).filter((i) => i.exercise.type !== 'speak');
  const byKey = new Map(pool.map((i) => [i.key, i]));
  const mistakes = mistakeKeys.map((k) => byKey.get(k)).filter((x): x is PracticeItem => !!x);
  const chosen = new Set<string>(shuffle(mistakes, random).slice(0, Math.ceil(size / 2)).map((i) => i.key));

  const rest = shuffle(
    pool.filter((i) => !chosen.has(i.key)),
    random,
  ).sort((a, b) => Number(b.skill === weakSkill) - Number(a.skill === weakSkill));
  // Round-robin by lesson so one lesson can't dominate.
  const perLesson = new Map<string, PracticeItem[]>();
  for (const it of rest) perLesson.set(it.lessonId, [...(perLesson.get(it.lessonId) ?? []), it]);
  const queues = shuffle([...perLesson.values()], random);
  while (chosen.size < size && queues.some((q) => q.length)) {
    for (const q of queues) {
      const it = q.shift();
      if (it && chosen.size < size) chosen.add(it.key);
    }
  }
  const all = new Map([...mistakes, ...pool].map((i) => [i.key, i]));
  return arrangeByTier(
    [...chosen].map((k) => all.get(k)!),
    random,
  );
}
