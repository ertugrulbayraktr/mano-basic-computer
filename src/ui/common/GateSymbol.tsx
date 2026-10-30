import type { Bit } from '../../core/bits';
import type { GateName } from '../../core/blocks/gates';

const wire = (v: Bit | undefined) => (v ? 'var(--cyan)' : 'var(--line)');

/**
 * Distinctive-shape gate symbol (Fig. 1-2), 120 × 64, with input and output wires colored by
 * their logic value.
 */
export function GateSymbol({ name, x, y, out, label }: { name: GateName; x: Bit; y?: Bit; out: Bit; label?: string }) {
  const single = name === 'NOT';
  const bubble = name === 'NOT' || name === 'NAND' || name === 'NOR' || name === 'XNOR';
  const body = (() => {
    if (single) return 'M40 12 L80 32 L40 52 Z';
    if (name === 'AND' || name === 'NAND') return 'M40 10 H60 A22 22 0 0 1 60 54 H40 Z';
    return 'M38 10 Q70 10 84 32 Q70 54 38 54 Q50 32 38 10 Z';
  })();
  const end = single ? 80 : name === 'AND' || name === 'NAND' ? 82 : 84;
  const outX = bubble ? end + 8 : end;
  return (
    <svg width={120} height={64} viewBox="0 0 120 64" role="img" aria-label={label ?? `${name} gate, output ${out}`}>
      {single ? (
        <line x1={0} x2={40} y1={32} y2={32} stroke={wire(x)} strokeWidth={2} />
      ) : (
        <>
          <line x1={0} x2={44} y1={20} y2={20} stroke={wire(x)} strokeWidth={2} />
          <line x1={0} x2={44} y1={44} y2={44} stroke={wire(y)} strokeWidth={2} />
        </>
      )}
      {(name === 'XOR' || name === 'XNOR') && <path d="M30 10 Q42 32 30 54" fill="none" stroke="var(--text-2)" strokeWidth={2} />}
      <path d={body} fill="var(--box)" stroke="var(--text-2)" strokeWidth={2} />
      {bubble && <circle cx={end + 4} cy={32} r={4} fill="var(--box)" stroke="var(--text-2)" strokeWidth={2} />}
      <line x1={outX} x2={120} y1={32} y2={32} stroke={wire(out)} strokeWidth={2} />
    </svg>
  );
}
