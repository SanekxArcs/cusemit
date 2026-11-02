import { toast } from 'sonner';
import { useHandsFreeStore, type WakePhrase } from '@/store/handsFree';
import { useVoiceStore } from '@/store/voice';
import { primeAlarmAudio } from '@/lib/alarm';
import { Range, Section, Segments, Toggle } from './ui/controls';

export function HandsFreeSettings() {
  const { phrase, silenceMs, enabled, update, setEnabled } = useHandsFreeStore();
  const verified = useVoiceStore((state) => state.verified);
  return (
    <Section title="Hands-free · experimental">
      <p className="voice-note">
        Local sherpa-onnx wake-word detection. No extra account, key or training
        required. Enable once per page session; listening starts after you close settings.
        The first start downloads about 21 MB of local runtime and model files.
      </p>
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
      <p className="voice-note">
        Say the selected phrase in English. Try “Hey Clock” first; the invented
        name “Cusemit” is experimental and may be less reliable. This detects a
        phrase, not your identity; voice-example training is not needed or included.
      </p>
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
          if (value && (!verified || !navigator.onLine)) {
            toast.error('Verify your Gemini key while online first.');
            return;
          }
          primeAlarmAudio();
          setEnabled(value);
        }}
      />
      <p className="voice-note">
        Waiting audio stays on this device. Only the command after activation is
        sent to Gemini after silence (default 1.5s), or at the 15-second limit.
        Background noise can cause false wakes or delay sending. The microphone
        indicator and stop button remain visible. Leaving the tab, losing focus
        or going offline stops listening. Local inference uses extra CPU and memory;
        performance on older phones is experimental.
      </p>
    </Section>
  );
}
