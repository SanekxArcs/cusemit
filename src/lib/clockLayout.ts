export interface InkBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ClockGlyph {
  char: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
}
export interface InkLine {
  glyphs: ClockGlyph[];
  bounds: InkBox;
}

// Ink metrics exclude the invisible ascender/descender space in CSS line boxes.
// Render exactly the same individual glyphs and positions in SVG.
export function measureInkLine(
  context: CanvasRenderingContext2D,
  text: string,
  font: string,
  weight: number,
  size: number,
  tabular: boolean
): InkLine {
  context.font = `${weight} ${size}px ${font}`;
  context.fontKerning = 'none';
  const digits = Array.from('0123456789', (d) => context.measureText(d));
  const digitWidth = Math.max(...digits.map((d) => d.width));
  // Equal advances alone are not enough: fitting the current ink still zooms
  // and recenters on thin digits. Reserve every digit's ink inside each slot.
  const digitLeft = Math.min(
    ...digits.map((d) => (digitWidth - d.width) / 2 - d.actualBoundingBoxLeft)
  );
  const digitRight = Math.max(
    ...digits.map((d) => (digitWidth - d.width) / 2 + d.actualBoundingBoxRight)
  );
  const digitTop = Math.min(...digits.map((d) => -d.actualBoundingBoxAscent));
  const digitBottom = Math.max(...digits.map((d) => d.actualBoundingBoxDescent));
  let cursor = 0,
    left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  const glyphs = Array.from(text, (char) => {
    const metrics = context.measureText(char);
    const fixedDigit = tabular && /\d/.test(char);
    const width = fixedDigit ? digitWidth : metrics.width;
    const x = cursor + (width - metrics.width) / 2;
    if (char.trim()) {
      left = Math.min(
        left,
        fixedDigit ? cursor + digitLeft : x - metrics.actualBoundingBoxLeft
      );
      right = Math.max(
        right,
        fixedDigit ? cursor + digitRight : x + metrics.actualBoundingBoxRight
      );
      top = Math.min(top, fixedDigit ? digitTop : -metrics.actualBoundingBoxAscent);
      bottom = Math.max(
        bottom,
        fixedDigit ? digitBottom : metrics.actualBoundingBoxDescent
      );
    }
    cursor += width;
    return { char, x, y: 0, size, opacity: 1 };
  });
  return {
    glyphs,
    bounds: Number.isFinite(left)
      ? { x: left, y: top, width: right - left, height: bottom - top }
      : { x: 0, y: 0, width: 1, height: 1 },
  };
}

export function translateLine(
  line: InkLine,
  x: number,
  y: number,
  opacity = 1
): InkLine {
  return {
    bounds: { ...line.bounds, x: line.bounds.x + x, y: line.bounds.y + y },
    glyphs: line.glyphs.map((g) => ({ ...g, x: g.x + x, y: g.y + y, opacity })),
  };
}

export function unionInk(lines: InkLine[]): InkBox {
  const x = Math.min(...lines.map((l) => l.bounds.x)),
    y = Math.min(...lines.map((l) => l.bounds.y));
  return {
    x,
    y,
    width: Math.max(...lines.map((l) => l.bounds.x + l.bounds.width)) - x,
    height: Math.max(...lines.map((l) => l.bounds.y + l.bounds.height)) - y,
  };
}

export function fitInk(
  box: InkBox,
  width: number,
  height: number,
  padding: number,
  stroke: number,
  drift: number
) {
  const inset = padding + stroke / 2 + drift;
  const scale = Math.max(
    0.001,
    Math.min(
      Math.max(1, width - inset * 2) / Math.max(1, box.width),
      Math.max(1, height - inset * 2) / Math.max(1, box.height)
    )
  );
  return {
    scale,
    x: (width - box.width * scale) / 2 - box.x * scale,
    y: (height - box.height * scale) / 2 - box.y * scale,
  };
}
