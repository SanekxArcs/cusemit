import { useVoiceStore } from '@/store/voice';
import { VOICE_MODEL } from '@/lib/voiceTimer';
import { Button, Input, Section, Toggle } from './ui/controls';

export function VoiceSettings() {
  const {
    apiKey,
    verified,
    setKey,
    holdToTalk,
    setHoldToTalk,
    checking,
    error,
    checkKey,
  } = useVoiceStore();

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
                setKey('');
              }}
            >
              Forget key
            </Button>
          )}
        </div>
        <p className="voice-note">
          {VOICE_MODEL}. Your key is saved in this browser and included in
          manual settings sync. Browser storage is not encrypted. Anyone with
          your sync code can retrieve the key; sync is not end-to-end encrypted.
          Forget key removes it here; upload changes to remove the synced copy.{' '}
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
