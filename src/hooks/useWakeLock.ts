import React from 'react'

/**
 * Keeps the screen awake (no dimming/lock) while the app is open and visible.
 * The Wake Lock API auto-releases when the tab is hidden, so we re-acquire it
 * whenever the page becomes visible again.
 */
export function useWakeLock(enabled: boolean = true): void {
  const lockRef = React.useRef<WakeLockSentinel | null>(null)

  React.useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return

    let cancelled = false

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          lock.release().catch(() => {})
          return
        }
        lockRef.current = lock
        lock.addEventListener('release', () => {
          if (lockRef.current === lock) lockRef.current = null
        })
      } catch {
        // Wake lock request denied (e.g. low battery) — ignore, no fallback needed
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !lockRef.current) {
        acquire()
      }
    }

    acquire()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      lockRef.current?.release().catch(() => {})
      lockRef.current = null
    }
  }, [enabled])
}
