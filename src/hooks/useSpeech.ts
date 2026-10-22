import { useCallback, useEffect, useState } from 'react';
import { speak as ttsSpeak, stopSpeaking } from '../lib/speech';
import { useProgress } from '../store/progress';

/** Text-to-speech bound to the learner's accent / rate / voice settings. */
export function useSpeak() {
  const accent = useProgress((s) => s.settings.accent);
  const rate = useProgress((s) => s.settings.rate);
  const voiceURI = useProgress((s) => s.settings.voiceURI);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => () => stopSpeaking(), []);

  const speak = useCallback(
    (text: string, opts: { slow?: boolean; id?: string; onEnd?: () => void; onBoundary?: (i: number) => void } = {}) => {
      const id = opts.id ?? text;
      setPlaying(id);
      ttsSpeak(text, {
        accent,
        rate: opts.slow ? Math.max(0.5, rate * 0.7) : rate,
        voiceURI,
        onBoundary: opts.onBoundary,
        onEnd: () => {
          setPlaying((p) => (p === id ? null : p));
          opts.onEnd?.();
        },
      });
    },
    [accent, rate, voiceURI],
  );

  const stop = useCallback(() => {
    stopSpeaking();
    setPlaying(null);
  }, []);

  return { speak, stop, playing };
}
