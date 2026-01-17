import { create } from 'zustand'

export type BackgroundMode = 'solid' | 'gradient' | 'image'
export type ClockFormat = '24h' | '12h'
export type Orientation = 'default' | 'rotate90' | 'rotate270' | 'rotate180'

export interface ClockSettings {
  // Background
  backgroundMode: BackgroundMode;
  solidColor: string;
  gradientStart: string;
  gradientEnd: string;
  animatedGradient: boolean;
  backgroundImage: string;
  bgScale: number;
  bgOffsetX: number;
  bgOffsetY: number;

  // Clock appearance
  clockColor: string;
  fontFamily: string;
  customFontFamily: string;
  fontWeight: number;

  // Scale & Position
  scale: number;
  offsetX: number;
  offsetY: number;

  // Display options
  showSeconds: boolean;
  clockFormat: ClockFormat;
  orientation: Orientation;
  animationMode: 'slide-v' | 'slide-h' | 'fade' | 'zoom' | 'flip-v' | 'flip-h' | 'blur' | 'bounce' | 'rotate' | 'none';
  autoHideControls: boolean;
  ampmPosition: 'before' | 'after' | 'top' | 'bottom';

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
}

const DEFAULT_SETTINGS: ClockSettings = {
  backgroundMode: 'solid',
  solidColor: '#1a1a1a',
  gradientStart: '#1a1a1a',
  gradientEnd: '#2d2d2d',
  animatedGradient: false,
  backgroundImage: '',
  bgScale: 1.1,
  bgOffsetX: 50,
  bgOffsetY: 50,
  clockColor: '#ffffff',
  fontFamily: 'Inter',
  customFontFamily: '',
  fontWeight: 700,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
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
  savedFonts: [],
  hiddenCuratedFonts: [],
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
}))
