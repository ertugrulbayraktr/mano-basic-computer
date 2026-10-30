import { bitAt, trunc, type Bit } from '../bits';

/** Shift microoperations (Table 4-7). */
export type ShiftOp = 'shl' | 'shr' | 'cil' | 'cir' | 'ashl' | 'ashr';

export const SHIFT_OPS: readonly { op: ShiftOp; rtl: string; name: string }[] = [
  { op: 'shl', rtl: 'R ← shl R', name: 'Shift-left register R' },
  { op: 'shr', rtl: 'R ← shr R', name: 'Shift-right register R' },
  { op: 'cil', rtl: 'R ← cil R', name: 'Circular shift-left register R' },
  { op: 'cir', rtl: 'R ← cir R', name: 'Circular shift-right register R' },
  { op: 'ashl', rtl: 'R ← ashl R', name: 'Arithmetic shift-left R' },
  { op: 'ashr', rtl: 'R ← ashr R', name: 'Arithmetic shift-right R' },
];

/**
 * Applies a shift microoperation. Logical shifts insert 0. ashr keeps the sign bit and copies
 * it into R(n-2). For ashl, Vs = R(n-1) ⊕ R(n-2) is evaluated before the shift (Sec. 4-6).
 */
export function shiftMicro(op: ShiftOp, r: number, width: number): { value: number; vs?: Bit } {
  const msb = bitAt(r, width - 1);
  const lsb = bitAt(r, 0);
  switch (op) {
    case 'shl':
      return { value: trunc(r << 1, width) };
    case 'shr':
      return { value: trunc(r >>> 1, width) };
    case 'cil':
      return { value: trunc((r << 1) | msb, width) };
    case 'cir':
      return { value: trunc((r >>> 1) | (lsb << (width - 1)), width) };
    case 'ashl':
      return {
        value: trunc(r << 1, width),
        vs: (msb ^ bitAt(r, width - 2)) as Bit,
      };
    case 'ashr':
      return { value: trunc((r >>> 1) | (msb << (width - 1)), width) };
  }
}

/**
 * Combinational shifter (Fig. 4-12): one 2×1 MUX per output bit H_i.
 * S = 0 shifts right (serial input IR enters the leftmost bit); S = 1 shifts left (serial input
 * IL enters the rightmost bit).
 */
export function combinationalShifter(a: number, s: Bit, ir: Bit, il: Bit, width: number) {
  const muxes = Array.from({ length: width }, (_, i) => {
    const in0 = i === width - 1 ? ir : bitAt(a, i + 1);
    const in1 = i === 0 ? il : bitAt(a, i - 1);
    return { in0, in1, out: s ? in1 : in0 };
  });
  const h = muxes.reduce((acc, m, i) => (m.out ? acc | (1 << i) : acc), 0);
  return { h, muxes };
}
