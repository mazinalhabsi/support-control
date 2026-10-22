import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, m, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react';
import { Languages } from 'lucide-react';
import { useT } from '../i18n';
import type { StringKey } from '../i18n/strings';
import { activeStreak, useProgress } from '../store/progress';
import { isDue } from '../lib/srs/fsrs';
import { dateKey, cx } from '../lib/util';
import { achievementById } from '../lib/achievements';
import { gsap, haptic } from '../motion/core';
import { scrollToTop, useReducedMotion } from '../motion/MotionProvider';
import { sparkAt } from './fx/Celebrate';
import { CountUp } from './fx/CountUp';
import { Dial, RouteLoading } from './ui';
import { Icon3D, type IconName } from './Icon3D';

interface NavItem {
  to: string;
  key: StringKey;
  icon: IconName;
}

const NAV: NavItem[] = [
  { to: '/', key: 'navHome', icon: 'today' },
  { to: '/learn', key: 'navLearn', icon: 'learn' },
  { to: '/review', key: 'navReview', icon: 'review' },
  { to: '/studio', key: 'navStudio', icon: 'studio' },
  { to: '/practice', key: 'navPractice', icon: 'practice' },
  { to: '/pronunciation', key: 'navPronunciation', icon: 'pronunciation' },
  { to: '/library', key: 'navLibrary', icon: 'library' },
  { to: '/grammar', key: 'navGrammar', icon: 'grammar' },
  { to: '/vocabulary', key: 'navVocabulary', icon: 'vocabulary' },
];
/** Where the dock draws its divider: daily loop | reference shelves. */
const DOCK_SPLIT = 5;
const MOBILE_MAIN = ['/', '/learn', '/review', '/studio'];

export function useDueCount(): number {
  const srs = useProgress((s) => s.srs);
  // Recomputed when the deck changes; due-ness shifts slowly enough for that.
  return useMemo(() => {
    const now = Date.now();
    return Object.values(srs).filter((c) => isDue(c, now)).length;
  }, [srs]);
}

function isActive(pathname: string, to: string): boolean {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

function Brand() {
  const { t } = useT();
  return (
    <Link to="/" className="brand" aria-label={t('appName')}>
      <span className="brand-word">طلاقة</span>
      <span className="brand-latin en">Talaqa</span>
    </Link>
  );
}

/**
 * Achievement announcement that grows out of a pill — the "island"
 * pattern: compact first, then it unfolds to tell you what you earned.
 */
function AchievementIsland() {
  const { pick, t } = useT();
  const pending = useProgress((s) => s.newAchievements);
  const dismiss = useProgress((s) => s.dismissAchievements);
  const current = pending[0] ? achievementById(pending[0]) : undefined;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!current) return;
    setOpen(false);
    const unfold = setTimeout(() => {
      setOpen(true);
      if (!reduced) sparkAt(ref.current?.querySelector('.ico3d'), { count: 12 });
      haptic([8, 40, 12]);
    }, 450);
    const close = setTimeout(dismiss, 4600);
    return () => {
      clearTimeout(unfold);
      clearTimeout(close);
    };
  }, [current, dismiss, reduced]);
  return (
    <div className="island-wrap">
      <AnimatePresence>
        {current && (
          <m.button
            key={current.id}
            ref={ref}
            layout
            className={cx('island', open && 'open')}
            onClick={dismiss}
            initial={{ opacity: 0, y: -24, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.85 }}
            style={{ borderRadius: 999 }}
          >
            <m.span layout="position" className="island-medal">
              <Icon3D name={current.icon} size={open ? 54 : 30} eager />
            </m.span>
            <m.span layout="position" className="island-text">
              <span className="island-kicker">{t('newAchievement')}</span>
              {open && (
                <m.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }} className="island-body">
                  <b>{pick(current.title)}</b>
                  <span>{pick(current.description)}</span>
                </m.span>
              )}
            </m.span>
          </m.button>
        )}
      </AnimatePresence>
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
    const tween = gsap.fromTo(
      ref.current,
      { opacity: 0, y: 18, filter: 'blur(6px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.55, ease: 'expo.out', clearProps: 'transform,opacity,filter' },
    );
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
function XpChip({ value, title }: { value: number; title: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const initial = useRef(value);
  const prev = useRef(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    const diff = value - prev.current;
    prev.current = value;
    if (diff <= 0 || reduced || !ref.current) return;
    const float = document.createElement('span');
    float.className = 'xp-float';
    float.textContent = `+${diff}`;
    ref.current.appendChild(float);
    gsap.fromTo(float, { xPercent: -50, y: 0, opacity: 1 }, { y: 30, opacity: 0, duration: 1.1, ease: 'power2.out', onComplete: () => float.remove() });
    gsap.fromTo(ref.current.querySelector('.ico3d'), { rotate: -25, scale: 1.35 }, { rotate: 0, scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.45)' });
  }, [value, reduced]);
  return (
    <span ref={ref} className="hstat" title={title}>
      <Icon3D name="xp" size={26} eager />
      <CountUp to={value} from={initial.current} trigger="mount" duration={0.8} className="num" />
    </span>
  );
}

/* ------------------------------------------------------------------ dock */

function DockItem({ item, mouseX, active, badge, reduced }: { item: NavItem; mouseX: MotionValue<number>; active: boolean; badge?: number; reduced: boolean }) {
  const { t, num } = useT();
  const ref = useRef<HTMLAnchorElement>(null);
  const distance = useTransform(mouseX, (x) => {
    const b = ref.current?.getBoundingClientRect();
    return b ? x - b.left - b.width / 2 : Infinity;
  });
  // macOS-style magnification: neighbours swell with distance from the pointer
  const target = useTransform(distance, [-150, 0, 150], [50, 76, 50]);
  const size = useSpring(target, { mass: 0.12, stiffness: 190, damping: 15 });
  return (
    <NavLink ref={ref} to={item.to} end={item.to === '/'} className={cx('dock-item', active && 'active')} aria-label={t(item.key)}>
      <m.span className="dock-icon" style={reduced ? undefined : { width: size, height: size }}>
        <Icon3D name={item.icon} size={76} eager />
      </m.span>
      <span className="dock-label" role="tooltip">
        {t(item.key)}
      </span>
      {badge ? <span className="badge dock-badge">{num(badge)}</span> : null}
      {active && <m.span layoutId="dock-dot" className="dock-dot" />}
    </NavLink>
  );
}

function Dock({ due }: { due: number }) {
  const { pathname } = useLocation();
  const mouseX = useMotionValue(Infinity);
  const reduced = useReducedMotion();
  return (
    <nav className="dock" onMouseMove={(e) => mouseX.set(e.clientX)} onMouseLeave={() => mouseX.set(Infinity)}>
      {NAV.map((n, i) => (
        <span key={n.to} className="dock-slot">
          {i === DOCK_SPLIT && <span className="dock-sep" aria-hidden="true" />}
          <DockItem item={n} mouseX={mouseX} active={isActive(pathname, n.to)} badge={n.to === '/review' ? due : 0} reduced={reduced} />
        </span>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ phone */

function TabBar({ due, onMore, moreOpen }: { due: number; onMore: () => void; moreOpen: boolean }) {
  const { t, num } = useT();
  const { pathname } = useLocation();
  const inMore = !NAV.filter((n) => MOBILE_MAIN.includes(n.to)).some((n) => isActive(pathname, n.to));
  return (
    <nav className="tabbar">
      {NAV.filter((n) => MOBILE_MAIN.includes(n.to)).map((n) => {
        const active = isActive(pathname, n.to);
        return (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={cx('tab', active && 'active')}>
            {active && <m.span layoutId="tab-pill" className="tab-pill" />}
            <m.span className="tab-ico" animate={{ y: active ? -3 : 0, scale: active ? 1.12 : 1 }}>
              <Icon3D name={n.icon} size={34} eager />
            </m.span>
            <span className="tab-label">{t(n.key)}</span>
            {n.to === '/review' && due > 0 && <span className="badge tab-badge">{num(due)}</span>}
          </NavLink>
        );
      })}
      <button className={cx('tab', (moreOpen || inMore) && 'active')} onClick={onMore} aria-expanded={moreOpen}>
        {inMore && !moreOpen && <m.span layoutId="tab-pill" className="tab-pill" />}
        <span className="tab-ico more-dots" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="tab-label">{t('more')}</span>
      </button>
    </nav>
  );
}

/** Bottom sheet with the remaining shelves; drag down or tap outside to close. */
function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const items: NavItem[] = [
    ...NAV.filter((n) => !MOBILE_MAIN.includes(n.to)),
    { to: '/placement', key: 'takePlacement', icon: 'placement' },
    { to: '/profile', key: 'navProfile', icon: 'profile' },
  ];
  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <m.div
            className="sheet"
            role="dialog"
            aria-label={t('more')}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 500) onClose();
            }}
          >
            <span className="sheet-grip" aria-hidden="true" />
            <div className="sheet-grid">
              {items.map((n, i) => (
                <m.div
                  key={n.to}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i, type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <NavLink to={n.to} className="sheet-item" onClick={onClose}>
                    <Icon3D name={n.icon} size={64} eager />
                    <span>{t(n.key)}</span>
                  </NavLink>
                </m.div>
              ))}
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ shell */

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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setMoreOpen(false), [location.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const streakNow = activeStreak(streak);
  const goalPct = Math.min(1, todayXp / dailyGoal);

  return (
    <div className="shell">
      <header className={cx('topbar', scrolled && 'scrolled')}>
        <Brand />
        <div className="topbar-stats">
          <span className={cx('hstat', goalPct >= 1 && streakNow > 0 && 'lit')} title={t('dayStreak')}>
            <Icon3D name="streak" size={26} eager className={streakNow ? undefined : 'muted3d'} />
            <span className="num">{num(streakNow)}</span>
          </span>
          <span className="hstat goal" title={t('dailyGoal')}>
            <Dial value={goalPct} size={26} stroke={3} ticks={0} />
            <span className="num">
              {num(todayXp)}
              <span className="faint">/{num(dailyGoal)}</span>
            </span>
          </span>
          <XpChip value={totalXp} title={t('totalXp')} />
          <button
            className="icon-btn"
            title={t('interfaceLanguage')}
            aria-label={t('interfaceLanguage')}
            onClick={() => setSettings({ uiLang: lang === 'ar' ? 'en' : 'ar' })}
          >
            <Languages size={18} />
          </button>
          <NavLink to="/profile" className="seal-link" aria-label={t('navProfile')} title={t('navProfile')}>
            <Icon3D name="profile" size={40} eager />
          </NavLink>
        </div>
      </header>

      <AchievementIsland />
      <main className="main">
        <Suspense fallback={<RouteLoading />}>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </Suspense>
      </main>

      <Dock due={due} />
      <TabBar due={due} moreOpen={moreOpen} onMore={() => setMoreOpen((v) => !v)} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}
