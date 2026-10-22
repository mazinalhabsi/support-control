/**
 * Forgiving answer checking.
 *
 * Learners should be marked wrong for *language* errors, not for capital
 * letters, a missing full stop, curly apostrophes or "I'm" vs "I am".
 * Small typos in long answers are accepted but flagged so the learner
 * notices the spelling.
 */

const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, 'cannot'],
  [/\bcan not\b/g, 'cannot'],
  [/\bwon't\b/g, 'will not'],
  [/\bshan't\b/g, 'shall not'],
  [/\bain't\b/g, 'is not'],
  [/\blet's\b/g, 'let us'],
  [/\b(\w+)n't\b/g, '$1 not'],
  [/\bi'm\b/g, 'i am'],
  [/\b(\w+)'re\b/g, '$1 are'],
  [/\b(\w+)'ve\b/g, '$1 have'],
  [/\b(\w+)'ll\b/g, '$1 will'],
  [/\b(\w+)'d\b/g, '$1 would'],
  // 's is ambiguous (is / has / possessive). Only expand it after pronouns
  // and question words, where it is almost always "is".
  [/\b(he|she|it|that|there|here|what|where|who|how|when|why)'s\b/g, '$1 is'],
];

/** Lower-case, unify quotes, expand contractions, strip punctuation. */
export function normalize(input: string): string {
  let s = input
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .trim();
  for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
  return s
    .replace(/[.,!?;:"()…–—]/g, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

export type Verdict = 'correct' | 'typo' | 'wrong';

export interface CheckResult {
  verdict: Verdict;
  /** The accepted answer closest to what the learner typed. */
  closest: string;
}

/**
 * Compare a typed answer with the accepted answers.
 * A typo is tolerated when the answer is long enough that one or two slips
 * are clearly spelling, not grammar (we never forgive "is" for "are").
 */
export function checkAnswer(input: string, accepted: string[], allowTypos = true): CheckResult {
  const n = normalize(input);
  let best = { dist: Infinity, answer: accepted[0] ?? '' };
  for (const a of accepted) {
    const na = normalize(a);
    if (n === na) return { verdict: 'correct', closest: a };
    const d = levenshtein(n, na);
    if (d < best.dist) best = { dist: d, answer: a };
  }
  const target = normalize(best.answer);
  if (allowTypos && n.length > 0 && isTypo(n, target, best.dist)) return { verdict: 'typo', closest: best.answer };
  return { verdict: 'wrong', closest: best.answer };
}

/**
 * Grammatical endings. Two words that share a stem but differ in ending
 * (work/works, watchs/watches, studys/studies) differ in GRAMMAR, so the
 * difference must never be forgiven as a spelling slip.
 */
const ENDINGS: [string, string][] = [
  ['iest', 'y'],
  ['ies', 'y'],
  ['ied', 'y'],
  ['ier', 'y'],
  ['ing', ''],
  ['est', ''],
  ['es', ''],
  ['ed', ''],
  ['er', ''],
  ['ly', ''],
  ['en', ''],
  ['s', ''],
  ['d', ''],
];

function stem(w: string): string {
  for (const [end, rep] of ENDINGS) {
    if (w.endsWith(end) && w.length - end.length >= 3) return w.slice(0, -end.length) + rep;
  }
  return w;
}

function suffixOnlyDifference(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.startsWith(short) && ENDINGS.some(([end]) => end === long.slice(short.length))) return true;
  return stem(a) === stem(b);
}

function isTypo(n: string, target: string, dist: number): boolean {
  if (dist === 0) return false;
  const allowed = target.length >= 12 ? 2 : target.length >= 5 ? 1 : 0;
  if (dist > allowed) return false;
  // Never accept a typo that turns into a different *word* list length
  // (e.g. a missing article) – that is a grammar error, not a spelling slip.
  const nw = n.split(' ');
  const tw = target.split(' ');
  if (nw.length !== tw.length) return false;
  // Each differing word must be a near-spelling of its counterpart, and short
  // function words (a, an, is, am, in, on…) must match exactly.
  for (let i = 0; i < tw.length; i++) {
    if (nw[i] === tw[i]) continue;
    if (tw[i].length <= 3) return false;
    if (suffixOnlyDifference(nw[i], tw[i])) return false;
    if (levenshtein(nw[i], tw[i]) > (tw[i].length >= 8 ? 2 : 1)) return false;
  }
  return true;
}

/** Split a sentence into word tiles, keeping punctuation attached to words. */
export function tokenize(sentence: string): string[] {
  return sentence.trim().split(/\s+/).filter(Boolean);
}

/** Strip surrounding punctuation from a token, for comparisons. */
export function bareWord(token: string): string {
  return token.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '').toLowerCase();
}

/**
 * Word-level similarity between what speech recognition heard and the target
 * sentence (0..1), plus which target words were matched. Order-aware (LCS).
 */
export function speechSimilarity(heard: string, target: string): { score: number; matched: boolean[] } {
  const h = normalize(heard).split(' ').filter(Boolean);
  const t = normalize(target).split(' ').filter(Boolean);
  const dp: number[][] = Array.from({ length: t.length + 1 }, () => new Array(h.length + 1).fill(0));
  for (let i = 1; i <= t.length; i++) {
    for (let j = 1; j <= h.length; j++) {
      dp[i][j] = sameWord(t[i - 1], h[j - 1]) ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const matched = new Array(t.length).fill(false);
  let i = t.length;
  let j = h.length;
  while (i > 0 && j > 0) {
    if (sameWord(t[i - 1], h[j - 1])) {
      matched[i - 1] = true;
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return { score: t.length ? dp[t.length][h.length] / t.length : 0, matched };
}

const NUMBER_WORDS: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
  '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', '11': 'eleven',
  '12': 'twelve', '13': 'thirteen', '14': 'fourteen', '15': 'fifteen', '16': 'sixteen',
  '17': 'seventeen', '18': 'eighteen', '19': 'nineteen', '20': 'twenty', '30': 'thirty',
  '40': 'forty', '50': 'fifty', '60': 'sixty', '70': 'seventy', '80': 'eighty', '90': 'ninety',
  '100': 'hundred',
};

function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  // Recognisers often write "7" for "seven" and "Mr" for "mister".
  if (NUMBER_WORDS[a] === b || NUMBER_WORDS[b] === a) return true;
  return a.length > 4 && levenshtein(a, b) <= 1;
}
