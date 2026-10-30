import { toHex } from '../bits';
import { classify, fieldAddress, fieldI, fieldOpcode, IOI, MRI, RRI } from './isa';

/**
 * Disassembles one 16-bit word: 1205 → "ADD 205", 9300 → "ADD 300 I", 7020 → "INC".
 * Register-reference and I/O words with several operation bits list every mnemonic;
 * words that select no valid operation are shown as `HEX xxxx` with `valid: false`.
 */
export function disassemble(word: number): { text: string; valid: boolean; mnemonics: string[] } {
  const kind = classify(word);
  if (kind === 'memory-reference') {
    const m = MRI[fieldOpcode(word)];
    const text = `${m} ${toHex(fieldAddress(word), 12)}${fieldI(word) ? ' I' : ''}`;
    return { text, valid: true, mnemonics: [m] };
  }
  const table = kind === 'register-reference' ? RRI : IOI;
  const mnemonics = table.filter((r) => (word >> r.bit) & 1).map((r) => r.mnemonic as string);
  const usedBits = table.reduce((acc, r) => acc | (1 << r.bit), 0);
  const valid = mnemonics.length > 0 && (fieldAddress(word) & ~usedBits) === 0;
  return { text: valid ? mnemonics.join(' ') : `HEX ${toHex(word, 16)}`, valid, mnemonics };
}
