import { toBin, toHex } from '../bits';
import { AC_OP_LABEL } from './adderLogic';
import { evaluateControl, termLabel, type EquationValue } from './controlLogic';
import { fieldOpcode } from './isa';
import type { PulseTrace } from './pulse';
import { REG_WIDTH, type MachineState, type RegName } from './types';

/**
 * One clock pulse split into the order in which its signals settle in the hardware:
 * 1. timing and decode: SC drives the 4×16 decoder (T0…T15) and IR(12-14) the 3×8 decoder (D0…D7);
 * 2. control gates: the AND/OR gates of Sec. 5-10 raise the control inputs;
 * 3. data flow: the bus encoder selects a source, values travel on the bus and through the
 *    adder and logic circuit to the inputs of the registers;
 * 4. clock edge: every enabled register and flip-flop latches at the same instant.
 * Steps 1-3 happen between two clock edges; nothing is stored until step 4.
 */
export type MicroStepKind = 'decode' | 'control' | 'transfer' | 'latch';

export const MICRO_STEP_KINDS: MicroStepKind[] = ['decode', 'control', 'transfer', 'latch'];

export const MICRO_STEP_TITLE: Record<MicroStepKind, string> = {
  decode: 'Timing and decode',
  control: 'Control gates',
  transfer: 'Data flow',
  latch: 'Clock edge',
};

export interface ActiveGate {
  /** Equation id, e.g. "DR.LD". */
  output: string;
  /** Output name as in the book, e.g. "LD(DR)". */
  name: string;
  /** Labels of the AND terms that are 1, e.g. ["D1T4"]. */
  terms: string[];
}

export interface PulseView {
  trace: PulseTrace;
  T: number;
  D: number;
  /** Every control gate evaluated on the pre-pulse state. */
  gates: Record<string, EquationValue>;
  active: ActiveGate[];
  steps: { kind: MicroStepKind; title: string; text: string[] }[];
}

const hex = (v: number, w: number) => toHex(v, w);

/** Builds the four sub-steps of a pulse from its trace. */
export function viewPulse(trace: PulseTrace, mem?: Uint16Array): PulseView {
  const pre = { ...trace.before, mem: mem ?? new Uint16Array(4096) } as MachineState;
  const T = pre.SC;
  const D = fieldOpcode(pre.reg.IR);
  const gates = evaluateControl(pre);
  const active: ActiveGate[] = Object.values(gates)
    .filter((g) => g.out)
    .map((g) => ({
      output: g.equation.id,
      name: g.equation.name,
      terms: g.equation.terms.filter((_, i) => g.terms[i]).map(termLabel),
    }));

  if (trace.signals.phase === 'halted') {
    return {
      trace,
      T,
      D,
      gates,
      active: [],
      steps: [{ kind: 'decode', title: 'Halted', text: ['S = 0: the clock is stopped, so no timing signal advances.'] }],
    };
  }

  const { I, R } = pre.flag;
  const decode = [
    `SC = ${toBin(T, 4)} → the 4 × 16 decoder raises T${T}.`,
    `IR(12-14) = ${toBin(D, 3)} → the 3 × 8 decoder raises D${D}. I = ${I}, R = ${R}.`,
  ];
  if (D === 7 && T === 3) decode.push(I ? 'D7 and I with T3 form p = D7IT3 (input-output).' : "D7, I' and T3 form r = D7I'T3 (register-reference).");

  // Group active gates by their product term so the text reads "D1T4 → LD(DR), Read, x7".
  const byTerm = new Map<string, string[]>();
  for (const g of active) for (const term of g.terms) byTerm.set(term, [...(byTerm.get(term) ?? []), g.name]);
  const control = byTerm.size
    ? [...byTerm].map(([term, outs]) => `${term} = 1 → ${outs.join(', ')}.`)
    : ['No control gate is 1 in this pulse; only SC counts up.'];
  if (!gates['SC.CLR'].out) control.push('CLR(SC) is 0, so SC will count up.');

  const transfer: string[] = [];
  const c = trace.signals;
  if (trace.busValue !== null) {
    const x = c.busSelect;
    const width = trace.busSource === 'Memory' ? 16 : REG_WIDTH[trace.busSource as RegName];
    transfer.push(
      `x${x} = 1 → the bus encoder sets S2S1S0 = ${toBin(x, 3)}; ${trace.busSource === 'Memory' ? `memory places M[AR] = M[${hex(pre.reg.AR, 12)}]` : `${trace.busSource} places its value`} = ${hex(trace.busValue, width)} on the bus.`,
    );
    const takers = (['AR', 'PC', 'DR', 'IR', 'TR', 'OUTR'] as RegName[]).filter((r) => c.reg[r].ld);
    if (takers.length) transfer.push(`The bus value waits at the inputs of ${takers.join(', ')} (LD = 1).`);
    if (c.memWrite) transfer.push(`Memory Write = 1: the bus value waits to be written at M[${hex(pre.reg.AR, 12)}].`);
  } else {
    transfer.push('S2S1S0 = 000: no source drives the bus.');
  }
  for (const p of trace.acPaths) {
    transfer.push(`Adder and logic circuit (${AC_OP_LABEL[p.op]}) produces ${hex(p.ac, 16)}${p.e !== undefined ? `, E input ${p.e}` : ''} at the inputs of AC.`);
  }
  const incs = (Object.keys(c.reg) as RegName[]).filter((r) => c.reg[r].inr).map((r) => `INR(${r})`);
  const clrs = (Object.keys(c.reg) as RegName[]).filter((r) => c.reg[r].clr).map((r) => `CLR(${r})`);
  if (incs.length || clrs.length) transfer.push(`${[...incs, ...clrs].join(', ')} are ready for the clock edge.`);

  const latch = trace.changes.map((ch) => {
    const w = ch.name in REG_WIDTH ? REG_WIDTH[ch.name as RegName] : 0;
    return w ? `${ch.name} ← ${hex(ch.after, w)} (was ${hex(ch.before, w)})` : `${ch.name} ← ${ch.after}`;
  });
  for (const m of trace.memory) latch.push(`M[${hex(m.address, 12)}] ← ${hex(m.after, 16)}`);
  const latchText = latch.length ? [`On the clock edge, at the same instant: ${latch.join(', ')}.`] : ['The clock edge stores nothing new.'];

  return {
    trace,
    T,
    D,
    gates,
    active,
    steps: [
      { kind: 'decode', title: MICRO_STEP_TITLE.decode, text: decode },
      { kind: 'control', title: MICRO_STEP_TITLE.control, text: control },
      { kind: 'transfer', title: MICRO_STEP_TITLE.transfer, text: transfer },
      { kind: 'latch', title: MICRO_STEP_TITLE.latch, text: latchText },
    ],
  };
}
