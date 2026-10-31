import type { Bit } from '../bits';
import type { FlagName, RegName } from '../basic/types';

/** A machine set up directly in memory and registers (spec examples 1-6). */
export interface HexExample {
  id: string;
  title: string;
  summary: string;
  /** Book reference shown next to the example. */
  reference: string;
  mem: [address: number, word: number][];
  reg?: Partial<Record<RegName, number>>;
  flag?: Partial<Record<FlagName, Bit>>;
  /** What the learner should observe. */
  expect: string;
}

export const HEX_EXAMPLES: HexExample[] = [
  {
    id: 'direct-add',
    title: '1. Direct ADD',
    summary: 'ADD 205 with AC = 0007 and M[205] = 0003.',
    reference: 'Sec. 5-5, Table 5-6',
    mem: [
      [0x020, 0x1205],
      [0x021, 0x7001],
      [0x205, 0x0003],
    ],
    reg: { PC: 0x020, AC: 0x0007 },
    flag: { E: 0 },
    expect: 'After T0-T5 (T3 does nothing): AC = 000A, E = 0, PC = 021, DR = 0003.',
  },
  {
    id: 'indirect-add',
    title: '2. Indirect ADD',
    summary: 'ADD 300 I: M[300] holds the effective address 450.',
    reference: 'Fig. 5-2, Table 5-6',
    mem: [
      [0x021, 0x9300],
      [0x022, 0x7001],
      [0x300, 0x0450],
      [0x450, 0xffff],
    ],
    reg: { PC: 0x021, AC: 0x000a },
    expect: 'At T3, AR ← 0450. After the instruction: AC = 0009, E = 1.',
  },
  {
    id: 'indirect-lda',
    title: '3. Indirect LDA',
    summary: 'LDA 300 I loads M[M[300]] into AC.',
    reference: 'Table 5-6',
    mem: [
      [0x021, 0xa300],
      [0x022, 0x7001],
      [0x300, 0x0450],
      [0x450, 0x1234],
    ],
    reg: { PC: 0x021 },
    expect: 'After the instruction: AC = 1234.',
  },
  {
    id: 'register-reference',
    title: '4. Register-reference INC',
    summary: 'INC (7020) executes entirely in T3.',
    reference: 'Table 5-6',
    mem: [
      [0x022, 0x7020],
      [0x023, 0x7001],
    ],
    reg: { PC: 0x022, AC: 0x0009 },
    expect: 'At T3: AC = 000A and SC ← 0.',
  },
  {
    id: 'bsa',
    title: '5. BSA call and return',
    summary: 'BSA 135 saves the return address at 135; the subroutine returns with BUN 135 I.',
    reference: 'Fig. 5-10',
    mem: [
      [0x020, 0x5135],
      [0x021, 0x7001],
      [0x135, 0x0000],
      [0x136, 0x7020],
      [0x137, 0xc135],
    ],
    reg: { PC: 0x020 },
    expect: 'After BSA: M[135] = 021, PC = 136. After BUN 135 I: PC = 021, then HLT.',
  },
  {
    id: 'isz',
    title: '6. ISZ loop counter',
    summary: 'Two ISZ 0A0 on M[0A0] = FFFE; the second one skips the INC at 012.',
    reference: 'Table 5-6',
    mem: [
      [0x010, 0x60a0],
      [0x011, 0x60a0],
      [0x012, 0x7020],
      [0x013, 0x7001],
      [0x0a0, 0xfffe],
    ],
    reg: { PC: 0x010 },
    expect: 'First ISZ: M[0A0] = FFFF, no skip. Second: M[0A0] = 0000 and INC is skipped (AC stays 0).',
  },
];
