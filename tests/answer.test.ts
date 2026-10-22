import { describe, expect, it } from 'vitest';
import { bareWord, checkAnswer, levenshtein, normalize, speechSimilarity, tokenize } from '../src/lib/answer';
import { splitBidi } from '../src/i18n';

describe('normalize', () => {
  it('ignores case, punctuation and curly quotes', () => {
    expect(normalize('  Hello,   WORLD! ')).toBe('hello world');
    expect(normalize('I’m fine.')).toBe(normalize("I'm fine"));
  });

  it('expands contractions so either form is accepted', () => {
    expect(normalize("I'm a student")).toBe('i am a student');
    expect(normalize("She doesn't work")).toBe('she does not work');
    expect(normalize("We can't go")).toBe(normalize('We cannot go'));
    expect(normalize("They won't come")).toBe('they will not come');
    expect(normalize("It's late")).toBe('it is late');
    expect(normalize("I'd like tea")).toBe('i would like tea');
  });

  it("keeps possessive 's on nouns", () => {
    expect(normalize("Ali's car")).toBe("ali's car");
  });
});

describe('checkAnswer', () => {
  it('accepts any listed answer and contraction variants', () => {
    expect(checkAnswer("I'm a student", ['I am a student.']).verdict).toBe('correct');
    expect(checkAnswer('my name is sara', ['My name is Sara.', "I'm Sara."]).verdict).toBe('correct');
  });

  it('forgives a spelling slip in a long word, and reports the closest answer', () => {
    const r = checkAnswer('She is very beautifull', ['She is very beautiful.']);
    expect(r.verdict).toBe('typo');
    expect(r.closest).toBe('She is very beautiful.');
  });

  it('never forgives grammar errors as typos', () => {
    expect(checkAnswer('He work every day', ['He works every day.']).verdict).toBe('wrong'); // 3rd person -s
    expect(checkAnswer('I has a car', ['I have a car.']).verdict).toBe('wrong'); // short word
    expect(checkAnswer('two watchs', ['two watches']).verdict).toBe('wrong'); // plural ending
    expect(checkAnswer('She studys English', ['She studies English.']).verdict).toBe('wrong');
    expect(checkAnswer('I am student', ['I am a student.']).verdict).toBe('wrong'); // missing article
  });

  it('is strict when typos are disabled (gap fills)', () => {
    expect(checkAnswer('beautifull', ['beautiful'], false).verdict).toBe('wrong');
    expect(checkAnswer('Beautiful', ['beautiful'], false).verdict).toBe('correct');
  });

  it('rejects empty answers', () => {
    expect(checkAnswer('', ['yes']).verdict).toBe('wrong');
  });
});

describe('helpers', () => {
  it('levenshtein distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
  });

  it('tokenize and bareWord', () => {
    expect(tokenize('  Are you a teacher? ')).toEqual(['Are', 'you', 'a', 'teacher?']);
    expect(bareWord('teacher?')).toBe('teacher');
    expect(bareWord("I'm.")).toBe("i'm");
  });

  it('speech similarity is order-aware and tolerant of digits', () => {
    expect(speechSimilarity('hello my name is sara', 'Hello, my name is Sara.').score).toBe(1);
    expect(speechSimilarity('I am 30 years old', "I'm thirty years old.").score).toBe(1);
    const partial = speechSimilarity('my name sara', 'My name is Sara.');
    expect(partial.score).toBeCloseTo(0.75);
    expect(partial.matched).toEqual([true, true, false, true]);
  });

  it('isolates Latin runs inside Arabic text', () => {
    const parts = splitBidi('استخدم I am مع الضمير، وقل Yes, I am.');
    expect(parts.filter((p) => p.latin).map((p) => p.text)).toEqual(['I am', 'Yes, I am.']);
  });
});
