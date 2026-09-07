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
 *
 * @param configs  Array of timer configurations from the store.
 * @param onExpire Called with the timer id when a timer first reaches 0.
 */
export function useTimerArray(
  configs: TimerConfig[],
  onExpire?: (id: string) => void,
): Record<string, TimerControls> {
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
  const onExpireRef = React.useRef(onExpire)
  configsRef.current = configs
  statesRef.current = states
  onExpireRef.current = onExpire

  // Track which timer ids have already triggered onExpire (cleared on reset/play)
  const firedExpireRef = React.useRef<Set<string>>(new Set())

  // Derived key that changes whenever config IDs or meaningful values change
  const configsKey = configs
    .map((c) => `${c.id}:${c.inputMode}:${c.hours}:${c.minutes}:${c.targetDatetime}`)
    .join('|')
  const previousConfigsRef = React.useRef(configs)

  // Sync state when timer configs change (add / remove / modify settings)
  React.useEffect(() => {
    const previousConfigs = new Map(previousConfigsRef.current.map((c) => [c.id, c]))
    previousConfigsRef.current = configs

    // Forget expire bookkeeping for timers that no longer exist (e.g. auto-deleted)
    const liveIds = new Set(configs.map((c) => c.id))
    for (const id of firedExpireRef.current) {
      if (!liveIds.has(id)) firedExpireRef.current.delete(id)
    }
    setStates((prev) => {
      const next: Record<string, TimerState> = {}
      const newIds = new Set(configs.map((c) => c.id))

      for (const c of configs) {
        const existing = prev[c.id]
        const previous = previousConfigs.get(c.id)
        const durationChanged = !previous || previous.inputMode !== c.inputMode ||
          previous.hours !== c.hours || previous.minutes !== c.minutes

        if (c.inputMode === 'datetime') {
          endTimestampsRef.current[c.id] = null
          const ms = calcDatetimeMs(c)
          next[c.id] = { remainingMs: ms, isRunning: ms > 0, isExpired: isDatetimeExpired(c) }
        } else if (!existing || durationChanged) {
          // Editing this timer prepares the entered duration immediately.
          // Other timers and cosmetic edits must keep their current progress.
          const ms = calcDurationMs(c)
          next[c.id] = { remainingMs: ms, isRunning: false, isExpired: false }
          endTimestampsRef.current[c.id] = null
        } else {
          next[c.id] = existing
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
      const newlyExpired: string[] = []

      for (const c of currentConfigs) {
        const state = currentStates[c.id]
        if (!state) continue

        if (c.inputMode === 'datetime' && c.targetDatetime) {
          const ms = calcDatetimeMs(c)
          const isExpired = ms <= 0
          updates[c.id] = { remainingMs: ms, isRunning: !isExpired, isExpired }
          if (isExpired && !firedExpireRef.current.has(c.id)) newlyExpired.push(c.id)
          hasChanges = true
        } else if (state.isRunning) {
          const endTs = endTimestampsRef.current[c.id]
          if (endTs != null) {
            const ms = Math.max(0, endTs - Date.now())
            const isExpired = ms <= 0
            updates[c.id] = { remainingMs: ms, isRunning: !isExpired, isExpired }
            if (isExpired) {
              endTimestampsRef.current[c.id] = null
              if (!firedExpireRef.current.has(c.id)) newlyExpired.push(c.id)
            }
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

      // Fire onExpire callbacks after state is queued (avoid calling inside setState)
      if (newlyExpired.length > 0 && onExpireRef.current) {
        for (const id of newlyExpired) {
          firedExpireRef.current.add(id)
          onExpireRef.current(id)
        }
      }
    }, 200)

    return () => clearInterval(interval)
  }, []) // runs once; uses refs for fresh data

  // Stable closures per timer id – created once, never recreated on re-render
  const stableControlsRef = React.useRef<Record<string, { play: () => void; pause: () => void; reset: () => void }>>({})

  for (const config of configs) {
    const id = config.id
    if (!stableControlsRef.current[id]) {
      stableControlsRef.current[id] = {
        play() {
          const s = statesRef.current[id]
          const cfg = configsRef.current.find((c) => c.id === id)
          if (!s || s.isRunning || !cfg || cfg.inputMode !== 'duration') return
          const ms = s.isExpired || s.remainingMs <= 0 ? calcDurationMs(cfg) : s.remainingMs
          if (ms <= 0) return
          firedExpireRef.current.delete(id)
          endTimestampsRef.current[id] = Date.now() + ms
          setStates((prev) => ({ ...prev, [id]: { remainingMs: ms, isRunning: true, isExpired: false } }))
        },
        pause() {
          endTimestampsRef.current[id] = null
          setStates((prev) => ({ ...prev, [id]: { ...prev[id], isRunning: false } }))
        },
        reset() {
          endTimestampsRef.current[id] = null
          firedExpireRef.current.delete(id)
          const cfg = configsRef.current.find((c) => c.id === id)
          if (!cfg) return
          const ms = calcDurationMs(cfg)
          setStates((prev) => ({ ...prev, [id]: { remainingMs: ms, isRunning: false, isExpired: false } }))
        },
      }
    }
  }

  // Clean up closures for removed timers
  const currentIds = new Set(configs.map((c) => c.id))
  for (const id in stableControlsRef.current) {
    if (!currentIds.has(id)) delete stableControlsRef.current[id]
  }

  // Combine current state with stable closures
  const result: Record<string, TimerControls> = {}
  for (const config of configs) {
    const state = states[config.id] ?? { remainingMs: 0, isRunning: false, isExpired: false }
    result[config.id] = { ...state, ...stableControlsRef.current[config.id] }
  }

  return result
}

/** Format milliseconds as HH:MM:SS (or HH:MM when showSeconds is false) */
export function formatMs(ms: number, showSeconds = true): string {
  if (ms <= 0) return showSeconds ? '00:00:00' : '00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const base = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  return showSeconds ? `${base}:${s.toString().padStart(2, '0')}` : base
}
