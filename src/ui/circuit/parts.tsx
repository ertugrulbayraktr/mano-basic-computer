import type { ReactNode } from 'react';

/**
 * Drawing primitives for circuit diagrams. Every part takes plain coordinates in the drawing's
 * own units and an `on` flag that colors it as an active signal.
 */

export type Pt = [number, number];

const color = (on?: boolean, changed?: boolean) => (changed ? 'var(--ink)' : on ? 'var(--active)' : 'var(--wire)');

/** A polyline wire. `kind` sets the thickness: control signal, data path, or the bus itself. */
export function Wire({
  points,
  on,
  arrow,
  kind = 'signal',
  travel,
  dashed,
}: {
  points: Pt[];
  on?: boolean;
  arrow?: boolean;
  kind?: 'signal' | 'data' | 'bus';
  travel?: boolean;
  dashed?: boolean;
}) {
  const width = kind === 'bus' ? 7 : kind === 'data' ? 2.2 : 1.4;
  return (
    <polyline
      points={points.map((p) => p.join(',')).join(' ')}
      fill="none"
      stroke={color(on)}
      strokeWidth={width}
      strokeLinejoin="round"
      strokeLinecap={kind === 'bus' ? 'butt' : 'round'}
      strokeDasharray={dashed ? '4 3' : undefined}
      markerEnd={arrow ? 'url(#arrow)' : undefined}
      className={on && travel ? 'wire-travel' : undefined}
      style={{ transition: 'stroke 160ms' }}
    />
  );
}

export function Dot({ at, on }: { at: Pt; on?: boolean }) {
  return <circle cx={at[0]} cy={at[1]} r={2.6} fill={color(on)} />;
}

export function Text({
  at,
  children,
  size = 12,
  anchor = 'start',
  mono,
  weight,
  tone = 'text',
  baseline = 'middle',
}: {
  at: Pt;
  children: ReactNode;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  mono?: boolean;
  weight?: number;
  tone?: 'text' | 'muted' | 'active' | 'changed';
  baseline?: 'middle' | 'auto' | 'hanging';
}) {
  // A changed value sits on a highlighter swatch (see Block), so it is drawn in ink.
  const fill = { text: 'var(--ink)', muted: 'var(--muted)', active: 'var(--active)', changed: 'var(--ink)' }[tone];
  return (
    <text
      x={at[0]}
      y={at[1]}
      fontSize={size}
      textAnchor={anchor}
      dominantBaseline={baseline}
      fontFamily={mono ? 'var(--mono)' : 'var(--sans)'}
      fontWeight={weight}
      fill={fill}
      style={{ transition: 'fill 160ms' }}
    >
      {children}
    </text>
  );
}

/** A rounded rectangle used for registers, decoders and other blocks. */
export function Block({
  x,
  y,
  w,
  h,
  on,
  changed,
  dashed,
  children,
  onClick,
  title,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  on?: boolean;
  changed?: boolean;
  dashed?: boolean;
  children?: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <g
      onClick={onClick}
      data-interactive={onClick ? '' : undefined}
      style={{ cursor: onClick ? 'pointer' : undefined }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? title : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
      {title && <title>{title}</title>}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        fill={changed ? 'var(--highlight)' : on ? 'var(--active-soft)' : 'var(--surface)'}
        stroke={color(on, changed)}
        strokeWidth={on || changed ? 1.6 : 1.2}
        strokeDasharray={dashed ? '5 4' : undefined}
        style={{ transition: 'fill 160ms, stroke 160ms' }}
      />
      {children}
    </g>
  );
}

/** Path of a gate body with its output at (x + w, y + h/2). */
export function gatePath(type: 'AND' | 'OR', x: number, y: number, w: number, h: number): string {
  if (type === 'AND') {
    const r = h / 2;
    return `M${x} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x} Z`;
  }
  return `M${x} ${y} Q${x + w * 0.7} ${y} ${x + w} ${y + h / 2} Q${x + w * 0.7} ${y + h} ${x} ${y + h} Q${x + w * 0.3} ${y + h / 2} ${x} ${y} Z`;
}

export function Gate({ type, x, y, w = 26, h = 20, on }: { type: 'AND' | 'OR'; x: number; y: number; w?: number; h?: number; on?: boolean }) {
  return (
    <path
      d={gatePath(type, x, y, w, h)}
      fill={on ? 'var(--active-soft)' : 'var(--surface)'}
      stroke={color(on)}
      strokeWidth={1.3}
      style={{ transition: 'fill 160ms, stroke 160ms' }}
    />
  );
}

/**
 * A multiplexer drawn as a trapezoid, inputs on the left (index 0 at the top), output on the
 * right, select lines entering from the top. `selected` lights the chosen input path.
 */
export function Mux({
  x,
  y,
  w = 34,
  h,
  inputs,
  selected,
  on,
  title,
}: {
  x: number;
  y: number;
  w?: number;
  h: number;
  inputs: string[];
  selected?: number;
  on?: boolean;
  title?: string;
}) {
  const n = inputs.length;
  const gap = h / n;
  const inY = (k: number) => y + gap * (k + 0.5);
  return (
    <g>
      {title && <title>{title}</title>}
      <path
        d={`M${x} ${y} L${x + w} ${y + 8} L${x + w} ${y + h - 8} L${x} ${y + h} Z`}
        fill={on ? 'var(--active-soft)' : 'var(--surface)'}
        stroke={color(on)}
        strokeWidth={1.3}
        style={{ transition: 'fill 160ms, stroke 160ms' }}
      />
      {inputs.map((_, k) => (
        <Text key={k} at={[x + 4, inY(k)]} size={11.5} mono tone={on && selected === k ? 'active' : 'muted'} weight={on && selected === k ? 600 : 400}>
          {k}
        </Text>
      ))}
      {on && selected !== undefined && (
        <polyline
          points={`${x + 11},${inY(selected)} ${x + w - 4},${y + h / 2}`}
          stroke="var(--active)"
          strokeWidth={1.4}
          fill="none"
          strokeDasharray="3 2"
        />
      )}
      <Text at={[x + w / 2 + 3, y + h - 14]} size={12.5} anchor="middle" tone="muted">
        MUX
      </Text>
    </g>
  );
}

/** Input y of a Mux input, for wiring. */
export const muxInputY = (y: number, h: number, n: number, k: number) => y + (h / n) * (k + 0.5);

/** A control input pin on a register (LD, INR, CLR): a short stub with its name. */
export function Pin({ at, name, on, side = 'top' }: { at: Pt; name: string; on?: boolean; side?: 'top' | 'left' }) {
  const [x, y] = at;
  const end: Pt = side === 'top' ? [x, y - 12] : [x - 12, y];
  return (
    <g>
      <Wire points={[end, at]} on={on} />
      <Text at={side === 'top' ? [x, y - 18] : [x - 16, y]} size={12.5} anchor={side === 'top' ? 'middle' : 'end'} mono tone={on ? 'active' : 'muted'} weight={on ? 600 : 400}>
        {name}
      </Text>
    </g>
  );
}
