import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { SKILLS, type CEFR, type Skill } from '../content/types';
import { newCard, review, type Rating, type SrsCard } from '../lib/srs/fsrs';
import type { Accent } from '../lib/speech';
import { addDays, dateKey } from '../lib/util';
import { safeStorage } from './storage';
import { evaluateAchievements } from '../lib/achievements';
import type { StageResult } from '../lib/placement';

export type Goal = 'general' | 'travel' | 'work' | 'study' | 'exam';
export type UiLang = 'ar' | 'en';
export type Theme = 'system' | 'light' | 'dark';

export interface Profile {
  name: string;
  goal: Goal;
  dailyGoal: number;
  startLevel: CEFR;
  onboarded: boolean;
  createdAt: number;
}

export interface Settings {
  uiLang: UiLang;
  accent: Accent;
  rate: number;
  theme: Theme;
  voiceURI?: string;
  showIPA: boolean;
  /** Show Arabic translations of English sentences by default. */
  showTranslations: boolean;
  sounds: boolean;
}

export interface LessonRecord {
  completedAt: number;
  bestScore: number;
  attempts: number;
}

export interface SkillStat {
  correct: number;
  total: number;
}

export interface Streak {
  current: number;
  longest: number;
  lastDay: string | null;
}

export interface ProgressData {
  profile: Profile | null;
  settings: Settings;
  lessons: Record<string, LessonRecord>;
  srs: Record<string, SrsCard>;
  xpByDay: Record<string, number>;
  totalXp: number;
  streak: Streak;
  skills: Record<Skill, SkillStat>;
  mistakes: Record<string, { count: number; lastAt: number }>;
  achievements: Record<string, number>;
  placement: { level: CEFR; date: number; results: StageResult[] } | null;
  readings: Record<string, { score: number; completedAt: number }>;
  pronunciation: Record<string, { best: number; attempts: number }>;
  reviewsByDay: Record<string, number>;
  /** Achievements unlocked since the UI last showed them. */
  newAchievements: string[];
}

interface Actions {
  completeOnboarding(p: Omit<Profile, 'onboarded' | 'createdAt'>): void;
  updateProfile(p: Partial<Profile>): void;
  setSettings(s: Partial<Settings>): void;
  addXp(amount: number): void;
  recordAnswer(key: string, skill: Skill, correct: boolean): void;
  completeLesson(lessonId: string, score: number, vocabIds: string[]): void;
  reviewCard(id: string, rating: Rating): void;
  addCards(ids: string[]): void;
  savePlacement(level: CEFR, results: StageResult[]): void;
  completeReading(id: string, score: number): void;
  recordPronunciation(id: string, score: number): void;
  dismissAchievements(): void;
  importData(data: unknown): boolean;
  resetAll(): void;
}

export type ProgressState = ProgressData & Actions;

const emptySkills = (): Record<Skill, SkillStat> =>
  Object.fromEntries(SKILLS.map((s) => [s, { correct: 0, total: 0 }])) as Record<Skill, SkillStat>;

export const initialData = (): ProgressData => ({
  profile: null,
  settings: {
    // The platform is designed for Arabic speakers; English UI is one tap away.
    uiLang: 'ar',
    accent: 'en-GB',
    rate: 0.95,
    theme: 'system',
    showIPA: true,
    showTranslations: true,
    sounds: true,
  },
  lessons: {},
  srs: {},
  xpByDay: {},
  totalXp: 0,
  streak: { current: 0, longest: 0, lastDay: null },
  skills: emptySkills(),
  mistakes: {},
  achievements: {},
  placement: null,
  readings: {},
  pronunciation: {},
  reviewsByDay: {},
  newAchievements: [],
});

/** Streak after activity today. Pure, so it can be unit-tested. */
export function bumpStreak(s: Streak, today: string): Streak {
  if (s.lastDay === today) return s;
  const current = s.lastDay === addDays(today, -1) ? s.current + 1 : 1;
  return { current, longest: Math.max(s.longest, current), lastDay: today };
}

/** The streak as displayed: it is broken if the learner skipped a whole day. */
export function activeStreak(s: Streak, today = dateKey()): number {
  return s.lastDay === today || s.lastDay === addDays(today, -1) ? s.current : 0;
}

export function weakestSkill(skills: Record<Skill, SkillStat>, minAttempts = 5): Skill | null {
  let worst: Skill | null = null;
  let worstAcc = Infinity;
  for (const s of SKILLS) {
    const { correct, total } = skills[s];
    if (total < minAttempts) continue;
    const acc = correct / total;
    if (acc < worstAcc) {
      worstAcc = acc;
      worst = s;
    }
  }
  return worst;
}

function withAchievements(state: ProgressData, patch: Partial<ProgressData>): Partial<ProgressData> {
  const next = { ...state, ...patch };
  const unlocked = evaluateAchievements(next).filter((id) => !next.achievements[id]);
  if (!unlocked.length) return patch;
  const now = Date.now();
  return {
    ...patch,
    achievements: { ...next.achievements, ...Object.fromEntries(unlocked.map((id) => [id, now])) },
    newAchievements: [...next.newAchievements, ...unlocked],
  };
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...initialData(),

      completeOnboarding(p) {
        set({ profile: { ...p, onboarded: true, createdAt: Date.now() } });
      },

      updateProfile(p) {
        const cur = get().profile;
        if (cur) set({ profile: { ...cur, ...p } });
      },

      setSettings(s) {
        set({ settings: { ...get().settings, ...s } });
      },

      addXp(amount) {
        if (amount <= 0) return;
        const st = get();
        const today = dateKey();
        set(
          withAchievements(st, {
            totalXp: st.totalXp + amount,
            xpByDay: { ...st.xpByDay, [today]: (st.xpByDay[today] ?? 0) + amount },
            streak: bumpStreak(st.streak, today),
          }),
        );
      },

      recordAnswer(key, skill, correct) {
        const st = get();
        const stat = st.skills[skill] ?? { correct: 0, total: 0 };
        const mistakes = { ...st.mistakes };
        if (correct) {
          // Answering a past mistake correctly "heals" it one step.
          if (mistakes[key]) {
            const count = mistakes[key].count - 1;
            if (count <= 0) delete mistakes[key];
            else mistakes[key] = { ...mistakes[key], count };
          }
        } else {
          mistakes[key] = { count: (mistakes[key]?.count ?? 0) + 1, lastAt: Date.now() };
        }
        set({
          skills: { ...st.skills, [skill]: { correct: stat.correct + (correct ? 1 : 0), total: stat.total + 1 } },
          mistakes,
        });
      },

      completeLesson(lessonId, score, vocabIds) {
        const st = get();
        const prev = st.lessons[lessonId];
        const srs = { ...st.srs };
        const now = Date.now();
        for (const id of vocabIds) if (!srs[id]) srs[id] = newCard(now);
        set(
          withAchievements(st, {
            lessons: {
              ...st.lessons,
              [lessonId]: {
                completedAt: prev?.completedAt ?? now,
                bestScore: Math.max(prev?.bestScore ?? 0, score),
                attempts: (prev?.attempts ?? 0) + 1,
              },
            },
            srs,
          }),
        );
      },

      addCards(ids) {
        const st = get();
        const srs = { ...st.srs };
        const now = Date.now();
        for (const id of ids) if (!srs[id]) srs[id] = newCard(now);
        set({ srs });
      },

      reviewCard(id, rating) {
        const st = get();
        const card = st.srs[id] ?? newCard();
        const today = dateKey();
        set(
          withAchievements(st, {
            srs: { ...st.srs, [id]: review(card, rating) },
            reviewsByDay: { ...st.reviewsByDay, [today]: (st.reviewsByDay[today] ?? 0) + 1 },
          }),
        );
      },

      savePlacement(level, results) {
        const st = get();
        set(withAchievements(st, { placement: { level, date: Date.now(), results } }));
      },

      completeReading(id, score) {
        const st = get();
        const prev = st.readings[id];
        set(
          withAchievements(st, {
            readings: { ...st.readings, [id]: { score: Math.max(prev?.score ?? 0, score), completedAt: Date.now() } },
          }),
        );
      },

      recordPronunciation(id, score) {
        const st = get();
        const prev = st.pronunciation[id];
        set(
          withAchievements(st, {
            pronunciation: {
              ...st.pronunciation,
              [id]: { best: Math.max(prev?.best ?? 0, score), attempts: (prev?.attempts ?? 0) + 1 },
            },
          }),
        );
      },

      dismissAchievements() {
        set({ newAchievements: [] });
      },

      importData(data) {
        if (!data || typeof data !== 'object') return false;
        const d = data as Partial<ProgressData>;
        if (typeof d.totalXp !== 'number' || typeof d.lessons !== 'object') return false;
        const base = initialData();
        set({
          ...base,
          ...d,
          settings: { ...base.settings, ...(d.settings ?? {}) },
          skills: { ...base.skills, ...(d.skills ?? {}) },
          newAchievements: [],
        });
        return true;
      },

      resetAll() {
        set({ ...initialData(), settings: get().settings });
      },
    }),
    {
      name: 'talaqa-progress-v1',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => {
        // Persist data only, not action functions.
        const { newAchievements: _n, ...rest } = s;
        void _n;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Partial<ProgressState>;
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProgressData>;
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...(p.settings ?? {}) },
          skills: { ...current.skills, ...(p.skills ?? {}) },
        };
      },
    },
  ),
);

/** Snapshot of the persisted data, for export. */
export function exportData(): ProgressData {
  const s = useProgress.getState();
  return Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function')) as unknown as ProgressData;
}
