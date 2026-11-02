import { create } from 'zustand';

export type WakePhrase = 'Computer' | 'Hey Clock' | 'Hey Cusemit';
type WakeConfig = {
  phrase: WakePhrase;
  silenceMs: number;
};
type HandsFreeState = WakeConfig & {
  enabled: boolean;
  update: (patch: Partial<WakeConfig>) => void;
  setEnabled: (value: boolean) => void;
};
const STORAGE_KEY = 'app.clock.handsfree.v2';
const LEGACY_KEY = 'app.clock.handsfree.v1';
const defaults: WakeConfig = { phrase: 'Hey Clock', silenceMs: 1500 };
function load(): WakeConfig {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem(LEGACY_KEY) ||
        '{}'
    );
    const config: WakeConfig = {
      phrase: ['Computer', 'Hey Clock', 'Hey Cusemit'].includes(saved.phrase)
        ? saved.phrase : defaults.phrase,
      silenceMs: typeof saved.silenceMs === 'number' && Number.isFinite(saved.silenceMs)
        ? Math.max(1000, Math.min(3000, saved.silenceMs)) : 1500,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return config;
  } catch {
    return defaults;
  } finally {
    try { localStorage.removeItem(LEGACY_KEY); } catch {}
  }
}
export const useHandsFreeStore = create<HandsFreeState>((set, get) => ({
  ...load(),
  enabled: false,
  setEnabled: (enabled) => set({ enabled }),
  update: (patch) => {
    const current = get();
    const config: WakeConfig = {
      phrase: patch.phrase ?? current.phrase,
      silenceMs: patch.silenceMs ?? current.silenceMs,
    };
    set({ ...config, enabled: false });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch {}
  },
}));
