/** Basic Computer instruction set (Table 5-2) and instruction format (Fig. 5-5). */

/** Memory-reference mnemonics indexed by opcode (bits 14-12), 000 to 110. */
export const MRI = ['AND', 'ADD', 'LDA', 'STA', 'BUN', 'BSA', 'ISZ'] as const;
export type MriMnemonic = (typeof MRI)[number];

export const MRI_DESCRIPTION: Record<MriMnemonic, string> = {
  AND: 'AND memory word to AC',
  ADD: 'Add memory word to AC',
  LDA: 'Load memory word to AC',
  STA: 'Store content of AC in memory',
  BUN: 'Branch unconditionally',
  BSA: 'Branch and save return address',
  ISZ: 'Increment and skip if zero',
};

/** Register-reference instructions (7xxx): bit index B_i in IR(0-11) that selects each one. */
export const RRI = [
  { mnemonic: 'CLA', bit: 11, description: 'Clear AC' },
  { mnemonic: 'CLE', bit: 10, description: 'Clear E' },
  { mnemonic: 'CMA', bit: 9, description: 'Complement AC' },
  { mnemonic: 'CME', bit: 8, description: 'Complement E' },
  { mnemonic: 'CIR', bit: 7, description: 'Circulate right AC and E' },
  { mnemonic: 'CIL', bit: 6, description: 'Circulate left AC and E' },
  { mnemonic: 'INC', bit: 5, description: 'Increment AC' },
  { mnemonic: 'SPA', bit: 4, description: 'Skip next instruction if AC positive' },
  { mnemonic: 'SNA', bit: 3, description: 'Skip next instruction if AC negative' },
  { mnemonic: 'SZA', bit: 2, description: 'Skip next instruction if AC zero' },
  { mnemonic: 'SZE', bit: 1, description: 'Skip next instruction if E is 0' },
  { mnemonic: 'HLT', bit: 0, description: 'Halt computer' },
] as const;

/** Input-output instructions (Fxxx). */
export const IOI = [
  { mnemonic: 'INP', bit: 11, description: 'Input character to AC' },
  { mnemonic: 'OUT', bit: 10, description: 'Output character from AC' },
  { mnemonic: 'SKI', bit: 9, description: 'Skip on input flag' },
  { mnemonic: 'SKO', bit: 8, description: 'Skip on output flag' },
  { mnemonic: 'ION', bit: 7, description: 'Interrupt enable on' },
  { mnemonic: 'IOF', bit: 6, description: 'Interrupt enable off' },
] as const;

export type InstructionClass = 'memory-reference' | 'register-reference' | 'input-output';

export const fieldI = (word: number) => (word >>> 15) & 1;
export const fieldOpcode = (word: number) => (word >>> 12) & 7;
export const fieldAddress = (word: number) => word & 0xfff;

export function classify(word: number): InstructionClass {
  if (fieldOpcode(word) !== 7) return 'memory-reference';
  return fieldI(word) ? 'input-output' : 'register-reference';
}

/** Mnemonic → hex code (Table 5-2), used by the assembler. MRI codes are for I = 0. */
export const MRI_CODE: Record<string, number> = Object.fromEntries(MRI.map((m, op) => [m, op << 12]));
export const NON_MRI_CODE: Record<string, number> = Object.fromEntries([
  ...RRI.map((r) => [r.mnemonic, 0x7000 | (1 << r.bit)]),
  ...IOI.map((r) => [r.mnemonic, 0xf000 | (1 << r.bit)]),
]);
