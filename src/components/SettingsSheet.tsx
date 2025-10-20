import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { useSettingsStore, ClockSettings } from '@/store/settings'
import { CURATED_FONTS, loadGoogleFont } from '@/lib/fonts'
import { prefersReducedMotion } from '@/lib/amoledSaver'
import { ColorPicker } from '@/components/ColorPicker';

interface SettingsSheetProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, updateSetting, resetToDefaults } =
    useSettingsStore()
  const [customFont, setCustomFont] = React.useState(settings.customFontFamily)
  const [fontSearch, setFontSearch] = React.useState('')
  const [showFontDropdown, setShowFontDropdown] = React.useState(false)
  const reducedMotion = prefersReducedMotion()

  // Filter fonts based on search
  const filteredFonts = React.useMemo(() => {
    if (!fontSearch.trim()) return CURATED_FONTS
    const search = fontSearch.toLowerCase()
    return CURATED_FONTS.filter((font) =>
      font.label.toLowerCase().includes(search)
    )
  }, [fontSearch])

  const handleFontChange = async (fontFamily: string) => {
    try {
      // Load the font before applying it
      const curated = CURATED_FONTS.find((f) => f.value === fontFamily)
      if (curated) {
        await loadGoogleFont(fontFamily, curated.weights)
      }
      updateSetting('fontFamily', fontFamily)
    } catch (error) {
      toast.error(`Failed to load font: ${fontFamily}`)
    }
  }

  const handleCustomFontChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCustomFont(value)
    if (value.trim()) {
      try {
        await loadGoogleFont(value, [400, 700])
        updateSetting('customFontFamily', value)
        updateSetting('fontFamily', value)
      } catch (error) {
        toast.error(`Failed to load custom font: ${value}`)
      }
    }
  }

  const handleReset = () => {
    resetToDefaults()
    setCustomFont('')
    toast.success('Settings reset to defaults')
  }

  const sheetVariants = {
    hidden: reducedMotion
      ? { opacity: 0 }
      : { x: '100%', opacity: 0 },
    visible: reducedMotion
      ? { opacity: 1 }
      : {
          x: 0,
          opacity: 1,
          transition: { type: 'spring', stiffness: 300, damping: 30 },
        },
    exit: reducedMotion
      ? { opacity: 0 }
      : { x: '100%', opacity: 0, transition: { duration: 0.2 } },
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Sheet */}
          <motion.div
            className={cn(
              'fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-neutral-900',
              'border-l border-neutral-800 shadow-lg overflow-y-auto z-50'
            )}
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Settings</h2>
                <button
                  onClick={onClose}
                  className={cn(
                    'p-1 rounded hover:bg-neutral-800',
                    'transition-colors focus:outline-none focus:ring-2 focus:ring-white/50'
                  )}
                  aria-label="Close settings"
                >
                  <svg
                    className="w-5 h-5 text-white"
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

              {/* Background Mode */}
              <Section title="Background">
                <div className="space-y-3">
                  <label className="block text-sm text-gray-300">Mode</label>
                  <select
                    value={settings.backgroundMode}
                    onChange={(e) =>
                      updateSetting(
                        'backgroundMode',
                        e.target.value as ClockSettings['backgroundMode']
                      )
                    }
                    className={cn(
                      'w-full px-3 py-2 rounded bg-neutral-800 text-white',
                      'border border-neutral-700 focus:outline-none focus:ring-2',
                      'focus:ring-blue-500'
                    )}
                  >
                    <option value="solid">Solid Color</option>
                    <option value="gradient">Gradient</option>
                    <option value="amoled">Pure Black (AMOLED)</option>
                  </select>
                </div>

                {settings.backgroundMode === 'solid' && (
                  <div className="mt-3">
                    <ColorPicker
                      value={settings.solidColor}
                      onChange={(color) => updateSetting('solidColor', color)}
                      label="Background Color"
                    />
                  </div>
                )}

                {settings.backgroundMode === 'gradient' && (
                  <div className="mt-3 space-y-3">
                    <ColorPicker
                      value={settings.gradientStart}
                      onChange={(color) =>
                        updateSetting('gradientStart', color)
                      }
                      label="Gradient Start"
                    />
                    <ColorPicker
                      value={settings.gradientEnd}
                      onChange={(color) => updateSetting('gradientEnd', color)}
                      label="Gradient End"
                    />
                    <label className="flex items-center space-x-2 mt-3">
                      <input
                        type="checkbox"
                        checked={settings.animatedGradient}
                        onChange={(e) =>
                          updateSetting('animatedGradient', e.target.checked)
                        }
                        disabled={settings.enableAMOLEDSaver}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-gray-300">
                        Animated Gradient
                      </span>
                    </label>
                  </div>
                )}
              </Section>

              {/* Clock Appearance */}
              <Section title="Clock Appearance">
                <div className="space-y-3">
                  <ColorPicker
                    value={settings.clockColor}
                    onChange={(color) => updateSetting('clockColor', color)}
                    label="Clock Color"
                  />

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      Font (Search)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search fonts..."
                        value={fontSearch}
                        onChange={(e) => {
                          setFontSearch(e.target.value);
                          setShowFontDropdown(true);
                        }}
                        onFocus={() => setShowFontDropdown(true)}
                        className={cn(
                          'w-full px-3 py-2 rounded bg-neutral-800 text-white',
                          'border border-neutral-700 focus:outline-none focus:ring-2',
                          'focus:ring-blue-500'
                        )}
                      />
                      {showFontDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-800 border border-neutral-700 rounded max-h-48 overflow-y-auto z-50">
                          {filteredFonts.map((font) => (
                            <button
                              key={font.value}
                              onClick={() => {
                                handleFontChange(font.value);
                                setFontSearch('');
                                setShowFontDropdown(false);
                              }}
                              className={cn(
                                'w-full text-left px-3 py-2 transition-colors',
                                settings.fontFamily === font.value
                                  ? 'bg-blue-600 text-white'
                                  : 'hover:bg-neutral-700 text-gray-300'
                              )}
                            >
                              <div style={{ fontFamily: font.label }}>
                                {font.label}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      Custom Google Font (optional)
                    </label>
                    <input
                      type="text"
                      value={customFont}
                      onChange={handleCustomFontChange}
                      placeholder="e.g., Courier+Prime"
                      className={cn(
                        'w-full px-3 py-2 rounded bg-neutral-800 text-white',
                        'border border-neutral-700 focus:outline-none focus:ring-2',
                        'focus:ring-blue-500'
                      )}
                    />
                  </div>
                </div>
              </Section>

              {/* Padding */}
              <Section title="Padding">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      Padding X: {settings.paddingX.toFixed(1)}rem
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.25"
                      value={settings.paddingX}
                      onChange={(e) =>
                        updateSetting('paddingX', parseFloat(e.target.value))
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2">
                      Padding Y: {settings.paddingY.toFixed(1)}rem
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.25"
                      value={settings.paddingY}
                      onChange={(e) =>
                        updateSetting('paddingY', parseFloat(e.target.value))
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              </Section>

              {/* Display Options */}
              <Section title="Display">
                <div className="space-y-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.showSeconds}
                      onChange={(e) =>
                        updateSetting('showSeconds', e.target.checked)
                      }
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-gray-300">Show Seconds</span>
                  </label>

                  <label className="block text-sm text-gray-300">
                    Clock Format
                  </label>
                  <select
                    value={settings.clockFormat}
                    onChange={(e) =>
                      updateSetting(
                        'clockFormat',
                        e.target.value as ClockSettings['clockFormat']
                      )
                    }
                    className={cn(
                      'w-full px-3 py-2 rounded bg-neutral-800 text-white',
                      'border border-neutral-700 focus:outline-none focus:ring-2',
                      'focus:ring-blue-500'
                    )}
                  >
                    <option value="24h">24-Hour</option>
                    <option value="12h">12-Hour</option>
                  </select>
                </div>
              </Section>

              {/* AMOLED Saver */}
              <Section title="AMOLED/OLED Saver">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.enableAMOLEDSaver}
                    onChange={(e) =>
                      updateSetting('enableAMOLEDSaver', e.target.checked)
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-gray-300">
                    Enable (mitigate burn-in)
                  </span>
                </label>
              </Section>

              {/* Reset Button */}
              <button
                onClick={handleReset}
                className={cn(
                  'w-full py-2 px-4 rounded bg-red-600 text-white',
                  'hover:bg-red-700 transition-colors focus:outline-none',
                  'focus:ring-2 focus:ring-red-500'
                )}
              >
                Reset to Defaults
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface SectionProps {
  title: string
  children: React.ReactNode
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <div className="border-b border-neutral-800 pb-4">
    <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wide">
      {title}
    </h3>
    {children}
  </div>
)
