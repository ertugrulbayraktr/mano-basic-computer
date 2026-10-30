import type { Bit } from '../bits';
import { fieldOpcode, IOI, MRI, RRI } from './isa';
import type { FlagName, MachineState, RegName } from './types';

/**
 * Inputs of the AC adder-and-logic circuit (Fig. 5-21) that drive AC's LD. If several are
 * enabled at once their outputs are ORed, as the AND-OR gate structure of the circuit does.
 */
export type AcOp = 'AND' | 'ADD' | 'DR' | 'INPR' | 'COM' | 'SHR' | 'SHL';

/** One line of Table 5-6: the control function and the microoperation(s) it enables. */
export interface RtlLine {
  id: string;
  control: string;
  statement: string;
}

export interface RegControl {
  ld: boolean;
  inr: boolean;
  clr: boolean;
}

export type Phase = 'fetch' | 'decode' | 'indirect' | 'execute' | 'interrupt' | 'halted';

/** Everything the control unit (Fig. 5-6) asserts during one clock pulse. */
export interface ControlSignals {
  T: number;
  D: number;
  I: Bit;
  R: Bit;
  phase: Phase;
  lines: RtlLine[];
  /** S2S1S0 (Fig. 5-4). 0 = no source. */
  busSelect: number;
  memRead: boolean;
  memWrite: boolean;
  reg: Record<RegName, RegControl>;
  acOps: AcOp[];
  e: { clr: boolean; com: boolean; load: boolean };
  /** Flip-flops set or cleared directly: S ← 0, R ← 1, IEN ← 0, FGI ← 0, ... */
  setFlags: Partial<Record<FlagName, Bit>>;
  /** I ← IR(15) at T2. */
  loadI: boolean;
  sc: 'inc' | 'clr' | 'hold';
  notices: string[];
}

const noRegControl = (): Record<RegName, RegControl> => ({
  DR: { ld: false, inr: false, clr: false },
  AR: { ld: false, inr: false, clr: false },
  AC: { ld: false, inr: false, clr: false },
  IR: { ld: false, inr: false, clr: false },
  PC: { ld: false, inr: false, clr: false },
  TR: { ld: false, inr: false, clr: false },
  INPR: { ld: false, inr: false, clr: false },
  OUTR: { ld: false, inr: false, clr: false },
});

const MRI_LINES: Record<number, Record<number, string>> = {
  0: { 4: 'DR ← M[AR]', 5: 'AC ← AC ∧ DR, SC ← 0' },
  1: { 4: 'DR ← M[AR]', 5: 'AC ← AC + DR, E ← Cout, SC ← 0' },
  2: { 4: 'DR ← M[AR]', 5: 'AC ← DR, SC ← 0' },
  3: { 4: 'M[AR] ← AC, SC ← 0' },
  4: { 4: 'PC ← AR, SC ← 0' },
  5: { 4: 'M[AR] ← PC, AR ← AR + 1', 5: 'PC ← AR, SC ← 0' },
  6: { 4: 'DR ← M[AR]', 5: 'DR ← DR + 1', 6: 'M[AR] ← DR, if (DR = 0) then (PC ← PC + 1), SC ← 0' },
};

const RRI_STATEMENT: Record<string, string> = {
  CLA: 'AC ← 0',
  CLE: 'E ← 0',
  CMA: "AC ← AC'",
  CME: "E ← E'",
  CIR: 'AC ← shr AC, AC(15) ← E, E ← AC(0)',
  CIL: 'AC ← shl AC, AC(0) ← E, E ← AC(15)',
  INC: 'AC ← AC + 1',
  SPA: 'if (AC(15) = 0) then (PC ← PC + 1)',
  SNA: 'if (AC(15) = 1) then (PC ← PC + 1)',
  SZA: 'if (AC = 0) then (PC ← PC + 1)',
  SZE: 'if (E = 0) then (PC ← PC + 1)',
  HLT: 'S ← 0',
};

const IOI_STATEMENT: Record<string, string> = {
  INP: 'AC(0-7) ← INPR, FGI ← 0',
  OUT: 'OUTR ← AC(0-7), FGO ← 0',
  SKI: 'if (FGI = 1) then (PC ← PC + 1)',
  SKO: 'if (FGO = 1) then (PC ← PC + 1)',
  ION: 'IEN ← 1',
  IOF: 'IEN ← 0',
};

/**
 * Control unit: derives every control signal of one clock pulse from the state *before* the
 * pulse, exactly as listed in Table 5-6. Nothing is changed here; see `pulse.ts`.
 */
export function controlSignals(s: MachineState): ControlSignals {
  const T = s.SC;
  const IR = s.reg.IR;
  const D = fieldOpcode(IR);
  const { I, R } = s.flag;
  const c: ControlSignals = {
    T,
    D,
    I,
    R,
    phase: 'execute',
    lines: [],
    busSelect: 0,
    memRead: false,
    memWrite: false,
    reg: noRegControl(),
    acOps: [],
    e: { clr: false, com: false, load: false },
    setFlags: {},
    loadI: false,
    sc: 'inc',
    notices: [],
  };
  const line = (id: string, control: string, statement: string) =>
    c.lines.push({ id, control, statement });
  const busFromMemory = () => {
    c.busSelect = 7;
    c.memRead = true;
  };

  if (!s.flag.S) {
    c.phase = 'halted';
    c.sc = 'hold';
    return c;
  }

  if (R) {
    // Interrupt cycle (Fig. 5-13).
    c.phase = 'interrupt';
    if (T === 0) {
      line('int-T0', 'RT0', 'AR ← 0, TR ← PC');
      c.reg.AR.clr = true;
      c.busSelect = 2;
      c.reg.TR.ld = true;
    } else if (T === 1) {
      line('int-T1', 'RT1', 'M[AR] ← TR, PC ← 0');
      c.busSelect = 6;
      c.memWrite = true;
      c.reg.PC.clr = true;
    } else if (T === 2) {
      line('int-T2', 'RT2', 'PC ← PC + 1, IEN ← 0, R ← 0, SC ← 0');
      c.reg.PC.inr = true;
      c.setFlags.IEN = 0;
      c.setFlags.R = 0;
      c.sc = 'clr';
    }
  } else if (T === 0) {
    c.phase = 'fetch';
    line('fetch-T0', "R'T0", 'AR ← PC');
    c.busSelect = 2;
    c.reg.AR.ld = true;
  } else if (T === 1) {
    c.phase = 'fetch';
    line('fetch-T1', "R'T1", 'IR ← M[AR], PC ← PC + 1');
    busFromMemory();
    c.reg.IR.ld = true;
    c.reg.PC.inr = true;
  } else if (T === 2) {
    c.phase = 'decode';
    line('decode-T2', "R'T2", 'D0, …, D7 ← Decode IR(12-14), AR ← IR(0-11), I ← IR(15)');
    c.busSelect = 5;
    c.reg.AR.ld = true;
    c.loadI = true;
  } else if (T === 3 && D !== 7) {
    c.phase = 'indirect';
    if (I) {
      line('indirect', "D7'IT3", 'AR ← M[AR]');
      busFromMemory();
      c.reg.AR.ld = true;
    } else {
      line('direct', "D7'I'T3", 'Nothing');
    }
  } else if (T === 3 && D === 7 && !I) {
    registerReference(IR, s, c, line);
  } else if (T === 3 && D === 7 && I) {
    inputOutput(IR, s, c, line);
  } else if (D !== 7 && MRI_LINES[D][T]) {
    memoryReference(D, T, s, c, line, busFromMemory);
  }

  // Interrupt request: T0'T1'T2'(IEN)(FGI + FGO): R ← 1 (Fig. 5-13). It is evaluated on every
  // pulse outside the fetch/decode timing, in parallel with that pulse's microoperations.
  if (!R && T > 2 && s.flag.IEN && (s.flag.FGI || s.flag.FGO)) {
    line('int-request', "T0'T1'T2'(IEN)(FGI + FGO)", 'R ← 1');
    c.setFlags.R = 1;
  }

  if (c.lines.length === 0) {
    c.notices.push(`No microoperation is enabled at T${T}; SC keeps counting.`);
  }
  return c;
}

type LineFn = (id: string, control: string, statement: string) => void;

function memoryReference(
  D: number,
  T: number,
  s: MachineState,
  c: ControlSignals,
  line: LineFn,
  busFromMemory: () => void,
) {
  const m = MRI[D];
  line(`${m}-T${T}`, `D${D}T${T}`, MRI_LINES[D][T]);
  const r = c.reg;
  switch (`${m}-${T}`) {
    case 'AND-4':
    case 'ADD-4':
    case 'LDA-4':
    case 'ISZ-4':
      busFromMemory();
      r.DR.ld = true;
      break;
    case 'AND-5':
      r.AC.ld = true;
      c.acOps.push('AND');
      c.sc = 'clr';
      break;
    case 'ADD-5':
      r.AC.ld = true;
      c.acOps.push('ADD');
      c.e.load = true;
      c.sc = 'clr';
      break;
    case 'LDA-5':
      r.AC.ld = true;
      c.acOps.push('DR');
      c.sc = 'clr';
      break;
    case 'STA-4':
      c.busSelect = 4;
      c.memWrite = true;
      c.sc = 'clr';
      break;
    case 'BUN-4':
      c.busSelect = 1;
      r.PC.ld = true;
      c.sc = 'clr';
      break;
    case 'BSA-4':
      c.busSelect = 2;
      c.memWrite = true;
      r.AR.inr = true;
      break;
    case 'BSA-5':
      c.busSelect = 1;
      r.PC.ld = true;
      c.sc = 'clr';
      break;
    case 'ISZ-5':
      r.DR.inr = true;
      break;
    case 'ISZ-6':
      c.busSelect = 3;
      c.memWrite = true;
      if (s.reg.DR === 0) r.PC.inr = true;
      c.sc = 'clr';
      break;
  }
}

function registerReference(IR: number, s: MachineState, c: ControlSignals, line: LineFn) {
  line('r', "D7I'T3 = r", 'SC ← 0');
  c.sc = 'clr';
  const ops = RRI.filter((op) => (IR >> op.bit) & 1);
  const { AC } = s.reg;
  const r = c.reg;
  for (const op of ops) {
    line(op.mnemonic, `rB${op.bit}`, RRI_STATEMENT[op.mnemonic]);
    switch (op.mnemonic) {
      case 'CLA':
        r.AC.clr = true;
        break;
      case 'CLE':
        c.e.clr = true;
        break;
      case 'CMA':
        r.AC.ld = true;
        c.acOps.push('COM');
        break;
      case 'CME':
        c.e.com = true;
        break;
      case 'CIR':
        r.AC.ld = true;
        c.acOps.push('SHR');
        c.e.load = true;
        break;
      case 'CIL':
        r.AC.ld = true;
        c.acOps.push('SHL');
        c.e.load = true;
        break;
      case 'INC':
        r.AC.inr = true;
        break;
      case 'SPA':
        if (!(AC >> 15)) r.PC.inr = true;
        break;
      case 'SNA':
        if (AC >> 15) r.PC.inr = true;
        break;
      case 'SZA':
        if (AC === 0) r.PC.inr = true;
        break;
      case 'SZE':
        if (!s.flag.E) r.PC.inr = true;
        break;
      case 'HLT':
        c.setFlags.S = 0;
        break;
    }
  }
  multiOpNotice(ops.map((o) => o.mnemonic), 'register-reference', c);
}

function inputOutput(IR: number, s: MachineState, c: ControlSignals, line: LineFn) {
  line('p', 'D7IT3 = p', 'SC ← 0');
  c.sc = 'clr';
  const ops = IOI.filter((op) => (IR >> op.bit) & 1);
  const r = c.reg;
  for (const op of ops) {
    line(op.mnemonic, `pB${op.bit}`, IOI_STATEMENT[op.mnemonic]);
    switch (op.mnemonic) {
      case 'INP':
        r.AC.ld = true;
        c.acOps.push('INPR');
        c.setFlags.FGI = 0;
        break;
      case 'OUT':
        c.busSelect = 4;
        r.OUTR.ld = true;
        c.setFlags.FGO = 0;
        break;
      case 'SKI':
        if (s.flag.FGI) r.PC.inr = true;
        break;
      case 'SKO':
        if (s.flag.FGO) r.PC.inr = true;
        break;
      case 'ION':
        c.setFlags.IEN = 1;
        break;
      case 'IOF':
        c.setFlags.IEN = 0;
        break;
    }
  }
  if (ops.some((o) => o.mnemonic === 'ION') && ops.some((o) => o.mnemonic === 'IOF')) {
    c.notices.push('ION and IOF are both selected; IEN ← 0 wins in this simulator.');
  }
  multiOpNotice(ops.map((o) => o.mnemonic), 'input-output', c);
}

function multiOpNotice(mnemonics: string[], kind: string, c: ControlSignals) {
  if (mnemonics.length > 1) {
    c.notices.push(
      `This ${kind} word has ${mnemonics.length} operation bits set (${mnemonics.join(', ')}). ` +
        'The hardware enables all of them in the same T3 pulse.',
    );
  }
  if (mnemonics.length === 0) {
    c.notices.push(`This ${kind} word selects no operation; only SC ← 0 happens.`);
  }
}
