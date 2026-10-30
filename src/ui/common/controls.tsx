import { useEffect, useRef, useState, type ReactNode } from 'react';
import { bitAt, type Base } from '../../core/bits';
import { useSettings } from '../settings';
import { BASE_LABEL, fmt, parseWord } from './format';

/** HEX / BIN / DEC switch bound to the global number base setting. */
export function BaseSwitch({ allowSigned = false }: { allowSigned?: boolean }) {
  const { base, setBase, signed, setSigned } = useSettings();
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <div className="seg" role="group" aria-label="Number base">
        {(['hex', 'bin', 'dec'] as Base[]).map((b) => (
          <button key={b} className="mono" aria-pressed={base === b} onClick={() => setBase(b)}>
            {BASE_LABEL[b]}
          </button>
        ))}
      </div>
      {allowSigned && base === 'dec' && (
        <div className="seg" role="group" aria-label="Decimal interpretation">
          <button aria-pressed={!signed} onClick={() => setSigned(false)}>
            unsigned
          </button>
          <button aria-pressed={signed} onClick={() => setSigned(true)}>
            signed
          </button>
        </div>
      )}
    </div>
  );
}

/** A figure/table reference with a tooltip. */
export function Ref({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="ref" title={title ?? `Mano, Computer System Architecture, 3rd ed.: ${children}`}>
      {children}
    </span>
  );
}

export function Panel({
  title,
  refs,
  children,
  className = '',
  label,
  style,
}: {
  title: ReactNode;
  refs?: ReactNode;
  children: ReactNode;
  className?: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section className={`panel ${className}`} aria-label={label} style={style}>
      <div className="panel-head">
        <span className="cap">{title}</span>
        {refs}
      </div>
      {children}
    </section>
  );
}

/**
 * A value that turns into a text field when clicked. Enter commits in the current base,
 * Escape cancels.
 */
export function EditableValue({
  value,
  width,
  onCommit,
  label,
  className = '',
  style,
  compact = false,
}: {
  value: number;
  width: number;
  onCommit: (v: number) => void;
  label: string;
  className?: string;
  style?: React.CSSProperties;
  /** In narrow places, show hexadecimal instead of long binary words. */
  compact?: boolean;
}) {
  const settings = useSettings();
  const base = compact && settings.base === 'bin' ? 'hex' : settings.base;
  const { signed } = settings;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        className={`mono ${className}`}
        aria-label={`Edit ${label}`}
        title={`Click to edit ${label}`}
        onClick={() => {
          setText(fmt(value, width, base, signed));
          setError(false);
          setEditing(true);
        }}
        style={{ background: 'none', border: 0, padding: 0, cursor: 'text', ...style }}
      >
        {fmt(value, width, base, signed)}
      </button>
    );
  }
  const commit = () => {
    const v = parseWord(text, base, width);
    if (v === null) {
      setError(true);
      return;
    }
    onCommit(v);
    setEditing(false);
  };
  return (
    <input
      ref={ref}
      className="mono input"
      aria-label={`${label} (${BASE_LABEL[base]})`}
      aria-invalid={error}
      value={text}
      size={Math.max(4, text.length + 1)}
      onChange={(e) => {
        setText(e.target.value);
        setError(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
      onBlur={() => setEditing(false)}
      style={{ minHeight: 28, padding: '0 6px', borderColor: error ? 'var(--alert)' : undefined, ...style }}
    />
  );
}

/** A row of bit toggles, MSB on the left. */
export function BitInput({
  label,
  value,
  width,
  onChange,
  names,
}: {
  label: string;
  value: number;
  width: number;
  onChange?: (v: number) => void;
  /** Optional per-bit names, index 0 = LSB. */
  names?: string[];
}) {
  const size = width > 8 ? 28 : 38;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="cap">{label}</span>
      <div style={{ display: 'flex', gap: width > 8 ? 2 : 4, flexWrap: 'wrap' }}>
        {Array.from({ length: width }, (_, k) => width - 1 - k).map((i) => (
          <button
            key={i}
            className="bit"
            aria-pressed={bitAt(value, i) === 1}
            aria-label={`${label} ${names?.[i] ?? `bit ${i}`}`}
            title={names?.[i] ?? `bit ${i}`}
            disabled={!onChange}
            onClick={() => onChange?.(value ^ (1 << i))}
            style={{ width: size, height: size, fontSize: width > 8 ? 13 : 16 }}
          >
            {bitAt(value, i)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A single named bit toggle. */
export function BitToggle({ label, value, onChange }: { label: string; value: 0 | 1; onChange: (v: 0 | 1) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <span className="cap">{label}</span>
      <button className="bit" aria-pressed={value === 1} aria-label={label} onClick={() => onChange(value ? 0 : 1)}>
        {value}
      </button>
    </div>
  );
}

/** Formatted word in the current base. */
export function Word({ value, width, className, signedOverride }: { value: number; width: number; className?: string; signedOverride?: boolean }) {
  const { base, signed } = useSettings();
  return <span className={`mono ${className ?? ''}`}>{fmt(value, width, base, signedOverride ?? signed)}</span>;
}
