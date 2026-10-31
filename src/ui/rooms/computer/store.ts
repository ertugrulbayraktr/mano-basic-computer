import { create } from 'zustand';
import type { Bit } from '../../../core/bits';
import { Simulator } from '../../../core/basic/simulator';
import { msg, type Msg } from '../../../core/i18n';
import type { FlagName, RegName } from '../../../core/basic/types';
import { SPEEDS, useSettings } from '../../settings';

/** What is currently loaded, so Reset can restore it. */
export interface LoadedProgram {
  id: string;
  title: string;
  titleTr?: string;
  mem: [number, number][];
  reg?: Partial<Record<RegName, number>>;
  flag?: Partial<Record<FlagName, Bit>>;
  expect?: string;
  expectTr?: string;
}

interface ComputerStore {
  sim: Simulator;
  /** Bumped after every change so components re-render. */
  version: number;
  running: boolean;
  status: Msg | null;
  program: LoadedProgram | null;
  /**
   * Which sub-step of the last pulse is shown: 0 decode, 1 control gates, 2 data flow,
   * 3 clock edge (the pulse is complete). See core/basic/microsteps.ts.
   */
  sub: number;
  /** Camera follows each sub-step. */
  follow: boolean;
  /** Shade circuit elements by how often the program used them. */
  usage: boolean;
  /** Address whose instruction is x-rayed on the circuit, or null. */
  xray: number | null;
  setView: (v: Partial<Pick<ComputerStore, 'follow' | 'usage' | 'xray'>>) => void;
  /** Move to just after pulse `pulse` (0 = start), showing sub-step `sub`. */
  seek: (pulse: number, sub?: number) => void;
  subNext: () => void;
  subPrev: () => void;
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

/** Up to this many pulses per second, Run shows every sub-step of every pulse. */
export const SUBSTEP_SPEED = 4;

export const useComputer = create<ComputerStore>((set, get) => {
  const bump = (status: Msg | null = null, sub = 3) => set((s) => ({ version: s.version + 1, status, sub }));
  const HALTED = msg('Halted (S = 0).', 'Durdu (S = 0).');
  const haltedStatus = () => (sim.halted ? HALTED : null);
  const breakpointMsg = () => {
    const a = sim.state.reg.PC.toString(16).toUpperCase().padStart(3, '0');
    return msg(`Breakpoint at ${a}.`, `${a} adresinde kesme noktası.`);
  };

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
      // At low speeds every sub-step is shown, four per pulse.
      if (speed <= SUBSTEP_SPEED) {
        budget += ((now - last) / 1000) * speed * 4;
        last = now;
        let k = Math.floor(budget);
        budget -= k;
        while (k-- > 0) {
          if (get().sub === 3) {
            if (sim.halted) {
              set({ running: false });
              return bump(HALTED);
            }
            if (!first && sim.atBreakpoint()) {
              set({ running: false });
              return bump(breakpointMsg());
            }
            first = false;
            sim.step();
            bump(null, 0);
          } else bump(null, get().sub + 1);
        }
        frame = requestAnimationFrame(tick);
        return;
      }
      budget += speed === Infinity ? 20_000 : ((now - last) / 1000) * speed;
      last = now;
      let n = Math.min(Math.floor(budget), 20_000);
      budget -= n;
      while (n-- > 0) {
        if (sim.halted) {
          set({ running: false });
          return bump(HALTED);
        }
        if (!first && sim.atBreakpoint()) {
          set({ running: false });
          return bump(breakpointMsg());
        }
        first = false;
        sim.step();
      }
      bump();
      frame = requestAnimationFrame(tick);
    };
    // The first step happens immediately so Run always responds.
    budget = 1;
    frame = requestAnimationFrame(tick);
  };

  /** The next pulse: brought back by redo when the future is known, else simulated. */
  const advance = () => {
    while (sim.canRedo) {
      const before = sim.pulses;
      sim.redo();
      if (sim.pulses !== before) return;
    }
    sim.step();
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
    sub: 3,
    follow: false,
    usage: false,
    xray: null,
    setView: (v) => set(v),
    seek: (pulse, sub = 3) => {
      get().pause();
      sim.seek(pulse);
      bump(null, sim.lastTrace ? sub : 3);
    },
    subNext: () => {
      get().pause();
      if (sim.lastTrace && get().sub < 3) return bump(null, get().sub + 1);
      if (sim.halted && !sim.canRedo) return bump(haltedStatus());
      advance();
      bump(null, 0);
    },
    subPrev: () => {
      get().pause();
      if (sim.lastTrace && get().sub > 0) return bump(null, get().sub - 1);
      sim.stepBack();
      bump(null, 3);
    },
    pulse: () => {
      get().pause();
      // Finish a pulse that is being shown sub-step by sub-step before starting a new one.
      if (sim.lastTrace && get().sub < 3) return bump();
      advance();
      bump(haltedStatus());
    },
    instruction: () => {
      get().pause();
      if (!(sim.lastTrace && get().sub < 3 && sim.state.SC === 0)) {
        let n = 0;
        do {
          advance();
        } while (!sim.halted && sim.state.SC !== 0 && ++n < 16);
      }
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
      bump(msg('Reset.', 'Sıfırlandı.'));
    },
    clearAll: () => {
      get().pause();
      sim.reset(true);
      sim.breakpoints.clear();
      set({ program: null });
      bump(msg('Memory and registers cleared.', 'Bellek ve yazmaçlar temizlendi.'));
    },
    run: () => {
      if (get().running) return;
      if (sim.halted) sim.setFlag('S', 1);
      set({ running: true });
      bump(msg('Running…', 'Çalışıyor…'));
      loop();
    },
    pause: () => {
      if (!get().running) return;
      stopLoop();
      set({ running: false });
      bump(msg('Paused.', 'Duraklatıldı.'));
    },
    load: (p) => {
      get().pause();
      loadInto(p);
      sim.breakpoints.clear();
      set({ program: p });
      bump(msg(`Loaded ${p.title}.`, `${p.titleTr ?? p.title} yüklendi.`));
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
      bump(ok ? null : msg('Key ignored: FGI = 1, the previous character has not been read yet.', 'Tuş yok sayıldı: FGI = 1, önceki karakter henüz okunmadı.'));
      return ok;
    },
  };
});

/** Subscribes a component to simulator changes and returns the simulator. */
export function useSim(): Simulator {
  useComputer((s) => s.version);
  return sim;
}
