import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Repeat, PartyPopper } from 'lucide-react';
import { getVocab } from '../content';
import { AGAIN, EASY, GOOD, HARD, formatInterval, isDue, isMastered, previewIntervals, type Rating } from '../lib/srs/fsrs';
import { addDays, dateKey } from '../lib/util';
import { useSpeak } from '../hooks/useSpeech';
import { useT } from '../i18n';
import { useProgress } from '../store/progress';
import { AudioButton, En, EmptyState, LevelTag, ProgressBar } from '../components/ui';
import { gsap, haptic } from '../motion/core';
import { useReducedMotion } from '../motion/MotionProvider';
import { shake } from '../motion/hooks';
import { sparkAt } from '../components/fx/Celebrate';

const SESSION_LIMIT = 60;
const MAX_REPEATS = 3;

export function Review() {
  const { t, num } = useT();
  const srs = useProgress((s) => s.srs);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [reviewed, setReviewed] = useState(0);

  const dueIds = useMemo(() => {
    const now = Date.now();
    return Object.entries(srs)
      .filter(([id, c]) => isDue(c, now) && getVocab(id))
      .sort((a, b) => a[1].due - b[1].due)
      .map(([id]) => id);
  }, [srs]);

  if (queue) {
    return (
      <ReviewSession
        ids={queue}
        onDone={(n) => {
          setReviewed(n);
          setQueue(null);
        }}
      />
    );
  }

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>{t('reviewTitle')}</h1>
        <p>{t('reviewSub')}</p>
      </div>

      {reviewed > 0 && (
        <div className="card celebrate" style={{ marginBottom: 16 }}>
          <div className="emoji">
            <PartyPopper size={56} color="var(--accent)" />
          </div>
          <h2>{t('sessionDone')}</h2>
          <p className="muted">{t('reviewed', { count: num(reviewed) })}</p>
        </div>
      )}

      {Object.keys(srs).length === 0 ? (
        <EmptyState icon="🗂️" title={t('emptyDeck')}>
          <Link to="/learn" className="btn btn-primary" style={{ marginTop: 10 }}>
            {t('navLearn')}
          </Link>
        </EmptyState>
      ) : (
        <>
          <div className="card row spread" style={{ flexWrap: 'wrap' }}>
            <div className="row">
              <Repeat size={28} color="var(--primary)" />
              <div>
                <div className="big-number">{num(dueIds.length)}</div>
                <div className="faint small">{t('reviewsDue')}</div>
              </div>
            </div>
            {dueIds.length > 0 ? (
              <button className="btn btn-primary btn-lg" onClick={() => setQueue(dueIds.slice(0, SESSION_LIMIT))}>
                {t('reviewNow')}
              </button>
            ) : (
              <span className="muted">{t('noReviews')}</span>
            )}
          </div>
          <DeckStats />
        </>
      )}
    </div>
  );
}

function DeckStats() {
  const { t, num, lang } = useT();
  const srs = useProgress((s) => s.srs);
  const cards = Object.values(srs);
  const mastered = cards.filter(isMastered).length;
  const fresh = cards.filter((c) => c.state === 'new').length;
  const learning = cards.length - mastered - fresh;
  const today = dateKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const counts = days.map((d, i) =>
    cards.filter((c) => {
      const k = dateKey(new Date(c.due));
      return i === 0 ? k <= d : k === d;
    }).length,
  );
  const max = Math.max(1, ...counts);
  const label = (d: string, i: number) =>
    i === 0 ? t('today') : i === 1 ? t('tomorrow') : new Date(`${d}T12:00:00`).toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { weekday: 'short' });

  return (
    <div className="grid grid-2" style={{ marginTop: 16 }}>
      <div className="card">
        <div className="card-title">{t('deckStats')}</div>
        {[
          { label: t('stateNew'), v: fresh, color: 'var(--text-3)' },
          { label: t('stateLearning'), v: learning, color: 'var(--accent)' },
          { label: t('stateMastered'), v: mastered, color: 'var(--success)' },
        ].map((x) => (
          <div key={x.label} className="skill-row">
            <span className="small">{x.label}</span>
            <div className="progress thin">
              <span style={{ width: `${cards.length ? (x.v / cards.length) * 100 : 0}%`, background: x.color }} />
            </div>
            <span className="small faint" style={{ textAlign: 'end' }}>
              {num(x.v)}
            </span>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-title">{t('upcoming')}</div>
        <div className="forecast">
          {days.map((d, i) => (
            <div className="col" key={d}>
              <span>{counts[i] ? num(counts[i]) : ''}</span>
              <div className={`bar ${i === 0 ? 'today' : ''}`} style={{ height: `${(counts[i] / max) * 75}%` }} />
              <span>{label(d, i)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewSession({ ids, onDone }: { ids: string[]; onDone: (reviewed: number) => void }) {
  const { t, lang } = useT();
  const { speak } = useSpeak();
  const srs = useProgress((s) => s.srs);
  const reviewCard = useProgress((s) => s.reviewCard);
  const showIPA = useProgress((s) => s.settings.showIPA);
  const [queue, setQueue] = useState(ids);
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [repeats, setRepeats] = useState<Record<string, number>>({});
  const [count, setCount] = useState(0);

  const id = queue[i];
  const ref = id ? getVocab(id) : undefined;
  const card = id ? srs[id] : undefined;
  // Alternate directions: recognise the English word, then recall it from Arabic.
  const reverse = !!card && card.reps % 2 === 1;
  const cardRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // New card slides in from the reading direction.
  useLayoutEffect(() => {
    if (reduced || !cardRef.current) return;
    gsap.fromTo(cardRef.current, { x: lang === 'ar' ? -40 : 40, opacity: 0, rotationY: 0 }, { x: 0, opacity: 1, duration: 0.4, clearProps: 'transform,opacity' });
  }, [i, reduced, lang]);

  /** Flip the card over to show the answer. */
  const reveal = () => {
    if (ref && reverse) speak(ref.item.word);
    if (reduced || !cardRef.current) {
      setRevealed(true);
      return;
    }
    gsap
      .timeline()
      .to(cardRef.current, { rotationY: 90, transformPerspective: 1100, duration: 0.17, ease: 'power2.in', onComplete: () => setRevealed(true) })
      .fromTo(cardRef.current, { rotationY: -90 }, { rotationY: 0, duration: 0.28, ease: 'power2.out', clearProps: 'transform' });
  };

  useEffect(() => {
    if (ref && !reverse) speak(ref.item.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const rate = (g: Rating, from?: Element | null) => {
    if (!id) return;
    if (g >= GOOD) {
      sparkAt(from ?? cardRef.current, { count: g === EASY ? 14 : 10 });
      haptic(10);
    } else if (g === AGAIN) shake(cardRef.current);
    reviewCard(id, g);
    setCount((c) => c + 1);
    let q = queue;
    if (g === AGAIN && (repeats[id] ?? 0) < MAX_REPEATS) {
      q = [...queue, id];
      setQueue(q);
      setRepeats((r) => ({ ...r, [id]: (r[id] ?? 0) + 1 }));
    }
    setRevealed(false);
    if (i + 1 >= q.length) onDone(count + 1);
    else setI(i + 1);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        reveal();
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        rate(Number(e.key) as Rating);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (!ref || !card) {
    return null;
  }

  const preview = previewIntervals(card);
  const item = ref.item;
  const buttons: { g: Rating; key: 'again' | 'hard' | 'good' | 'easy' }[] = [
    { g: AGAIN, key: 'again' },
    { g: HARD, key: 'hard' },
    { g: GOOD, key: 'good' },
    { g: EASY, key: 'easy' },
  ];

  return (
    <div className="page page-narrow">
      <div className="session-top">
        <button className="icon-btn" onClick={() => onDone(count)} aria-label={t('quit')}>
          ✕
        </button>
        <ProgressBar value={i / queue.length} variant="accent" />
        <span className="small faint en">
          {i + 1}/{queue.length}
        </span>
      </div>

      <div className="card flashcard" ref={cardRef}>
        <div className="row">
          <LevelTag level={ref.level} />
          <span className="faint small">{reverse ? t('recallWord') : t('recallMeaning')}</span>
        </div>
        {reverse ? (
          <div className="front" dir="rtl">
            {item.ar}
          </div>
        ) : (
          <div className="row" style={{ justifyContent: 'center' }}>
            <En className="front">{item.word}</En>
            <AudioButton text={item.word} slow />
          </div>
        )}

        {revealed && (
          <div className="back">
            {reverse ? (
              <div className="row" style={{ justifyContent: 'center' }}>
                <En className="front" as="div">
                  {item.word}
                </En>
                <AudioButton text={item.word} slow />
              </div>
            ) : (
              <div className="bold" style={{ fontSize: '1.5rem' }} dir="rtl">
                {item.ar}
              </div>
            )}
            {showIPA && item.ipa && <div className="ipa">{item.ipa}</div>}
            <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
              <En className="muted">{item.example}</En>
              <AudioButton text={item.example} size="sm" />
            </div>
            {item.exampleAr && (
              <div className="faint small" dir="rtl">
                {item.exampleAr}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        {!revealed ? (
          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={reveal}
          >
            {t('showAnswer')}
          </button>
        ) : (
          <div className="rate-grid">
            {buttons.map((b, k) => (
              <button key={b.g} className={`rate-btn ${b.key}`} onClick={(e) => rate(b.g, e.currentTarget)}>
                {t(b.key)}
                <small>{formatInterval(preview[b.g], lang)}</small>
                <small className="faint">{k + 1}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
