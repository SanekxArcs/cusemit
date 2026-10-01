import type { ClockSettings } from '@/store/settings';
import { getSunTimes, type SunTimes } from './sun';

export type BrightnessMode = 'off' | 'fixed' | 'sun' | 'custom';

/** One handle on the brightness curve: at `minute` the screen reaches `level`. */
export interface BrightnessPoint {
  id: string;
  /** Minutes after local midnight, 0–1439. */
  minute: number;
  /** Percent of the screen's own brightness, MIN_LEVEL–100. */
  level: number;
}

export const DAY_MINUTES = 1440;
/** Fully black would look like a dead screen; keep a glow you can find. */
export const MIN_LEVEL = 5;
export const MAX_POINTS = 12;

/** Used until the person shares a location. */
const FALLBACK_SUN: SunTimes = { sunrise: 7 * 60, sunset: 19 * 60, polar: null };

export const makePointId = () =>
  `bp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const DEFAULT_BRIGHTNESS_POINTS: BrightnessPoint[] = [
  { id: 'bp-day', minute: 7 * 60, level: 100 },
  { id: 'bp-night', minute: 22 * 60, level: 20 },
];

const mod = (value: number, base: number) => ((value % base) + base) % base;
const ease = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
export const clampLevel = (level: number) =>
  Math.min(100, Math.max(MIN_LEVEL, Math.round(level)));

/**
 * Brightness at `minute` for a set of points on a 24-hour loop. Each point is
 * reached exactly at its time: the previous level holds, then eases over the
 * last `transition` minutes before the point (or the whole gap, if shorter).
 * A long transition therefore turns the curve into one continuous glide.
 */
export function levelAt(
  points: readonly BrightnessPoint[],
  minute: number,
  transition: number
): number {
  if (points.length === 0) return 100;
  if (points.length === 1) return points[0].level;
  const sorted = [...points].sort((a, b) => a.minute - b.minute);
  const m = mod(minute, DAY_MINUTES);
  let i = sorted.length - 1;
  for (let k = 0; k < sorted.length; k++) if (sorted[k].minute <= m) i = k;
  const from = sorted[i];
  const to = sorted[(i + 1) % sorted.length];
  const gap = mod(to.minute - from.minute, DAY_MINUTES) || DAY_MINUTES;
  const elapsed = mod(m - from.minute, DAY_MINUTES);
  const window = Math.min(Math.max(transition, 1), gap);
  const holdUntil = gap - window;
  if (elapsed <= holdUntil) return from.level;
  return from.level + (to.level - from.level) * ease((elapsed - holdUntil) / window);
}

/**
 * Turns sunrise and sunset into the four points of a day/night curve, with
 * each transition centred on the sun event: dawn starts brightening before
 * sunrise and is fully bright after it.
 */
export function sunCurvePoints(
  sun: SunTimes,
  dayLevel: number,
  nightLevel: number,
  transition: number
): BrightnessPoint[] {
  if (sun.polar === 'day') return [{ id: 'sun', minute: 720, level: dayLevel }];
  if (sun.polar === 'night') return [{ id: 'sun', minute: 0, level: nightLevel }];
  const rise = sun.sunrise!;
  const set = sun.sunset!;
  const dayLength = mod(set - rise, DAY_MINUTES);
  const half = Math.min(
    transition / 2,
    dayLength / 2,
    (DAY_MINUTES - dayLength) / 2
  );
  const at = (minute: number) => Math.round(mod(minute, DAY_MINUTES));
  return [
    { id: 'dawn-start', minute: at(rise - half), level: nightLevel },
    { id: 'dawn-end', minute: at(rise + half), level: dayLevel },
    { id: 'dusk-start', minute: at(set - half), level: dayLevel },
    { id: 'dusk-end', minute: at(set + half), level: nightLevel },
  ];
}

export interface BrightnessSchedule {
  points: BrightnessPoint[];
  transition: number;
  /** Only in sun mode. */
  sun: SunTimes | null;
  /** True when sun mode is guessing because no location is saved. */
  approximate: boolean;
}

/** The curve the current settings describe for the day containing `date`. */
export function getBrightnessSchedule(
  s: ClockSettings,
  date: Date
): BrightnessSchedule | null {
  switch (s.brightnessMode) {
    case 'fixed':
      return {
        points: [{ id: 'fixed', minute: 0, level: s.brightnessFixedLevel }],
        transition: DAY_MINUTES,
        sun: null,
        approximate: false,
      };
    case 'sun': {
      const hasLocation =
        s.brightnessLatitude !== null && s.brightnessLongitude !== null;
      const sun = hasLocation
        ? getSunTimes(date, s.brightnessLatitude!, s.brightnessLongitude!)
        : FALLBACK_SUN;
      return {
        points: sunCurvePoints(
          sun,
          s.brightnessDayLevel,
          s.brightnessNightLevel,
          s.brightnessTransition
        ),
        // The points already encode the transition; glide across each gap.
        transition: DAY_MINUTES,
        sun,
        approximate: !hasLocation,
      };
    }
    case 'custom':
      return {
        points: s.brightnessPoints,
        transition: s.brightnessTransition,
        sun: null,
        approximate: false,
      };
    default:
      return null;
  }
}

export const minuteOfDay = (date: Date) =>
  date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;

/** Current brightness in percent; 100 when dimming is off. */
export function brightnessNow(s: ClockSettings, date: Date): number {
  const schedule = getBrightnessSchedule(s, date);
  if (!schedule) return 100;
  return levelAt(schedule.points, minuteOfDay(date), schedule.transition);
}

/**
 * Validates points from storage or a sync payload. Returns null when the value
 * isn't a usable list, so the caller can keep what it already has.
 */
export function sanitizeBrightnessPoints(value: unknown): BrightnessPoint[] | null {
  if (!Array.isArray(value)) return null;
  const points: BrightnessPoint[] = [];
  for (const item of value.slice(0, MAX_POINTS)) {
    if (item === null || typeof item !== 'object') return null;
    const { id, minute, level } = item as Record<string, unknown>;
    if (typeof minute !== 'number' || typeof level !== 'number') return null;
    if (!Number.isFinite(minute) || !Number.isFinite(level)) return null;
    points.push({
      id: typeof id === 'string' && id ? id : makePointId(),
      minute: Math.round(mod(minute, DAY_MINUTES)),
      level: clampLevel(level),
    });
  }
  return points.length > 0 ? points : null;
}

export function formatMinute(minute: number, twelveHour: boolean): string {
  const m = Math.round(mod(minute, DAY_MINUTES));
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  if (!twelveHour) return `${String(h).padStart(2, '0')}:${mm}`;
  return `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}
