import type { Bit } from '../bits';
import { fieldOpcode } from './isa';
import type { MachineState } from './types';

/**
 * The control logic gates of the Basic Computer (Sec. 5-10), written as sum-of-products
 * equations. Each term is an AND gate; the terms of one equation feed an OR gate whose output
 * is a control input of the datapath (e.g. LD of AR, Fig. 5-16), a bus encoder input
 * (Table 5-7), a memory control, or a flip-flop control.
 *
 * Literals: T0…T15 and D0…D7 (decoder outputs), I, R, IEN, FGI, FGO, E (flip-flops),
 * r = D7I'T3 and p = D7IT3, Bi = IR(i), AC15 = AC(15), ACZ = (AC = 0), DRZ = (DR = 0).
 * A trailing ' complements a literal.
 */

export type Literal = string;
export type Term = Literal[];

export interface ControlEquation {
  /** Output id, e.g. "AR.LD", "x7", "MEM.READ". */
  id: string;
  /** Which part of the datapath it controls, used to group the drawing. */
  group: string;
  /** Human-readable name of the output. */
  name: string;
  terms: Term[];
}

const t = (s: string): Term => s.split(' ');

export const CONTROL_EQUATIONS: ControlEquation[] = [
  // Address register (Fig. 5-16).
  { id: 'AR.LD', group: 'AR', name: 'LD(AR)', terms: [t("R' T0"), t("R' T2"), t("D7' I T3")] },
  { id: 'AR.CLR', group: 'AR', name: 'CLR(AR)', terms: [t('R T0')] },
  { id: 'AR.INR', group: 'AR', name: 'INR(AR)', terms: [t('D5 T4')] },
  // Program counter.
  { id: 'PC.LD', group: 'PC', name: 'LD(PC)', terms: [t('D4 T4'), t('D5 T5')] },
  {
    id: 'PC.INR',
    group: 'PC',
    name: 'INR(PC)',
    terms: [
      t("R' T1"),
      t('R T2'),
      t('D6 T6 DRZ'),
      t("r B4 AC15'"),
      t('r B3 AC15'),
      t('r B2 ACZ'),
      t("r B1 E'"),
      t('p B9 FGI'),
      t('p B8 FGO'),
    ],
  },
  { id: 'PC.CLR', group: 'PC', name: 'CLR(PC)', terms: [t('R T1')] },
  // Data register.
  { id: 'DR.LD', group: 'DR', name: 'LD(DR)', terms: [t('D0 T4'), t('D1 T4'), t('D2 T4'), t('D6 T4')] },
  { id: 'DR.INR', group: 'DR', name: 'INR(DR)', terms: [t('D6 T5')] },
  // Accumulator: LD comes from the adder and logic circuit (Fig. 5-19, 5-20).
  { id: 'AC.LD', group: 'AC', name: 'LD(AC)', terms: [t('D0 T5'), t('D1 T5'), t('D2 T5'), t('r B9'), t('r B7'), t('r B6'), t('p B11')] },
  { id: 'AC.INR', group: 'AC', name: 'INR(AC)', terms: [t('r B5')] },
  { id: 'AC.CLR', group: 'AC', name: 'CLR(AC)', terms: [t('r B11')] },
  { id: 'IR.LD', group: 'IR', name: 'LD(IR)', terms: [t("R' T1")] },
  { id: 'TR.LD', group: 'TR', name: 'LD(TR)', terms: [t('R T0')] },
  { id: 'OUTR.LD', group: 'OUTR', name: 'LD(OUTR)', terms: [t('p B10')] },
  // Memory read and write.
  { id: 'MEM.READ', group: 'Memory', name: 'Read', terms: [t("R' T1"), t("D7' I T3"), t('D0 T4'), t('D1 T4'), t('D2 T4'), t('D6 T4')] },
  { id: 'MEM.WRITE', group: 'Memory', name: 'Write', terms: [t('D3 T4'), t('D5 T4'), t('D6 T6'), t('R T1')] },
  // Bus select encoder inputs x1…x7 (Table 5-7).
  { id: 'x1', group: 'Bus', name: 'x1 (AR)', terms: [t('D4 T4'), t('D5 T5')] },
  { id: 'x2', group: 'Bus', name: 'x2 (PC)', terms: [t("R' T0"), t('R T0'), t('D5 T4')] },
  { id: 'x3', group: 'Bus', name: 'x3 (DR)', terms: [t('D6 T6')] },
  { id: 'x4', group: 'Bus', name: 'x4 (AC)', terms: [t('D3 T4'), t('p B10')] },
  { id: 'x5', group: 'Bus', name: 'x5 (IR)', terms: [t("R' T2")] },
  { id: 'x6', group: 'Bus', name: 'x6 (TR)', terms: [t('R T1')] },
  { id: 'x7', group: 'Bus', name: 'x7 (Memory)', terms: [t("R' T1"), t("D7' I T3"), t('D0 T4'), t('D1 T4'), t('D2 T4'), t('D6 T4')] },
  // Inputs of the adder and logic circuit (Fig. 5-21).
  { id: 'ALU.AND', group: 'Adder & logic', name: 'AND', terms: [t('D0 T5')] },
  { id: 'ALU.ADD', group: 'Adder & logic', name: 'ADD', terms: [t('D1 T5')] },
  { id: 'ALU.DR', group: 'Adder & logic', name: 'DR', terms: [t('D2 T5')] },
  { id: 'ALU.INPR', group: 'Adder & logic', name: 'INPR', terms: [t('p B11')] },
  { id: 'ALU.COM', group: 'Adder & logic', name: 'COM', terms: [t('r B9')] },
  { id: 'ALU.SHR', group: 'Adder & logic', name: 'SHR', terms: [t('r B7')] },
  { id: 'ALU.SHL', group: 'Adder & logic', name: 'SHL', terms: [t('r B6')] },
  // E flip-flop.
  { id: 'E.CLR', group: 'E', name: 'CLR(E)', terms: [t('r B10')] },
  { id: 'E.COM', group: 'E', name: 'COM(E)', terms: [t('r B8')] },
  { id: 'E.LD', group: 'E', name: 'LD(E)', terms: [t('D1 T5'), t('r B7'), t('r B6')] },
  // Sequence counter.
  {
    id: 'SC.CLR',
    group: 'SC',
    name: 'CLR(SC)',
    terms: [t('R T2'), t('D0 T5'), t('D1 T5'), t('D2 T5'), t('D3 T4'), t('D4 T4'), t('D5 T5'), t('D6 T6'), t('r'), t('p')],
  },
  // Other flip-flops (Fig. 5-13 for R and IEN).
  { id: 'I.LD', group: 'Flip-flops', name: 'LD(I)', terms: [t("R' T2")] },
  { id: 'S.CLR', group: 'Flip-flops', name: 'CLR(S)', terms: [t('r B0')] },
  { id: 'R.SET', group: 'Flip-flops', name: 'SET(R)', terms: [t("T0' T1' T2' IEN FGI"), t("T0' T1' T2' IEN FGO")] },
  { id: 'R.CLR', group: 'Flip-flops', name: 'CLR(R)', terms: [t('R T2')] },
  { id: 'IEN.SET', group: 'Flip-flops', name: 'SET(IEN)', terms: [t('p B7')] },
  { id: 'IEN.CLR', group: 'Flip-flops', name: 'CLR(IEN)', terms: [t('p B6'), t('R T2')] },
  { id: 'FGI.CLR', group: 'Flip-flops', name: 'CLR(FGI)', terms: [t('p B11')] },
  { id: 'FGO.CLR', group: 'Flip-flops', name: 'CLR(FGO)', terms: [t('p B10')] },
];

export const EQUATION_BY_ID: Record<string, ControlEquation> = Object.fromEntries(CONTROL_EQUATIONS.map((e) => [e.id, e]));

/** Values of every literal for the state before a clock pulse. */
export function literalValues(s: MachineState): Record<string, Bit> {
  const v: Record<string, Bit> = {};
  for (let i = 0; i < 16; i++) v[`T${i}`] = (s.SC === i ? 1 : 0) as Bit;
  const d = fieldOpcode(s.reg.IR);
  for (let i = 0; i < 8; i++) v[`D${i}`] = (d === i ? 1 : 0) as Bit;
  for (let i = 0; i < 12; i++) v[`B${i}`] = ((s.reg.IR >> i) & 1) as Bit;
  const { I, R, IEN, FGI, FGO, E } = s.flag;
  Object.assign(v, { I, R, IEN, FGI, FGO, E });
  v.r = (v.D7 & (I ^ 1) & v.T3) as Bit;
  v.p = (v.D7 & I & v.T3) as Bit;
  v.AC15 = ((s.reg.AC >> 15) & 1) as Bit;
  v.ACZ = (s.reg.AC === 0 ? 1 : 0) as Bit;
  v.DRZ = (s.reg.DR === 0 ? 1 : 0) as Bit;
  return v;
}

export const literalValue = (lit: Literal, v: Record<string, Bit>): Bit =>
  (lit.endsWith("'") ? v[lit.slice(0, -1)] ^ 1 : v[lit]) as Bit;

export const termValue = (term: Term, v: Record<string, Bit>): Bit =>
  (term.every((l) => literalValue(l, v)) ? 1 : 0) as Bit;

export interface EquationValue {
  equation: ControlEquation;
  terms: Bit[];
  out: Bit;
}

/** Evaluates every control gate for a state. */
export function evaluateControl(s: MachineState): Record<string, EquationValue> {
  const v = literalValues(s);
  const out: Record<string, EquationValue> = {};
  for (const eq of CONTROL_EQUATIONS) {
    const terms = eq.terms.map((term) => termValue(term, v));
    out[eq.id] = { equation: eq, terms, out: (terms.some(Boolean) ? 1 : 0) as Bit };
  }
  return out;
}

const DISPLAY: Record<string, string> = { AC15: 'AC(15)', ACZ: '(AC = 0)', DRZ: '(DR = 0)' };
const SHORT = /^(T\d+|D\d|R|I|r|p|B\d+)'?$/;

/** Mano-style label of a term: R'T0, D7'IT3, rB4·AC(15)'. */
export function termLabel(term: Term): string {
  let s = '';
  term.forEach((lit, i) => {
    const neg = lit.endsWith("'");
    const name = neg ? lit.slice(0, -1) : lit;
    const text = (DISPLAY[name] ?? name) + (neg ? "'" : '');
    const joinPlain = i > 0 && SHORT.test(term[i - 1]) && SHORT.test(lit);
    s += i === 0 || joinPlain ? text : `·${text}`;
  });
  return s;
}
