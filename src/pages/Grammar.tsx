import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { GRAMMAR } from '../content';
import { CEFR_LEVELS, type CEFR } from '../content/types';
import { useT } from '../i18n';
import { GrammarCard } from '../components/LessonParts';
import { LevelTag, Segmented } from '../components/ui';
import { Icon3D } from '../components/Icon3D';

export function GrammarReference() {
  const { t, rich } = useT();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<CEFR | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GRAMMAR.filter((g) => {
      if (level !== 'all' && g.level !== level) return false;
      if (!q) return true;
      const hay = [g.grammar.title.en, g.grammar.title.ar, g.grammar.explanation.en, g.grammar.explanation.ar, ...g.grammar.examples.map((e) => e.en)]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query, level]);

  return (
    <div className="page page-narrow">
      <div className="page-head with-object">
        <h1>{t('grammarTitle')}</h1>
        <p>{t('grammarSub')}</p>
        <Icon3D name="grammar" size={108} eager />
      </div>
      <div className="stack" style={{ marginBottom: 18 }}>
        <input className="input" placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <Segmented
          value={level}
          onChange={setLevel}
          options={[{ value: 'all' as const, label: t('all') }, ...CEFR_LEVELS.map((l) => ({ value: l, label: <span className="en">{l}</span> }))]}
        />
      </div>
      {results.length === 0 && <p className="muted center">{t('noResults')}</p>}
      <div className="stack" style={{ gap: 10 }}>
        {results.map((g) => {
          const isOpen = open === g.lessonId;
          return (
            <div key={g.lessonId} className="card" style={{ padding: 0, marginTop: 0 }}>
              <button
                className="row"
                style={{ width: '100%', padding: 16, background: 'none', border: 0, cursor: 'pointer', textAlign: 'start' }}
                onClick={() => setOpen(isOpen ? null : g.lessonId)}
                aria-expanded={isOpen}
              >
                <LevelTag level={g.level} />
                <span className="grow">
                  <span className="bold" style={{ display: 'block' }}>
                    {rich(g.grammar.title)}
                  </span>
                  <span className="small faint">{rich(g.lessonTitle)}</span>
                </span>
                <ChevronDown size={20} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              {isOpen && (
                <div style={{ padding: '0 16px 16px' }}>
                  <GrammarCard grammar={g.grammar} />
                  <Link to={`/lesson/${g.lessonId}`} className="btn btn-soft btn-sm" style={{ marginTop: 14 }}>
                    {t('openLesson')}
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
