import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/cn'
import { useSettingsStore } from '@/store/settings'
import { prefersReducedMotion } from '@/lib/amoledSaver'
import type { TimerControls } from '@/hooks/useTimerArray'
import { formatMs } from '@/hooks/useTimerArray'

interface TimerSheetProps {
  isOpen: boolean
  onClose: () => void
  timerControls: Record<string, TimerControls>
}

export const TimerSheet: React.FC<TimerSheetProps> = ({
  isOpen,
  onClose,
  timerControls,
}) => {
  const { settings, addTimer, removeTimer, updateTimer } = useSettingsStore()
  const reducedMotion = prefersReducedMotion()

  const sheetVariants = {
    hidden: reducedMotion ? { opacity: 0 } : { x: '100%', opacity: 0 },
    visible: reducedMotion
      ? { opacity: 1 }
      : { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
    exit: reducedMotion
      ? { opacity: 0 }
      : { x: '100%', opacity: 0, transition: { duration: 0.2 } },
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          <motion.div
            className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-neutral-900 border-l border-neutral-800 shadow-lg z-50 flex flex-col"
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-semibold text-white">Timers</h2>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-neutral-800 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Close timers"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {settings.timers.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-6">No timers yet. Add one below.</p>
              )}

              {settings.timers.map((timer) => {
                const ctrl = timerControls[timer.id]
                const isDuration = timer.inputMode === 'duration'
                const remainingDisplay = ctrl ? formatMs(ctrl.remainingMs) : '00:00:00'
                const isExpired = ctrl?.isExpired ?? false
                const isRunning = ctrl?.isRunning ?? false

                return (
                  <div key={timer.id} className="border border-neutral-800 rounded-lg overflow-hidden">
                    {/* Timer header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/50">
                      <input
                        type="text"
                        value={timer.label}
                        onChange={(e) => updateTimer(timer.id, { label: e.target.value })}
                        className="flex-1 bg-transparent text-sm text-white focus:outline-none min-w-0"
                        placeholder="Timer name"
                      />
                      <span
                        className={cn(
                          'text-xs font-mono tabular-nums shrink-0',
                          isExpired ? 'text-red-400 animate-pulse' : 'text-gray-400',
                        )}
                      >
                        {remainingDisplay}
                      </span>
                      <button
                        onClick={() => removeTimer(timer.id)}
                        className="shrink-0 text-gray-600 hover:text-red-400 transition-colors p-0.5"
                        aria-label="Delete timer"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                      </button>
                    </div>

                    {/* Timer body */}
                    <div className="p-3 space-y-3">
                      {/* Input mode */}
                      <div className="flex gap-2">
                        {(['duration', 'datetime'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => updateTimer(timer.id, { inputMode: mode })}
                            className={cn(
                              'flex-1 py-1 rounded text-xs font-medium transition-all',
                              timer.inputMode === mode
                                ? 'bg-blue-600 text-white'
                                : 'bg-neutral-800 text-gray-400 hover:text-gray-200',
                            )}
                          >
                            {mode === 'duration' ? 'Duration' : 'Date & Time'}
                          </button>
                        ))}
                      </div>

                      {/* Duration inputs */}
                      {isDuration && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <input
                              type="number"
                              min="0"
                              max="99"
                              value={timer.hours}
                              onChange={(e) =>
                                updateTimer(timer.id, {
                                  hours: Math.max(0, Math.min(99, parseInt(e.target.value) || 0)),
                                })
                              }
                              className="w-full px-2 py-1.5 rounded bg-neutral-800 text-white text-sm text-center border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <p className="text-[10px] text-center text-gray-500 mt-0.5">hours</p>
                          </div>
                          <span className="text-gray-500 text-base font-bold pb-3">:</span>
                          <div className="flex-1">
                            <input
                              type="number"
                              min="0"
                              max="59"
                              value={timer.minutes}
                              onChange={(e) =>
                                updateTimer(timer.id, {
                                  minutes: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)),
                                })
                              }
                              className="w-full px-2 py-1.5 rounded bg-neutral-800 text-white text-sm text-center border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <p className="text-[10px] text-center text-gray-500 mt-0.5">minutes</p>
                          </div>
                        </div>
                      )}

                      {/* Datetime input */}
                      {!isDuration && (
                        <div>
                          <input
                            type="datetime-local"
                            value={timer.targetDatetime}
                            onChange={(e) => updateTimer(timer.id, { targetDatetime: e.target.value })}
                            className="w-full px-2 py-1.5 rounded bg-neutral-800 text-white text-sm border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {timer.targetDatetime &&
                            (() => {
                              const ms = new Date(timer.targetDatetime).getTime() - Date.now()
                              if (ms <= 0)
                                return (
                                  <p className="text-[10px] text-red-400 mt-1">⚠ Time is in the past.</p>
                                )
                              const h = Math.floor(ms / 3600000)
                              const m = Math.floor((ms % 3600000) / 60000)
                              return (
                                <p className="text-[10px] text-gray-400 mt-1">
                                  ≈ {h}h {m}m remaining
                                </p>
                              )
                            })()}
                          {timer.targetDatetime && (
                            <button
                              onClick={() => updateTimer(timer.id, { targetDatetime: '' })}
                              className="mt-1 text-[10px] text-red-400/70 hover:text-red-400 transition-colors"
                            >
                              Clear target
                            </button>
                          )}
                        </div>
                      )}

                      {/* Duration timer controls */}
                      {isDuration && ctrl && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => (isRunning ? ctrl.pause() : ctrl.play())}
                            disabled={isExpired || (!isRunning && ctrl.remainingMs <= 0)}
                            className={cn(
                              'flex-1 py-1.5 rounded text-xs font-medium transition-all flex items-center justify-center gap-1',
                              isRunning
                                ? 'bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25'
                                : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30',
                              'disabled:opacity-30',
                            )}
                          >
                            {isRunning ? (
                              <>
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                                </svg>
                                Pause
                              </>
                            ) : (
                              <>
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                                {isExpired ? 'Expired' : 'Start'}
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => ctrl.reset()}
                            className="flex-1 py-1.5 rounded text-xs font-medium transition-all flex items-center justify-center gap-1 bg-neutral-800 text-gray-400 hover:text-gray-200"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                              <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                            </svg>
                            Reset
                          </button>
                        </div>
                      )}

                      {/* Display position */}
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">
                          Show as
                        </label>
                        <div className="flex gap-1.5">
                          {(['top', 'bottom', 'floating'] as const).map((pos) => (
                            <button
                              key={pos}
                              onClick={() => updateTimer(timer.id, { displayPosition: pos })}
                              className={cn(
                                'flex-1 py-1 rounded text-xs font-medium transition-all capitalize',
                                timer.displayPosition === pos
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-neutral-800 text-gray-400 hover:text-gray-200',
                              )}
                            >
                              {pos === 'floating' ? 'Float' : pos}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              <button
                onClick={() => addTimer()}
                className="w-full py-2 rounded-lg text-xs font-medium bg-neutral-800 border border-neutral-700 text-gray-400 hover:border-blue-500/50 hover:text-blue-400 transition-all flex items-center justify-center gap-1.5"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
                Add Timer
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
