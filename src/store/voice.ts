import { create } from 'zustand';
import { VOICE_MODEL } from '@/lib/voiceTimer';

type VoiceState = {
  apiKey: string;
  verified: boolean;
  checking: boolean;
  error: string;
  holdToTalk: boolean;
  setKey: (apiKey: string, verified?: boolean) => void;
  checkKey: () => Promise<void>;
  setHoldToTalk: (value: boolean) => void;
};

const KEY_STORAGE = 'app.clock.voice.key.v1';
let request: AbortController | null = null;
function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  apiKey: readStorage(KEY_STORAGE),
  verified: false,
  checking: false,
  error: '',
  holdToTalk: readStorage('app.clock.voice.hold') === 'true',
  setKey: (value, verified = false) => {
    request?.abort();
    request = null;
    const apiKey = value.trim();
    try {
      if (apiKey) localStorage.setItem(KEY_STORAGE, apiKey);
      else localStorage.removeItem(KEY_STORAGE);
    } catch {}
    set({ apiKey, verified, checking: false, error: '' });
  },
  checkKey: async () => {
    const apiKey = get().apiKey;
    if (!apiKey || get().checking) return;
    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    set({ checking: true, error: '' });
    try {
      if (!navigator.onLine)
        throw new Error('Connect to the internet to check your key.');
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' +
          VOICE_MODEL,
        { headers: { 'x-goog-api-key': apiKey }, signal: controller.signal }
      );
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? 'Gemini quota reached. Wait and try again.'
            : 'Key check failed. Check your API key, restrictions and model access.'
        );
      const model = await response.json();
      if (!model.supportedGenerationMethods?.includes('generateContent'))
        throw new Error('This key cannot access the voice timer model.');
      if (request === controller && !controller.signal.aborted)
        set({ verified: true });
    } catch (failure) {
      if (request === controller)
        set({
          verified: false,
          error: controller.signal.aborted
            ? 'Key check timed out. Please try again.'
            : failure instanceof Error
              ? failure.message
              : 'Could not reach Gemini.',
        });
    } finally {
      clearTimeout(timeout);
      if (request === controller) {
        request = null;
        set({ checking: false });
      }
    }
  },
  setHoldToTalk: (holdToTalk) => {
    set({ holdToTalk });
    try {
      localStorage.setItem('app.clock.voice.hold', String(holdToTalk));
    } catch {}
  },
}));
