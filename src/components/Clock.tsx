import React from 'react'
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn'
import { getFontFamilyCSS } from '@/lib/fonts'
import { DriftOffset } from '@/lib/amoledSaver'
import { AnimatedNumber } from './AnimatedNumber';

interface ClockProps {
  time: string
  ampm?: string
  ampmPosition?: 'before' | 'after' | 'top' | 'bottom'
  clockMode: 'solid' | 'gradient'
  color: string
  gradientStart: string
  gradientEnd: string
  gradientAngle: number
  showStroke: boolean
  strokeWidth: number
  strokeColor: string
  fontFamily: string
  scale: number
  offsetX: number
  offsetY: number
  driftOffset: DriftOffset
  prefersReducedMotion: boolean
  fontWeight: number
  refreshKey?: number
  animationMode: 'slide-v' | 'slide-h' | 'fade' | 'zoom' | 'flip-v' | 'flip-h' | 'blur' | 'bounce' | 'rotate' | 'none'
  topText?: string
  bottomText?: string
  showTopText?: boolean
  showBottomText?: boolean
  showSeconds?: boolean
  pulseColon?: boolean
}

export const Clock: React.FC<ClockProps> = ({
  time,
  ampm,
  ampmPosition = 'after',
  clockMode = 'solid',
  color,
  gradientStart,
  gradientEnd,
  gradientAngle,
  showStroke,
  strokeWidth,
  strokeColor,
  fontFamily,
  scale,
  offsetX,
  offsetY,
  driftOffset,
  prefersReducedMotion,
  fontWeight,
  refreshKey = 0,
  animationMode,
  topText,
  bottomText,
  showTopText,
  showBottomText,
  showSeconds,
  pulseColon,
}) => {
  const fontFamilyCSS = getFontFamilyCSS(fontFamily)
  const [fontSize, setFontSize] = React.useState(100)

  // Override logic: AM/PM takes priority over custom text at top/bottom
  const isTopTextHidden = ampm && ampmPosition === 'top';
  const isBottomTextHidden = ampm && ampmPosition === 'bottom';

  React.useEffect(() => {
    const calculateFontSize = () => {
      const container = document.querySelector('.clock-container');
      if (!container) return;

      const measurer = document.createElement('div');
      measurer.style.position = 'absolute';
      measurer.style.visibility = 'hidden';
      measurer.style.whiteSpace = 'nowrap';
      measurer.style.fontFamily = fontFamilyCSS;
      measurer.style.fontWeight = fontWeight.toString();
      measurer.innerText = "88:88:88 PM"; // Reference max width
      document.body.appendChild(measurer);

      const availableWidth = container.clientWidth * 0.95;
      const availableHeight = container.clientHeight * 0.95;

      let min = 10;
      let max = Math.max(container.clientWidth, container.clientHeight);
      let optimalSize = 100;

      while (min <= max) {
        const mid = Math.floor((min + max) / 2);
        measurer.style.fontSize = `${mid}px`;

        if (measurer.offsetWidth <= availableWidth &&
          measurer.offsetHeight <= availableHeight) {
          optimalSize = mid;
          min = mid + 1;
        } else {
          max = mid - 1;
        }
      }

      document.body.removeChild(measurer);

      setFontSize(optimalSize * scale);
    }

    calculateFontSize()

    const resizeObserver = new ResizeObserver(calculateFontSize)
    const container = document.querySelector('.clock-container');
    if (container) {
      resizeObserver.observe(container)
    }

    return () => resizeObserver.disconnect()
  }, [scale, fontFamily, fontWeight, fontFamilyCSS, refreshKey])

  const driftVariants = {
    animate: {
      x: `calc(${offsetX}% + ${(prefersReducedMotion ? 0 : driftOffset.x)}px)`,
      y: `calc(${offsetY}% + ${(prefersReducedMotion ? 0 : driftOffset.y)}px)`,
      transition: { duration: 0.3, ease: 'easeInOut' },
    },
  }

  const textStyle: React.CSSProperties = clockMode === 'gradient' ? {
    background: `linear-gradient(${gradientAngle}deg, ${gradientStart}, ${gradientEnd})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: 'transparent',
  } : {
    color: color,
  };

  if (showStroke) {
    (textStyle as any).WebkitTextStroke = `${strokeWidth}px ${strokeColor}`;
  }

  const styleKey = clockMode === 'gradient'
    ? `${gradientStart}-${gradientEnd}-${gradientAngle}-${showStroke}-${strokeWidth}-${strokeColor}`
    : `${color}-${showStroke}-${strokeWidth}-${strokeColor}`;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none clock-container"
        animate="animate"
        variants={driftVariants}
      >
        <div
          className="relative leading-none flex items-center justify-center"
          style={{
            fontSize: `${fontSize}px`,
            fontFamily: fontFamilyCSS,
            fontWeight: fontWeight,
          }}
        >
          {/* Top Custom Text */}
          {showTopText && topText && !isTopTextHidden && (
            <div
              className="absolute bottom-full mb-[0.2em] left-1/2 -translate-x-1/2 whitespace-nowrap"
              style={{
                fontSize: '0.3em',
              }}
            >
              <div className="flex items-center justify-center">
                {Array.from(topText).map((char, index) => (
                  <AnimatedNumber
                    key={`top-${index}-${styleKey}`}
                    value={char}
                    prefersReducedMotion={prefersReducedMotion}
                    animationMode={animationMode}
                    style={{ ...textStyle, opacity: 0.6 }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Main Time */}
          <div
            className="flex items-center justify-center"
          >
            {Array.from(time).map((char, index) => {
              const isColon = char === ':';
              const shouldPulse = isColon && pulseColon && !showSeconds && !prefersReducedMotion;

              const content = (
                <AnimatedNumber
                  key={`time-${index}-${styleKey}`}
                  value={char}
                  prefersReducedMotion={prefersReducedMotion}
                  animationMode={animationMode}
                  style={textStyle}
                />
              );

              if (shouldPulse) {
                return (
                  <motion.div
                    key={`pulse-${index}-${styleKey}`}
                    animate={{
                      opacity: [1, 0.2, 1],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="flex items-center justify-center"
                  >
                    {content}
                  </motion.div>
                );
              }

              return content;
            })}
          </div>

          {/* Bottom Custom Text */}
          {showBottomText && bottomText && !isBottomTextHidden && (
            <div
              className="absolute top-full mt-[0.2em] left-1/2 -translate-x-1/2 whitespace-nowrap"
              style={{
                fontSize: '0.3em',
              }}
            >
              <div className="flex items-center justify-center">
                {Array.from(bottomText).map((char, index) => (
                  <AnimatedNumber
                    key={`bottom-${index}-${styleKey}`}
                    value={char}
                    prefersReducedMotion={prefersReducedMotion}
                    animationMode={animationMode}
                    style={{ ...textStyle, opacity: 0.6 }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Absolute AM/PM Indicator */}
          {ampm && (
            <div
              className={cn(
                "absolute whitespace-nowrap transition-all duration-300",
                ampmPosition === 'before' && "right-full mr-[0.2em] transform-none",
                ampmPosition === 'after' && "left-full ml-[0.2em] transform-none",
                ampmPosition === 'top' && "bottom-full mb-[0.1em] left-1/2 -translate-x-1/2",
                ampmPosition === 'bottom' && "top-full mt-[0.1em] left-1/2 -translate-x-1/2"
              )}
              style={{
                fontSize: (ampmPosition === 'top' || ampmPosition === 'bottom') ? '0.35em' : '0.45em',
              }}
            >
              <div className="flex items-center justify-center">
                {Array.from(ampm).map((char, index) => (
                  <AnimatedNumber
                    key={`ampm-${index}-${styleKey}`}
                    value={char}
                    prefersReducedMotion={prefersReducedMotion}
                    animationMode={animationMode}
                    style={{ ...textStyle, opacity: 0.8 }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
