import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useT } from '../../i18n';
import { useProgress } from '../../store/progress';
import { Icon3D, type IconName } from '../../components/Icon3D';
import { LevelTag } from '../../components/ui';
import { CountUp } from '../../components/fx/CountUp';
import { cx } from '../../lib/util';
import { dialogueSources, type DialogueSource } from '../../lib/studio';

export { initialsHint, wordPool, type DialogueSource } from '../../lib/studio';

/** Frame shared by every studio mode: back link, object, title and intro. */
export function StudioFrame({
  icon,
  title,
  intro,
  children,
  narrow = true,
}: {
  icon: IconName;
  title: string;
  intro?: string;
  children: ReactNode;
  narrow?: boolean;
}) {
  const { t, lang } = useT();
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  return (
    <div className={cx('page', narrow && 'page-narrow')}>
      <Link to="/studio" className="btn btn-ghost btn-sm" style={{ marginInlineStart: -12, marginBottom: 8 }}>
        <Back size={16} /> {t('backToStudio')}
      </Link>
      <div className="page-head with-object">
        <h1>{title}</h1>
        {intro && <p>{intro}</p>}
        <Icon3D name={icon} size={108} eager />
      </div>
      {children}
    </div>
  );
}

/** Dialogue picker used by role-play and shadowing. */
export function DialoguePicker({ onPick }: { onPick: (d: DialogueSource) => void }) {
  const { t, rich } = useT();
  const lessons = useProgress((s) => s.lessons);
  const sources = dialogueSources(lessons);
  const done = sources.filter((d) => d.done);
  const rest = sources.filter((d) => !d.done).slice(0, 12);
  const list = (items: DialogueSource[]) => (
    <div className="pick-list">
      {items.map((d) => (
        <button key={d.lessonId} className="pick-item" onClick={() => onPick(d)}>
          <LevelTag level={d.level} />
          <span className="grow">
            <b>{rich(d.title)}</b>
            <span className="faint small en"> · {d.lines.length}</span>
          </span>
        </button>
      ))}
    </div>
  );
  return (
    <div className="stack" style={{ gap: 18 }}>
      {done.length > 0 && (
        <section>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {t('fromYourLessons')}
          </div>
          {list(done)}
        </section>
      )}
      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          {t('fromCourse')}
        </div>
        {list(rest)}
      </section>
    </div>
  );
}

/** End-of-session panel: the object, the score and what to do next. */
export function ResultPanel({
  icon,
  score,
  suffix = '',
  xp,
  best,
  children,
}: {
  icon: IconName;
  score: number;
  suffix?: string;
  xp: number;
  best?: boolean;
  children?: ReactNode;
}) {
  const { t, num } = useT();
  return (
    <div className="card celebrate">
      <div className="emoji">
        <Icon3D name={icon} size={150} eager />
      </div>
      {best && (
        <div className="chip active" style={{ marginBottom: 8 }}>
          {t('newBest')}
        </div>
      )}
      <div className="big-number" style={{ fontSize: '3.4rem' }}>
        <CountUp to={score} trigger="mount" />
        {suffix}
      </div>
      <p className="muted">{t('earnedXp', { xp: num(xp) })}</p>
      <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 }}>
        {children}
      </div>
    </div>
  );
}
