import { bitAt, complement, trunc } from '../bits';

/** Logic circuit (Fig. 4-10): S1S0 = 00 AND, 01 OR, 10 XOR, 11 complement A. */
export const LOGIC_OPS = [
  { s1s0: 0, op: 'AND', microoperation: 'E = A ∧ B' },
  { s1s0: 1, op: 'OR', microoperation: 'E = A ∨ B' },
  { s1s0: 2, op: 'XOR', microoperation: 'E = A ⊕ B' },
  { s1s0: 3, op: 'Complement', microoperation: "E = A'" },
] as const;

export function logicCircuit(a: number, b: number, s1s0: number, width: number) {
  const and = trunc(a & b, width);
  const or = trunc(a | b, width);
  const xor = trunc(a ^ b, width);
  const not = complement(a, width);
  const candidates = [and, or, xor, not];
  return { candidates, e: candidates[s1s0], ...LOGIC_OPS[s1s0] };
}

/**
 * The 16 logic functions of two variables (Table 4-5) and their microoperations (Table 4-6).
 * F_i's truth-table column, read for xy = 00, 01, 10, 11, is i written in binary (MSB first).
 */
export const LOGIC_FUNCTIONS = [
  { f: 0, boolean: 'F0 = 0', micro: 'F ← 0', name: 'Clear' },
  { f: 1, boolean: 'F1 = xy', micro: 'F ← A ∧ B', name: 'AND' },
  { f: 2, boolean: "F2 = xy'", micro: "F ← A ∧ B'", name: '' },
  { f: 3, boolean: 'F3 = x', micro: 'F ← A', name: 'Transfer A' },
  { f: 4, boolean: "F4 = x'y", micro: "F ← A' ∧ B", name: '' },
  { f: 5, boolean: 'F5 = y', micro: 'F ← B', name: 'Transfer B' },
  { f: 6, boolean: 'F6 = x ⊕ y', micro: 'F ← A ⊕ B', name: 'Exclusive-OR' },
  { f: 7, boolean: 'F7 = x + y', micro: 'F ← A ∨ B', name: 'OR' },
  { f: 8, boolean: "F8 = (x + y)'", micro: "F ← (A ∨ B)'", name: 'NOR' },
  { f: 9, boolean: "F9 = (x ⊕ y)'", micro: "F ← (A ⊕ B)'", name: 'Exclusive-NOR' },
  { f: 10, boolean: "F10 = y'", micro: "F ← B'", name: 'Complement B' },
  { f: 11, boolean: "F11 = x + y'", micro: "F ← A ∨ B'", name: '' },
  { f: 12, boolean: "F12 = x'", micro: "F ← A'", name: 'Complement A' },
  { f: 13, boolean: "F13 = x' + y", micro: "F ← A' ∨ B", name: '' },
  { f: 14, boolean: "F14 = (xy)'", micro: "F ← (A ∧ B)'", name: 'NAND' },
  { f: 15, boolean: 'F15 = 1', micro: 'F ← all 1s', name: 'Set to all 1s' },
] as const;

/** Applies logic function F_i bitwise to A and B. */
export function logicFunction(f: number, a: number, b: number, width: number): number {
  let out = 0;
  for (let i = 0; i < width; i++) {
    const row = (bitAt(a, i) << 1) | bitAt(b, i);
    if (bitAt(f, 3 - row)) out |= 1 << i;
  }
  return trunc(out, width);
}

/** Logic microoperation applications (Sec. 4-5). B is the register of the operation. */
export const logicApplications = {
  selectiveSet: (a: number, b: number) => a | b,
  selectiveComplement: (a: number, b: number) => a ^ b,
  selectiveClear: (a: number, b: number, width: number) => trunc(a & ~b, width),
  mask: (a: number, b: number) => a & b,
  /** Insert: mask the bits to be replaced (AND with keepMask), then OR the new bits. */
  insert: (a: number, keepMask: number, newBits: number) => {
    const masked = a & keepMask;
    return { masked, result: masked | newBits };
  },
  /** Clear (compare): A ⊕ B is zero exactly when A = B. */
  clear: (a: number, b: number) => {
    const result = a ^ b;
    return { result, equal: result === 0 };
  },
};
