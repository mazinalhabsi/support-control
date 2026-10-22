import { LESSONS, getVocab, nextLesson, type VocabRef } from '../content';
import type { Bi, CEFR, DialogueLine } from '../content/types';

/* Material for the studio modes, drawn from the learner's own course. */

export interface DialogueSource {
  lessonId: string;
  title: Bi;
  level: CEFR;
  lines: DialogueLine[];
  done: boolean;
}

/** Every lesson dialogue, the learner's completed lessons first. */
export function dialogueSources(completed: Record<string, unknown>): DialogueSource[] {
  const all = LESSONS.filter((r) => (r.lesson.dialogue?.length ?? 0) >= 2).map((r) => ({
    lessonId: r.lesson.id,
    title: r.lesson.title,
    level: r.level.id,
    lines: r.lesson.dialogue!,
    done: !!completed[r.lesson.id],
  }));
  return [...all.filter((d) => d.done), ...all.filter((d) => !d.done)];
}

/**
 * Words to drill: the learner's review deck, topped up with the words of the
 * lessons up to their current position so a new learner still has material.
 */
export function wordPool(srs: Record<string, unknown>, completed: Record<string, unknown>, startLevel: CEFR, min = 24): VocabRef[] {
  const deck = Object.keys(srs)
    .map((id) => getVocab(id))
    .filter((v): v is VocabRef => !!v);
  if (deck.length >= min) return deck;
  const here = nextLesson(completed, startLevel)?.index ?? LESSONS.length - 1;
  // lessons nearest the learner first: the current one and those just behind
  // it, then the next ones ahead, until there are enough words
  const order = [...LESSONS.slice(0, here + 1).reverse(), ...LESSONS.slice(here + 1)];
  const seen = new Set(deck.map((v) => v.item.id));
  const pool = [...deck];
  for (const ref of order) {
    if (pool.length >= min) break;
    for (const item of ref.lesson.vocab) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      pool.push({ item, lessonId: ref.lesson.id, level: ref.level.id });
    }
  }
  return pool;
}

/** "N___ t_ m___ y__": first letters only, a hint that still makes you recall. */
export function initialsHint(sentence: string): string {
  return sentence.replace(/[A-Za-z']+/g, (w) => w[0] + '_'.repeat(Math.max(1, w.length - 1)));
}
