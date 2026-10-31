import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { Base } from '../core/bits';
import type { ArithmeticEncoding } from '../core/alu/arithmetic';
import { DEFAULT_LANES } from '../core/basic/waveforms';
import { localizeRef, pick, type Lang } from '../core/i18n';

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
  /** Interface language. */
  lang: Lang;
  setLang: (l: Lang) => void;
  base: Base;
  signed: boolean;
  width: Width;
  encoding: ArithmeticEncoding;
  speedIndex: number;
  printerDelay: number;
  /** Lanes shown in the timing diagram. */
  lanes: string[];
  /** Height of the bottom dock in px; 0 means collapsed. */
  dockHeight: number;
  setLanes: (l: string[]) => void;
  setDockHeight: (h: number) => void;
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
      lang: browserLang(),
      setLang: (lang) => set({ lang }),
      base: 'hex',
      signed: false,
      width: 4,
      encoding: 'table4-8',
      speedIndex: 3,
      printerDelay: 20,
      lanes: DEFAULT_LANES,
      dockHeight: 260,
      setLanes: (lanes) => set({ lanes }),
      setDockHeight: (dockHeight) => set({ dockHeight: dockHeight === 0 ? 0 : Math.max(140, Math.min(560, dockHeight)) }),
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

/** Turkish when the browser prefers it, English otherwise (only used before the user chooses). */
function browserLang(): Lang {
  try {
    return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
  } catch {
    return 'en';
  }
}

/**
 * The current language and a helper that picks between an English and a Turkish text:
 * `L('Step', 'Adım')`. `ref` translates book references ("Fig. 5-4" → "Şekil 5-4").
 */
export function useLang() {
  const lang = useSettings((s) => s.lang);
  return {
    lang,
    L: (en: string, tr: string) => pick(lang, en, tr),
    ref: (r: string) => localizeRef(r, lang),
  };
}
