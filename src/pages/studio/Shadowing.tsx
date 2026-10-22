import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { RotateCcw } from 'lucide-react';
import { useT } from '../../i18n';
import { useProgress } from '../../store/progress';
import { useSpeak } from '../../hooks/useSpeech';
import { sfx } from '../../lib/sfx';
import { ProgressBar } from '../../components/ui';
import { SpeakPractice } from '../../components/exercises/Exercises';
import { DialoguePicker, ResultPanel, StudioFrame, type DialogueSource } from './common';

/**
 * Shadowing: hear a line, echo it at once with the same rhythm and melody.
 * Every line of the dialogue, both speakers, slow replay available.
 */
export function Shadowing() {
  const { t } = useT();
  const [source, setSource] = useState<DialogueSource | null>(null);
  return (
    <StudioFrame icon="shadowing" title={t('modeShadowing')} intro={t('shadowIntro')}>
      {!source ? <DialoguePicker onPick={setSource} /> : <Run key={source.lessonId} source={source} onExit={() => setSource(null)} />}
    </StudioFrame>
  );
}

function Run({ source, onExit }: { source: DialogueSource; onExit: () => void }) {
  const { t, num } = useT();
  const { speak } = useSpeak();
  const sounds = useProgress((s) => s.settings.sounds);
  const addXp = useProgress((s) => s.addXp);
  const recordAnswer = useProgress((s) => s.recordAnswer);
  const recordStudio = useProgress((s) => s.recordStudio);
  const [i, setI] = useState(0);
  const scores = useRef<number[]>([]);
  const [finished, setFinished] = useState<{ score: number; xp: number } | null>(null);
  const line = source.lines[i];

  // Model the line first: the learner hears it before they try.
  useEffect(() => {
    if (line) {
      const id = setTimeout(() => speak(line.en), 350);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const next = (score: number) => {
    scores.current.push(score);
    recordAnswer(`shadow:${source.lessonId}:${i}`, 'speaking', score >= 0.75);
    if (i + 1 < source.lines.length) {
      setI(i + 1);
      return;
    }
    const avg = scores.current.reduce((a, b) => a + b, 0) / scores.current.length;
    const pct = Math.round(avg * 100);
    const xp = Math.round(source.lines.length * 2 + avg * 10);
    addXp(xp);
    recordStudio('shadowing', pct);
    if (sounds) sfx.complete();
    setFinished({ score: pct, xp });
  };

  if (finished) {
    return (
      <ResultPanel icon="shadowing" score={finished.score} suffix="%" xp={finished.xp}>
        <button className="btn btn-primary" onClick={onExit}>
          <RotateCcw size={16} /> {t('pickDialogue')}
        </button>
      </ResultPanel>
    );
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 18, gap: 12 }}>
        <ProgressBar value={i / source.lines.length} />
        <span className="small faint num" style={{ flex: 'none' }}>
          {num(i + 1)}/{num(source.lines.length)}
        </span>
      </div>
      <AnimatePresence mode="wait">
        <m.div
          key={i}
          className="card"
          style={{ padding: '28px 20px' }}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        >
          <div className="eyebrow center" style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            {line.speaker}
          </div>
          <SpeakPractice text={line.en} ar={line.ar} onDone={(r) => next(r.skipped ? 0 : r.selfReported ? 0.8 : (r.score ?? (r.correct ? 1 : 0)))} />
        </m.div>
      </AnimatePresence>
    </div>
  );
}
