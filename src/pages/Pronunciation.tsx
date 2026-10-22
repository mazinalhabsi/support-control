import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ear, Lightbulb, Mic, Volume2, RotateCcw } from 'lucide-react';
import { PRONUNCIATION } from '../content/pronunciation';
import type { PronunciationTopic } from '../content/types';
import { rng } from '../lib/util';
import { sfx } from '../lib/sfx';
import { useSpeak } from '../hooks/useSpeech';
import { useT } from '../i18n';
import { useProgress } from '../store/progress';
import { SpeakPractice } from '../components/exercises/Exercises';
import { En, ProgressBar } from '../components/ui';
import { cx } from '../lib/util';
import { sparkAt } from '../components/fx/Celebrate';
import { haptic } from '../motion/core';
import { shake } from '../motion/hooks';
import { Icon3D } from '../components/Icon3D';

export function PronunciationList() {
  const { t, pct } = useT();
  const records = useProgress((s) => s.pronunciation);
  return (
    <div className="page">
      <div className="page-head with-object">
        <h1>{t('pronTitle')}</h1>
        <p>{t('pronSub')}</p>
        <Icon3D name="pronunciation" size={108} eager />
      </div>
      <div className="grid grid-auto">
        {PRONUNCIATION.map((p) => {
          const rec = records[p.id];
          return (
            <Link key={p.id} to={`/pronunciation/${p.id}`} className="tile-link" style={{ alignItems: 'flex-start' }}>
              <span className="phoneme">{p.sounds.join(' ')}</span>
              <span className="grow">
                <span className="bold" style={{ display: 'block' }}>
                  {p.titleAr}
                </span>
                <En className="small faint">{p.title}</En>
                {rec && (
                  <span className="small" style={{ display: 'block', color: 'var(--success)', fontWeight: 700 }}>
                    {t('score')}: {pct(rec.best)}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function PronunciationTopicPage() {
  const { id } = useParams();
  const topic = PRONUNCIATION.find((p) => p.id === id);
  if (!topic) return <div className="page">404</div>;
  return <TopicView key={topic.id} topic={topic} />;
}

function TopicView({ topic }: { topic: PronunciationTopic }) {
  const { t, rich, lang } = useT();
  const { speak, playing } = useSpeak();

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <Link to="/pronunciation" className="small">
          {lang === 'ar' ? '→' : '←'} {t('pronTitle')}
        </Link>
        <h1 style={{ marginTop: 8 }}>{topic.titleAr}</h1>
        <En className="muted" as="div">
          {topic.title}
        </En>
      </div>

      <div className="card">
        <div className="card-title">
          <Mic size={20} color="var(--primary)" /> {t('howToSay')}
        </div>
        <p>{rich(topic.how)}</p>
        <div className="note">
          <div className="note-title">
            <Lightbulb size={18} /> {t('arabicNote')}
          </div>
          <div dir="rtl">{rich(topic.arabicNote)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <Volume2 size={20} color="var(--lvl-A2)" /> {t('minimalPairs')}
        </div>
        {topic.homophones && (
          <div className="note info small" style={{ marginBottom: 12 }}>
            {t('homophonesNote')}
          </div>
        )}
        <div className="grid grid-2" style={{ gap: 10 }}>
          {topic.pairs.map((p, i) => (
            <div key={i} className="row" style={{ gap: 8 }}>
              {[p.a, p.b].map((w, j) => (
                <button
                  key={j}
                  className={cx('option', playing === `pair-${i}-${j}` && 'selected')}
                  style={{ minHeight: 48, justifyContent: 'space-between' }}
                  onClick={() => speak(w, { id: `pair-${i}-${j}` })}
                >
                  <En>{w}</En>
                  <Volume2 size={16} />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {!topic.homophones && <EarTraining topic={topic} />}

      <div className="card">
        <div className="card-title">
          <Mic size={20} color="var(--lvl-C2)" /> {t('practiceSentences')}
        </div>
        <div className="stack" style={{ gap: 18 }}>
          {topic.sentences.map((s) => (
            <div key={s} style={{ borderBottom: '1px dashed var(--border)', paddingBottom: 12 }}>
              <SpeakPractice text={s} compact />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ROUNDS = 10;

function EarTraining({ topic }: { topic: PronunciationTopic }) {
  const { t, num } = useT();
  const { speak } = useSpeak();
  const record = useProgress((s) => s.recordPronunciation);
  const addXp = useProgress((s) => s.addXp);
  const sounds = useProgress((s) => s.settings.sounds);
  const [seed, setSeed] = useState(() => Date.now());
  const rounds = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: ROUNDS }, () => {
      const pair = topic.pairs[Math.floor(r() * topic.pairs.length)];
      const pickA = r() < 0.5;
      return { pair, target: pickA ? pair.a : pair.b, flip: r() < 0.5 };
    });
  }, [seed, topic]);
  const [round, setRound] = useState(-1);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const current = rounds[round];
  const finished = round >= ROUNDS;

  const startRound = (n: number) => {
    setRound(n);
    setChosen(null);
    if (n < ROUNDS) setTimeout(() => speak(rounds[n].target), 150);
  };

  const choose = (w: string, el?: Element) => {
    if (chosen) return;
    setChosen(w);
    const ok = w === current.target;
    if (sounds) (ok ? sfx.correct : sfx.wrong)();
    if (ok) {
      sparkAt(el, { count: 10 });
      haptic(10);
    } else {
      shake(el ?? null);
      haptic([30, 40, 30]);
    }
    const newScore = score + (ok ? 1 : 0);
    setScore(newScore);
    if (round + 1 >= ROUNDS) {
      record(topic.id, newScore / ROUNDS);
      addXp(newScore);
    }
  };

  return (
    <div className="card">
      <div className="card-title">
        <Ear size={20} color="var(--accent)" /> {t('earTraining')}
      </div>
      {round < 0 ? (
        <>
          <p className="muted">{t('earTrainingDesc')}</p>
          <button className="btn btn-primary" onClick={() => startRound(0)}>
            {t('start')}
          </button>
        </>
      ) : finished ? (
        <div className="center">
          <div className="big-number" style={{ color: score >= 8 ? 'var(--success)' : 'var(--accent)' }}>
            {num(score)}/{num(ROUNDS)}
          </div>
          <button
            className="btn btn-soft"
            style={{ marginTop: 10 }}
            onClick={() => {
              setSeed(Date.now());
              setScore(0);
              setRound(-1);
            }}
          >
            <RotateCcw size={16} /> {t('playAgain')}
          </button>
        </div>
      ) : (
        <>
          <div className="row spread small faint" style={{ marginBottom: 8 }}>
            <span>
              {t('round')} {num(round + 1)}/{num(ROUNDS)}
            </span>
            <span>
              {t('score')}: {num(score)}
            </span>
          </div>
          <ProgressBar value={round / ROUNDS} thin />
          <div className="audio-hero" style={{ marginTop: 16 }}>
            <button className="audio-big" onClick={() => speak(current.target)} aria-label={t('replay')}>
              <Volume2 size={36} />
            </button>
          </div>
          <div className="grid grid-2" style={{ gap: 10 }}>
            {(current.flip ? [current.pair.b, current.pair.a] : [current.pair.a, current.pair.b]).map((w) => {
              const state = chosen ? (w === current.target ? 'correct' : w === chosen ? 'wrong' : '') : '';
              return (
                <button
                  key={w}
                  className={cx('option', state)}
                  style={{ justifyContent: 'center' }}
                  onClick={(e) => choose(w, e.currentTarget)}
                  disabled={!!chosen}
                >
                  <En>{w}</En>
                </button>
              );
            })}
          </div>
          {chosen && (
            <div className="ex-actions">
              <button className="btn btn-primary" onClick={() => startRound(round + 1)} autoFocus>
                {t('next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
