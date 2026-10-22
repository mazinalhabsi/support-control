import { useMemo, useState } from 'react';
import { VOCAB } from '../content';
import { CEFR_LEVELS, type CEFR } from '../content/types';
import { isMastered, type SrsCard } from '../lib/srs/fsrs';
import { useT } from '../i18n';
import { useProgress } from '../store/progress';
import { AudioButton, En, LevelTag, Segmented } from '../components/ui';
import type { StringKey } from '../i18n/strings';
import { Icon3D } from '../components/Icon3D';

type Status = 'all' | 'notInDeck' | 'learning' | 'mastered';
const PAGE = 60;

function statusOf(card: SrsCard | undefined): Exclude<Status, 'all'> {
  if (!card) return 'notInDeck';
  return isMastered(card) ? 'mastered' : 'learning';
}

const STATUS_LABEL: Record<Exclude<Status, 'all'>, StringKey> = {
  notInDeck: 'notInDeck',
  learning: 'stateLearning',
  mastered: 'stateMastered',
};
const STATUS_COLOR: Record<Exclude<Status, 'all'>, string> = {
  notInDeck: 'var(--text-3)',
  learning: 'var(--accent)',
  mastered: 'var(--success)',
};

export function Vocabulary() {
  const { t, num } = useT();
  const srs = useProgress((s) => s.srs);
  const addCards = useProgress((s) => s.addCards);
  const showIPA = useProgress((s) => s.settings.showIPA);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<CEFR | 'all'>('all');
  const [status, setStatus] = useState<Status>('all');
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return VOCAB.filter((v) => {
      if (level !== 'all' && v.level !== level) return false;
      if (status !== 'all' && statusOf(srs[v.item.id]) !== status) return false;
      if (q && !v.item.word.toLowerCase().includes(q) && !v.item.ar.includes(q)) return false;
      return true;
    });
  }, [query, level, status, srs]);

  return (
    <div className="page">
      <div className="page-head with-object">
        <h1>{t('vocabTitle')}</h1>
        <p>{t('vocabSub', { count: num(VOCAB.length) })}</p>
        <Icon3D name="vocabulary" size={108} eager />
      </div>
      <div className="stack" style={{ marginBottom: 18 }}>
        <input className="input" placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="row row-wrap">
          <Segmented
            value={level}
            onChange={setLevel}
            options={[{ value: 'all' as const, label: t('all') }, ...CEFR_LEVELS.map((l) => ({ value: l, label: <span className="en">{l}</span> }))]}
          />
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all' as const, label: t('all') },
              { value: 'notInDeck' as const, label: t('notInDeck') },
              { value: 'learning' as const, label: t('stateLearning') },
              { value: 'mastered' as const, label: t('stateMastered') },
            ]}
          />
        </div>
        <div className="faint small">
          {num(rows.length)} {t('words')}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 && (
          <p className="muted center" style={{ padding: 20 }}>
            {t('noResults')}
          </p>
        )}
        {rows.slice(0, limit).map(({ item, level: lvl }) => {
          const st = statusOf(srs[item.id]);
          return (
            <div key={item.id} className="row" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <AudioButton text={item.word} size="sm" />
              <div className="grow">
                <div className="row row-wrap" style={{ gap: 8 }}>
                  <En className="bold">{item.word}</En>
                  {showIPA && item.ipa && <span className="ipa">{item.ipa}</span>}
                </div>
                <div className="small muted" dir="rtl" style={{ textAlign: 'start' }}>
                  {item.ar}
                </div>
              </div>
              <LevelTag level={lvl} />
              {st === 'notInDeck' ? (
                <button className="btn btn-soft btn-sm" onClick={() => addCards([item.id])}>
                  + {t('addToDeck')}
                </button>
              ) : (
                <span className="chip" style={{ color: STATUS_COLOR[st] }}>
                  {t(STATUS_LABEL[st])}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {rows.length > limit && (
        <div className="center" style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>
            {t('more')} ({num(rows.length - limit)})
          </button>
        </div>
      )}
    </div>
  );
}
