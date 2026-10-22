import { useEffect, useState, type ReactNode } from 'react';
import { Volume2, Turtle } from 'lucide-react';
import type { CEFR } from '../content/types';
import { useSpeak } from '../hooks/useSpeech';
import { useT } from '../i18n';
import { cx } from '../lib/util';

/** English text, isolated so it renders correctly inside an RTL page. */
export function En({ children, className, as: Tag = 'span' }: { children: ReactNode; className?: string; as?: 'span' | 'div' | 'p' }) {
  return (
    <Tag className={cx('en', className)} dir="ltr" lang="en">
      {children}
    </Tag>
  );
}

export function LevelTag({ level, className }: { level: CEFR; className?: string }) {
  return (
    <span className={cx('level-tag', className)} style={{ background: `var(--lvl-${level})` }}>
      {level}
    </span>
  );
}

export function ProgressBar({ value, variant, thin }: { value: number; variant?: 'success' | 'accent'; thin?: boolean }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={cx('progress', variant, thin && 'thin')} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({
  value,
  size = 64,
  stroke = 7,
  color = 'var(--primary)',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(.2,.7,.2,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }} className="ring-label">
        {children}
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={cx(value === o.value && 'active')} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Play English text with TTS; optional slow-motion button. */
export function AudioButton({ text, slow = false, size = 'md', id }: { text: string; slow?: boolean; size?: 'sm' | 'md'; id?: string }) {
  const { speak, playing } = useSpeak();
  const { t } = useT();
  const key = id ?? text;
  return (
    <span className="row" style={{ gap: 6, display: 'inline-flex' }}>
      <button
        type="button"
        className={cx('icon-btn', size === 'sm' && 'sm', playing === key && 'playing')}
        onClick={(e) => {
          e.stopPropagation();
          speak(text, { id: key });
        }}
        aria-label={t('listen')}
        title={t('listen')}
      >
        <Volume2 size={size === 'sm' ? 16 : 20} />
      </button>
      {slow && (
        <button
          type="button"
          className={cx('icon-btn', size === 'sm' && 'sm', playing === `${key}#slow` && 'playing')}
          onClick={(e) => {
            e.stopPropagation();
            speak(text, { id: `${key}#slow`, slow: true });
          }}
          aria-label={t('slow')}
          title={t('slow')}
        >
          <Turtle size={size === 'sm' ? 16 : 20} />
        </button>
      )}
    </span>
  );
}

/**
 * Two-step button for destructive actions: the first tap arms it, the second
 * confirms. Works everywhere (window.confirm is blocked in embedded frames).
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel,
  className,
  ariaLabel,
}: {
  onConfirm: () => void;
  children: ReactNode;
  confirmLabel: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <button
      type="button"
      className={cx(className, armed && 'armed')}
      aria-label={ariaLabel}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

export function Stars({ score }: { score: number }) {
  const n = score >= 0.95 ? 3 : score >= 0.8 ? 2 : score > 0 ? 1 : 0;
  return (
    <span className="stars" aria-label={`${n}/3`}>
      {'★'.repeat(n)}
      <span style={{ opacity: 0.25 }}>{'★'.repeat(3 - n)}</span>
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="card center" style={{ padding: '40px 20px' }}>
      <div style={{ fontSize: '2.6rem', marginBottom: 8 }}>{icon}</div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
