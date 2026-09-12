import { create } from 'zustand';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { useSettingsStore } from '@/store/settings';
import {
  fingerprint,
  normalizeCode,
  parseSyncable,
  serializeSyncable,
} from '@/lib/syncableSettings';

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;
export const isSyncConfigured = Boolean(CONVEX_URL);

// One-shot HTTP client rather than the reactive Convex client: sync only ever
// happens when you press a button, so the app should hold no open connection
// and poll for nothing.
let client: ConvexHttpClient | null = null;
function convex(): ConvexHttpClient {
  if (!CONVEX_URL) throw new Error('Sync is not configured for this build.');
  if (!client) client = new ConvexHttpClient(CONVEX_URL);
  return client;
}

export type SyncBusy = 'idle' | 'creating' | 'connecting' | 'pushing' | 'pulling';

interface SyncLink {
  code: string;
  /** Revision of the last upload or download this device took part in. */
  revision: number;
  /** Fingerprint of the settings at that moment, to spot local changes since. */
  fingerprint: string;
  syncedAt: number;
}

interface SyncStore {
  link: SyncLink | null;
  busy: SyncBusy;
  error: string | null;
  /** Set when the server refused an upload because another device pushed first. */
  conflict: boolean;
  createCode: () => Promise<void>;
  connect: (code: string) => Promise<void>;
  upload: (options?: { force?: boolean }) => Promise<void>;
  download: () => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
}

const STORAGE_KEY = 'app.clock.sync.v1';

function persist(link: SyncLink | null) {
  try {
    if (link === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(link));
  } catch {
    // A device that can't remember the code still syncs; you just retype it.
  }
}

function loadLink(): SyncLink | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (
      typeof parsed?.code !== 'string' ||
      typeof parsed?.revision !== 'number' ||
      typeof parsed?.fingerprint !== 'string'
    ) {
      return null;
    }
    return {
      code: parsed.code,
      revision: parsed.revision,
      fingerprint: parsed.fingerprint,
      syncedAt: typeof parsed.syncedAt === 'number' ? parsed.syncedAt : 0,
    };
  } catch {
    return null;
  }
}

function currentPayload(): string {
  return serializeSyncable(useSettingsStore.getState().settings);
}

function message(error: unknown): string {
  if (error instanceof Error && error.message) {
    // Convex wraps handler errors with server context; keep the last line,
    // which is the thrown message.
    const lines = error.message.trim().split('\n');
    const last = lines[lines.length - 1].trim();
    return last.replace(/^Uncaught Error:\s*/, '') || 'Sync failed.';
  }
  return 'Sync failed. Check your connection and try again.';
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  link: loadLink(),
  busy: 'idle',
  error: null,
  conflict: false,

  clearError: () => set({ error: null }),

  createCode: async () => {
    set({ busy: 'creating', error: null, conflict: false });
    try {
      const payload = currentPayload();
      const result = await convex().mutation(api.settings.create, { payload });
      const link: SyncLink = {
        code: result.code,
        revision: result.revision,
        fingerprint: fingerprint(payload),
        syncedAt: result.updatedAt,
      };
      persist(link);
      set({ link, busy: 'idle' });
    } catch (error) {
      set({ busy: 'idle', error: message(error) });
    }
  },

  /** Links to an existing code and immediately takes its settings. */
  connect: async (raw) => {
    const code = normalizeCode(raw);
    if (code.length !== 8) {
      set({ error: 'A sync code is 8 characters.' });
      return;
    }
    set({ busy: 'connecting', error: null, conflict: false });
    try {
      const remote = await convex().query(api.settings.pull, { code });
      if (remote === null) {
        set({ busy: 'idle', error: 'No settings found for that code.' });
        return;
      }
      applyRemote(remote.payload);
      const link: SyncLink = {
        code,
        revision: remote.revision,
        fingerprint: fingerprint(currentPayload()),
        syncedAt: remote.updatedAt,
      };
      persist(link);
      set({ link, busy: 'idle' });
    } catch (error) {
      set({ busy: 'idle', error: message(error) });
    }
  },

  upload: async (options) => {
    const link = get().link;
    if (!link) return;
    set({ busy: 'pushing', error: null });
    try {
      const payload = currentPayload();
      const result = await convex().mutation(api.settings.push, {
        code: link.code,
        payload,
        baseRevision: link.revision,
        force: options?.force ?? false,
      });
      if (result.status === 'missing') {
        set({
          busy: 'idle',
          error: 'This code no longer exists. Create a new one.',
        });
        return;
      }
      if (result.status === 'stale') {
        set({
          busy: 'idle',
          conflict: true,
          error:
            'Another device uploaded newer settings. Download them, or upload again to replace them.',
        });
        return;
      }
      const next: SyncLink = {
        code: link.code,
        revision: result.revision,
        fingerprint: fingerprint(payload),
        syncedAt: result.updatedAt,
      };
      persist(next);
      set({ link: next, busy: 'idle', conflict: false });
    } catch (error) {
      set({ busy: 'idle', error: message(error) });
    }
  },

  download: async () => {
    const link = get().link;
    if (!link) return;
    set({ busy: 'pulling', error: null });
    try {
      const remote = await convex().query(api.settings.pull, {
        code: link.code,
      });
      if (remote === null) {
        set({
          busy: 'idle',
          error: 'This code no longer exists. Create a new one.',
        });
        return;
      }
      applyRemote(remote.payload);
      const next: SyncLink = {
        code: link.code,
        revision: remote.revision,
        fingerprint: fingerprint(currentPayload()),
        syncedAt: remote.updatedAt,
      };
      persist(next);
      set({ link: next, busy: 'idle', conflict: false });
    } catch (error) {
      set({ busy: 'idle', error: message(error) });
    }
  },

  disconnect: () => {
    persist(null);
    set({ link: null, error: null, conflict: false });
  },
}));

function applyRemote(payload: string) {
  const updates = parseSyncable(payload);
  const store = useSettingsStore.getState();
  store.updateMultiple(updates);
  // updateMultiple debounces its write; downloaded settings should survive an
  // immediate reload, so write them out now.
  store.flushPersist();
}

/**
 * True when the syncable settings have changed since the last upload or
 * download — the only case where pressing Upload does anything.
 */
export function hasLocalChanges(link: SyncLink | null, payload: string): boolean {
  if (!link) return false;
  return fingerprint(payload) !== link.fingerprint;
}
