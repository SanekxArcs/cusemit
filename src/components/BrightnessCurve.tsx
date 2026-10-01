import React from 'react';
import { motion } from 'framer-motion';
import { Sunrise, Sunset } from 'lucide-react';
import {
  DAY_MINUTES,
  MAX_POINTS,
  clampLevel,
  formatMinute,
  levelAt,
  makePointId,
  type BrightnessPoint,
} from '@/lib/brightness';

// Plot geometry in viewBox units; the SVG scales to the panel's width.
const W = 320;
const H = 176;
const L = 32;
const R = 10;
const T = 12;
const B = 24;
const PW = W - L - R;
const PH = H - T - B;
const SAMPLE_STEP = 10;
const SNAP_MINUTES = 5;

const x = (minute: number) => L + (minute / DAY_MINUTES) * PW;
const y = (level: number) => T + (1 - level / 100) * PH;

function curvePath(points: readonly BrightnessPoint[], transition: number) {
  // A fixed sample count keeps every path the same shape, so framer-motion can
  // morph one curve into the next instead of snapping.
  let d = '';
  for (let m = 0; m <= DAY_MINUTES; m += SAMPLE_STEP) {
    const px = x(m).toFixed(2);
    const py = y(levelAt(points, m, transition)).toFixed(2);
    d += (m === 0 ? 'M' : 'L') + px + ',' + py;
  }
  return d;
}

export function BrightnessCurve({
  points,
  transition,
  onChange,
  nowMinute,
  twelveHour,
  sunrise,
  sunset,
  reducedMotion,
  selectedId,
  onSelect,
}: {
  points: readonly BrightnessPoint[];
  transition: number;
  /** Omit for a read-only preview. */
  onChange?: (points: BrightnessPoint[]) => void;
  nowMinute: number;
  twelveHour: boolean;
  sunrise?: number | null;
  sunset?: number | null;
  reducedMotion: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const drag = React.useRef<{
    id: string;
    dMinute: number;
    dLevel: number;
  } | null>(null);
  const gradientId = 'curve-fill-' + React.useId().replace(/[^a-z0-9]/gi, '');
  const editable = Boolean(onChange);
  // Pointer events can outrun re-renders mid-drag; always edit the newest list.
  const latest = React.useRef(points);
  latest.current = points;
  const commit = (next: BrightnessPoint[]) => {
    latest.current = next;
    onChange?.(next);
  };

  const line = curvePath(points, transition);
  const area = `${line}L${x(DAY_MINUTES)},${T + PH}L${L},${T + PH}Z`;
  const nowLevel = levelAt(points, nowMinute, transition);
  const morph = reducedMotion
    ? { duration: 0 }
    : { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };

  const toData = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const p = new DOMPoint(clientX, clientY).matrixTransform(
      svg.getScreenCTM()!.inverse()
    );
    return {
      minute: ((p.x - L) / PW) * DAY_MINUTES,
      level: (1 - (p.y - T) / PH) * 100,
    };
  };
  const place = (minute: number, level: number) => ({
    minute: Math.min(
      DAY_MINUTES - SNAP_MINUTES,
      Math.max(0, Math.round(minute / SNAP_MINUTES) * SNAP_MINUTES)
    ),
    level: clampLevel(level),
  });
  const movePoint = (id: string, minute: number, level: number) =>
    commit(
      latest.current.map((p) =>
        p.id === id ? { ...p, ...place(minute, level) } : p
      )
    );

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!editable || e.button > 0) return;
    const pos = toData(e.clientX, e.clientY);
    const hit = (e.target as Element).closest('[data-point-id]');
    let id = hit?.getAttribute('data-point-id') ?? null;
    let grabbed = points.find((p) => p.id === id);
    if (!grabbed) {
      if (points.length >= MAX_POINTS) return;
      grabbed = { id: makePointId(), ...place(pos.minute, pos.level) };
      id = grabbed.id;
      commit([...points, grabbed]);
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Keep the finger's offset from the point so it doesn't jump on grab.
    drag.current = {
      id: grabbed.id,
      dMinute: grabbed.minute - pos.minute,
      dLevel: grabbed.level - pos.level,
    };
    onSelect?.(id);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const pos = toData(e.clientX, e.clientY);
    movePoint(d.id, pos.minute + d.dMinute, pos.level + d.dLevel);
  };
  const endDrag = () => {
    drag.current = null;
  };

  const onPointKey = (e: React.KeyboardEvent, p: BrightnessPoint) => {
    const big = e.shiftKey;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [big ? -60 : -15, 0],
      ArrowRight: [big ? 60 : 15, 0],
      ArrowUp: [0, big ? 10 : 5],
      ArrowDown: [0, big ? -10 : -5],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dm, dl] = moves[e.key];
      movePoint(p.id, p.minute + dm, p.level + dl);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && points.length > 1) {
      e.preventDefault();
      commit(points.filter((q) => q.id !== p.id));
      onSelect?.(null);
    }
  };

  const hours = twelveHour
    ? ['12a', '6a', '12p', '6p', '12a']
    : ['00', '06', '12', '18', '24'];

  return (
    <svg
      ref={svgRef}
      className={'brightness-curve' + (editable ? ' editable' : '')}
      viewBox={`0 0 ${W} ${H}`}
      role="group"
      aria-label={
        editable
          ? 'Brightness curve. Tap to add a point, drag a point to move it.'
          : 'Brightness through the day'
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <rect className="curve-plot" x={L} y={T} width={PW} height={PH} rx={6} />
      {[0, 25, 50, 75, 100].map((lv) => (
        <line key={lv} className="curve-grid" x1={L} x2={L + PW} y1={y(lv)} y2={y(lv)} />
      ))}
      {[0, 360, 720, 1080, 1440].map((m) => (
        <line key={m} className="curve-grid" x1={x(m)} x2={x(m)} y1={T} y2={T + PH} />
      ))}
      {[0, 50, 100].map((lv) => (
        <text key={lv} className="curve-axis" x={L - 6} y={y(lv) + 3} textAnchor="end">
          {lv}%
        </text>
      ))}
      {hours.map((label, i) => (
        <text
          key={i}
          className="curve-axis"
          x={x(i * 360)}
          y={H - 7}
          textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}
        >
          {label}
        </text>
      ))}

      {[
        { minute: sunrise, Icon: Sunrise, name: 'Sunrise' },
        { minute: sunset, Icon: Sunset, name: 'Sunset' },
      ].map(
        ({ minute, Icon, name }) =>
          minute != null && (
            <g key={name} className="curve-sun">
              <title>{`${name} ${formatMinute(minute, twelveHour)}`}</title>
              <line x1={x(minute)} x2={x(minute)} y1={T + 14} y2={T + PH} />
              <Icon x={x(minute) - 6} y={T + 1} width={12} height={12} />
            </g>
          )
      )}

      <motion.path
        className="curve-area"
        fill={`url(#${gradientId})`}
        initial={false}
        animate={{ d: area }}
        transition={morph}
      />
      <motion.path
        className="curve-line"
        initial={false}
        animate={{ d: line }}
        transition={morph}
      />

      <g className="curve-now" aria-hidden="true">
        <line x1={x(nowMinute)} x2={x(nowMinute)} y1={T} y2={T + PH} />
        <motion.circle
          r={4}
          cx={x(nowMinute)}
          initial={false}
          animate={{ cy: y(nowLevel) }}
          transition={morph}
        />
      </g>

      {editable &&
        points.map((p) => (
          <g
            key={p.id}
            data-point-id={p.id}
            className={'curve-point' + (p.id === selectedId ? ' selected' : '')}
            tabIndex={0}
            role="button"
            aria-label={`Point at ${formatMinute(p.minute, twelveHour)}, ${p.level}% brightness. Arrow keys move it, Delete removes it.`}
            onFocus={() => onSelect?.(p.id)}
            onKeyDown={(e) => onPointKey(e, p)}
          >
            <circle className="curve-point-hit" cx={x(p.minute)} cy={y(p.level)} r={16} />
            <circle className="curve-point-dot" cx={x(p.minute)} cy={y(p.level)} r={5.5} />
          </g>
        ))}
    </svg>
  );
}
