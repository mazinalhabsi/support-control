import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Clock } from 'lucide-react';
import { LEVELS, getLevel, lessonsOfLevel, nextLesson } from '../content';
import { CEFR_LEVELS, type CEFR } from '../content/types';
import { useT } from '../i18n';
import { useProgress } from '../store/progress';
import { LevelTag, ProgressBar, Stars } from '../components/ui';
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
      <div className="page-head">
        <h1>{t('courseTitle')}</h1>
        <p>{t('courseSub')}</p>
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
              <span className="code">{l.id}</span>
              <span className="name">{rich(l.title)}</span>
              <span className="tiny faint en">
                {done}/{all.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <LevelTag level={level.id} />
          <div className="grow">
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
            <div className="unit-head" style={{ background: `linear-gradient(135deg, var(--lvl-${level.id}), color-mix(in srgb, var(--lvl-${level.id}) 65%, #000))` }}>
              <div className="grow">
                <div className="tiny" style={{ opacity: 0.85 }}>
                  {t('unit')} {num(ui + 1)}
                </div>
                <div className="bold" style={{ fontSize: '1.1rem' }}>
                  {rich(unit.title)}
                </div>
              </div>
              <div style={{ width: 90 }}>
                <ProgressBar value={done / unit.lessons.length} thin />
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
