import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, AlertTriangle, Target } from 'lucide-react';
import { LESSONS } from '../content';
import { buildMixedSession, type PracticeItem } from '../lib/practice';
import { useT } from '../i18n';
import { useProgress, weakestSkill } from '../store/progress';
import { Session, type SessionStats } from '../components/exercises/Session';
import { EmptyState } from '../components/ui';

export function Practice() {
  const { t, num, pct } = useT();
  const lessons = useProgress((s) => s.lessons);
  const mistakes = useProgress((s) => s.mistakes);
  const skills = useProgress((s) => s.skills);
  const [items, setItems] = useState<PracticeItem[] | null>(null);
  const [result, setResult] = useState<SessionStats | null>(null);

  const done = LESSONS.filter((r) => lessons[r.lesson.id]).map((r) => r.lesson);
  const weak = weakestSkill(skills);
  const mistakeKeys = Object.entries(mistakes)
    .sort((a, b) => b[1].count - a[1].count || b[1].lastAt - a[1].lastAt)
    .map(([k]) => k);

  const start = () => {
    setResult(null);
    setItems(buildMixedSession(done, mistakeKeys, weak, 15));
  };

  if (items) {
    return (
      <div className="page">
        <Session
          items={items}
          onQuit={() => setItems(null)}
          onFinish={(s) => {
            setResult(s);
            setItems(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>{t('practiceTitle')}</h1>
        <p>{t('practiceSub')}</p>
      </div>

      {result && (
        <div className="card celebrate" style={{ marginBottom: 16 }}>
          <div className="emoji">⚡</div>
          <h2>{t('sessionComplete')}</h2>
          <div className="result-stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="result-stat">
              <div className="tiny faint">{t('accuracy')}</div>
              <div className="v" style={{ color: 'var(--success)' }}>
                {pct(result.firstTryCorrect / Math.max(1, result.total))}
              </div>
            </div>
            <div className="result-stat">
              <div className="tiny faint">{t('xpEarned')}</div>
              <div className="v" style={{ color: 'var(--accent)' }}>
                +{num(result.xp)}
              </div>
            </div>
          </div>
        </div>
      )}

      {done.length === 0 ? (
        <EmptyState icon="🔒" title={t('needLessons')}>
          <Link to="/learn" className="btn btn-primary" style={{ marginTop: 10 }}>
            {t('navLearn')}
          </Link>
        </EmptyState>
      ) : (
        <div className="card stack">
          <div className="row">
            <AlertTriangle color="var(--danger)" />
            <span>
              <b>{num(mistakeKeys.length)}</b> {t('mistakesToFix')}
            </span>
          </div>
          {weak && (
            <div className="row">
              <Target color="var(--primary)" />
              <span>
                {t('weakestSkill')}: <b>{t(`skill_${weak}`)}</b>
              </span>
            </div>
          )}
          <button className="btn btn-primary btn-lg" onClick={start}>
            <Zap size={18} /> {result ? t('practiceAgain') : t('startSession')}
          </button>
        </div>
      )}
    </div>
  );
}
