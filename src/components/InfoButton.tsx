import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

interface InfoButtonProps {
  onOpen: () => void
  prefersReducedMotion: boolean
}

export const InfoButton: React.FC<InfoButtonProps> = ({ onOpen, prefersReducedMotion }) => {
  return (
    <motion.button
      whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
      onClick={onOpen}
      className={cn(
        "fixed bottom-8 left-1/2 -translate-x-1/2 z-40 p-2 rounded-lg",
        "transition-colors duration-200 hover:bg-white/10 focus:outline-none pointer-events-auto"
      )}
      aria-label="App Information"
    >
      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </motion.button>
  )
}
