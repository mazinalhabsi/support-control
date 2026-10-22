/** Tiny synthesized sound effects (no audio files to download). */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.08) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  osc.connect(g).connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + dur + 0.02);
}

export const sfx = {
  correct() {
    tone(660, 0, 0.12, 'sine');
    tone(990, 0.09, 0.18, 'sine');
  },
  wrong() {
    tone(220, 0, 0.18, 'triangle', 0.07);
    tone(185, 0.12, 0.22, 'triangle', 0.07);
  },
  complete() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.25, 'sine', 0.07));
  },
};
