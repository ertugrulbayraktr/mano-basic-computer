import { trunc, type Bit } from '../bits';
import { clockRegister } from '../blocks/sequential';
import { adderLogicPath, type AcPathResult } from './adderLogic';
import { controlSignals, type ControlSignals } from './control';
import {
  BUS_SOURCES,
  FLAGS,
  REG_WIDTH,
  REGISTERS,
  type BusSource,
  type FlagName,
  type MachineState,
  type RegName,
} from './types';

export interface Change {
  name: RegName | FlagName | 'SC';
  before: number;
  after: number;
}

export interface MemoryChange {
  address: number;
  before: number;
  after: number;
}

/** Everything that happened during one clock pulse, for display and for undo. */
export interface PulseTrace {
  /** Registers, flip-flops and SC before the clock edge (memory is not copied). */
  before: Pick<MachineState, 'reg' | 'flag' | 'SC'>;
  signals: ControlSignals;
  busSource: BusSource;
  /** Value on the 16-bit bus, or null when no source is selected. */
  busValue: number | null;
  /** Outputs of the adder-and-logic circuit paths that were enabled. */
  acPaths: AcPathResult[];
  changes: Change[];
  memory: MemoryChange[];
  notices: string[];
}

/** Value placed on the common bus for a select value (Fig. 5-4). 12-bit sources are zero-extended. */
export function busValue(s: MachineState, select: number): number | null {
  switch (BUS_SOURCES[select]) {
    case 'none':
      return null;
    case 'Memory':
      return s.mem[s.reg.AR];
    default:
      return s.reg[BUS_SOURCES[select] as RegName];
  }
}

/**
 * Executes one clock pulse. All microoperations enabled by the control unit take place
 * simultaneously on the clock edge, using the values from before the pulse.
 * The input state is not modified.
 */
export function pulse(s: MachineState): { next: MachineState; trace: PulseTrace } {
  const c = controlSignals(s);
  const notices = [...c.notices];
  const bus = busValue(s, c.busSelect);
  const next: MachineState = { reg: { ...s.reg }, flag: { ...s.flag }, SC: s.SC, mem: s.mem };
  const memory: MemoryChange[] = [];

  if (c.phase !== 'halted') {
    // Memory write: the address always comes from AR (before the pulse), data from the bus.
    if (c.memWrite && bus !== null) {
      const address = s.reg.AR;
      next.mem = s.mem.slice();
      next.mem[address] = bus;
      memory.push({ address, before: s.mem[address], after: bus });
    }

    // AC's LD input is driven by the adder-and-logic circuit (Fig. 5-21).
    const acPaths = c.acOps.map((op) => adderLogicPath(op, s.reg.AC, s.reg.DR, s.reg.INPR, s.flag.E));
    const acInput = acPaths.reduce((acc, p) => acc | p.ac, 0);
    if (acPaths.length > 1) {
      notices.push(
        `Several inputs of the AC logic circuit are enabled (${c.acOps.join(', ')}); ` +
          'their outputs are ORed into AC.',
      );
    }

    for (const r of REGISTERS) {
      const ctl = c.reg[r];
      if ([ctl.clr, ctl.ld, ctl.inr].filter(Boolean).length > 1) {
        notices.push(`${r} receives more than one of CLR, LD, INR; priority is CLR, LD, INR (Table 2-4).`);
      }
      const input = r === 'AC' ? acInput : (bus ?? 0);
      next.reg[r] = clockRegister(s.reg[r], REG_WIDTH[r], ctl, input);
    }

    // E flip-flop: cleared, complemented or loaded from the circuit (carry or circulated bit).
    const eSources = acPaths.filter((p) => p.e !== undefined).map((p) => p.e as Bit);
    const eActions = [c.e.clr, c.e.com, c.e.load].filter(Boolean).length;
    if (eActions > 1) notices.push('E receives more than one operation; priority is clear, load, complement.');
    if (c.e.clr) next.flag.E = 0;
    else if (c.e.load) next.flag.E = eSources.reduce<number>((a, b) => a | b, 0) as Bit;
    else if (c.e.com) next.flag.E = (s.flag.E ^ 1) as Bit;

    if (c.loadI) next.flag.I = ((s.reg.IR >>> 15) & 1) as Bit;
    for (const [f, v] of Object.entries(c.setFlags)) next.flag[f as FlagName] = v as Bit;

    next.SC = c.sc === 'clr' ? 0 : trunc(s.SC + 1, 4);

    return {
      next,
      trace: {
        before: { reg: s.reg, flag: s.flag, SC: s.SC },
        signals: c,
        busSource: BUS_SOURCES[c.busSelect],
        busValue: bus,
        acPaths,
        changes: diff(s, next),
        memory,
        notices,
      },
    };
  }

  notices.push('S = 0: the computer is halted and the clock does not advance.');
  return {
    next,
    trace: { before: { reg: s.reg, flag: s.flag, SC: s.SC }, signals: c, busSource: 'none', busValue: null, acPaths: [], changes: [], memory, notices },
  };
}

function diff(a: MachineState, b: MachineState): Change[] {
  const changes: Change[] = [];
  for (const r of REGISTERS)
    if (a.reg[r] !== b.reg[r]) changes.push({ name: r, before: a.reg[r], after: b.reg[r] });
  for (const f of FLAGS)
    if (a.flag[f] !== b.flag[f]) changes.push({ name: f, before: a.flag[f], after: b.flag[f] });
  if (a.SC !== b.SC) changes.push({ name: 'SC', before: a.SC, after: b.SC });
  return changes;
}
