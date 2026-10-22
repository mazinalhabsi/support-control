import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Clock } from 'lucide-react';
import { LEVELS, getLevel, lessonsOfLevel, nextLesson } from '../content';
import { CEFR_LEVELS, type CEFR } from '../content/types';
import { useT } from '../i18n';
import { useProgress } from '../store/progress';
import { LevelTag, ProgressBar, Stars } from '../components/ui';
import { Icon3D } from '../components/Icon3D';
import { cx } from '../lib/util';
import { useStaggerIn } from '../motion/hooks';

export function Course() {
  const { t, rich, num } = useT();
  const [params, setParams] = useSearchParams();
  const lessons = useProgress((s) => s.lessons);
  const startLevel = useProgress((s) => s.profile?.startLevel ?? 'A1');
  const next = nextLesson(lessons, startLevel);
  const param = params.get('level') as CEFR | null;
  const levelId: CEFR = param && CEFR_LEVELS.includes(param) ? param : (next?.level.id ?? startLevel);
  const level = getLevel(levelId);
  let n = 0;
  const root = useRef<HTMLDivElement>(null);
  useStaggerIn(root, '.unit-head, .lesson-row', [levelId], { stagger: 0.03 });

  return (
    <div className="page" ref={root}>
      <div className="page-head with-object">
        <h1>{t('courseTitle')}</h1>
        <p>{t('courseSub')}</p>
        <Icon3D name="learn" size={108} eager />
      </div>

      <div className="level-tabs" role="tablist">
        {LEVELS.map((l) => {
          const all = lessonsOfLevel(l.id);
          const done = all.filter((r) => lessons[r.lesson.id]).length;
          return (
            <button
              key={l.id}
              role="tab"
              aria-selected={l.id === levelId}
              className={cx('level-tab', l.id === levelId && 'active')}
              style={{ color: `var(--lvl-${l.id})` }}
              onClick={() => setParams({ level: l.id })}
            >
              <Icon3D name={`level-${l.id}`} size={54} eager className={done || l.id === levelId ? undefined : 'muted3d'} />
              <span className="code">{l.id}</span>
              <span className="name">{rich(l.title)}</span>
              <span className="tiny faint en">
                {done}/{all.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="card level-intro" style={{ marginBottom: 26, color: `var(--lvl-${level.id})` }}>
        <div className="row" style={{ alignItems: 'center', gap: 18 }}>
          <Icon3D name={`level-${level.id}`} size={96} eager />
          <div className="grow" style={{ color: 'var(--text)' }}>
            <LevelTag level={level.id} className="level-intro-tag" />
            <h2 style={{ marginBottom: 4 }}>{rich(level.title)}</h2>
            <p className="muted" style={{ marginBottom: 6 }}>
              {rich(level.description)}
            </p>
            <div className="faint small row">
              <Clock size={14} /> {t('guidedHours', { hours: num(level.hours) })} {level.id}
            </div>
          </div>
        </div>
      </div>

      {level.units.map((unit, ui) => {
        const done = unit.lessons.filter((l) => lessons[l.id]).length;
        return (
          <section key={unit.id} className="unit-block">
            <div className="unit-head" style={{ ['--unit-color' as string]: `var(--lvl-${level.id})` }}>
              <span className="unit-num">{String(ui + 1).padStart(2, '0')}</span>
              <div className="grow">
                <div className="tiny faint">{t('unit')}</div>
                <div className="bold" style={{ fontSize: '1.12rem' }}>
                  {rich(unit.title)}
                </div>
              </div>
              <div style={{ width: 96 }}>
                <ProgressBar value={done / unit.lessons.length} thin />
                <div className="tiny faint" style={{ textAlign: 'end', marginTop: 4 }}>
                  {num(done)}/{num(unit.lessons.length)}
                </div>
              </div>
            </div>
            {unit.lessons.map((lesson) => {
              n += 1;
              const rec = lessons[lesson.id];
              const isNext = next?.lesson.id === lesson.id;
              return (
                <Link key={lesson.id} to={`/lesson/${lesson.id}`} className={cx('lesson-row', isNext && 'next glow-border')}>
                  <div className={cx('lesson-icon', rec && 'done', isNext && 'next')}>{rec ? <Check size={22} /> : num(n)}</div>
                  <div className="grow">
                    <div className="bold">{rich(lesson.title)}</div>
                    <div className="small faint">
                      {lesson.vocab.length} {t('words')}
                      {lesson.grammar && <> · {rich(lesson.grammar.title)}</>}
                    </div>
                  </div>
                  {rec ? <Stars score={rec.bestScore} /> : isNext ? <span className="chip active">{t('recommended')}</span> : null}
                </Link>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
