import { evaluateControl, termLabel, type EquationValue } from './controlLogic';
import type { RtlLine } from './control';
import { fieldOpcode } from './isa';
import { pulse, type PulseTrace } from './pulse';
import { REGISTERS, type MachineState } from './types';

/**
 * Which parts of the circuit a pulse uses, as element ids shared by the drawing:
 * - `T4`, `D1`: decoder output lines; `ff:I`, `ff:R`, …: flip-flop lines into the control logic
 * - `gate:D1T4`: an AND term that is 1; `pin:DR.LD`: a control output that is 1
 * - `bus`, `src:Memory`, `dst:DR`: the bus, its source and the registers that load from it
 * - `mem:read`, `mem:write`: memory accesses (address from AR)
 * - `alu:ADD`: an input of the adder-and-logic circuit; `reg:AC`: a register that changed
 */

const gateCache = new WeakMap<PulseTrace, Record<string, EquationValue>>();

/** Control gates of a pulse, evaluated on its pre-pulse state (cached per trace). */
export function gatesOf(t: PulseTrace): Record<string, EquationValue> {
  let g = gateCache.get(t);
  if (!g) {
    g = evaluateControl({ ...t.before, mem: new Uint16Array(0) });
    gateCache.set(t, g);
  }
  return g;
}

export function activeElements(t: PulseTrace): Set<string> {
  const out = new Set<string>();
  if (t.signals.phase === 'halted') return out;
  const b = t.before;
  out.add(`T${b.SC}`);
  out.add(`D${fieldOpcode(b.reg.IR)}`);
  for (const f of ['I', 'R', 'IEN', 'FGI', 'FGO', 'S'] as const) if (b.flag[f]) out.add(`ff:${f}`);
  for (const g of Object.values(gatesOf(t))) {
    if (!g.out) continue;
    out.add(`pin:${g.equation.id}`);
    g.equation.terms.forEach((term, i) => g.terms[i] && out.add(`gate:${termLabel(term)}`));
  }
  const c = t.signals;
  if (t.busSource !== 'none') {
    out.add('bus');
    out.add(`src:${t.busSource}`);
    for (const r of REGISTERS) if (c.reg[r].ld && r !== 'AC') out.add(`dst:${r}`);
    if (c.memWrite) out.add('dst:Memory');
  }
  if (c.memRead) out.add('mem:read');
  if (c.memWrite) out.add('mem:write');
  for (const p of t.acPaths) out.add(`alu:${p.op}`);
  for (const ch of t.changes) out.add(`reg:${ch.name}`);
  if (t.memory.length) out.add('reg:Memory');
  return out;
}

export interface Xray {
  /** Every element the instruction uses over all its pulses. */
  elements: Set<string>;
  /** The Table 5-6 lines of each pulse, in order. */
  pulses: RtlLine[][];
}

/**
 * What the instruction at `address` would do if it were fetched now: its pulses are simulated on
 * a copy of the machine (from T0, no interrupt), and the parts of the circuit they use are
 * collected. The real machine is not changed.
 */
export function instructionXray(s: MachineState, address: number): Xray {
  let st: MachineState = {
    reg: { ...s.reg, PC: address & 0xfff },
    flag: { ...s.flag, R: 0, S: 1 },
    SC: 0,
    mem: s.mem.slice(),
  };
  const elements = new Set<string>();
  const pulses: RtlLine[][] = [];
  for (let i = 0; i < 8; i++) {
    const { next, trace } = pulse(st);
    for (const e of activeElements(trace)) elements.add(e);
    pulses.push(trace.signals.lines);
    st = next;
    if (st.SC === 0 || !st.flag.S) break;
  }
  return { elements, pulses };
}

/** How many pulses of the timeline used each element. */
export function usage(timeline: readonly PulseTrace[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of timeline) for (const e of activeElements(t)) counts.set(e, (counts.get(e) ?? 0) + 1);
  return counts;
}
