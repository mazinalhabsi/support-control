import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { PLACEMENT } from '../content/placement';
import { getLevel } from '../content';
import { CEFR_LEVELS, type CEFR } from '../content/types';
import { nextStage, placementLevel, questionsFor, QUESTIONS_PER_STAGE, type StageResult } from '../lib/placement';
import { hashString, rng, shuffle, cx } from '../lib/util';
import { useT } from '../i18n';
import { useProgress } from '../store/progress';
import { En, LevelTag, ProgressBar } from '../components/ui';

export function Placement() {
  const { t, rich, num } = useT();
  const navigate = useNavigate();
  const savePlacement = useProgress((s) => s.savePlacement);
  const updateProfile = useProgress((s) => s.updateProfile);
  const addXp = useProgress((s) => s.addXp);

  const [phase, setPhase] = useState<'intro' | 'test' | 'result'>('intro');
  const [results, setResults] = useState<StageResult[]>([]);
  const [stage, setStage] = useState<CEFR>('A1');
  const [q, setQ] = useState(0);
  const [stageCorrect, setStageCorrect] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const questions = useMemo(() => questionsFor(stage, PLACEMENT), [stage]);
  const question = questions[q];
  const order = useMemo(
    () => (question ? shuffle(question.options.map((_, i) => i), rng(hashString(question.prompt))) : []),
    [question],
  );
  const answeredSoFar = results.reduce((n, r) => n + r.total, 0) + q;
  const final = placementLevel(results);

  const answer = (optionIndex: number | null) => {
    const correct = optionIndex === question.answer;
    const newCorrect = stageCorrect + (correct ? 1 : 0);
    setSelected(null);
    if (q + 1 < questions.length) {
      setStageCorrect(newCorrect);
      setQ(q + 1);
      return;
    }
    const newResults = [...results, { level: stage, correct: newCorrect, total: questions.length }];
    setResults(newResults);
    setStageCorrect(0);
    setQ(0);
    const next = nextStage(newResults);
    if (next) setStage(next);
    else {
      const level = placementLevel(newResults);
      savePlacement(level, newResults);
      updateProfile({ startLevel: level });
      addXp(20);
      setPhase('result');
    }
  };

  if (phase === 'intro') {
    return (
      <div className="page page-narrow">
        <div className="card" style={{ padding: 28 }}>
          <Compass size={40} color="var(--primary)" />
          <h1 style={{ marginTop: 10 }}>{t('placementTitle')}</h1>
          <p className="muted">{t('placementIntro')}</p>
          <div className="row row-wrap" style={{ margin: '14px 0 22px' }}>
            {CEFR_LEVELS.map((l) => (
              <LevelTag key={l} level={l} />
            ))}
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setPhase('test')}>
            {t('start')}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'result') {
    const lvl = getLevel(final);
    return (
      <div className="page page-narrow">
        <div className="card celebrate">
          <div className="emoji">🎯</div>
          <div className="muted">{t('yourLevel')}</div>
          <div className="row" style={{ justifyContent: 'center', margin: '10px 0' }}>
            <LevelTag level={final} className="btn-lg" />
            <h1 style={{ margin: 0 }}>{rich(lvl.title)}</h1>
          </div>
          <p className="muted" style={{ maxWidth: 520, margin: '0 auto 18px' }}>
            {rich(lvl.description)}
          </p>
          <div className="stack" style={{ maxWidth: 420, margin: '0 auto 18px', gap: 8 }}>
            {results.map((r) => (
              <div key={r.level} className="row">
                <LevelTag level={r.level} />
                <div className="grow">
                  <ProgressBar value={r.correct / r.total} variant={r.correct / r.total >= 0.6 ? 'success' : 'accent'} thin />
                </div>
                <span className="small faint">{t('stageResult', { correct: num(r.correct), total: num(r.total) })}</span>
              </div>
            ))}
          </div>
          <p className="faint small">{t('placementNote')}</p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate(`/learn?level=${final}`)}>
            {t('startAtLevel', { level: final })}
          </button>
        </div>
      </div>
    );
  }

  const totalPossible = CEFR_LEVELS.length * QUESTIONS_PER_STAGE;
  return (
    <div className="page page-narrow">
      <div className="session-top">
        <LevelTag level={stage} />
        <ProgressBar value={answeredSoFar / totalPossible} />
        <span className="small faint">
          {t('question')} {num(answeredSoFar + 1)}
        </span>
      </div>
      <div className="card" style={{ padding: 24 }}>
        <En className="ex-prompt" as="div">
          {question.prompt}
        </En>
        <div className="options" style={{ marginTop: 18 }}>
          {order.map((oi, k) => (
            <button key={oi} className={cx('option', selected === oi && 'selected')} onClick={() => setSelected(oi)}>
              <span className="key">{k + 1}</span>
              <En>{question.options[oi]}</En>
            </button>
          ))}
          <button className={cx('option', selected === -1 && 'selected')} onClick={() => setSelected(-1)} style={{ color: 'var(--text-2)' }}>
            <span className="key">?</span>
            {t('dontKnow')}
          </button>
        </div>
        <div className="ex-actions">
          <button className="btn btn-primary btn-lg" disabled={selected === null} onClick={() => answer(selected === -1 ? null : selected)}>
            {t('next')}
          </button>
        </div>
      </div>
    </div>
  );
}
