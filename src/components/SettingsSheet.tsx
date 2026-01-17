import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { useSettingsStore } from '@/store/settings'
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
  const { settings, updateSetting, updateMultiple, resetToDefaults, addSavedFont, removeSavedFont, hideCuratedFont, resetHiddenFonts } =
    useSettingsStore()
  const [customFont, setCustomFont] = React.useState(settings.customFontFamily)
  const [fontSearch, setFontSearch] = React.useState(() => {
    const curated = CURATED_FONTS.find((f) => f.value === settings.fontFamily)
    return curated ? curated.label : settings.fontFamily
  })
  const [showFontDropdown, setShowFontDropdown] = React.useState(false)
  const [showFontInfo, setShowFontInfo] = React.useState(false)
  const [showModeDropdown, setShowModeDropdown] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const modeDropdownRef = React.useRef<HTMLDivElement>(null)
  const reducedMotion = prefersReducedMotion()
  const [isOnline, setIsOnline] = React.useState(typeof window !== 'undefined' ? window.navigator.onLine : true)
  const [isDragging, setIsDragging] = React.useState(false)

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setShowFontDropdown(false)
      }
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(target)) {
        setShowModeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter fonts based on search
  const filteredFonts = React.useMemo(() => {
    // Combine curated fonts with saved fonts
    const savedAsFontObjects = settings.savedFonts.map(f => ({
      label: f,
      value: f,
      weights: [400, 700], // Default weights for saved custom fonts
      isSaved: true
    }))

    const allOptions = [
      ...CURATED_FONTS.filter(f => !settings.hiddenCuratedFonts.includes(f.value)),
      ...savedAsFontObjects
    ]

    if (!fontSearch.trim()) return allOptions
    const search = fontSearch.toLowerCase()
    return allOptions.filter((font) =>
      font.label.toLowerCase().includes(search)
    )
  }, [fontSearch, settings.savedFonts, settings.hiddenCuratedFonts])

  const handleFontChange = async (fontFamily: string) => {
    try {
      // Check if it's a curated font or a saved font
      const curated = CURATED_FONTS.find((f) => f.value === fontFamily)
      const saved = settings.savedFonts.find((f) => f === fontFamily)

      if (curated) {
        await loadGoogleFont(fontFamily, curated.weights)
        if (!curated.weights.includes(settings.fontWeight)) {
          updateSetting('fontWeight', curated.weights.includes(700) ? 700 : curated.weights[0])
        }
        // When picking curated, clear customFontFamily
        updateMultiple({
          fontFamily: fontFamily,
          customFontFamily: ''
        })
        setCustomFont('') // Clear the manual input too
      } else if (saved) {
        await loadGoogleFont(fontFamily, [400, 700, settings.fontWeight])
        // For saved custom fonts
        updateMultiple({
          fontFamily: fontFamily,
          customFontFamily: fontFamily
        })
        setCustomFont(fontFamily)
      }
    } catch (error) {
      toast.error(`Failed to load font: ${fontFamily}`)
    }
  }

  const handleCustomFontChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCustomFont(value)
    if (value.trim()) {
      try {
        await loadGoogleFont(value, [400, 700, settings.fontWeight])
        updateMultiple({
          customFontFamily: value,
          fontFamily: value
        })
      } catch (error) {
        toast.error(`Failed to load custom font: ${value}`)
      }
    }
  }

  const handleReset = () => {
    resetToDefaults()
    setCustomFont('')
    // Find the label for the default font (Inter is the default in the store)
    const defaultFont = CURATED_FONTS.find(f => f.value === 'Inter')
    setFontSearch(defaultFont ? defaultFont.label : 'Inter')
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
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          <motion.div
            className={cn(
              'fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-neutral-900',
              'border-l border-neutral-800 shadow-lg overflow-y-auto z-50',
              'transition-all duration-300',
              isDragging ? 'bg-black/10 backdrop-blur-0' : 'bg-neutral-900'
            )}
            style={{
              opacity: isDragging ? 0.15 : 1,
            }}
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="p-6 space-y-6">
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

              <Section title="AMOLED/OLED Saver">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Enable Saver</span>
                    <button
                      onClick={() => updateSetting('enableAMOLEDSaver', !settings.enableAMOLEDSaver)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        settings.enableAMOLEDSaver ? "bg-blue-600" : "bg-neutral-700"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          settings.enableAMOLEDSaver ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>

                  {settings.enableAMOLEDSaver && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 pt-2 border-t border-neutral-800"
                    >
                      <div className="space-y-2">
                        <label className="block text-sm text-gray-400">Protection Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { val: 'drift', label: 'Clock Drift' },
                            { val: 'mesh', label: 'Mesh Overlay' },
                          ].map((item) => (
                            <button
                              key={item.val}
                              onClick={() => updateSetting('amoledSaverMode', item.val as any)}
                              className={cn(
                                "py-2 rounded text-xs font-medium transition-all border",
                                settings.amoledSaverMode === item.val
                                  ? "bg-blue-600 border-blue-500 text-white shadow-lg"
                                  : "bg-neutral-800 border-neutral-700 text-gray-400"
                              )}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {settings.amoledSaverMode === 'mesh' && (
                        <div className="space-y-2">
                          <label className="block text-sm text-gray-400">Mesh Pattern</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { val: 'pixel', label: 'Pixel' },
                              { val: 'v-lines', label: 'V-Lines' },
                              { val: 'h-lines', label: 'H-Lines' },
                            ].map((item) => (
                              <button
                                key={item.val}
                                onClick={() => updateSetting('amoledMeshType', item.val as any)}
                                className={cn(
                                  "py-2 rounded text-xs font-medium transition-all border",
                                  settings.amoledMeshType === item.val
                                    ? "bg-blue-600 border-blue-500 text-white shadow-lg"
                                    : "bg-neutral-800 border-neutral-700 text-gray-400"
                                )}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </Section>

              <Section title="Background">
                <div className="space-y-3">
                  <label className="block text-sm text-gray-300">Mode</label>
                  <div className="relative" ref={modeDropdownRef}>
                    <button
                      onClick={() => setShowModeDropdown(!showModeDropdown)}
                      className={cn(
                        'w-full px-3 py-2 rounded bg-neutral-800 text-white text-left',
                        'border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500',
                        'flex items-center justify-between transition-all hover:border-neutral-600',
                        showModeDropdown && "border-blue-500 ring-2 ring-blue-500/20"
                      )}
                    >
                      <span>
                        {settings.backgroundMode === 'solid' && 'Solid Color'}
                        {settings.backgroundMode === 'gradient' && 'Gradient'}
                        {settings.backgroundMode === 'image' && 'Custom Image'}
                      </span>
                      <svg
                        className={cn("w-4 h-4 text-gray-400 transition-transform", showModeDropdown && "rotate-180")}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    <AnimatePresence>
                      {showModeDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full left-0 right-0 mt-1 bg-neutral-800 border border-neutral-700 rounded shadow-2xl z-[60] overflow-hidden"
                        >
                          {[
                            { value: 'solid', label: 'Solid Color' },
                            { value: 'gradient', label: 'Gradient' },
                            { value: 'image', label: 'Custom Image' },
                          ].map((mode) => (
                            <button
                              key={mode.value}
                              onClick={() => {
                                updateSetting('backgroundMode', mode.value as any);
                                setShowModeDropdown(false);
                              }}
                              className={cn(
                                'w-full text-left px-3 py-2.5 transition-colors flex items-center justify-between group',
                                settings.backgroundMode === mode.value
                                  ? 'bg-blue-600 text-white'
                                  : 'hover:bg-neutral-700 text-gray-300'
                              )}
                            >
                              <span>{mode.label}</span>
                              {settings.backgroundMode === mode.value && (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {settings.enableAMOLEDSaver && (
                    <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-md">
                      <p className="text-[10px] text-blue-400 leading-tight">
                        <strong>Note:</strong> AMOLED/OLED Saver is active. Background settings are currently overridden by pure black.
                      </p>
                    </div>
                  )}
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
                    <div className="space-y-2 pt-1">
                      <label className="block text-sm text-gray-400 mb-2 tabular-nums">
                        Gradient Angle: {settings.bgGradientAngle}°
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="1"
                        value={settings.bgGradientAngle}
                        onPointerDown={() => setIsDragging(true)}
                        onPointerUp={() => setIsDragging(false)}
                        onPointerCancel={() => setIsDragging(false)}
                        onChange={(e) => updateSetting('bgGradientAngle', parseInt(e.target.value))}
                        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-sm text-gray-300">Animated Gradient</span>
                      <button
                        onClick={() => updateSetting('animatedGradient', !settings.animatedGradient)}
                        disabled={settings.enableAMOLEDSaver}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                          settings.animatedGradient ? "bg-blue-600" : "bg-neutral-700",
                          settings.enableAMOLEDSaver && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            settings.animatedGradient ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>
                  </div>
                )}
                {settings.backgroundMode === 'image' && (
                  <div className="mt-3 space-y-4">
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-300">Image Source</label>
                      <div className="flex flex-col space-y-2">
                        <input
                          type="text"
                          placeholder="Paste image URL here..."
                          value={settings.backgroundImage}
                          onChange={(e) => updateSetting('backgroundImage', e.target.value)}
                          className={cn(
                            'w-full px-3 py-2 rounded bg-neutral-800 text-white text-sm',
                            'border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500',
                            'placeholder:text-neutral-600'
                          )}
                        />
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            id="bg-upload"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  updateSetting('backgroundImage', reader.result as string);
                                  toast.success('Image uploaded successfully');
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <label
                            htmlFor="bg-upload"
                            className={cn(
                              "w-full py-2 px-3 rounded bg-neutral-700 text-gray-200 text-sm font-medium",
                              "border border-neutral-600 hover:bg-neutral-600 hover:text-white transition-all",
                              "cursor-pointer flex items-center justify-center space-x-2"
                            )}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            <span>Upload Local Image</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-2 border-t border-neutral-800">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2 proportional-nums">
                          Image Scale: {(settings.bgScale * 100).toFixed(0)}%
                        </label>
                        <input
                          type="range"
                          min="0.5"
                          max="5"
                          step="0.01"
                          value={settings.bgScale}
                          onPointerDown={() => setIsDragging(true)}
                          onPointerUp={() => setIsDragging(false)}
                          onPointerCancel={() => setIsDragging(false)}
                          onChange={(e) => updateSetting('bgScale', parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2 proportional-nums">
                          Image Horizontal: {settings.bgOffsetX.toFixed(0)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={settings.bgOffsetX}
                          onPointerDown={() => setIsDragging(true)}
                          onPointerUp={() => setIsDragging(false)}
                          onPointerCancel={() => setIsDragging(false)}
                          onChange={(e) => updateSetting('bgOffsetX', parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2 proportional-nums">
                          Image Vertical: {settings.bgOffsetY.toFixed(0)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={settings.bgOffsetY}
                          onPointerDown={() => setIsDragging(true)}
                          onPointerUp={() => setIsDragging(false)}
                          onPointerCancel={() => setIsDragging(false)}
                          onChange={(e) => updateSetting('bgOffsetY', parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      <button
                        onClick={() => updateMultiple({ bgScale: 1.1, bgOffsetX: 50, bgOffsetY: 50 })}
                        className="w-full py-1.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-neutral-800 border border-neutral-700 text-gray-500 hover:text-gray-300 hover:border-neutral-600 transition-all"
                      >
                        Reset Image Fit
                      </button>
                    </div>
                  </div>
                )}
              </Section>

              <Section title="Clock Appearance">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="block text-sm text-gray-300">Clock Mode</label>
                    <div className="flex bg-neutral-800 p-1 rounded-lg">
                      <button
                        onClick={() => updateSetting('clockMode', 'solid')}
                        className={cn(
                          "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                          settings.clockMode === 'solid' ? "bg-neutral-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
                        )}
                      >
                        Solid
                      </button>
                      <button
                        onClick={() => updateSetting('clockMode', 'gradient')}
                        className={cn(
                          "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                          settings.clockMode === 'gradient' ? "bg-neutral-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
                        )}
                      >
                        Gradient
                      </button>
                    </div>
                  </div>

                  {settings.clockMode === 'solid' ? (
                    <ColorPicker
                      value={settings.clockColor}
                      onChange={(color) => updateSetting('clockColor', color)}
                      label="Clock Color"
                    />
                  ) : (
                    <div className="space-y-3 p-3 rounded-lg bg-neutral-900/50 border border-neutral-800">
                      <ColorPicker
                        value={settings.clockGradientStart}
                        onChange={(color) => updateSetting('clockGradientStart', color)}
                        label="Gradient Start"
                      />
                      <ColorPicker
                        value={settings.clockGradientEnd}
                        onChange={(color) => updateSetting('clockGradientEnd', color)}
                        label="Gradient End"
                      />
                      <div className="space-y-2 pt-1">
                        <label className="block text-sm text-gray-400 mb-2 tabular-nums">
                          Gradient Angle: {settings.clockGradientAngle}°
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          step="1"
                          value={settings.clockGradientAngle}
                            onPointerDown={() => setIsDragging(true)}
                            onPointerUp={() => setIsDragging(false)}
                            onPointerCancel={() => setIsDragging(false)}
                          onChange={(e) => updateSetting('clockGradientAngle', parseInt(e.target.value))}
                          className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 pt-2 border-t border-neutral-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Text Stroke</span>
                      <button
                        onClick={() => updateSetting('showStroke', !settings.showStroke)}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                          settings.showStroke ? "bg-blue-600" : "bg-neutral-700"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            settings.showStroke ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>

                    {settings.showStroke && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-3 overflow-hidden"
                      >
                        <div className="space-y-2">
                          <label className="block text-sm text-gray-400 mb-2 tabular-nums">
                            Stroke Width: {settings.strokeWidth}px
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="10"
                            step="0.1"
                            value={settings.strokeWidth}
                            onPointerDown={() => setIsDragging(true)}
                            onPointerUp={() => setIsDragging(false)}
                            onPointerCancel={() => setIsDragging(false)}
                            onChange={(e) => updateSetting('strokeWidth', parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                        <ColorPicker
                          value={settings.strokeColor}
                          onChange={(color) => updateSetting('strokeColor', color)}
                          label="Stroke Color"
                        />
                      </motion.div>
                    )}
                  </div>

                  <div className="relative" ref={dropdownRef}>
                    <label className="block text-sm text-gray-300 mb-2">
                      Font
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search or choose font..."
                        value={fontSearch}
                        onChange={(e) => {
                          setFontSearch(e.target.value);
                          setShowFontDropdown(true);
                        }}
                        onFocus={() => setShowFontDropdown(true)}
                        className={cn(
                          'w-full px-3 py-2 rounded bg-neutral-800 text-white',
                          'border border-neutral-700 focus:outline-none focus:ring-2 placeholder:text-neutral-600',
                          'focus:ring-blue-500 pr-16',
                          (fontSearch.trim() === settings.fontFamily ||
                            CURATED_FONTS.some(f => f.label === fontSearch.trim() && f.value === settings.fontFamily)) &&
                          "border-blue-500/50"
                        )}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                        {/* Active Indicator */}
                        {(fontSearch.trim() === settings.fontFamily ||
                          CURATED_FONTS.some(f => f.label === fontSearch.trim() && f.value === settings.fontFamily)) && (
                            <div className="text-blue-500 p-1" title="Font active">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        {fontSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setFontSearch('');
                              setShowFontDropdown(true);
                            }}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                            aria-label="Clear search"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowFontDropdown(!showFontDropdown)}
                          className="p-1 text-gray-400 hover:text-white transition-colors"
                        >
                          <svg
                            className={cn(
                              "w-4 h-4 transition-transform",
                              showFontDropdown && "rotate-180"
                            )}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {showFontDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-800 border border-neutral-700 rounded shadow-2xl max-h-64 overflow-y-auto z-[60]">
                        <div className="p-1">
                          {filteredFonts.length > 0 ? (
                            filteredFonts.map((font) => (
                              <button
                                key={font.value}
                                onClick={() => {
                                  handleFontChange(font.value);
                                  setFontSearch(font.label);
                                  setShowFontDropdown(false);
                                }}
                                className={cn(
                                  'w-full text-left px-3 py-2.5 rounded transition-colors group',
                                  settings.fontFamily === font.value
                                    ? 'bg-blue-600 text-white'
                                    : 'hover:bg-neutral-700 text-gray-300'
                                )}
                              >
                                <div className="flex items-center justify-between group">
                                  <div className="flex items-center space-x-2 overflow-hidden">
                                    {(font as any).isSaved && (
                                      <svg className="w-3 h-3 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="Saved Google Font">
                                        <title>Saved Google Font (Requires Internet)</title>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9-3-9m-9 9a9 9 0 019-9" />
                                      </svg>
                                    )}
                                    <div className="flex flex-col truncate">
                                      <span
                                        className="text-base truncate"
                                        style={{ fontFamily: font.label }}
                                      >
                                        {font.label}
                                      </span>
                                      <span className={cn(
                                        "text-[10px] uppercase tracking-wider opacity-60",
                                        settings.fontFamily === font.value ? "text-white" : "text-gray-400"
                                      )}>
                                        {(font as any).isSaved ? 'Custom' : `${font.weights.length} weights`}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-1 shrink-0">
                                    {(font as any).isSaved ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeSavedFont(font.value);
                                          toast.info(`${font.label} removed from your list`);
                                        }}
                                        className="p-1 text-gray-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Remove from my fonts"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          hideCuratedFont(font.value);
                                          toast.info(`${font.label} hidden from list`);
                                        }}
                                        className="p-1 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Hide from list"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    )}

                                    {settings.fontFamily === font.value && (
                                      <div className="text-white">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-500">No fonts found</div>
                          )}
                        </div>
                        {settings.hiddenCuratedFonts.length > 0 && (
                          <div className="p-2 border-t border-neutral-700">
                            <button
                              onClick={() => {
                                resetHiddenFonts();
                                toast.success("Standard fonts restored");
                              }}
                              className="w-full py-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/5 rounded border border-blue-500/20"
                            >
                              Restore {settings.hiddenCuratedFonts.length} Hidden Standard Fonts
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm text-gray-300">
                      Font Weight
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(CURATED_FONTS.find(f => f.value === settings.fontFamily)?.weights || [100, 200, 300, 400, 500, 600, 700, 800, 900]).map((weight) => (
                        <button
                          key={weight}
                          onClick={() => updateSetting('fontWeight', weight)}
                          className={cn(
                            "px-3 py-1.5 w-14 rounded text-sm transition-all border",
                            settings.fontWeight === weight
                              ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20"
                              : "bg-neutral-800 border-neutral-700 text-gray-400 hover:border-neutral-600 hover:text-gray-200"
                          )}
                        >
                          <span style={{ fontWeight: weight }}>
                            {weight}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm text-gray-300">
                      Google Font (enter font name)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={customFont}
                        onChange={handleCustomFontChange}
                        placeholder={isOnline ? "e.g., Press Start 2P" : "No internet connection"}
                        disabled={!isOnline}
                        className={cn(
                          'w-full px-3 py-2 rounded bg-neutral-800 text-white',
                          'border border-neutral-700 focus:outline-none focus:ring-2',
                          'focus:ring-blue-500 pr-10',
                          !isOnline && "opacity-50 cursor-not-allowed border-red-500/20",
                          settings.customFontFamily && customFont.trim() === settings.customFontFamily && "border-blue-500"
                        )}
                      />
                      {settings.customFontFamily && customFont.trim() === settings.customFontFamily && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                          {!settings.savedFonts.includes(customFont.trim()) && (
                            <button
                              onClick={() => {
                                addSavedFont(customFont.trim());
                                toast.success(`${customFont.trim()} saved to your fonts`);
                              }}
                              className="p-1 text-gray-500 hover:text-blue-500 transition-colors"
                              title="Save font to my list"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                              </svg>
                            </button>
                          )}
                          <div className="text-blue-500" title="Font active">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>

                    {!isOnline && (
                      <div className="mt-1 flex items-center space-x-1 text-[10px] text-red-400 font-medium">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>Internet connection required to load new Google Fonts.</span>
                      </div>
                    )}

                    <div className="mt-2 text-left">
                      <button
                        onClick={() => setShowFontInfo(!showFontInfo)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center space-x-1"
                      >
                        <svg className={cn("w-3 h-3 transition-transform", showFontInfo && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span>How to use Google Fonts?</span>
                      </button>

                      <AnimatePresence>
                        {showFontInfo && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-2 text-[11px] text-gray-400 space-y-2 leading-relaxed">
                              <p>
                                1. Visit <a href="https://fonts.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">fonts.google.com</a>
                              </p>
                              <p>
                                2. Find a font you like and <strong>copy its exact title</strong>.
                              </p>
                              <p>
                                3. Paste the name into the field above.
                              </p>
                              <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-500/80 mt-1">
                                <strong>Note:</strong> Not all fonts support every weight. If a font looks wrong, try changing the "Font Weight" setting above.
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Display">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Show Seconds</span>
                    <button
                      onClick={() => updateSetting('showSeconds', !settings.showSeconds)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        settings.showSeconds ? "bg-blue-600" : "bg-neutral-700"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          settings.showSeconds ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">24-Hour Format</span>
                    <button
                      onClick={() => updateSetting('clockFormat', settings.clockFormat === '24h' ? '12h' : '24h')}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        settings.clockFormat === '24h' ? "bg-blue-600" : "bg-neutral-700"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          settings.clockFormat === '24h' ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>

                  {settings.clockFormat === '12h' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2 pt-1 border-t border-neutral-800"
                    >
                      <label className="block text-xs text-gray-400">AM/PM Position</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { val: 'before', label: 'Before' },
                          { val: 'after', label: 'After' },
                          { val: 'top', label: 'Top' },
                          { val: 'bottom', label: 'Bottom' },
                        ].map((pos) => (
                          <button
                            key={pos.val}
                            onClick={() => updateSetting('ampmPosition', pos.val as any)}
                            className={cn(
                              "py-1.5 rounded text-[10px] font-medium transition-all border uppercase tracking-wider",
                              settings.ampmPosition === pos.val
                                ? "bg-blue-600 border-blue-500 text-white shadow-lg"
                                : "bg-neutral-800 border-neutral-700 text-gray-400 hover:border-neutral-600"
                            )}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-300">Auto-hide Buttons</span>
                      <span className="text-[10px] text-gray-500">Hides after 10s of inactivity</span>
                    </div>
                    <button
                      onClick={() => updateSetting('autoHideControls', !settings.autoHideControls)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        settings.autoHideControls ? "bg-blue-600" : "bg-neutral-700"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          settings.autoHideControls ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm text-gray-300">Orientation</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { val: 'default', label: '0°' },
                        { val: 'rotate90', label: '90°' },
                        { val: 'rotate180', label: '180°' },
                        { val: 'rotate270', label: '270°' },
                      ].map((item) => (
                        <button
                          key={item.val}
                          onClick={() => updateSetting('orientation', item.val as any)}
                          className={cn(
                            "py-2 rounded text-xs font-medium transition-all border",
                            settings.orientation === item.val
                              ? "bg-blue-600 border-blue-500 text-white shadow-lg"
                              : "bg-neutral-800 border-neutral-700 text-gray-400 hover:border-neutral-600"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm text-gray-300">Number Animation</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { val: 'slide-v', label: 'Slide V' },
                        { val: 'slide-h', label: 'Slide H' },
                        { val: 'fade', label: 'Fade' },
                        { val: 'zoom', label: 'Zoom' },
                        { val: 'flip-v', label: 'Flip V' },
                        { val: 'flip-h', label: 'Flip H' },
                        { val: 'blur', label: 'Blur' },
                        { val: 'bounce', label: 'Bounce' },
                        { val: 'rotate', label: 'Rotate' },
                        { val: 'none', label: 'None' },
                      ].map((item) => (
                        <button
                          key={item.val}
                          onClick={() => updateSetting('animationMode', item.val as any)}
                          className={cn(
                            "py-2 rounded text-[10px] uppercase tracking-wider font-bold transition-all border",
                            settings.animationMode === item.val
                              ? "bg-blue-600 border-blue-500 text-white shadow-lg"
                              : "bg-neutral-800 border-neutral-700 text-gray-400 hover:border-neutral-600"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Custom Labels">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Top Label</span>
                      <button
                        onClick={() => updateSetting('showTopText', !settings.showTopText)}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                          settings.showTopText ? "bg-blue-600" : "bg-neutral-700"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            settings.showTopText ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>
                    {settings.showTopText && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                      >
                        <input
                          type="text"
                          placeholder="Type something..."
                          value={settings.topText}
                          onChange={(e) => updateSetting('topText', e.target.value)}
                          className={cn(
                            'w-full px-3 py-2 rounded bg-neutral-800 text-white text-sm',
                            'border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500',
                          )}
                        />
                        {settings.clockFormat === '12h' && settings.ampmPosition === 'top' && (
                          <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                            <p className="text-[10px] text-yellow-500/80 leading-tight">
                              <strong>Note:</strong> Hidden because AM/PM is set to Top.
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>

                  <div className="space-y-3 pt-2 border-t border-neutral-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Bottom Label</span>
                      <button
                        onClick={() => updateSetting('showBottomText', !settings.showBottomText)}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                          settings.showBottomText ? "bg-blue-600" : "bg-neutral-700"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            settings.showBottomText ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>
                    {settings.showBottomText && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                      >
                        <input
                          type="text"
                          placeholder="Type something..."
                          value={settings.bottomText}
                          onChange={(e) => updateSetting('bottomText', e.target.value)}
                          className={cn(
                            'w-full px-3 py-2 rounded bg-neutral-800 text-white text-sm',
                            'border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500',
                          )}
                        />
                        {settings.clockFormat === '12h' && settings.ampmPosition === 'bottom' && (
                          <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                            <p className="text-[10px] text-yellow-500/80 leading-tight">
                              <strong>Note:</strong> Hidden because AM/PM is set to Bottom.
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
              </Section>

              <Section title="Position & Scale">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2 proportional-nums">
                      Scale: {(settings.scale * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.01"
                      value={settings.scale}
                      onPointerDown={() => setIsDragging(true)}
                      onPointerUp={() => setIsDragging(false)}
                      onPointerCancel={() => setIsDragging(false)}
                      onChange={(e) =>
                        updateSetting('scale', parseFloat(e.target.value))
                      }
                      className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2 proportional-nums">
                      Horizontal Position: {settings.offsetX.toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={settings.offsetX}
                      onPointerDown={() => setIsDragging(true)}
                      onPointerUp={() => setIsDragging(false)}
                      onPointerCancel={() => setIsDragging(false)}
                      onChange={(e) =>
                        updateSetting('offsetX', parseFloat(e.target.value))
                      }
                      className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-2 proportional-nums">
                      Vertical Position: {settings.offsetY.toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={settings.offsetY}
                      onPointerDown={() => setIsDragging(true)}
                      onPointerUp={() => setIsDragging(false)}
                      onPointerCancel={() => setIsDragging(false)}
                      onChange={(e) =>
                        updateSetting('offsetY', parseFloat(e.target.value))
                      }
                      className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => updateMultiple({ scale: 1, offsetX: 0, offsetY: 0 })}
                      className="w-full py-2 rounded text-xs font-medium bg-neutral-800 border border-neutral-700 text-gray-400 hover:border-neutral-600 hover:text-gray-200 transition-all"
                    >
                      Reset Position & Scale
                    </button>
                  </div>
                </div>
              </Section>


              <button
                onClick={handleReset}
                className={cn(
                  'w-full py-2.5 px-4 rounded-lg font-semibold transition-all duration-200',
                  'bg-red-500/10 border border-red-500/20 text-red-500',
                  'hover:bg-red-600 hover:text-white hover:border-red-600 hover:shadow-lg hover:shadow-red-900/20',
                  'active:scale-[0.98] outline-none'
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
