import React from 'react';
import { startAlarm, type AlarmSound } from '@/lib/alarm';

export interface TimerAlert {
  id: string;
  label: string;
  sound: AlarmSound;
  /** Loaded up front so the alarm still plays after an auto-deleted timer is gone. */
  customBlob: Blob | null;
  flash: boolean;
}

const FLASH_INTERVAL_MS = 500;
const VIBRATION_PATTERN = [400, 200, 400, 200, 400, 1000];

/**
 * Rings and/or flashes for finished timers until any tap, click or key press.
 * The whole screen catches that first touch, so dismissing the alarm never
 * also presses whatever happens to be underneath.
 */
export function TimerAlarm({
  alerts,
  onDismiss,
}: {
  alerts: TimerAlert[];
  onDismiss: () => void;
}) {
  const latest = alerts[alerts.length - 1];
  const flash = alerts.some((a) => a.flash);
  const [lit, setLit] = React.useState(true);

  // One sound at a time: the most recently finished timer's.
  React.useEffect(() => {
    if (!latest || latest.sound === 'none') return;
    return startAlarm(latest.sound, latest.customBlob);
  }, [latest]);

  React.useEffect(() => {
    if (!alerts.length || !('vibrate' in navigator)) return;
    const buzz = () => navigator.vibrate(VIBRATION_PATTERN);
    buzz();
    const id = setInterval(buzz, VIBRATION_PATTERN.reduce((a, b) => a + b));
    return () => {
      clearInterval(id);
      navigator.vibrate(0);
    };
  }, [alerts.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggled from JS, not a CSS animation: the reduced-motion rule would stop a
  // CSS flash after one cycle, and the user turned this on to be noticed.
  React.useEffect(() => {
    if (!flash) return;
    setLit(true);
    const id = setInterval(() => setLit((v) => !v), FLASH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [flash]);

  React.useEffect(() => {
    if (!alerts.length) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      onDismiss();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [alerts.length, onDismiss]);

  if (!latest) return null;

  const names = alerts.map((a) => a.label.trim() || 'Timer').join(', ');
  return (
    <div
      className={
        'timer-alarm' + (flash ? ' timer-alarm-flash' : '') + (flash && lit ? ' lit' : '')
      }
      role="alertdialog"
      aria-label={`${names}: time is up`}
      onClick={(e) => {
        e.stopPropagation();
        onDismiss();
      }}
    >
      <div className="timer-alarm-card">
        <strong>{names}</strong>
        <span>Time is up</span>
        <small>Tap anywhere to stop</small>
      </div>
    </div>
  );
}
