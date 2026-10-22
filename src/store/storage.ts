import type { StateStorage } from 'zustand/middleware';

/**
 * localStorage that never throws: private windows, blocked site data and
 * sandboxed iframes can make every access throw. Progress then lives in
 * memory for the session instead of crashing the app.
 */
const memory = new Map<string, string>();

function ls(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__talaqa_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export const safeStorage: StateStorage = {
  getItem(name) {
    try {
      return ls()?.getItem(name) ?? memory.get(name) ?? null;
    } catch {
      return memory.get(name) ?? null;
    }
  },
  setItem(name, value) {
    memory.set(name, value);
    try {
      ls()?.setItem(name, value);
    } catch {
      /* quota exceeded or blocked – keep the in-memory copy */
    }
  },
  removeItem(name) {
    memory.delete(name);
    try {
      ls()?.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};
