import { describe, expect, it } from 'vitest';
import { dialogueSources, initialsHint, wordPool } from '../src/lib/studio';
import { LESSONS, getVocab } from '../src/content';

describe('studio material', () => {
  it('hints with first letters and keeps punctuation', () => {
    expect(initialsHint("Nice to meet you, I'm Sara!")).toBe('N___ t_ m___ y__, I__ S___!');
    expect(initialsHint('A cat.')).toBe('A_ c__.');
  });

  it('lists every dialogue with completed lessons first', () => {
    const withDialogue = LESSONS.filter((r) => (r.lesson.dialogue?.length ?? 0) >= 2);
    const done = withDialogue[3].lesson.id;
    const list = dialogueSources({ [done]: { completedAt: 1 } });
    expect(list).toHaveLength(withDialogue.length);
    expect(list[0].lessonId).toBe(done);
    expect(list[0].done).toBe(true);
    expect(list.slice(1).every((d) => !d.done)).toBe(true);
    for (const d of list) expect(new Set(d.lines.map((l) => l.speaker)).size).toBeGreaterThanOrEqual(1);
  });

  it('gives a brand-new learner words from the lessons they are meeting', () => {
    const pool = wordPool({}, {}, 'A1', 24);
    expect(pool.length).toBeGreaterThanOrEqual(24);
    expect(new Set(pool.map((w) => w.item.id)).size).toBe(pool.length);
    // nothing beyond the first lessons of the course
    const firstLessons = new Set(LESSONS.slice(0, 6).map((r) => r.lesson.id));
    expect(pool.every((w) => firstLessons.has(w.lessonId))).toBe(true);
  });

  it('puts the review deck first and keeps every deck word', () => {
    const deckIds = LESSONS[0].lesson.vocab.slice(0, 5).map((v) => v.id);
    const srs = Object.fromEntries(deckIds.map((id) => [id, {}]));
    const pool = wordPool(srs, {}, 'A1', 24);
    expect(pool.slice(0, 5).map((w) => w.item.id)).toEqual(deckIds);
    expect(deckIds.every((id) => getVocab(id))).toBe(true);
  });

  it('uses the deck alone once it is big enough', () => {
    const ids = LESSONS.slice(0, 4).flatMap((r) => r.lesson.vocab.map((v) => v.id));
    const srs = Object.fromEntries(ids.map((id) => [id, {}]));
    expect(wordPool(srs, {}, 'A1', 24).map((w) => w.item.id)).toEqual(ids);
  });
});
