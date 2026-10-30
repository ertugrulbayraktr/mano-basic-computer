import { formatWord, type Base } from '../../core/bits';

/** Formats a word for display; binary words are grouped in nibbles for readability. */
export function fmt(value: number, width: number, base: Base, signed = false): string {
  const s = formatWord(value, width, base, signed);
  if (base !== 'bin' || width <= 4) return s;
  return s.replace(/\B(?=(\d{4})+(?!\d))/g, ' ');
}

/** Parses user input in the given base. Returns null when it is not a valid number. */
export function parseWord(text: string, base: Base, width: number): number | null {
  const t = text.trim().replace(/[\s_]/g, '');
  if (!t) return null;
  let v: number;
  if (base === 'hex') {
    if (!/^[0-9a-f]+$/i.test(t)) return null;
    v = parseInt(t, 16);
  } else if (base === 'bin') {
    if (!/^[01]+$/.test(t)) return null;
    v = parseInt(t, 2);
  } else {
    if (!/^-?\d+$/.test(t)) return null;
    v = parseInt(t, 10);
    if (v < 0) v += 2 ** width;
  }
  if (v < 0 || v >= 2 ** width) return null;
  return v;
}

export const BASE_LABEL: Record<Base, string> = { hex: 'HEX', bin: 'BIN', dec: 'DEC' };
