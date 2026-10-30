import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { Base } from '../core/bits';
import type { ArithmeticEncoding } from '../core/alu/arithmetic';

/** localStorage that never throws (private mode, blocked storage, previews). */
export const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* storage unavailable */
    }
  },
};

export type Width = 4 | 8 | 16;

/** Run speeds in pulses per second; Infinity runs as fast as possible. */
export const SPEEDS = [1, 2, 4, 8, 16, 32, 100, 500, 2000, Infinity] as const;

interface Settings {
  base: Base;
  signed: boolean;
  width: Width;
  encoding: ArithmeticEncoding;
  speedIndex: number;
  printerDelay: number;
  setBase: (b: Base) => void;
  setSigned: (s: boolean) => void;
  setWidth: (w: Width) => void;
  setEncoding: (e: ArithmeticEncoding) => void;
  setSpeedIndex: (i: number) => void;
  setPrinterDelay: (d: number) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      base: 'hex',
      signed: false,
      width: 4,
      encoding: 'table4-8',
      speedIndex: 3,
      printerDelay: 20,
      setBase: (base) => set({ base }),
      setSigned: (signed) => set({ signed }),
      setWidth: (width) => set({ width }),
      setEncoding: (encoding) => set({ encoding }),
      setSpeedIndex: (speedIndex) => set({ speedIndex }),
      setPrinterDelay: (printerDelay) => set({ printerDelay: Math.max(1, Math.min(999, printerDelay)) }),
    }),
    { name: 'mano-settings', storage: createJSONStorage(() => safeStorage) },
  ),
);
