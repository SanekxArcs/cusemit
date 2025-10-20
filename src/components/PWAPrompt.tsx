import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

interface PWAPromptProps {
  isInstallable: boolean
  onInstall: () => Promise<void>
  onDismiss: () => void
}

/**
 * PWA Install Prompt Component
 * Shows install button when app is installable
 */
export const PWAPrompt: React.FC<PWAPromptProps> = ({
  isInstallable,
  onInstall,
  onDismiss,
}) => {
  const [isLoading, setIsLoading] = React.useState(false)

  const handleInstall = async () => {
    setIsLoading(true)
    try {
      await onInstall()
    } finally {
      setIsLoading(false)
    }
  }

  if (!isInstallable) return null

  return (
    <motion.div
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-40"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">
              Install App
            </h3>
            <p className="text-xs text-gray-400">
              Install Digital Clock for offline access and fullscreen display
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleInstall}
            disabled={isLoading}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium rounded',
              'bg-blue-600 text-white transition-colors',
              'hover:bg-blue-700 disabled:opacity-50'
            )}
          >
            {isLoading ? 'Installing...' : 'Install'}
          </button>
          <button
            onClick={onDismiss}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium rounded',
              'bg-neutral-700 text-gray-300 transition-colors',
              'hover:bg-neutral-600'
            )}
          >
            Later
          </button>
        </div>
      </div>
    </motion.div>
  )
}
