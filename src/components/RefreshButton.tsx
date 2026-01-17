import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

interface RefreshButtonProps {
  onRefresh: () => void
  prefersReducedMotion: boolean
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  onRefresh,
  prefersReducedMotion,
}) => {
  return (
    <motion.button
      onClick={onRefresh}
      className={cn(
        'fixed top-4 left-4 z-50 p-2 rounded-lg',
        'transition-colors duration-200',
        'hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50'
      )}
      aria-label="Refresh layout"
      whileTap={{ scale: prefersReducedMotion ? 1 : 0.9 }}
    >
      <svg
              className="w-6 h-6 text-white"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    </motion.button>
  )
}
