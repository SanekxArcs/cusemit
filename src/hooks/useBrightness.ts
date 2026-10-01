import React from 'react';
import type { ClockSettings } from '@/store/settings';
import { brightnessNow } from '@/lib/brightness';

/** Even the shortest transition moves only a few percent between ticks. */
const TICK_MS = 15_000;

/** A clock that ticks only while a schedule depends on the time of day. */
export function useNow(active: boolean): Date {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    if (!active) return;
    setNow(new Date());
    const tick = () => setNow(new Date());
    let id: ReturnType<typeof setInterval> | null = setInterval(tick, TICK_MS);
    // Timers are throttled in the background; catch up the moment we're back.
    const onVisibility = () => {
      if (id) clearInterval(id);
      id = null;
      if (!document.hidden) {
        tick();
        id = setInterval(tick, TICK_MS);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (id) clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active]);
  return now;
}

/** The app's brightness right now, in percent (100 = undimmed). */
export function useBrightness(settings: ClockSettings): number {
  const scheduled =
    settings.brightnessMode === 'sun' || settings.brightnessMode === 'custom';
  const now = useNow(scheduled);
  return brightnessNow(settings, now);
}
