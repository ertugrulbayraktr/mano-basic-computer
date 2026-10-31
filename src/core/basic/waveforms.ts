import { toHex } from '../bits';
import { CONTROL_EQUATIONS } from './controlLogic';
import { gatesOf } from './activity';
import { fieldOpcode } from './isa';
import type { PulseTrace } from './pulse';
import type { InstructionRecord } from './simulator';
import { REG_WIDTH, type FlagName, type RegName } from './types';

/**
 * Lanes of the timing diagram (in the spirit of Fig. 5-7). A bit lane is high or low during a
 * pulse; a value lane shows a value (or nothing) for each pulse. Every lane is read from the
 * pulse's trace, so the diagram always agrees with the simulation.
 */
export interface Lane {
  id: string;
  label: string;
  kind: 'bit' | 'value';
  /** Group used by the lane picker. */
  group: string;
  bit?: (t: PulseTrace) => boolean;
  value?: (t: PulseTrace) => string | null;
}

const flagLane = (f: FlagName): Lane => ({ id: `ff:${f}`, label: f, kind: 'bit', group: 'Flip-flops', bit: (t) => t.before.flag[f] === 1 });

const regLane = (r: RegName): Lane => ({
  id: `reg:${r}`,
  label: r,
  kind: 'value',
  group: 'Registers',
  value: (t) => toHex(t.before.reg[r], REG_WIDTH[r]),
});

export const LANES: Lane[] = [
  { id: 'SC', label: 'SC', kind: 'value', group: 'Timing', value: (t) => String(t.before.SC) },
  ...Array.from({ length: 16 }, (_, i): Lane => ({ id: `T${i}`, label: `T${i}`, kind: 'bit', group: 'Timing', bit: (t) => t.before.SC === i })),
  { id: 'D', label: 'D', kind: 'value', group: 'Timing', value: (t) => `D${fieldOpcode(t.before.reg.IR)}` },
  ...(['I', 'R', 'IEN', 'E', 'FGI', 'FGO', 'S'] as FlagName[]).map(flagLane),
  {
    id: 'bus',
    label: 'Bus',
    kind: 'value',
    group: 'Bus and memory',
    value: (t) => (t.busValue === null ? null : `${t.busSource === 'Memory' ? 'M' : t.busSource} ${toHex(t.busValue, 16)}`),
  },
  ...CONTROL_EQUATIONS.map(
    (e): Lane => ({
      id: `pin:${e.id}`,
      label: e.name,
      kind: 'bit',
      group: e.group === 'Bus' || e.group === 'Memory' ? 'Bus and memory' : `Control: ${e.group}`,
      bit: (t) => gatesOf(t)[e.id].out === 1,
    }),
  ),
  ...(['AR', 'PC', 'DR', 'AC', 'IR', 'TR', 'INPR', 'OUTR'] as RegName[]).map(regLane),
];

export const LANE_BY_ID: Record<string, Lane> = Object.fromEntries(LANES.map((l) => [l.id, l]));

/** The lanes shown when nothing else was chosen. */
export const DEFAULT_LANES = ['SC', 'T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'D', 'ff:I', 'ff:R', 'bus', 'pin:MEM.READ', 'pin:MEM.WRITE', 'pin:AR.LD', 'pin:PC.INR', 'pin:DR.LD', 'pin:AC.LD', 'pin:SC.CLR'];

export interface BandSpan {
  /** First and last pulse index (0-based, into the full pulse count) covered by the span. */
  from: number;
  to: number;
  text: string;
  kind: InstructionRecord['kind'];
}

/** Instruction band: one span per instruction or interrupt cycle, from the history. */
export function instructionBand(history: readonly InstructionRecord[], pulses: number): BandSpan[] {
  return history.map((h, i) => ({
    from: h.pulse,
    to: (i + 1 < history.length ? history[i + 1].pulse : pulses) - 1,
    text: h.kind === 'interrupt' ? 'Interrupt' : h.text,
    kind: h.kind,
  }));
}
