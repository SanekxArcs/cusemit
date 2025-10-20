import React from 'react'
import { cn } from '@/lib/cn'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  label?: string
}

const TAILWIND_COLORS = {
  red: [
    '#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444',
    '#dc2626', '#b91c1c', '#7f1d1d', '#450a0a', '#0a0a0a',
  ],
  orange: [
    '#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316',
    '#ea580c', '#c2410c', '#7c2d12', '#431407', '#0a0a0a',
  ],
  amber: [
    '#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b',
    '#d97706', '#b45309', '#78350f', '#451a03', '#0a0a0a',
  ],
  yellow: [
    '#fefce8', '#fffacd', '#fef08a', '#fef3c7', '#fde047', '#facc15',
    '#eab308', '#ca8a04', '#713f12', '#422006', '#0a0a0a',
  ],
  lime: [
    '#f7fee7', '#ecfdf5', '#dcfce7', '#bbf7d0', '#86efac', '#65a30d',
    '#4ade80', '#22c55e', '#16a34a', '#15803d', '#0a0a0a',
  ],
  green: [
    '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e',
    '#16a34a', '#15803d', '#166534', '#0d3b66', '#0a0a0a',
  ],
  emerald: [
    '#f0fdf4', '#d1fae5', '#a7f3d0', '#6ee7b7', '#2dd4bf', '#10b981',
    '#059669', '#047857', '#065f46', '#064e3b', '#0a0a0a',
  ],
  teal: [
    '#f0fdfa', '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4c4', '#14b8a6',
    '#0d9488', '#0f766e', '#134e4a', '#0d3b39', '#0a0a0a',
  ],
  cyan: [
    '#ecf0ff', '#cffafe', '#a5f3fc', '#67e8f9', '#06b6d4', '#0891b2',
    '#0e7490', '#155e75', '#164e63', '#082f49', '#0a0a0a',
  ],
  sky: [
    '#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9',
    '#0284c7', '#0369a1', '#075985', '#0c2d6b', '#0a0a0a',
  ],
  blue: [
    '#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6',
    '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#0a0a0a',
  ],
  indigo: [
    '#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1',
    '#4f46e5', '#4338ca', '#3730a3', '#312e81', '#0a0a0a',
  ],
  violet: [
    '#faf5ff', '#f3e8ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa',
    '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#0a0a0a',
  ],
  purple: [
    '#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7',
    '#9333ea', '#7e22ce', '#6b21a8', '#581c87', '#0a0a0a',
  ],
  fuchsia: [
    '#fdf4ff', '#fae8ff', '#f5d9f5', '#f0abfc', '#e879f9', '#d946ef',
    '#c026d3', '#a21caf', '#831843', '#500724', '#0a0a0a',
  ],
  pink: [
    '#fdf2f8', '#fce7f3', '#fbcfe8', '#f8b4d8', '#f472b6', '#ec4899',
    '#db2777', '#be185d', '#9d174d', '#500724', '#0a0a0a',
  ],
  rose: [
    '#fff5f7', '#ffe4e6', '#fbcfe8', '#f8b4d8', '#f472b6', '#f43f5e',
    '#e11d48', '#be123c', '#9f1239', '#4c0519', '#0a0a0a',
  ],
  slate: [
    '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b',
    '#475569', '#334155', '#1e293b', '#0f172a', '#0a0a0a',
  ],
  gray: [
    '#f9fafb', '#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af', '#6b7280',
    '#4b5563', '#374151', '#1f2937', '#111827', '#0a0a0a',
  ],
  zinc: [
    '#fafafa', '#f4f4f5', '#e4e4e7', '#d4d4d8', '#a1a1aa', '#71717a',
    '#52525b', '#3f3f46', '#27272a', '#18181b', '#0a0a0a',
  ],
  neutral: [
    '#fafafa', '#f5f5f5', '#e5e5e5', '#d4d4d4', '#a3a3a3', '#737373',
    '#525252', '#404040', '#262626', '#171717', '#0a0a0a',
  ],
  stone: [
    '#fafaf9', '#f5f5f4', '#e7e5e4', '#d6d3d1', '#a8a29e', '#78716b',
    '#57534e', '#44403c', '#292524', '#1c1917', '#0a0a0a',
  ],
}

type ColorName = keyof typeof TAILWIND_COLORS

interface ColorOption {
  name: ColorName
  label: string
}

const COLOR_OPTIONS: ColorOption[] = [
  { name: 'red', label: 'Red' },
  { name: 'orange', label: 'Orange' },
  { name: 'amber', label: 'Amber' },
  { name: 'yellow', label: 'Yellow' },
  { name: 'lime', label: 'Lime' },
  { name: 'green', label: 'Green' },
  { name: 'emerald', label: 'Emerald' },
  { name: 'teal', label: 'Teal' },
  { name: 'cyan', label: 'Cyan' },
  { name: 'sky', label: 'Sky' },
  { name: 'blue', label: 'Blue' },
  { name: 'indigo', label: 'Indigo' },
  { name: 'violet', label: 'Violet' },
  { name: 'purple', label: 'Purple' },
  { name: 'fuchsia', label: 'Fuchsia' },
  { name: 'pink', label: 'Pink' },
  { name: 'rose', label: 'Rose' },
  { name: 'slate', label: 'Slate' },
  { name: 'gray', label: 'Gray' },
  { name: 'zinc', label: 'Zinc' },
  { name: 'neutral', label: 'Neutral' },
  { name: 'stone', label: 'Stone' },
]

const SHADE_LABELS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

/**
 * Enhanced Color Picker Component
 * Supports both Tailwind color palette and native color picker
 */
export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  label = 'Color',
}) => {
  const [showPalette, setShowPalette] = React.useState(false)

  const handleColorSelect = (color: string) => {
    onChange(color)
    setShowPalette(false)
  }

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm text-gray-300">{label}</label>

      <div className="flex gap-2">
        {/* Color Preview & Picker Button */}
        <button
          onClick={() => {
            setShowPalette(!showPalette)
          }}
          className="relative w-12 h-10 rounded border border-neutral-700 overflow-hidden hover:border-neutral-600 transition-colors"
          style={{ backgroundColor: value }}
          title={value}
          aria-label="Open color palette"
        >
          <div className="absolute inset-0 border border-white/20" />
        </button>

        {/* Custom Color Input */}
        <input
          type="color"
          value={value}
          onChange={handleCustomColorChange}
          className="w-12 h-10 rounded cursor-pointer border border-neutral-700"
          title="Custom color picker"
        />

        {/* Display Current Color */}
        <div className="flex-1 flex items-center">
          <input
            type="text"
            value={value}
            readOnly
            className="w-full px-3 py-2 rounded bg-neutral-800 text-xs text-gray-300 border border-neutral-700 font-mono"
          />
        </div>
      </div>

      {/* Palette Modal */}
      {showPalette && (
        <div className="absolute inset-0 z-50" onClick={() => setShowPalette(false)}>
          <div
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-neutral-900 border border-neutral-700 rounded-lg p-4 max-h-[90vh] overflow-y-auto max-w-2xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Select Color</h3>
              <button
                onClick={() => setShowPalette(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* Color Grid */}
            <div className="space-y-3">
              {COLOR_OPTIONS.map((option) => (
                <div key={option.name}>
                  <p className="text-xs font-medium text-gray-400 mb-2 capitalize">
                    {option.label}
                  </p>
                  <div className="grid grid-cols-11 gap-1">
                    {TAILWIND_COLORS[option.name].map((color, idx) => (
                      <button
                        key={`${option.name}-${idx}`}
                        onClick={() => handleColorSelect(color)}
                        className={cn(
                          'h-8 rounded border-2 transition-all hover:scale-110',
                          value === color
                            ? 'border-white ring-2 ring-white'
                            : 'border-transparent hover:border-gray-400'
                        )}
                        style={{ backgroundColor: color }}
                        title={`${option.label} ${SHADE_LABELS[idx]}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowPalette(false)}
              className="mt-4 w-full px-3 py-2 bg-neutral-800 text-white text-sm rounded hover:bg-neutral-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
