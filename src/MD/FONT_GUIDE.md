# 🎯 Quick Feature Guide

## Font Search - How It Works

```
┌─────────────────────────────────────────┐
│ Settings (⚙️) → Clock Appearance        │
├─────────────────────────────────────────┤
│                                         │
│  Font (Search)                          │
│  ┌───────────────────────────────────┐  │
│  │ Search fonts... (type here)       │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ Inter                             │  │
│  │ Roboto         (← currently shown)│  │
│  │ Poppins                           │  │
│  │ Montserrat     (← scroll to see)  │  │
│  │ Open Sans                         │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### Examples of Searching

| Type This | Shows Fonts |
|-----------|------------|
| "robot" | Roboto |
| "mono" | JetBrains Mono, IBM Plex Mono, Source Code Pro, Fira Mono |
| "sans" | Inter, Roboto, Poppins, Montserrat, Open Sans, Lato, Raleway, Ubuntu |
| "serif" | Playfair Display, Merriweather, Lora |
| "play" | Playfair Display |
| "jetb" | JetBrains Mono |

## Text Width Fitting - Visual Example

### Before (Manual CSS clamp)
```
Screen Width: 1920px
Padding X: 1rem → Clock text: 22vw
Problem: Doesn't account for padding perfectly
```

### After (Smart JavaScript sizing)
```
Screen Width: 1920px
Padding X: 1rem (16px each side)
Available: 1920px - 32px = 1888px
Font Size: Calculated to fit exactly!
Result: Perfect fit with custom padding ✅
```

## All 19 Available Fonts

### Display Category (Large, Eye-catching)
```
Space Grotesk   → Modern, geometric
Orbitron        → Futuristic, bold
Bebas Neue      → Strong, uppercase
Fredoka One     → Friendly, rounded
Righteous       → Bold, decorative
```

### Sans-serif Category (Clean, modern)
```
Inter          → Professional
Roboto         → Versatile
Poppins        → Friendly, modern
Montserrat     → Bold, trendy
Open Sans      → Readable
Lato           → Warm, approachable
Raleway        → Elegant, thin
Ubuntu         → Technical
```

### Serif Category (Classic, elegant)
```
Playfair Display → Luxury, editorial
Merriweather     → Book-like, readable
Lora             → Warm, elegant
```

### Monospace Category (Code-like, technical)
```
JetBrains Mono    → Developer-friendly
IBM Plex Mono     → Professional code
Source Code Pro   → Adobe standard
Fira Mono         → Mozilla standard
```

## Step-by-Step Usage

### 1. Open Settings
```
Click the ⚙️ gear icon in top-right corner
```

### 2. Find Font Section
```
Scroll to "Clock Appearance" section
```

### 3. Search for Font
```
Click "Font (Search)" input field
Type any part of a font name
Dropdown opens automatically
See preview of each font
```

### 4. Adjust Padding
```
After selecting font, scroll to "Padding" section
Use sliders for Padding X and Y
Watch clock text resize automatically!
Font size adapts to fit the new padding
```

### 5. Save Settings
```
Settings auto-save in localStorage
Close settings panel (X button or ESC)
Your choices are preserved!
```

## Responsive Behavior

### Mobile (320px width)
- Font search works perfectly
- Text fits within phone screen
- Swipe-friendly dropdown
- Full access to all fonts

### Tablet (768px width)
- More space for font preview
- Larger dropdown
- More font names visible at once

### Desktop (1920px width)
- Full 19-font collection at your disposal
- Large, readable font previews
- Smooth interactions

## Performance Notes

✅ **Fast**
- Font search is instant
- No network delay for search
- Fonts only load when selected

✅ **Smooth**
- Text resize is smooth (ResizeObserver)
- No jumpy animations
- Respects prefers-reduced-motion

✅ **Smart**
- Automatically recalculates on resize
- Padding changes trigger instant update
- ResizeObserver cleans up on unmount

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `type` | Filter fonts |
| `↓` / `↑` | Navigate dropdown (native) |
| `Enter` | Select font |
| `Escape` | Close dropdown (press twice) |
| `Tab` | Navigate to next setting |

## Troubleshooting

**Q: Search not showing results?**
A: Make sure you're typing in the search box, not the custom font field below

**Q: Font loading slowly?**
A: First load takes ~1 second per font. Google Fonts API is fast but has network latency

**Q: Text too small/big on padding change?**
A: Wait 100ms for ResizeObserver to calculate. It updates automatically

**Q: Which fonts work best with AMOLED saver?**
A: Monospace fonts (JetBrains Mono, IBM Plex Mono) and display fonts (Orbitron) look great!

---

**Ready to explore all 19 fonts!** 🚀
