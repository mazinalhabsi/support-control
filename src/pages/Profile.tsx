import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Upload, Trash2, Volume2, Compass } from 'lucide-react';
import { ACHIEVEMENTS } from '../lib/achievements';
import { isMastered } from '../lib/srs/fsrs';
import { englishVoices } from '../lib/speech';
import { useSpeak } from '../hooks/useSpeech';
import { useT } from '../i18n';
import { exportData, useProgress, type Theme } from '../store/progress';
import { COURSE_STATS } from '../content';
import { LevelTag, Segmented, Switch } from '../components/ui';
import { cx } from '../lib/util';

function useVoices() {
  const [voices, setVoices] = useState(() => englishVoices());
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    const update = () => setVoices(englishVoices());
    speechSynthesis.addEventListener?.('voiceschanged', update);
    const id = setTimeout(update, 500);
    return () => {
      speechSynthesis.removeEventListener?.('voiceschanged', update);
      clearTimeout(id);
    };
  }, []);
  return voices;
}

export function Profile() {
  const { t, pick, num, lang } = useT();
  const s = useProgress();
  const { speak } = useSpeak();
  const voices = useVoices();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const profile = s.profile!;

  const mastered = Object.values(s.srs).filter(isMastered).length;
  const reviews = Object.values(s.reviewsByDay).reduce((a, b) => a + b, 0);
  const accentVoices = voices.filter((v) => v.lang.replace('_', '-').toLowerCase() === s.settings.accent.toLowerCase());

  const download = () => {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `talaqa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const upload = async (file: File) => {
    try {
      const ok = s.importData(JSON.parse(await file.text()));
      setMsg(ok ? t('importOk') : t('importFail'));
    } catch {
      setMsg(t('importFail'));
    }
  };

  const stats = [
    { label: t('totalXp'), v: s.totalXp },
    { label: t('longestStreak'), v: s.streak.longest },
    { label: t('lessonsDone'), v: Object.keys(s.lessons).length, of: COURSE_STATS.lessons },
    { label: t('wordsLearned'), v: Object.keys(s.srs).length },
    { label: t('wordsMastered'), v: mastered },
    { label: t('totalReviews'), v: reviews },
  ];

  return (
    <div className="page">
      <div className="page-head row" style={{ alignItems: 'center' }}>
        <div className="brand-mark" style={{ width: 56, height: 56, fontSize: '1.6rem', borderRadius: 18 }}>
          {profile.name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 style={{ margin: 0 }}>{profile.name}</h1>
          <div className="faint small row">
            {t('memberSince')} {new Date(profile.createdAt).toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB')} ·{' '}
            {s.placement ? <LevelTag level={s.placement.level} /> : <LevelTag level={profile.startLevel} />}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">{t('statistics')}</div>
        <div className="grid grid-3">
          {stats.map((x) => (
            <div key={x.label} className="stat-card">
              <span className="big-number">
                {num(x.v)}
                {x.of ? <span className="faint small"> / {num(x.of)}</span> : null}
              </span>
              <span className="faint small">{x.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          {t('achievements')}{' '}
          <span className="badge neutral">
            {num(Object.keys(s.achievements).length)}/{num(ACHIEVEMENTS.length)}
          </span>
        </div>
        <div className="ach-grid">
          {ACHIEVEMENTS.map((a) => {
            const got = s.achievements[a.id];
            return (
              <div key={a.id} className={cx('ach', !got && 'locked')} title={pick(a.description)}>
                <div className="icon">{a.icon}</div>
                <div className="bold small">{pick(a.title)}</div>
                <div className="tiny faint">{pick(a.description)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-title">{t('settings')}</div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>{t('editName')}</label>
            <input className="input" value={profile.name} onChange={(e) => s.updateProfile({ name: e.target.value })} />
          </div>
          <div className="toggle-row">
            <span>{t('interfaceLanguage')}</span>
            <Segmented
              value={s.settings.uiLang}
              onChange={(v) => s.setSettings({ uiLang: v })}
              options={[
                { value: 'ar' as const, label: 'العربية' },
                { value: 'en' as const, label: 'English' },
              ]}
            />
          </div>
          <div className="toggle-row">
            <span>{t('dailyGoal')}</span>
            <Segmented
              value={String(profile.dailyGoal)}
              onChange={(v) => s.updateProfile({ dailyGoal: Number(v) })}
              options={['20', '40', '80', '120'].map((v) => ({ value: v, label: num(Number(v)) }))}
            />
          </div>
          <div className="toggle-row">
            <span>{t('theme')}</span>
            <Segmented<Theme>
              value={s.settings.theme}
              onChange={(v) => s.setSettings({ theme: v })}
              options={[
                { value: 'system', label: t('themeSystem') },
                { value: 'light', label: t('themeLight') },
                { value: 'dark', label: t('themeDark') },
              ]}
            />
          </div>
          <div className="toggle-row">
            <span>{t('showIPA')}</span>
            <Switch checked={s.settings.showIPA} onChange={(v) => s.setSettings({ showIPA: v })} label={t('showIPA')} />
          </div>
          <div className="toggle-row">
            <span>{t('showTranslations')}</span>
            <Switch checked={s.settings.showTranslations} onChange={(v) => s.setSettings({ showTranslations: v })} label={t('showTranslations')} />
          </div>
          <div className="toggle-row">
            <span>{t('soundEffects')}</span>
            <Switch checked={s.settings.sounds} onChange={(v) => s.setSettings({ sounds: v })} label={t('soundEffects')} />
          </div>
        </div>

        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-title">
            <Volume2 size={20} /> {t('voice')}
          </div>
          <div className="toggle-row">
            <span>{t('accent')}</span>
            <Segmented
              value={s.settings.accent}
              onChange={(v) => s.setSettings({ accent: v, voiceURI: undefined })}
              options={[
                { value: 'en-GB' as const, label: t('accentGB') },
                { value: 'en-US' as const, label: t('accentUS') },
              ]}
            />
          </div>
          <div className="field" style={{ margin: '12px 0' }}>
            <label>{t('voice')}</label>
            <select className="select" value={s.settings.voiceURI ?? ''} onChange={(e) => s.setSettings({ voiceURI: e.target.value || undefined })}>
              <option value="">{t('autoVoice')}</option>
              {(accentVoices.length ? accentVoices : voices).map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>
              {t('speechRate')}: <span className="en">{s.settings.rate.toFixed(2)}×</span>
            </label>
            <input type="range" min={0.6} max={1.3} step={0.05} value={s.settings.rate} onChange={(e) => s.setSettings({ rate: Number(e.target.value) })} />
          </div>
          <button className="btn btn-soft btn-sm" style={{ marginTop: 12 }} onClick={() => speak('Hello! Welcome to Talaqa. Practice makes perfect.')}>
            <Volume2 size={16} /> {t('testVoice')}
          </button>

          <hr className="divider" />
          <div className="card-title">{t('data')}</div>
          <p className="small muted">{t('dataNote')}</p>
          <div className="row row-wrap">
            <button className="btn btn-sm" onClick={download}>
              <Download size={16} /> {t('exportData')}
            </button>
            <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> {t('importData')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = '';
              }}
            />
            <Link to="/placement" className="btn btn-sm">
              <Compass size={16} /> {t('retakePlacement')}
            </Link>
          </div>
          {msg && <p className="small" style={{ marginTop: 8 }}>{msg}</p>}
          <button
            className="btn btn-danger btn-sm"
            style={{ marginTop: 14 }}
            onClick={() => {
              if (window.confirm(t('resetConfirm'))) s.resetAll();
            }}
          >
            <Trash2 size={16} /> {t('resetData')}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">{t('about')}</div>
        <p className="small muted" style={{ margin: 0 }}>
          {t('aboutText')} · {num(COURSE_STATS.lessons)} {t('lessons')} · {num(COURSE_STATS.words)} {t('words')}
        </p>
      </div>
    </div>
  );
}
