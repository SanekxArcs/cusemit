import React from 'react';

const RELEASE_RETRY_MS = 1000;
const DENIED_RETRY_MS = 30000;

export function useWakeLock(enabled = true): void {
  React.useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let disposed = false;
    let suspended = false;
    let pending = false;
    let lock: WakeLockSentinel | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const clearRetry = () => {
      if (retry !== null) clearTimeout(retry);
      retry = null;
    };
    const schedule = (delay: number) => {
      if (disposed || suspended || document.hidden || retry !== null) return;
      retry = setTimeout(() => {
        retry = null;
        void acquire();
      }, delay);
    };
    const onRelease = () => {
      lock = null;
      schedule(RELEASE_RETRY_MS);
    };
    const release = () => {
      const current = lock;
      lock = null;
      current?.removeEventListener('release', onRelease);
      current?.release().catch(() => {});
    };
    async function acquire() {
      if (disposed || suspended || pending || lock || document.hidden) return;
      clearRetry();
      pending = true;
      try {
        const acquired = await navigator.wakeLock.request('screen');
        if (disposed || suspended || document.hidden) {
          acquired.release().catch(() => {});
          return;
        }
        if (acquired.released) {
          schedule(RELEASE_RETRY_MS);
          return;
        }
        lock = acquired;
        acquired.addEventListener('release', onRelease, { once: true });
      } catch {
        schedule(DENIED_RETRY_MS);
      } finally {
        pending = false;
      }
    }
    const onSuspend = () => {
      suspended = true;
      clearRetry();
      release();
    };
    const onResume = () => {
      suspended = false;
      void acquire();
    };
    const onVisibility = () => {
      if (document.hidden) onSuspend();
      else onResume();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('freeze', onSuspend);
    document.addEventListener('resume', onResume);
    window.addEventListener('pagehide', onSuspend);
    window.addEventListener('pageshow', onResume);
    window.addEventListener('focus', onResume);
    return () => {
      disposed = true;
      clearRetry();
      release();
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('freeze', onSuspend);
      document.removeEventListener('resume', onResume);
      window.removeEventListener('pagehide', onSuspend);
      window.removeEventListener('pageshow', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, [enabled]);
}
