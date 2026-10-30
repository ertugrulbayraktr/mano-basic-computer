import { trunc, type Bit } from '../bits';
import { disassemble } from './disasm';
import { pulse, type PulseTrace } from './pulse';
import {
  initialState,
  MEMORY_WORDS,
  REG_WIDTH,
  type FlagName,
  type MachineState,
  type RegName,
} from './types';

export interface InstructionRecord {
  kind: 'instruction' | 'interrupt';
  /** Address the instruction was fetched from (for an interrupt: the PC that was saved). */
  address: number;
  word: number;
  text: string;
  /** Pulse number at which this instruction's first pulse (T0) ran. */
  pulse: number;
}

export interface DeviceState {
  /** Pulses left until the printer finishes and sets FGO; 0 when idle. */
  printerBusy: number;
  /** Everything the printer has printed. */
  printed: string;
}

interface UndoEntry {
  reg: MachineState['reg'];
  flag: MachineState['flag'];
  SC: number;
  mem: [address: number, before: number][];
  devices: DeviceState;
  lastTrace: PulseTrace | null;
  pulses: number;
  historyLength: number;
}

export type StopReason = 'halted' | 'breakpoint' | 'limit';

export interface SimulatorOptions {
  /** Pulses after an OUT until the printer sets FGO back to 1. */
  printerDelay?: number;
  /** Maximum number of undo steps kept. */
  undoLimit?: number;
}

/**
 * Stateful wrapper around `pulse()` that adds what a user of the simulator needs: undo of every
 * step, instruction history, breakpoints, direct edits, and the keyboard and printer devices.
 */
export class Simulator {
  state: MachineState = initialState();
  devices: DeviceState = { printerBusy: 0, printed: '' };
  breakpoints = new Set<number>();
  history: InstructionRecord[] = [];
  lastTrace: PulseTrace | null = null;
  pulses = 0;
  printerDelay: number;
  private undoStack: UndoEntry[] = [];
  private readonly undoLimit: number;

  constructor(opts: SimulatorOptions = {}) {
    this.printerDelay = Math.max(1, opts.printerDelay ?? 20);
    this.undoLimit = opts.undoLimit ?? 200_000;
  }

  get canStepBack(): boolean {
    return this.undoStack.length > 0;
  }

  get halted(): boolean {
    return !this.state.flag.S;
  }

  /** Clears registers, flip-flops, devices and history. Memory is kept unless asked otherwise. */
  reset(clearMemory = false): void {
    const mem = clearMemory ? new Uint16Array(MEMORY_WORDS) : this.state.mem;
    this.state = { ...initialState(), mem };
    this.devices = { printerBusy: 0, printed: '' };
    this.history = [];
    this.lastTrace = null;
    this.pulses = 0;
    this.undoStack = [];
  }

  /** Loads words into memory and sets PC. Clears the undo history (a new program starts). */
  load(words: Iterable<readonly [address: number, value: number]>, pc: number): void {
    this.reset(true);
    for (const [a, v] of words) this.state.mem[a & 0xfff] = v & 0xffff;
    this.state.reg.PC = pc & 0xfff;
  }

  /** Executes one clock pulse. Does nothing while S = 0. */
  step(): PulseTrace {
    const before = this.state;
    if (!before.flag.S) {
      const { trace } = pulse(before);
      this.lastTrace = trace;
      return trace;
    }
    const entry = this.snapshot();

    if (before.SC === 0) this.recordInstructionStart(before);

    const { next, trace } = pulse(before);
    this.state = next;
    entry.mem = trace.memory.map((m) => [m.address, m.before]);
    this.tickDevices(trace);

    this.pushUndo(entry);
    this.pulses++;
    this.lastTrace = trace;
    return trace;
  }

  /** Executes pulses until the current instruction (or interrupt cycle) completes. */
  stepInstruction(): PulseTrace[] {
    const traces: PulseTrace[] = [];
    do {
      traces.push(this.step());
    } while (!this.halted && this.state.SC !== 0 && traces.length < 16);
    return traces;
  }

  /**
   * Runs until HLT, a breakpoint or the pulse limit. A breakpoint stops the run just before the
   * instruction at that address is fetched; the instruction under the cursor never re-triggers it.
   */
  run(maxPulses = 1_000_000): StopReason {
    for (let i = 0; i < maxPulses; i++) {
      if (this.halted) return 'halted';
      if (i > 0 && this.atBreakpoint()) return 'breakpoint';
      this.step();
    }
    return this.halted ? 'halted' : 'limit';
  }

  /** True when the next pulse is the T0 fetch of an instruction at a breakpoint address. */
  atBreakpoint(): boolean {
    const s = this.state;
    return s.SC === 0 && !s.flag.R && this.breakpoints.has(s.reg.PC);
  }

  /** Undoes the last pulse or edit. */
  stepBack(): boolean {
    const e = this.undoStack.pop();
    if (!e) return false;
    const mem = this.state.mem.slice();
    for (let i = e.mem.length - 1; i >= 0; i--) mem[e.mem[i][0]] = e.mem[i][1];
    this.state = { reg: e.reg, flag: e.flag, SC: e.SC, mem };
    this.devices = e.devices;
    this.lastTrace = e.lastTrace;
    this.pulses = e.pulses;
    this.history.length = e.historyLength;
    return true;
  }

  // ---- direct edits (each one can be undone) ----

  setRegister(r: RegName, value: number): void {
    this.edit(() => (this.state.reg[r] = trunc(value, REG_WIDTH[r])));
  }

  setFlag(f: FlagName, value: Bit): void {
    this.edit(() => (this.state.flag[f] = value));
  }

  setSC(value: number): void {
    this.edit(() => (this.state.SC = trunc(value, 4)));
  }

  setMemory(address: number, value: number): void {
    const a = address & 0xfff;
    this.edit((entry) => {
      entry.mem.push([a, this.state.mem[a]]);
      this.state.mem[a] = value & 0xffff;
    });
  }

  // ---- devices ----

  /**
   * Keyboard: puts the 8-bit code of the character into INPR and sets FGI, but only when
   * FGI = 0 (the previous character has been taken). Returns false if the key was rejected.
   */
  pressKey(char: string): boolean {
    if (this.state.flag.FGI) return false;
    const code = char.charCodeAt(0) & 0xff;
    this.edit(() => {
      this.state.reg.INPR = code;
      this.state.flag.FGI = 1;
    });
    return true;
  }

  private tickDevices(trace: PulseTrace): void {
    if (trace.signals.reg.OUTR.ld) {
      this.devices = {
        printed: this.devices.printed + String.fromCharCode(this.state.reg.OUTR),
        printerBusy: this.printerDelay,
      };
      return;
    }
    if (this.devices.printerBusy > 0) {
      const printerBusy = this.devices.printerBusy - 1;
      this.devices = { ...this.devices, printerBusy };
      if (printerBusy === 0 && !this.state.flag.FGO) {
        this.state.flag.FGO = 1;
        trace.changes.push({ name: 'FGO', before: 0, after: 1 });
        trace.notices.push('The printer finished the character and set FGO = 1.');
      }
    }
  }

  private recordInstructionStart(s: MachineState): void {
    if (s.flag.R) {
      this.history.push({ kind: 'interrupt', address: s.reg.PC, word: 0, text: 'Interrupt cycle', pulse: this.pulses });
    } else {
      const word = s.mem[s.reg.PC];
      this.history.push({
        kind: 'instruction',
        address: s.reg.PC,
        word,
        text: disassemble(word).text,
        pulse: this.pulses,
      });
    }
  }

  private snapshot(): UndoEntry {
    return {
      reg: { ...this.state.reg },
      flag: { ...this.state.flag },
      SC: this.state.SC,
      mem: [],
      devices: this.devices,
      lastTrace: this.lastTrace,
      pulses: this.pulses,
      historyLength: this.history.length,
    };
  }

  private edit(apply: (entry: UndoEntry) => void): void {
    const entry = this.snapshot();
    this.state = { ...this.state, reg: { ...this.state.reg }, flag: { ...this.state.flag } };
    apply(entry);
    this.pushUndo(entry);
  }

  private pushUndo(e: UndoEntry): void {
    this.undoStack.push(e);
    if (this.undoStack.length > this.undoLimit) this.undoStack.shift();
  }
}
