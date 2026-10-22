import { useState } from 'react';
import { AlertTriangle, Lightbulb, Play, Square } from 'lucide-react';
import type { DialogueLine, GrammarPoint, VocabItem } from '../content/types';
import { useSpeak } from '../hooks/useSpeech';
import { useT } from '../i18n';
import { useProgress } from '../store/progress';
import { cx } from '../lib/util';
import { AudioButton, En } from './ui';

const AVATAR_COLORS = ['#5048e5', '#db2777', '#0d9488', '#d97706', '#2563eb', '#9333ea'];

export function Dialogue({ lines }: { lines: DialogueLine[] }) {
  const { t } = useT();
  const showTr = useProgress((s) => s.settings.showTranslations);
  const [showTranslations, setShowTranslations] = useState(showTr);
  const { speak, stop, playing } = useSpeak();
  const [current, setCurrent] = useState<number | null>(null);
  const speakers = [...new Set(lines.map((l) => l.speaker))];

  const playFrom = (i: number) => {
    if (i >= lines.length) {
      setCurrent(null);
      return;
    }
    setCurrent(i);
    speak(lines[i].en, { id: `dlg-${i}`, onEnd: () => setTimeout(() => playFrom(i + 1), 350) });
  };
  const isPlayingAll = current !== null && playing?.startsWith('dlg-');

  return (
    <div>
      <div className="row row-wrap" style={{ marginBottom: 14 }}>
        <button
          className="btn btn-soft btn-sm"
          onClick={() => {
            if (isPlayingAll) {
              stop();
              setCurrent(null);
            } else playFrom(0);
          }}
        >
          {isPlayingAll ? <Square size={16} /> : <Play size={16} />} {isPlayingAll ? t('stop') : t('playAll')}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowTranslations((v) => !v)}>
          {showTranslations ? t('hideTranslation') : t('showTranslation')}
        </button>
      </div>
      <div className="dialogue">
        {lines.map((l, i) => {
          const idx = speakers.indexOf(l.speaker);
          return (
            <div key={i} className={cx('bubble-row', idx % 2 === 1 && 'right')}>
              <div className="avatar" style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
                {l.speaker[0]}
              </div>
              <div className={cx('bubble', current === i && 'speaking')}>
                <div className="who en">{l.speaker}</div>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <En className="grow" as="div">
                    {l.en}
                  </En>
                  <AudioButton text={l.en} size="sm" />
                </div>
                {showTranslations && (
                  <div className="tr" dir="rtl">
                    {l.ar}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function VocabCard({ item }: { item: VocabItem }) {
  const showIPA = useProgress((s) => s.settings.showIPA);
  return (
    <div className="vocab-card">
      <div className="row spread" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <En className="word" as="div">
            {item.word}
          </En>
          <div className="row row-wrap" style={{ gap: 8 }}>
            <span className="pos">{item.pos}</span>
            {showIPA && item.ipa && <span className="ipa">{item.ipa}</span>}
          </div>
        </div>
        <AudioButton text={item.word} slow size="sm" />
      </div>
      <div className="bold" dir="rtl">
        {item.ar}
      </div>
      <div className="vocab-example">
        <div className="row" style={{ alignItems: 'flex-start', gap: 6 }}>
          <En className="grow" as="div">
            {item.example}
          </En>
          <AudioButton text={item.example} size="sm" />
        </div>
        {item.exampleAr && (
          <div className="faint small" dir="rtl">
            {item.exampleAr}
          </div>
        )}
      </div>
    </div>
  );
}

export function GrammarCard({ grammar }: { grammar: GrammarPoint }) {
  const { t, rich, other, lang } = useT();
  const [showOther, setShowOther] = useState(false);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div>
        <h3 style={{ marginBottom: 4 }}>{rich(grammar.title)}</h3>
        {lang === 'ar' && (
          <div className="faint small">
            <En>{grammar.title.en}</En>
          </div>
        )}
      </div>
      <p style={{ margin: 0 }}>{rich(grammar.explanation)}</p>
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowOther((v) => !v)}>
          {showOther ? t('hideOtherLang') : t('showOtherLang')}
        </button>
        {showOther && (
          <p className={cx('muted', lang === 'ar' ? 'en' : 'ar')} dir={lang === 'ar' ? 'ltr' : 'rtl'} style={{ marginTop: 8 }}>
            {other(grammar.explanation)}
          </p>
        )}
      </div>

      {grammar.table && (
        <div className="table-wrap">
          <table className="grammar-table">
            <thead>
              <tr>
                {grammar.table.headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grammar.table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {grammar.rules && grammar.rules.length > 0 && (
        <ul className="rule-list">
          {grammar.rules.map((r, i) => (
            <li key={i}>{rich(r)}</li>
          ))}
        </ul>
      )}

      <div>
        <div className="bold" style={{ marginBottom: 8 }}>
          {t('examples')}
        </div>
        <div className="example-list">
          {grammar.examples.map((e, i) => (
            <div key={i} className="example">
              <AudioButton text={e.en} size="sm" />
              <div className="grow">
                <En as="div">{e.en}</En>
                {e.ar && (
                  <div className="faint small" dir="rtl">
                    {e.ar}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {grammar.arabicNote && (
        <div className="note">
          <div className="note-title">
            <Lightbulb size={18} /> {t('arabicNote')}
          </div>
          <div dir="rtl" style={{ textAlign: 'start' }}>
            {rich(grammar.arabicNote)}
          </div>
        </div>
      )}

      {grammar.mistakes && grammar.mistakes.length > 0 && (
        <div>
          <div className="row bold" style={{ marginBottom: 6 }}>
            <AlertTriangle size={18} color="var(--danger)" /> {t('commonMistakes')}
          </div>
          {grammar.mistakes.map((m, i) => (
            <div key={i} className="mistake">
              <div className="row row-wrap" style={{ gap: 8 }}>
                <En className="wrong-text">❌ {m.wrong}</En>
                <En className="right-text">✅ {m.right}</En>
              </div>
              <div className="faint small">{rich(m.why)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
