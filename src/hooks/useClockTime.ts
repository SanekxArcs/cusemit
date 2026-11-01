import React from 'react';
import type { ClockFormat } from '@/store/settings';

const TICK_MS = 500;
const STALE_MS = 2000;
const WATCHDOG_MS = 5000;

function formatTime(format: ClockFormat, showSeconds: boolean) {
  const now = new Date();
  const hour = now.getHours();
  const hours = String(format === '12h' ? hour % 12 || 12 : hour).padStart(
    2,
    '0'
  );
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return {
    main: `${hours}:${minutes}${showSeconds ? ':' + seconds : ''}`,
    ampm: format === '12h' ? (hour >= 12 ? 'PM' : 'AM') : '',
  };
}

export function useClockTime(format: ClockFormat, showSeconds: boolean) {
  const [time, setTime] = React.useState(() => ({
    ...formatTime(format, showSeconds),
    revision: 0,
  }));

  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let suspended = false;
    let lastTick = performance.now();
    let lastWallTime = Date.now();
    const elapsed = () =>
      Math.max(performance.now() - lastTick, Date.now() - lastWallTime);

    const sync = (recover = false) => {
      const stale = recover || elapsed() > STALE_MS;
      lastTick = performance.now();
      lastWallTime = Date.now();
      const next = formatTime(format, showSeconds);
      setTime((previous) => {
        if (
          !stale &&
          previous.main === next.main &&
          previous.ampm === next.ampm
        )
          return previous;
        return { ...next, revision: previous.revision + (stale ? 1 : 0) };
      });
    };
    const stop = () => {
      if (interval !== null) clearInterval(interval);
      interval = null;
    };
    const start = (recover = false) => {
      stop();
      if (document.hidden || suspended) return;
      sync(recover);
      interval = setInterval(() => sync(), TICK_MS);
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        suspended = false;
        start(true);
      }
    };
    const onSuspend = () => {
      suspended = true;
      stop();
    };
    const onResume = () => {
      suspended = false;
      start(true);
    };
    const onFocus = () => {
      if (document.hidden) return;
      suspended = false;
      start();
    };
    const onInteraction = () => {
      if (!document.hidden && (elapsed() > STALE_MS || interval === null))
        onResume();
    };

    start();
    const watchdog = setInterval(() => {
      if (
        !document.hidden &&
        !suspended &&
        (interval === null || elapsed() > STALE_MS)
      )
        start(true);
    }, WATCHDOG_MS);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('freeze', onSuspend);
    document.addEventListener('resume', onResume);
    window.addEventListener('pagehide', onSuspend);
    window.addEventListener('pageshow', onResume);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pointerdown', onInteraction, { passive: true });
    window.addEventListener('keydown', onInteraction);
    return () => {
      stop();
      clearInterval(watchdog);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('freeze', onSuspend);
      document.removeEventListener('resume', onResume);
      window.removeEventListener('pagehide', onSuspend);
      window.removeEventListener('pageshow', onResume);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pointerdown', onInteraction);
      window.removeEventListener('keydown', onInteraction);
    };
  }, [format, showSeconds]);

  return time;
}
