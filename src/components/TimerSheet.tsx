import { Pause, Play, Plus, RotateCcw, Timer, Trash2 } from 'lucide-react';
import { useSettingsStore } from '@/store/settings';
import { formatMs, type TimerControls } from '@/hooks/useTimerArray';
import { Button, Input, Panel, Section, Segments, Toggle } from './ui/controls';

export function TimerSheet({
  isOpen,
  onClose,
  timerControls,
}: {
  isOpen: boolean;
  onClose: () => void;
  timerControls: Record<string, TimerControls>;
}) {
  const { settings, addTimer, removeTimer, updateTimer } = useSettingsStore();
  return (
    <Panel
      open={isOpen}
      onClose={onClose}
      title="Timers"
      description="A little structure for the time ahead."
      footer={
        <Button variant="default" onClick={() => addTimer()}>
          <Plus size={16} /> Add timer
        </Button>
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
                </div>
                {control && (
                  <div className="font-actions">
                    <Button
                      variant="default"
                      onClick={running ? control.pause : control.play}
                      disabled={
                        !running && timer.hours === 0 && timer.minutes === 0
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
                  value={timer.targetDatetime}
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
          </Section>
        );
      })}
    </Panel>
  );
}
