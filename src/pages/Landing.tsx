import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Check, Languages, Mic, PenLine, Repeat, Volume2, Zap, Compass, Library, WifiOff, ArrowLeft, ArrowRight } from 'lucide-react';
import { COURSE_STATS, LESSONS, LEVELS, lessonsOfLevel } from '../content';
import { PRONUNCIATION } from '../content/pronunciation';
import { READINGS } from '../content/readings';
import { allItemsForLesson } from '../lib/practice';
import { useT } from '../i18n';
import { useProgress } from '../store/progress';
import { useSpeak } from '../hooks/useSpeech';
import { gsap, haptic, ScrollTrigger, useGSAP } from '../motion/core';
import { scrollToElement, useReducedMotion } from '../motion/MotionProvider';
import { useIsDark } from '../motion/useIsDark';
import { Aurora } from '../components/fx/Aurora';
import { SplitText } from '../components/fx/SplitText';
import { RotatingText } from '../components/fx/RotatingText';
import { ScrollReveal } from '../components/fx/ScrollReveal';
import { CountUp } from '../components/fx/CountUp';
import { Magnet, Reveal, SpotlightCard } from '../components/fx/Interactive';
import { sparkAt } from '../components/fx/Celebrate';
import { En, LevelTag } from '../components/ui';
import { cx } from '../lib/util';
import '../styles/landing.css';

type Copy = readonly [string, string];
const C = {
  free: ['مجاني بالكامل', 'Completely free'],
  start: ['ابدأ رحلتك', 'Start learning'],
  toDashboard: ['تابع التعلّم', 'Continue learning'],
  heroTitle: ['من أول كلمة إنجليزية… إلى الطلاقة.', 'From your first English word to fluency.'],
  heroLead: ['منهج كامل من A1 إلى C2 مصمَّم للمتحدث العربي. تعلّم الإنجليزية', 'A complete A1–C2 course designed for Arabic speakers. Learn English'],
  seePath: ['شاهد المسار', 'See the path'],
  proof1: ['دون حساب أو اشتراك', 'No account, no subscription'],
  proof2: ['يعمل دون إنترنت', 'Works offline'],
  proof3: ['واجهة عربية وإنجليزية', 'Arabic & English interface'],
  tryLabel: ['جرّب سؤالًا الآن', 'Try a question now'],
  tryQ: ['اختر الكلمة الصحيحة', 'Choose the correct word'],
  tryOk: ['صحيح! «she» مفرد غائب، لذلك نقول is. هكذا تشرح لك التمارين كل إجابة.', 'Correct! "She" is third person singular, so it takes "is". Every exercise explains itself like this.'],
  tryBad: ['ليست صحيحة. فكّر: she مفرد غائب، فأي صيغة من be تناسبه؟', 'Not quite. "She" is third person singular: which form of "be" goes with it?'],
  statLessons: ['درسًا', 'lessons'],
  statWords: ['كلمة وعبارة', 'words & phrases'],
  statExercises: ['تمرينًا', 'exercises'],
  statSounds: ['موضوعًا للنطق', 'pronunciation topics'],
  statReaders: ['نصوص قراءة', 'graded readers'],
  journeyEyebrow: ['المسار', 'The path'],
  journeyTitle: ['ستة مستويات، وخريطة واضحة من البداية', 'Six levels, one clear map'],
  journeyLead: [
    'يتبع المنهج الإطار الأوروبي المرجعي للغات (CEFR)، المعيار الدولي لقياس إتقان اللغة. كل مستوى يحدد بدقة ما ستستطيع فعله.',
    'The course follows the CEFR, the international standard for language ability. Each level states exactly what you will be able to do.',
  ],
  lessonsWord: ['درسًا', 'lessons'],
  hoursWord: ['ساعة تعلّم للوصول', 'guided hours to reach'],
  youWill: ['ستتمكن من:', "You'll be able to:"],
  arabicEyebrow: ['مصمَّم لك', 'Built for you'],
  statement: [
    'معظم التطبيقات تعلّمك الإنجليزية كأنك لا تتكلم أي لغة. طلاقة تبدأ من لغتك: تعرف أين يتعثر المتحدث العربي، فتنبّهك قبل أن يصبح الخطأ عادة.',
    'Most apps teach English as if you spoke no language at all. Talaqa starts from yours: it knows where Arabic speakers trip up, and warns you before a mistake becomes a habit.',
  ],
  methodEyebrow: ['المنهجية', 'The method'],
  methodTitle: ['كل درس يمر بأربع مراحل', 'Every lesson moves through four stages'],
  featuresEyebrow: ['داخل المنصة', 'Inside'],
  featuresTitle: ['كل ما تحتاجه في مكان واحد', 'Everything in one place'],
  ctaTitle: ['ابدأ اليوم بخمس دقائق فقط.', 'Start today with just five minutes.'],
  ctaLead: ['اختر هدفك اليومي، وحدّد مستواك، وتابع تقدّمك يومًا بعد يوم.', 'Pick a daily goal, find your level, and watch your progress grow day by day.'],
  ctaPlacement: ['حدّد مستواك أولًا', 'Find my level first'],
  credits: [
    'مبنيّ بـ GSAP و Lenis، وبعض المؤثرات مقتبسة من React Bits (MIT + Commons Clause © David Haz)، والمراجعة بخوارزمية FSRS.',
    'Built with GSAP and Lenis; some effects adapted from React Bits (MIT + Commons Clause © David Haz); reviews scheduled with FSRS.',
  ],
} as const satisfies Record<string, Copy>;

const GOALS: [string[], string[]] = [
  ['للسفر', 'للعمل', 'للدراسة', 'لاختبار IELTS', 'لنفسك'],
  ['for travel', 'for work', 'for study', 'for IELTS', 'for yourself'],
];

const MISTAKES = [
  { wrong: 'I student.', right: 'I am a student.', why: ['الجملة الاسمية العربية بلا فعل («أنا طالب»)، والإنجليزية تحتاج am.', 'Arabic nominal sentences have no verb; English needs "am".'] },
  { wrong: 'He suggested me to go.', right: 'He suggested going.', why: ['ترجمة حرفية لـ«اقترح عليّ أن»، وهو من أشهر أخطاء كتابة IELTS.', 'A literal translation of the Arabic, and one of the most common IELTS errors.'] },
  { wrong: 'I live here since 2019.', right: "I've lived here since 2019.", why: ['«أعيش هنا منذ» بالمضارع في العربية، وبالمضارع التام في الإنجليزية.', 'Arabic uses the present here; English needs the present perfect.'] },
];

const STEPS = [
  { icon: <BookOpen />, title: ['تعلّم', 'Learn'], text: ['حوار حقيقي، ومفردات بنطقها، وقاعدة مشروحة بالعربية مع ملاحظة عن أخطاء المتحدث العربي.', 'A real dialogue, vocabulary with audio, and grammar explained in Arabic with a note on typical errors.'] },
  { icon: <Zap />, title: ['تدرّب', 'Practise'], text: ['تمارين تتدرج من التعرّف إلى الإنتاج، والخطأ يعود إليك حتى تتقنه.', 'Exercises move from recognising to producing, and every mistake comes back until you get it right.'] },
  { icon: <Mic />, title: ['تحدّث واكتب', 'Speak & write'], text: ['قل الجمل بصوتك ويستمع إليك المتصفح، ثم اكتب نصًا قصيرًا وقارنه بنموذج.', 'Say sentences aloud while the browser listens, then write a short text and compare it with a model.'] },
  { icon: <Repeat />, title: ['راجع', 'Review'], text: ['تنتقل الكلمات إلى بطاقات تجدولها خوارزمية FSRS قبل أن تنساها بالضبط.', 'Words move into flashcards that FSRS schedules just before you would forget them.'] },
] as const;

export function Landing() {
  const { lang, pick, num } = useT();
  const L = (c: Copy) => (lang === 'ar' ? c[0] : c[1]);
  const setSettings = useProgress((s) => s.setSettings);
  const onboarded = useProgress((s) => !!s.profile?.onboarded);
  const reduced = useReducedMotion();
  const dark = useIsDark();
  const rtl = lang === 'ar';
  const Arrow = rtl ? ArrowLeft : ArrowRight;

  const root = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const journey = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);

  const exerciseTotal = useMemo(() => LESSONS.reduce((n, r) => n + allItemsForLesson(r.lesson).length, 0), []);
  const primaryTo = onboarded ? '/' : '/welcome';

  useGSAP(
    () => {
      // Header gains a surface once the page scrolls.
      ScrollTrigger.create({
        start: 40,
        end: 'max',
        onToggle: (self) => header.current?.classList.toggle('scrolled', self.isActive),
      });
      if (reduced) return;

      const mm = gsap.matchMedia();
      // Desktop: pin the journey and move the level track sideways with the scroll.
      mm.add('(min-width: 900px)', () => {
        const t = track.current!;
        const p = pin.current!;
        const distance = () => Math.max(0, t.scrollWidth - p.clientWidth);
        setPinned(true);
        const st = { trigger: p, start: 'top top+=76', end: () => `+=${distance()}`, scrub: 0.8, pin: true, invalidateOnRefresh: true };
        gsap.to(t, { x: () => (rtl ? 1 : -1) * distance(), ease: 'none', scrollTrigger: st });
        gsap.fromTo('.lp-journey-progress span', { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { ...st, pin: false, scrub: true } });
        return () => setPinned(false);
      });
      mm.add('(max-width: 899px)', () => {
        gsap.from('.lp-level', { y: 40, opacity: 0, stagger: 0.08, duration: 0.7, scrollTrigger: { trigger: track.current, start: 'top 85%', once: true } });
      });

      // Mistake cards: strike the wrong form, then bring in the right one.
      gsap.utils.toArray<HTMLElement>('.lp-mistake').forEach((card) => {
        gsap
          .timeline({ scrollTrigger: { trigger: card, start: 'top 82%', once: true } })
          .from(card, { y: 30, opacity: 0, duration: 0.6 })
          .fromTo(card.querySelector('.lp-strike'), { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: 'power2.inOut' })
          .to(card.querySelector('.lp-wrong'), { opacity: 0.45, duration: 0.3 }, '<0.2')
          .from(card.querySelector('.lp-right'), { y: 14, opacity: 0, duration: 0.5 });
      });

      // Method: the connecting line draws as you scroll through the steps.
      gsap.fromTo(
        '.lp-steps-line span',
        { scaleX: 0 },
        { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.lp-steps', start: 'top 75%', end: 'bottom 60%', scrub: true } },
      );
      gsap.from('.lp-forecast i', { scaleY: 0, stagger: 0.06, duration: 0.7, ease: 'back.out(1.6)', scrollTrigger: { trigger: '.lp-forecast', start: 'top 90%', once: true } });

      return () => mm.revert();
    },
    { scope: root, dependencies: [reduced, rtl] },
  );

  return (
    <div ref={root} className="lp">
      <header ref={header} className="lp-header">
        <div className="lp-wrap lp-header-row">
          <Link to="/start" className="brand" style={{ padding: 0 }}>
            <div className="brand-mark">ط</div>
            <div>
              <div className="brand-name">{lang === 'ar' ? 'طلاقة' : 'Talaqa'}</div>
              <div className="brand-sub en">Talaqa · English</div>
            </div>
          </Link>
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={() => setSettings({ uiLang: rtl ? 'en' : 'ar' })}>
              <Languages size={16} /> {rtl ? 'English' : 'العربية'}
            </button>
            <Link to={primaryTo} className="btn btn-primary btn-sm">
              {onboarded ? L(C.toDashboard) : L(C.start)}
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ Hero */}
      <section className="lp-hero">
        <div className="lp-hero-bg" aria-hidden="true">
          <Aurora colorStops={['#0d9488', '#5048e5', '#db2777']} amplitude={1.1} blend={0.6} height={0.5} lightMode={!dark} layers={2} />
        </div>
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">
              <span className="shiny-text en">A1 → C2</span> · {L(C.free)}
            </span>
            <SplitText as="h1" className="lp-title display" text={L(C.heroTitle)} />
            <p className="lp-lead">
              {L(C.heroLead)} <RotatingText words={GOALS[rtl ? 0 : 1]} />
            </p>
            <div className="lp-ctas">
              <Magnet>
                <Link to={primaryTo} className="btn btn-primary btn-lg">
                  {onboarded ? L(C.toDashboard) : L(C.start)} <Arrow size={18} />
                </Link>
              </Magnet>
              <button className="btn btn-lg" onClick={() => scrollToElement(journey.current, -80)}>
                {L(C.seePath)}
              </button>
            </div>
            <ul className="lp-proof">
              {[C.proof1, C.proof2, C.proof3].map((p) => (
                <li key={p[1]}>
                  <Check size={16} /> {L(p)}
                </li>
              ))}
            </ul>
          </div>
          <TryCard label={L(C.tryLabel)} question={L(C.tryQ)} ok={L(C.tryOk)} bad={L(C.tryBad)} />
        </div>
      </section>

      {/* ------------------------------------------------------------ Numbers */}
      <section className="lp-wrap">
        <Reveal className="lp-stats" stagger={0.08}>
          {[
            [COURSE_STATS.lessons, C.statLessons],
            [COURSE_STATS.words, C.statWords],
            [exerciseTotal, C.statExercises],
            [PRONUNCIATION.length, C.statSounds],
            [READINGS.length, C.statReaders],
          ].map(([v, label]) => (
            <div key={(label as Copy)[1]} className="lp-stat">
              <CountUp to={v as number} className="lp-stat-num display" />
              <span>{L(label as Copy)}</span>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ------------------------------------------------------------ Journey */}
      <section ref={journey} className="lp-section lp-journey">
        <div ref={pin} className={cx('lp-journey-pin', pinned && 'is-pinned')}>
          <div className="lp-wrap lp-section-head">
            <span className="lp-eyebrow">{L(C.journeyEyebrow)}</span>
            <SplitText as="h2" className="lp-h2 display" text={L(C.journeyTitle)} trigger="view" />
            <p className="lp-lead">{L(C.journeyLead)}</p>
          </div>
          <div className="lp-wrap">
            <div className="lp-journey-progress" aria-hidden="true">
              <span />
            </div>
          </div>
          <div className="lp-track-viewport">
            <div ref={track} className="lp-track">
              {LEVELS.map((l) => {
                const count = lessonsOfLevel(l.id).length;
                const sample = l.units[0]?.lessons[0]?.objectives[0];
                return (
                  <article key={l.id} className="lp-level" style={{ '--lvl': `var(--lvl-${l.id})` } as React.CSSProperties}>
                    <div className="row spread">
                      <LevelTag level={l.id} />
                      <span className="faint small">
                        ≈ {num(l.hours)} {L(C.hoursWord)}
                      </span>
                    </div>
                    <h3 className="display">{pick(l.title)}</h3>
                    <p className="muted">{pick(l.description)}</p>
                    {sample && (
                      <div className="lp-cando">
                        <span className="faint tiny">{L(C.youWill)}</span>
                        <div>{pick(sample)}</div>
                      </div>
                    )}
                    <div className="lp-level-foot">
                      <b>{num(count)}</b> {L(C.lessonsWord)}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Built for Arabic speakers */}
      <section className="lp-section lp-wrap lp-arabic">
        <span className="lp-eyebrow">{L(C.arabicEyebrow)}</span>
        <ScrollReveal as="h2" className="lp-statement display" text={L(C.statement)} />
        <div className="lp-mistakes">
          {MISTAKES.map((m) => (
            <div key={m.wrong} className="lp-mistake">
              <div className="lp-wrong en" dir="ltr">
                <span>{m.wrong}</span>
                <i className="lp-strike" />
              </div>
              <div className="lp-right en" dir="ltr">
                <Check size={18} /> {m.right}
              </div>
              <p className="small muted">{rtl ? m.why[0] : m.why[1]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ Method */}
      <section className="lp-section lp-wrap">
        <div className="lp-section-head">
          <span className="lp-eyebrow">{L(C.methodEyebrow)}</span>
          <SplitText as="h2" className="lp-h2 display" text={L(C.methodTitle)} trigger="view" />
        </div>
        <div className="lp-steps">
          <div className="lp-steps-line" aria-hidden="true">
            <span />
          </div>
          <Reveal className="lp-steps-grid" stagger={0.12}>
            {STEPS.map((s, i) => (
              <div key={s.title[1]} className="lp-step">
                <div className="lp-step-icon">{s.icon}</div>
                <div className="faint tiny">{num(i + 1)}</div>
                <h3>{rtl ? s.title[0] : s.title[1]}</h3>
                <p className="small muted">{rtl ? s.text[0] : s.text[1]}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ Features */}
      <section className="lp-section lp-wrap">
        <div className="lp-section-head">
          <span className="lp-eyebrow">{L(C.featuresEyebrow)}</span>
          <SplitText as="h2" className="lp-h2 display" text={L(C.featuresTitle)} trigger="view" />
        </div>
        <Features rtl={rtl} />
      </section>

      {/* ------------------------------------------------------------ CTA */}
      <section className="lp-section lp-wrap">
        <div className="lp-cta">
          <SplitText as="h2" className="lp-h2 display" text={L(C.ctaTitle)} trigger="view" />
          <p className="lp-lead">{L(C.ctaLead)}</p>
          <div className="lp-ctas" style={{ justifyContent: 'center' }}>
            <Magnet>
              <Link to={primaryTo} className="btn btn-primary btn-lg">
                {onboarded ? L(C.toDashboard) : L(C.start)} <Arrow size={18} />
              </Link>
            </Magnet>
            {!onboarded && (
              <Link to="/welcome" className="btn btn-lg">
                <Compass size={18} /> {L(C.ctaPlacement)}
              </Link>
            )}
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap row spread row-wrap">
          <div className="brand" style={{ padding: 0 }}>
            <div className="brand-mark">ط</div>
            <div className="brand-name">{lang === 'ar' ? 'طلاقة' : 'Talaqa'}</div>
          </div>
          <p className="tiny faint" style={{ maxWidth: 560, margin: 0 }}>
            {L(C.credits)}
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------------- Live demo card */

function TryCard({ label, question, ok, bad }: { label: string; question: string; ok: string; bad: string }) {
  const { speak } = useSpeak();
  const reduced = useReducedMotion();
  const card = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const options = ['are', 'is', 'am'];
  const correct = picked === 'is';

  useGSAP(
    () => {
      if (reduced) return;
      gsap.from(card.current, { y: 40, opacity: 0, rotate: 2, duration: 1, delay: 0.3 });
      gsap.utils.toArray<HTMLElement>('.lp-float').forEach((el, i) => {
        gsap.to(el, { y: i % 2 ? 10 : -10, duration: 2.4 + i * 0.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      });
    },
    { scope: card, dependencies: [reduced] },
  );

  const choose = (o: string, target: HTMLElement) => {
    if (picked === 'is') return;
    setPicked(o);
    if (o === 'is') {
      sparkAt(target, { count: 14 });
      haptic(15);
      speak('She is a doctor.');
    } else {
      haptic([30, 40, 30]);
      if (!reduced) gsap.fromTo(card.current, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
    }
  };

  return (
    <div ref={card} className="lp-try">
      <span className="lp-float lp-float-a">🔥 7</span>
      <span className="lp-float lp-float-b en">+10 XP</span>
      <span className="lp-float lp-float-c">
        <LevelTag level="A1" />
      </span>
      <div className="lp-try-card card">
        <div className="row spread small faint">
          <span className="bold" style={{ color: 'var(--primary)' }}>
            {label}
          </span>
          <span className="en">1/12</span>
        </div>
        <div className="progress thin" style={{ margin: '10px 0 18px' }}>
          <span style={{ width: picked === 'is' ? '16%' : '8%' }} />
        </div>
        <div className="small muted">{question}</div>
        <div className="row" style={{ margin: '8px 0 16px' }}>
          <En className="ex-prompt" as="div">
            She <span className="lp-gap">{correct ? 'is' : '___'}</span> a doctor.
          </En>
          <button className="icon-btn sm" onClick={() => speak('She is a doctor.')} aria-label="listen">
            <Volume2 size={16} />
          </button>
        </div>
        <div className="options">
          {options.map((o) => (
            <button
              key={o}
              className={cx('option', picked === o && (o === 'is' ? 'correct' : 'wrong'))}
              onClick={(e) => choose(o, e.currentTarget)}
              disabled={correct}
            >
              <En>{o}</En>
            </button>
          ))}
        </div>
        {picked && (
          <div className={cx('lp-try-feedback small', correct ? 'ok' : 'bad')} role="status">
            {correct ? ok : bad}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Feature bento */

function Features({ rtl }: { rtl: boolean }) {
  const { speak, playing } = useSpeak();
  const T = (ar: string, en: string) => (rtl ? ar : en);
  const pairs = [
    ['ship', 'sheep'],
    ['pen', 'pin'],
    ['fan', 'van'],
  ];
  const forecast = [9, 5, 7, 3, 6, 4, 8];
  return (
    <div className="lp-bento">
      <SpotlightCard className="lp-feature lp-feature-wide card">
        <Repeat className="lp-feature-icon" />
        <h3>{T('مراجعة متباعدة ذكية', 'Smart spaced review')}</h3>
        <p className="small muted">
          {T(
            'خوارزمية FSRS تحسب لكل كلمة موعد مراجعتها المثالي، فتحفظ أكثر في وقت أقل.',
            'FSRS works out the best review day for every word, so you remember more in less time.',
          )}
        </p>
        <div className="lp-forecast" aria-hidden="true">
          {forecast.map((h, i) => (
            <i key={i} style={{ height: `${h * 10}%` }} className={i === 0 ? 'today' : ''} />
          ))}
        </div>
      </SpotlightCard>
      <SpotlightCard className="lp-feature card" color="color-mix(in srgb, var(--lvl-C2) 22%, transparent)">
        <Mic className="lp-feature-icon" />
        <h3>{T('مختبر النطق', 'Pronunciation lab')}</h3>
        <p className="small muted">{T('الأصوات التي تصعب على العرب، مع لعبة لتدريب الأذن. اضغط لتسمع الفرق:', 'The sounds Arabic speakers find hardest, with an ear-training game. Tap to hear the difference:')}</p>
        <div className="row row-wrap" style={{ gap: 6 }}>
          {pairs.flat().map((w) => (
            <button key={w} className={cx('chip en', playing === `lp-${w}` && 'active')} onClick={() => speak(w, { id: `lp-${w}` })}>
              <Volume2 size={13} /> {w}
            </button>
          ))}
        </div>
      </SpotlightCard>
      <SpotlightCard className="lp-feature card" color="color-mix(in srgb, var(--accent) 24%, transparent)">
        <Zap className="lp-feature-icon" />
        <h3>{T('تدريب يعرف نقاط ضعفك', 'Practice that knows your weak spots')}</h3>
        <p className="small muted">{T('جلسات مختلطة تبدأ بأخطائك السابقة وتركّز على مهارتك الأضعف.', 'Mixed sessions start with your past mistakes and focus on your weakest skill.')}</p>
      </SpotlightCard>
      <SpotlightCard className="lp-feature card" color="color-mix(in srgb, var(--lvl-A2) 22%, transparent)">
        <Library className="lp-feature-icon" />
        <h3>{T('مكتبة قراءة متدرّجة', 'Graded library')}</h3>
        <p className="small muted">{T('نصوص أصلية لكل مستوى، مع قراءة صوتية ومعجم بلمسة.', 'Original texts for every level, read aloud, with a tap-to-translate glossary.')}</p>
      </SpotlightCard>
      <SpotlightCard className="lp-feature card" color="color-mix(in srgb, var(--lvl-B1) 22%, transparent)">
        <PenLine className="lp-feature-icon" />
        <h3>{T('اختبار تحديد المستوى', 'Placement test')}</h3>
        <p className="small muted">{T('يبدأ سهلًا ويرتفع مستوى بعد مستوى حتى يجد مكانك المناسب.', 'Starts easy and climbs one level at a time until it finds where you belong.')}</p>
      </SpotlightCard>
      <SpotlightCard className="lp-feature card" color="color-mix(in srgb, var(--lvl-C1) 22%, transparent)">
        <WifiOff className="lp-feature-icon" />
        <h3>{T('على هاتفك ودون إنترنت', 'On your phone, offline')}</h3>
        <p className="small muted">{T('ثبّتها كتطبيق، وتقدّمك محفوظ على جهازك.', 'Install it like an app; your progress stays on your device.')}</p>
      </SpotlightCard>
    </div>
  );
}
