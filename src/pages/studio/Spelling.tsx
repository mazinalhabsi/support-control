import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { RotateCcw, Volume2, Turtle } from 'lucide-react';
import { useT } from '../../i18n';
import { useProgress } from '../../store/progress';
import { useSpeak } from '../../hooks/useSpeech';
import { checkAnswer } from '../../lib/answer';
import { sfx } from '../../lib/sfx';
import { sample } from '../../lib/util';
import { En, ProgressBar } from '../../components/ui';
import { sparkAt } from '../../components/fx/Celebrate';
import { haptic } from '../../motion/core';
import { shake } from '../../motion/hooks';
import { ResultPanel, StudioFrame, wordPool } from './common';

const ROUND = 10;

/** Spelling bee: hear a word, type it exactly. No typo forgiveness here. */
export function Spelling() {
  const { t } = useT();
  const [round, setRound] = useState(0);
  return (
    <StudioFrame icon="spelling" title={t('modeSpelling')} intro={t('spellingIntro')}>
      <Round key={round} onAgain={() => setRound((r) => r + 1)} />
    </StudioFrame>
  );
}

function Round({ onAgain }: { onAgain: () => void }) {
  const { t, num } = useT();
  const { speak } = useSpeak();
  const srs = useProgress((s) => s.srs);
  const lessons = useProgress((s) => s.lessons);
  const startLevel = useProgress((s) => s.profile?.startLevel ?? 'A1');
  const sounds = useProgress((s) => s.settings.sounds);
  const addXp = useProgress((s) => s.addXp);
  const recordAnswer = useProgress((s) => s.recordAnswer);
  const recordStudio = useProgress((s) => s.recordStudio);
  // single words only: phrases are for dictation, not spelling
  const words = useMemo(
    () =>
      sample(
        wordPool(srs, lessons, startLevel, 40).filter((w) => /^[A-Za-z][a-z'-]{2,}$/.test(w.item.word)),
        ROUND,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [i, setI] = useState(0);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<null | boolean>(null);
  const [right, setRight] = useState(0);
  const [done, setDone] = useState<{ xp: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const word = words[i];

  useEffect(() => {
    if (!word) return;
    const id = setTimeout(() => speak(word.item.word), 300);
    inputRef.current?.focus();
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const submit = () => {
    if (!word || result !== null || !value.trim()) return;
    const ok = checkAnswer(value, [word.item.word], false).verdict === 'correct';
    setResult(ok);
    recordAnswer(`spell:${word.item.id}`, 'writing', ok);
    if (ok) {
      setRight((r) => r + 1);
      sparkAt(inputRef.current, { count: 10 });
      haptic(10);
      if (sounds) sfx.correct();
    } else {
      shake(boxRef.current);
      if (sounds) sfx.wrong();
    }
  };

  const next = () => {
    if (i + 1 < words.length) {
      setI(i + 1);
      setValue('');
      setResult(null);
      return;
    }
    const xp = right * 2;
    addXp(xp);
    recordStudio('spelling', Math.round((right / words.length) * 100));
    if (sounds) sfx.complete();
    setDone({ xp });
  };

  if (!word && !done) return <div className="card center muted">{t('needLessons')}</div>;
  if (done) {
    return (
      <ResultPanel icon="spelling" score={right} suffix={`/${words.length}`} xp={done.xp}>
        <button className="btn btn-primary" onClick={onAgain}>
          <RotateCcw size={16} /> {t('playAgain')}
        </button>
      </ResultPanel>
    );
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 18, gap: 12 }}>
        <ProgressBar value={i / words.length} />
        <span className="small faint num" style={{ flex: 'none' }}>
          {num(i + 1)}/{num(words.length)}
        </span>
      </div>
      <AnimatePresence mode="wait">
        <m.div
          key={i}
          className="card center"
          style={{ padding: '30px 20px' }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
        >
          <div className="audio-hero">
            <button className="audio-big" onClick={() => speak(word.item.word)} aria-label={t('listen')}>
              <Volume2 size={36} />
            </button>
            <button className="audio-big slow" onClick={() => speak(word.item.word, { slow: true })} aria-label={t('slow')}>
              <Turtle size={24} />
            </button>
          </div>
          <div className="muted" dir="rtl" style={{ marginBottom: 14 }}>
            {word.item.ar}
          </div>
          <div ref={boxRef}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (result === null) submit();
                else next();
              }}
              className="row"
              style={{ maxWidth: 420, margin: '0 auto' }}
            >
              <input
                ref={inputRef}
                className={`input en grow spell-input ${result === true ? 'ok' : result === false ? 'bad' : ''}`}
                dir="ltr"
                value={value}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder={t('typeTheWord')}
                aria-label={t('typeTheWord')}
                onChange={(e) => setValue(e.target.value)}
                readOnly={result !== null}
              />
              <button className="btn btn-primary">{result === null ? t('check') : t('next')}</button>
            </form>
          </div>
          {result === false && (
            <div className="small" style={{ marginTop: 12 }}>
              <span className="faint">{t('correctSpelling')}: </span>
              <En className="bold spell-answer">{word.item.word}</En>
            </div>
          )}
        </m.div>
      </AnimatePresence>
    </div>
  );
}
