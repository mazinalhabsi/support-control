import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Keyboard, Mic, Eye, RotateCcw } from 'lucide-react';
import { useT } from '../../i18n';
import { useProgress } from '../../store/progress';
import { useSpeak } from '../../hooks/useSpeech';
import { listenOnce, recognitionSupported, ttsSupported, type ListenHandle } from '../../lib/speech';
import { speechSimilarity } from '../../lib/answer';
import { sfx } from '../../lib/sfx';
import { cx } from '../../lib/util';
import { En, Segmented } from '../../components/ui';
import { sparkAt } from '../../components/fx/Celebrate';
import { haptic } from '../../motion/core';
import { scrollToElement } from '../../motion/MotionProvider';
import { DialoguePicker, ResultPanel, StudioFrame, initialsHint, type DialogueSource } from './common';

type Hint = 'full' | 'initials' | 'none';

/**
 * Role-play: the learner takes one part of a lesson dialogue. The app voices
 * the other speakers; the learner says (or types) their own lines from a
 * fading hint, and each line is scored for intelligibility.
 */
export function RolePlay() {
  const { t } = useT();
  const [source, setSource] = useState<DialogueSource | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [hint, setHint] = useState<Hint>('initials');

  return (
    <StudioFrame icon="roleplay" title={t('modeRoleplay')} intro={t('modeRoleplayDesc')}>
      {!source ? (
        <DialoguePicker onPick={setSource} />
      ) : !me ? (
        <RolePick source={source} hint={hint} setHint={setHint} onPick={setMe} onBack={() => setSource(null)} />
      ) : (
        <Play key={`${source.lessonId}:${me}`} source={source} me={me} hint={hint} onExit={() => setMe(null)} />
      )}
    </StudioFrame>
  );
}

function RolePick({
  source,
  hint,
  setHint,
  onPick,
  onBack,
}: {
  source: DialogueSource;
  hint: Hint;
  setHint: (h: Hint) => void;
  onPick: (s: string) => void;
  onBack: () => void;
}) {
  const { t, rich } = useT();
  const speakers = [...new Set(source.lines.map((l) => l.speaker))];
  return (
    <div className="card stack" style={{ gap: 16 }}>
      <h2 style={{ margin: 0 }}>{rich(source.title)}</h2>
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          {t('hintLevel')}
        </div>
        <Segmented<Hint>
          value={hint}
          onChange={setHint}
          options={[
            { value: 'full', label: t('hintFull') },
            { value: 'initials', label: t('hintInitials') },
            { value: 'none', label: t('hintNone') },
          ]}
        />
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          {t('pickRole')}
        </div>
        <div className="row row-wrap">
          {speakers.map((s, i) => (
            <button key={s} className="btn btn-lg" style={{ paddingInline: 18 }} onClick={() => onPick(s)}>
              <span className="avatar" style={{ width: 30, height: 30, fontSize: '0.8rem', background: i % 2 ? 'var(--lvl-B1)' : 'var(--lvl-A1)' }}>
                {s[0]}
              </span>
              {t('playAs', { name: s })}
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        {t('back')}
      </button>
    </div>
  );
}

interface LineResult {
  score: number;
  heard?: string;
}

function Play({ source, me, hint, onExit }: { source: DialogueSource; me: string; hint: Hint; onExit: () => void }) {
  const { t, num } = useT();
  const { speak, stop } = useSpeak();
  const accent = useProgress((s) => s.settings.accent);
  const sounds = useProgress((s) => s.settings.sounds);
  const addXp = useProgress((s) => s.addXp);
  const recordAnswer = useProgress((s) => s.recordAnswer);
  const recordStudio = useProgress((s) => s.recordStudio);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<Record<number, LineResult>>({});
  const [listening, setListening] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [finished, setFinished] = useState<{ score: number; xp: number } | null>(null);
  const handle = useRef<ListenHandle | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lines = source.lines;
  const line = lines[i];
  const mine = line?.speaker === me;
  const done = results[i] !== undefined;
  const speakers = useMemo(() => [...new Set(lines.map((l) => l.speaker))], [lines]);
  const canListen = recognitionSupported();

  // Partner lines play by themselves and hand the turn back.
  useEffect(() => {
    if (!line || mine || finished) return;
    let moved = false;
    const advance = () => {
      if (moved) return;
      moved = true;
      setI((n) => n + 1);
    };
    const fallback = setTimeout(advance, ttsSupported() ? 9000 : 900 + line.en.length * 55);
    speak(line.en, { id: `rp-${i}`, onEnd: () => setTimeout(advance, 350) });
    return () => {
      clearTimeout(fallback);
      moved = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, mine, finished]);

  useEffect(() => {
    scrollToElement(endRef.current, 120);
  }, [i, done]);

  useEffect(
    () => () => {
      handle.current?.stop();
      stop();
    },
    [stop],
  );

  // Finish once we run past the last line.
  useEffect(() => {
    if (i < lines.length || finished) return;
    const scores = Object.values(results).map((r) => r.score);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const pctScore = Math.round(avg * 100);
    const xp = Math.round(scores.length * 2 + avg * 10);
    addXp(xp);
    recordStudio('roleplay', pctScore);
    if (sounds) sfx.complete();
    setFinished({ score: pctScore, xp });
  }, [i, lines.length, finished, results, addXp, recordStudio, sounds]);

  const settle = (score: number, heard?: string, el?: Element | null) => {
    setResults((r) => ({ ...r, [i]: { score, heard } }));
    recordAnswer(`roleplay:${source.lessonId}:${i}`, 'speaking', score >= 0.75);
    if (score >= 0.75) {
      sparkAt(el ?? endRef.current, { count: 10 });
      haptic(10);
      if (sounds) sfx.correct();
    } else if (sounds) sfx.wrong();
    setTyping(false);
    setTyped('');
  };

  const listen = (el: Element | null) => {
    setListening(true);
    handle.current = listenOnce(
      accent,
      (alts) => {
        const best = Math.max(...alts.map((a) => speechSimilarity(a, line.en).score));
        const heard = alts.find((a) => speechSimilarity(a, line.en).score === best);
        settle(best, heard, el);
      },
      () => setListening(false),
      () => setListening(false),
    );
    if (!handle.current) setListening(false);
  };

  if (finished) {
    return (
      <ResultPanel icon="roleplay" score={finished.score} suffix="%" xp={finished.xp}>
        <button className="btn btn-primary" onClick={onExit}>
          <RotateCcw size={16} /> {t('restart')}
        </button>
      </ResultPanel>
    );
  }

  const shown = lines.slice(0, Math.min(i + 1, lines.length));
  const hintText = (en: string) => (hint === 'full' ? en : hint === 'initials' ? initialsHint(en) : '· · ·');

  return (
    <div>
      <div className="row spread small faint" style={{ marginBottom: 14 }}>
        <span>{t('lineOf', { i: num(Math.min(i + 1, lines.length)), n: num(lines.length) })}</span>
        <button className="btn btn-ghost btn-sm" onClick={onExit}>
          {t('pickRole')}
        </button>
      </div>
      <div className="dialogue">
        <AnimatePresence initial={false}>
          {shown.map((l, k) => {
            const isMe = l.speaker === me;
            const res = results[k];
            const revealed = !isMe || res !== undefined;
            return (
              <m.div
                key={k}
                className={cx('bubble-row', isMe && 'right')}
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              >
                <div className="avatar" style={{ background: speakers.indexOf(l.speaker) % 2 ? 'var(--lvl-B1)' : 'var(--lvl-A1)' }}>
                  {l.speaker[0]}
                </div>
                <div className={cx('bubble', k === i && !isMe && 'speaking')}>
                  <div className="who">{l.speaker}</div>
                  <En as="div" className={cx(!revealed && 'hint-text')}>
                    {revealed ? l.en : hintText(l.en)}
                  </En>
                  <div className="tr" dir="rtl">
                    {l.ar}
                  </div>
                  {res && <div className={cx('line-score', res.score >= 0.75 ? 'ok' : 'low')}>{Math.round(res.score * 100)}%</div>}
                </div>
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div ref={endRef} className="turn-bar">
        {mine && !done ? (
          <>
            <div className="bold" style={{ marginBottom: 10 }}>
              {t('yourTurn')}
            </div>
            {typing ? (
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (typed.trim()) settle(speechSimilarity(typed, line.en).score, typed, e.currentTarget);
                }}
              >
                <input className="input en grow" dir="ltr" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={t('typeInstead')} />
                <button className="btn btn-primary">{t('check')}</button>
              </form>
            ) : (
              <div className="row row-wrap">
                {canListen && (
                  <button
                    className={cx('btn btn-primary btn-lg', listening && 'recording')}
                    onClick={(e) => (listening ? handle.current?.stop() : listen(e.currentTarget))}
                  >
                    <Mic size={18} /> {listening ? t('listening') : t('tapToSpeak')}
                  </button>
                )}
                <button className="btn" onClick={() => setTyping(true)}>
                  <Keyboard size={16} /> {t('typeInstead')}
                </button>
                <button className="btn btn-ghost" onClick={() => settle(0)}>
                  <Eye size={16} /> {t('showLine')}
                </button>
              </div>
            )}
          </>
        ) : mine && done ? (
          <button className="btn btn-primary btn-lg" onClick={() => setI(i + 1)}>
            {t('continue')}
          </button>
        ) : (
          <div className="faint small">{line ? t('theirTurn', { name: line.speaker }) : ''}</div>
        )}
      </div>
    </div>
  );
}
