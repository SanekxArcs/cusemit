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
  { label: 'Playfair Display', value: 'Playfair+Display', weights: [400, 600, 700, 900] },
  { label: 'Merriweather', value: 'Merriweather', weights: [400, 700, 900] },
  { label: 'Lora', value: 'Lora', weights: [400, 500, 600, 700] },

  // Monospace
  { label: 'JetBrains Mono', value: 'JetBrains+Mono', weights: [400, 500, 600, 700] },
  { label: 'IBM Plex Mono', value: 'IBM+Plex+Mono', weights: [400, 500, 600, 700] },
  { label: 'Source Code Pro', value: 'Source+Code+Pro', weights: [400, 500, 600, 700] },
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
]

/**
 * Load a Google Font dynamically via <link> injection.
 * Returns a promise that resolves when the font is loaded.
 */
export async function loadGoogleFont(
  fontFamily: string,
  weights: number[] = [400, 700]
): Promise<void> {
  // Normalize font family name for API (replace spaces with +)
  const normalizedFamily = fontFamily.trim().replace(/\s+/g, '+')
  
  // Deduplicate and sort weights
  const uniqueWeights = Array.from(new Set(weights)).sort((a, b) => a - b)
  
  const attemptLoad = (ws: number[]): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if this specific weight set is already being loaded (or already exists)
      const weightKey = ws.join(',')
      const existingLink = document.querySelector(
        `link[data-font="${normalizedFamily}"][data-weights="${weightKey}"]`
      )
      if (existingLink) {
        resolve()
        return
      }

      const weightStr = ws.join(';')
      const fontUrl = `https://fonts.googleapis.com/css2?family=${normalizedFamily}:wght@${weightStr}&display=swap`

      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = fontUrl
      link.setAttribute('data-font', normalizedFamily)
      link.setAttribute('data-weights', weightKey)

      link.onload = () => resolve()
      link.onerror = () => {
        // Remove failed link to allow retries with different weights
        link.remove()
        reject(new Error(`Failed to load ${normalizedFamily} with weights ${ws.join(',')}`))
      }

      document.head.appendChild(link)
    })
  }

  try {
    // Try loading all requested weights first
    await attemptLoad(uniqueWeights)
  } catch (error) {
    // If the combined request fails, try loading individually
    // This handles fonts that don't support all requested weights
    
    // Fallback 1: Try the first weight in the original list (likely the most important one)
    const primaryWeight = [uniqueWeights[0]]
    
    try {
      await attemptLoad(primaryWeight)
    } catch {
      // Fallback 2: Try 400 if it's not the primary weight
      if (primaryWeight[0] !== 400) {
        try {
          await attemptLoad([400])
        } catch (finalError) {
          throw finalError
        }
      } else {
        throw new Error(`Failed to load font ${fontFamily} with any common weight.`)
      }
    }
  }
}

/**
 * Load all curated fonts at once (for dropdown previews).
 * Uses a single multi-family request.
 */
export async function loadAllCuratedFonts(): Promise<void> {
  const families = CURATED_FONTS.map(f => `${f.value}:wght@400`).join('&family=');
  const url = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
  
  return new Promise((resolve) => {
    if (document.querySelector('link[data-all-fonts="true"]')) {
      resolve();
      return;
    }
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-all-fonts', 'true');
    link.onload = () => resolve();
    link.onerror = () => resolve(); // Don't block if preview load fails
    document.head.appendChild(link);
  });
}

/**
 * Get font-family string for CSS, with fallbacks.
 */
export function getFontFamilyCSS(fontFamily: string): string {
  // Custom Google Font or curated selection
  const curated = CURATED_FONTS.find((f) => f.value === fontFamily)
  const displayName = curated ? curated.label : fontFamily

  return `'${displayName}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
}
