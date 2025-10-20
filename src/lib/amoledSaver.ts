/**
 * AMOLED Saver drift logic: applies periodic random sub-pixel jitter
 * to mitigate burn-in on OLED screens.
 *
 * Strategy:
 * - Every 45 seconds, pick a random offset (1–3px in X/Y).
 * - Apply via framer-motion animate for smooth 200-300ms transition.
 * - Pause when settings sheet is open or window is not visible.
 */

export interface DriftOffset {
  x: number
  y: number
}

/**
 * Generate random drift offset within 1–3px bounds.
 */
export function generateRandomDrift(): DriftOffset {
  const randomOffset = (min: number, max: number) =>
    Math.random() * (max - min) + min
  return {
    x: randomOffset(1, 3) * (Math.random() > 0.5 ? 1 : -1),
    y: randomOffset(1, 3) * (Math.random() > 0.5 ? 1 : -1),
  }
}

/**
 * Check if animations should be reduced per system preference.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
