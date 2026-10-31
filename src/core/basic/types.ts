import type { Bit } from '../bits';

/** Registers of the Basic Computer (Table 5-1). */
export type RegName = 'DR' | 'AR' | 'AC' | 'IR' | 'PC' | 'TR' | 'INPR' | 'OUTR';

export const REGISTERS: readonly RegName[] = ['DR', 'AR', 'AC', 'IR', 'PC', 'TR', 'INPR', 'OUTR'];

export const REG_WIDTH: Record<RegName, number> = {
  DR: 16,
  AR: 12,
  AC: 16,
  IR: 16,
  PC: 12,
  TR: 16,
  INPR: 8,
  OUTR: 8,
};

export const REG_TITLE: Record<RegName, string> = {
  DR: 'Data register',
  AR: 'Address register',
  AC: 'Accumulator',
  IR: 'Instruction register',
  PC: 'Program counter',
  TR: 'Temporary register',
  INPR: 'Input register',
  OUTR: 'Output register',
};

/** Single-bit flip-flops. */
export type FlagName = 'I' | 'S' | 'E' | 'R' | 'IEN' | 'FGI' | 'FGO';

export const FLAGS: readonly FlagName[] = ['I', 'S', 'E', 'R', 'IEN', 'FGI', 'FGO'];

export const FLAG_TITLE: Record<FlagName, string> = {
  I: 'Addressing mode (indirect)',
  S: 'Start-stop',
  E: 'Extended AC bit (carry)',
  R: 'Interrupt',
  IEN: 'Interrupt enable',
  FGI: 'Input flag',
  FGO: 'Output flag',
};

export const MEMORY_WORDS = 4096;

export interface MachineState {
  reg: Record<RegName, number>;
  flag: Record<FlagName, Bit>;
  /** Sequence counter, 4 bits. Timing signal T_SC is active. */
  SC: number;
  mem: Uint16Array;
}

/** Bus select S2S1S0 → source (Fig. 5-4). Index 0 means no source. */
export const BUS_SOURCES = ['none', 'AR', 'PC', 'DR', 'AC', 'IR', 'TR', 'Memory'] as const;
export type BusSource = (typeof BUS_SOURCES)[number];

/**
 * Initial state after reset. FGO starts at 1 because the output device is ready
 * ("initially, the output flag FGO is set to 1", Sec. 5-7). S = 1 so the clock runs.
 */
export function initialState(): MachineState {
  return {
    reg: { DR: 0, AR: 0, AC: 0, IR: 0, PC: 0, TR: 0, INPR: 0, OUTR: 0 },
    flag: { I: 0, S: 1, E: 0, R: 0, IEN: 0, FGI: 0, FGO: 1 },
    SC: 0,
    mem: new Uint16Array(MEMORY_WORDS),
  };
}

export function cloneState(s: MachineState): MachineState {
  return { reg: { ...s.reg }, flag: { ...s.flag }, SC: s.SC, mem: s.mem.slice() };
}

export const REG_TITLE_TR: Record<RegName, string> = {
  DR: 'Veri yazmacı',
  AR: 'Adres yazmacı',
  AC: 'Akümülatör',
  IR: 'Komut yazmacı',
  PC: 'Program sayacı',
  TR: 'Geçici yazmaç',
  INPR: 'Giriş yazmacı',
  OUTR: 'Çıkış yazmacı',
};

export const FLAG_TITLE_TR: Record<FlagName, string> = {
  I: 'Adresleme modu (dolaylı)',
  S: 'Başlat-durdur',
  E: 'Genişletilmiş AC biti (elde)',
  R: 'Kesme',
  IEN: 'Kesme etkinleştirme',
  FGI: 'Giriş bayrağı',
  FGO: 'Çıkış bayrağı',
};
