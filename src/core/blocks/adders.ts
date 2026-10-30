import { bitAt, trunc, type Bit } from '../bits';

/** Half adder: S = x ⊕ y, C = xy. */
export const halfAdder = (x: Bit, y: Bit) => ({ s: (x ^ y) as Bit, c: (x & y) as Bit });

/**
 * Full adder built from two half adders and an OR gate:
 * S1, C1 = HA(x, y); S, C2 = HA(S1, z); C = C1 + C2.
 * Equivalent to S = x ⊕ y ⊕ z, C = xy + xz + yz.
 */
export function fullAdder(x: Bit, y: Bit, z: Bit) {
  const h1 = halfAdder(x, y);
  const h2 = halfAdder(h1.s, z);
  return { s1: h1.s, c1: h1.c, c2: h2.c, s: h2.s, c: (h1.c | h2.c) as Bit };
}

/**
 * n-bit ripple-carry adder (Fig. 2-6 for n = 4).
 * carries[i] is C_i: carries[0] = C0 (input carry), carries[n] = output carry.
 */
export function rippleAdder(a: number, b: number, c0: Bit, width: number) {
  const carries: Bit[] = [c0];
  let sum = 0;
  for (let i = 0; i < width; i++) {
    const fa = fullAdder(bitAt(a, i), bitAt(b, i), carries[i]);
    if (fa.s) sum |= 1 << i;
    carries.push(fa.c);
  }
  return { sum: trunc(sum, width), carries, cout: carries[width] };
}
