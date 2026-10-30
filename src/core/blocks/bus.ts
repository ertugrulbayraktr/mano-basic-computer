import { bitAt, type Bit } from '../bits';
import { decoder } from './combinational';

/**
 * Bus built from multiplexers (Fig. 4-3): n multiplexers of size k × 1.
 * The i-th MUX receives bit i of every register; all MUXes share the select lines.
 */
export function muxBus(registers: readonly number[], select: number, width: number) {
  const muxes = Array.from({ length: width }, (_, i) => {
    const inputs = registers.map((r) => bitAt(r, i));
    return { inputs, out: inputs[select] };
  });
  return { value: registers[select], muxes };
}

export type TriState = Bit | 'Z';

/**
 * Bus built from three-state buffers (Fig. 4-4, 4-5): one buffer per register bit; a decoder
 * enables all buffers of one register, the others are in the high-impedance state.
 */
export function triStateBus(registers: readonly number[], select: number, width: number) {
  const enables = decoder(select, Math.log2(registers.length));
  const buffers: TriState[][] = registers.map((r, j) =>
    Array.from({ length: width }, (_, i) => (enables[j] ? bitAt(r, i) : 'Z')),
  );
  return { value: registers[select], enables, buffers };
}

/** Component counts of the two implementations for k registers of n bits. */
export const busComponentCounts = (k: number, n: number) => ({
  mux: { multiplexers: n, muxSize: `${k} × 1` },
  triState: { buffers: n * k, decoders: 1, decoderSize: `${Math.log2(k)} × ${k}` },
});

/**
 * Register transfers under a control function (Fig. 4-2). All transfers happen on the same
 * clock edge using the values from before the pulse, so `R2 ← R1, R1 ← R2` swaps them.
 */
export function clockTransfers(
  regs: Readonly<Record<string, number>>,
  control: Bit,
  transfers: readonly { to: string; from: string }[],
): Record<string, number> {
  const next = { ...regs };
  if (control) for (const t of transfers) next[t.to] = regs[t.from];
  return next;
}
