import React from 'react';
import {
  Music,
  Mic,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Square,
  Timer,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore, type TimerConfig } from '@/store/settings';
import {
  ALARM_SOUND_OPTIONS,
  MAX_CUSTOM_SOUND_BYTES,
  loadCustomSound,
  saveCustomSound,
  startAlarm,
} from '@/lib/alarm';
import { formatMs, type TimerControls } from '@/hooks/useTimerArray';
import { Button, Input, Panel, Section, Segments, Toggle } from './ui/controls';

export function TimerSheet({
  isOpen,
  onClose,
  timerControls,
  onVoice,
}: {
  isOpen: boolean;
  onClose: () => void;
  timerControls: Record<string, TimerControls>;
  onVoice: () => void;
}) {
  const { settings, addTimer, removeTimer, updateTimer } = useSettingsStore();
  return (
    <Panel
      open={isOpen}
      onClose={onClose}
      title="Timers"
      description="A little structure for the time ahead."
      footer={
        <div className="voice-timer-actions">
          <Button variant="default" onClick={() => addTimer()}>
            <Plus size={16} /> Add timer
          </Button>
          <Button variant="outline" onClick={onVoice}>
            <Mic size={16} /> Voice timer
          </Button>
        </div>
      }
    >
      {!settings.timers.length && (
        <div className="amoled-preview">
          <Timer size={30} />
          <span>Make time for one thing.</span>
          <small>Add a countdown or a target date.</small>
        </div>
      )}
      {settings.timers.map((timer, index) => {
        const control = timerControls[timer.id];
        const expired = control?.isExpired ?? false;
        const running = control?.isRunning ?? false;
        return (
          <Section key={timer.id} title={'Timer ' + (index + 1)}>
            <div className="timer-title">
              <Input
                aria-label={'Timer ' + (index + 1) + ' name'}
                value={timer.label}
                placeholder="Timer name"
                onChange={(e) =>
                  updateTimer(timer.id, { label: e.target.value })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={'Delete timer ' + (index + 1)}
                onClick={() => removeTimer(timer.id)}
              >
                <Trash2 size={16} />
              </Button>
            </div>
            <div className={'timer-readout ' + (expired ? 'expired' : '')}>
              {formatMs(control?.remainingMs ?? 0, timer.showSeconds)}
              <small>
                {expired
                  ? 'Time is up'
                  : running
                    ? 'Running'
                    : 'Ready when you are'}
              </small>
            </div>
            <Segments
              label="Count down to"
              value={timer.inputMode}
              options={[
                { value: 'duration', label: 'Duration' },
                { value: 'datetime', label: 'Date & time' },
              ]}
              onChange={(v) => updateTimer(timer.id, { inputMode: v })}
            />
            {timer.inputMode === 'duration' ? (
              <>
                <div className="timer-duration">
                  <label>
                    Hours
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      value={timer.hours}
                      onChange={(e) =>
                        updateTimer(timer.id, {
                          hours: Math.max(
                            0,
                            Math.min(99, Number(e.target.value) || 0)
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Minutes
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={timer.minutes}
                      onChange={(e) =>
                        updateTimer(timer.id, {
                          minutes: Math.max(
                            0,
                            Math.min(59, Number(e.target.value) || 0)
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Seconds
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={timer.seconds ?? 0}
                      onChange={(event) =>
                        updateTimer(timer.id, {
                          seconds: Math.max(
                            0,
                            Math.min(59, Number(event.target.value) || 0)
                          ),
                        })
                      }
                    />
                  </label>
                </div>
                {control && (
                  <div className="font-actions">
                    <Button
                      variant="default"
                      onClick={running ? control.pause : control.play}
                      disabled={
                        !running &&
                        timer.hours === 0 &&
                        timer.minutes === 0 &&
                        !(timer.seconds ?? 0)
                      }
                    >
                      {running ? <Pause size={15} /> : <Play size={15} />}{' '}
                      {running ? 'Pause' : 'Start'}
                    </Button>
                    <Button variant="outline" onClick={control.reset}>
                      <RotateCcw size={15} /> Reset
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <label className="setting-field">
                <span className="field-label">Target date and time</span>
                <Input
                  type="datetime-local"
                  step={1}
                  value={
                    timer.targetDatetime &&
                    Number.isFinite(Date.parse(timer.targetDatetime))
                      ? new Date(
                          new Date(timer.targetDatetime).getTime() -
                            new Date(timer.targetDatetime).getTimezoneOffset() *
                              60000
                        )
                          .toISOString()
                          .slice(0, 19)
                      : ''
                  }
                  onChange={(e) =>
                    updateTimer(timer.id, { targetDatetime: e.target.value })
                  }
                />
                {expired && (
                  <span className="setting-note">
                    This target is in the past.
                  </span>
                )}
                {timer.targetDatetime && (
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() =>
                      updateTimer(timer.id, { targetDatetime: '' })
                    }
                  >
                    Clear target
                  </Button>
                )}
              </label>
            )}
            <Segments
              label="Show timer"
              value={timer.displayPosition}
              options={[
                { value: 'top', label: 'Above clock' },
                { value: 'bottom', label: 'Below clock' },
                { value: 'floating', label: 'Floating' },
              ]}
              onChange={(v) => updateTimer(timer.id, { displayPosition: v })}
            />
            {timer.displayPosition === 'floating' && (
              <Toggle
                label="Use clock font"
                checked={timer.useClockFont}
                onChange={(v) => updateTimer(timer.id, { useClockFont: v })}
              />
            )}
            <Toggle
              label="Show seconds"
              checked={timer.showSeconds ?? true}
              onChange={(v) => updateTimer(timer.id, { showSeconds: v })}
            />
            <Toggle
              label="Auto-delete when done"
              checked={timer.autoDelete ?? false}
              onChange={(v) => updateTimer(timer.id, { autoDelete: v })}
            />
            <TimerAlarmSettings
              timer={timer}
              onChange={(updates) => updateTimer(timer.id, updates)}
            />
          </Section>
        );
      })}
    </Panel>
  );
}

const PREVIEW_MS = 4000;

function TimerAlarmSettings({
  timer,
  onChange,
}: {
  timer: TimerConfig;
  onChange: (updates: Partial<TimerConfig>) => void;
}) {
  const fileInput = React.useRef<HTMLInputElement>(null);
  const stopPreview = React.useRef<(() => void) | null>(null);
  const previewTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [previewing, setPreviewing] = React.useState(false);

  const endPreview = React.useCallback(() => {
    stopPreview.current?.();
    stopPreview.current = null;
    if (previewTimeout.current) clearTimeout(previewTimeout.current);
    setPreviewing(false);
  }, []);
  React.useEffect(() => endPreview, [endPreview]);
  // A preview of the old choice should not keep playing after switching.
  React.useEffect(endPreview, [timer.alarmSound, timer.customSoundName, endPreview]);

  const preview = async () => {
    if (previewing) return endPreview();
    const blob =
      timer.alarmSound === 'custom' ? await loadCustomSound(timer.id) : null;
    stopPreview.current = startAlarm(timer.alarmSound, blob);
    setPreviewing(true);
    previewTimeout.current = setTimeout(endPreview, PREVIEW_MS);
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_CUSTOM_SOUND_BYTES) {
      toast.error('That sound is too large. Pick a file under 5 MB.');
      return;
    }
    try {
      await saveCustomSound(timer.id, file);
      onChange({ alarmSound: 'custom', customSoundName: file.name });
    } catch {
      toast.error('Could not save that sound on this device.');
    }
  };

  const needsFile = timer.alarmSound === 'custom' && !timer.customSoundName;
  return (
    <>
      <Segments
        label="Sound when time is up"
        value={timer.alarmSound}
        options={ALARM_SOUND_OPTIONS}
        columns={3}
        onChange={(v) => onChange({ alarmSound: v })}
      />
      {timer.alarmSound === 'custom' && (
        <div className="setting-field">
          <input
            ref={fileInput}
            type="file"
            accept="audio/*"
            hidden
            aria-label={'Custom sound file for ' + (timer.label || 'timer')}
            onChange={(e) => {
              void pickFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <Music size={15} />{' '}
            {timer.customSoundName ? 'Change sound' : 'Choose a sound file'}
          </Button>
          <span className="setting-note">
            {timer.customSoundName ||
              'No file yet. Until you pick one, Beep plays instead.'}
          </span>
        </div>
      )}
      {timer.alarmSound !== 'none' && !needsFile && (
        <div className="font-actions">
          <Button variant="outline" onClick={() => void preview()}>
            {previewing ? <Square size={15} /> : <Play size={15} />}{' '}
            {previewing ? 'Stop preview' : 'Preview sound'}
          </Button>
        </div>
      )}
      <Toggle
        label="Flash the screen"
        description="Flashes the whole screen until you tap it. Useful when the sound is off."
        checked={timer.flashOnExpire}
        onChange={(v) => onChange({ flashOnExpire: v })}
      />
    </>
  );
}
