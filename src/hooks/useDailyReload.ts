import React from 'react'

const RETRY_MS = 5 * 60 * 1000

function msUntilNextReload(hour: number): number {
  const now = new Date()
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

/**
 * Reloads the page once a day at a fixed quiet hour, so a long-running
 * display (open for days) picks up new deploys and clears any accumulated
 * drift/leaks from timers and intervals.
 *
 * Skips (and retries shortly after) if a countdown timer is currently
 * running, since runtime timer state isn't persisted and a reload would
 * silently reset it.
 */
export function useDailyReload(hour: number, hasActiveTimers: () => boolean): void {
  const hasActiveTimersRef = React.useRef(hasActiveTimers)
  hasActiveTimersRef.current = hasActiveTimers

  React.useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    const attempt = () => {
      if (hasActiveTimersRef.current()) {
        timeoutId = setTimeout(attempt, RETRY_MS)
        return
      }
      window.location.reload()
    }

    timeoutId = setTimeout(attempt, msUntilNextReload(hour))
    return () => clearTimeout(timeoutId)
  }, [hour])
}
