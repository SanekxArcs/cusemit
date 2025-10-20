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
]

/**
 * Load a Google Font dynamically via <link> injection.
 * Returns a promise that resolves when the font is loaded.
 */
export async function loadGoogleFont(
  fontFamily: string,
  weights: number[] = [400, 700]
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if font is already loaded
    const existingLink = document.querySelector(
      `link[data-font="${fontFamily}"]`
    )
    if (existingLink) {
      resolve()
      return
    }

    const weightStr = weights.join(';')
    const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@${weightStr}&display=swap`

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = fontUrl
    link.setAttribute('data-font', fontFamily)

    link.onload = () => resolve()
    link.onerror = () => reject(new Error(`Failed to load font: ${fontFamily}`))

    document.head.appendChild(link)
  })
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
