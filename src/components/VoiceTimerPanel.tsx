import React from 'react';
import { Mic, Square, X } from 'lucide-react';
import { formatMs } from '@/hooks/useTimerArray';
import {
  interpretVoiceTimer,
  VOICE_MODEL,
  voiceTimerConfig,
  type VoiceTimerCommand,
} from '@/lib/voiceTimer';
import type { TimerConfig } from '@/store/settings';
import { Button, Input, Panel, Section } from './ui/controls';

export function VoiceTimerPanel({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (config: Partial<Omit<TimerConfig, 'id'>>) => void;
}) {
  const [apiKey, setApiKey] = React.useState('');
  const [phase, setPhase] = React.useState<
    'idle' | 'permission' | 'recording' | 'processing'
  >('idle');
  const [command, setCommand] = React.useState<VoiceTimerCommand | null>(null);
  const [error, setError] = React.useState('');
  const recorder = React.useRef<MediaRecorder | null>(null);
  const stream = React.useRef<MediaStream | null>(null);
  const request = React.useRef<AbortController | null>(null);
  const limit = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = React.useRef(0);
  const busy = React.useRef(false);
  const supported =
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  const releaseMicrophone = React.useCallback(() => {
    if (limit.current) clearTimeout(limit.current);
    limit.current = null;
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
    setCommand(null);
    setError('');
  }, [releaseMicrophone]);

  React.useEffect(() => {
    if (!open) cancel();
    return cancel;
  }, [open, cancel]);

  React.useEffect(() => {
    const onHidden = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [cancel]);

  async function startRecording() {
    if (busy.current || !supported || !apiKey.trim()) return;
    busy.current = true;
    const token = ++generation.current;
    setCommand(null);
    setError('');
    setPhase('permission');
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        setError(
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
          if (generation.current === token) setCommand(result);
        } catch (failure) {
          if (generation.current === token)
            setError(
              controller.signal.aborted
                ? 'Gemini took too long. Please try again.'
                : failure instanceof Error
                  ? failure.message
                  : 'Could not interpret the recording.'
            );
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
      setPhase('recording');
      limit.current = setTimeout(() => {
        if (recording.state !== 'inactive') recording.stop();
      }, 15000);
    } catch (failure) {
      if (generation.current !== token) return;
      releaseMicrophone();
      busy.current = false;
      setPhase('idle');
      setError(
        failure instanceof DOMException && failure.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow microphone access in your browser and try again.'
          : failure instanceof Error
            ? failure.message
            : 'Could not open the microphone.'
      );
    }
  }

  return (
    <Panel
      open={open}
      onClose={onClose}
      title="Voice timer"
      description="Say the time. Check it. Make it yours."
      footer={
        command && (
          <div className="voice-timer-actions">
            <Button
              variant="default"
              onClick={() => {
                try {
                  onCreate(voiceTimerConfig(command));
                  setCommand(null);
                } catch (failure) {
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : 'Invalid timer.'
                  );
                }
              }}
            >
              Create &amp; start timer
            </Button>
            <Button variant="outline" onClick={() => setCommand(null)}>
              Discard
            </Button>
          </div>
        )
      }
    >
      <Section title="Connect Gemini">
        <label className="setting-field">
          <span className="field-label">Gemini API key</span>
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            placeholder="Paste your own API key"
            disabled={phase !== 'idle'}
            onChange={(event) => {
              setApiKey(event.target.value);
              setCommand(null);
              setError('');
            }}
          />
        </label>
        <p className="voice-note">
          {VOICE_MODEL}. Key kept only in this tab’s memory; never saved or
          synced.{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
          >
            Get an API key
          </a>
          .
        </p>
        {apiKey && (
          <Button
            size="small"
            variant="ghost"
            disabled={phase !== 'idle'}
            onClick={() => {
              setApiKey('');
              cancel();
            }}
          >
            Forget key
          </Button>
        )}
      </Section>
      <Section title="Speak a timer">
        <p className="voice-note">
          “5 minutes for tea” or “At 18:30”. Speak English, Ukrainian or Polish.
          Times use this device’s timezone.
        </p>
        <p className="voice-note">
          Up to 15 seconds of audio goes to Google when stopped, including the
          automatic limit. Free-tier quotas apply; Google may use free-tier
          audio to improve its products.
        </p>
        {!supported && (
          <p role="alert">
            Voice recording needs a supported browser on HTTPS or localhost.
          </p>
        )}
        <div className="voice-timer-actions">
          {phase === 'recording' ? (
            <Button
              variant="default"
              onClick={() => {
                if (recorder.current?.state === 'recording')
                  recorder.current.stop();
              }}
            >
              <Square size={16} /> Stop &amp; interpret
            </Button>
          ) : (
            <Button
              variant="default"
              disabled={!supported || !apiKey.trim() || phase !== 'idle'}
              onClick={startRecording}
            >
              <Mic size={16} /> Record command
            </Button>
          )}
          {phase !== 'idle' && (
            <Button variant="outline" onClick={cancel}>
              <X size={16} /> Cancel
            </Button>
          )}
        </div>
        <p className="voice-note" role="status">
          {phase === 'recording'
            ? 'Listening… tap Stop & interpret when you finish.'
            : phase === 'permission'
              ? 'Waiting for microphone permission…'
              : phase === 'processing'
                ? 'Interpreting with Gemini…'
                : 'Nothing is created until you confirm.'}
        </p>
        {error && (
          <p role="alert" className="voice-error">
            {error}
          </p>
        )}
      </Section>
      {command && (
        <Section title="Check your timer">
          <blockquote className="voice-transcript">
            {command.transcript}
          </blockquote>
          <div className="timer-readout">
            {command.mode === 'duration'
              ? formatMs(command.durationSeconds * 1000)
              : new Date(command.targetDatetime).toLocaleString()}
            <small>
              {command.label} ·{' '}
              {command.mode === 'duration'
                ? 'Starts when you confirm'
                : Intl.DateTimeFormat().resolvedOptions().timeZone}
            </small>
          </div>
        </Section>
      )}
    </Panel>
  );
}
