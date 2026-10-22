import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Check, X, RotateCcw } from 'lucide-react';
import { useT } from '../../i18n';
import { useProgress } from '../../store/progress';
import { sfx } from '../../lib/sfx';
import { shuffle } from '../../lib/util';
import type { VocabRef } from '../../content';
import { En } from '../../components/ui';
import { sparkAt } from '../../components/fx/Celebrate';
import { haptic } from '../../motion/core';
import { shake } from '../../motion/hooks';
import { ResultPanel, StudioFrame, wordPool } from './common';

const DURATION = 60;

interface Card {
  word: VocabRef;
  shown: string;
  truth: boolean;
}

function makeCard(pool: VocabRef[]): Card {
  const word = pool[Math.floor(Math.random() * pool.length)];
  if (Math.random() < 0.5) return { word, shown: word.item.ar, truth: true };
  const others = pool.filter((p) => p.item.ar !== word.item.ar);
  const decoy = others[Math.floor(Math.random() * others.length)] ?? word;
  return { word, shown: decoy.item.ar, truth: decoy === word };
}

/** Word sprint: 60 seconds of right/wrong calls on translations; streaks multiply. */
export function Sprint() {
  const { t, num } = useT();
  const record = useProgress((s) => s.studio.sprint);
  const srs = useProgress((s) => s.srs);
  const lessons = useProgress((s) => s.lessons);
  const startLevel = useProgress((s) => s.profile?.startLevel ?? 'A1');
  const pool = useMemo(() => shuffle(wordPool(srs, lessons, startLevel, 30)), [srs, lessons, startLevel]);
  const [round, setRound] = useState(0);
  const [started, setStarted] = useState(false);
  return (
    <StudioFrame icon="sprint" title={t('modeSprint')} intro={t('sprintIntro')}>
      {!started ? (
        <div className="sprint-start">
          <div className="sprint-card sprint-preview" aria-hidden="true">
            <div className="sprint-pair">
              <En as="div" className="sprint-word">
                {pool[0]?.item.word ?? 'hello'}
              </En>
              <div className="sprint-eq">=</div>
              <div className="sprint-ar" dir="rtl">
                {pool[0]?.item.ar ?? 'مرحبًا'}
              </div>
            </div>
          </div>
          {record && (
            <div className="studio-stats" style={{ justifyContent: 'center' }}>
              <span>
                {t('bestScore')} <b className="num">{num(record.best)}</b>
              </span>
              <span>
                {t('played')} <b className="num">{num(record.plays)}</b>
              </span>
            </div>
          )}
          <button className="btn btn-primary btn-lg" style={{ minWidth: 220 }} onClick={() => setStarted(true)}>
            {t('sprintGo')}
          </button>
          <div className="small faint">{t('keysHint')}</div>
        </div>
      ) : (
        <Game key={round} pool={pool} onAgain={() => setRound((r) => r + 1)} />
      )}
    </StudioFrame>
  );
}

function Game({ pool, onAgain }: { pool: VocabRef[]; onAgain: () => void }) {
  const { t, num } = useT();
  const sounds = useProgress((s) => s.settings.sounds);
  const best = useProgress((s) => s.studio.sprint?.best ?? 0);
  const addXp = useProgress((s) => s.addXp);
  const recordStudio = useProgress((s) => s.recordStudio);
  const recordAnswer = useProgress((s) => s.recordAnswer);
  const [card, setCard] = useState(() => makeCard(pool));
  const [left, setLeft] = useState(DURATION);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [stats, setStats] = useState({ right: 0, total: 0 });
  const [over, setOver] = useState<{ xp: number; best: boolean } | null>(null);
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const bestBefore = useRef(best);

  useEffect(() => {
    if (over) return;
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [over]);

  useEffect(() => {
    if (left > 0 || over) return;
    const xp = Math.max(1, Math.round(score / 25));
    addXp(xp);
    recordStudio('sprint', score);
    if (sounds) sfx.complete();
    setOver({ xp, best: score > bestBefore.current && score > 0 });
  }, [left, over, score, addXp, recordStudio, sounds]);

  const answer = useCallback(
    (sayTrue: boolean, from?: Element | null) => {
      if (over) return;
      const ok = sayTrue === card.truth;
      recordAnswer(`sprint:${card.word.item.id}`, 'vocabulary', ok);
      setStats((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
      if (ok) {
        const mult = Math.min(4, 1 + Math.floor(combo / 3));
        setScore((s) => s + 10 * mult);
        setCombo((c) => c + 1);
        sparkAt(from ?? cardRef.current, { count: 6 + mult * 2 });
        haptic(8);
        if (sounds) sfx.correct();
      } else {
        setCombo(0);
        shake(cardRef.current);
        haptic([20, 30, 20]);
        if (sounds) sfx.wrong();
      }
      setFlash(ok ? 'ok' : 'bad');
      setTimeout(() => setFlash(null), 220);
      setCard(makeCard(pool));
    },
    [over, card, combo, pool, recordAnswer, sounds],
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') answer(true);
      else if (e.key === 'ArrowLeft') answer(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [answer]);

  if (over) {
    return (
      <ResultPanel icon="sprint" score={score} xp={over.xp} best={over.best}>
        <div className="small muted" style={{ width: '100%', marginBottom: 6 }}>
          {num(stats.right)}/{num(stats.total)} · {t('bestScore')}: {num(Math.max(score, bestBefore.current))}
        </div>
        <button className="btn btn-primary" onClick={onAgain}>
          <RotateCcw size={16} /> {t('playAgain')}
        </button>
      </ResultPanel>
    );
  }

  const mult = Math.min(4, 1 + Math.floor(combo / 3));
  return (
    <div className="sprint">
      <div className="sprint-hud">
        <span className="num sprint-score">{num(score)}</span>
        <div className="sprint-time">
          <m.span animate={{ scaleX: left / DURATION }} transition={{ duration: 1, ease: 'linear' }} style={{ originX: 0 }} />
        </div>
        <span className="num">{num(left)}</span>
      </div>
      <div className={`sprint-combo ${mult > 1 ? 'hot' : ''}`}>
        {t('combo')} ×{num(mult)}
      </div>
      <div ref={cardRef} className={`sprint-card ${flash ?? ''}`}>
        <AnimatePresence mode="popLayout" initial={false}>
          <m.div
            key={`${card.word.item.id}:${card.shown}:${stats.total}`}
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            className="sprint-pair"
          >
            <En as="div" className="sprint-word">
              {card.word.item.word}
            </En>
            <div className="sprint-eq">=</div>
            <div className="sprint-ar" dir="rtl">
              {card.shown}
            </div>
          </m.div>
        </AnimatePresence>
      </div>
      {/* physical order matches the arrow keys in both reading directions */}
      <div className="sprint-buttons" dir="ltr">
        <m.button whileTap={{ scale: 0.94 }} className="btn btn-lg sprint-no" onClick={(e) => answer(false, e.currentTarget)}>
          <X size={20} /> {t('isWrong')}
        </m.button>
        <m.button whileTap={{ scale: 0.94 }} className="btn btn-lg sprint-yes" onClick={(e) => answer(true, e.currentTarget)}>
          <Check size={20} /> {t('isRight')}
        </m.button>
      </div>
    </div>
  );
}
