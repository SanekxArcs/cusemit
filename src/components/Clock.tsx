import React from 'react';
import { motion } from 'framer-motion';
import { getFontFamilyCSS } from '@/lib/fonts';
import {
  fitInk,
  measureInkLine,
  translateLine,
  unionInk,
  type ClockGlyph,
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

// These three drive themselves per glyph rather than entering as a whole:
// 'flow' rolls a clipped drum, 'shuffle' cycles digits, 'type' blinks a caret.
const entrances = {
  flow: {},
  shuffle: {},
  type: {},
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

const SHUFFLE_STEPS = 7;
const SHUFFLE_MS = 45;
const TYPE_CARET_MS = 130;
const randomDigit = () => String(Math.floor(Math.random() * 10));

// Spins through random digits before landing on the real one, so a tick reads
// like a departure board. Always settles on `char`, never on a random value.
function ShuffleGlyph({
  char,
  render,
}: {
  char: string;
  render: (c: string) => React.ReactElement;
}) {
  const [shown, setShown] = React.useState(char);
  React.useEffect(() => {
    let step = 0;
    setShown(randomDigit());
    const spin = setInterval(() => {
      step += 1;
      if (step >= SHUFFLE_STEPS) {
        clearInterval(spin);
        setShown(char);
      } else setShown(randomDigit());
    }, SHUFFLE_MS);
    return () => clearInterval(spin);
  }, [char]);
  return render(shown);
}

// Blinks a caret in the slot before the new digit lands. Skips the very first
// paint: every glyph flashing at once on load reads as a glitch, not typing.
function TypeGlyph({
  char,
  render,
  caret,
}: {
  char: string;
  render: (c: string) => React.ReactElement;
  caret: () => React.ReactElement;
}) {
  const [typing, setTyping] = React.useState(false);
  const painted = React.useRef(false);
  React.useEffect(() => {
    if (!painted.current) {
      painted.current = true;
      return;
    }
    setTyping(true);
    const done = setTimeout(() => setTyping(false), TYPE_CARET_MS);
    return () => clearTimeout(done);
  }, [char]);
  return typing ? caret() : render(char);
}

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

  // What each slot showed on the previous commit, so 'flow' can roll the
  // outgoing glyph out as the incoming one arrives. Read during render, so it
  // still holds the old value while the new one is being drawn.
  const shown = React.useRef(new Map<string, string>());
  React.useEffect(() => {
    const next = new Map<string, string>();
    layout.lines.forEach((line, row) => {
      line.glyphs.forEach((glyph, index) => {
        next.set(`${row}:${index}`, glyph.char);
      });
    });
    shown.current = next;
  });

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
  // One glyph's <text>. `char` and `y` are passed in rather than taken from the
  // glyph so 'flow' can draw the outgoing character above the incoming one.
  const glyphText = (glyph: ClockGlyph, char: string, y: number) => (
    <text
      className={
        char === ':' && p.pulseColon && !p.showSeconds && !p.prefersReducedMotion
          ? 'pulse-colon'
          : undefined
      }
      x={glyph.x}
      y={y}
      fontFamily={font}
      fontWeight={p.fontWeight}
      fontSize={glyph.size}
      style={{ fontKerning: 'none', fontVariantNumeric: 'normal' }}
      fill={p.clockMode === 'gradient' ? `url(#${gradientId})` : p.color}
      stroke={p.showStroke ? p.strokeColor : undefined}
      strokeWidth={p.showStroke ? p.strokeWidth / scale : 0}
      paintOrder="stroke"
      xmlSpace="preserve"
    >
      {char}
    </text>
  );
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
              {line.glyphs.map((glyph, index) => {
                const was = shown.current.get(`${row}:${index}`);
                // Roll only digits that actually changed. A colon has nothing
                // to count through, and a glyph on its first paint has no
                // outgoing twin to roll away.
                if (
                  p.animationMode === 'flow' &&
                  !p.prefersReducedMotion &&
                  /\d/.test(glyph.char) &&
                  was !== undefined &&
                  was !== glyph.char
                ) {
                  // One ink-height of travel puts the outgoing glyph's foot
                  // exactly on the slot's ceiling: an unbroken drum, no gap.
                  const roll = line.bounds.height;
                  const slot = `${gradientId}-slot-${row}-${index}`;
                  return (
                    <g key={index} clipPath={`url(#${slot})`}>
                      <defs>
                        <clipPath id={slot}>
                          <rect
                            x={glyph.x - glyph.size}
                            y={line.bounds.y}
                            width={glyph.size * 3}
                            height={line.bounds.height}
                          />
                        </clipPath>
                      </defs>
                      <motion.g
                        key={glyph.char}
                        initial={{ y: roll }}
                        animate={{ y: 0 }}
                        transition={{
                          type: 'spring',
                          stiffness: 260,
                          damping: 32,
                          mass: 0.8,
                        }}
                      >
                        {glyphText(glyph, glyph.char, glyph.y)}
                        {glyphText(glyph, was, glyph.y - roll)}
                      </motion.g>
                    </g>
                  );
                }
                // Both drive themselves from the char they are handed, so they
                // stay mounted across ticks and animate on change. Non-digits
                // fall through and stay put.
                if (
                  !p.prefersReducedMotion &&
                  /\d/.test(glyph.char) &&
                  (p.animationMode === 'shuffle' || p.animationMode === 'type')
                ) {
                  const draw = (c: string) => glyphText(glyph, c, glyph.y);
                  return p.animationMode === 'shuffle' ? (
                    <ShuffleGlyph key={index} char={glyph.char} render={draw} />
                  ) : (
                    <TypeGlyph
                      key={index}
                      char={glyph.char}
                      render={draw}
                      caret={() => (
                        <rect
                          x={glyph.x + glyph.size * 0.06}
                          y={line.bounds.y}
                          width={Math.max(1, glyph.size * 0.08)}
                          height={line.bounds.height}
                          opacity={glyph.opacity}
                          fill={
                            p.clockMode === 'gradient'
                              ? `url(#${gradientId})`
                              : p.color
                          }
                        />
                      )}
                    />
                  );
                }
                return (
                // The entrance animates this <g>, never the <text>. Framer's
                // `x`/`y` are transform keys, and on an element that also has
                // `x`/`y` SVG attributes it seeds them from those attributes --
                // so a glyph would fly in from its own user-space offset.
                // Keyed by char so a changed digit remounts and replays.
                <motion.g
                  key={`${index}-${glyph.char}`}
                  initial={
                    p.prefersReducedMotion ? false : entrances[p.animationMode]
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
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                  }}
                >
                  {glyphText(glyph, glyph.char, glyph.y)}
                </motion.g>
                );
              })}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
