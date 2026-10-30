import { MRI_CODE, NON_MRI_CODE } from '../basic/isa';
import { MEMORY_WORDS } from '../basic/types';

/**
 * Two-pass assembler for Mano's assembly language (Ch. 6, Sec. 6-2 to 6-3).
 *
 * Each line has up to three fields: an optional label of one to three alphanumeric characters
 * starting with a letter and terminated by a comma, an instruction, and a comment after `/`.
 * Instructions are memory-reference mnemonics with an address and an optional `I`,
 * register-reference and input-output mnemonics, or the pseudo-instructions ORG N (hex),
 * END, DEC N and HEX N.
 *
 * Addresses may be symbols or hexadecimal numbers. A token that is a defined label is a symbol;
 * otherwise it is read as a hexadecimal number.
 */

export interface AssemblyError {
  line: number;
  message: string;
}

export interface ListingLine {
  line: number;
  source: string;
  address?: number;
  code?: number;
}

export interface AssemblyResult {
  ok: boolean;
  errors: AssemblyError[];
  warnings: AssemblyError[];
  /** Address → word for every word the program defines. */
  words: Map<number, number>;
  symbols: Map<string, number>;
  listing: ListingLine[];
  /** Start address: the operand of the first ORG (0 if there is none). */
  start: number;
}

interface Parsed {
  line: number;
  source: string;
  label?: string;
  op?: string;
  operands: string[];
}

const PSEUDO = new Set(['ORG', 'END', 'DEC', 'HEX']);
const LABEL_RE = /^[A-Z][A-Z0-9]{0,2}$/;
const HEX_RE = /^[0-9A-F]+$/;

function parseLine(source: string, line: number, errors: AssemblyError[]): Parsed {
  const code = source.split('/')[0];
  const p: Parsed = { line, source, operands: [] };
  let rest = code;
  const comma = code.indexOf(',');
  if (comma >= 0) {
    const label = code.slice(0, comma).trim().toUpperCase();
    rest = code.slice(comma + 1);
    if (!LABEL_RE.test(label)) {
      errors.push({
        line,
        message: `Invalid label "${label}": a label has one to three letters or digits and starts with a letter.`,
      });
    } else if (MRI_CODE[label] !== undefined || NON_MRI_CODE[label] !== undefined || PSEUDO.has(label) || label === 'I') {
      errors.push({ line, message: `"${label}" is a reserved symbol and cannot be used as a label.` });
    } else {
      p.label = label;
    }
  }
  const tokens = rest.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (tokens.length) {
    p.op = tokens[0];
    p.operands = tokens.slice(1);
  }
  return p;
}

export function assemble(text: string): AssemblyResult {
  const errors: AssemblyError[] = [];
  const warnings: AssemblyError[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const parsed = lines.map((src, i) => parseLine(src, i + 1, errors));
  const symbols = new Map<string, number>();
  let start: number | undefined;
  let sawEnd = false;

  // Pass 1: assign addresses with the location counter and build the symbol table.
  let lc = 0;
  for (const p of parsed) {
    if (sawEnd) break;
    if (p.label) {
      if (symbols.has(p.label)) errors.push({ line: p.line, message: `Label "${p.label}" is defined more than once.` });
      else symbols.set(p.label, lc);
    }
    if (!p.op) {
      if (p.label) errors.push({ line: p.line, message: `Label "${p.label}" has no instruction.` });
      continue;
    }
    if (p.op === 'ORG') {
      const n = p.operands[0];
      if (!n || !HEX_RE.test(n) || parseInt(n, 16) >= MEMORY_WORDS) {
        errors.push({ line: p.line, message: 'ORG needs a hexadecimal address between 0 and FFF.' });
      } else {
        lc = parseInt(n, 16);
        start ??= lc;
      }
      if (p.label) errors.push({ line: p.line, message: 'A label on an ORG line has no word to name.' });
      continue;
    }
    if (p.op === 'END') {
      sawEnd = true;
      continue;
    }
    lc++;
  }
  if (!sawEnd) warnings.push({ line: lines.length, message: 'No END statement; the assembler stopped at the last line.' });

  // Pass 2: translate every instruction to its binary word.
  const words = new Map<number, number>();
  const listing: ListingLine[] = [];
  lc = 0;
  let ended = false;
  for (const p of parsed) {
    const entry: ListingLine = { line: p.line, source: p.source };
    listing.push(entry);
    if (ended || !p.op) continue;
    const err = (message: string) => errors.push({ line: p.line, message });

    if (p.op === 'ORG') {
      if (p.operands[0] && HEX_RE.test(p.operands[0])) lc = parseInt(p.operands[0], 16) & 0xfff;
      if (p.operands.length > 1) err('ORG takes one operand.');
      continue;
    }
    if (p.op === 'END') {
      if (p.operands.length) err('END takes no operand.');
      ended = true;
      continue;
    }

    let code: number | null = null;
    if (p.op === 'DEC') {
      const n = p.operands[0];
      if (!n || !/^[+-]?\d+$/.test(n)) err('DEC needs a decimal number, for example DEC -23.');
      else {
        const v = parseInt(n, 10);
        if (v < -32768 || v > 65535) err(`DEC ${v} does not fit in 16 bits (−32768 to 65535).`);
        else code = v & 0xffff;
      }
      if (p.operands.length > 1) err('DEC takes one operand.');
    } else if (p.op === 'HEX') {
      const n = p.operands[0];
      if (!n || !HEX_RE.test(n) || parseInt(n, 16) > 0xffff) err('HEX needs a hexadecimal number from 0 to FFFF.');
      else code = parseInt(n, 16);
      if (p.operands.length > 1) err('HEX takes one operand.');
    } else if (MRI_CODE[p.op] !== undefined) {
      const [addr, ind, ...extra] = p.operands;
      if (!addr) err(`${p.op} needs an address (a label or a hexadecimal number).`);
      else {
        const target = symbols.get(addr) ?? (HEX_RE.test(addr) ? parseInt(addr, 16) : undefined);
        if (target === undefined) err(`Undefined symbol "${addr}".`);
        else if (target >= MEMORY_WORDS) err(`Address ${addr} is outside memory (0 to FFF).`);
        else if (ind !== undefined && ind !== 'I') err(`Expected "I" for indirect addressing after the address, found "${ind}".`);
        else code = MRI_CODE[p.op] | target | (ind === 'I' ? 0x8000 : 0);
      }
      if (extra.length) err(`Unexpected "${extra.join(' ')}".`);
    } else if (NON_MRI_CODE[p.op] !== undefined) {
      if (p.operands.length) err(`${p.op} is a register-reference or I/O instruction and takes no address.`);
      else code = NON_MRI_CODE[p.op];
    } else {
      err(`Unknown instruction "${p.op}".`);
    }

    if (lc >= MEMORY_WORDS) err('The program runs past the end of memory (FFF).');
    else {
      if (words.has(lc)) warnings.push({ line: p.line, message: `Address ${lc.toString(16).toUpperCase()} is assembled twice; the later word wins.` });
      entry.address = lc;
      if (code !== null) {
        entry.code = code;
        words.set(lc, code);
      }
    }
    lc++;
  }

  errors.sort((a, b) => a.line - b.line);
  return { ok: errors.length === 0, errors, warnings, words, symbols, listing, start: start ?? 0 };
}
