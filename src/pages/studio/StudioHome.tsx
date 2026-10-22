import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n';
import type { StringKey } from '../../i18n/strings';
import { useProgress } from '../../store/progress';
import { Icon3D, type IconName } from '../../components/Icon3D';
import { useStaggerIn } from '../../motion/hooks';

const MODES: { id: string; icon: IconName; title: StringKey; desc: StringKey; skill: StringKey; unit?: string }[] = [
  { id: 'roleplay', icon: 'roleplay', title: 'modeRoleplay', desc: 'modeRoleplayDesc', skill: 'skill_speaking', unit: '%' },
  { id: 'shadowing', icon: 'shadowing', title: 'modeShadowing', desc: 'modeShadowingDesc', skill: 'skill_speaking', unit: '%' },
  { id: 'listening', icon: 'listening', title: 'modeListening', desc: 'modeListeningDesc', skill: 'skill_listening' },
  { id: 'sprint', icon: 'sprint', title: 'modeSprint', desc: 'modeSprintDesc', skill: 'skill_vocabulary' },
  { id: 'spelling', icon: 'spelling', title: 'modeSpelling', desc: 'modeSpellingDesc', skill: 'skill_writing', unit: '%' },
];

export function StudioHome() {
  const { t, num } = useT();
  const studio = useProgress((s) => s.studio);
  const root = useRef<HTMLDivElement>(null);
  useStaggerIn(root, '.studio-card');
  return (
    <div className="page" ref={root}>
      <div className="page-head with-object">
        <span className="eyebrow">{t('studioTagline')}</span>
        <h1>{t('studioTitle')}</h1>
        <p>{t('studioSub')}</p>
        <Icon3D name="studio" size={120} eager />
      </div>
      <div className="studio-grid">
        {MODES.map((x, k) => {
          const rec = studio[x.id];
          return (
            <Link key={x.id} to={`/studio/${x.id}`} className={`studio-card ${k === 0 ? 'feature' : ''}`}>
              <Icon3D name={x.icon} size={k === 0 ? 180 : 120} />
              <div className="studio-copy">
                <span className="eyebrow">{t(x.skill)}</span>
                <b>{t(x.title)}</b>
                <span className="muted small">{t(x.desc)}</span>
                {rec && (
                  <span className="studio-stats">
                    <span>
                      {t('bestScore')}{' '}
                      <b className="num">
                        {num(rec.best)}
                        {x.unit ?? ''}
                      </b>
                    </span>
                    <span>
                      {t('played')} <b className="num">{num(rec.plays)}</b>
                    </span>
                  </span>
                )}
              </div>
            </Link>
          );
        })}
        <Link to="/pronunciation" className="studio-card">
          <Icon3D name="pronunciation" size={120} />
          <div className="studio-copy">
            <span className="eyebrow">{t('skill_speaking')}</span>
            <b>{t('navPronunciation')}</b>
            <span className="muted small">{t('modePronDesc')}</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
