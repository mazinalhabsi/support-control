import { useEffect, useState } from 'react';

/** Effective dark mode: explicit data-theme wins, otherwise the OS preference. */
export function useIsDark(): boolean {
  const read = () => {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr) return attr === 'dark';
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  };
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const update = () => setDark(read());
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener?.('change', update);
    } catch {
      /* ignore */
    }
    return () => {
      obs.disconnect();
      mq?.removeEventListener?.('change', update);
    };
  }, []);
  return dark;
}
