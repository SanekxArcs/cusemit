import { create } from 'zustand';

export type WakePhrase = 'Computer' | 'Hey Clock' | 'Hey Cusemit';
type WakeConfig = {
  accessKey: string;
  phrase: WakePhrase;
  keyword: string;
  keywordLabel: string;
  silenceMs: number;
};
type HandsFreeState = WakeConfig & {
  enabled: boolean;
  update: (patch: Partial<WakeConfig>) => void;
  setEnabled: (value: boolean) => void;
};
const STORAGE_KEY = 'app.clock.handsfree.v1';
const defaults: WakeConfig = {
  accessKey: '',
  phrase: 'Computer',
  keyword: '',
  keywordLabel: '',
  silenceMs: 1500,
};
function load(): WakeConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      accessKey: typeof saved.accessKey === 'string' ? saved.accessKey : '',
      phrase: ['Computer', 'Hey Clock', 'Hey Cusemit'].includes(saved.phrase)
        ? saved.phrase
        : 'Computer',
      keyword:
        typeof saved.keyword === 'string' && saved.keyword.length < 400000
          ? saved.keyword
          : '',
      keywordLabel:
        typeof saved.keywordLabel === 'string' ? saved.keywordLabel : '',
      silenceMs:
        typeof saved.silenceMs === 'number' && Number.isFinite(saved.silenceMs)
          ? Math.max(1000, Math.min(3000, saved.silenceMs))
          : 1500,
    };
  } catch {
    return defaults;
  }
}
export const useHandsFreeStore = create<HandsFreeState>((set, get) => ({
  ...load(),
  enabled: false,
  setEnabled: (enabled) => set({ enabled }),
  update: (patch) => {
    const current = get();
    const config: WakeConfig = {
      accessKey: patch.accessKey ?? current.accessKey,
      phrase: patch.phrase ?? current.phrase,
      keyword: patch.keyword ?? current.keyword,
      keywordLabel: patch.keywordLabel ?? current.keywordLabel,
      silenceMs: patch.silenceMs ?? current.silenceMs,
    };
    set({ ...config, enabled: false });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {}
  },
}));
