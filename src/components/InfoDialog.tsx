import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface InfoDialogProps {
  isOpen: boolean
  onClose: () => void
}

export const InfoDialog: React.FC<InfoDialogProps> = ({ isOpen, onClose }) => {
  const version = '1.2.0'
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          
          {/* Dialog Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-neutral-900 border border-neutral-800 w-full max-w-lg max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50 backdrop-blur-md">
                <div>
                  <h2 className="text-xl font-bold text-white leading-none">Cusemit Clock</h2>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1.5 font-medium">Digital Wall Clock • v{version}</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-neutral-800 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {/* About App */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">About App</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    A premium, minimalist digital clock designed specifically for AMOLED/OLED displays. Focuses on aesthetics, extreme customization, and screen protection features like automatic drift and anti-burn-in meshes.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-neutral-800/50 rounded-2xl border border-neutral-800/50">
                      <div className="text-blue-400 mb-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-bold text-white block">Offline First</span>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">Works without internet once loaded.</p>
                    </div>
                    <div className="p-3 bg-neutral-800/50 rounded-2xl border border-neutral-800/50">
                      <div className="text-green-400 mb-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-bold text-white block">Private & Secure</span>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">No trackers. Your settings stay on your device.</p>
                    </div>
                  </div>
                </section>

                {/* Features */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Core Features</h3>
                  <ul className="grid grid-cols-1 gap-2">
                    {[
                      'Real-time PWA with offline support',
                      'Dynamic AMOLED Saver (Drift & Mesh modes)',
                      'Custom Google Font integration',
                      'Gradient & Stroke typography control',
                      'Custom top/bottom text labels',
                      'Full background & scale customization',
                      'Multiple orientation support'
                    ].map((feature, i) => (
                      <li key={i} className="flex items-center space-x-3 text-sm text-gray-300">
                        <span className="w-1 h-1 bg-blue-500 rounded-full shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Links */}
                <div className="grid grid-cols-2 gap-4">
                  <a
                    href="https://github.com/SanekxArcs/cusemit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-2 p-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 transition-colors border border-neutral-700/50 group"
                  >
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-wider">GitHub Source</span>
                  </a>
                  <a
                    href="https://buymeacoffee.com/sanekxarcs"
                    onClick={(e) => e.preventDefault()}
                    className="flex items-center justify-center space-x-2 p-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 transition-colors border border-neutral-700/50 group"
                  >
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span className="text-xs font-bold text-white group-hover:text-red-400 transition-colors uppercase tracking-wider">Support Me</span>
                  </a>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-neutral-950/50 border-t border-neutral-800 flex items-center justify-center">
                <p className="text-[10px] text-gray-600 font-medium uppercase tracking-[0.2em]">Made with passion by Sanekx</p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
