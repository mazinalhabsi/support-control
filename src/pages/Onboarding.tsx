import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Compass, Sprout, Languages } from 'lucide-react';
import { CEFR_LEVELS, type CEFR } from '../content/types';
import { getLevel } from '../content';
import { useT } from '../i18n';
import type { StringKey } from '../i18n/strings';
import { useProgress, type Goal } from '../store/progress';
import { LevelTag } from '../components/ui';
import { cx } from '../lib/util';

const GOALS: { id: Goal; icon: string }[] = [
  { id: 'general', icon: '🌱' },
  { id: 'travel', icon: '✈️' },
  { id: 'work', icon: '💼' },
  { id: 'study', icon: '🎓' },
  { id: 'exam', icon: '📝' },
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

  const finish = (startLevel: CEFR, thenPlacement: boolean) => {
    complete({ name: name.trim() || (lang === 'ar' ? 'صديقي' : 'Friend'), goal, dailyGoal: daily, startLevel });
    navigate(thenPlacement ? '/placement' : '/', { replace: true });
  };

  return (
    <div className="onboard">
      <div className="onboard-card">
        <div className="row spread" style={{ marginBottom: 16 }}>
          <div className="brand" style={{ padding: 0 }}>
            <div className="brand-mark">ط</div>
            <div>
              <div className="brand-name">{t('appName')}</div>
              <div className="brand-sub en">Talaqa · English</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setSettings({ uiLang: lang === 'ar' ? 'en' : 'ar' })}>
            <Languages size={16} /> {lang === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>

        <div className="card" style={{ padding: 28 }}>
          {step === 0 && (
            <>
              <h1>{t('welcomeTitle')}</h1>
              <p className="muted">{t('welcomeSub')}</p>
              <ul className="feature-list">
                {(['feature1', 'feature2', 'feature3', 'feature4'] as StringKey[]).map((k) => (
                  <li key={k}>
                    <CheckCircle2 size={20} /> {t(k)}
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
              <div className="choice-grid">
                {GOALS.map((g) => (
                  <button key={g.id} className={cx('choice', goal === g.id && 'active')} onClick={() => setGoal(g.id)}>
                    <span className="ico">{g.icon}</span>
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
                    <Compass color="var(--primary)" />
                  </span>
                  <span>
                    <span className="bold">{t('startPlacement')}</span>
                    <br />
                    <span className="muted small">{t('startPlacementDesc')}</span>
                  </span>
                </button>
                <button className="choice" onClick={() => finish('A1', false)}>
                  <span className="ico">
                    <Sprout color="var(--success)" />
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
