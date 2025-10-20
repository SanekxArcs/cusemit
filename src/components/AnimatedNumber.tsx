import React from 'react'
import { motion } from 'framer-motion'

interface AnimatedNumberProps {
  value: string
  prefersReducedMotion: boolean
}

/**
 * AnimatedNumber: Displays a digit with smooth vertical slide animation
 * Similar to NumberFlow - numbers slide in from top when they change
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  prefersReducedMotion,
}) => {
  const previousValue = React.useRef<string>(value)
  const hasChanged = previousValue.current !== value

  React.useEffect(() => {
    previousValue.current = value
  }, [value])

  return (
    <motion.span
      key={`${value}-${hasChanged}`}
      initial={
        prefersReducedMotion || !hasChanged
          ? { opacity: 1, y: 0 }
          : { opacity: 0, y: 20 } // Start from below
      }
      animate={{ opacity: 1, y: 0 }}
      exit={
        prefersReducedMotion || !hasChanged
          ? { opacity: 1, y: 0 }
          : { opacity: 0, y: -20 } // Exit to above
      }
      transition={{
        duration: 0.4,
        ease: 'easeOut',
      }}
      className="inline-block"
      style={{
        display: 'inline-block',
        minWidth: '1ch',
      }}
    >
      {value}
    </motion.span>
  )
}

export default AnimatedNumber
