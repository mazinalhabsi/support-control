import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { LEVELS, lessonsOfLevel, nextLesson } from '../content';
import { SKILLS } from '../content/types';
import { useT } from '../i18n';
import { activeStreak, useProgress, weakestSkill } from '../store/progress';
import { isMastered } from '../lib/srs/fsrs';
import { dateKey, lastNDays } from '../lib/util';
import { useDueCount } from '../components/Layout';
import { Dial, LevelTag, ProgressBar } from '../components/ui';
import { Icon3D, type IconName } from '../components/Icon3D';
import { CountUp } from '../components/fx/CountUp';
import { useStaggerIn } from '../motion/hooks';
import { gsap, useGSAP } from '../motion/core';
import { useReducedMotion } from '../motion/MotionProvider';
import type { StringKey } from '../i18n/strings';

const MODES: { to: string; icon: IconName; title: StringKey; desc: StringKey }[] = [
  { to: '/studio/roleplay', icon: 'roleplay', title: 'modeRoleplay', desc: 'modeRoleplayDesc' },
  { to: '/studio/shadowing', icon: 'shadowing', title: 'modeShadowing', desc: 'modeShadowingDesc' },
  { to: '/studio/listening', icon: 'listening', title: 'modeListening', desc: 'modeListeningDesc' },
  { to: '/studio/sprint', icon: 'sprint', title: 'modeSprint', desc: 'modeSprintDesc' },
  { to: '/pronunciation', icon: 'pronunciation', title: 'navPronunciation', desc: 'modePronDesc' },
  { to: '/library', icon: 'library', title: 'navLibrary', desc: 'modeLibraryDesc' },
];

export function Dashboard() {
  const { t, rich, pick, num, pct, lang } = useT();
  const profile = useProgress((s) => s.profile)!;
  const lessons = useProgress((s) => s.lessons);
  const xpByDay = useProgress((s) => s.xpByDay);
  const streak = useProgress((s) => s.streak);
  const skills = useProgress((s) => s.skills);
  const srs = useProgress((s) => s.srs);
  const placement = useProgress((s) => s.placement);
  const mistakes = useProgress((s) => s.mistakes);
  const due = useDueCount();
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useStaggerIn(root, '.showcase, .instrument, .shelf-item, .mode-card', [], { stagger: 0.04 });
  useGSAP(
    () => {
      if (reduced) return;
      gsap.from('.week .bar', { scaleY: 0, transformOrigin: '50% 100%', duration: 0.9, stagger: 0.05, delay: 0.3, ease: 'expo.out' });
      gsap.from('.showcase-object .ico3d', { y: 40, rotate: -25, scale: 0.6, opacity: 0, duration: 1.4, delay: 0.15, ease: 'elastic.out(1, 0.55)' });
    },
    { scope: root, dependencies: [reduced] },
  );

  const next = nextLesson(lessons, profile.startLevel);
  const todayXp = xpByDay[dateKey()] ?? 0;
  const goalPct = Math.min(1, todayXp / profile.dailyGoal);
  const streakNow = activeStreak(streak);
  const week = lastNDays(7);
  const maxWeek = Math.max(profile.dailyGoal, ...week.map((d) => xpByDay[d] ?? 0));
  const deckSize = Object.keys(srs).length;
  const mastered = Object.values(srs).filter(isMastered).length;
  const mistakeCount = Object.keys(mistakes).length;
  const weak = weakestSkill(skills);
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  const hour = new Date().getHours();
  const locale = lang === 'ar' ? 'ar' : 'en-GB';
  const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale, { weekday: 'short' });
  const dateLine = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const unitDone = next ? next.unit.lessons.filter((l) => lessons[l.id]).length : 0;

  return (
    <div className="page" ref={root}>
      <div className="today-head">
        <div>
          <div className="today-date">{dateLine}</div>
          <h1>
            {hour < 12 ? t('greetingMorning') : t('greetingEvening')}
            {lang === 'ar' ? '، ' : ', '}
            {profile.name}
          </h1>
        </div>
        <div className="today-goal">
          <Dial value={goalPct} size={96} stroke={5}>
            <span>
              <b>{num(todayXp)}</b>
              <small>
                / {num(profile.dailyGoal)} {t('xp')}
              </small>
            </span>
          </Dial>
          <div>
            <div className="bold">{t('dailyGoal')}</div>
            <div className="small muted">{goalPct >= 1 ? t('goalReached') : pct(goalPct)}</div>
          </div>
        </div>
      </div>

      {next ? (
        <section className="showcase">
          <div>
            <div className="showcase-meta">
              <LevelTag level={next.level.id} />
              <span className="muted">
                {t('unit')} · {rich(next.unit.title)}
              </span>
            </div>
            <h2>{rich(next.lesson.title)}</h2>
            <p className="muted" style={{ maxWidth: '52ch' }}>
              {rich(next.lesson.objectives[0])}
            </p>
            <div className="showcase-actions on-night">
              <Link to={`/lesson/${next.lesson.id}`} className="btn btn-brass btn-lg">
                {t('continueLearning')} <Arrow size={18} />
              </Link>
              <Link to={`/learn?level=${next.level.id}`} className="btn btn-lg">
                {t('navLearn')}
              </Link>
            </div>
            <div className="showcase-progress">
              <span>{t('unit')}</span>
              <ProgressBar value={unitDone / next.unit.lessons.length} thin />
              <span className="en">
                {unitDone}/{next.unit.lessons.length}
              </span>
            </div>
          </div>
          <div className="showcase-object">
            <Icon3D name={`level-${next.level.id}`} size={210} eager />
          </div>
        </section>
      ) : (
        <section className="showcase">
          <div>
            <h2>{t('courseComplete')}</h2>
          </div>
          <div className="showcase-object">
            <Icon3D name="trophy" size={210} eager />
          </div>
        </section>
      )}

      <div className="bento">
        <Link to="/review" className="instrument pair">
          <span className="label">{t('navReview')}</span>
          <CountUp to={due} trigger="mount" className="big-number" />
          <span className="small muted">{due > 0 ? t('reviewsDue') : deckSize ? t('noReviews') : t('emptyDeck')}</span>
          <Icon3D name="review" size={84} />
        </Link>
        <div className="instrument pair">
          <span className="label">{t('dayStreak')}</span>
          <CountUp to={streakNow} trigger="mount" className="big-number" />
          <span className="small muted">
            {t('longestStreak')}: {num(streak.longest)}
          </span>
          <Icon3D name="streak" size={84} className={streakNow ? undefined : 'muted3d'} />
        </div>
        <Link to="/vocabulary" className="instrument">
          <span className="label">{t('navVocabulary')}</span>
          <CountUp to={deckSize} trigger="mount" className="big-number" />
          <span className="small muted">
            {num(mastered)} {t('wordsMastered')}
          </span>
          <Icon3D name="vocabulary" size={84} />
        </Link>

        <div className="instrument wide">
          <span className="label">{t('thisWeek')}</span>
          <div className="week" style={{ gridColumn: '1 / -1', marginTop: 8 }}>
            {week.map((d) => {
              const v = xpByDay[d] ?? 0;
              return (
                <div className="day" key={d} title={`${v} XP`}>
                  <span className="tiny num">{v ? num(v) : ''}</span>
                  <div className={`bar ${v >= profile.dailyGoal ? 'goal' : v > 0 ? 'on' : ''}`} style={{ height: `${Math.max(6, (v / maxWeek) * 78)}%` }} />
                  <span>{dayLabel(d)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <Link to="/practice" className="instrument">
          <span className="label">{t('navPractice')}</span>
          <span className="bold" style={{ fontSize: '1.15rem', marginTop: 4 }}>
            {mistakeCount > 0 ? `${num(mistakeCount)} ${t('mistakesToFix')}` : t('quickPractice')}
          </span>
          <span className="hint">{weak ? `${t('weakestSkill')}: ${t(`skill_${weak}`)}` : t('practiceSub').split('.')[0] + '.'}</span>
          <Icon3D name="practice" size={84} />
        </Link>

        <div className="instrument half">
          <span className="label">{t('skills')}</span>
          <div style={{ gridColumn: '1 / -1', marginTop: 10 }}>
            {SKILLS.map((s) => {
              const st = skills[s];
              const acc = st.total ? st.correct / st.total : 0;
              return (
                <div className="skill-row" key={s}>
                  <span className="small">{t(`skill_${s}`)}</span>
                  <ProgressBar value={acc} variant={acc >= 0.8 ? 'success' : undefined} thin />
                  <span className="small faint num" style={{ textAlign: 'end' }}>
                    {st.total ? pct(acc) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {!placement ? (
          <Link to="/placement" className="instrument half showpiece">
            <span className="label">{t('takePlacement')}</span>
            <span className="bold" style={{ fontSize: '1.15rem', marginTop: 4 }}>
              {t('start')} <Arrow size={16} style={{ verticalAlign: '-3px' }} />
            </span>
            <span className="hint">{t('takePlacementDesc')}</span>
            <Icon3D name="placement" size={150} />
          </Link>
        ) : (
          <Link to="/studio" className="instrument half showpiece">
            <span className="label">{t('navStudio')}</span>
            <span className="bold" style={{ fontSize: '1.15rem', marginTop: 4 }}>
              {t('studioTagline')}
            </span>
            <span className="hint">{t('studioSub')}</span>
            <Icon3D name="studio" size={150} />
          </Link>
        )}
      </div>

      <div className="section-title">
        <h2>{t('levelProgress')}</h2>
        <Link to="/learn" className="small link">
          {t('navLearn')}
        </Link>
      </div>
      <div className="card" style={{ padding: '20px 12px 12px' }}>
        <div className="shelf">
          {LEVELS.map((l) => {
            const all = lessonsOfLevel(l.id);
            const done = all.filter((r) => lessons[r.lesson.id]).length;
            const lit = done > 0 || next?.level.id === l.id;
            return (
              <Link to={`/learn?level=${l.id}`} key={l.id} className="shelf-item" style={{ color: `var(--lvl-${l.id})` }} title={pick(l.title)}>
                <Icon3D name={`level-${l.id}`} size={76} className={lit ? undefined : 'muted3d'} />
                <span className="code">{l.id}</span>
                <span className="meter">
                  <span style={{ width: `${all.length ? (done / all.length) * 100 : 0}%` }} />
                </span>
                <span className="of">
                  {num(done)}/{num(all.length)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="section-title">
        <h2>{t('moreWays')}</h2>
        <Link to="/studio" className="small link">
          {t('navStudio')}
        </Link>
      </div>
      <div className="modes">
        {MODES.map((x) => (
          <Link key={x.to} to={x.to} className="mode-card">
            <Icon3D name={x.icon} size={92} />
            <b>{t(x.title)}</b>
            <span>{t(x.desc)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
