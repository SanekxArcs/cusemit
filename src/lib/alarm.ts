// ── Timer alarm sounds ────────────────────────────────────────────────────────
//
// Built-in sounds are synthesised with Web Audio so they cost nothing to ship.
// Custom sounds are audio files the user picked; they live in IndexedDB keyed
// by timer id, because a few MB of base64 would bloat every settings write.

export type AlarmSound = 'none' | 'beep' | 'chime' | 'bell' | 'digital' | 'custom';

export const ALARM_SOUND_OPTIONS: { value: AlarmSound; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'beep', label: 'Beep' },
  { value: 'chime', label: 'Chime' },
  { value: 'bell', label: 'Bell' },
  { value: 'digital', label: 'Digital' },
  { value: 'custom', label: 'Custom' },
];

export const MAX_CUSTOM_SOUND_BYTES = 5 * 1024 * 1024;

interface Note {
  /** Seconds from the start of the pattern. */
  at: number;
  freq: number;
  duration: number;
  type: OscillatorType;
  volume: number;
}

interface Pattern {
  /** Seconds before the pattern repeats. */
  period: number;
  notes: Note[];
}

const PATTERNS: Record<Exclude<AlarmSound, 'none' | 'custom'>, Pattern> = {
  beep: {
    period: 1.4,
    notes: [0, 0.18, 0.36, 0.54].map((at) => ({
      at, freq: 880, duration: 0.1, type: 'square' as const, volume: 0.18,
    })),
  },
  chime: {
    period: 1.8,
    notes: [
      { at: 0, freq: 659.25, duration: 0.9, type: 'sine', volume: 0.45 },
      { at: 0.35, freq: 880, duration: 1.2, type: 'sine', volume: 0.45 },
    ],
  },
  bell: {
    period: 2.2,
    notes: [
      { at: 0, freq: 523.25, duration: 2, type: 'sine', volume: 0.45 },
      { at: 0, freq: 1046.5, duration: 1.2, type: 'sine', volume: 0.18 },
      { at: 0, freq: 1567.98, duration: 0.6, type: 'sine', volume: 0.08 },
    ],
  },
  digital: {
    period: 0.9,
    notes: [
      { at: 0, freq: 1000, duration: 0.08, type: 'square', volume: 0.15 },
      { at: 0.1, freq: 1500, duration: 0.08, type: 'square', volume: 0.15 },
      { at: 0.2, freq: 1000, duration: 0.08, type: 'square', volume: 0.15 },
      { at: 0.3, freq: 1500, duration: 0.08, type: 'square', volume: 0.15 },
    ],
  },
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioContext = new Ctor();
  return audioContext;
}

/**
 * Browsers only let audio start after a user gesture. Call this from one so a
 * timer that ends later, while nobody is touching the screen, can still ring.
 */
export function primeAlarmAudio(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

function playNote(ctx: AudioContext, note: Note, start: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = note.type;
  osc.frequency.value = note.freq;
  const t = start + note.at;
  // Short attack and exponential release: no clicks, and bells ring out.
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(note.volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + note.duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + note.duration + 0.05);
}

/**
 * Starts a sound that loops until the returned function is called.
 * A custom sound that cannot play (missing or undecodable) falls back to Beep.
 */
export function startAlarm(sound: AlarmSound, customBlob?: Blob | null): () => void {
  if (sound === 'none') return () => {};

  if (sound === 'custom') {
    if (!customBlob) return startAlarm('beep');
    const url = URL.createObjectURL(customBlob);
    const audio = new Audio(url);
    audio.loop = true;
    let fallbackStop: (() => void) | null = null;
    let stopped = false;
    audio.play().catch(() => {
      if (!stopped) fallbackStop = startAlarm('beep');
    });
    return () => {
      stopped = true;
      audio.pause();
      URL.revokeObjectURL(url);
      fallbackStop?.();
    };
  }

  const ctx = getAudioContext();
  if (!ctx) return () => {};
  if (ctx.state === 'suspended') void ctx.resume();
  const pattern = PATTERNS[sound];
  const schedule = () => {
    const start = ctx.currentTime + 0.05;
    for (const note of pattern.notes) playNote(ctx, note, start);
  };
  schedule();
  const interval = setInterval(schedule, pattern.period * 1000);
  return () => clearInterval(interval);
}

// ── Custom sound storage (IndexedDB) ──────────────────────────────────────────

const DB_NAME = 'clock-alarm-sounds';
const STORE = 'sounds';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export function saveCustomSound(timerId: string, blob: Blob): Promise<IDBValidKey> {
  return withStore('readwrite', (s) => s.put(blob, timerId));
}

export async function loadCustomSound(timerId: string): Promise<Blob | null> {
  try {
    return (await withStore<Blob | undefined>('readonly', (s) => s.get(timerId))) ?? null;
  } catch {
    return null;
  }
}

export async function deleteCustomSound(timerId: string): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.delete(timerId));
  } catch {
    // Nothing stored, or storage unavailable: nothing to clean up.
  }
}
