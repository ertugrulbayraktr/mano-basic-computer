import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { bitAt, toSigned, trunc, type Bit } from '../../core/bits';
import { useSettings, type Width } from '../settings';
import { Ref } from './controls';

/** Section menu for a room, linking to nested routes. */
export function RoomMenu({ base, items, label }: { base: string; items: { id: string; name: string; ref: string }[]; label: string }) {
  return (
    <nav className="room-menu" aria-label={label}>
      {items.map((s) => (
        <NavLink key={s.id} to={`${base}/${s.id}`}>
          <span>{s.name}</span>
          <span className="mono muted" style={{ fontSize: 11 }}>
            {s.ref}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}

/** Title block of one interactive circuit. */
export function BlockHeader({ title, refs, children, right }: { title: string; refs: string; children?: ReactNode; right?: ReactNode }) {
  return (
    <section className="panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ minWidth: 0, flex: '1 1 420px' }}>
        <h1 className="block-title">
          {title} <Ref>{refs}</Ref>
        </h1>
        {children && <p className="block-lede">{children}</p>}
      </div>
      {right}
    </section>
  );
}

export function WidthSelect() {
  const { width, setWidth } = useSettings();
  return (
    <div className="seg" role="group" aria-label="Word width">
      {([4, 8, 16] as Width[]).map((w) => (
        <button key={w} className="mono" aria-pressed={width === w} onClick={() => setWidth(w)}>
          {w} bits
        </button>
      ))}
    </div>
  );
}

/** Word input state that stays within the selected width. */
export function useWord(initial: number, width: number): [number, (v: number) => void] {
  const [v, set] = useState(initial);
  return [trunc(v, width), (n: number) => set(trunc(n, width))];
}

/** Unsigned and signed interpretation of a word. */
export function Interpret({ value, width }: { value: number; width: number }) {
  return (
    <span className="mono muted" style={{ fontSize: 12 }}>
      unsigned {trunc(value, width)}, signed {toSigned(value, width) >= 0 ? '+' : ''}
      {toSigned(value, width)}
    </span>
  );
}

/**
 * A chain of n one-bit stages drawn MSB on the left, with the carries between them
 * (C0 enters on the right). Used for adders, incrementers and the arithmetic circuit.
 */
export function CarryChain({
  width,
  rows,
  carries,
  outLabel,
  out,
  stageLabel,
}: {
  width: number;
  rows: { label: string; value: number }[];
  carries: readonly Bit[];
  outLabel: string;
  out: number;
  stageLabel: string;
}) {
  const stages = Array.from({ length: width }, (_, k) => width - 1 - k);
  const compact = width > 8;
  return (
    <div className="scroll-x">
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, fontFamily: 'var(--mono)', fontSize: compact ? 11 : 13, minWidth: 'min-content' }}>
        <Carry label={`C${width}`} v={carries[width]} />
        {stages.map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'stretch' }}>
            <div style={{ border: '1px solid var(--line)', borderRadius: 4, background: 'var(--box)', padding: compact ? '4px 5px' : '8px 10px', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', minWidth: compact ? 34 : 54 }}>
              {rows.map((r) => (
                <span key={r.label} className="muted">
                  {r.label}
                  <sub>{i}</sub>={bitAt(r.value, i)}
                </span>
              ))}
              <span className="cap" style={{ fontSize: 9 }}>
                {stageLabel}
              </span>
              <span style={{ color: 'var(--active)', fontWeight: 600 }}>
                {outLabel}
                <sub>{i}</sub>={bitAt(out, i)}
              </span>
            </div>
            {i > 0 && <Carry label={`C${i}`} v={carries[i]} />}
          </div>
        ))}
        <Carry label="C0" v={carries[0]} />
      </div>
    </div>
  );
}

function Carry({ label, v }: { label: string; v: Bit }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 4px', color: v ? 'var(--active)' : 'var(--muted)' }} title={`${label} = ${v}`}>
      <span style={{ fontSize: 10 }}>{label}</span>
      <span>←{v}</span>
    </div>
  );
}

/** Status-bit chip. `meaningless` dims C and V after a logic or shift operation. */
export function Flag({ name, v, note, meaningless }: { name: string; v: Bit; note?: string; meaningless?: boolean }) {
  return (
    <span
      className="mono"
      title={note}
      style={{
        border: `1px solid ${meaningless ? 'var(--line-soft)' : v ? 'var(--changed)' : 'var(--line)'}`,
        color: meaningless ? 'var(--muted)' : v ? 'var(--changed)' : 'var(--text)',
        borderRadius: 3,
        padding: '6px 10px',
        textDecoration: meaningless ? 'line-through' : undefined,
      }}
    >
      {name} {v}
    </span>
  );
}

/** A candidate output card; the selected one glows. */
export function Candidate({ title, op, value, selected, children }: { title: string; op: string; value: ReactNode; selected: boolean; children?: ReactNode }) {
  return (
    <div
      aria-current={selected ? 'true' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 14,
        borderRadius: 4,
        border: selected ? '1px solid var(--active)' : '1px dashed var(--line)',
        background: selected ? 'var(--active-soft)' : undefined,
        boxShadow: selected ? '0 0 14px rgb(37 99 235 / 25)' : undefined,
        color: selected ? 'var(--text)' : 'var(--muted)',
        minWidth: 0,
      }}
    >
      <span className="cap" style={{ color: selected ? 'var(--active)' : undefined }}>
        {title}
      </span>
      <span className="mono" style={{ fontSize: 14 }}>
        {op}
      </span>
      <span className="mono" style={{ fontSize: 20, letterSpacing: '.06em', overflowWrap: 'anywhere' }}>
        {value}
      </span>
      {children}
    </div>
  );
}
