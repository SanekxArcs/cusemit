# Cusemit

A fullscreen clock for everyday use, including Android PWA installation.

## Customize

The side rail opens AMOLED, Background, Clock, Display, and Positioning panels. Changes apply immediately and save on this device. Timers and About use the same controls.

- **Automatic positioning** measures the visible ink of each glyph, fits both viewport dimensions, and includes seconds, AM/PM, labels, outlines, and pixel-shift clearance. Edge spacing is measured in CSS pixels inside device safe areas. Rotation swaps the available dimensions before fitting.
- **Manual** retains independent scale and X/Y offsets. **Floating** supports dragging, two-finger resizing/rotation, and sliders. Changing modes retains the other mode's values.
- **Fonts** can be previewed with the arrows or collection list. Add a Google Fonts family by name and save it offline. A saved indicator requires cached CSS metadata and every downloaded font file; browser storage clearing or eviction can remove saved files.
- **Backgrounds** include solid colors, gradients, local images, and texture overlays. AMOLED always uses a black base and hides base-color controls; optional textures/images still light pixels. Uploads are resized and stored locally.
- **Display** contains time format, seconds, colon pulse, digit animation, rotation, fullscreen, auto-hide, and labels. Timer and AM/PM labels take priority at a shared position.

## Syncing settings between devices

About holds a sync panel backed by [Convex](https://convex.dev). Pressing **Create a sync code** stores this device's appearance settings under an eight-character code; entering that code on another device downloads them. Both devices then share the slot and can upload or download from it.

Nothing transfers on its own. There is no polling, no subscription, and no connection held open — the app talks to Convex only while an Upload or Download button is being pressed, and Upload is disabled unless the syncable settings actually changed since the last sync.

**AMOLED**, **Background**, **Clock**, and **Display** settings travel, along with saved fonts and custom colors. **Positioning**, the uploaded background image and its framing, and timers stay on each device, because a wall tablet and a phone share a look rather than a layout. `src/lib/syncableSettings.ts` holds the exact key list; a device on an older build ignores keys it does not know and keeps its own value for anything the payload omits.

Each upload bumps a revision. If another device uploaded since this one last synced, the upload is refused and the panel offers a download or a deliberate replace, so a stale device cannot quietly overwrite newer settings. A code is the whole credential — anyone holding it can read and write that slot — so treat it like a shared password and disconnect when done.

### Setting it up

```sh
npx convex dev          # provisions a deployment, writes .env.local, watches convex/
```

`convex/schema.ts` and `convex/settings.ts` hold the backend; `convex/_generated` is codegen and should not be edited. Copy `.env.example` to `.env` and fill in `CONVEX_DEPLOY_KEY` to deploy. Production builds need `VITE_CONVEX_URL` at build time, either from the host's environment variables or by wrapping the build: `npx convex deploy --cmd 'npm run build'`. Without that variable the sync panel reports that sync is unavailable and the rest of the app works unchanged.

Existing settings and timer configuration use the original localStorage key. New installs and migrated settings default to automatic fit; prior manual values remain available. Countdown timer runtime is not persisted across reloads.

## Development

```sh
npm install
npm run dev      # the app
npm run convex   # in a second terminal, to work on convex/
```

## Voice timers

Use the **Voice** microphone on the clock rail, or **Timers → Voice timer**. Paste your own Google AI Studio API key, tap **Record command**, speak, then tap **Stop & interpret**. Review the transcript, name and duration/target time before choosing **Create & start timer**. Nothing is created automatically.

Examples: “Set a tea timer for 5 minutes”, “Set a timer for 30 seconds”, “Set a timer for 18:30”, “Постав таймер на 10 хвилин”, or “Ustaw minutnik na 5 minut”. The parser is instructed to understand Ukrainian, Polish and English. Clock-time requests use the device timezone and the next occurrence unless a date is explicitly given; ambiguous commands are rejected. Durations support seconds, pause and reset; target-date timers count down automatically through the existing alarm flow.

The feature calls `gemini-3.5-flash-lite` directly from the browser using audio input and a structured JSON response. Google currently lists free-tier input/output for this model, subject to project quotas, model access and regional availability. A key attached to a billed project can incur charges; the app cannot enforce a free-only billing policy. See Google's [model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [pricing/data-use terms](https://ai.google.dev/gemini-api/docs/pricing) and [API key setup](https://aistudio.google.com/apikey).

**Privacy:** the key lives only in React memory until reload, closing the tab, or **Forget key**. It is not placed in app settings, local/session storage, sync codes, a server environment variable, logs, or URLs. Each user supplies their own key; never ship a shared key in a frontend build. Restrict your key to the Gemini API and your site's HTTP referrers where supported. Audio is sent to Google only after recording is stopped (including the automatic 15-second limit); no audio/transcript is persisted locally. Google may use free-tier content to improve its products. The timer name and timer settings are saved normally.

Requires internet, microphone permission, and a browser with MediaRecorder on HTTPS or localhost. Cancel, close, switching panels or hiding the tab stops the microphone and aborts in-flight interpretation; pending permissions and stale responses cannot create timers. Recordings are limited to 15 seconds / 8 MiB; requests time out after 30 seconds. Quota, key/access, connection and interpretation errors do not change existing timers. This is push-to-talk timer creation, not always-on listening or a safety-critical alarm service.

## Validation

```sh
npm run build
npm test
```

Tests use installed Chrome and a local production preview, and require internet for the initial Google Fonts downloads. They check actual screenshot pixel boundaries across fonts, portrait/landscape, rotations and labels; settings persistence; timers; image import; and offline reload with a saved font and image. Offline behavior is tested against the production build because service workers are not registered in development.

A production build creates a versioned service worker with the complete app shell. The saved-font cache survives app updates. An update prompt lets the user choose when to reload.

A physical Android device is still needed to verify system-controlled fullscreen, browser chrome, display cutouts, wake lock, and multi-touch behavior on that device.

## SEO and link previews

The canonical site is `https://cusemit.o-d.dev/`. Initial HTML includes the page title, description, canonical URL, Open Graph and Twitter metadata, and WebApplication structured data. `public/robots.txt` and `public/sitemap.xml` use the same domain.

`/api/og` is a Vercel Node.js function returning a 1200 × 630 PNG with the UTC time and date at generation. It runs only when the image is requested; the CDN can reuse it for 60 seconds. Social platforms cache link previews independently, so an existing shared image does not tick or necessarily refresh every minute. The image cannot read a visitor's local clock settings or timezone.

The same endpoint works with `npm run dev` and `npm run preview`. Static hosting alone cannot run it. Deploy this repository to Vercel with its root `api/` directory, not only `dist/`. The generated static `public/og-image.png` is a fallback if rendering fails. The service worker excludes API requests so image navigation cannot return cached app HTML.

The image renderer is pinned to `@vercel/og` 0.8.6: version 1.0.2 failed during native Node ESM initialization (`Dynamic require of "fs" is not supported`). No remote fonts or images are fetched when rendering a card.
