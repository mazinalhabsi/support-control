import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Mic, Volume2, Turtle, RotateCcw, Lightbulb } from 'lucide-react';
import type {
  Exercise,
  FixExercise,
  GapExercise,
  ListenExercise,
  MatchExercise,
  McqExercise,
  OrderExercise,
  SpeakExercise,
  TranslateExercise,
  TrueFalseExercise,
} from '../../content/types';
import { bareWord, checkAnswer, speechSimilarity, tokenize } from '../../lib/answer';
import { listenOnce, recognitionSupported, type ListenHandle } from '../../lib/speech';
import { rng, shuffle, cx } from '../../lib/util';
import { useSpeak } from '../../hooks/useSpeech';
import { useT } from '../../i18n';
import { useProgress } from '../../store/progress';
import { En } from '../ui';

export interface ExerciseResult {
  correct: boolean;
  /** Accepted, but with a spelling slip. */
  typo?: boolean;
  /** Correct answer to display in the feedback. */
  answer?: string;
  /** Self-reported (no automatic check possible) — don't count toward skill stats. */
  selfReported?: boolean;
  /** Skipped by the learner (e.g. can't speak now). */
  skipped?: boolean;
}

interface Props<E extends Exercise> {
  ex: E;
  seed: number;
  locked: boolean;
  onResult: (r: ExerciseResult) => void;
}

const isArabic = (s: string) => /[؀-ۿ]/.test(s);

/** Render text with the blank shown as a highlighted slot. */
function WithBlank({ text, fill }: { text: string; fill?: string }) {
  const parts = text.split('___');
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && (
            <span style={{ display: 'inline-block', minWidth: 60, borderBottom: '3px solid var(--primary)', color: 'var(--primary)', textAlign: 'center', padding: '0 4px' }}>
              {fill ?? ' '}
            </span>
          )}
        </span>
      ))}
    </>
  );
}

function CheckButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { t } = useT();
  return (
    <div className="ex-actions">
      <button className="btn btn-primary btn-lg" disabled={disabled} onClick={onClick}>
        {t('check')}
      </button>
    </div>
  );
}

function stopKey(e: ReactKeyboardEvent) {
  e.preventDefault();
  e.stopPropagation();
}

/* ------------------------------------------------------------------ */
/* Multiple choice                                                     */
/* ------------------------------------------------------------------ */

function McqView({ ex, seed, locked, onResult }: Props<McqExercise>) {
  const { t } = useT();
  const { speak } = useSpeak();
  const order = useMemo(() => shuffle(ex.options.map((_, i) => i), rng(seed)), [ex, seed]);
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    if (ex.audio) speak(ex.audio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex]);

  const check = () => {
    if (sel === null) return;
    const answerText = ex.options[ex.answer];
    onResult({ correct: sel === ex.answer, answer: ex.prompt.includes('___') ? ex.prompt.replace('___', answerText) : answerText });
  };

  useEffect(() => {
    if (locked) return;
    const h = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= order.length) setSel(order[n - 1]);
      if (e.key === 'Enter' && sel !== null) {
        e.preventDefault();
        e.stopImmediatePropagation();
        check();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  return (
    <div>
      <div className="ex-instruction">{ex.audio ? t('whichDidYouHear') : t('ex_mcq')}</div>
      {ex.audio && (
        <div className="audio-hero">
          <button className="audio-big" onClick={() => speak(ex.audio!)} aria-label={t('listen')}>
            <Volume2 size={36} />
          </button>
          <button className="audio-big slow" onClick={() => speak(ex.audio!, { slow: true })} aria-label={t('slow')}>
            <Turtle size={26} />
          </button>
        </div>
      )}
      {ex.prompt && (
        <div className={cx('ex-prompt', !isArabic(ex.prompt) && 'en')} dir={isArabic(ex.prompt) ? 'rtl' : 'ltr'}>
          <WithBlank text={ex.prompt} fill={locked ? ex.options[ex.answer] : sel !== null && ex.prompt.includes('___') ? ex.options[sel] : undefined} />
        </div>
      )}
      {ex.promptAr && <div className="ex-prompt-ar">{ex.promptAr}</div>}
      <div className="options">
        {order.map((oi, k) => {
          const state = locked ? (oi === ex.answer ? 'correct' : oi === sel ? 'wrong' : '') : oi === sel ? 'selected' : '';
          const text = ex.options[oi];
          return (
            <button key={oi} className={cx('option', state)} disabled={locked} onClick={() => setSel(oi)}>
              <span className="key">{k + 1}</span>
              <span className={cx(!isArabic(text) && 'en')} dir="auto" style={{ flex: 1, textAlign: 'start' }}>
                {text}
              </span>
            </button>
          );
        })}
      </div>
      {!locked && <CheckButton disabled={sel === null} onClick={check} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* True / false                                                        */
/* ------------------------------------------------------------------ */

function TfView({ ex, locked, onResult }: Props<TrueFalseExercise>) {
  const { t } = useT();
  const [sel, setSel] = useState<boolean | null>(null);
  const check = () => sel !== null && onResult({ correct: sel === ex.answer, answer: ex.answer ? t('true') : t('false') });
  return (
    <div>
      <div className="ex-instruction">{t('ex_tf')}</div>
      <En className="ex-prompt" as="div">
        {ex.statement}
      </En>
      <div className="options grid-2 grid" style={{ marginTop: 16 }}>
        {[true, false].map((v) => {
          const state = locked ? (v === ex.answer ? 'correct' : v === sel ? 'wrong' : '') : v === sel ? 'selected' : '';
          return (
            <button key={String(v)} className={cx('option', state)} disabled={locked} onClick={() => setSel(v)} style={{ justifyContent: 'center' }}>
              {v ? `✔ ${t('true')}` : `✘ ${t('false')}`}
            </button>
          );
        })}
      </div>
      {!locked && <CheckButton disabled={sel === null} onClick={check} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gap fill                                                            */
/* ------------------------------------------------------------------ */

function GapView({ ex, locked, onResult }: Props<GapExercise>) {
  const { t } = useT();
  const [value, setValue] = useState('');
  const [verdict, setVerdict] = useState<'correct' | 'wrong' | null>(null);
  const [showHint, setShowHint] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const [before, after] = ex.sentence.split('___');

  const check = () => {
    if (!value.trim()) return;
    // Gap fills test exact forms (watches, studied…): no typo tolerance.
    const r = checkAnswer(value, ex.answers, false);
    setVerdict(r.verdict === 'correct' ? 'correct' : 'wrong');
    onResult({ correct: r.verdict === 'correct', answer: `${before}${ex.answers[0]}${after ?? ''}` });
  };

  return (
    <div>
      <div className="ex-instruction">{t('ex_gap')}</div>
      <div className="gap-line en" dir="ltr">
        {before}
        <input
          ref={ref}
          className={cx('gap-input', verdict)}
          value={value}
          disabled={locked}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          size={Math.max(6, value.length + 1, ex.answers[0].length)}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              stopKey(e);
              if (!locked) check();
            }
          }}
          aria-label={t('ex_gap')}
        />
        {after}
      </div>
      {ex.ar && <div className="ex-prompt-ar" dir="rtl">{ex.ar}</div>}
      {ex.hint && !locked && (
        <div style={{ marginTop: 10 }}>
          {showHint ? (
            <span className="chip">
              <Lightbulb size={14} /> <En>{ex.hint}</En>
            </span>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowHint(true)}>
              <Lightbulb size={16} /> {t('hint')}
            </button>
          )}
        </div>
      )}
      {!locked && <CheckButton disabled={!value.trim()} onClick={check} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Word order (tiles)                                                  */
/* ------------------------------------------------------------------ */

const stripEdgePunct = (w: string) => w.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');

function OrderView({ ex, seed, locked, onResult }: Props<OrderExercise>) {
  const { t } = useT();
  const { speak } = useSpeak();
  const tiles = useMemo(() => {
    const words = tokenize(ex.en).map(stripEdgePunct).filter(Boolean);
    const all = [...words, ...(ex.distractors ?? [])];
    return shuffle(
      all.map((w, i) => ({ id: i, w })),
      rng(seed),
    );
  }, [ex, seed]);
  const [picked, setPicked] = useState<number[]>([]);
  const byId = new Map(tiles.map((x) => [x.id, x.w]));

  const check = () => {
    const sentence = picked.map((id) => byId.get(id)).join(' ');
    const r = checkAnswer(sentence, [ex.en], false);
    onResult({ correct: r.verdict === 'correct', answer: ex.en });
    speak(ex.en);
  };

  return (
    <div>
      <div className="ex-instruction">{t('ex_order')}</div>
      <div className="ex-prompt" dir="rtl" style={{ fontSize: '1.2rem' }}>
        {ex.ar}
      </div>
      <div className="tiles-answer" dir="ltr">
        {picked.map((id) => (
          <button key={id} className="tile" disabled={locked} onClick={() => setPicked((p) => p.filter((x) => x !== id))}>
            {byId.get(id)}
          </button>
        ))}
      </div>
      <div className="tiles-bank" dir="ltr">
        {tiles.map((tile) => {
          const used = picked.includes(tile.id);
          return (
            <button
              key={tile.id}
              className={cx('tile', used && 'ghost')}
              disabled={used || locked}
              onClick={() => {
                setPicked((p) => [...p, tile.id]);
                speak(tile.w, { id: `tile-${tile.id}` });
              }}
            >
              {tile.w}
            </button>
          );
        })}
      </div>
      {!locked && (
        <div className="ex-actions">
          <button className="btn btn-ghost" disabled={!picked.length} onClick={() => setPicked([])}>
            <RotateCcw size={16} /> {t('clear')}
          </button>
          <button className="btn btn-primary btn-lg" disabled={!picked.length} onClick={check}>
            {t('check')}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Free typing: translation & dictation                                */
/* ------------------------------------------------------------------ */

function TypeBox({ value, onChange, onSubmit, locked }: { value: string; onChange: (v: string) => void; onSubmit: () => void; locked: boolean }) {
  const { t } = useT();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <textarea
      ref={ref}
      className="textarea en"
      dir="ltr"
      style={{ minHeight: 110 }}
      placeholder={t('typeHere')}
      value={value}
      disabled={locked}
      autoCapitalize="sentences"
      autoCorrect="off"
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          stopKey(e);
          if (!locked && value.trim()) onSubmit();
        }
      }}
    />
  );
}

function TranslateView({ ex, locked, onResult }: Props<TranslateExercise>) {
  const { t } = useT();
  const [value, setValue] = useState('');
  const check = () => {
    const r = checkAnswer(value, ex.answers);
    onResult({ correct: r.verdict !== 'wrong', typo: r.verdict === 'typo', answer: r.closest });
  };
  return (
    <div>
      <div className="ex-instruction">{t('ex_translate')}</div>
      <div className="ex-prompt" dir="rtl" style={{ marginBottom: 16 }}>
        {ex.ar}
      </div>
      <TypeBox value={value} onChange={setValue} onSubmit={check} locked={locked} />
      {!locked && <CheckButton disabled={!value.trim()} onClick={check} />}
    </div>
  );
}

function ListenView({ ex, locked, onResult }: Props<ListenExercise>) {
  const { t } = useT();
  const { speak } = useSpeak();
  const [value, setValue] = useState('');
  useEffect(() => {
    speak(ex.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex]);
  const check = () => {
    const r = checkAnswer(value, [ex.text]);
    onResult({ correct: r.verdict !== 'wrong', typo: r.verdict === 'typo', answer: ex.text + (ex.ar ? `\n${ex.ar}` : '') });
  };
  return (
    <div>
      <div className="ex-instruction">{t('ex_listen')}</div>
      <div className="audio-hero">
        <button className="audio-big" onClick={() => speak(ex.text)} aria-label={t('listen')}>
          <Volume2 size={36} />
        </button>
        <button className="audio-big slow" onClick={() => speak(ex.text, { slow: true })} aria-label={t('slow')}>
          <Turtle size={26} />
        </button>
      </div>
      <TypeBox value={value} onChange={setValue} onSubmit={check} locked={locked} />
      {!locked && <CheckButton disabled={!value.trim()} onClick={check} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Matching pairs                                                      */
/* ------------------------------------------------------------------ */

function MatchView({ ex, seed, locked, onResult }: Props<MatchExercise>) {
  const { t } = useT();
  const { speak } = useSpeak();
  const [left, right] = useMemo(() => {
    const random = rng(seed);
    return [shuffle(ex.pairs.map((p, i) => ({ i, text: p[0] })), random), shuffle(ex.pairs.map((p, i) => ({ i, text: p[1] })), random)];
  }, [ex, seed]);
  const [selL, setSelL] = useState<number | null>(null);
  const [selR, setSelR] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [shake, setShake] = useState<string | null>(null);
  const mistakes = useRef(0);

  useEffect(() => {
    if (selL === null || selR === null) return;
    if (selL === selR) {
      const next = new Set(done).add(selL);
      setDone(next);
      setSelL(null);
      setSelR(null);
      if (next.size === ex.pairs.length) onResult({ correct: mistakes.current <= 1 });
    } else {
      mistakes.current += 1;
      setShake(`${selL}-${selR}`);
      setTimeout(() => {
        setShake(null);
        setSelL(null);
        setSelR(null);
      }, 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selL, selR]);

  const item = (side: 'l' | 'r', x: { i: number; text: string }) => {
    const sel = side === 'l' ? selL === x.i : selR === x.i;
    const isShaking = shake !== null && sel;
    const ltr = side === 'l' || ex.rightLtr;
    return (
      <button
        key={`${side}${x.i}`}
        className={cx('match-item', done.has(x.i) && 'done', sel && 'selected', isShaking && 'shake', ltr && 'en')}
        dir={ltr ? 'ltr' : 'rtl'}
        disabled={done.has(x.i) || locked}
        onClick={() => {
          if (side === 'l') {
            setSelL(x.i);
            speak(x.text, { id: `m${x.i}` });
          } else setSelR(x.i);
        }}
      >
        {x.text}
      </button>
    );
  };

  return (
    <div>
      <div className="ex-instruction">{t('ex_match')}</div>
      <div className="match-grid">
        <div className="match-col">{left.map((x) => item('l', x))}</div>
        <div className="match-col">{right.map((x) => item('r', x))}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Speaking                                                            */
/* ------------------------------------------------------------------ */

export function SpeakPractice({
  text,
  ar,
  onDone,
  compact = false,
}: {
  text: string;
  ar?: string;
  onDone?: (r: ExerciseResult & { score?: number }) => void;
  compact?: boolean;
}) {
  const { t } = useT();
  const { speak } = useSpeak();
  const accent = useProgress((s) => s.settings.accent);
  const [state, setState] = useState<'idle' | 'listening' | 'result' | 'error'>('idle');
  const [heard, setHeard] = useState('');
  const [score, setScore] = useState(0);
  const [matched, setMatched] = useState<boolean[]>([]);
  const [error, setError] = useState('');
  const handle = useRef<ListenHandle | null>(null);
  const supported = recognitionSupported();
  const words = tokenize(text);

  useEffect(() => () => handle.current?.stop(), []);

  const start = () => {
    setError('');
    setState('listening');
    handle.current = listenOnce(
      accent,
      (alts) => {
        let best = { score: -1, heard: '', matched: [] as boolean[] };
        for (const a of alts) {
          const s = speechSimilarity(a, text);
          if (s.score > best.score) best = { score: s.score, heard: a, matched: s.matched };
        }
        setHeard(best.heard);
        setScore(best.score);
        setMatched(best.matched);
        setState('result');
        if (best.score >= 0.75) onDone?.({ correct: true, answer: text, score: best.score });
      },
      (code) => {
        setError(code === 'not-allowed' || code === 'service-not-allowed' ? t('micDenied') : t('noSpeech'));
        setState('error');
      },
      () => setState((s) => (s === 'listening' ? 'idle' : s)),
    );
    if (!handle.current) {
      setError(t('notSupported'));
      setState('error');
    }
  };

  // Map normalised-word matches back onto displayed tokens (same count in practice).
  const displayMatched = (i: number) => (matched.length === words.length ? matched[i] : undefined);

  return (
    <div className={compact ? '' : 'center'}>
      <div className="row" style={{ justifyContent: compact ? 'flex-start' : 'center', gap: 8, flexWrap: 'wrap' }}>
        <En className="ex-prompt" as="div">
          {state === 'result'
            ? words.map((w, i) => (
                <span key={i} className={cx('heard-word', displayMatched(i) === true && 'ok', displayMatched(i) === false && 'miss')}>
                  {w}
                </span>
              ))
            : text}
        </En>
        <button className="icon-btn" onClick={() => speak(text)} aria-label={t('listen')}>
          <Volume2 size={20} />
        </button>
        <button className="icon-btn" onClick={() => speak(text, { slow: true })} aria-label={t('slow')}>
          <Turtle size={20} />
        </button>
      </div>
      {ar && (
        <div className="ex-prompt-ar" dir="rtl">
          {ar}
        </div>
      )}

      {supported ? (
        <>
          <button
            className={cx('mic-btn', state === 'listening' && 'recording')}
            style={compact ? { width: 64, height: 64, margin: '12px 0' } : undefined}
            onClick={() => (state === 'listening' ? handle.current?.stop() : start())}
            aria-label={t('tapToSpeak')}
          >
            <Mic size={compact ? 28 : 40} />
          </button>
          <div className="faint small">{state === 'listening' ? t('listening') : t('tapToSpeak')}</div>
          {state === 'result' && (
            <div style={{ marginTop: 10 }}>
              <div className="small">
                <span className="faint">{t('weHeard')}</span> <En className="bold">“{heard}”</En>
              </div>
              <div className="bold" style={{ color: score >= 0.75 ? 'var(--success)' : 'var(--warning)', marginTop: 4 }}>
                {Math.round(score * 100)}%
              </div>
              {score < 0.75 && onDone && (
                <div className="row" style={{ justifyContent: compact ? 'flex-start' : 'center', marginTop: 10 }}>
                  <button className="btn btn-sm" onClick={start}>
                    <RotateCcw size={14} /> {t('retry')}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onDone({ correct: false, answer: text, score })}>
                    {t('continue')}
                  </button>
                </div>
              )}
            </div>
          )}
          {state === 'error' && <div className="small" style={{ color: 'var(--danger)', marginTop: 8 }}>{error}</div>}
        </>
      ) : (
        <div className="note info small" style={{ marginTop: 14, textAlign: 'start' }}>
          {t('speechUnsupported')}
        </div>
      )}
      {onDone && state !== 'result' && (
        <div className="row" style={{ justifyContent: compact ? 'flex-start' : 'center', marginTop: 14, flexWrap: 'wrap' }}>
          {!supported && (
            <button className="btn btn-soft" onClick={() => onDone({ correct: true, selfReported: true, answer: text })}>
              {t('iSaidIt')}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => onDone({ correct: true, skipped: true, answer: text })}>
            {t('canNotSpeak')}
          </button>
        </div>
      )}
    </div>
  );
}

function SpeakView({ ex, locked, onResult }: Props<SpeakExercise>) {
  const { t } = useT();
  return (
    <div>
      <div className="ex-instruction">{t('ex_speak')}</div>
      {!locked ? <SpeakPractice text={ex.text} ar={ex.ar} onDone={onResult} /> : <En className="ex-prompt" as="div">{ex.text}</En>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Error correction                                                    */
/* ------------------------------------------------------------------ */

function FixView({ ex, locked, onResult }: Props<FixExercise>) {
  const { t } = useT();
  const tokens = tokenize(ex.sentence);
  const wrongBare = bareWord(ex.wrong);
  const [sel, setSel] = useState<number | null>(null);
  const check = () => {
    if (sel === null) return;
    onResult({ correct: bareWord(tokens[sel]) === wrongBare, answer: ex.correct });
  };
  return (
    <div>
      <div className="ex-instruction">{t('ex_fix')}</div>
      <div className="row row-wrap en" dir="ltr" style={{ gap: 4, justifyContent: 'center', margin: '18px 0' }}>
        {tokens.map((tok, i) => {
          const isWrong = bareWord(tok) === wrongBare;
          const state = locked ? (isWrong ? 'wrong' : i === sel ? 'selected' : '') : i === sel ? 'selected' : '';
          return (
            <button key={i} className={cx('tile-word', state)} disabled={locked} onClick={() => setSel(i)}>
              {tok}
            </button>
          );
        })}
      </div>
      {!locked && <CheckButton disabled={sel === null} onClick={check} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function ExerciseView(props: Props<Exercise>) {
  const { ex } = props;
  switch (ex.type) {
    case 'mcq':
      return <McqView {...props} ex={ex} />;
    case 'tf':
      return <TfView {...props} ex={ex} />;
    case 'gap':
      return <GapView {...props} ex={ex} />;
    case 'order':
      return <OrderView {...props} ex={ex} />;
    case 'translate':
      return <TranslateView {...props} ex={ex} />;
    case 'listen':
      return <ListenView {...props} ex={ex} />;
    case 'match':
      return <MatchView {...props} ex={ex} />;
    case 'speak':
      return <SpeakView {...props} ex={ex} />;
    case 'fix':
      return <FixView {...props} ex={ex} />;
  }
}
