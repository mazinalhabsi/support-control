import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, MessageCircle, Target, PenLine, Mic, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { LESSONS, getLesson } from '../content';
import { buildLessonSession } from '../lib/practice';
import { wordCount, cx } from '../lib/util';
import { useT } from '../i18n';
import { useProgress } from '../store/progress';
import { Session, type SessionStats } from '../components/exercises/Session';
import { SpeakPractice } from '../components/exercises/Exercises';
import { Dialogue, GrammarCard, VocabCard } from '../components/LessonParts';
import { En, LevelTag } from '../components/ui';
import { CountUp } from '../components/fx/CountUp';
import { confetti } from '../components/fx/Celebrate';
import { scrollToTop } from '../motion/MotionProvider';
import { useStaggerIn } from '../motion/hooks';

type Step = 'learn' | 'practice' | 'produce' | 'done';
const STEPS: Step[] = ['learn', 'practice', 'produce', 'done'];

export function LessonPage() {
  const { id = '' } = useParams();
  const ref = getLesson(id);
  if (!ref) return <div className="page">404</div>;
  // Remount on lesson change so all state resets.
  return <LessonFlow key={id} lessonId={id} />;
}

function LessonFlow({ lessonId }: { lessonId: string }) {
  const { t, rich, num, lang } = useT();
  const navigate = useNavigate();
  const ref = getLesson(lessonId)!;
  const { lesson, unit, level } = ref;
  const completeLesson = useProgress((s) => s.completeLesson);
  const addXp = useProgress((s) => s.addXp);
  const recordAnswer = useProgress((s) => s.recordAnswer);
  const srs = useProgress((s) => s.srs);

  const [step, setStep] = useState<Step>('learn');
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [sessionSeed, setSessionSeed] = useState(() => Date.now());
  const items = useMemo(() => buildLessonSession(lesson, sessionSeed), [lesson, sessionSeed]);
  const [writing, setWriting] = useState('');
  const [showModel, setShowModel] = useState(false);
  const [bonus, setBonus] = useState(0);
  const newWords = useRef(0);

  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  const nextRef = LESSONS[ref.index + 1];
  const score = stats && stats.total ? stats.firstTryCorrect / stats.total : 0;

  const finishLesson = () => {
    newWords.current = lesson.vocab.filter((v) => !srs[v.id]).length;
    let b = 20;
    if (score >= 0.999) b += 10;
    if (lesson.writing && wordCount(writing) >= lesson.writing.minWords) b += 15;
    setBonus(b);
    addXp(b);
    completeLesson(lesson.id, score, lesson.vocab.map((v) => v.id));
    setStep('done');
    scrollToTop();
    setTimeout(() => confetti(undefined, score >= 0.7 ? 90 : 40), 300);
  };

  const pageRef = useRef<HTMLDivElement>(null);
  useStaggerIn(pageRef, '.page-head, .card, .feedback', [step]);

  const stepIdx = STEPS.indexOf(step);
  const stepLabels = [t('stepLearn'), t('stepPractice'), t('stepProduce'), t('stepDone')];

  if (step === 'practice') {
    return (
      <div className="page">
        <Session
          items={items}
          onQuit={() => setStep('learn')}
          onFinish={(s) => {
            setStats(s);
            setStep('produce');
            scrollToTop();
          }}
        />
      </div>
    );
  }

  return (
    <div className="page page-narrow" ref={pageRef}>
      <div className="stepper" aria-label="progress">
        {STEPS.map((s, i) => (
          <div key={s} className={cx('step', i < stepIdx && 'done', i === stepIdx && 'current')}>
            <div className="bar" />
            {stepLabels[i]}
          </div>
        ))}
      </div>

      {step === 'learn' && (
        <>
          <div className="page-head">
            <div className="row" style={{ marginBottom: 6 }}>
              <LevelTag level={level.id} />
              <span className="small faint">
                {t('unit')}: {rich(unit.title)}
              </span>
            </div>
            <h1>{rich(lesson.title)}</h1>
            {lang === 'ar' && (
              <div className="faint">
                <En>{lesson.title.en}</En>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">
              <Target size={20} color="var(--primary)" /> {t('objectives')}
            </div>
            <ul className="rule-list">
              {lesson.objectives.map((o, i) => (
                <li key={i}>{rich(o)}</li>
              ))}
            </ul>
          </div>

          {lesson.dialogue && (
            <div className="card">
              <div className="card-title">
                <MessageCircle size={20} color="var(--lvl-A2)" /> {t('dialogue')}
              </div>
              <Dialogue lines={lesson.dialogue} />
            </div>
          )}

          <div className="card">
            <div className="card-title">
              <BookOpen size={20} color="var(--lvl-C1)" /> {t('vocabulary')}{' '}
              <span className="badge neutral">{num(lesson.vocab.length)}</span>
            </div>
            <div className="vocab-grid">
              {lesson.vocab.map((v) => (
                <VocabCard key={v.id} item={v} />
              ))}
            </div>
          </div>

          {lesson.grammar && (
            <div className="card">
              <div className="card-title">
                <PenLine size={20} color="var(--lvl-B1)" /> {t('grammar')}
              </div>
              <GrammarCard grammar={lesson.grammar} />
            </div>
          )}

          <div className="feedback" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            <div className="row spread">
              <span className="muted small">
                {t('exercisesCount', { count: num(items.length) })}
              </span>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => {
                  setSessionSeed(Date.now());
                  setStep('practice');
                  scrollToTop();
                }}
              >
                {t('startPractice')} <Arrow size={18} />
              </button>
            </div>
          </div>
        </>
      )}

      {step === 'produce' && (
        <>
          <div className="card">
            <div className="card-title">
              <Mic size={20} color="var(--lvl-C2)" /> {t('speakingTitle')}
            </div>
            <p className="muted small">{t('speakingHint')}</p>
            <div className="stack" style={{ gap: 18 }}>
              {lesson.speaking.map((s, i) => (
                <div key={i} style={{ borderBottom: '1px dashed var(--border)', paddingBottom: 12 }}>
                  <SpeakPractice
                    text={s}
                    compact
                    onDone={(r) => {
                      if (r.skipped || r.selfReported) return;
                      recordAnswer(`${lesson.id}#speak${i}`, 'speaking', r.correct);
                      if (r.correct) addXp(5);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {lesson.writing && (
            <div className="card">
              <div className="card-title">
                <PenLine size={20} color="var(--lvl-B2)" /> {t('writingTitle')}
              </div>
              <p className="bold">{rich(lesson.writing.prompt)}</p>
              <textarea
                className="textarea en"
                dir="ltr"
                placeholder={t('writingPlaceholder')}
                value={writing}
                onChange={(e) => setWriting(e.target.value)}
                spellCheck
              />
              <div className="row spread small" style={{ marginTop: 6 }}>
                <span style={{ color: wordCount(writing) >= lesson.writing.minWords ? 'var(--success)' : 'var(--text-3)' }}>
                  {t('wordCount', { count: num(wordCount(writing)), min: num(lesson.writing.minWords) })}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowModel((v) => !v)}>
                  {showModel ? <EyeOff size={16} /> : <Eye size={16} />} {showModel ? t('hideModel') : t('showModel')}
                </button>
              </div>
              <div className="bold small" style={{ marginTop: 12 }}>
                {t('selfCheck')}
              </div>
              <ul className="rule-list small">
                {lesson.writing.checklist.map((c, i) => (
                  <li key={i}>{rich(c)}</li>
                ))}
              </ul>
              {showModel && (
                <div className="note info" style={{ marginTop: 10 }}>
                  <En as="div">
                    <div style={{ whiteSpace: 'pre-line' }}>{lesson.writing.model}</div>
                  </En>
                </div>
              )}
              <p className="faint tiny" style={{ marginTop: 10 }}>
                {t('writingNote')}
              </p>
            </div>
          )}

          <div className="ex-actions">
            <button className="btn btn-primary btn-lg" onClick={finishLesson}>
              {t('finishLesson')} <CheckCircle2 size={18} />
            </button>
          </div>
        </>
      )}

      {step === 'done' && stats && (
        <div className="card celebrate">
          <div className="emoji">{score >= 0.9 ? '🏆' : score >= 0.7 ? '🎉' : '💪'}</div>
          <h1>{t('lessonComplete')}</h1>
          <div className="muted">{rich(lesson.title)}</div>
          <div className="result-stats">
            <div className="result-stat" style={{ borderColor: 'var(--success)' }}>
              <div className="tiny faint">{t('accuracy')}</div>
              <div className="v" style={{ color: 'var(--success)' }}>
                <CountUp to={Math.round(score * 100)} trigger="mount" suffix={lang === 'ar' ? '٪' : '%'} />
              </div>
            </div>
            <div className="result-stat" style={{ borderColor: 'var(--accent)' }}>
              <div className="tiny faint">{t('xpEarned')}</div>
              <div className="v" style={{ color: 'var(--accent)' }}>
                <CountUp to={stats.xp + bonus} trigger="mount" prefix="+" />
              </div>
            </div>
            <div className="result-stat" style={{ borderColor: 'var(--primary)' }}>
              <div className="tiny faint">{t('wordsAdded')}</div>
              <div className="v" style={{ color: 'var(--primary)' }}>
                <CountUp to={newWords.current} trigger="mount" />
              </div>
            </div>
          </div>
          {score >= 0.999 && <p className="bold" style={{ color: 'var(--success)' }}>{t('perfectLesson')}</p>}
          <div className="row row-wrap" style={{ justifyContent: 'center' }}>
            <Link to={`/learn?level=${level.id}`} className="btn">
              {t('backToCourse')}
            </Link>
            {nextRef && (
              <button className="btn btn-primary btn-lg" onClick={() => navigate(`/lesson/${nextRef.lesson.id}`)}>
                {t('nextLesson')} <Arrow size={18} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
