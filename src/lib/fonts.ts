/**
 * Curated list of Google Fonts to load dynamically.
 */
export const CURATED_FONTS = [
  // Sans-serif
  { label: 'Inter', value: 'Inter', weights: [400, 500, 600, 700] },
  { label: 'Roboto', value: 'Roboto', weights: [400, 500, 700] },
  { label: 'Poppins', value: 'Poppins', weights: [400, 500, 600, 700] },
  { label: 'Montserrat', value: 'Montserrat', weights: [400, 500, 600, 700] },
  { label: 'Open Sans', value: 'Open+Sans', weights: [400, 500, 600, 700] },
  { label: 'Lato', value: 'Lato', weights: [400, 700, 900] },
  { label: 'Raleway', value: 'Raleway', weights: [400, 500, 600, 700] },
  { label: 'Ubuntu', value: 'Ubuntu', weights: [400, 500, 700] },

  // Serif
  {
    label: 'Playfair Display',
    value: 'Playfair+Display',
    weights: [400, 600, 700, 900],
  },
  { label: 'Merriweather', value: 'Merriweather', weights: [400, 700, 900] },
  { label: 'Lora', value: 'Lora', weights: [400, 500, 600, 700] },

  // Monospace
  {
    label: 'JetBrains Mono',
    value: 'JetBrains+Mono',
    weights: [400, 500, 600, 700],
  },
  {
    label: 'IBM Plex Mono',
    value: 'IBM+Plex+Mono',
    weights: [400, 500, 600, 700],
  },
  {
    label: 'Source Code Pro',
    value: 'Source+Code+Pro',
    weights: [400, 500, 600, 700],
  },
  { label: 'Fira Mono', value: 'Fira+Mono', weights: [400, 700] },

  // Display
  { label: 'Space Grotesk', value: 'Space+Grotesk', weights: [400, 500, 700] },
  { label: 'Orbitron', value: 'Orbitron', weights: [400, 700, 900] },
  { label: 'Bebas Neue', value: 'Bebas+Neue', weights: [400] },
  { label: 'Fredoka One', value: 'Fredoka+One', weights: [400] },
  { label: 'Righteous', value: 'Righteous', weights: [400] },
  { label: 'Press Start 2P', value: 'Press+Start+2P', weights: [400] },
  { label: 'Vast Shadow', value: 'Vast+Shadow', weights: [400] },
  { label: 'Modak', value: 'Modak', weights: [400] },
  { label: 'Oi', value: 'Oi', weights: [400] },
  { label: 'Honk', value: 'Honk', weights: [400] },
  { label: 'Frijole', value: 'Frijole', weights: [400] },
  { label: 'Kumar One', value: 'Kumar+One', weights: [400] },
  { label: 'Rubik Glitch Pop', value: 'Rubik+Glitch+Pop', weights: [400] },
];

const FONT_CACHE = 'cusemit-saved-fonts-v2';
const inFlight = new Map<string, Promise<void>>();
const loaded = new Set<string>();
export const normalizeFont = (name: string) =>
  name.trim().replace(/\+/g, ' ').replace(/\s+/g, ' ');
const fontKey = (name: string) =>
  new URL(
    '/__fonts/' + encodeURIComponent(normalizeFont(name)) + '.json',
    location.origin
  ).href;
interface FontRecord {
  css: string;
  urls: string[];
  weights: number[];
}

async function cachedRecord(name: string): Promise<FontRecord | null> {
  if (!('caches' in window)) return null;
  const response = await (await caches.open(FONT_CACHE)).match(fontKey(name));
  return response ? response.json() : null;
}

export async function isFontAvailableOffline(name: string): Promise<boolean> {
  try {
    const record = await cachedRecord(name);
    if (!record) return false;
    const cache = await caches.open(FONT_CACHE);
    return (
      await Promise.all(record.urls.map((url) => cache.match(url)))
    ).every(Boolean);
  } catch {
    return false;
  }
}

export async function loadGoogleFont(
  fontFamily: string,
  weights: number[] = [400, 700]
): Promise<void> {
  const name = normalizeFont(fontFamily);
  if (!name || name.length > 100 || !/^[\p{L}\p{N} \-]+$/u.test(name))
    throw new Error(
      'Enter a Google Fonts family name, for example Space Grotesk.'
    );
  const uniqueWeights = [...new Set(weights)].sort((a, b) => a - b);
  const key = name + ':' + uniqueWeights.join(',');
  if (loaded.has(key)) return;
  if (inFlight.has(key)) return inFlight.get(key)!;
  const promise = (async () => {
    let record = await cachedRecord(name).catch(() => null);
    // A saved family is usable offline at every weight (browser synthesis fills
    // unsupported weights). Online, fetch newly requested weights as necessary.
    if (
      !record ||
      (navigator.onLine &&
        uniqueWeights.some((w) => !record!.weights.includes(w)))
    ) {
      const family = encodeURIComponent(name).replace(/%20/g, '+');
      let response = await fetch(
        `https://fonts.googleapis.com/css2?family=${family}:wght@${uniqueWeights.join(';')}&display=swap`,
        { signal: AbortSignal.timeout(12000) }
      ).catch(() => null);
      if (!response?.ok && !record)
        response = await fetch(
          `https://fonts.googleapis.com/css2?family=${family}&display=swap`,
          { signal: AbortSignal.timeout(12000) }
        ).catch(() => null);
      if (response?.ok) {
        const css = await response.text();
        const urls = [
          ...new Set(
            Array.from(
              css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g),
              (m) => m[1]
            )
          ),
        ];
        if (!urls.length)
          throw new Error('This font did not return any downloadable files.');
        record = { css, urls, weights: uniqueWeights };
      } else if (!record)
        throw new Error(
          'Font not found. Check the family name and your connection.'
        );
    }
    const cache =
      'caches' in window
        ? await caches.open(FONT_CACHE).catch(() => null)
        : null;
    const objectUrls = new Map<string, string>();
    try {
      await Promise.all(
        record.urls.map(async (url) => {
          let file = await cache?.match(url);
          if (!file) {
            file = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!file.ok)
              throw new Error(
                'Could not download this font. Try again when online.'
              );
            if (cache) await cache.put(url, file.clone()).catch(() => {});
          }
          objectUrls.set(url, URL.createObjectURL(await file.blob()));
        })
      );
      const css = record.css.replace(
        /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g,
        (_, url: string) => `url(${objectUrls.get(url)})`
      );
      const style = document.createElement('style');
      style.dataset.font = name;
      style.textContent = css;
      document.head.appendChild(style);
      try {
        const faces = await Promise.all(
          uniqueWeights.map((w) =>
            document.fonts.load(`${w} 100px "${name}"`, '0123456789:AMP')
          )
        );
        if (faces.some((f) => !f.length))
          throw new Error('The browser could not load this font.');
        await document.fonts.ready;
      } catch (error) {
        style.remove();
        throw error;
      }
      if (cache)
        await cache
          .put(
            fontKey(name),
            new Response(JSON.stringify(record), {
              headers: { 'Content-Type': 'application/json' },
            })
          )
          .catch(() => {});
      loaded.add(key);
      // Keep blob URLs alive while the stylesheet is mounted: labels can request
      // additional unicode subsets after the numeric clock has already loaded.
    } catch (error) {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      throw error;
    }
  })();
  inFlight.set(key, promise);
  try {
    await promise;
  } finally {
    inFlight.delete(key);
  }
}

export async function saveGoogleFont(
  name: string,
  weights?: number[]
): Promise<void> {
  await loadGoogleFont(name, weights);
  if (!(await isFontAvailableOffline(name)))
    throw new Error('Font loaded, but offline storage is unavailable or full.');
  // Persistence is best effort; the UI never promises that browser data is permanent.
  navigator.storage?.persist?.().catch(() => {});
}

export function getFontFamilyCSS(fontFamily: string): string {
  return `"${normalizeFont(fontFamily).replace(/["\\]/g, '')}", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}
