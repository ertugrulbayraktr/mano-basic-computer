import { create } from 'zustand';
import type { Bit } from '../../../core/bits';
import { Simulator } from '../../../core/basic/simulator';
import type { FlagName, RegName } from '../../../core/basic/types';
import { SPEEDS, useSettings } from '../../settings';

/** What is currently loaded, so Reset can restore it. */
export interface LoadedProgram {
  id: string;
  title: string;
  mem: [number, number][];
  reg?: Partial<Record<RegName, number>>;
  flag?: Partial<Record<FlagName, Bit>>;
  expect?: string;
}

interface ComputerStore {
  sim: Simulator;
  /** Bumped after every change so components re-render. */
  version: number;
  running: boolean;
  status: string | null;
  program: LoadedProgram | null;
  pulse: () => void;
  instruction: () => void;
  back: () => void;
  reset: () => void;
  clearAll: () => void;
  run: () => void;
  pause: () => void;
  load: (p: LoadedProgram) => void;
  setRegister: (r: RegName, v: number) => void;
  setFlag: (f: FlagName, v: Bit) => void;
  setMemory: (a: number, v: number) => void;
  setSC: (v: number) => void;
  toggleBreakpoint: (a: number) => void;
  pressKey: (c: string) => boolean;
}

const sim = new Simulator({ printerDelay: useSettings.getState().printerDelay });
useSettings.subscribe((s) => (sim.printerDelay = s.printerDelay));

let frame = 0;

export const useComputer = create<ComputerStore>((set, get) => {
  const bump = (status: string | null = null) => set((s) => ({ version: s.version + 1, status }));
  const haltedStatus = () => (sim.halted ? 'Halted (S = 0).' : null);

  const stopLoop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const loop = () => {
    let budget = 0;
    let last = performance.now();
    let first = true;
    const tick = (now: number) => {
      const speed = SPEEDS[useSettings.getState().speedIndex];
      budget += speed === Infinity ? 20_000 : ((now - last) / 1000) * speed;
      last = now;
      let n = Math.min(Math.floor(budget), 20_000);
      budget -= n;
      while (n-- > 0) {
        if (sim.halted) {
          set({ running: false });
          return bump('Halted (S = 0).');
        }
        if (!first && sim.atBreakpoint()) {
          set({ running: false });
          return bump(`Breakpoint at ${sim.state.reg.PC.toString(16).toUpperCase().padStart(3, '0')}.`);
        }
        first = false;
        sim.step();
      }
      bump();
      frame = requestAnimationFrame(tick);
    };
    // The first pulse happens immediately so Run always responds.
    budget = 1;
    frame = requestAnimationFrame(tick);
  };

  const loadInto = (p: LoadedProgram) => {
    sim.load(p.mem, p.reg?.PC ?? 0);
    Object.assign(sim.state.reg, p.reg);
    Object.assign(sim.state.flag, p.flag);
  };

  return {
    sim,
    version: 0,
    running: false,
    status: null,
    program: null,
    pulse: () => {
      get().pause();
      sim.step();
      bump(haltedStatus());
    },
    instruction: () => {
      get().pause();
      sim.stepInstruction();
      bump(haltedStatus());
    },
    back: () => {
      get().pause();
      sim.stepBack();
      bump();
    },
    reset: () => {
      get().pause();
      const p = get().program;
      const bps = new Set(sim.breakpoints);
      if (p) loadInto(p);
      else sim.reset();
      sim.breakpoints = bps;
      bump('Reset.');
    },
    clearAll: () => {
      get().pause();
      sim.reset(true);
      sim.breakpoints.clear();
      set({ program: null });
      bump('Memory and registers cleared.');
    },
    run: () => {
      if (get().running) return;
      if (sim.halted) sim.setFlag('S', 1);
      set({ running: true });
      bump('Running…');
      loop();
    },
    pause: () => {
      if (!get().running) return;
      stopLoop();
      set({ running: false });
      bump('Paused.');
    },
    load: (p) => {
      get().pause();
      loadInto(p);
      sim.breakpoints.clear();
      set({ program: p });
      bump(`Loaded ${p.title}.`);
    },
    setRegister: (r, v) => {
      sim.setRegister(r, v);
      bump();
    },
    setFlag: (f, v) => {
      sim.setFlag(f, v);
      bump();
    },
    setMemory: (a, v) => {
      sim.setMemory(a, v);
      bump();
    },
    setSC: (v) => {
      sim.setSC(v);
      bump();
    },
    toggleBreakpoint: (a) => {
      if (sim.breakpoints.has(a)) sim.breakpoints.delete(a);
      else sim.breakpoints.add(a);
      bump();
    },
    pressKey: (c) => {
      const ok = sim.pressKey(c);
      bump(ok ? null : 'Key ignored: FGI = 1, the previous character has not been read yet.');
      return ok;
    },
  };
});

/** Subscribes a component to simulator changes and returns the simulator. */
export function useSim(): Simulator {
  useComputer((s) => s.version);
  return sim;
}
