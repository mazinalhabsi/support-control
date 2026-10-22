# طلاقة · Talaqa

**English from zero to mastery (A1 → C2), designed for Arabic speakers.**
منصة متكاملة لتعلّم الإنجليزية من الصفر حتى الاحتراف، مصمَّمة خصيصًا للمتحدثين بالعربية.

Talaqa is a complete, offline-capable web app: a CEFR-aligned curriculum, a modern spaced-repetition engine, nine interactive exercise types, a pronunciation lab built around the sounds Arabic speakers find hardest, graded readers, and a full Arabic/English bilingual interface (RTL & LTR).

---

## What's inside · ماذا تحتوي المنصة

| | |
|---|---|
| **Curriculum** | 6 CEFR levels · 30 units · **59 lessons** · **704 words & phrases** with UK IPA · **621 hand-written exercises** + ~10 generated drills per lesson |
| **Lesson flow** | Learn (objectives → dialogue → vocabulary → grammar) → Practise (adaptive session) → Speak & write → Results |
| **Exercise types** | multiple choice · gap fill · word-order tiles · translation · dictation · matching · speaking (speech recognition) · error hunt · true/false |
| **Spaced repetition** | FSRS‑4.5 (the open-source scheduler that outperforms Anki's SM‑2), bidirectional cards, 7-day forecast |
| **Smart practice** | interleaved sessions from completed lessons, past mistakes first, weighted to your weakest skill |
| **Placement test** | staged adaptive test, A1 → C2, stops at the learner's ceiling (5–30 questions) |
| **Pronunciation lab** | 12 topics (p/b, f/v, ɪ/iː, e/ɪ, æ/ʌ, tʃ/ʃ, θ/ð, ŋ, clusters, word stress, weak forms, silent letters) with minimal pairs, ear-training game and speaking practice |
| **Library** | 8 original graded readers (A1–C2) with read-aloud, tap-to-translate glossary and comprehension questions |
| **Reference** | searchable grammar reference and vocabulary bank with review status |
| **Motivation** | XP, daily goal, streaks, 14 achievements, weekly activity, per-skill accuracy |
| **Platform** | bilingual UI (Arabic RTL / English LTR), light/dark themes, mobile-first, installable PWA with offline support, backup export/import |
| **Landing page** | public front door at `#/start`: WebGL aurora hero, a live mini-exercise, a pinned A1→C2 scroll journey, scroll-revealed Arabic-speaker mistakes, method timeline, feature bento |
| **Motion** | GSAP for every animation (page & exercise transitions, flashcard flip, count-ups, confetti, sparks), Lenis smooth scrolling synced to ScrollTrigger, haptics on phones — all switchable via *Profile → Motion* and the OS reduced-motion setting |

### Motion design · الحركة

Animation here serves feedback, not decoration:

- **One engine**: GSAP everywhere (`src/motion/`), with Lenis driven by GSAP's ticker so smooth scroll and ScrollTrigger never disagree.
- **Feedback you can feel**: correct answers burst sparks from the button you pressed and tick a light haptic; wrong answers shake; XP floats up into the counter; lessons end with confetti and counted-up results.
- **Arabic-safe text effects**: Arabic is cursive, so animated headlines split Arabic by *word* (never by letter, which would break letter joining) and fade with blur instead of masks that would clip diacritics.
- **Respectful**: *Profile → Motion* offers System / Reduced / Full. Reduced turns off smooth scroll, every GSAP effect and every CSS animation; pages still render complete.
- **Fast first load**: every page is a lazy route; the landing page and the app shell load without the lesson engine.

Effects in `src/components/fx/` are adapted from [React Bits](https://github.com/DavidHDev/react-bits) — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### The pedagogy · المنهجية

- **CEFR can-do objectives** for every lesson; grammar sequenced the way major syllabuses (English Profile, Cambridge) introduce it.
- **Contrastive notes for Arabic speakers** ("ملاحظة للمتحدث العربي") on every grammar point: missing copula (*I student*), articles, adjective order, 3rd-person *-s*, *since/for*, *suggest me to*, p/b and f/v, epenthesis in *spring*/*street*, and more.
- **Recognition → recall → production**: each practice session is ordered from matching and choice, through gap fills and sentence building, to free translation and dictation.
- **Mastery learning**: wrong answers come back at the end of the session, so learners always finish by producing the right form.
- **Fair marking**: case, punctuation and contractions are ignored (*I'm = I am*), long-word typos are accepted with a warning — but grammatical endings (*work/works*, *watchs/watches*) are never forgiven as "typos".
- **Retrieval + spacing**: lesson vocabulary flows into the FSRS deck automatically; reviews alternate English→Arabic and Arabic→English.

## Getting started · التشغيل

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 340 unit & content-integrity tests
npm run build      # type-check + production build in dist/
npm run preview    # serve the production build
```

The build uses relative paths and hash routing, so `dist/` can be dropped on any static host. To publish on **GitHub Pages**: Settings → Pages → Source: *GitHub Actions*, then run the **Deploy to GitHub Pages** workflow.

Speech features use the browser's Web Speech API: text-to-speech works everywhere; speech recognition works in Chrome, Edge and Safari (other browsers fall back to self-assessed "say it out loud").

## Project structure

```
src/
  content/            # the curriculum — plain, typed TypeScript data
    levels/a1.ts … c2.ts
    placement.ts  pronunciation.ts  readings.ts
    helpers.ts        # compact authoring helpers: v(), mcq(), gap(), fix()…
    index.ts          # registry: lessons, vocab ids, grammar index, next lesson
  lib/
    srs/fsrs.ts       # FSRS-4.5 scheduler
    answer.ts         # answer normalisation, typo vs grammar detection, speech scoring
    practice.ts       # session builder: generated drills, tiering, interleaving
    placement.ts      # staged placement logic
    speech.ts         # TTS + speech recognition wrappers
  store/progress.ts   # zustand store persisted to localStorage (crash-safe)
  components/         # UI kit, lesson parts, exercise engine (Exercises.tsx, Session.tsx)
    fx/               # Aurora, SplitText, ScrollReveal, CountUp, RotatingText, Spotlight/Magnet, sparks & confetti
  motion/             # GSAP registration, Lenis smooth scroll, reduced-motion switch, motion hooks
  pages/              # Landing, Dashboard, Course, Lesson, Review, Practice, Pronunciation, Library…
  i18n/               # Arabic/English strings, bidi-safe mixed-script rendering
tests/                # FSRS, answer checking, logic, and validation of every exercise
```

### Adding content

Lessons are data. A new lesson is an object in `src/content/levels/<level>.ts`:

```ts
vocab: [v('hello', 'مرحبًا', 'interj', '/həˈləʊ/', 'Hello! I\'m Sara.', 'مرحبًا! أنا سارة.')],
exercises: [
  mcq('She ___ a teacher.', ['is', 'are', 'am'], 0),
  gap('They ___ from Egypt.', ['are']),
  fix('He are my brother.', 'are', 'He is my brother.'),
  tr('أنا طالب.', ['I am a student.', "I'm a student."]),
],
```

`npm test` validates every exercise (answer indexes, one gap per sentence, the "wrong" word appearing exactly once, Arabic prompts, unique ids…), so content mistakes are caught before they reach learners.

## Honest limitations & roadmap

What this version deliberately does **not** do yet — and what would come next:

1. **AI tutor** — conversation practice and automatic writing feedback (needs a small backend to keep API keys off the client). Writing is currently self-checked against a model answer and checklist.
2. **Accounts & cloud sync** — progress lives in the browser; use *Export backup* to move devices.
3. **Recorded native audio** — audio is browser text-to-speech; quality depends on the device's voices.
4. **Phoneme-level pronunciation scoring** — speech recognition checks intelligibility (were your words understood?), not individual sounds.
5. **More content** — B2–C2 have fewer lessons than A1–B1; exam tracks (IELTS/TOEFL) and listening passages are natural next additions.
6. **Teacher dashboard & classes**, and other L1s (the content model already separates translations).

## Credits

- Curriculum, texts and exercises: original content written for this project.
- Spaced repetition: [FSRS](https://github.com/open-spaced-repetition/fsrs4anki) algorithm (v4.5 default parameters).
- Animation: [GSAP](https://gsap.com) and [Lenis](https://lenis.dev); effects adapted from [React Bits](https://reactbits.dev) (MIT + Commons Clause © David Haz). Details in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Icons: [Lucide](https://lucide.dev). Fonts: IBM Plex Sans Arabic, Inter, Readex Pro.
