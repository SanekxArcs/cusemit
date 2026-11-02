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

**AMOLED**, **Background**, **Clock**, and **Display** settings travel, along with saved fonts, custom colors and the Gemini API key. **Positioning**, the uploaded background image and its framing, and timers stay on each device, because a wall tablet and a phone share a look rather than a layout. `src/lib/syncableSettings.ts` holds the exact key list; a device on an older build ignores keys it does not know and keeps its own value for anything the payload omits.

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

Open **Voice settings**, paste your own Google AI Studio API key and choose **Check key**. Once verified, the microphone appears separately in the bottom-left corner while online. It hides with the sidebar after 10 seconds of inactivity (when auto-hide is enabled), but stays visible during recording/processing. Choose **Hold to talk** to record while pressing and release to send, or leave it off to tap once to start and again to stop. Live microphone waves appear above the button, followed by a processing spinner. A successful command immediately creates and starts its timer, without a confirmation step. The dark notification shows the timer name and duration/target, with **Undo** for 10 seconds to remove only that timer.

Examples: “Set a tea timer for 5 minutes”, “Set a timer for 30 seconds”, “Set a timer for 18:30”, “Постав таймер на 10 хвилин”, or “Ustaw minutnik na 5 minut”. The parser is instructed to understand Ukrainian, Polish and English. Clock-time requests use the device timezone and the next occurrence unless a date is explicitly given; ambiguous commands are rejected. Durations support seconds, pause and reset; target-date timers count down automatically through the existing alarm flow.

Before upload, the browser decodes each recording and repackages its active audio channel as a complete 16 kHz mono PCM WAV. Empty, corrupt, digitally silent or very short recordings get a local microphone/recording error without using Gemini quota. Quiet audio is not treated as silence. A timer name is optional: a valid timer with no model-supplied name uses “Timer”. If speech was transcribed but the time is unclear, the notification shows what Gemini heard instead of claiming the microphone heard nothing.

The feature calls `gemini-3.5-flash-lite` directly from the browser using audio input and a structured JSON response. Google currently lists free-tier input/output for this model, subject to project quotas, model access and regional availability. A key attached to a billed project can incur charges; the app cannot enforce a free-only billing policy. See Google's [model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [pricing/data-use terms](https://ai.google.dev/gemini-api/docs/pricing) and [API key setup](https://aistudio.google.com/apikey).

**Privacy:** the key is saved immediately in this browser’s localStorage and included in manual settings sync. Browser storage is not encrypted and sync is not end-to-end encrypted: anyone with the sync code can retrieve or replace the key. Keep the code private. **Forget key** removes the local copy; upload changes to remove the synced copy, then download on other devices to clear theirs. Disconnecting does not delete the remote copy. Older payloads without a key preserve this device’s key. The key is never placed in URLs, logs or server environment variables. Each user supplies their own key; never ship a shared key in a frontend build. Restrict your key to the Gemini API and your site's HTTP referrers where supported. Audio is sent to Google only after recording is stopped (including the automatic 15-second limit); no audio/transcript is persisted locally. Google may use free-tier content to improve its products. The timer name and timer settings are saved normally.

Requires internet, microphone permission, and a browser with MediaRecorder on HTTPS or localhost. The recording-mode preference is stored only on this device; the saved key is automatically checked after reload, reconnecting and importing a key. These checks never record audio. Going offline, Cancel, Escape, opening settings/timers, losing window focus or hiding the tab stops the microphone and aborts in-flight interpretation; pending permissions and stale responses cannot create timers. Recordings are limited to 15 seconds / 8 MiB; requests time out after 30 seconds. Quota, key/access, connection and interpretation errors do not change existing timers. Push-to-talk is the default; optional hands-free listening is described below. This is not a safety-critical alarm service.

## Hands-free timers (experimental)

1. Open **Voice settings**, save and verify your Gemini key. No separate wake-word account or API key is needed.
2. Choose **Hey Clock** (recommended), **Computer**, or experimental **Hey Cusemit**. Presets use the bundled English model and pre-tokenized phrase text; no voice-example recording, training or model import is required. Say the wake phrase in English; the command can use a language understood by Gemini.
3. Enable **Hands-free listening** and close settings. The first start loads about 21 MB of runtime/model assets; allow up to 90 seconds on a slow connection. Say the wake phrase, wait for the short cue, then speak your timer command. After **1.5 seconds of silence**, Gemini interprets it, the timer starts automatically and the **Undo** toast appears. Silence is adjustable from 1 to 3 seconds.

Waiting audio is processed locally by **sherpa-onnx** in a dedicated worker, never sent to Gemini or stored. Only the post-activation command is retained in memory and uploaded to Gemini. The microphone remains open while armed. An energy/noise-floor detector ends capture; it is not speaker identification or a neural VAD. Noise can trigger false wakes or delay sending. Commands have a 15-second cap; no sustained sound after 5 seconds is discarded without Gemini. The microphone button can start/send a command on the same stream.

The microphone/status indicator and Stop remain visible even when other controls hide. Stop, Escape, offline, focus loss, hidden/leaving page, and microphone/engine errors stop listening and cancel pending results. Opening settings/timers pauses listening; closing them resumes it while enabled. Reloading requires explicit opt-in. Daily maintenance reload is deferred while enabled or processing. Background/locked-screen operation is not guaranteed.

Runtime and model files are self-hosted, loaded only after opt-in, and excluded from app-shell precache. There are no wake-word license-server requests. Phrase/silence preferences stay on this device; legacy Picovoice credentials and .ppn models are removed from localStorage on migration. Requires HTTPS/localhost, microphone permission, Web Audio, workers and a modern WebAssembly SIMD-capable browser. The worker is single-threaded (no cross-origin isolation requirement). Models add CPU/memory cost; old Android phones may be slow or unsupported. Audio backlog is bounded and stops the session instead of building an unbounded queue. All runtime/model versions, source URLs, SHA256 archive hashes and licensing are in public/voice/sherpa/NOTICE.md and LICENSE.

Tests cover actual WASM/model initialization, a bundled upstream speech sample, silence timing, cancellation, resource cleanup, credential migration, repeated commands and timer/Undo flow. App flow tests use synthetic PCM and mocked wake/Gemini events. These do not establish recognition accuracy for the preset phrases, especially the invented name “Cusemit”, or physical OnePlus/all-day performance. Try **Hey Clock** on the target device first.

## All-day displays and recovery

Clock updates have a single lifecycle-aware owner. The clock immediately re-reads the device time on visibility/focus, page restoration and browser resume; a five-second watchdog restarts a ticker that stopped delivering updates. Recovery rebuilds animated digits without reloading the page or resetting running countdowns. Screen wake locks are reacquired after a system release while visible, with a one-second retry after release and a 30-second backoff if the browser refuses a request. Hidden/frozen pages release their lock and stop clock ticks until resumed.

This cannot force Android to run a fully suspended or killed browser process, prevent every GPU/compositor failure, or bypass OS power policies. A screen wake lock keeps the display on; it is not a CPU/system wake lock. Recovery applies once JavaScript is allowed to run again. See Chrome's [page lifecycle documentation](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) and [screen wake lock documentation](https://developer.chrome.com/docs/capabilities/web-apis/wake-lock). A physical-device all-day soak test is still needed for device-specific failures, especially on older Android phones. The existing daily 04:00 reload remains separate and is deferred while countdowns run, a voice command is busy or hands-free listening is enabled.

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
