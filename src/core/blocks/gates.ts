import type { Bit } from '../bits';

/** Digital logic gates (Mano Fig. 1-2). */
export type GateName = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR';

export const GATES: readonly GateName[] = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'];

export function gate(name: GateName, x: Bit, y: Bit = 0): Bit {
  switch (name) {
    case 'AND':
      return (x & y) as Bit;
    case 'OR':
      return (x | y) as Bit;
    case 'NOT':
      return (x ^ 1) as Bit;
    case 'NAND':
      return ((x & y) ^ 1) as Bit;
    case 'NOR':
      return ((x | y) ^ 1) as Bit;
    case 'XOR':
      return (x ^ y) as Bit;
    case 'XNOR':
      return (x ^ y ^ 1) as Bit;
  }
}

export const nor = (x: Bit, y: Bit): Bit => gate('NOR', x, y);

/** NOT, OR and AND built from NOR gates only, with the intermediate gate outputs exposed. */
export const norOnly = {
  not: (x: Bit) => ({ out: nor(x, x) }),
  or: (x: Bit, y: Bit) => {
    const n1 = nor(x, y);
    return { n1, out: nor(n1, n1) };
  },
  and: (x: Bit, y: Bit) => {
    const nx = nor(x, x);
    const ny = nor(y, y);
    return { nx, ny, out: nor(nx, ny) };
  },
};

/** Rows of a truth table for a 1- or 2-input gate, inputs in binary counting order. */
export function truthTable(name: GateName): { x: Bit; y: Bit; out: Bit }[] {
  const ys: Bit[] = name === 'NOT' ? [0] : [0, 1];
  const rows: { x: Bit; y: Bit; out: Bit }[] = [];
  for (const x of [0, 1] as Bit[]) for (const y of ys) rows.push({ x, y, out: gate(name, x, y) });
  return rows;
}
