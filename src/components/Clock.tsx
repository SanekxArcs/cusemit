import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { getFontFamilyCSS } from '@/lib/fonts'
import { DriftOffset } from '@/lib/amoledSaver'

interface ClockProps {
  time: string
  color: string
  fontFamily: string
  paddingX: number
  paddingY: number
  driftOffset: DriftOffset
  prefersReducedMotion: boolean
}

export const Clock: React.FC<ClockProps> = ({
  time,
  color,
  fontFamily,
  paddingX,
  paddingY,
  driftOffset,
  prefersReducedMotion,
}) => {
  const fontFamilyCSS = getFontFamilyCSS(fontFamily)
  const textRef = React.useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = React.useState(100)

  // Calculate font size to fit text within available width
  React.useEffect(() => {
    const calculateFontSize = () => {
      if (!textRef.current) return

      const container = textRef.current.parentElement
      if (!container) return

      const availableWidth =
        container.clientWidth -
        paddingX * 2 * 16 // Convert rem to pixels
      const availableHeight =
        container.clientHeight -
        paddingY * 2 * 16 // Convert rem to pixels

      // Start with a large size and decrease until it fits
      let size = 300
      textRef.current.style.fontSize = `${size}px`

      while (
        (textRef.current.offsetWidth > availableWidth ||
          textRef.current.offsetHeight > availableHeight) &&
        size > 12
      ) {
        size -= 5
        textRef.current.style.fontSize = `${size}px`
      }

      setFontSize(size)
    }

    calculateFontSize()

    // Recalculate on window resize
    const resizeObserver = new ResizeObserver(calculateFontSize)
    if (textRef.current?.parentElement) {
      resizeObserver.observe(textRef.current.parentElement)
    }

    return () => resizeObserver.disconnect()
  }, [time, paddingX, paddingY, fontFamily])

  // Drift animation: smoothly transition to new offset
  const driftVariants = {
    animate: prefersReducedMotion
      ? { x: 0, y: 0 }
      : {
          x: driftOffset.x,
          y: driftOffset.y,
          transition: { duration: 0.3, ease: 'easeInOut' },
        },
  }

  return (
    <motion.div
      className={cn(
        'absolute inset-0 flex items-center justify-center',
        `px-[${paddingX}rem] py-[${paddingY}rem]`
      )}
      style={{
        paddingLeft: `${paddingX}rem`,
        paddingRight: `${paddingX}rem`,
        paddingTop: `${paddingY}rem`,
        paddingBottom: `${paddingY}rem`,
      }}
      animate="animate"
      variants={driftVariants}
    >
      <div
        ref={textRef}
        className="text-center whitespace-nowrap font-bold leading-none"
        style={{
          fontSize: `${fontSize}px`,
          color: color,
          fontFamily: fontFamilyCSS,
          transition: prefersReducedMotion
            ? 'color 0s'
            : 'color 0.3s ease-in-out',
        }}
      >
        {time}
      </div>
    </motion.div>
  )
}
