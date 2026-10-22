import type { CSSProperties } from 'react';
import { cx } from '../lib/util';

// Rendered offline from the models in scripts/render-3d (see its README).
const FILES = import.meta.glob('../assets/3d/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const URLS: Record<string, string> = Object.fromEntries(
  Object.entries(FILES).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.webp'.length), url]),
);

export type IconName =
  | `level-${'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'}`
  | 'today'
  | 'learn'
  | 'review'
  | 'practice'
  | 'pronunciation'
  | 'library'
  | 'grammar'
  | 'vocabulary'
  | 'profile'
  | 'placement'
  | 'studio'
  | 'roleplay'
  | 'shadowing'
  | 'listening'
  | 'sprint'
  | 'spelling'
  | 'streak'
  | 'xp'
  | 'goal'
  | 'accuracy'
  | 'trophy'
  | 'lock'
  | 'goal-general'
  | 'goal-travel'
  | 'goal-work'
  | 'goal-study'
  | 'goal-exam';

export function iconUrl(name: IconName): string {
  return URLS[name];
}

/** One of Talaqa's rendered 3D objects. Decorative unless `alt` is given. */
export function Icon3D({
  name,
  size = 48,
  className,
  alt = '',
  eager,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  alt?: string;
  eager?: boolean;
  style?: CSSProperties;
}) {
  return (
    <img
      className={cx('ico3d', className)}
      src={URLS[name]}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      style={style}
    />
  );
}
