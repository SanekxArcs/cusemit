import React from 'react'

export interface TimerControls {
  remainingMs: number
  isRunning: boolean
  isExpired: boolean
  play: () => void
  pause: () => void
  reset: () => void
}

/**
 * Countdown timer hook.
 * @param initialMs – total milliseconds to count down from (recalculated when changed while not running)
 */
export function useTimer(initialMs: number): TimerControls {
  const [remainingMs, setRemainingMs] = React.useState(initialMs)
  const [isRunning, setIsRunning] = React.useState(false)
  const [isExpired, setIsExpired] = React.useState(false)

  // Refs so callbacks always see latest values without stale closure issues
  const remainingMsRef = React.useRef(initialMs)
  const endTimestampRef = React.useRef<number | null>(null)
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const initialMsRef = React.useRef(initialMs)
  const isRunningRef = React.useRef(false)

  // Keep refs in sync with state on every render
  remainingMsRef.current = remainingMs
  isRunningRef.current = isRunning

  // When initialMs changes from outside (settings change) reset if not running
  React.useEffect(() => {
    initialMsRef.current = initialMs
    if (!isRunningRef.current) {
      setRemainingMs(initialMs)
      setIsExpired(false)
      endTimestampRef.current = null
    }
  }, [initialMs])

  const clearTick = React.useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startTick = React.useCallback(() => {
    clearTick()
    intervalRef.current = setInterval(() => {
      if (endTimestampRef.current === null) return
      const remaining = Math.max(0, endTimestampRef.current - Date.now())
      setRemainingMs(remaining)
      if (remaining <= 0) {
        setIsRunning(false)
        setIsExpired(true)
        clearTick()
        endTimestampRef.current = null
      }
    }, 100)
  }, [clearTick])

  const play = React.useCallback(() => {
    const ms = remainingMsRef.current
    if (ms <= 0) return
    endTimestampRef.current = Date.now() + ms
    setIsRunning(true)
    setIsExpired(false)
    startTick()
  }, [startTick])

  const pause = React.useCallback(() => {
    clearTick()
    endTimestampRef.current = null
    setIsRunning(false)
  }, [clearTick])

  const reset = React.useCallback(() => {
    clearTick()
    endTimestampRef.current = null
    setIsRunning(false)
    setIsExpired(false)
    setRemainingMs(initialMsRef.current)
  }, [clearTick])

  // Cleanup on unmount
  React.useEffect(() => () => clearTick(), [clearTick])

  return { remainingMs, isRunning, isExpired, play, pause, reset }
}

/** Format milliseconds as HH:MM:SS */
export function formatMs(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
