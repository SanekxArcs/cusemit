import React from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { cn } from '@/lib/cn'
import { formatMs } from '@/hooks/useTimerArray'
import { getFontFamilyCSS } from '@/lib/fonts'
import type { TimerConfig } from '@/store/settings'

// ── Snap helper ───────────────────────────────────────────────────────────────

const SNAP_THRESHOLD = 12
const CARDINALS = [0, 90, 180, 270, -90, -180, 360]

function snapRotation(deg: number): number {
  for (const c of CARDINALS) {
    if (Math.abs(deg - c) < SNAP_THRESHOLD) return c
  }
  return deg
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  )
}

// ── Controls auto-hide timeout ────────────────────────────────────────────────
const CONTROLS_HIDE_DELAY = 5000 // ms

// Approximate half-dimensions of the widget pill for converting % <-> px positions.
// These match the typical rendered size at scale=1: ~180px wide × ~44px tall.
const WIDGET_HALF_WIDTH = 90  // half of ~180px typical width
const WIDGET_HALF_HEIGHT = 22 // half of ~44px typical height (text + controls)

// ── Floating timer widget ─────────────────────────────────────────────────────

export interface FloatingTimerProps {
  config: TimerConfig
  remainingMs: number
  isRunning: boolean
  isExpired: boolean
  onPlay: () => void
  onPause: () => void
  onReset: () => void
  onTransformChange: (x: number, y: number, scale: number, rotation: number) => void
  onFontToggle: (useClockFont: boolean) => void
  clockColor: string
  clockFontFamily: string
  clockFontWeight: number
}

export const FloatingTimerWidget: React.FC<FloatingTimerProps> = ({
  config,
  remainingMs,
  isRunning,
  isExpired,
  onPlay,
  onPause,
  onReset,
  onTransformChange,
  onFontToggle,
  clockColor,
  clockFontFamily,
  clockFontWeight,
}) => {
  const display = isExpired ? "Time's up!" : formatMs(remainingMs)
  const isDuration = config.inputMode === 'duration'

  // Auto-hide controls
  const [controlsVisible, setControlsVisible] = React.useState(false)
  const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const showControls = React.useCallback(() => {
    setControlsVisible(true)
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    hideTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false)
    }, CONTROLS_HIDE_DELAY)
  }, [])

  React.useEffect(() => () => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
  }, [])

  // Drag / pinch gesture state
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const gestureRef = React.useRef<{
    startDist: number
    startAngle: number
    startScale: number
    startRotation: number
  } | null>(null)

  const [scale, setScale] = React.useState(config.floatScale)
  const [rotation, setRotation] = React.useState(config.floatRotation)
  const scaleRef = React.useRef(config.floatScale)
  const rotRef = React.useRef(config.floatRotation)

  const initX = React.useRef(
    (window.innerWidth * config.floatX) / 100 - WIDGET_HALF_WIDTH,
  )
  const initY = React.useRef(
    (window.innerHeight * config.floatY) / 100 - WIDGET_HALF_HEIGHT,
  )

  React.useEffect(() => {
    x.set(initX.current)
    y.set(initY.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    setScale(config.floatScale)
    scaleRef.current = config.floatScale
  }, [config.floatScale])

  React.useEffect(() => {
    setRotation(config.floatRotation)
    rotRef.current = config.floatRotation
  }, [config.floatRotation])

  const saveTransform = React.useCallback(() => {
    const pctX = ((x.get() + WIDGET_HALF_WIDTH) / window.innerWidth) * 100
    const pctY = ((y.get() + WIDGET_HALF_HEIGHT) / window.innerHeight) * 100
    onTransformChange(
      Math.max(0, Math.min(100, pctX)),
      Math.max(0, Math.min(100, pctY)),
      scaleRef.current,
      rotRef.current,
    )
  }, [x, y, onTransformChange])

  const handleTouchStart = (e: React.TouchEvent) => {
    showControls()
    if (e.touches.length === 2) {
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      gestureRef.current = {
        startDist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
        startAngle: Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX) * (180 / Math.PI),
        startScale: scaleRef.current,
        startRotation: rotRef.current,
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && gestureRef.current) {
      e.preventDefault()
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      const dx = t1.clientX - t0.clientX
      const dy = t1.clientY - t0.clientY
      const dist = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx) * (180 / Math.PI)

      const newScale = Math.max(
        0.3,
        Math.min(5, gestureRef.current.startScale * (dist / gestureRef.current.startDist)),
      )
      const rawRotation = gestureRef.current.startRotation + (angle - gestureRef.current.startAngle)
      const newRotation = snapRotation(rawRotation)

      scaleRef.current = newScale
      rotRef.current = newRotation
      setScale(newScale)
      setRotation(newRotation)
    }
  }

  const handleTouchEnd = () => {
    if (gestureRef.current) {
      gestureRef.current = null
      saveTransform()
    }
  }

  const fontFamily = config.useClockFont ? getFontFamilyCSS(clockFontFamily) : 'Inter, sans-serif'
  const fontWeight = config.useClockFont ? clockFontWeight : 400

  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={saveTransform}
      onDragStart={showControls}
      onClick={showControls}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="fixed z-50 touch-none cursor-grab active:cursor-grabbing select-none"
      style={{
        x,
        y,
        rotate: rotation,
        scale,
        top: 0,
        left: 0,
        color: clockColor,
      }}
    >
      {/* Countdown text */}
      <div
        className={cn(
          'whitespace-nowrap tabular-nums text-sm font-medium px-2 py-1',
          isExpired && 'animate-pulse',
        )}
        style={{ fontFamily, fontWeight }}
      >
        {display}
      </div>

      {/* Auto-hiding controls */}
      <motion.div
        animate={{ opacity: controlsVisible ? 1 : 0, y: controlsVisible ? 0 : -4 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-1 px-1 pb-1 pointer-events-auto"
        style={{ pointerEvents: controlsVisible ? 'auto' : 'none' }}
      >
        {/* Play / Pause – only for duration timers */}
        {isDuration && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              isRunning ? onPause() : onPlay()
              showControls()
            }}
            disabled={isExpired}
            className="p-1 rounded hover:bg-white/10 active:scale-90 transition-all disabled:opacity-30"
            aria-label={isRunning ? 'Pause' : 'Start'}
          >
            {isRunning ? <PauseIcon /> : <PlayIcon />}
          </button>
        )}

        {/* Reset – only for duration timers */}
        {isDuration && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onReset()
              showControls()
            }}
            className="p-1 rounded hover:bg-white/10 active:scale-90 transition-all"
            aria-label="Reset"
          >
            <ResetIcon />
          </button>
        )}

        {/* Font toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onFontToggle(!config.useClockFont)
            showControls()
          }}
          className={cn(
            'px-1.5 py-0.5 rounded text-[9px] transition-all',
            config.useClockFont
              ? 'bg-white/20 text-white'
              : 'bg-white/5 text-white/50 hover:bg-white/10',
          )}
          aria-label="Toggle clock font"
          title={config.useClockFont ? 'Using clock font' : 'Using default font'}
        >
          Aa
        </button>
      </motion.div>
    </motion.div>
  )
}
