import React from 'react';
import { useVoiceStore } from '@/store/voice';
import { VOICE_MODEL } from '@/lib/voiceTimer';
import { Button, Input, Section, Toggle } from './ui/controls';

export function VoiceSettings() {
  const { apiKey, verified, setKey, holdToTalk, setHoldToTalk } =
    useVoiceStore();
  const [checking, setChecking] = React.useState(false);
  const [error, setError] = React.useState('');
  const request = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => request.current?.abort(), []);

  async function checkKey() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setChecking(true);
    setError('');
    try {
      if (!navigator.onLine)
        throw new Error('Connect to the internet to check your key.');
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' +
          VOICE_MODEL,
        {
          headers: { 'x-goog-api-key': apiKey.trim() },
          signal: controller.signal,
        }
      );
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? 'Gemini quota reached. Wait and try again.'
            : 'Key check failed. Check your API key, restrictions and model access.'
        );
      const model = await response.json();
      if (!model.supportedGenerationMethods?.includes('generateContent'))
        throw new Error('This key cannot access the voice timer model.');
      if (request.current === controller && !controller.signal.aborted)
        setKey(apiKey.trim(), true);
    } catch (failure) {
      if (request.current === controller)
        setError(
          controller.signal.aborted
            ? 'Key check timed out. Please try again.'
            : failure instanceof Error
              ? failure.message
              : 'Could not reach Gemini.'
        );
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setChecking(false);
      }
    }
  }

  return (
    <>
      <Section title="Connect Gemini">
        <label className="setting-field">
          <span className="field-label">Gemini API key</span>
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            placeholder="Paste your own API key"
            disabled={checking}
            onChange={(event) => {
              setKey(event.target.value);
              setError('');
            }}
          />
        </label>
        <div className="voice-timer-actions">
          <Button
            disabled={!apiKey.trim() || checking || verified}
            onClick={checkKey}
          >
            {checking ? 'Checking…' : verified ? 'Key verified' : 'Check key'}
          </Button>
          {apiKey && (
            <Button
              variant="ghost"
              onClick={() => {
                request.current?.abort();
                request.current = null;
                setChecking(false);
                setKey('');
                setError('');
              }}
            >
              Forget key
            </Button>
          )}
        </div>
        <p className="voice-note">
          {VOICE_MODEL}. Key stays only in this tab’s memory, never saved or
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
        <p className="voice-note" role="status">
          {verified
            ? 'Connected. The microphone appears at the bottom left when online.'
            : 'Verify your key to show the microphone.'}
        </p>
        {error && (
          <p role="alert" className="voice-error">
            {error}
          </p>
        )}
      </Section>
      <Section title="Recording">
        <Toggle
          label="Hold to talk"
          description={
            holdToTalk
              ? 'Hold the microphone, speak, then release to send.'
              : 'Tap to start. Tap again to stop and send.'
          }
          checked={holdToTalk}
          onChange={setHoldToTalk}
        />
        <p className="voice-note">
          Say “5 minutes for tea” or “At 18:30” in English, Ukrainian or Polish.
          Your timer starts immediately; use Undo in the notification if needed.
        </p>
        <p className="voice-note">
          Up to 15 seconds of audio is sent to Google on release, stop or the
          recording limit. Free-tier quotas apply; Google may use free-tier
          audio to improve its products.
        </p>
      </Section>
    </>
  );
}
