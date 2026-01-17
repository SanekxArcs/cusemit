import React from 'react'
import { motion } from 'framer-motion'

interface AnimatedNumberProps {
  value: string
  prefersReducedMotion: boolean
  animationMode: 'slide-v' | 'slide-h' | 'fade' | 'zoom' | 'flip-v' | 'flip-h' | 'blur' | 'bounce' | 'rotate' | 'none'
  style?: React.CSSProperties
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  prefersReducedMotion,
  animationMode,
  style,
}) => {
  const previousValue = React.useRef<string>(value)

  React.useEffect(() => {
    previousValue.current = value
  }, [value])

  if (animationMode === 'none' || prefersReducedMotion) {
    return <span className="inline-block proportional-nums" style={style}>{value}</span>;
  }

  const getVariants = () => {
    switch (animationMode) {
      case 'fade':
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        };
      case 'zoom':
        return {
          initial: { opacity: 0, scale: 0.5 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 1.5 },
        };
      case 'flip-v':
        return {
          initial: { rotateX: -90, opacity: 0 },
          animate: { rotateX: 0, opacity: 1 },
          exit: { rotateX: 90, opacity: 0 },
        };
      case 'flip-h':
        return {
          initial: { rotateY: -90, opacity: 0 },
          animate: { rotateY: 0, opacity: 1 },
          exit: { rotateY: 90, opacity: 0 },
        };
      case 'blur':
        return {
          initial: { filter: 'blur(10px)', opacity: 0 },
          animate: { filter: 'blur(0px)', opacity: 1 },
          exit: { filter: 'blur(10px)', opacity: 0 },
        };
      case 'bounce':
        return {
          initial: { y: 40, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          exit: { y: -40, opacity: 0 },
          transition: { type: 'spring', damping: 10, stiffness: 100 }
        };
      case 'rotate':
        return {
          initial: { rotate: -180, opacity: 0, scale: 0.5 },
          animate: { rotate: 0, opacity: 1, scale: 1 },
          exit: { rotate: 180, opacity: 0, scale: 1.5 },
        };
      case 'slide-h':
        return {
          initial: { x: 20, opacity: 0 },
          animate: { x: 0, opacity: 1 },
          exit: { x: -20, opacity: 0 },
        };
      case 'slide-v':
      default:
        return {
          initial: { y: 20, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          exit: { y: -20, opacity: 0 },
        };
    }
  };

  const variants = getVariants();
  const transition = variants.transition || {
    duration: 0.4,
    ease: 'easeOut',
  };

  return (
    <motion.span
      key={`${value}`}
      initial={variants.initial}
      animate={variants.animate}
      exit={variants.exit}
      transition={transition}
      className="inline-block proportional-nums"
      style={{
        display: 'inline-block',
        ...style
      }}
    >
      {value}
    </motion.span>
  )
}

export default AnimatedNumber
