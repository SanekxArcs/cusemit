import { DEFAULT_SETTINGS, type ClockSettings } from '@/store/settings';

/**
 * The settings that travel with a sync code.
 *
 * Deliberately excluded, because they describe *this* screen rather than your
 * taste: everything in Positioning (fit mode, scale, offsets, floating
 * placement), the uploaded background image and its framing, and timers.
 * A wall tablet and a phone share a look, not a layout.
 */
export const SYNCABLE_KEYS = [
  // AMOLED
  'enableAMOLEDSaver',
  'amoledSaverMode',
  'amoledMeshType',

  // Background
  'backgroundMode',
  'solidColor',
  'gradientStart',
  'gradientEnd',
  'bgGradientAngle',
  'animatedGradient',
  'backgroundPattern',
  'patternOpacity',
  'patternSize',

  // Clock
  'clockMode',
  'clockColor',
  'clockGradientStart',
  'clockGradientEnd',
  'clockGradientAngle',
  'showStroke',
  'strokeWidth',
  'strokeColor',
  'fontFamily',
  'customFontFamily',
  'fontWeight',
  'tabularNums',
  'tabularNumsFallback',
  'savedFonts',
  'hiddenCuratedFonts',
  'customColors',

  // Display
  'showSeconds',
  'clockFormat',
  'orientation',
  'animationMode',
  'autoHideControls',
  'ampmPosition',
  'pulseColon',
  'showTopText',
  'showBottomText',
  'topText',
  'bottomText',
  'topTextSize',
  'bottomTextSize',
  'topTextColor',
  'bottomTextColor',
] as const satisfies readonly (keyof ClockSettings)[];

export type SyncableKey = (typeof SYNCABLE_KEYS)[number];
export type SyncablePayload = Pick<ClockSettings, SyncableKey>;

/**
 * Serializes the syncable subset. Keys are written in SYNCABLE_KEYS order so
 * two identical states always produce the identical string — that stable
 * output is what the "nothing to upload" check compares against.
 */
export function serializeSyncable(settings: ClockSettings): string {
  const payload: Record<string, unknown> = {};
  for (const key of SYNCABLE_KEYS) payload[key] = settings[key];
  return JSON.stringify(payload);
}

/** Same shape a background image would have used to bloat the payload: none. */
function isSameType(value: unknown, reference: unknown): boolean {
  if (Array.isArray(reference)) {
    return Array.isArray(value) && value.every((v) => typeof v === 'string');
  }
  return typeof value === typeof reference;
}

/**
 * Takes the keys we recognize out of a downloaded payload, dropping anything
 * of the wrong type. A device on an older build simply ignores settings it
 * has never heard of, and keeps its own value for anything the payload omits.
 */
export function parseSyncable(payload: string): Partial<ClockSettings> {
  const parsed: unknown = JSON.parse(payload);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('These settings could not be read.');
  }
  const source = parsed as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of SYNCABLE_KEYS) {
    if (!(key in source)) continue;
    const value = source[key];
    if (!isSameType(value, DEFAULT_SETTINGS[key])) continue;
    result[key] = value;
  }
  return result as Partial<ClockSettings>;
}

/** FNV-1a: a short, stable stand-in for the payload so we don't keep a copy. */
export function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Displays a code as XXXX-XXXX; the stored form stays unseparated. */
export function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
