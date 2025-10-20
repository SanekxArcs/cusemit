import { create } from 'zustand'

export type BackgroundMode = 'solid' | 'gradient' | 'amoled'
export type ClockFormat = '24h' | '12h'
export type Orientation = 'default' | 'rotate90' | 'rotate270' | 'rotate180'

export interface ClockSettings {
  // Background
  backgroundMode: BackgroundMode;
  solidColor: string;
  gradientStart: string;
  gradientEnd: string;
  animatedGradient: boolean;

  // Clock appearance
  clockColor: string;
  fontFamily: string;
  customFontFamily: string;

  // Padding (rem values)
  paddingX: number;
  paddingY: number;

  // Display options
  showSeconds: boolean;
  clockFormat: ClockFormat;
  orientation: Orientation;

  // AMOLED Saver
  enableAMOLEDSaver: boolean;
}

const DEFAULT_SETTINGS: ClockSettings = {
  backgroundMode: 'amoled',
  solidColor: '#1a1a1a',
  gradientStart: '#1a1a1a',
  gradientEnd: '#2d2d2d',
  animatedGradient: false,
  clockColor: '#ffffff',
  fontFamily: 'Inter',
  customFontFamily: '',
  paddingX: 1,
  paddingY: 1,
  showSeconds: false,
  clockFormat: '24h',
  orientation: 'default',
  enableAMOLEDSaver: false,
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
        set({
          settings: {
            ...DEFAULT_SETTINGS,
            ...parsed,
            orientation: normalizeOrientation(parsed.orientation),
          },
        })
      } catch {
        // On parse error, keep defaults
        console.warn('Failed to parse stored settings, using defaults')
      }
    }
  },
}))
