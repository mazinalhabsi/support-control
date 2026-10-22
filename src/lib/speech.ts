/**
 * Thin wrappers around the Web Speech API.
 *
 *  - Text-to-speech (speechSynthesis) works in every modern browser; voice
 *    quality depends on the device (Chrome/Edge/Safari ship good neural voices).
 *  - Speech recognition is available in Chrome, Edge and Safari. It tells us
 *    *what* the learner said, which is a useful proxy for intelligibility, but
 *    it is not a phoneme-level pronunciation score.
 */

export type Accent = 'en-GB' | 'en-US';

let voicesCache: SpeechSynthesisVoice[] = [];

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

export function ttsSupported(): boolean {
  return synth() !== null;
}

function loadVoices(): SpeechSynthesisVoice[] {
  const s = synth();
  if (!s) return [];
  const v = s.getVoices();
  if (v.length) voicesCache = v;
  return voicesCache;
}

if (typeof window !== 'undefined' && synth()) {
  loadVoices();
  synth()!.addEventListener?.('voiceschanged', loadVoices);
}

export function englishVoices(): SpeechSynthesisVoice[] {
  return loadVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
}

/** Prefer high-quality ("Natural", "Neural", "Google", "Premium") voices for the accent. */
export function pickVoice(accent: Accent, preferredURI?: string): SpeechSynthesisVoice | undefined {
  const voices = englishVoices();
  if (preferredURI) {
    const v = voices.find((x) => x.voiceURI === preferredURI);
    if (v) return v;
  }
  const lang = accent.toLowerCase();
  const sameAccent = voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === lang);
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|premium|enhanced/i.test(v.name) ? 4 : 0) + (/google|microsoft|samantha|daniel/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  const pool = sameAccent.length ? sameAccent : voices;
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

export interface SpeakOptions {
  accent: Accent;
  rate: number;
  voiceURI?: string;
  onEnd?: () => void;
  onBoundary?: (charIndex: number) => void;
}

export function speak(text: string, opts: SpeakOptions): void {
  const s = synth();
  if (!s) {
    opts.onEnd?.();
    return;
  }
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = opts.accent;
  u.rate = opts.rate;
  const voice = pickVoice(opts.accent, opts.voiceURI);
  if (voice) u.voice = voice;
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onEnd?.();
  if (opts.onBoundary) u.onboundary = (e) => opts.onBoundary!(e.charIndex);
  s.speak(u);
}

export function stopSpeaking(): void {
  synth()?.cancel();
}

/* ------------------------------------------------------------------ */
/* Speech recognition                                                  */
/* ------------------------------------------------------------------ */

interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<RecognitionAlternative> & { isFinal: boolean }>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function recognitionSupported(): boolean {
  return recognitionCtor() !== null;
}

export interface ListenHandle {
  stop(): void;
}

/**
 * Listen once. Resolves with the recogniser's alternatives (best first), or
 * calls onError with a code such as "not-allowed" or "no-speech".
 */
export function listenOnce(
  accent: Accent,
  onResult: (alternatives: string[]) => void,
  onError: (code: string) => void,
  onEnd: () => void,
): ListenHandle | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = accent;
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  rec.onresult = (e) => {
    const res = e.results[0];
    const alts: string[] = [];
    for (let i = 0; i < res.length; i++) alts.push(res[i].transcript);
    onResult(alts);
  };
  rec.onerror = (e) => onError(e.error);
  rec.onend = onEnd;
  try {
    rec.start();
  } catch {
    onError('start-failed');
    return null;
  }
  return { stop: () => rec.stop() };
}
