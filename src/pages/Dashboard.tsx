import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Repeat, Compass, Zap, Mic, Library, BookMarked, Layers, Flame } from 'lucide-react';
import { LEVELS, lessonsOfLevel, nextLesson } from '../content';
import { SKILLS } from '../content/types';
import { useT } from '../i18n';
import { activeStreak, useProgress, weakestSkill } from '../store/progress';
import { isMastered } from '../lib/srs/fsrs';
import { dateKey, lastNDays } from '../lib/util';
import { useDueCount } from '../components/Layout';
import { LevelTag, ProgressBar, Ring } from '../components/ui';

export function Dashboard() {
  const { t, rich, num, pct, lang } = useT();
  const profile = useProgress((s) => s.profile)!;
  const lessons = useProgress((s) => s.lessons);
  const xpByDay = useProgress((s) => s.xpByDay);
  const streak = useProgress((s) => s.streak);
  const skills = useProgress((s) => s.skills);
  const srs = useProgress((s) => s.srs);
  const placement = useProgress((s) => s.placement);
  const mistakes = useProgress((s) => s.mistakes);
  const due = useDueCount();

  const next = nextLesson(lessons, profile.startLevel);
  const todayXp = xpByDay[dateKey()] ?? 0;
  const goalPct = Math.min(1, todayXp / profile.dailyGoal);
  const streakNow = activeStreak(streak);
  const week = lastNDays(7);
  const maxWeek = Math.max(profile.dailyGoal, ...week.map((d) => xpByDay[d] ?? 0));
  const deckSize = Object.keys(srs).length;
  const mastered = Object.values(srs).filter(isMastered).length;
  const weak = weakestSkill(skills);
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  const hour = new Date().getHours();
  const dayLabel = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { weekday: 'short' });

  return (
    <div className="page">
      <div className="page-head">
        <h1>
          {hour < 12 ? t('greetingMorning') : t('greetingEvening')}
          {lang === 'ar' ? '، ' : ', '}
          {profile.name} 👋
        </h1>
      </div>

      <div className="hero-grid">
        <div className="card card-hero">
          {next ? (
            <>
              <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                <LevelTag level={next.level.id} />
                <span className="small muted">
                  {t('unit')}: {rich(next.unit.title)}
                </span>
              </div>
              <div className="small muted">{t('continueLearning')}</div>
              <h2 style={{ fontSize: '1.6rem', margin: '4px 0 6px' }}>{rich(next.lesson.title)}</h2>
              <p className="muted">{rich(next.lesson.objectives[0])}</p>
              <Link to={`/lesson/${next.lesson.id}`} className="btn btn-white btn-lg">
                {t('continue')} <Arrow size={18} />
              </Link>
            </>
          ) : (
            <h2>{t('courseComplete')}</h2>
          )}
        </div>

        <div className="card">
          <div className="row" style={{ gap: 16 }}>
            <Ring value={goalPct} size={92} stroke={10} color={goalPct >= 1 ? 'var(--success)' : 'var(--accent)'}>
              <span style={{ fontSize: '1rem' }}>{pct(goalPct)}</span>
            </Ring>
            <div>
              <div className="bold">{t('dailyGoal')}</div>
              <div className="muted small">
                {num(todayXp)} / {num(profile.dailyGoal)} {t('xp')}
              </div>
              {goalPct >= 1 && <div className="small" style={{ color: 'var(--success)', fontWeight: 700 }}>{t('goalReached')}</div>}
            </div>
          </div>
          <hr className="divider" />
          <div className="row">
            <Flame size={28} color="var(--accent)" fill={streakNow ? 'var(--accent)' : 'none'} />
            <div>
              <div className="big-number">{num(streakNow)}</div>
              <div className="faint small">{t('dayStreak')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <div className="card stack" style={{ gap: 8 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            <Repeat size={20} color="var(--primary)" /> {t('navReview')}
          </div>
          {due > 0 ? (
            <>
              <div>
                <span className="big-number">{num(due)}</span> <span className="muted small">{t('reviewsDue')}</span>
              </div>
              <Link to="/review" className="btn btn-primary">
                {t('reviewNow')}
              </Link>
            </>
          ) : (
            <p className="muted small" style={{ margin: 0 }}>
              {deckSize ? t('noReviews') : t('emptyDeck')}
            </p>
          )}
        </div>

        <div className="card stack" style={{ gap: 8 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            <Zap size={20} color="var(--accent)" /> {t('navPractice')}
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            {Object.keys(mistakes).length > 0 ? `${num(Object.keys(mistakes).length)} ${t('mistakesToFix')}` : t('practiceSub').split('.')[0] + '.'}
          </p>
          <Link to="/practice" className="btn btn-soft">
            {t('quickPractice')}
          </Link>
        </div>

        {!placement ? (
          <div className="card stack" style={{ gap: 8 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>
              <Compass size={20} color="var(--lvl-A2)" /> {t('takePlacement')}
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              {t('takePlacementDesc')}
            </p>
            <Link to="/placement" className="btn">
              {t('start')}
            </Link>
          </div>
        ) : (
          <div className="card stack" style={{ gap: 6 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>
              <Layers size={20} color="var(--lvl-C1)" /> {t('navVocabulary')}
            </div>
            <div>
              <span className="big-number">{num(deckSize)}</span> <span className="muted small">{t('wordsLearned')}</span>
            </div>
            <div className="small muted">
              {num(mastered)} {t('wordsMastered')}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-title">{t('thisWeek')}</div>
          <div className="week">
            {week.map((d) => {
              const v = xpByDay[d] ?? 0;
              return (
                <div className="day" key={d} title={`${v} XP`}>
                  <span className="tiny">{v ? num(v) : ''}</span>
                  <div className={`bar ${v >= profile.dailyGoal ? 'goal' : v > 0 ? 'on' : ''}`} style={{ height: `${Math.max(6, (v / maxWeek) * 80)}%` }} />
                  <span>{dayLabel(d)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-title">{t('skills')}</div>
          {SKILLS.map((s) => {
            const st = skills[s];
            const acc = st.total ? st.correct / st.total : 0;
            return (
              <div className="skill-row" key={s}>
                <span className="small">{t(`skill_${s}`)}</span>
                <ProgressBar value={acc} variant={acc >= 0.8 ? 'success' : undefined} thin />
                <span className="small faint" style={{ textAlign: 'end' }}>
                  {st.total ? pct(acc) : '—'}
                </span>
              </div>
            );
          })}
          {weak && (
            <div className="note info small" style={{ marginTop: 14 }}>
              {t('weakestSkill')}: <b>{t(`skill_${weak}`)}</b> —{' '}
              <Link to="/practice">{t('quickPractice')}</Link>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">{t('levelProgress')}</div>
        <div className="grid grid-3">
          {LEVELS.map((l) => {
            const all = lessonsOfLevel(l.id);
            const done = all.filter((r) => lessons[r.lesson.id]).length;
            return (
              <Link to={`/learn?level=${l.id}`} key={l.id} className="row" style={{ color: 'inherit' }}>
                <LevelTag level={l.id} />
                <div className="grow">
                  <div className="row spread small">
                    <span>{rich(l.title)}</span>
                    <span className="faint en">
                      {done}/{all.length}
                    </span>
                  </div>
                  <ProgressBar value={all.length ? done / all.length : 0} thin />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        {[
          { to: '/pronunciation', icon: <Mic />, label: t('navPronunciation'), color: 'var(--lvl-C2)' },
          { to: '/library', icon: <Library />, label: t('navLibrary'), color: 'var(--lvl-A2)' },
          { to: '/grammar', icon: <BookMarked />, label: t('navGrammar'), color: 'var(--lvl-B1)' },
          { to: '/vocabulary', icon: <Layers />, label: t('navVocabulary'), color: 'var(--lvl-C1)' },
        ].map((x) => (
          <Link key={x.to} to={x.to} className="tile-link">
            <span className="tile-icon" style={{ background: `color-mix(in srgb, ${x.color} 15%, transparent)`, color: x.color }}>
              {x.icon}
            </span>
            <span className="bold">{x.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
