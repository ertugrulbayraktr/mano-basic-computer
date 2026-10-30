import { bitAt, type Bit } from '../bits';

/** n × 2^n decoder with enable (Fig. 2-1 for n = 3). With E = 0 every output is 0. */
export function decoder(input: number, n: number, enable: Bit = 1): Bit[] {
  return Array.from({ length: 2 ** n }, (_, i) => (enable && i === input ? 1 : 0) as Bit);
}

/**
 * 2^n × n encoder (8 × 3 for n = 3), the inverse of the decoder.
 * Assumes exactly one input is 1; `valid` is false otherwise, and the code is then the OR of
 * the codes of all active inputs, which is what the OR-gate implementation produces.
 */
export function encoder(inputs: readonly Bit[]) {
  const n = Math.log2(inputs.length);
  let code = 0;
  let active = 0;
  inputs.forEach((d, i) => {
    if (d) {
      code |= i;
      active++;
    }
  });
  const bits = Array.from({ length: n }, (_, i) => bitAt(code, i));
  return { code, bits, valid: active === 1 };
}

/** 2^k × 1 multiplexer (Fig. 2-2 for k = 2): the select value picks a data input. */
export const mux = <T>(inputs: readonly T[], select: number): T => inputs[select];
