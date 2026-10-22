import type { Bi } from '../content/types';
import type { ProgressData } from '../store/progress';
import { isMastered } from './srs/fsrs';

export interface Achievement {
  id: string;
  icon: string;
  title: Bi;
  description: Bi;
  test: (s: ProgressData) => boolean;
}

const lessonsDone = (s: ProgressData) => Object.keys(s.lessons).length;
const mastered = (s: ProgressData) => Object.values(s.srs).filter(isMastered).length;
const reviews = (s: ProgressData) => Object.values(s.reviewsByDay).reduce((a, b) => a + b, 0);

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-lesson',
    icon: '🌱',
    title: { en: 'First Step', ar: 'الخطوة الأولى' },
    description: { en: 'Complete your first lesson', ar: 'أكمل أول درس' },
    test: (s) => lessonsDone(s) >= 1,
  },
  {
    id: 'ten-lessons',
    icon: '📚',
    title: { en: 'Committed', ar: 'ملتزم' },
    description: { en: 'Complete 10 lessons', ar: 'أكمل ١٠ دروس' },
    test: (s) => lessonsDone(s) >= 10,
  },
  {
    id: 'thirty-lessons',
    icon: '🏛️',
    title: { en: 'Scholar', ar: 'باحث علم' },
    description: { en: 'Complete 30 lessons', ar: 'أكمل ٣٠ درسًا' },
    test: (s) => lessonsDone(s) >= 30,
  },
  {
    id: 'placement',
    icon: '🧭',
    title: { en: 'Know Thyself', ar: 'اعرف مستواك' },
    description: { en: 'Take the placement test', ar: 'أجرِ اختبار تحديد المستوى' },
    test: (s) => !!s.placement,
  },
  {
    id: 'streak-3',
    icon: '🔥',
    title: { en: 'On Fire', ar: 'متّقد' },
    description: { en: 'Reach a 3-day streak', ar: 'تعلّم ٣ أيام متتالية' },
    test: (s) => s.streak.longest >= 3,
  },
  {
    id: 'streak-7',
    icon: '📅',
    title: { en: 'One Week Strong', ar: 'أسبوع كامل' },
    description: { en: 'Reach a 7-day streak', ar: 'تعلّم ٧ أيام متتالية' },
    test: (s) => s.streak.longest >= 7,
  },
  {
    id: 'streak-30',
    icon: '🏆',
    title: { en: 'Habit Formed', ar: 'صارت عادة' },
    description: { en: 'Reach a 30-day streak', ar: 'تعلّم ٣٠ يومًا متتالية' },
    test: (s) => s.streak.longest >= 30,
  },
  {
    id: 'xp-500',
    icon: '⚡',
    title: { en: 'Energised', ar: 'طاقة عالية' },
    description: { en: 'Earn 500 XP', ar: 'اجمع ٥٠٠ نقطة خبرة' },
    test: (s) => s.totalXp >= 500,
  },
  {
    id: 'xp-5000',
    icon: '💎',
    title: { en: 'Diamond Learner', ar: 'متعلّم ماسي' },
    description: { en: 'Earn 5,000 XP', ar: 'اجمع ٥٠٠٠ نقطة خبرة' },
    test: (s) => s.totalXp >= 5000,
  },
  {
    id: 'words-50',
    icon: '🧠',
    title: { en: 'Word Collector', ar: 'جامع الكلمات' },
    description: { en: 'Have 50 words in your review deck', ar: 'أضف ٥٠ كلمة إلى بطاقات المراجعة' },
    test: (s) => Object.keys(s.srs).length >= 50,
  },
  {
    id: 'mastered-25',
    icon: '🎯',
    title: { en: 'Long-Term Memory', ar: 'ذاكرة طويلة المدى' },
    description: { en: 'Master 25 words (memory ≥ 3 weeks)', ar: 'أتقن ٢٥ كلمة (تذكّر ≥ ٣ أسابيع)' },
    test: (s) => mastered(s) >= 25,
  },
  {
    id: 'reviews-100',
    icon: '🔁',
    title: { en: 'Spaced Out', ar: 'المراجِع المنتظم' },
    description: { en: 'Complete 100 flashcard reviews', ar: 'أنجز ١٠٠ مراجعة للبطاقات' },
    test: (s) => reviews(s) >= 100,
  },
  {
    id: 'reader',
    icon: '📖',
    title: { en: 'Bookworm', ar: 'دودة الكتب' },
    description: { en: 'Finish 3 graded readings', ar: 'أنهِ ٣ نصوص قراءة' },
    test: (s) => Object.keys(s.readings).length >= 3,
  },
  {
    id: 'pronunciation',
    icon: '🗣️',
    title: { en: 'Clear Speaker', ar: 'نطق واضح' },
    description: { en: 'Practise 5 pronunciation topics', ar: 'تدرّب على ٥ مواضيع نطق' },
    test: (s) => Object.keys(s.pronunciation).length >= 5,
  },
];

export function evaluateAchievements(s: ProgressData): string[] {
  return ACHIEVEMENTS.filter((a) => a.test(s)).map((a) => a.id);
}

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);
