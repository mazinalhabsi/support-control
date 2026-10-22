/**
 * Content model for the whole curriculum.
 *
 * Every learner-facing explanation is bilingual (Arabic + English) so the same
 * content works for an absolute beginner (explanations in Arabic) and for an
 * advanced learner who prefers an all-English experience.
 */

export type CEFR = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export const CEFR_LEVELS: CEFR[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type Skill = 'vocabulary' | 'grammar' | 'listening' | 'speaking' | 'reading' | 'writing';
export const SKILLS: Skill[] = ['vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'];

export interface Bi {
  en: string;
  ar: string;
}

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adj'
  | 'adv'
  | 'prep'
  | 'pron'
  | 'conj'
  | 'det'
  | 'interj'
  | 'phrase'
  | 'phrasal verb'
  | 'idiom'
  | 'num';

export interface VocabItem {
  /** Globally unique, e.g. `a1-1-1:hello`. Filled in by the content registry. */
  id: string;
  word: string;
  ar: string;
  pos: PartOfSpeech;
  /** British (UK) IPA transcription. */
  ipa?: string;
  example: string;
  exampleAr?: string;
}

export interface GrammarExample {
  en: string;
  ar?: string;
}

export interface CommonMistake {
  wrong: string;
  right: string;
  why: Bi;
}

export interface GrammarPoint {
  title: Bi;
  /** Short explanation of the form and its use. */
  explanation: Bi;
  /** Optional form table (e.g. a conjugation). */
  table?: { headers: string[]; rows: string[][] };
  /** Key rules / patterns shown as a list. */
  rules?: Bi[];
  examples: GrammarExample[];
  /** Contrastive note for Arabic speakers: where Arabic leads learners astray. */
  arabicNote?: string;
  mistakes?: CommonMistake[];
}

export interface DialogueLine {
  speaker: string;
  en: string;
  ar: string;
}

/* ------------------------------------------------------------------ */
/* Exercises                                                           */
/* ------------------------------------------------------------------ */

interface ExerciseBase {
  /** Optional explanation shown after the learner answers. */
  explain?: Bi;
}

/** Choose one option. `prompt` may contain `___` for a gap. */
export interface McqExercise extends ExerciseBase {
  type: 'mcq';
  prompt: string;
  /** Arabic instruction or translation shown under the prompt. */
  promptAr?: string;
  options: string[];
  answer: number;
  /** Play the prompt as audio (listening item). */
  audio?: string;
  skill?: Skill;
}

/** Type the missing word(s). `sentence` contains exactly one `___`. */
export interface GapExercise extends ExerciseBase {
  type: 'gap';
  sentence: string;
  answers: string[];
  hint?: string;
  ar?: string;
}

/** Build a sentence from word tiles. */
export interface OrderExercise extends ExerciseBase {
  type: 'order';
  en: string;
  ar: string;
  distractors?: string[];
}

/** Translate Arabic → English (free typing, several accepted answers). */
export interface TranslateExercise extends ExerciseBase {
  type: 'translate';
  ar: string;
  answers: string[];
}

/** Dictation: listen and type what you hear. */
export interface ListenExercise extends ExerciseBase {
  type: 'listen';
  text: string;
  ar?: string;
}

/** Match English ↔ Arabic (or word ↔ definition). */
export interface MatchExercise extends ExerciseBase {
  type: 'match';
  pairs: [string, string][];
  /** Right-hand column is English (definitions) rather than Arabic. */
  rightLtr?: boolean;
}

/** Say the sentence; checked with speech recognition when available. */
export interface SpeakExercise extends ExerciseBase {
  type: 'speak';
  text: string;
  ar?: string;
}

/** Tap the incorrect word, then see the corrected sentence. */
export interface FixExercise extends ExerciseBase {
  type: 'fix';
  sentence: string;
  /** The incorrect word exactly as it appears in `sentence`. */
  wrong: string;
  correct: string;
}

/** True / false statement (reading comprehension). */
export interface TrueFalseExercise extends ExerciseBase {
  type: 'tf';
  statement: string;
  answer: boolean;
}

export type Exercise =
  | McqExercise
  | GapExercise
  | OrderExercise
  | TranslateExercise
  | ListenExercise
  | MatchExercise
  | SpeakExercise
  | FixExercise
  | TrueFalseExercise;

export type ExerciseType = Exercise['type'];

/* ------------------------------------------------------------------ */
/* Curriculum                                                          */
/* ------------------------------------------------------------------ */

export interface WritingTask {
  prompt: Bi;
  /** A model answer the learner can compare with. */
  model: string;
  checklist: Bi[];
  minWords: number;
}

export interface Lesson {
  id: string;
  title: Bi;
  /** CEFR "can-do" objectives. */
  objectives: Bi[];
  vocab: VocabItem[];
  dialogue?: DialogueLine[];
  grammar?: GrammarPoint;
  /** Hand-written exercises (grammar & usage). Vocabulary drills are generated. */
  exercises: Exercise[];
  /** Sentences to read aloud in the speaking stage. */
  speaking: string[];
  writing?: WritingTask;
}

export interface Unit {
  id: string;
  level: CEFR;
  title: Bi;
  lessons: Lesson[];
}

export interface Level {
  id: CEFR;
  title: Bi;
  description: Bi;
  /** Approximate guided learning hours to reach the level (Cambridge estimates). */
  hours: number;
  units: Unit[];
}

/* ------------------------------------------------------------------ */
/* Library, pronunciation, placement                                   */
/* ------------------------------------------------------------------ */

export interface Reading {
  id: string;
  level: CEFR;
  title: string;
  titleAr: string;
  topic: Bi;
  /** Paragraphs of the text. */
  paragraphs: string[];
  glossary: { word: string; ar: string }[];
  questions: (McqExercise | TrueFalseExercise)[];
}

export interface MinimalPair {
  a: string;
  b: string;
}

export interface PronunciationTopic {
  id: string;
  title: string;
  titleAr: string;
  /** IPA symbols involved, e.g. ['/p/', '/b/']. */
  sounds: string[];
  /** How to physically produce the sound(s). */
  how: Bi;
  /** Why it is hard for Arabic speakers. */
  arabicNote: string;
  pairs: MinimalPair[];
  /** Pairs sound identical (homophones): show them, but don't quiz on them. */
  homophones?: boolean;
  /** Practice sentences (tongue twisters / natural sentences). */
  sentences: string[];
}

export interface PlacementQuestion {
  level: CEFR;
  prompt: string;
  options: string[];
  answer: number;
  skill: Skill;
}
