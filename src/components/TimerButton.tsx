import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

interface TimerButtonProps {
  onToggle: () => void
  prefersReducedMotion: boolean
  hasActiveTimers?: boolean
}

export const TimerButton: React.FC<TimerButtonProps> = ({
  onToggle,
  prefersReducedMotion,
  hasActiveTimers = false,
}) => {
  return (
    <motion.button
      onClick={onToggle}
      className={cn(
        'fixed top-4 right-16 z-50 p-2 rounded-lg',
        'transition-colors duration-200',
        'hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50',
      )}
      aria-label="Open timers"
      whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
    >
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {/* Active dot indicator */}
      {hasActiveTimers && (
        <span className="absolute top-2 right-2 w-2 h-2 bg-blue-400 rounded-full" />
      )}
    </motion.button>
  )
}
