import React from 'react'
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn'
import { getFontFamilyCSS } from '@/lib/fonts'
import { DriftOffset } from '@/lib/amoledSaver'
import { AnimatedNumber } from './AnimatedNumber';

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
      if (!textRef.current) return;

      const container = textRef.current.parentElement;
      if (!container) return;

      const availableWidth = container.clientWidth - paddingX * 2 * 16; // Convert rem to pixels
      const availableHeight = container.clientHeight - paddingY * 2 * 16; // Convert rem to pixels

      // Use viewport-relative scaling for better responsiveness on large screens
      // Start with a size proportional to viewport dimensions
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let size = Math.min(vw, vh) * 0.4; // Start at 40% of smaller viewport dimension

      textRef.current.style.fontSize = `${size}px`;

      // Fine-tune: decrease if doesn't fit
      while (
        (textRef.current.offsetWidth > availableWidth ||
          textRef.current.offsetHeight > availableHeight) &&
        size > 12
      ) {
        size -= 5;
        textRef.current.style.fontSize = `${size}px`;
      }

      setFontSize(size);
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
    <AnimatePresence mode="wait">
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
          {/* Render each character with animation */}
          {Array.from(time).map((char, index) => (
            <AnimatedNumber
              key={`time-${index}`}
              value={char}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
