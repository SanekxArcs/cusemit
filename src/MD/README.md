# Digital Clock App

A minimal, fullscreen digital clock web app with customizable settings, AMOLED/OLED burn-in mitigation, and smooth animations.

## Features

### Core

- **Fullscreen Display**: Shows current time in HH:MM (24h) format by default with proportionally scaled responsive typography
- **Responsive Design**: Clock text stretches to fill viewport, centered on both axes with configurable padding
- **Settings Panel**: Top-right gear icon opens a slide-in settings panel with full customization options
- **Smooth Animations**: All transitions use framer-motion with spring physics and reduced-motion support

### Customization

- **Background Modes**:
  - Solid color picker
  - Gradient (start/end colors) with optional animated gradient
  - Pure black AMOLED saver mode
  
- **Clock Appearance**:
  - Clock color picker
  - Font selection from curated Google Fonts: Inter, Roboto, JetBrains Mono, Space Grotesk, Orbitron
  - Custom Google Font support via input field
  - Padding X and Y controls (0.0–3.0rem in 0.25rem increments)
  
- **Display Options**:
  - Show/hide seconds toggle
  - 12-hour or 24-hour format toggle
  
- **AMOLED/OLED Saver**:
  - Forces pure black (#000000) background
  - Enables periodic sub-pixel jitter (1–3px drift every 45 seconds)
  - Automatically disables animated gradients
  - Respects system `prefers-reduced-motion` preference
  - Pauses drift when settings sheet is open or window is not visible

### Data Persistence

- All settings are saved to `localStorage` under the key `app.clock.settings.v1`
- Settings auto-save with 500ms debounce to prevent excessive writes
- Reset to defaults button restores all original settings

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS v4 (with new `@import "tailwindcss"` syntax)
- **State Management**: Zustand (with localStorage persistence)
- **Animations**: Framer Motion
- **UI Utilities**: Sonner (toast notifications), clsx/tailwind-merge
- **Font Loading**: Dynamic Google Fonts injection via `<link>` tags

## Project Structure

```
src/
├── App.tsx                 # Main app orchestrator
├── main.tsx               # React root entry
├── components/
│   ├── Clock.tsx          # Time display component
│   ├── GearButton.tsx     # Settings toggle button
│   └── SettingsSheet.tsx  # Settings panel UI
├── store/
│   └── settings.ts        # Zustand store with localStorage persistence
├── lib/
│   ├── cn.ts              # clsx + tailwind-merge utility
│   ├── fonts.ts           # Google Fonts loader
│   └── amoledSaver.ts     # Drift logic and motion preferences
└── styles/
    └── globals.css        # Tailwind CSS setup
```

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will start at `http://localhost:5173/`

### Production Build

```bash
npm run build
npm run preview
```

## Usage

1. **View Time**: Open the app to see the current time in fullscreen
2. **Adjust Settings**: Click the gear icon (⚙️) in the top-right corner
3. **Customize**:
   - Change background color/gradient
   - Adjust clock color and font
   - Modify padding
   - Toggle seconds and time format
   - Enable AMOLED saver for OLED displays
4. **Save**: Settings auto-save to localStorage
5. **Reset**: Click "Reset to Defaults" to restore original settings

## Implementation Details

### Time Updates

- **Default**: Updates every 60 seconds (minute tick)
- **With Seconds**: Updates every 1 second when seconds are enabled
- Uses `setInterval` for efficient updates, clears on component unmount

### Font Loading

- Google Fonts are dynamically loaded via `<link rel="stylesheet">` injection
- Fonts are cached in `document.head` with a `data-font` attribute to avoid duplicate loads
- Custom fonts are validated and fallback to a safe default font stack on error
- Uses `display=swap` parameter for optimal font loading

### AMOLED Drift Logic

- Generates random 1–3px offsets every 45 seconds
- Smoothly animates drift transitions using framer-motion (300ms duration)
- **Paused when**:
  - AMOLED saver is disabled
  - User prefers reduced motion
  - Settings sheet is open
  - Window is not visible (checked via `visibilitychange` event)

### Settings Persistence

- Single JSON object stored under `app.clock.settings.v1`
- 500ms debounce prevents excessive localStorage writes
- Graceful fallback to defaults if JSON parsing fails
- Automatic migration-friendly structure for future versions

### Animations

- **Settings Sheet**: Slide-in from right with spring physics (stiffness: 300, damping: 30)
- **Gear Icon**: 20–30° rotation on open
- **Color/Font Transitions**: 300ms ease-in-out
- **Drift**: 300ms ease-in-out positioning transitions
- **Reduced Motion**: Disables all non-essential animations when `prefers-reduced-motion: reduce` is set

### Responsive Typography

```css
font-size: clamp(48px, 12vw, 30vh)
```

Ensures readable clock across all devices from mobile to ultra-wide displays.

## Browser Support

- Modern browsers supporting ES2020, CSS Grid, and CSS custom properties
- Tailwind CSS v4 (requires modern CSS support)
- Google Fonts via HTTPS

## Performance Considerations

- Lazy-loads Google Fonts only when selected
- Efficient time updates with appropriate intervals
- Drift animations paused when not needed
- Settings debounced to minimize localStorage access
- No polling; uses event listeners for visibility changes

## Accessibility

- Keyboard navigation in settings panel
- Focus visible on buttons and inputs
- Semantic HTML elements
- ARIA labels on icon buttons
- Respects system motion preferences

## Future Enhancements

- Color presets/themes
- Custom drift interval settings
- Analog clock mode
- Multiple time zones
- Alarm functionality
- Sound effects with volume control
- Export/import settings as JSON

## License

MIT