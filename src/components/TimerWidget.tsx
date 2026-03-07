import React from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { cn } from '@/lib/cn'
import { formatMs } from '@/hooks/useTimer'

interface TimerWidgetProps {
  remainingMs: number
  isRunning: boolean
  isExpired: boolean
  position: 'top' | 'bottom' | 'floating'
  /** Initial floating position as percentage of viewport (0-100) */
  floatX: number
  floatY: number
  floatScale: number
  floatRotation: number
  onPlay: () => void
  onPause: () => void
  onReset: () => void
  /** Called when the floating widget's position/scale/rotation changes */
  onTransformChange?: (x: number, y: number, scale: number, rotation: number) => void
  color?: string
}

// ── Small control buttons ─────────────────────────────────────────────────────

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

// ── Inline (top / bottom) variant ─────────────────────────────────────────────

interface InlineTimerProps {
  remainingMs: number
  isRunning: boolean
  isExpired: boolean
  onPlay: () => void
  onPause: () => void
  onReset: () => void
  color?: string
}

const InlineTimer: React.FC<InlineTimerProps> = ({
  remainingMs,
  isRunning,
  isExpired,
  onPlay,
  onPause,
  onReset,
  color = '#ffffff',
}) => {
  const display = isExpired ? "Time's up!" : formatMs(remainingMs)

  return (
    <div
      className="flex items-center gap-2 justify-center select-none"
      style={{ color }}
    >
      <span
        className={cn(
          'font-mono text-sm tabular-nums',
          isExpired && 'animate-pulse',
        )}
      >
        {display}
      </span>

      <div className="flex items-center gap-1">
        {/* Play / Pause */}
        <button
          onClick={isRunning ? onPause : onPlay}
          className="p-1 rounded hover:bg-white/10 active:scale-90 transition-all"
          aria-label={isRunning ? 'Pause timer' : 'Start timer'}
          disabled={isExpired}
        >
          {isRunning ? <PauseIcon /> : <PlayIcon />}
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          className="p-1 rounded hover:bg-white/10 active:scale-90 transition-all"
          aria-label="Reset timer"
        >
          <ResetIcon />
        </button>
      </div>
    </div>
  )
}

// ── Floating (beta) variant ───────────────────────────────────────────────────

interface FloatingTimerProps extends InlineTimerProps {
  floatX: number
  floatY: number
  floatScale: number
  floatRotation: number
  onTransformChange?: (x: number, y: number, scale: number, rotation: number) => void
}

// Approximate half-dimensions of the floating widget used to centre its initial position
const WIDGET_HALF_WIDTH = 90  // px – half of typical widget width
const WIDGET_HALF_HEIGHT = 30 // px – half of typical widget height

const FloatingTimer: React.FC<FloatingTimerProps> = ({
  remainingMs,
  isRunning,
  isExpired,
  onPlay,
  onPause,
  onReset,
  floatX,
  floatY,
  floatScale,
  floatRotation,
  onTransformChange,
  color = '#ffffff',
}) => {
  const display = isExpired ? "Time's up!" : formatMs(remainingMs)

  // Motion values for smooth drag
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Track pinch / rotation gesture
  const gestureRef = React.useRef<{
    startDist: number
    startAngle: number
    startScale: number
    startRotation: number
  } | null>(null)

  const [scale, setScale] = React.useState(floatScale)
  const [rotation, setRotation] = React.useState(floatRotation)
  const scaleRef = React.useRef(floatScale)
  const rotationRef = React.useRef(floatRotation)

  // Sync from props only on mount / when props change externally
  React.useEffect(() => {
    setScale(floatScale)
    scaleRef.current = floatScale
  }, [floatScale])
  React.useEffect(() => {
    setRotation(floatRotation)
    rotationRef.current = floatRotation
  }, [floatRotation])

  // Approximate half-dimensions of the widget used to centre the initial position
  // Position in viewport pixels derived from percentage
  const initX = React.useRef((window.innerWidth * floatX) / 100 - WIDGET_HALF_WIDTH)
  const initY = React.useRef((window.innerHeight * floatY) / 100 - WIDGET_HALF_HEIGHT)

  React.useEffect(() => {
    x.set(initX.current)
    y.set(initY.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      const dx = t1.clientX - t0.clientX
      const dy = t1.clientY - t0.clientY
      gestureRef.current = {
        startDist: Math.hypot(dx, dy),
        startAngle: Math.atan2(dy, dx) * (180 / Math.PI),
        startScale: scaleRef.current,
        startRotation: rotationRef.current,
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
        Math.min(4, gestureRef.current.startScale * (dist / gestureRef.current.startDist)),
      )
      const newRotation =
        gestureRef.current.startRotation + (angle - gestureRef.current.startAngle)

      scaleRef.current = newScale
      rotationRef.current = newRotation
      setScale(newScale)
      setRotation(newRotation)
    }
  }

  const handleTouchEnd = () => {
    if (gestureRef.current) {
      gestureRef.current = null
      // Save the new position/transform
      const pctX = ((x.get() + WIDGET_HALF_WIDTH) / window.innerWidth) * 100
      const pctY = ((y.get() + WIDGET_HALF_HEIGHT) / window.innerHeight) * 100
      onTransformChange?.(
        Math.max(0, Math.min(100, pctX)),
        Math.max(0, Math.min(100, pctY)),
        scaleRef.current,
        rotationRef.current,
      )
    }
  }

  const handleDragEnd = () => {
    const pctX = ((x.get() + WIDGET_HALF_WIDTH) / window.innerWidth) * 100
    const pctY = ((y.get() + WIDGET_HALF_HEIGHT) / window.innerHeight) * 100
    onTransformChange?.(
      Math.max(0, Math.min(100, pctX)),
      Math.max(0, Math.min(100, pctY)),
      scaleRef.current,
      rotationRef.current,
    )
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn(
        'fixed z-50 touch-none cursor-grab active:cursor-grabbing',
        'rounded-xl px-4 py-2 shadow-2xl',
        'backdrop-blur-md bg-black/70 border border-white/10',
        'select-none',
      )}
      style={{
        x,
        y,
        rotate: rotation,
        scale,
        color,
        top: 0,
        left: 0,
      }}
    >
      {/* drag handle label */}
      <div className="flex items-center gap-3 whitespace-nowrap">
        {/* Timer icon */}
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 opacity-60 shrink-0">
          <path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.962 8.962 0 0 0 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9a9 9 0 0 0 7.03-14.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
        </svg>

        <span
          className={cn(
            'font-mono text-sm tabular-nums font-medium',
            isExpired && 'animate-pulse text-red-400',
          )}
        >
          {display}
        </span>

        <div className="flex items-center gap-0.5">
          <button
            onClick={isRunning ? onPause : onPlay}
            disabled={isExpired}
            className="p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all disabled:opacity-40"
            aria-label={isRunning ? 'Pause timer' : 'Start timer'}
          >
            {isRunning ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            onClick={onReset}
            className="p-1.5 rounded-lg hover:bg-white/10 active:scale-90 transition-all"
            aria-label="Reset timer"
          >
            <ResetIcon />
          </button>
        </div>
      </div>

      {/* pinch/zoom hint shown once */}
      <p className="text-[9px] text-center text-white/30 mt-0.5 leading-none">
        drag · pinch to zoom/rotate
      </p>
    </motion.div>
  )
}

// ── Public component ──────────────────────────────────────────────────────────

export const TimerWidget: React.FC<TimerWidgetProps> = ({
  remainingMs,
  isRunning,
  isExpired,
  position,
  floatX,
  floatY,
  floatScale,
  floatRotation,
  onPlay,
  onPause,
  onReset,
  onTransformChange,
  color,
}) => {
  if (position === 'floating') {
    return (
      <FloatingTimer
        remainingMs={remainingMs}
        isRunning={isRunning}
        isExpired={isExpired}
        onPlay={onPlay}
        onPause={onPause}
        onReset={onReset}
        floatX={floatX}
        floatY={floatY}
        floatScale={floatScale}
        floatRotation={floatRotation}
        onTransformChange={onTransformChange}
        color={color}
      />
    )
  }

  return (
    <InlineTimer
      remainingMs={remainingMs}
      isRunning={isRunning}
      isExpired={isExpired}
      onPlay={onPlay}
      onPause={onPause}
      onReset={onReset}
      color={color}
    />
  )
}
