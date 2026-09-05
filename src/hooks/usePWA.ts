import React from 'react';
import { toast } from 'sonner';

interface PWAHookState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  updateAvailable: boolean;
}

/**
 * usePWA hook for managing PWA functionality
 * - Detects installability
 * - Manages installation prompt
 * - Handles offline/online state
 * - Detects service worker updates
 */
export function usePWA(): PWAHookState & { installApp: () => Promise<void> } {
  const [state, setState] = React.useState<PWAHookState>({
    isInstallable: false,
    isInstalled: false,
    isOffline: false,
    updateAvailable: false,
  });

  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);

  // Listen for installation prompt
  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setState((prev) => ({ ...prev, isInstallable: true }));
    };

    const handleAppInstalled = () => {
      setState((prev) => ({
        ...prev,
        isInstalled: true,
        isInstallable: false,
      }));
      toast.success('App installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Listen for online/offline events
  React.useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOffline: false }));
      toast.success('Back online!');
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOffline: true }));
      toast('You are offline - app still works!', { duration: 3000 });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state
    setState((prev) => ({ ...prev, isOffline: !navigator.onLine }));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Offer an installed update without resetting a running timer unexpectedly.
  React.useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let alive = true;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    let reloadRequested = false;
    const offerUpdate = () => {
      if (!alive || !registration?.waiting) return;
      setState((prev) => ({ ...prev, updateAvailable: true }));
      toast('A clock update is ready. Reloading resets running timers.', {
        id: 'app-update',
        duration: Infinity,
        action: {
          label: 'Reload',
          onClick: () => {
            reloadRequested = true;
            registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
          },
        },
      });
    };
    const onStateChange = () => {
      if (installing?.state === 'installed') offerUpdate();
    };
    const onUpdateFound = () => {
      installing?.removeEventListener('statechange', onStateChange);
      installing = registration?.installing ?? null;
      installing?.addEventListener('statechange', onStateChange);
    };
    const onControllerChange = () => {
      if (reloadRequested) window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      onControllerChange
    );
    navigator.serviceWorker.ready
      .then((reg) => {
        if (!alive) return;
        registration = reg;
        offerUpdate();
        onUpdateFound();
        reg.addEventListener('updatefound', onUpdateFound);
      })
      .catch(() => {});
    const interval = setInterval(
      () => {
        if (!document.hidden && navigator.onLine)
          registration?.update().catch(() => {});
      },
      60 * 60 * 1000
    );
    return () => {
      alive = false;
      clearInterval(interval);
      registration?.removeEventListener('updatefound', onUpdateFound);
      installing?.removeEventListener('statechange', onStateChange);
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange
      );
    };
  }, []);
  const installApp = async () => {
    if (!deferredPrompt) {
      toast.error('Installation not available');
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setState((prev) => ({ ...prev, isInstallable: false }));
      }
    } catch (err) {
      console.error('Installation failed:', err);
      toast.error('Installation failed');
    }
  };

  return {
    ...state,
    installApp,
  };
}
