import { create } from 'zustand';

type VoiceState = {
  apiKey: string;
  verified: boolean;
  holdToTalk: boolean;
  setKey: (apiKey: string, verified?: boolean) => void;
  setHoldToTalk: (value: boolean) => void;
};

export const useVoiceStore = create<VoiceState>((set) => ({
  apiKey: '',
  verified: false,
  holdToTalk: (() => {
    try {
      return localStorage.getItem('app.clock.voice.hold') === 'true';
    } catch {
      return false;
    }
  })(),
  setKey: (apiKey, verified = false) => set({ apiKey, verified }),
  setHoldToTalk: (holdToTalk) => {
    set({ holdToTalk });
    try {
      localStorage.setItem('app.clock.voice.hold', String(holdToTalk));
    } catch {}
  },
}));
