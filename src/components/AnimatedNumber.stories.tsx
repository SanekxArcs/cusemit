/**
 * AnimatedNumber Component Story
 * 
 * This demonstrates the AnimatedNumber component
 * used in the Digital Clock for smooth digit transitions.
 * 
 * Each digit animates with a vertical slide effect
 * when the time value changes, similar to NumberFlow.
 * 
 * Usage in Clock.tsx:
 * 
 * {Array.from(time).map((char, index) => (
 *   <AnimatedNumber
 *     key={`time-${index}`}
 *     value={char}
 *     prefersReducedMotion={prefersReducedMotion}
 *   />
 * ))}
 */

// This component is used directly in Clock.tsx
// No separate story file needed for Storybook-less setup
export default null
