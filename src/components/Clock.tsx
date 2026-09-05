import React from 'react';
import { motion } from 'framer-motion';
import { getFontFamilyCSS } from '@/lib/fonts';
import {
  fitInk,
  measureInkLine,
  translateLine,
  unionInk,
} from '@/lib/clockLayout';
import type { DriftOffset } from '@/lib/amoledSaver';
import type { ClockSettings } from '@/store/settings';

interface ClockProps {
  time: string;
  ampm?: string;
  ampmPosition?: ClockSettings['ampmPosition'];
  clockMode: 'solid' | 'gradient';
  color: string;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;
  showStroke: boolean;
  strokeWidth: number;
  strokeColor: string;
  fontFamily: string;
  fontWeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  driftOffset: DriftOffset;
  prefersReducedMotion: boolean;
  refreshKey?: number;
  animationMode: ClockSettings['animationMode'];
  topText?: string;
  bottomText?: string;
  showTopText?: boolean;
  showBottomText?: boolean;
  showSeconds?: boolean;
  pulseColon?: boolean;
  tabularNums?: boolean;
  tabularNumsFallback?: boolean;
  autoFit?: boolean;
  edgePadding?: number;
  driftMargin?: number;
}

const entrances = {
  'slide-v': { y: 12, opacity: 0 },
  'slide-h': { x: 12, opacity: 0 },
  fade: { opacity: 0 },
  zoom: { scale: 0.6, opacity: 0 },
  'flip-v': { scaleY: 0, opacity: 0 },
  'flip-h': { scaleX: 0, opacity: 0 },
  blur: { filter: 'blur(5px)', opacity: 0 },
  bounce: { y: 16, opacity: 0 },
  rotate: { rotate: -30, opacity: 0 },
  none: {},
};

export function Clock(p: ClockProps) {
  const container = React.useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = React.useState({ width: 1, height: 1 });
  const [fontVersion, setFontVersion] = React.useState(0);
  const gradientId = React.useId().replace(/:/g, '');
  const font = getFontFamilyCSS(p.fontFamily);
  React.useLayoutEffect(() => {
    const element = container.current!;
    const resize = () =>
      setViewport({ width: element.clientWidth, height: element.clientHeight });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  React.useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (alive) setFontVersion((v) => v + 1);
    };
    document.fonts.ready.then(refresh);
    document.fonts.addEventListener('loadingdone', refresh);
    return () => {
      alive = false;
      document.fonts.removeEventListener('loadingdone', refresh);
    };
  }, [font, p.fontWeight]);

  const layout = React.useMemo(() => {
    const context = document.createElement('canvas').getContext('2d')!;
    const line = (text: string, size: number) =>
      measureInkLine(context, text, font, p.fontWeight, size, !!p.tabularNums);
    const main = line(p.time, 100);
    const lines = [main];
    const center = main.bounds.x + main.bounds.width / 2;
    const above = (text: string, size = 26, opacity = 0.6) => {
      const l = line(text, size);
      lines.push(
        translateLine(
          l,
          center - l.bounds.x - l.bounds.width / 2,
          main.bounds.y - 12 - l.bounds.y - l.bounds.height,
          opacity
        )
      );
    };
    const below = (text: string, size = 26, opacity = 0.6) => {
      const l = line(text, size);
      lines.push(
        translateLine(
          l,
          center - l.bounds.x - l.bounds.width / 2,
          main.bounds.y + main.bounds.height + 12 - l.bounds.y,
          opacity
        )
      );
    };
    if (p.ampm && p.ampmPosition === 'top') above(p.ampm, 32, 0.8);
    else if (p.showTopText && p.topText) above(p.topText);
    if (p.ampm && p.ampmPosition === 'bottom') below(p.ampm, 32, 0.8);
    else if (p.showBottomText && p.bottomText) below(p.bottomText);
    if (p.ampm && p.ampmPosition !== 'top' && p.ampmPosition !== 'bottom') {
      const l = line(p.ampm, 36);
      lines.push(
        translateLine(
          l,
          p.ampmPosition === 'before'
            ? main.bounds.x - 14 - l.bounds.x - l.bounds.width
            : main.bounds.x + main.bounds.width + 14 - l.bounds.x,
          main.bounds.y +
            main.bounds.height / 2 -
            l.bounds.y -
            l.bounds.height / 2,
          0.8
        )
      );
    }
    return { lines, bounds: unionInk(lines) };
  }, [
    font,
    p.fontWeight,
    p.time,
    p.ampm,
    p.ampmPosition,
    p.topText,
    p.bottomText,
    p.showTopText,
    p.showBottomText,
    p.tabularNums,
    p.tabularNumsFallback,
    p.refreshKey,
    fontVersion,
  ]);

  const fit = fitInk(
    layout.bounds,
    viewport.width,
    viewport.height,
    p.edgePadding ?? 16,
    p.showStroke ? p.strokeWidth : 0,
    p.driftMargin ?? 0
  );
  const scale = fit.scale * (p.autoFit === false ? p.scale : 1);
  const x =
    (viewport.width - layout.bounds.width * scale) / 2 -
    layout.bounds.x * scale +
    (p.autoFit === false ? (viewport.width * p.offsetX) / 100 : 0) +
    (p.prefersReducedMotion ? 0 : p.driftOffset.x);
  const y =
    (viewport.height - layout.bounds.height * scale) / 2 -
    layout.bounds.y * scale +
    (p.autoFit === false ? (viewport.height * p.offsetY) / 100 : 0) +
    (p.prefersReducedMotion ? 0 : p.driftOffset.y);
  const angle = ((p.gradientAngle - 90) * Math.PI) / 180;
  return (
    <div
      ref={container}
      className="clock-container absolute inset-0 pointer-events-none"
    >
      <svg
        className="clock-svg"
        width="100%"
        height="100%"
        role="img"
        aria-label={[
          p.time,
          p.ampm,
          p.showTopText ? p.topText : '',
          p.showBottomText ? p.bottomText : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <defs>
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={
              layout.bounds.x +
              layout.bounds.width * (0.5 - Math.cos(angle) / 2)
            }
            y1={
              layout.bounds.y +
              layout.bounds.height * (0.5 - Math.sin(angle) / 2)
            }
            x2={
              layout.bounds.x +
              layout.bounds.width * (0.5 + Math.cos(angle) / 2)
            }
            y2={
              layout.bounds.y +
              layout.bounds.height * (0.5 + Math.sin(angle) / 2)
            }
          >
            <stop stopColor={p.gradientStart} />
            <stop offset="1" stopColor={p.gradientEnd} />
          </linearGradient>
        </defs>
        <g
          transform={`translate(${x} ${y}) scale(${scale})`}
          data-clock-ink={JSON.stringify(layout.bounds)}
          data-fit-scale={scale}
        >
          {layout.lines.map((line, row) => (
            <g key={row}>
              {line.glyphs.map((glyph, index) => (
                <g key={index}>
                  <motion.text
                    key={glyph.char}
                    initial={
                      p.prefersReducedMotion
                        ? false
                        : entrances[p.animationMode]
                    }
                    animate={{
                      x: 0,
                      y: 0,
                      scale: 1,
                      scaleX: 1,
                      scaleY: 1,
                      rotate: 0,
                      filter: 'blur(0px)',
                      opacity: glyph.opacity,
                    }}
                    transition={{
                      duration: p.prefersReducedMotion ? 0 : 0.3,
                      type: p.animationMode === 'bounce' ? 'spring' : 'tween',
                    }}
                    className={
                      glyph.char === ':' &&
                      p.pulseColon &&
                      !p.showSeconds &&
                      !p.prefersReducedMotion
                        ? 'pulse-colon'
                        : undefined
                    }
                    x={glyph.x}
                    y={glyph.y}
                    fontFamily={font}
                    fontWeight={p.fontWeight}
                    fontSize={glyph.size}
                    style={{
                      fontKerning: 'none',
                      fontVariantNumeric: 'normal',
                      transformBox: 'fill-box',
                      transformOrigin: 'center',
                    }}
                    fill={
                      p.clockMode === 'gradient'
                        ? `url(#${gradientId})`
                        : p.color
                    }
                    stroke={p.showStroke ? p.strokeColor : undefined}
                    strokeWidth={p.showStroke ? p.strokeWidth / scale : 0}
                    paintOrder="stroke"
                    xmlSpace="preserve"
                  >
                    {glyph.char}
                  </motion.text>
                </g>
              ))}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
