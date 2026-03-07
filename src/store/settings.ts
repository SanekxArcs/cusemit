import { create } from 'zustand'

export type BackgroundMode = 'solid' | 'gradient' | 'image'
export type ClockFormat = '24h' | '12h'
export type Orientation = 'default' | 'rotate90' | 'rotate270' | 'rotate180'

// ── Timer ─────────────────────────────────────────────────────────────────────

export interface TimerConfig {
  id: string
  label: string
  inputMode: 'duration' | 'datetime'
  hours: number
  minutes: number
  targetDatetime: string
  displayPosition: 'top' | 'bottom' | 'floating'
  floatX: number
  floatY: number
  floatScale: number
  floatRotation: number
  useClockFont: boolean
}

function makeTimerConfig(partial?: Partial<Omit<TimerConfig, 'id'>>): TimerConfig {
  return {
    id: `timer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: 'Timer',
    inputMode: 'duration',
    hours: 0,
    minutes: 5,
    targetDatetime: '',
    displayPosition: 'bottom',
    floatX: 50,
    floatY: 80,
    floatScale: 1,
    floatRotation: 0,
    useClockFont: false,
    ...partial,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export interface ClockSettings {
  // Background
  backgroundMode: BackgroundMode;
  solidColor: string;
  gradientStart: string;
  gradientEnd: string;
  bgGradientAngle: number;
  animatedGradient: boolean;
  backgroundImage: string;
  bgScale: number;
  bgOffsetX: number;
  bgOffsetY: number;

  // Clock appearance
  clockMode: 'solid' | 'gradient';
  clockColor: string;
  clockGradientStart: string;
  clockGradientEnd: string;
  clockGradientAngle: number;
  showStroke: boolean;
  strokeWidth: number;
  strokeColor: string;
  fontFamily: string;
  customFontFamily: string;
  fontWeight: number;

  // Scale & Position (used when clockFloating is false)
  scale: number;
  offsetX: number;
  offsetY: number;

  // Floating Clock
  clockFloating: boolean;
  clockFloatX: number;
  clockFloatY: number;
  clockFloatScale: number;
  clockFloatRotation: number;

  // Display options
  showSeconds: boolean;
  clockFormat: ClockFormat;
  orientation: Orientation;
  animationMode: 'slide-v' | 'slide-h' | 'fade' | 'zoom' | 'flip-v' | 'flip-h' | 'blur' | 'bounce' | 'rotate' | 'none';
  autoHideControls: boolean;
  ampmPosition: 'before' | 'after' | 'top' | 'bottom';
  pulseColon: boolean;

  // AMOLED Saver
  enableAMOLEDSaver: boolean;
  amoledSaverMode: 'drift' | 'mesh';
  amoledMeshType: 'pixel' | 'v-lines' | 'h-lines';

  // Saved Fonts
  savedFonts: string[];
  hiddenCuratedFonts: string[];

  // Custom Labels
  topText: string;
  bottomText: string;
  showTopText: boolean;
  showBottomText: boolean;

  // Typography
  tabularNums: boolean;
  tabularNumsFallback: boolean;

  // Timers (list)
  timers: TimerConfig[];
}

const DEFAULT_SETTINGS: ClockSettings = {
  backgroundMode: 'solid',
  solidColor: '#1a1a1a',
  gradientStart: '#1a1a1a',
  gradientEnd: '#2d2d2d',
  bgGradientAngle: 135,
  animatedGradient: false,
  backgroundImage: '',
  bgScale: 1.1,
  bgOffsetX: 50,
  bgOffsetY: 50,
  clockMode: 'solid',
  clockColor: '#ffffff',
  clockGradientStart: '#ffffff',
  clockGradientEnd: '#666666',
  clockGradientAngle: 135,
  showStroke: false,
  strokeWidth: 1,
  strokeColor: '#000000',
  fontFamily: 'Inter',
  customFontFamily: '',
  fontWeight: 700,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  clockFloating: false,
  clockFloatX: 50,
  clockFloatY: 50,
  clockFloatScale: 1,
  clockFloatRotation: 0,
  showSeconds: false,
  clockFormat: '24h',
  orientation: 'default',
  animationMode: 'slide-v',
  autoHideControls: true,
  ampmPosition: 'after',
  enableAMOLEDSaver: false,
  amoledSaverMode: 'drift',
  amoledMeshType: 'pixel',
  topText: '',
  bottomText: '',
  showTopText: false,
  showBottomText: false,
  tabularNums: true,
  tabularNumsFallback: false,
  pulseColon: true,
  savedFonts: [],
  hiddenCuratedFonts: [],
  timers: [],
};

const normalizeOrientation = (value: unknown): Orientation => {
  if (value === 'rotate90' || value === 'rotate270' || value === 'rotate180') {
    return value as Orientation
  }

  switch (value) {
    case 'default':
    case 'auto':
    case 'portrait':
      return 'default'
    case 'landscape':
      return 'rotate90'
    case 'portrait-secondary':
      return 'rotate180'
    case 'landscape-secondary':
      return 'rotate270'
    default:
      return 'default'
  }
}

interface SettingsStore {
  settings: ClockSettings
  updateSetting: <K extends keyof ClockSettings>(
    key: K,
    value: ClockSettings[K]
  ) => void
  updateMultiple: (updates: Partial<ClockSettings>) => void
  resetToDefaults: () => void
  loadSettings: () => void
  addSavedFont: (font: string) => void
  removeSavedFont: (font: string) => void
  hideCuratedFont: (fontValue: string) => void
  resetHiddenFonts: () => void
  // Timer CRUD
  addTimer: (partial?: Partial<Omit<TimerConfig, 'id'>>) => void
  removeTimer: (id: string) => void
  updateTimer: (id: string, updates: Partial<TimerConfig>) => void
}

const STORAGE_KEY = 'app.clock.settings.v1'

/**
 * Zustand store with localStorage persistence for clock settings.
 */
export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,

  updateSetting: (key, value) => {
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    }))
    // Debounce persistence to avoid excessive writes
    setTimeout(() => {
      const state = get()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings))
    }, 500)
  },

  updateMultiple: (updates) => {
    set((state) => ({
      settings: { ...state.settings, ...updates },
    }))
    setTimeout(() => {
      const state = get()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings))
    }, 500)
  },

  resetToDefaults: () => {
    set({ settings: DEFAULT_SETTINGS })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS))
  },

  loadSettings: () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)

        // Migration: convert old single-timer fields to timers array
        let migratedTimers: TimerConfig[] = parsed.timers ?? []
        if (!parsed.timers && parsed.timerEnabled) {
          migratedTimers = [makeTimerConfig({
            label: 'Timer',
            inputMode: parsed.timerInputMode ?? 'duration',
            hours: parsed.timerHours ?? 0,
            minutes: parsed.timerMinutes ?? 5,
            targetDatetime: parsed.timerTargetDatetime ?? '',
            displayPosition: parsed.timerDisplayPosition ?? 'bottom',
            floatX: parsed.timerFloatX ?? 50,
            floatY: parsed.timerFloatY ?? 80,
            floatScale: parsed.timerFloatScale ?? 1,
            floatRotation: parsed.timerFloatRotation ?? 0,
            useClockFont: false,
          })]
        }

        set({
          settings: {
            ...DEFAULT_SETTINGS,
            ...parsed,
            timers: migratedTimers,
            orientation: normalizeOrientation(parsed.orientation),
          },
        })
      } catch {
        // On parse error, keep defaults
        console.warn('Failed to parse stored settings, using defaults')
      }
    }
  },

  addSavedFont: (font) => {
    const { settings } = get()
    if (!settings.savedFonts.includes(font)) {
      const newSavedFonts = [...settings.savedFonts, font]
      set((state) => ({
        settings: { ...state.settings, savedFonts: newSavedFonts },
      }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, savedFonts: newSavedFonts }))
    }
  },

  removeSavedFont: (font) => {
    const { settings } = get();
    const newSavedFonts = settings.savedFonts.filter((f) => f !== font);
    set((state) => ({
      settings: { ...state.settings, savedFonts: newSavedFonts },
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, savedFonts: newSavedFonts }));
  },

  hideCuratedFont: (fontValue: string) => {
    const { settings } = get();
    if (!settings.hiddenCuratedFonts.includes(fontValue)) {
      const newHidden = [...settings.hiddenCuratedFonts, fontValue];
      set((state) => ({
        settings: { ...state.settings, hiddenCuratedFonts: newHidden },
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get().settings, hiddenCuratedFonts: newHidden }));
    }
  },

  resetHiddenFonts: () => {
    const { settings } = get();
    set((state) => ({
      settings: { ...state.settings, hiddenCuratedFonts: [] },
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, hiddenCuratedFonts: [] }));
  },

  addTimer: (partial) => {
    const { settings } = get()
    const newTimer = makeTimerConfig(partial)
    const newTimers = [...settings.timers, newTimer]
    set((state) => ({ settings: { ...state.settings, timers: newTimers } }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get().settings, timers: newTimers }))
  },

  removeTimer: (id) => {
    const { settings } = get()
    const newTimers = settings.timers.filter((t) => t.id !== id)
    set((state) => ({ settings: { ...state.settings, timers: newTimers } }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get().settings, timers: newTimers }))
  },

  updateTimer: (id, updates) => {
    const { settings } = get()
    const newTimers = settings.timers.map((t) => t.id === id ? { ...t, ...updates } : t)
    set((state) => ({ settings: { ...state.settings, timers: newTimers } }))
    // Debounced write: updateTimer is called on every keystroke in label/duration inputs,
    // so we defer the localStorage write to avoid excessive writes during rapid changes.
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(get().settings))
    }, 300)
  },
}))
