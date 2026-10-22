import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Languages } from 'lucide-react';
import { CEFR_LEVELS, type CEFR } from '../content/types';
import { getLevel } from '../content';
import { useT } from '../i18n';
import type { StringKey } from '../i18n/strings';
import { useProgress, type Goal } from '../store/progress';
import { LevelTag } from '../components/ui';
import { cx } from '../lib/util';
import { Icon3D, type IconName } from '../components/Icon3D';
import { SplitText } from '../components/fx/SplitText';
import { gsap } from '../motion/core';
import { useReducedMotion } from '../motion/MotionProvider';

const GOALS: { id: Goal; icon: IconName }[] = [
  { id: 'general', icon: 'goal-general' },
  { id: 'travel', icon: 'goal-travel' },
  { id: 'work', icon: 'goal-work' },
  { id: 'study', icon: 'goal-study' },
  { id: 'exam', icon: 'goal-exam' },
];

const DAILY: { xp: number; key: StringKey; mins: number }[] = [
  { xp: 20, key: 'goalCasual', mins: 5 },
  { xp: 40, key: 'goalRegular', mins: 10 },
  { xp: 80, key: 'goalSerious', mins: 20 },
  { xp: 120, key: 'goalIntense', mins: 30 },
];

export function Onboarding() {
  const { t, num, pick, lang } = useT();
  const navigate = useNavigate();
  const complete = useProgress((s) => s.completeOnboarding);
  const setSettings = useProgress((s) => s.setSettings);
  const existing = useProgress((s) => s.profile);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(existing?.name ?? '');
  const [goal, setGoal] = useState<Goal>('general');
  const [daily, setDaily] = useState(40);
  const cardRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Steps slide in from the reading direction; choices cascade after them.
  useLayoutEffect(() => {
    if (reduced || !cardRef.current) return;
    const tl = gsap.timeline();
    tl.fromTo(cardRef.current, { x: lang === 'ar' ? -30 : 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, clearProps: 'transform,opacity' });
    const items = cardRef.current.querySelectorAll('.choice, .feature-list li, .chip');
    if (items.length) tl.from(items, { y: 12, opacity: 0, stagger: 0.04, duration: 0.35, clearProps: 'transform,opacity' }, '-=0.2');
    return () => {
      tl.kill();
    };
  }, [step, reduced, lang]);

  const finish = (startLevel: CEFR, thenPlacement: boolean) => {
    complete({ name: name.trim() || (lang === 'ar' ? 'صديقي' : 'Friend'), goal, dailyGoal: daily, startLevel });
    navigate(thenPlacement ? '/placement' : '/', { replace: true });
  };

  return (
    <div className="onboard">
      <div className="onboard-gems" aria-hidden="true">
        {CEFR_LEVELS.map((l, i) => (
          <Icon3D key={l} name={`level-${l}`} size={120} eager className={`og og-${i}`} />
        ))}
      </div>
      <div className="onboard-card">
        <div className="row spread" style={{ marginBottom: 16 }}>
          <div className="brand">
            <span className="brand-word">طلاقة</span>
            <span className="brand-latin en">Talaqa</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setSettings({ uiLang: lang === 'ar' ? 'en' : 'ar' })}>
            <Languages size={16} /> {lang === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>

        <div className="card onboard-panel" ref={cardRef}>
          {step === 0 && (
            <>
              <SplitText as="h1" text={t('welcomeTitle')} />
              <p className="muted">{t('welcomeSub')}</p>
              <ul className="feature-list">
                {(['feature1', 'feature2', 'feature3', 'feature4'] as StringKey[]).map((k) => (
                  <li key={k}>
                    <Check size={18} /> {t(k)}
                  </li>
                ))}
              </ul>
              <div className="field" style={{ marginTop: 10 }}>
                <label htmlFor="name">{t('yourName')}</label>
                <input
                  id="name"
                  className="input"
                  value={name}
                  placeholder={t('namePlaceholder')}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setStep(1)}
                  autoFocus
                />
              </div>
              <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 18 }} onClick={() => setStep(1)}>
                {t('continue')}
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <h2>{t('whyLearn')}</h2>
              <div className="choice-grid goals">
                {GOALS.map((g) => (
                  <button key={g.id} className={cx('choice', goal === g.id && 'active')} onClick={() => setGoal(g.id)}>
                    <span className="ico">
                      <Icon3D name={g.icon} size={76} eager />
                    </span>
                    <span className="bold">{t(`goal_${g.id}` as StringKey)}</span>
                  </button>
                ))}
              </div>
              <h2 style={{ marginTop: 24 }}>{t('dailyGoalQ')}</h2>
              <div className="choice-grid">
                {DAILY.map((d) => (
                  <button key={d.xp} className={cx('choice', daily === d.xp && 'active')} onClick={() => setDaily(d.xp)}>
                    <span className="bold grow">{t(d.key)}</span>
                    <span className="muted small">
                      {num(d.mins)} {t('minutes')} / {t('perDay')} · {num(d.xp)} {t('xp')}
                    </span>
                  </button>
                ))}
              </div>
              <div className="row" style={{ marginTop: 18 }}>
                <button className="btn" onClick={() => setStep(0)}>
                  {t('back')}
                </button>
                <button className="btn btn-primary btn-lg grow" onClick={() => setStep(2)}>
                  {t('continue')}
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2>{t('howStart')}</h2>
              <div className="choice-grid">
                <button className="choice" onClick={() => finish('A1', true)}>
                  <span className="ico">
                    <Icon3D name="placement" size={64} eager />
                  </span>
                  <span>
                    <span className="bold">{t('startPlacement')}</span>
                    <br />
                    <span className="muted small">{t('startPlacementDesc')}</span>
                  </span>
                </button>
                <button className="choice" onClick={() => finish('A1', false)}>
                  <span className="ico">
                    <Icon3D name="goal-general" size={64} eager />
                  </span>
                  <span>
                    <span className="bold">{t('startZero')}</span>
                    <br />
                    <span className="muted small">{t('startZeroDesc')}</span>
                  </span>
                </button>
              </div>
              <div className="faint small" style={{ margin: '18px 0 8px' }}>
                {t('chooseLevel')}
              </div>
              <div className="row row-wrap">
                {CEFR_LEVELS.map((l) => (
                  <button key={l} className="chip" onClick={() => finish(l, false)} title={pick(getLevel(l).title)}>
                    <LevelTag level={l} /> {pick(getLevel(l).title)}
                  </button>
                ))}
              </div>
              <button className="btn btn-ghost" style={{ marginTop: 18 }} onClick={() => setStep(1)}>
                {t('back')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
