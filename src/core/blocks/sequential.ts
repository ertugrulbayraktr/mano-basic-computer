import { bitAt, mask, trunc, type Bit } from '../bits';

export interface RegisterControls {
  ld?: boolean;
  clr?: boolean;
  inr?: boolean;
}

/**
 * Next value of a register on a clock pulse. Priority follows the counter with parallel load
 * (Table 2-4): Clear, then Load, then Increment. Without control inputs the value is kept.
 */
export function clockRegister(
  value: number,
  width: number,
  ctl: RegisterControls,
  input = 0,
): number {
  if (ctl.clr) return 0;
  if (ctl.ld) return trunc(input, width);
  if (ctl.inr) return trunc(value + 1, width);
  return value;
}

/** Binary counter (Fig. 2-10): increments on the clock, 1111 → 0000. */
export const countUp = (value: number, width: number): number => trunc(value + 1, width);

export type ShiftDirection = 'right' | 'left';

/**
 * Shift register (Fig. 2-8, and the bidirectional register of Fig. 2-9).
 * Shift right moves bits toward bit 0 and the serial input enters the leftmost bit;
 * shift left moves bits toward bit n-1 and the serial input enters the rightmost bit.
 * In circular mode the bit shifted out re-enters at the other end instead.
 */
export function shiftRegister(
  value: number,
  width: number,
  dir: ShiftDirection,
  serialIn: Bit,
  circular = false,
) {
  if (dir === 'right') {
    const out = bitAt(value, 0);
    const enter = circular ? out : serialIn;
    return { value: trunc((value >>> 1) | (enter << (width - 1)), width), serialOut: out };
  }
  const out = bitAt(value, width - 1);
  const enter = circular ? out : serialIn;
  return { value: trunc((value << 1) | enter, width), serialOut: out };
}

/** m × n memory unit (Fig. 2-12) with k address bits, 2^k = m. */
export class MemoryUnit {
  readonly words: number[];
  constructor(
    readonly k: number,
    readonly n: number,
  ) {
    this.words = new Array(2 ** k).fill(0);
  }
  read(address: number): number {
    return this.words[address & mask(this.k)];
  }
  write(address: number, data: number): void {
    this.words[address & mask(this.k)] = trunc(data, this.n);
  }
}
