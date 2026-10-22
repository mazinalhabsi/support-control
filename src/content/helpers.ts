/**
 * Compact authoring helpers. Content files read almost like a lesson plan:
 *
 *   v('hello', 'مرحبًا', 'interj', '/həˈləʊ/', 'Hello, Sara!')
 *   mcq('She ___ a doctor.', ['is', 'are', 'am'], 0)
 *   fix('He are my brother.', 'are', 'He is my brother.')
 */
import type {
  Bi,
  Exercise,
  FixExercise,
  GapExercise,
  ListenExercise,
  MatchExercise,
  McqExercise,
  OrderExercise,
  PartOfSpeech,
  SpeakExercise,
  TranslateExercise,
  TrueFalseExercise,
  VocabItem,
} from './types';

export const bi = (en: string, ar: string): Bi => ({ en, ar });

/** Vocabulary item; `id` is assigned later by the registry. */
export const v = (
  word: string,
  ar: string,
  pos: PartOfSpeech,
  ipa: string | undefined,
  example: string,
  exampleAr?: string,
): VocabItem => ({ id: '', word, ar, pos, ipa, example, exampleAr });

export const mcq = (
  prompt: string,
  options: string[],
  answer: number,
  explain?: Bi,
  promptAr?: string,
): McqExercise => ({ type: 'mcq', prompt, options, answer, explain, promptAr, skill: 'grammar' });

/** Listening discrimination: play `audio`, choose what was said. */
export const ear = (audio: string, options: string[], answer: number, explain?: Bi): McqExercise => ({
  type: 'mcq',
  prompt: '',
  promptAr: 'استمع واختر ما سمعته',
  audio,
  options,
  answer,
  explain,
  skill: 'listening',
});

/** Vocabulary / usage choice (counts toward the vocabulary skill). */
export const vmcq = (prompt: string, options: string[], answer: number, explain?: Bi, promptAr?: string): McqExercise => ({
  ...mcq(prompt, options, answer, explain, promptAr),
  skill: 'vocabulary',
});

export const gap = (sentence: string, answers: string[], explain?: Bi, hint?: string, ar?: string): GapExercise => ({
  type: 'gap',
  sentence,
  answers,
  explain,
  hint,
  ar,
});

export const order = (en: string, ar: string, distractors?: string[]): OrderExercise => ({
  type: 'order',
  en,
  ar,
  distractors,
});

export const tr = (ar: string, answers: string[], explain?: Bi): TranslateExercise => ({
  type: 'translate',
  ar,
  answers,
  explain,
});

export const listen = (text: string, ar?: string): ListenExercise => ({ type: 'listen', text, ar });

export const match = (pairs: [string, string][], rightLtr = false): MatchExercise => ({
  type: 'match',
  pairs,
  rightLtr,
});

export const speak = (text: string, ar?: string): SpeakExercise => ({ type: 'speak', text, ar });

export const fix = (sentence: string, wrong: string, correct: string, explain?: Bi): FixExercise => ({
  type: 'fix',
  sentence,
  wrong,
  correct,
  explain,
});

export const tf = (statement: string, answer: boolean, explain?: Bi): TrueFalseExercise => ({
  type: 'tf',
  statement,
  answer,
  explain,
});

export type { Exercise };
