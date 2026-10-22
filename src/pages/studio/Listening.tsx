import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Pause, Play, SkipForward } from 'lucide-react';
import { useT } from '../../i18n';
import { useProgress } from '../../store/progress';
import { useSpeak } from '../../hooks/useSpeech';
import { shuffle } from '../../lib/util';
import { En, LevelTag, Segmented } from '../../components/ui';
import { StudioFrame, wordPool } from './common';

type Phase = 'word' | 'recall' | 'meaning';

/**
 * Hands-free listening: word → silence to recall → meaning and example.
 * Built for walks and commutes; nothing to tap once it is playing.
 */
export function Listening() {
  const { t, num } = useT();
  const { speak, stop } = useSpeak();
  const srs = useProgress((s) => s.srs);
  const lessons = useProgress((s) => s.lessons);
  const startLevel = useProgress((s) => s.profile?.startLevel ?? 'A1');
  const showIPA = useProgress((s) => s.settings.showIPA);
  const addXp = useProgress((s) => s.addXp);
  const recordStudio = useProgress((s) => s.recordStudio);
  const [pauseSec, setPauseSec] = useState<'2' | '4' | '6'>('4');
  const pool = useMemo(() => shuffle(wordPool(srs, lessons, startLevel, 30)), [srs, lessons, startLevel]);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>('word');
  const [playing, setPlaying] = useState(false);
  const heard = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const word = pool[i % Math.max(1, pool.length)];

  // The playback loop: one effect per phase, each schedules the next.
  useEffect(() => {
    clearTimeout(timer.current);
    if (!playing || !word) return;
    if (phase === 'word') {
      speak(word.item.word, { id: 'hf-word', onEnd: () => setPhase('recall') });
      timer.current = setTimeout(() => setPhase('recall'), 4000);
    } else if (phase === 'recall') {
      timer.current = setTimeout(() => setPhase('meaning'), Number(pauseSec) * 1000);
    } else {
      speak(word.item.example, {
        id: 'hf-example',
        onEnd: () => {
          timer.current = setTimeout(() => {
            heard.current += 1;
            setI((n) => n + 1);
            setPhase('word');
          }, 1200);
        },
      });
    }
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, phase, i]);

  // Credit the session when the learner stops or leaves.
  useEffect(() => {
    if (playing) return;
    const n = heard.current;
    if (n >= 5) {
      addXp(Math.floor(n / 5) * 2);
      recordStudio('listening', n);
      heard.current = 0;
    }
  }, [playing, addXp, recordStudio]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      stop();
    },
    [stop],
  );

  const toggle = () => {
    if (playing) {
      stop();
      setPlaying(false);
    } else {
      setPhase('word');
      setPlaying(true);
    }
  };
  const skip = () => {
    stop();
    setI((n) => n + 1);
    setPhase('word');
  };

  return (
    <StudioFrame icon="listening" title={t('modeListening')} intro={t('listeningIntro')}>
      <div className="listen-stage">
        <AnimatePresence mode="wait">
          {word && (
            <m.div
              key={i}
              className="listen-card"
              initial={{ opacity: 0, y: 24, rotateX: -12 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -24, rotateX: 12 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            >
              <LevelTag level={word.level} />
              <En as="div" className="listen-word">
                {word.item.word}
              </En>
              {showIPA && word.item.ipa && <div className="ipa">{word.item.ipa}</div>}
              <div className={`listen-meaning ${phase === 'meaning' ? 'shown' : ''}`}>
                <div className="bold" dir="rtl" style={{ fontSize: '1.3rem' }}>
                  {word.item.ar}
                </div>
                <En as="div" className="muted">
                  {word.item.example}
                </En>
              </div>
              <div className="listen-phase">
                {(['word', 'recall', 'meaning'] as Phase[]).map((p) => (
                  <span key={p} className={p === phase && playing ? 'on' : ''} />
                ))}
              </div>
            </m.div>
          )}
        </AnimatePresence>
        <div className="row" style={{ justifyContent: 'center', gap: 14, marginTop: 22 }}>
          <button className="audio-big" onClick={toggle} aria-label={playing ? t('pause') : t('play')}>
            {playing ? <Pause size={34} /> : <Play size={34} />}
          </button>
          <button className="icon-btn" onClick={skip} aria-label={t('next')} title={t('next')}>
            <SkipForward size={18} />
          </button>
        </div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
          <span className="small faint">{t('recallPause')}</span>
          <Segmented<'2' | '4' | '6'>
            value={pauseSec}
            onChange={setPauseSec}
            options={(['2', '4', '6'] as const).map((v) => ({ value: v, label: `${num(Number(v))} ${t('seconds')}` }))}
          />
        </div>
      </div>
    </StudioFrame>
  );
}
