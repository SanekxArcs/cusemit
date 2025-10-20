import React from 'react'
import { toast } from 'sonner'

interface PWAHookState {
  isInstallable: boolean
  isInstalled: boolean
  isOffline: boolean
  updateAvailable: boolean
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
  })

  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null)

  // Listen for installation prompt
  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setState((prev) => ({ ...prev, isInstallable: true }))
    }

    const handleAppInstalled = () => {
      setState((prev) => ({ ...prev, isInstalled: true, isInstallable: false }))
      toast.success('App installed successfully!')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // Listen for online/offline events
  React.useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOffline: false }))
      toast.success('Back online!')
    }

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOffline: true }))
      toast('You are offline - app still works!', { duration: 3000 })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Set initial state
    setState((prev) => ({ ...prev, isOffline: !navigator.onLine }))

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Listen for service worker updates
  React.useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        toast.success('App updated to latest version!')
      })

      // Check for updates periodically
      const interval = setInterval(() => {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.update()
          })
        })
      }, 60000) // Check every minute

      return () => clearInterval(interval)
    }
  }, [])

  const installApp = async () => {
    if (!deferredPrompt) {
      toast.error('Installation not available')
      return
    }

    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setState((prev) => ({ ...prev, isInstallable: false }))
      }
    } catch (err) {
      console.error('Installation failed:', err)
      toast.error('Installation failed')
    }
  }

  return {
    ...state,
    installApp,
  }
}
