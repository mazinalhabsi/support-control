import { useCallback, type ReactNode } from 'react';
import type { Bi } from '../content/types';
import { useProgress, type UiLang } from '../store/progress';
import { STRINGS, type StringKey } from './strings';

export function translate(lang: UiLang, key: StringKey, vars?: Record<string, string | number>): string {
  const [ar, en] = STRINGS[key];
  let s: string = lang === 'ar' ? ar : en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Arabic-Indic digits for Arabic UI numbers. */
export function formatNumber(n: number, lang: UiLang): string {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-GB').format(n);
}

/**
 * Latin runs inside Arabic text ("استخدم I am مع…"). Each run is isolated as
 * LTR so punctuation and word order inside it don't get scrambled by the
 * bidi algorithm.
 */
const LATIN_RUN = /[("“'‘]?[A-Za-z][A-Za-z0-9'’\-/.,!?()…:;"”‘ ]*[A-Za-z0-9.!?)'’…"”]|[A-Za-z]/g;

export function splitBidi(text: string): { text: string; latin: boolean }[] {
  const out: { text: string; latin: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(LATIN_RUN)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), latin: false });
    out.push({ text: m[0], latin: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), latin: false });
  return out;
}

/** Render mixed Arabic/English text safely. Pure-Latin text passes through. */
export function Bidi({ text }: { text: string }) {
  if (!/[؀-ۿ]/.test(text)) return <>{text}</>;
  return (
    <>
      {splitBidi(text).map((p, i) =>
        p.latin ? (
          <span key={i} className="en" dir="ltr">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export function useLang(): UiLang {
  return useProgress((s) => s.settings.uiLang);
}

export function useT() {
  const lang = useLang();
  const t = useCallback((key: StringKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  /** Pick the UI-language side of a bilingual content field (plain string). */
  const pick = useCallback((b: Bi) => (lang === 'ar' ? b.ar : b.en), [lang]);
  /** Same as pick, rendered with bidi isolation for embedded English. */
  const rich = useCallback((b: Bi | string): ReactNode => <Bidi text={typeof b === 'string' ? b : lang === 'ar' ? b.ar : b.en} />, [lang]);
  /** The other language (for "show explanation in…" toggles). */
  const other = useCallback((b: Bi) => (lang === 'ar' ? b.en : b.ar), [lang]);
  const num = useCallback((n: number) => formatNumber(n, lang), [lang]);
  const pct = useCallback((fraction: number) => (lang === 'ar' ? `${formatNumber(Math.round(fraction * 100), lang)}٪` : `${Math.round(fraction * 100)}%`), [lang]);
  return { t, pick, rich, other, num, pct, lang };
}
