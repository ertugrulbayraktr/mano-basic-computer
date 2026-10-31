import { MRI_CODE, NON_MRI_CODE } from '../basic/isa';
import { pick, type Lang } from '../i18n';
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

function parseLine(source: string, line: number, errors: AssemblyError[], L: (en: string, tr: string) => string): Parsed {
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
        message: L(
          `Invalid label "${label}": a label has one to three letters or digits and starts with a letter.`,
          `Geçersiz etiket "${label}": etiket bir ile üç arasında harf ya da rakamdan oluşur ve harfle başlar.`,
        ),
      });
    } else if (MRI_CODE[label] !== undefined || NON_MRI_CODE[label] !== undefined || PSEUDO.has(label) || label === 'I') {
      errors.push({ line, message: L(`"${label}" is a reserved symbol and cannot be used as a label.`, `"${label}" ayrılmış bir semboldür, etiket olarak kullanılamaz.`) });
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

export function assemble(text: string, lang: Lang = 'en'): AssemblyResult {
  const L = (en: string, tr: string) => pick(lang, en, tr);
  const errors: AssemblyError[] = [];
  const warnings: AssemblyError[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const parsed = lines.map((src, i) => parseLine(src, i + 1, errors, L));
  const symbols = new Map<string, number>();
  let start: number | undefined;
  let sawEnd = false;

  // Pass 1: assign addresses with the location counter and build the symbol table.
  let lc = 0;
  for (const p of parsed) {
    if (sawEnd) break;
    if (p.label) {
      if (symbols.has(p.label)) errors.push({ line: p.line, message: L(`Label "${p.label}" is defined more than once.`, `"${p.label}" etiketi birden fazla kez tanımlanmış.`) });
      else symbols.set(p.label, lc);
    }
    if (!p.op) {
      if (p.label) errors.push({ line: p.line, message: L(`Label "${p.label}" has no instruction.`, `"${p.label}" etiketinin komutu yok.`) });
      continue;
    }
    if (p.op === 'ORG') {
      const n = p.operands[0];
      if (!n || !HEX_RE.test(n) || parseInt(n, 16) >= MEMORY_WORDS) {
        errors.push({ line: p.line, message: L('ORG needs a hexadecimal address between 0 and FFF.', 'ORG, 0 ile FFF arasında onaltılık bir adres ister.') });
      } else {
        lc = parseInt(n, 16);
        start ??= lc;
      }
      if (p.label) errors.push({ line: p.line, message: L('A label on an ORG line has no word to name.', 'ORG satırındaki etiketin adlandıracağı bir kelime yok.') });
      continue;
    }
    if (p.op === 'END') {
      sawEnd = true;
      continue;
    }
    lc++;
  }
  if (!sawEnd) warnings.push({ line: lines.length, message: L('No END statement; the assembler stopped at the last line.', 'END ifadesi yok; çevirici son satırda durdu.') });

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
      if (p.operands.length > 1) err(L('ORG takes one operand.', 'ORG tek bir işlenen alır.'));
      continue;
    }
    if (p.op === 'END') {
      if (p.operands.length) err(L('END takes no operand.', 'END işlenen almaz.'));
      ended = true;
      continue;
    }

    let code: number | null = null;
    if (p.op === 'DEC') {
      const n = p.operands[0];
      if (!n || !/^[+-]?\d+$/.test(n)) err(L('DEC needs a decimal number, for example DEC -23.', 'DEC onluk bir sayı ister, örneğin DEC -23.'));
      else {
        const v = parseInt(n, 10);
        if (v < -32768 || v > 65535) err(L(`DEC ${v} does not fit in 16 bits (−32768 to 65535).`, `DEC ${v} 16 bite sığmıyor (−32768 ile 65535 arası).`));
        else code = v & 0xffff;
      }
      if (p.operands.length > 1) err(L('DEC takes one operand.', 'DEC tek bir işlenen alır.'));
    } else if (p.op === 'HEX') {
      const n = p.operands[0];
      if (!n || !HEX_RE.test(n) || parseInt(n, 16) > 0xffff) err(L('HEX needs a hexadecimal number from 0 to FFFF.', 'HEX, 0 ile FFFF arasında onaltılık bir sayı ister.'));
      else code = parseInt(n, 16);
      if (p.operands.length > 1) err(L('HEX takes one operand.', 'HEX tek bir işlenen alır.'));
    } else if (MRI_CODE[p.op] !== undefined) {
      const [addr, ind, ...extra] = p.operands;
      if (!addr) err(L(`${p.op} needs an address (a label or a hexadecimal number).`, `${p.op} bir adres ister (etiket ya da onaltılık sayı).`));
      else {
        const target = symbols.get(addr) ?? (HEX_RE.test(addr) ? parseInt(addr, 16) : undefined);
        if (target === undefined) err(L(`Undefined symbol "${addr}".`, `Tanımsız sembol "${addr}".`));
        else if (target >= MEMORY_WORDS) err(L(`Address ${addr} is outside memory (0 to FFF).`, `${addr} adresi belleğin dışında (0 ile FFF arası).`));
        else if (ind !== undefined && ind !== 'I') err(L(`Expected "I" for indirect addressing after the address, found "${ind}".`, `Adresten sonra dolaylı adresleme için "I" bekleniyordu, "${ind}" bulundu.`));
        else code = MRI_CODE[p.op] | target | (ind === 'I' ? 0x8000 : 0);
      }
      if (extra.length) err(L(`Unexpected "${extra.join(' ')}".`, `Beklenmeyen "${extra.join(' ')}".`));
    } else if (NON_MRI_CODE[p.op] !== undefined) {
      if (p.operands.length) err(L(`${p.op} is a register-reference or I/O instruction and takes no address.`, `${p.op} yazmaç başvurulu ya da G/Ç komutudur, adres almaz.`));
      else code = NON_MRI_CODE[p.op];
    } else {
      err(L(`Unknown instruction "${p.op}".`, `Bilinmeyen komut "${p.op}".`));
    }

    if (lc >= MEMORY_WORDS) err(L('The program runs past the end of memory (FFF).', 'Program belleğin sonunu (FFF) aşıyor.'));
    else {
      if (words.has(lc)) warnings.push({ line: p.line, message: L(`Address ${lc.toString(16).toUpperCase()} is assembled twice; the later word wins.`, `${lc.toString(16).toUpperCase()} adresi iki kez çevrildi; sonraki kelime geçerli.`) });
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
