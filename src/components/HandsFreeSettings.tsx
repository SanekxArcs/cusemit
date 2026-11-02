import React from 'react';
import { toast } from 'sonner';
import { useHandsFreeStore, type WakePhrase } from '@/store/handsFree';
import { useVoiceStore } from '@/store/voice';
import { primeAlarmAudio } from '@/lib/alarm';
import { Button, Input, Range, Section, Segments, Toggle } from './ui/controls';

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read this model.'));
    reader.readAsDataURL(blob);
  });
}

export function HandsFreeSettings() {
  const {
    accessKey,
    phrase,
    keyword,
    keywordLabel,
    silenceMs,
    enabled,
    update,
    setEnabled,
  } = useHandsFreeStore();
  const verified = useVoiceStore((state) => state.verified);
  const [training, setTraining] = React.useState(false);
  const [error, setError] = React.useState('');
  const request = React.useRef<AbortController | null>(null);
  const generation = React.useRef(0);
  React.useEffect(() => {
    generation.current++;
    request.current?.abort();
    setTraining(false);
    setError('');
    return () => {
      generation.current++;
      request.current?.abort();
    };
  }, [accessKey, phrase]);
  const ready = phrase === 'Computer' || (!!keyword && keywordLabel === phrase);

  async function train() {
    const token = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    setTraining(true);
    setError('');
    try {
      const response = await fetch('https://rest.picovoice.ai/en/api/ppn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': accessKey.trim(),
        },
        body: JSON.stringify({ platform: 'wasm', phrase }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          'Model creation failed. Check your Picovoice key, account limits or create a Web (WASM), English model in Picovoice Console and import it.'
        );
      const model = await response.blob();
      if (!model.size || model.size > 256 * 1024)
        throw new Error('Picovoice returned an invalid model file.');
      const encoded = await base64(model);
      if (token === generation.current && !controller.signal.aborted)
        update({ keyword: encoded, keywordLabel: phrase });
    } catch (failure) {
      if (token === generation.current)
        setError(
          controller.signal.aborted
            ? 'Model creation timed out. Please try again.'
            : failure instanceof Error
              ? failure.message
              : 'Could not create the wake-word model.'
        );
    } finally {
      clearTimeout(timeout);
      if (token === generation.current) {
        request.current = null;
        setTraining(false);
      }
    }
  }

  async function importModel(file: File) {
    const token = ++generation.current;
    request.current?.abort();
    setTraining(false);
    setError('');
    try {
      if (
        !file.name.toLowerCase().endsWith('.ppn') ||
        !file.size ||
        file.size > 256 * 1024
      )
        throw new Error(
          'Choose an English Web (WASM) .ppn file smaller than 256 KB.'
        );
      const encoded = await base64(file);
      if (token === generation.current)
        update({ keyword: encoded, keywordLabel: phrase });
    } catch (failure) {
      if (token === generation.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not read this model.'
        );
    }
  }

  return (
    <Section title="Hands-free · experimental">
      <p className="voice-note">
        Local wake-word detection, then a short Gemini command. Enable once per
        page session; listening starts after you close settings.
      </p>
      <label className="setting-field">
        <span className="field-label">Picovoice AccessKey</span>
        <Input
          type="password"
          autoComplete="off"
          spellCheck={false}
          maxLength={1024}
          value={accessKey}
          placeholder="Separate from your Gemini key"
          onChange={(event) => update({ accessKey: event.target.value.trim() })}
        />
      </label>
      <p className="voice-note">
        <a
          href="https://console.picovoice.ai/"
          target="_blank"
          rel="noreferrer"
        >
          Get a Picovoice AccessKey
        </a>
        . Account activation, model creation and usage limits are managed by
        Picovoice. This key and your wake-word model stay on this device,
        outside settings sync; browser storage is not encrypted.
      </p>
      {accessKey && (
        <Button
          variant="ghost"
          onClick={() =>
            update({ accessKey: '', keyword: '', keywordLabel: '' })
          }
        >
          Forget hands-free credentials
        </Button>
      )}
      <Segments<WakePhrase>
        label="Wake phrase"
        value={phrase}
        options={[
          { value: 'Computer', label: 'Computer' },
          { value: 'Hey Clock', label: 'Hey Clock' },
          { value: 'Hey Cusemit', label: 'Hey Cusemit' },
        ]}
        onChange={(phrase) => update({ phrase })}
      />
      {phrase !== 'Computer' && (
        <>
          <p className="voice-note">
            Create an English model from the selected phrase (text only, no
            voice samples), or import its English Web (WASM) .ppn model.
            Imported models must match the selected phrase.
          </p>
          <Button
            disabled={!accessKey || training || !navigator.onLine}
            onClick={() => void train()}
          >
            {training ? 'Creating wake-word model…' : 'Create wake-word model'}
          </Button>
          <label className="setting-field">
            <span className="field-label">Import wake-word model (.ppn)</span>
            <Input
              type="file"
              accept=".ppn"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importModel(file);
                event.target.value = '';
              }}
            />
          </label>
          <p className="voice-note" role="status">
            {ready
              ? 'Wake-word model saved on this device.'
              : 'Create or import a model before enabling this phrase.'}
          </p>
        </>
      )}
      <Range
        label="Silence before sending"
        value={silenceMs / 1000}
        min={1}
        max={3}
        step={0.1}
        unit="s"
        onChange={(value) => update({ silenceMs: Math.round(value * 1000) })}
      />
      <Toggle
        label="Hands-free listening"
        checked={enabled}
        description="Keeps the microphone open while the clock is active. Say the wake phrase, wait for the cue, then your timer command."
        onChange={(value) => {
          if (
            value &&
            (!verified || !accessKey || !ready || !navigator.onLine)
          ) {
            toast.error(
              'Verify Gemini, add a Picovoice key and prepare the selected wake phrase while online first.'
            );
            return;
          }
          primeAlarmAudio();
          setEnabled(value);
        }}
      />
      <p className="voice-note">
        Waiting audio is processed locally, not uploaded. Only the command after
        activation is sent to Gemini after silence (default 1.5s), or at the
        15-second limit. Ambient-noise detection is experimental; pause after
        the wake cue. Background noise may delay sending. The microphone
        indicator and stop button stay visible while listening. Leaving the tab,
        losing focus or going offline stops listening; re-enable it to resume.
      </p>
      {error && (
        <p className="voice-error" role="alert">
          {error}
        </p>
      )}
    </Section>
  );
}
