# ⚡ Quick Reference Card

One-page cheat sheet for everything you need to know about Digital Clock v1.1.0

---

## 🎯 Essential Commands

```bash
npm install              # Install dependencies
npm run dev             # Start development server (http://localhost:5173)
npm run build           # Create production build
npm run preview         # Preview production build
npm run lint            # Check code quality (if configured)
```

---

## 🖱️ User Guide (30 seconds)

### Basic Usage:
1. **View time** - Clock displays current time fullscreen
2. **Open settings** - Click ⚙️ gear icon (top-right)
3. **Customize** - Change colors, fonts, format
4. **Close** - Click outside or press ESC

### Color Settings:
- Click **any color setting**
- Choose from **242 Tailwind colors** or custom
- Color updates **instantly**
- Auto-**saves** to localStorage

### Install as App:
- Tap **Install** button (browser)
- Add to **home screen**
- Works **offline**
- Survives **app store**

---

## 🎨 Settings Overview

| Setting | Options | Default |
|---------|---------|---------|
| **Format** | 24h / 12h | 24h |
| **Seconds** | Show / Hide | Hide |
| **Background** | Solid / Gradient | Solid |
| **Background Color** | 242 colors | Black |
| **Gradient Colors** | Start/End | Blue/Purple |
| **Gradient Animation** | On / Off | Off |
| **Clock Color** | 242 colors | White |
| **Font** | 19 fonts | Inter |
| **Custom Font** | Google Font name | (empty) |
| **Padding X** | 0-3rem | 1rem |
| **Padding Y** | 0-3rem | 1rem |
| **AMOLED Saver** | On / Off | Off |

---

## 🌈 Color Picker Quick Guide

### 22 Color Families:
- **Warm**: Red, Orange, Amber, Yellow, Lime
- **Cool**: Green, Emerald, Teal, Cyan, Sky, Blue
- **Purple**: Indigo, Violet, Purple, Fuchsia, Pink, Rose
- **Gray**: Slate, Gray, Zinc, Neutral, Stone

### 11 Shades Each:
- **50, 100**: Very light (backgrounds)
- **200-300**: Light (secondary)
- **400-600**: Medium (primary)
- **700-800**: Dark (text)
- **900-950**: Very dark (OLED)

### Quick Combos:
```
Dark Theme:    Slate-900 bg + Blue-50 text
Light Theme:   Neutral-50 bg + Slate-950 text
OLED Mode:     Neutral-950 bg + Neutral-50 text
Green Matrix:  Neutral-950 bg + Green-400 text
```

---

## 📱 PWA Installation

### Android:
```
1. Open in Chrome
2. Tap Install (or menu)
3. Confirm
4. Icon on home screen
```

### iPhone:
```
1. Open in Safari
2. Share → Add to Home Screen
3. Confirm
4. Icon on home screen
```

### Windows/macOS:
```
1. Click Install button
2. Confirm
3. Dedicated window + taskbar
```

### Key Features:
- ✅ Works offline
- ✅ Settings sync
- ✅ Auto-updates
- ✅ Fullscreen display

---

## 📂 File Structure

```
src/
├── App.tsx                    Main component
├── components/
│   ├── Clock.tsx             Time display
│   ├── GearButton.tsx        Settings toggle
│   ├── SettingsSheet.tsx     Settings panel ⭐
│   ├── ColorPicker.tsx       Color selector ⭐ NEW
│   └── PWAPrompt.tsx         Install prompt ⭐ NEW
├── store/settings.ts         State (15 properties)
├── lib/
│   ├── cn.ts                 Class utility
│   ├── fonts.ts              Font loader
│   └── amoledSaver.ts        Drift generation
├── hooks/usePWA.ts           PWA lifecycle ⭐ NEW
└── styles/globals.css        Global styles

public/
├── manifest.json             PWA metadata ⭐ NEW
└── sw.js                     Service Worker ⭐ NEW
```

---

## 🔧 Configuration Files

| File | Purpose | Editable |
|------|---------|----------|
| `package.json` | Dependencies, scripts | ⚠️ Scripts only |
| `vite.config.ts` | Vite settings | ⚠️ Advanced |
| `tailwind.config.ts` | Tailwind theme | ✅ Add colors/fonts |
| `tsconfig.json` | TypeScript settings | ⚠️ Advanced |
| `postcss.config.cjs` | PostCSS plugins | ⚠️ Advanced |
| `public/manifest.json` | PWA metadata | ✅ App name, colors |
| `index.html` | HTML entry | ⚠️ Advanced |

---

## 🎨 Customization Examples

### Change App Name:
Edit `public/manifest.json`:
```json
{
  "name": "My Clock",
  "short_name": "Clock"
}
```

### Add Custom Font:
In settings:
1. Click Font
2. Enter Google Font name
3. Press Enter

Example names:
- Poppins
- Roboto Mono
- Space Grotesk
- Playfair Display

### Set Default Colors:
Edit `src/store/settings.ts`:
```typescript
clockColor: '#fff3ff',      // Light pink
backgroundColor: '#030712', // Very dark slate
```

---

## 📊 Bundle Sizes

| Asset | Size | Gzipped |
|-------|------|---------|
| JavaScript | 323.88 KB | 104.10 KB |
| CSS | 19.15 KB | 4.45 KB |
| **Total** | **343 KB** | **108 KB** |

---

## 🌐 Browser Support

| Browser | Desktop | Mobile | Install | Offline |
|---------|---------|--------|---------|---------|
| Chrome | ✅ | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ | ✅ |
| Firefox | ⚠️ | ✅ | ⚠️ | ✅ |
| Safari | ❌ | ✅ | ⚠️ | ✅ |
| Opera | ✅ | ✅ | ✅ | ✅ |

---

## 🆘 Troubleshooting

### App Not Loading?
- Check browser console (F12)
- Verify HTTP/HTTPS
- Clear browser cache
- Try different browser

### Settings Not Saving?
- Enable localStorage
- Check browser settings
- Not in private browsing
- Enough storage space

### PWA Not Installing?
- Need HTTPS (except localhost)
- manifest.json must be valid
- Service Worker must register
- Browser must support PWA

### Fonts Not Loading?
- Need internet first time
- Valid Google Font name
- Check browser console
- Try simpler font name

### Colors Look Wrong?
- Check display color profile
- Adjust screen brightness
- Try different shade
- Check contrast ratio

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **⚙️ Click** | Open Settings |
| **ESC** | Close Settings |
| **Tab** | Navigate controls |
| **Enter** | Confirm selection |
| **Arrow keys** | Adjust sliders |

---

## 🚀 Deployment Checklist

- [ ] Run `npm run build`
- [ ] Create custom icons (192×192, 512×512 PNG)
- [ ] Add icons to `public/`
- [ ] Update `public/manifest.json`
- [ ] Deploy `dist/` folder
- [ ] Use HTTPS
- [ ] Test PWA installation
- [ ] Test offline functionality
- [ ] Share with users

---

## 📚 Documentation Map

| Document | When to Read |
|----------|-------------|
| **README.md** | Want overview |
| **QUICKSTART.md** | Getting started |
| **UPDATES.md** | What's new |
| **COLOR_PICKER_GUIDE.md** | About colors |
| **PWA_SETUP_GUIDE.md** | About PWA |
| **IMPLEMENTATION.md** | Technical details |
| **PROJECT_SUMMARY.md** | Metrics & stats |
| **FILE_STRUCTURE.md** | Code organization |

---

## 🎓 Key Concepts

### State Management (Zustand):
- 15 properties stored in localStorage
- Auto-saves with 500ms debounce
- Survives refresh and PWA install
- Reset to defaults available

### Animations (Framer Motion):
- Spring physics on settings panel
- Smooth 300ms transitions
- Respects `prefers-reduced-motion`
- 60fps performance

### Colors:
- 242 Tailwind colors available
- 11 shades per color family
- Native picker fallback
- Hex code support

### PWA:
- Installable on all platforms
- Offline caching via Service Worker
- Auto-update checking
- Settings sync

---

## 💡 Pro Tips

1. **For OLED Screens**: Use Slate-950 + high contrast text
2. **For Reading**: Use high contrast (900/50 or 950/50)
3. **For Display**: Use mid-shade colors (400-600)
4. **For Nighttime**: Enable AMOLED Saver for drift
5. **For Sharing**: PWA link works on all devices
6. **For Customization**: Edit manifest.json for app appearance
7. **For Performance**: Disable AMOLED drift if not needed
8. **For Offline**: Open app once online, then works offline

---

## 📞 Quick Links

- **GitHub**: [Add your repo URL]
- **Live Demo**: [Add your deployment URL]
- **Tailwind Colors**: https://tailwindcss.com/docs/colors
- **Google Fonts**: https://fonts.google.com
- **PWA Guide**: https://web.dev/progressive-web-apps/

---

## ✅ Feature Checklist

- ✅ Fullscreen clock
- ✅ 24/12 hour format
- ✅ Seconds optional
- ✅ Custom padding
- ✅ 242 colors
- ✅ 19 fonts
- ✅ Solid/Gradient bg
- ✅ AMOLED saver
- ✅ localStorage persist
- ✅ Animations
- ✅ Accessibility
- ✅ PWA install
- ✅ Offline support
- ✅ Mobile responsive
- ✅ Production ready

---

**Version**: 1.1.0  
**Status**: ✅ Production Ready  
**Last Updated**: October 20, 2025

Print this page for quick reference! 🖨️
