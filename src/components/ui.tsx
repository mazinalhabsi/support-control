import { useEffect, useId, useState, type ReactNode } from 'react';
import { m } from 'motion/react';
import { Volume2, Turtle } from 'lucide-react';
import type { CEFR } from '../content/types';
import { useSpeak } from '../hooks/useSpeech';
import { useT } from '../i18n';
import { cx } from '../lib/util';
import { Icon3D, type IconName } from './Icon3D';

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
    <span className={cx('level-tag', className)} style={{ color: `var(--lvl-${level})` }}>
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
  color = 'var(--accent)',
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const v = mounted ? Math.max(0, Math.min(1, value)) : 0;
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
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)' }}
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

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={cx(value === o.value && 'active')}
          onClick={() => onChange(o.value)}
        >
          {value === o.value && <m.span layoutId={`seg-${id}`} className="seg-pill" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A watch-maker's dial: minute ticks around the rim and a brass arc for
 * progress. Used for the daily goal.
 */
export function Dial({
  value,
  size = 120,
  stroke = 6,
  ticks = 60,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  ticks?: number;
  children?: ReactNode;
}) {
  const gid = useId().replace(/:/g, '');
  const r = size / 2 - stroke / 2 - (ticks ? size * 0.09 : 0);
  const c = 2 * Math.PI * r;
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const v = mounted ? Math.max(0, Math.min(1, value)) : 0;
  const tickEls = [];
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2;
    const major = i % 5 === 0;
    const r1 = size / 2 - 1;
    const r2 = r1 - (major ? size * 0.065 : size * 0.035);
    const lit = i / ticks < v;
    tickEls.push(
      <line
        key={i}
        x1={size / 2 + Math.sin(a) * r1}
        y1={size / 2 - Math.cos(a) * r1}
        x2={size / 2 + Math.sin(a) * r2}
        y2={size / 2 - Math.cos(a) * r2}
        stroke={lit ? 'var(--accent)' : 'var(--border-strong)'}
        strokeWidth={major ? 1.6 : 1}
        style={{ transition: `stroke .3s ${i * 12}ms` }}
      />,
    );
  }
  return (
    <div className="dial" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--accent-2)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        {tickEls}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1)' }}
        />
      </svg>
      {children && <div className="dial-face">{children}</div>}
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

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="card center empty-state">
      <Icon3D name={icon} size={120} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function RouteLoading() {
  return (
    <div className="route-loading" role="progressbar" aria-label="Loading">
      <span />
    </div>
  );
}
