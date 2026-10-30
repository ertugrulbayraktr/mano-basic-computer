import { describe, expect, it } from 'vitest';
import type { Bit } from '../bits';
import { formatWord, fromBits, toBits, toSigned } from '../bits';
import { fullAdder, halfAdder, rippleAdder } from './adders';
import { busComponentCounts, clockTransfers, muxBus, triStateBus } from './bus';
import { decoder, encoder, mux } from './combinational';
import { gate, norOnly, truthTable } from './gates';
import { clockRegister, countUp, MemoryUnit, shiftRegister } from './sequential';

const B: Bit[] = [0, 1];

describe('bits', () => {
  it('round-trips bit arrays and formats words', () => {
    expect(fromBits(toBits(0b1011, 4))).toBe(0b1011);
    expect(formatWord(0x0a, 8, 'hex')).toBe('0A');
    expect(formatWord(0b1001, 4, 'bin')).toBe('1001');
    expect(formatWord(0b1001, 4, 'dec', true)).toBe('-7');
    expect(toSigned(0xffff, 16)).toBe(-1);
  });
});

describe('gates (Fig. 1-2)', () => {
  it('matches the truth tables', () => {
    const outs = (g: Parameters<typeof truthTable>[0]) => truthTable(g).map((r) => r.out);
    expect(outs('AND')).toEqual([0, 0, 0, 1]);
    expect(outs('OR')).toEqual([0, 1, 1, 1]);
    expect(outs('NOT')).toEqual([1, 0]);
    expect(outs('NAND')).toEqual([1, 1, 1, 0]);
    expect(outs('NOR')).toEqual([1, 0, 0, 0]);
    expect(outs('XOR')).toEqual([0, 1, 1, 0]);
    expect(outs('XNOR')).toEqual([1, 0, 0, 1]);
  });

  it('builds NOT, OR and AND from NOR gates only', () => {
    for (const x of B) {
      expect(norOnly.not(x).out).toBe(gate('NOT', x));
      for (const y of B) {
        expect(norOnly.or(x, y).out).toBe(gate('OR', x, y));
        expect(norOnly.and(x, y).out).toBe(gate('AND', x, y));
      }
    }
  });
});

describe('adders', () => {
  it('half adder: S = x ⊕ y, C = xy', () => {
    for (const x of B) for (const y of B) expect(halfAdder(x, y)).toEqual({ s: x ^ y, c: x & y });
  });

  it('full adder from two half adders matches S = x⊕y⊕z, C = xy+xz+yz', () => {
    for (const x of B)
      for (const y of B)
        for (const z of B) {
          const fa = fullAdder(x, y, z);
          expect(fa.s).toBe(x ^ y ^ z);
          expect(fa.c).toBe((x & y) | (x & z) | (y & z));
          expect(fa.s1).toBe(x ^ y);
          expect(fa.c1).toBe(x & y);
          expect(fa.c2).toBe((x ^ y) & z);
        }
  });

  it('4-bit ripple-carry adder exposes C0..C4 (Fig. 2-6)', () => {
    const r = rippleAdder(0b1011, 0b0011, 0, 4);
    expect(r.sum).toBe(0b1110);
    expect(r.carries).toEqual([0, 1, 1, 0, 0]);
    expect(rippleAdder(0b1111, 0b0001, 0, 4)).toMatchObject({ sum: 0, cout: 1 });
    for (let a = 0; a < 16; a++)
      for (let b = 0; b < 16; b++) expect(rippleAdder(a, b, 1, 4).sum).toBe((a + b + 1) & 15);
  });
});

describe('combinational blocks', () => {
  it('3×8 decoder: one output when E = 1, none when E = 0 (Fig. 2-1)', () => {
    for (let i = 0; i < 8; i++) {
      const out = decoder(i, 3, 1);
      expect(out.filter((b) => b === 1)).toHaveLength(1);
      expect(out[i]).toBe(1);
      expect(decoder(i, 3, 0).every((b) => b === 0)).toBe(true);
    }
  });

  it('8×3 encoder is the inverse of the decoder', () => {
    for (let i = 0; i < 8; i++) expect(encoder(decoder(i, 3))).toMatchObject({ code: i, valid: true });
    expect(encoder([0, 1, 1, 0, 0, 0, 0, 0]).valid).toBe(false);
  });

  it('4×1 MUX selects with S1S0 (Fig. 2-2)', () => {
    expect([0, 1, 2, 3].map((s) => mux(['I0', 'I1', 'I2', 'I3'], s))).toEqual(['I0', 'I1', 'I2', 'I3']);
  });
});

describe('sequential blocks', () => {
  it('register with parallel load changes only on the pulse; CLR > LD > INR', () => {
    expect(clockRegister(5, 4, {}, 9)).toBe(5);
    expect(clockRegister(5, 4, { ld: true }, 9)).toBe(9);
    expect(clockRegister(5, 4, { inr: true })).toBe(6);
    expect(clockRegister(5, 4, { clr: true, ld: true }, 9)).toBe(0);
    expect(clockRegister(5, 4, { ld: true, inr: true }, 9)).toBe(9);
  });

  it('binary counter wraps 1111 → 0000 (Fig. 2-10)', () => {
    expect(countUp(0b1111, 4)).toBe(0);
    expect(countUp(0b0111, 4)).toBe(0b1000);
  });

  it('shift register: serial input and circular mode (Fig. 2-8)', () => {
    expect(shiftRegister(0b1011, 4, 'right', 0)).toEqual({ value: 0b0101, serialOut: 1 });
    expect(shiftRegister(0b1011, 4, 'right', 1)).toEqual({ value: 0b1101, serialOut: 1 });
    expect(shiftRegister(0b1011, 4, 'left', 0)).toEqual({ value: 0b0110, serialOut: 1 });
    expect(shiftRegister(0b1011, 4, 'left', 0, true).value).toBe(0b0111);
    expect(shiftRegister(0b1010, 4, 'right', 1, true).value).toBe(0b0101);
  });

  it('memory unit reads what was written (Fig. 2-12)', () => {
    const m = new MemoryUnit(3, 4);
    expect(m.words).toHaveLength(8);
    m.write(5, 0x1f);
    expect(m.read(5)).toBe(0xf);
    expect(m.read(4)).toBe(0);
  });
});

describe('common bus (Fig. 4-3 vs. Fig. 4-4/4-5)', () => {
  const regs = [0b0001, 0b1010, 0b1100, 0b0111];

  it('both implementations put the same register on the bus', () => {
    for (let s = 0; s < 4; s++) {
      const m = muxBus(regs, s, 4);
      const t = triStateBus(regs, s, 4);
      expect(m.value).toBe(regs[s]);
      expect(t.value).toBe(regs[s]);
      expect(fromBits(m.muxes.map((x) => x.out))).toBe(regs[s]);
    }
  });

  it('i-th MUX receives bit i of every register', () => {
    expect(muxBus(regs, 0, 4).muxes[1].inputs).toEqual([0, 1, 0, 1]);
  });

  it('disabled buffers are in high impedance', () => {
    const t = triStateBus(regs, 2, 4);
    expect(t.enables).toEqual([0, 0, 1, 0]);
    expect(t.buffers[0]).toEqual(['Z', 'Z', 'Z', 'Z']);
    expect(t.buffers[2]).toEqual([0, 0, 1, 1]);
  });

  it('component counts', () => {
    expect(busComponentCounts(4, 4)).toEqual({
      mux: { multiplexers: 4, muxSize: '4 × 1' },
      triState: { buffers: 16, decoders: 1, decoderSize: '2 × 4' },
    });
  });
});

describe('register transfer (Fig. 4-2)', () => {
  it('P: R2 ← R1 only when P = 1', () => {
    const t = [{ to: 'R2', from: 'R1' }];
    expect(clockTransfers({ R1: 3, R2: 7 }, 0, t)).toEqual({ R1: 3, R2: 7 });
    expect(clockTransfers({ R1: 3, R2: 7 }, 1, t)).toEqual({ R1: 3, R2: 3 });
  });

  it('T: R2 ← R1, R1 ← R2 swaps using pre-pulse values', () => {
    const swap = [
      { to: 'R2', from: 'R1' },
      { to: 'R1', from: 'R2' },
    ];
    expect(clockTransfers({ R1: 3, R2: 7 }, 1, swap)).toEqual({ R1: 7, R2: 3 });
  });
});
