import React from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { Clock } from '@/components/Clock'
import type { ClockSettings } from '@/store/settings'
import type { DriftOffset } from '@/lib/amoledSaver'

interface FloatingClockProps {
  settings: ClockSettings
  time: string
  ampm: string
  topText?: string
  bottomText?: string
  showTopText?: boolean
  showBottomText?: boolean
  driftOffset: DriftOffset
  prefersReducedMotion: boolean
  refreshKey: number
  onTransformChange: (x: number, y: number, scale: number, rotation: number) => void
}

// Snap angle to nearest cardinal if within this many degrees
const SNAP_THRESHOLD = 12
const CARDINALS = [0, 90, 180, 270, -90, -180, 360]

function snapRotation(deg: number): number {
  for (const c of CARDINALS) {
    if (Math.abs(deg - c) < SNAP_THRESHOLD) return c
  }
  return deg
}

// Approximate half-dimensions of the floating clock container for converting % <-> px.
// At scale=1 the container is 400×180px, which gives a comfortable clock display
// that users can then pinch-zoom up or down.
const FLOAT_HALF_W = 200 // half of 400px container width
const FLOAT_HALF_H = 90  // half of 180px container height

export const FloatingClock: React.FC<FloatingClockProps> = ({
  settings,
  time,
  ampm,
  topText,
  bottomText,
  showTopText,
  showBottomText,
  driftOffset,
  prefersReducedMotion,
  refreshKey,
  onTransformChange,
}) => {
  const initX = React.useRef(
    (window.innerWidth * settings.clockFloatX) / 100 - FLOAT_HALF_W,
  )
  const initY = React.useRef(
    (window.innerHeight * settings.clockFloatY) / 100 - FLOAT_HALF_H,
  )

  const x = useMotionValue(initX.current)
  const y = useMotionValue(initY.current)

  const [scale, setScale] = React.useState(settings.clockFloatScale)
  const [rotation, setRotation] = React.useState(settings.clockFloatRotation)
  const scaleRef = React.useRef(settings.clockFloatScale)
  const rotRef = React.useRef(settings.clockFloatRotation)

  React.useEffect(() => {
    setScale(settings.clockFloatScale)
    scaleRef.current = settings.clockFloatScale
  }, [settings.clockFloatScale])

  React.useEffect(() => {
    setRotation(settings.clockFloatRotation)
    rotRef.current = settings.clockFloatRotation
  }, [settings.clockFloatRotation])

  const gestureRef = React.useRef<{
    startDist: number
    startAngle: number
    startScale: number
    startRotation: number
  } | null>(null)

  const saveTransform = React.useCallback(() => {
    const pctX = ((x.get() + FLOAT_HALF_W) / window.innerWidth) * 100
    const pctY = ((y.get() + FLOAT_HALF_H) / window.innerHeight) * 100
    onTransformChange(
      Math.max(0, Math.min(100, pctX)),
      Math.max(0, Math.min(100, pctY)),
      scaleRef.current,
      rotRef.current,
    )
  }, [x, y, onTransformChange])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      gestureRef.current = {
        startDist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
        startAngle:
          Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX) *
          (180 / Math.PI),
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
        0.15,
        Math.min(6, gestureRef.current.startScale * (dist / gestureRef.current.startDist)),
      )
      const rawRotation =
        gestureRef.current.startRotation + (angle - gestureRef.current.startAngle)
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

  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={saveTransform}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="fixed z-30 touch-none cursor-grab active:cursor-grabbing"
      style={{
        x,
        y,
        rotate: rotation,
        scale,
        top: 0,
        left: 0,
        width: FLOAT_HALF_W * 2,
        height: FLOAT_HALF_H * 2,
      }}
    >
      <div className="w-full h-full relative">
        <Clock
          time={time}
          ampm={ampm}
          ampmPosition={settings.ampmPosition}
          clockMode={settings.clockMode}
          color={settings.clockColor}
          gradientStart={settings.clockGradientStart}
          gradientEnd={settings.clockGradientEnd}
          gradientAngle={settings.clockGradientAngle}
          showStroke={settings.showStroke}
          strokeWidth={settings.strokeWidth}
          strokeColor={settings.strokeColor}
          fontFamily={settings.customFontFamily || settings.fontFamily}
          scale={1}
          offsetX={0}
          offsetY={0}
          driftOffset={driftOffset}
          prefersReducedMotion={prefersReducedMotion}
          fontWeight={settings.fontWeight}
          refreshKey={refreshKey}
          animationMode={settings.animationMode}
          topText={topText}
          bottomText={bottomText}
          showTopText={showTopText}
          showBottomText={showBottomText}
          showSeconds={settings.showSeconds}
          pulseColon={settings.pulseColon}
          tabularNums={settings.tabularNums}
          tabularNumsFallback={settings.tabularNumsFallback}
        />
      </div>
    </motion.div>
  )
}
