/** Bit and word helpers shared by every part of the core. Words are plain non-negative numbers. */

export type Bit = 0 | 1;
export type Base = 'bin' | 'hex' | 'dec';

export const mask = (width: number): number => (width >= 32 ? 0xffffffff : (1 << width) - 1) >>> 0;

export const trunc = (value: number, width: number): number => (value & mask(width)) >>> 0;

export const bitAt = (value: number, i: number): Bit => ((value >>> i) & 1) as Bit;

export const withBit = (value: number, i: number, b: Bit): number =>
  (b ? value | (1 << i) : value & ~(1 << i)) >>> 0;

/** Bits as an array, index 0 = least significant bit. */
export const toBits = (value: number, width: number): Bit[] =>
  Array.from({ length: width }, (_, i) => bitAt(value, i));

export const fromBits = (bits: readonly Bit[]): number =>
  bits.reduce<number>((acc, b, i) => (b ? acc | (1 << i) : acc), 0) >>> 0;

export const complement = (value: number, width: number): number => trunc(~value, width);

/** 2's complement interpretation. */
export const toSigned = (value: number, width: number): number => {
  const v = trunc(value, width);
  return bitAt(v, width - 1) ? v - 2 ** width : v;
};

export const toBin = (value: number, width: number): string =>
  trunc(value, width).toString(2).padStart(width, '0');

export const toHex = (value: number, width: number): string =>
  trunc(value, width)
    .toString(16)
    .toUpperCase()
    .padStart(Math.ceil(width / 4), '0');

export function formatWord(value: number, width: number, base: Base, signed = false): string {
  if (base === 'bin') return toBin(value, width);
  if (base === 'hex') return toHex(value, width);
  return String(signed ? toSigned(value, width) : trunc(value, width));
}
