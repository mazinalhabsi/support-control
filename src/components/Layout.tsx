import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Home,
  Map as MapIcon,
  Repeat,
  Zap,
  Mic,
  Library,
  BookMarked,
  Layers,
  User,
  Flame,
  Target,
  Languages,
  MoreHorizontal,
} from 'lucide-react';
import { useT } from '../i18n';
import type { StringKey } from '../i18n/strings';
import { activeStreak, useProgress } from '../store/progress';
import { isDue } from '../lib/srs/fsrs';
import { dateKey, cx } from '../lib/util';
import { achievementById } from '../lib/achievements';
import { gsap } from '../motion/core';
import { scrollToTop, useReducedMotion } from '../motion/MotionProvider';
import { sparkAt } from './fx/Celebrate';
import { CountUp } from './fx/CountUp';
import { RouteLoading } from './ui';

interface NavItem {
  to: string;
  key: StringKey;
  icon: ReactNode;
}

const NAV: NavItem[] = [
  { to: '/', key: 'navHome', icon: <Home size={20} /> },
  { to: '/learn', key: 'navLearn', icon: <MapIcon size={20} /> },
  { to: '/review', key: 'navReview', icon: <Repeat size={20} /> },
  { to: '/practice', key: 'navPractice', icon: <Zap size={20} /> },
  { to: '/pronunciation', key: 'navPronunciation', icon: <Mic size={20} /> },
  { to: '/library', key: 'navLibrary', icon: <Library size={20} /> },
  { to: '/grammar', key: 'navGrammar', icon: <BookMarked size={20} /> },
  { to: '/vocabulary', key: 'navVocabulary', icon: <Layers size={20} /> },
  { to: '/profile', key: 'navProfile', icon: <User size={20} /> },
];

const MOBILE_MAIN = ['/', '/learn', '/review', '/practice'];

export function useDueCount(): number {
  const srs = useProgress((s) => s.srs);
  // Recomputed when the deck changes; due-ness shifts slowly enough for that.
  return useMemo(() => {
    const now = Date.now();
    return Object.values(srs).filter((c) => isDue(c, now)).length;
  }, [srs]);
}

function Brand() {
  const { t } = useT();
  return (
    <NavLink to="/" className="brand">
      <div className="brand-mark">ط</div>
      <div>
        <div className="brand-name">{t('appName')}</div>
        <div className="brand-sub en">Talaqa · English</div>
      </div>
    </NavLink>
  );
}

function AchievementToast() {
  const { pick, t } = useT();
  const pending = useProgress((s) => s.newAchievements);
  const dismiss = useProgress((s) => s.dismissAchievements);
  const current = pending[0] ? achievementById(pending[0]) : undefined;
  useEffect(() => {
    if (!current) return;
    const id = setTimeout(dismiss, 4200);
    return () => clearTimeout(id);
  }, [current, dismiss]);
  const ref = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    if (!current || reduced || !ref.current) return;
    gsap.from(ref.current, { y: -36, scale: 0.85, opacity: 0, duration: 0.7, ease: 'back.out(2.2)' });
    const icon = ref.current.querySelector('.icon');
    const id = setTimeout(() => sparkAt(icon, { count: 12 }), 250);
    return () => clearTimeout(id);
  }, [current, reduced]);
  if (!current) return null;
  return (
    <div className="toast-wrap">
      <button ref={ref} className="toast" onClick={dismiss}>
        <span className="icon">{current.icon}</span>
        <span style={{ textAlign: 'start' }}>
          <span className="tiny faint bold">{t('newAchievement')}</span>
          <br />
          <span className="bold">{pick(current.title)}</span> — <span className="small muted">{pick(current.description)}</span>
        </span>
      </button>
    </div>
  );
}

/** Fades each page in and resets the scroll position on navigation. */
function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    scrollToTop();
    if (reduced || !ref.current) return;
    const tween = gsap.fromTo(ref.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', clearProps: 'transform,opacity' });
    return () => {
      tween.kill();
    };
  }, [pathname, reduced]);
  return (
    <div ref={ref} className="page-transition">
      {children}
    </div>
  );
}

/** XP counter that ticks up and shows a small "+N" whenever XP is earned. */
function XpPill({ value, title }: { value: number; title: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const initial = useRef(value);
  const prev = useRef(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    const diff = value - prev.current;
    prev.current = value;
    if (diff <= 0 || reduced || !ref.current) return;
    const float = document.createElement('span');
    float.className = 'xp-float en';
    float.textContent = `+${diff}`;
    ref.current.appendChild(float);
    gsap.fromTo(float, { xPercent: -50, y: 0, opacity: 1 }, { y: 28, opacity: 0, duration: 1.1, ease: 'power2.out', onComplete: () => float.remove() });
    gsap.fromTo(ref.current, { scale: 1.14 }, { scale: 1, duration: 0.55, ease: 'back.out(3)', clearProps: 'transform' });
  }, [value, reduced]);
  return (
    <span ref={ref} className="stat-pill xp" title={title}>
      <Zap size={18} /> <CountUp to={value} from={initial.current} trigger="mount" duration={0.8} />
    </span>
  );
}

export function Layout() {
  const { t, num, lang } = useT();
  const location = useLocation();
  const due = useDueCount();
  const streak = useProgress((s) => s.streak);
  const totalXp = useProgress((s) => s.totalXp);
  const todayXp = useProgress((s) => s.xpByDay[dateKey()] ?? 0);
  const dailyGoal = useProgress((s) => s.profile?.dailyGoal ?? 30);
  const setSettings = useProgress((s) => s.setSettings);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [location.pathname]);

  const streakNow = activeStreak(streak);
  const goalPct = Math.min(1, todayXp / dailyGoal);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('nav-link', isActive && 'active')}>
            {n.icon}
            <span>{t(n.key)}</span>
            {n.to === '/review' && due > 0 && <span className="badge">{num(due)}</span>}
          </NavLink>
        ))}
        <div className="sidebar-foot">{t('tagline')}</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Brand />
          <div className="topbar-stats">
            <span className={cx('stat-pill streak', goalPct >= 1 && streakNow > 0 && 'lit')} title={t('dayStreak')}>
              <Flame size={18} fill={streakNow > 0 ? 'currentColor' : 'none'} /> {num(streakNow)}
            </span>
            <span className="stat-pill goal" title={t('dailyGoal')} style={{ color: goalPct >= 1 ? 'var(--success)' : 'var(--text-2)' }}>
              <Target size={18} /> {num(todayXp)}/{num(dailyGoal)}
            </span>
            <XpPill value={totalXp} title={t('totalXp')} />
            <button
              className="icon-btn"
              title={t('interfaceLanguage')}
              aria-label={t('interfaceLanguage')}
              onClick={() => setSettings({ uiLang: lang === 'ar' ? 'en' : 'ar' })}
            >
              <Languages size={18} />
            </button>
          </div>
        </header>
        <AchievementToast />
        <Suspense fallback={<RouteLoading />}>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </Suspense>
      </div>

      <nav className="bottombar">
        {NAV.filter((n) => MOBILE_MAIN.includes(n.to)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx(isActive && 'active')}>
            {n.icon}
            <span>{t(n.key)}</span>
            {n.to === '/review' && due > 0 && (
              <span className="badge" style={{ position: 'absolute', top: 6, insetInlineEnd: '22%' }}>
                {num(due)}
              </span>
            )}
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
          <MoreHorizontal size={20} />
          <span>{t('more')}</span>
        </button>
      </nav>
      {moreOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 25, background: 'rgba(0,0,0,.25)' }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="card"
            style={{ position: 'absolute', insetInline: 12, bottom: 'calc(var(--bottombar-h) + 12px)', padding: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            {NAV.filter((n) => !MOBILE_MAIN.includes(n.to)).map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cx('nav-link', isActive && 'active')}>
                {n.icon}
                <span>{t(n.key)}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
