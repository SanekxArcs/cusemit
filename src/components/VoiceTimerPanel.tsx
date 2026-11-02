import React from 'react';
import { LoaderCircle, Mic, Square, X } from 'lucide-react';
import { toast } from 'sonner';
import { useVoiceStore } from '@/store/voice';
import { primeAlarmAudio } from '@/lib/alarm';
import { useHandsFree } from '@/hooks/useHandsFree';
import {
  interpretVoiceTimer,
  VoiceKeyError,
  voiceTimerConfig,
} from '@/lib/voiceTimer';
import type { TimerConfig } from '@/store/settings';
import { Button } from './ui/controls';

export function VoiceTimerButton({
  visible,
  enabled,
  reducedMotion,
  onBusyChange,
  onCreate,
}: {
  visible: boolean;
  enabled: boolean;
  reducedMotion: boolean;
  onBusyChange: (busy: boolean) => void;
  onCreate: (config: Partial<Omit<TimerConfig, 'id'>>) => void;
}) {
  const { apiKey, verified, holdToTalk } = useVoiceStore();
  const [online, setOnline] = React.useState(navigator.onLine);
  const bars = React.useRef<HTMLDivElement | null>(null);
  const stopWaves = React.useRef<(() => void) | null>(null);
  const createRef = React.useRef(onCreate);
  createRef.current = onCreate;
  const [phase, setPhase] = React.useState<
    'idle' | 'permission' | 'recording' | 'processing'
  >('idle');
  const recorder = React.useRef<MediaRecorder | null>(null);
  const stream = React.useRef<MediaStream | null>(null);
  const request = React.useRef<AbortController | null>(null);
  const limit = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = React.useRef(0);
  const busy = React.useRef(false);
  const supported =
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;
  const updateLevel = React.useCallback((level: number) => {
    if (reducedMotion || !bars.current) return;
    bars.current.dataset.reactive = 'true';
    bars.current.querySelectorAll<HTMLElement>('i').forEach((bar, index) => {
      bar.style.transform = 'scaleY(' + (0.15 + level * (0.45 + Math.sin(index + 1) * 0.3)) + ')';
    });
  }, [reducedMotion]);
  const handsFree = useHandsFree({
    allowed: enabled && online && verified && supported && phase === 'idle',
    apiKey,
    onCreate: (config) => createRef.current(config),
    onLevel: updateLevel,
  });

  const releaseMicrophone = React.useCallback(() => {
    if (limit.current) clearTimeout(limit.current);
    limit.current = null;
    stopWaves.current?.();
    stopWaves.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const cancel = React.useCallback(() => {
    generation.current += 1;
    request.current?.abort();
    request.current = null;
    if (recorder.current) {
      recorder.current.onstop = null;
      recorder.current.onerror = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
      recorder.current = null;
    }
    releaseMicrophone();
    busy.current = false;
    setPhase('idle');
  }, [releaseMicrophone]);

  React.useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  React.useEffect(() => {
    const voice = useVoiceStore.getState();
    if (online && voice.apiKey && !voice.verified) void voice.checkKey();
  }, [online]);

  React.useEffect(() => {
    if (!enabled || !online || !verified) cancel();
    return cancel;
  }, [enabled, online, verified, apiKey, holdToTalk, cancel]);

  React.useEffect(() => {
    onBusyChange(phase !== 'idle' || ['loading', 'recording', 'processing'].includes(handsFree.phase));
  }, [phase, handsFree.phase, onBusyChange]);

  React.useEffect(() => {
    const onHidden = () => {
      if (document.hidden) cancel();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', cancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', onKey);
    };
  }, [cancel]);

  function animateWaves(input: MediaStream) {
    if (reducedMotion) return;
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      const source = context.createMediaStreamSource(input);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      let frame = 0;
      let previous = 0;
      const paint = (time: number) => {
        if (time - previous > 65) {
          analyser.getByteFrequencyData(samples);
          if (bars.current) bars.current.dataset.reactive = 'true';
          bars.current
            ?.querySelectorAll<HTMLElement>('i')
            .forEach((bar, index) => {
              const level = samples[index * 5 + 2] / 255;
              bar.style.transform = 'scaleY(' + (0.15 + level * 0.85) + ')';
            });
          previous = time;
        }
        frame = requestAnimationFrame(paint);
      };
      frame = requestAnimationFrame(paint);
      stopWaves.current = () => {
        cancelAnimationFrame(frame);
        source.disconnect();
        analyser.disconnect();
        void context?.close().catch(() => {});
      };
      void context.resume().catch(() => {});
    } catch {
      void context?.close().catch(() => {});
    }
  }

  function stopRecording() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    else if (busy.current) cancel();
  }

  async function startRecording() {
    if (busy.current || !supported || !verified || !online || !enabled) return;
    busy.current = true;
    const token = ++generation.current;

    setPhase('permission');
    try {
      primeAlarmAudio();
      const input = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (generation.current !== token) {
        input.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = input;
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType)
        throw new Error(
          'This browser cannot record a supported audio format. Try Chrome, Edge, or Firefox.'
        );
      const recording = new MediaRecorder(input, { mimeType });
      recorder.current = recording;
      const chunks: BlobPart[] = [];
      let bytes = 0;
      recording.ondataavailable = (event) => {
        if (event.data.size) {
          chunks.push(event.data);
          bytes += event.data.size;
        }
        if (bytes > 8 * 1024 * 1024 && recording.state !== 'inactive')
          recording.stop();
      };
      recording.onerror = () => {
        cancel();
        toast.error(
          'Recording failed. Please check your microphone and try again.'
        );
      };
      recording.onstop = async () => {
        releaseMicrophone();
        if (generation.current !== token) return;
        recorder.current = null;
        setPhase('processing');
        const controller = new AbortController();
        request.current = controller;
        const timeout = setTimeout(() => controller.abort(), 30000);
        try {
          const result = await interpretVoiceTimer(
            new Blob(chunks, { type: recording.mimeType }),
            apiKey,
            controller.signal
          );
          if (generation.current === token)
            createRef.current(voiceTimerConfig(result));
        } catch (failure) {
          if (generation.current === token) {
            if (failure instanceof VoiceKeyError)
              useVoiceStore.getState().setKey(apiKey);
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
          if (generation.current === token) {
            request.current = null;
            busy.current = false;
            setPhase('idle');
          }
        }
      };
      recording.start(1000);
      animateWaves(input);
      setPhase('recording');
      limit.current = setTimeout(() => {
        if (recording.state !== 'inactive') recording.stop();
      }, 15000);
    } catch (failure) {
      if (generation.current !== token) return;
      releaseMicrophone();
      busy.current = false;
      setPhase('idle');
      toast.error(
        failure instanceof DOMException && failure.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow microphone access in your browser and try again.'
          : failure instanceof Error
            ? failure.message
            : 'Could not open the microphone.'
      );
    }
  }

  if (!verified || !online || !enabled || !supported) return null;
  const active = phase !== 'idle' || (handsFree.enabled && handsFree.phase !== 'off');
  const recording = phase === 'recording' || handsFree.phase === 'recording';
  const working = phase === 'permission' || phase === 'processing' || handsFree.phase === 'loading' || handsFree.phase === 'processing';
  const label = handsFree.enabled
    ? handsFree.phase === 'recording' ? 'Send hands-free command'
      : working ? 'Preparing hands-free command' : 'Record hands-free command'
    : recording
    ? 'Stop & interpret'
    : phase === 'permission'
      ? 'Cancel microphone request'
      : phase === 'processing'
        ? 'Interpreting timer'
        : holdToTalk
          ? 'Hold to talk'
          : 'Record command';

  return (
    <div
      className={
        'voice-dock' + (!visible && !active ? ' voice-dock-hidden' : '')
      }
      inert={!visible && !active}
      data-phase={handsFree.enabled ? handsFree.phase : phase}
    >
      {active && (
        <div className="voice-feedback" role="status" aria-live="polite">
          {recording && (
            <div className="voice-waves" ref={bars} aria-hidden="true">
              {Array.from({ length: 13 }, (_, index) => (
                <i
                  key={index}
                  style={
                    {
                      '--wave-delay': index * -0.08 + 's',
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          )}
          <span>
            {recording
              ? 'Listening…'
              : handsFree.phase === 'armed'
                ? 'Say “' + handsFree.phrase + '”'
                : handsFree.phase === 'loading'
                  ? 'Starting local listener…'
                  : phase === 'permission'
                    ? 'Allow microphone…'
                    : 'Setting your timer…'}
          </span>
        </div>
      )}
      <div className="voice-dock-actions">
        <Button
          className="voice-mic"
          aria-label={label}
          title={label}
          aria-pressed={recording}
          aria-busy={working}
          disabled={phase === 'processing' || (handsFree.enabled && working)}
          onPointerDown={(event) => {
            if (handsFree.enabled || !holdToTalk || event.button !== 0 || working) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            void startRecording();
          }}
          onPointerUp={(event) => {
            if (handsFree.enabled || !holdToTalk) return;
            event.preventDefault();
            stopRecording();
          }}
          onPointerCancel={() => {
            if (!handsFree.enabled && holdToTalk) cancel();
          }}
          onKeyDown={(event) => {
            if (!handsFree.enabled && holdToTalk && [' ', 'Enter'].includes(event.key)) {
              event.preventDefault();
              if (!event.repeat) void startRecording();
            }
          }}
          onKeyUp={(event) => {
            if (!handsFree.enabled && holdToTalk && [' ', 'Enter'].includes(event.key)) {
              event.preventDefault();
              stopRecording();
            }
          }}
          onClick={() => {
            if (handsFree.enabled) {
              if (recording) handsFree.finish();
              else handsFree.start();
              return;
            }
            if (holdToTalk) return;
            if (phase === 'recording' || phase === 'permission')
              stopRecording();
            else void startRecording();
          }}
        >
          {working ? (
            <LoaderCircle size={23} className="voice-spinner" />
          ) : recording ? (
            <Square size={21} fill="currentColor" />
          ) : (
            <Mic size={24} />
          )}
        </Button>
        {active && (
          <Button
            className="voice-cancel"
            size="icon"
            variant="ghost"
            aria-label={handsFree.enabled ? 'Stop hands-free listening' : 'Cancel voice timer'}
            onClick={() => { handsFree.stop(); cancel(); }}
          >
            <X size={17} />
          </Button>
        )}
      </div>
    </div>
  );
}
