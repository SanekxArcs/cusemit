import React from 'react'
import type { TimerConfig } from '@/store/settings'

export interface TimerState {
  remainingMs: number
  isRunning: boolean
  isExpired: boolean
}

export interface TimerControls extends TimerState {
  play: () => void
  pause: () => void
  reset: () => void
}

function calcDurationMs(config: TimerConfig): number {
  return (config.hours * 3600 + config.minutes * 60) * 1000
}

function calcDatetimeMs(config: TimerConfig): number {
  if (!config.targetDatetime) return 0
  return Math.max(0, new Date(config.targetDatetime).getTime() - Date.now())
}

function isDatetimeExpired(config: TimerConfig): boolean {
  return !!config.targetDatetime && calcDatetimeMs(config) <= 0
}

/**
 * Manages runtime countdown state for an array of TimerConfigs.
 *
 * - datetime timers: always auto-running (remaining = targetDatetime - now)
 * - duration timers: manually play/pause/reset
 *
 * Returns a Record<timerId, TimerControls> so callers can look up by id.
 */
export function useTimerArray(configs: TimerConfig[]): Record<string, TimerControls> {
  const [states, setStates] = React.useState<Record<string, TimerState>>(() => {
    const init: Record<string, TimerState> = {}
    for (const c of configs) {
      if (c.inputMode === 'datetime') {
        const ms = calcDatetimeMs(c)
        init[c.id] = { remainingMs: ms, isRunning: ms > 0, isExpired: isDatetimeExpired(c) }
      } else {
        const ms = calcDurationMs(c)
        init[c.id] = { remainingMs: ms, isRunning: false, isExpired: false }
      }
    }
    return init
  })

  // endTimestamps: absolute Date.now() value when a duration timer expires
  const endTimestampsRef = React.useRef<Record<string, number | null>>({})

  // Stable refs used inside the interval to avoid stale closures
  const configsRef = React.useRef(configs)
  const statesRef = React.useRef(states)
  configsRef.current = configs
  statesRef.current = states

  // Derived key that changes whenever config IDs or meaningful values change
  const configsKey = configs
    .map((c) => `${c.id}:${c.inputMode}:${c.hours}:${c.minutes}:${c.targetDatetime}`)
    .join('|')

  // Sync state when timer configs change (add / remove / modify settings)
  React.useEffect(() => {
    setStates((prev) => {
      const next: Record<string, TimerState> = {}
      const newIds = new Set(configs.map((c) => c.id))

      for (const c of configs) {
        const existing = prev[c.id]

        if (c.inputMode === 'datetime') {
          const ms = calcDatetimeMs(c)
          next[c.id] = { remainingMs: ms, isRunning: ms > 0, isExpired: isDatetimeExpired(c) }
        } else if (existing?.isRunning) {
          // Keep running state for active duration timers
          next[c.id] = existing
        } else {
          // New timer or paused timer – reset to initial duration
          const ms = calcDurationMs(c)
          next[c.id] = { remainingMs: ms, isRunning: false, isExpired: false }
          endTimestampsRef.current[c.id] = null
        }
      }

      // Clean up removed timers
      for (const id in endTimestampsRef.current) {
        if (!newIds.has(id)) delete endTimestampsRef.current[id]
      }

      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configsKey])

  // Single tick interval – updates all running timers at once
  // 200ms tick: smooth enough for HH:MM:SS display (sub-second changes visible)
  // while keeping CPU overhead low (vs 100ms)
  React.useEffect(() => {
    const interval = setInterval(() => {
      const currentConfigs = configsRef.current
      const currentStates = statesRef.current
      const updates: Record<string, TimerState> = {}
      let hasChanges = false

      for (const c of currentConfigs) {
        const state = currentStates[c.id]
        if (!state) continue

        if (c.inputMode === 'datetime' && c.targetDatetime) {
          const ms = calcDatetimeMs(c)
          const isExpired = ms <= 0
          updates[c.id] = { remainingMs: ms, isRunning: !isExpired, isExpired }
          hasChanges = true
        } else if (state.isRunning) {
          const endTs = endTimestampsRef.current[c.id]
          if (endTs !== null) {
            const ms = Math.max(0, endTs - Date.now())
            const isExpired = ms <= 0
            updates[c.id] = { remainingMs: ms, isRunning: !isExpired, isExpired }
            if (isExpired) endTimestampsRef.current[c.id] = null
            hasChanges = true
          }
        }
      }

      if (hasChanges) {
        setStates((prev) => {
          const next = { ...prev }
          for (const id in updates) {
            if (prev[id]) next[id] = updates[id]
          }
          return next
        })
      }
    }, 200)

    return () => clearInterval(interval)
  }, []) // runs once; uses refs for fresh data

  // Build controls per timer
  const result: Record<string, TimerControls> = {}

  for (const config of configs) {
    const state = states[config.id] ?? { remainingMs: 0, isRunning: false, isExpired: false }
    const id = config.id

    result[id] = {
      ...state,
      play() {
        const s = statesRef.current[id]
        if (!s || s.isRunning || s.isExpired || s.remainingMs <= 0) return
        endTimestampsRef.current[id] = Date.now() + s.remainingMs
        setStates((prev) => ({ ...prev, [id]: { ...prev[id], isRunning: true } }))
      },
      pause() {
        endTimestampsRef.current[id] = null
        setStates((prev) => ({ ...prev, [id]: { ...prev[id], isRunning: false } }))
      },
      reset() {
        endTimestampsRef.current[id] = null
        const cfg = configsRef.current.find((c) => c.id === id)
        if (!cfg) return
        const ms = calcDurationMs(cfg)
        setStates((prev) => ({ ...prev, [id]: { remainingMs: ms, isRunning: false, isExpired: false } }))
      },
    }
  }

  return result
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
