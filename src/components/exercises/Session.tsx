import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';
import type { PracticeItem } from '../../lib/practice';
import { hashString, cx } from '../../lib/util';
import { sfx } from '../../lib/sfx';
import { useT } from '../../i18n';
import { useProgress } from '../../store/progress';
import { ExerciseView, type ExerciseResult } from './Exercises';
import { ConfirmButton, ProgressBar } from '../ui';

export interface SessionStats {
  total: number;
  firstTryCorrect: number;
  xp: number;
  durationMs: number;
}

const XP_FIRST_TRY = 10;
const XP_RETRY = 5;

/**
 * Runs a queue of exercises with mastery learning: an item answered wrongly
 * is shown again at the end of the session (once), so the learner always
 * finishes having produced the right answer.
 */
export function Session({ items, onFinish, onQuit }: { items: PracticeItem[]; onFinish: (s: SessionStats) => void; onQuit: () => void }) {
  const { t, rich } = useT();
  const recordAnswer = useProgress((s) => s.recordAnswer);
  const addXp = useProgress((s) => s.addXp);
  const sounds = useProgress((s) => s.settings.sounds);

  const [queue, setQueue] = useState<PracticeItem[]>(items);
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState<ExerciseResult | null>(null);
  const firstTry = useRef(new Map<string, boolean>());
  const requeued = useRef(new Set<string>());
  const xp = useRef(0);
  const started = useRef(Date.now());
  const resultAt = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const item = queue[idx];

  const handleResult = (r: ExerciseResult) => {
    resultAt.current = Date.now();
    setResult(r);
    const seenBefore = firstTry.current.has(item.key);
    if (!seenBefore) {
      firstTry.current.set(item.key, r.correct);
      if (!r.selfReported && !r.skipped) recordAnswer(item.key, item.skill, r.correct);
    }
    if (r.correct && !r.skipped) {
      const gained = seenBefore ? XP_RETRY : XP_FIRST_TRY;
      xp.current += gained;
      addXp(gained);
    }
    if (!r.correct && !requeued.current.has(item.key)) {
      requeued.current.add(item.key);
      setQueue((q) => [...q, item]);
    }
    if (sounds && !r.skipped) (r.correct ? sfx.correct : sfx.wrong)();
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
  };

  const next = () => {
    if (idx + 1 >= queue.length) {
      const values = [...firstTry.current.values()];
      if (sounds) sfx.complete();
      onFinish({
        total: values.length,
        firstTryCorrect: values.filter(Boolean).length,
        xp: xp.current,
        durationMs: Date.now() - started.current,
      });
      return;
    }
    setResult(null);
    setIdx((i) => i + 1);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    if (!result) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && Date.now() - resultAt.current > 250) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (!item) return null;

  const ex = item.exercise;
  const verdict = result ? (result.correct ? (result.typo ? 'typo' : 'ok') : 'bad') : null;
  const showAnswer = result && (!result.correct || result.typo) && result.answer;

  return (
    <div className="session">
      <div className="session-top">
        {idx === 0 ? (
          <button className="icon-btn" aria-label={t('quit')} onClick={onQuit}>
            <X size={20} />
          </button>
        ) : (
          <ConfirmButton className="icon-btn" ariaLabel={t('quit')} onConfirm={onQuit} confirmLabel={<span className="tiny bold">{t('quitConfirm')}</span>}>
            <X size={20} />
          </ConfirmButton>
        )}
        <ProgressBar value={(idx + (result ? 1 : 0)) / queue.length} variant="success" />
        <span className="faint small en nowrap">
          {Math.min(idx + 1, queue.length)}/{queue.length}
        </span>
      </div>

      <ExerciseView key={`${item.key}-${idx}`} ex={ex} seed={hashString(item.key) + idx} locked={!!result} onResult={handleResult} />

      {result && !result.skipped && (
        <div className={cx('feedback', verdict)} role="status" aria-live="polite">
          <h3>
            {verdict === 'ok' ? <CheckCircle2 /> : verdict === 'typo' ? <AlertCircle /> : <XCircle />}
            {verdict === 'ok' ? t('correct') : verdict === 'typo' ? t('almost') : t('incorrect')}
          </h3>
          {showAnswer && (
            <div>
              <span className="small">{t('correctAnswer')}</span>{' '}
              {result.answer!.split('\n').map((line, i) => (
                <div key={i} className={i === 0 ? 'answer en' : 'small'} dir={i === 0 ? 'ltr' : 'rtl'}>
                  {line}
                </div>
              ))}
            </div>
          )}
          {ex.explain && <div className="why">{rich(ex.explain)}</div>}
          <div className="ex-actions" style={{ marginTop: 12 }}>
            <button className={cx('btn btn-lg', result.correct ? 'btn-success' : 'btn-danger')} onClick={next} autoFocus>
              {t('continue')}
            </button>
          </div>
        </div>
      )}
      {result?.skipped && (
        <div className="ex-actions">
          <button className="btn btn-primary btn-lg" onClick={next} autoFocus>
            {t('continue')}
          </button>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
