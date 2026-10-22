import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, Play, Square, XCircle } from 'lucide-react';
import { READINGS } from '../content/readings';
import { CEFR_LEVELS, type Reading } from '../content/types';
import { hashString, rng, shuffle, cx } from '../lib/util';
import { useSpeak } from '../hooks/useSpeech';
import { useT } from '../i18n';
import { useProgress } from '../store/progress';
import { En, LevelTag } from '../components/ui';
import { confetti } from '../components/fx/Celebrate';

export function LibraryList() {
  const { t, rich, pct } = useT();
  const records = useProgress((s) => s.readings);
  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('libraryTitle')}</h1>
        <p>{t('librarySub')}</p>
      </div>
      {CEFR_LEVELS.map((lvl) => {
        const items = READINGS.filter((r) => r.level === lvl);
        if (!items.length) return null;
        return (
          <section key={lvl} style={{ marginBottom: 22 }}>
            <div className="row" style={{ marginBottom: 10 }}>
              <LevelTag level={lvl} />
            </div>
            <div className="grid grid-auto">
              {items.map((r) => {
                const rec = records[r.id];
                return (
                  <Link key={r.id} to={`/library/${r.id}`} className="tile-link" style={{ alignItems: 'flex-start' }}>
                    <span className="tile-icon" style={{ background: `color-mix(in srgb, var(--lvl-${lvl}) 15%, transparent)`, color: `var(--lvl-${lvl})` }}>
                      <BookOpen />
                    </span>
                    <span className="grow">
                      <En className="bold" as="div">
                        {r.title}
                      </En>
                      <span className="small muted" style={{ display: 'block' }}>
                        {r.titleAr} · {rich(r.topic)}
                      </span>
                      {rec && (
                        <span className="small" style={{ color: 'var(--success)', fontWeight: 700 }}>
                          ✓ {pct(rec.score)}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function ReadingPage() {
  const { id } = useParams();
  const reading = READINGS.find((r) => r.id === id);
  if (!reading) return <div className="page">404</div>;
  return <ReadingView key={reading.id} reading={reading} />;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function Glossed({ text, glossary }: { text: string; glossary: Reading['glossary'] }) {
  const [open, setOpen] = useState<number | null>(null);
  const parts = useMemo(() => {
    if (!glossary.length) return [text];
    const words = [...glossary].sort((a, b) => b.word.length - a.word.length);
    const re = new RegExp(`\\b(${words.map((g) => escapeRe(g.word.replace(/\s*\(.*\)$/, ''))).join('|')})(s|es|ed|d|ing)?\\b`, 'gi');
    const out: ReactNode[] = [];
    let last = 0;
    let k = 0;
    for (const m of text.matchAll(re)) {
      const idx = m.index ?? 0;
      out.push(text.slice(last, idx));
      const base = m[1].toLowerCase();
      const entry = words.find((g) => g.word.replace(/\s*\(.*\)$/, '').toLowerCase() === base);
      const key = k++;
      out.push(
        <button key={`g${key}`} className="gloss" onClick={() => setOpen(open === key ? null : key)}>
          {m[0]}
          {open === key && entry && <span className="gloss-pop">{entry.ar}</span>}
        </button>,
      );
      last = idx + m[0].length;
    }
    out.push(text.slice(last));
    return out;
  }, [text, glossary, open]);
  return <>{parts}</>;
}

function ReadingView({ reading }: { reading: Reading }) {
  const { t, rich, num, lang } = useT();
  const { speak, stop } = useSpeak();
  const completeReading = useProgress((s) => s.completeReading);
  const recordAnswer = useProgress((s) => s.recordAnswer);
  const addXp = useProgress((s) => s.addXp);
  const [speakingPara, setSpeakingPara] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number | boolean>>({});
  const [checked, setChecked] = useState(false);

  const orders = useMemo(
    () => reading.questions.map((q, i) => (q.type === 'mcq' ? shuffle(q.options.map((_, j) => j), rng(hashString(reading.id) + i)) : [])),
    [reading],
  );

  const readFrom = (i: number) => {
    if (i >= reading.paragraphs.length) {
      setSpeakingPara(null);
      return;
    }
    setSpeakingPara(i);
    speak(reading.paragraphs[i], { id: `para-${i}`, onEnd: () => setTimeout(() => readFrom(i + 1), 300) });
  };

  const isCorrect = (i: number) => {
    const q = reading.questions[i];
    return q.type === 'mcq' ? answers[i] === q.answer : answers[i] === q.answer;
  };

  const submit = () => {
    setChecked(true);
    const correct = reading.questions.filter((_, i) => isCorrect(i)).length;
    reading.questions.forEach((_, i) => recordAnswer(`${reading.id}#q${i}`, 'reading', isCorrect(i)));
    completeReading(reading.id, correct / reading.questions.length);
    if (correct === reading.questions.length) confetti(undefined, 70);
    addXp(10 + correct * 3);
  };

  const correctCount = reading.questions.filter((_, i) => isCorrect(i)).length;

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <Link to="/library" className="small">
          {lang === 'ar' ? '→' : '←'} {t('libraryTitle')}
        </Link>
        <div className="row" style={{ marginTop: 8 }}>
          <LevelTag level={reading.level} />
          <span className="faint small">{rich(reading.topic)}</span>
        </div>
        <En as="div">
          <h1 style={{ marginTop: 8, marginBottom: 2 }}>{reading.title}</h1>
        </En>
        <div className="muted">{reading.titleAr}</div>
      </div>

      <div className="card">
        <div className="row spread row-wrap" style={{ marginBottom: 12 }}>
          <button
            className="btn btn-soft btn-sm"
            onClick={() => {
              if (speakingPara !== null) {
                stop();
                setSpeakingPara(null);
              } else readFrom(0);
            }}
          >
            {speakingPara !== null ? <Square size={16} /> : <Play size={16} />} {speakingPara !== null ? t('stop') : t('readAloud')}
          </button>
          <span className="faint small">{t('tapWords')}</span>
        </div>
        <div className="reading-text">
          {reading.paragraphs.map((p, i) => (
            <p key={i} className={cx(speakingPara === i && 'speaking')}>
              <Glossed text={p} glossary={reading.glossary} />
            </p>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">{t('glossary')}</div>
        <div className="grid grid-2" style={{ gap: 8 }}>
          {reading.glossary.map((g) => (
            <div key={g.word} className="row spread" style={{ padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 10 }}>
              <En className="bold">{g.word}</En>
              <span dir="rtl" className="small">
                {g.ar}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">{t('comprehension')}</div>
        <div className="stack" style={{ gap: 20 }}>
          {reading.questions.map((q, i) => (
            <div key={i}>
              <div className="row" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
                {checked && (isCorrect(i) ? <CheckCircle2 color="var(--success)" /> : <XCircle color="var(--danger)" />)}
                <En className="bold" as="div">
                  {num(i + 1)}. {q.type === 'mcq' ? q.prompt : q.statement}
                </En>
              </div>
              <div className="options">
                {q.type === 'mcq'
                  ? orders[i].map((oi) => {
                      const state = checked ? (oi === q.answer ? 'correct' : answers[i] === oi ? 'wrong' : '') : answers[i] === oi ? 'selected' : '';
                      return (
                        <button key={oi} className={cx('option', state)} style={{ minHeight: 46 }} disabled={checked} onClick={() => setAnswers((a) => ({ ...a, [i]: oi }))}>
                          <En>{q.options[oi]}</En>
                        </button>
                      );
                    })
                  : [true, false].map((v) => {
                      const state = checked ? (v === q.answer ? 'correct' : answers[i] === v ? 'wrong' : '') : answers[i] === v ? 'selected' : '';
                      return (
                        <button key={String(v)} className={cx('option', state)} style={{ minHeight: 46 }} disabled={checked} onClick={() => setAnswers((a) => ({ ...a, [i]: v }))}>
                          {v ? t('true') : t('false')}
                        </button>
                      );
                    })}
              </div>
              {checked && q.explain && <div className="small muted" style={{ marginTop: 6 }}>{rich(q.explain)}</div>}
            </div>
          ))}
        </div>
        {!checked ? (
          <div className="ex-actions">
            <button className="btn btn-primary btn-lg" disabled={Object.keys(answers).length < reading.questions.length} onClick={submit}>
              {t('submitAnswers')}
            </button>
          </div>
        ) : (
          <div className="note info" style={{ marginTop: 18 }}>
            <b>{t('readingScore', { correct: num(correctCount), total: num(reading.questions.length) })}</b>
          </div>
        )}
      </div>
    </div>
  );
}
