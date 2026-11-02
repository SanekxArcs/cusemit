import React from 'react';
import { toast } from 'sonner';
import { useHandsFreeStore } from '@/store/handsFree';
import { SilenceRecorder, frameLevel } from '@/lib/handsFreeAudio';
import {
  interpretVoiceTimer,
  voiceTimerConfig,
  VoiceKeyError,
} from '@/lib/voiceTimer';
import { playVoiceCue } from '@/lib/alarm';
import { useVoiceStore } from '@/store/voice';
import type { TimerConfig } from '@/store/settings';

export type HandsFreePhase =
  'off' | 'loading' | 'armed' | 'recording' | 'processing';
export function useHandsFree({
  allowed,
  apiKey,
  onCreate,
  onLevel,
}: {
  allowed: boolean;
  apiKey: string;
  onCreate: (config: Partial<Omit<TimerConfig, 'id'>>) => void;
  onLevel: (level: number) => void;
}) {
  const {
    enabled,
    accessKey,
    phrase,
    keyword,
    keywordLabel,
    silenceMs,
    setEnabled,
  } = useHandsFreeStore();
  const [phase, setPhase] = React.useState<HandsFreePhase>('off');
  const callbacks = React.useRef({ onCreate, onLevel });
  callbacks.current = { onCreate, onLevel };
  const controls = React.useRef({ start: () => {}, finish: () => {} });
  React.useEffect(() => {
    if (!enabled) return;
    const stop = () => setEnabled(false);
    const hidden = () => {
      if (document.hidden) stop();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop();
    };
    window.addEventListener('offline', stop);
    window.addEventListener('blur', stop);
    window.addEventListener('pagehide', stop);
    window.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('offline', stop);
      window.removeEventListener('blur', stop);
      window.removeEventListener('pagehide', stop);
      window.removeEventListener('keydown', key);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [enabled, setEnabled]);

  React.useEffect(() => {
    setPhase('off');
    if (!enabled || !allowed || !accessKey) return;
    if (phrase !== 'Computer' && (!keyword || keywordLabel !== phrase)) {
      setEnabled(false);
      toast.error('Create or import a model for this wake phrase first.');
      return;
    }
    const session = new AbortController();
    let livePhase: HandsFreePhase = 'loading';
    let recording: SilenceRecorder | null = null;
    let noise = 0.002;
    let lastFrame = performance.now();
    let lastPaint = 0;
    let request: AbortController | null = null;
    let watchdog: ReturnType<typeof setInterval> | undefined;
    const transition = (next: HandsFreePhase) => {
      livePhase = next;
      if (!session.signal.aborted) setPhase(next);
    };
    const fail = (message: string) => {
      if (session.signal.aborted) return;
      session.abort();
      setEnabled(false);
      toast.error(message);
    };
    session.signal.addEventListener('abort', () => request?.abort(), {
      once: true,
    });
    const startupTimeout = setTimeout(
      () =>
        fail(
          'Hands-free startup timed out. Check microphone permission and try again.'
        ),
      30000
    );
    const finish = async () => {
      if (session.signal.aborted || livePhase !== 'recording') return;
      const audio = recording?.finish();
      recording = null;
      if (!audio) {
        transition('armed');
        toast.error(
          'No command heard after the wake phrase. Try again after the cue.'
        );
        return;
      }
      transition('processing');
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const result = await interpretVoiceTimer(
          audio,
          apiKey,
          controller.signal
        );
        if (!session.signal.aborted && !controller.signal.aborted)
          callbacks.current.onCreate(voiceTimerConfig(result));
      } catch (failure) {
        if (!session.signal.aborted) {
          if (failure instanceof VoiceKeyError) {
            useVoiceStore.getState().setKey(apiKey);
            setEnabled(false);
          }
          toast.error(
            controller.signal.aborted
              ? 'Gemini took too long. Please try again.'
              : failure instanceof Error
                ? failure.message
                : 'Could not interpret the recording.'
          );
        }
      } finally {
        clearTimeout(timeout);
        request = null;
        if (!session.signal.aborted) transition('armed');
      }
    };
    const start = () => {
      if (session.signal.aborted || livePhase !== 'armed') return;
      recording = new SilenceRecorder(silenceMs, Math.max(0.006, noise * 2.2));
      transition('recording');
      playVoiceCue();
    };
    controls.current = {
      start,
      finish: () => {
        void finish();
      },
    };
    transition('loading');
    void import('@/lib/wakeWordEngine')
      .then(({ startWakeWord }) =>
        startWakeWord(
          {
            accessKey,
            phrase,
            keyword:
              phrase !== 'Computer' && keywordLabel === phrase ? keyword : '',
            onWake: start,
            onError: () =>
              fail(
                'The wake-word engine stopped. Check your Picovoice key, model and browser, then enable hands-free again.'
              ),
            onFrame: (frame) => {
              if (session.signal.aborted) return;
              lastFrame = performance.now();
              const level = frameLevel(frame);
              if (livePhase === 'armed')
                noise = noise * 0.98 + Math.min(0.006, level) * 0.02;
              if (livePhase !== 'recording' || !recording) return;
              if (lastFrame - lastPaint > 65) {
                callbacks.current.onLevel(Math.min(1, level * 12));
                lastPaint = lastFrame;
              }
              if (recording.push(frame) !== 'recording') void finish();
            },
          },
          session.signal
        )
      )
      .then(() => {
        clearTimeout(startupTimeout);
        if (session.signal.aborted) return;
        lastFrame = performance.now();
        transition('armed');
        watchdog = setInterval(() => {
          if (performance.now() - lastFrame > 4000)
            fail(
              'The microphone stopped delivering audio. Enable hands-free again to reconnect.'
            );
        }, 1000);
      })
      .catch(() => {
        clearTimeout(startupTimeout);
        fail(
          'Could not start local wake-word detection. Check your Picovoice AccessKey, model, microphone permission and browser support.'
        );
      });
    return () => {
      session.abort();
      request?.abort();
      recording = null;
      clearTimeout(startupTimeout);
      clearInterval(watchdog);
      controls.current = { start: () => {}, finish: () => {} };
    };
  }, [
    allowed,
    apiKey,
    enabled,
    accessKey,
    phrase,
    keyword,
    keywordLabel,
    silenceMs,
    setEnabled,
  ]);
  return {
    phase,
    enabled,
    phrase,
    start: () => controls.current.start(),
    finish: () => controls.current.finish(),
    stop: () => setEnabled(false),
  };
}
