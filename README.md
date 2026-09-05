# Cusemit

A fullscreen clock for everyday use, including Android PWA installation.

## Customize

The side rail opens AMOLED, Background, Clock, Display, and Positioning panels. Changes apply immediately and save on this device. Timers and About use the same controls.

- **Automatic positioning** measures the visible ink of each glyph, fits both viewport dimensions, and includes seconds, AM/PM, labels, outlines, and pixel-shift clearance. Edge spacing is measured in CSS pixels inside device safe areas. Rotation swaps the available dimensions before fitting.
- **Manual** retains independent scale and X/Y offsets. **Floating** supports dragging, two-finger resizing/rotation, and sliders. Changing modes retains the other mode's values.
- **Fonts** can be previewed with the arrows or collection list. Add a Google Fonts family by name and save it offline. A saved indicator requires cached CSS metadata and every downloaded font file; browser storage clearing or eviction can remove saved files.
- **Backgrounds** include solid colors, gradients, local images, and texture overlays. AMOLED always uses a black base and hides base-color controls; optional textures/images still light pixels. Uploads are resized and stored locally.
- **Display** contains time format, seconds, colon pulse, digit animation, rotation, fullscreen, auto-hide, and labels. Timer and AM/PM labels take priority at a shared position.

Existing settings and timer configuration use the original localStorage key. New installs and migrated settings default to automatic fit; prior manual values remain available. Countdown timer runtime is not persisted across reloads.

## Development

```sh
npm install
npm run dev
```

## Validation

```sh
npm run build
npm test
```

Tests use installed Chrome and a local production preview, and require internet for the initial Google Fonts downloads. They check actual screenshot pixel boundaries across fonts, portrait/landscape, rotations and labels; settings persistence; timers; image import; and offline reload with a saved font and image. Offline behavior is tested against the production build because service workers are not registered in development.

A production build creates a versioned service worker with the complete app shell. The saved-font cache survives app updates. An update prompt lets the user choose when to reload.

A physical Android device is still needed to verify system-controlled fullscreen, browser chrome, display cutouts, wake lock, and multi-touch behavior on that device.
