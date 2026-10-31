import { bitAt, complement, mask, trunc, type Bit } from '../bits';
import { halfAdder, rippleAdder } from '../blocks/adders';

/**
 * 4-bit adder-subtractor (Fig. 4-7), generalized to n bits.
 * M = 0: A + B. M = 1: A + B' + 1 (M feeds both the XOR gates and C0).
 * V = C(n-1) ⊕ C(n) is the overflow for signed numbers; C(n) is the carry for unsigned ones.
 */
export function adderSubtractor(a: number, b: number, m: Bit, width: number) {
  const bIn = m ? complement(b, width) : trunc(b, width);
  const r = rippleAdder(a, bIn, m, width);
  const v = (r.carries[width - 1] ^ r.carries[width]) as Bit;
  return { bIn, sum: r.sum, carries: r.carries, c: r.cout, v };
}

/** Binary incrementer (Fig. 4-8): a chain of half adders with a constant 1 into the first. */
export function incrementer(a: number, width: number) {
  const carries: Bit[] = [1];
  let sum = 0;
  for (let i = 0; i < width; i++) {
    const ha = halfAdder(bitAt(a, i), carries[i]);
    if (ha.s) sum |= 1 << i;
    carries.push(ha.c);
  }
  return { sum, carries, cout: carries[width] };
}

/**
 * Which value the 4×1 MUX feeds into the Y input of the adder for each S1S0.
 * - 'fig4-9': the wiring of Fig. 4-9 and Table 4-4 (00 → B, 01 → B', 10 → 0, 11 → all 1s).
 * - 'table4-8': the order printed in Table 4-8 (00 → 0, 01 → B, 10 → B', 11 → all 1s).
 * The book's text refers to Table 4-4, but Table 4-8 lists the arithmetic rows in another order.
 */
export type ArithmeticEncoding = 'table4-8' | 'fig4-9';

export type YSource = 'B' | "B'" | '0' | '1s';

const Y_SOURCES: Record<ArithmeticEncoding, YSource[]> = {
  'fig4-9': ['B', "B'", '0', '1s'],
  'table4-8': ['0', 'B', "B'", '1s'],
};

const MICROOPERATION: Record<YSource, [string, string]> = {
  B: ['D = A + B', 'D = A + B + 1'],
  "B'": ["D = A + B'", "D = A + B' + 1"],
  '0': ['D = A', 'D = A + 1'],
  '1s': ['D = A − 1', 'D = A'],
};

const NAMES: Record<YSource, [string, string]> = {
  B: ['Add', 'Add with carry'],
  "B'": ['Subtract with borrow', 'Subtract'],
  '0': ['Transfer A', 'Increment A'],
  '1s': ['Decrement A', 'Transfer A'],
};

/** Turkish names for the Table 4-4 rows. */
export const ARITH_NAME_TR: Record<string, string> = {
  Add: 'Topla',
  'Add with carry': 'Elde ile topla',
  'Subtract with borrow': 'Ödünç ile çıkar',
  Subtract: 'Çıkar',
  'Transfer A': "A'yı aktar",
  'Increment A': "A'yı arttır",
  'Decrement A': "A'yı azalt",
};

export const ySource = (s1s0: number, enc: ArithmeticEncoding): YSource => Y_SOURCES[enc][s1s0];

export function yValue(src: YSource, b: number, width: number): number {
  switch (src) {
    case 'B':
      return trunc(b, width);
    case "B'":
      return complement(b, width);
    case '0':
      return 0;
    case '1s':
      return mask(width);
  }
}

export function arithmeticLabel(s1s0: number, cin: Bit, enc: ArithmeticEncoding) {
  const src = ySource(s1s0, enc);
  return { y: src, microoperation: MICROOPERATION[src][cin], name: NAMES[src][cin] };
}

/** Arithmetic circuit (Fig. 4-9): D = A + Y + Cin, Y selected by S1S0. */
export function arithmeticCircuit(
  a: number,
  b: number,
  s1s0: number,
  cin: Bit,
  width: number,
  enc: ArithmeticEncoding = 'fig4-9',
) {
  const label = arithmeticLabel(s1s0, cin, enc);
  const y = yValue(label.y, b, width);
  const r = rippleAdder(a, y, cin, width);
  const v = (r.carries[width - 1] ^ r.carries[width]) as Bit;
  return { ...label, yValue: y, d: r.sum, carries: r.carries, cout: r.cout, v };
}

/** All eight rows of the function table (Table 4-4 or the arithmetic part of Table 4-8). */
export function arithmeticTable(enc: ArithmeticEncoding) {
  const rows = [];
  for (let s1s0 = 0; s1s0 < 4; s1s0++)
    for (const cin of [0, 1] as Bit[]) rows.push({ s1s0, cin, ...arithmeticLabel(s1s0, cin, enc) });
  return rows;
}
