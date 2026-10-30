import { describe, expect, it } from 'vitest';
import type { Bit } from '../bits';
import { alu, aluTable, statusBits } from './alu';
import { adderSubtractor, arithmeticCircuit, arithmeticTable, incrementer } from './arithmetic';
import { LOGIC_FUNCTIONS, logicApplications, logicCircuit, logicFunction } from './logic';
import { combinationalShifter, shiftMicro } from './shift';

describe('adder-subtractor (Fig. 4-7)', () => {
  it('M = 0 adds, M = 1 computes A + B\' + 1', () => {
    expect(adderSubtractor(0b0101, 0b0011, 0, 4)).toMatchObject({ sum: 0b1000, c: 0, v: 1 });
    expect(adderSubtractor(0b0101, 0b0011, 1, 4)).toMatchObject({ bIn: 0b1100, sum: 0b0010, c: 1, v: 0 });
    expect(adderSubtractor(0b0011, 0b0101, 1, 4)).toMatchObject({ sum: 0b1110, c: 0 });
  });

  it('carries C0..C4 and V = C3 ⊕ C4', () => {
    const r = adderSubtractor(0b0110, 0b0011, 0, 4);
    expect(r.carries).toEqual([0, 0, 1, 1, 0]);
    expect(r.v).toBe(1);
  });

  it('is exhaustive-correct for 4 bits', () => {
    for (let a = 0; a < 16; a++)
      for (let b = 0; b < 16; b++) {
        expect(adderSubtractor(a, b, 0, 4).sum).toBe((a + b) & 15);
        expect(adderSubtractor(a, b, 1, 4).sum).toBe((a - b) & 15);
      }
  });
});

describe('incrementer (Fig. 4-8)', () => {
  it('adds one through half adders', () => {
    expect(incrementer(0b0111, 4)).toMatchObject({ sum: 0b1000, carries: [1, 1, 1, 1, 0] });
    expect(incrementer(0b1111, 4)).toMatchObject({ sum: 0, cout: 1 });
  });
});

describe('arithmetic circuit (Fig. 4-9, Table 4-4)', () => {
  const A = 0b0110;
  const B = 0b0011;
  const table44: [number, Bit, string, number][] = [
    [0, 0, 'D = A + B', 0b1001],
    [0, 1, 'D = A + B + 1', 0b1010],
    [1, 0, "D = A + B'", 0b0010],
    [1, 1, "D = A + B' + 1", 0b0011],
    [2, 0, 'D = A', A],
    [2, 1, 'D = A + 1', 0b0111],
    [3, 0, 'D = A − 1', 0b0101],
    [3, 1, 'D = A', A],
  ];

  it.each(table44)('S1S0=%i Cin=%i: %s', (s, cin, micro, d) => {
    const r = arithmeticCircuit(A, B, s, cin, 4, 'fig4-9');
    expect(r.microoperation).toBe(micro);
    expect(r.d).toBe(d);
  });

  it('lists all 8 rows in Table 4-4 order', () => {
    expect(arithmeticTable('fig4-9').map((r) => r.microoperation)).toEqual(table44.map((r) => r[2]));
  });
});

describe('logic circuit (Fig. 4-10)', () => {
  it('S1S0 selects AND, OR, XOR, complement', () => {
    const a = 0b1010;
    const b = 0b1100;
    expect([0, 1, 2, 3].map((s) => logicCircuit(a, b, s, 4).e)).toEqual([0b1000, 0b1110, 0b0110, 0b0101]);
  });
});

describe('16 logic functions (Tables 4-5, 4-6)', () => {
  it.each(LOGIC_FUNCTIONS.map((f) => [f.f, f.micro] as const))('F%i: %s', (f) => {
    // With A = 0011 and B = 0101, bits 3..0 walk the truth-table rows xy = 00, 01, 10, 11,
    // so the result is the function's own column, i.e. the number i.
    expect(logicFunction(f, 0b0011, 0b0101, 4)).toBe(f);
  });

  it('matches the Boolean expressions on sample words', () => {
    const a = 0b1010_0110;
    const b = 0b1100_0011;
    const n = (v: number) => ~v & 0xff;
    const expected = [
      0, a & b, a & n(b), a, n(a) & b, b, a ^ b, a | b,
      n(a | b), n(a ^ b), n(b), a | n(b), n(a), n(a) | b, n(a & b), 0xff,
    ];
    expected.forEach((e, f) => expect(logicFunction(f, a, b, 8)).toBe(e));
  });
});

describe('logic applications (Sec. 4-5)', () => {
  it('uses the examples from the book', () => {
    expect(logicApplications.selectiveSet(0b1010, 0b1100)).toBe(0b1110);
    expect(logicApplications.selectiveComplement(0b1010, 0b1100)).toBe(0b0110);
    expect(logicApplications.selectiveClear(0b1010, 0b1100, 4)).toBe(0b0010);
    expect(logicApplications.mask(0b1010, 0b1100)).toBe(0b1000);
    expect(logicApplications.insert(0b0110_1010, 0b0000_1111, 0b1001_0000)).toEqual({
      masked: 0b0000_1010,
      result: 0b1001_1010,
    });
    expect(logicApplications.clear(0b1010, 0b1010)).toEqual({ result: 0, equal: true });
    expect(logicApplications.clear(0b1010, 0b1011).equal).toBe(false);
  });
});

describe('shift microoperations (Table 4-7)', () => {
  it('logical and circular shifts', () => {
    expect(shiftMicro('shl', 0b1011, 4).value).toBe(0b0110);
    expect(shiftMicro('shr', 0b1011, 4).value).toBe(0b0101);
    expect(shiftMicro('cil', 0b1011, 4).value).toBe(0b0111);
    expect(shiftMicro('cir', 0b1011, 4).value).toBe(0b1101);
  });

  it('ashr keeps and copies the sign bit', () => {
    expect(shiftMicro('ashr', 0b1010, 4).value).toBe(0b1101);
    expect(shiftMicro('ashr', 0b0110, 4).value).toBe(0b0011);
  });

  it('ashl overflow Vs = R(n-1) ⊕ R(n-2) before the shift', () => {
    expect(shiftMicro('ashl', 0b0110, 4)).toEqual({ value: 0b1100, vs: 1 });
    expect(shiftMicro('ashl', 0b1110, 4)).toEqual({ value: 0b1100, vs: 0 });
    expect(shiftMicro('ashl', 0b1010, 4)).toEqual({ value: 0b0100, vs: 1 });
  });
});

describe('combinational shifter (Fig. 4-12)', () => {
  it('S = 0 shifts right with IR into the leftmost bit', () => {
    expect(combinationalShifter(0b1010, 0, 1, 0, 4).h).toBe(0b1101);
  });
  it('S = 1 shifts left with IL into the rightmost bit', () => {
    expect(combinationalShifter(0b1010, 1, 0, 1, 4).h).toBe(0b0101);
  });
});

describe('ALU (Fig. 4-13, Table 4-8)', () => {
  const A = 0b0110;
  const B = 0b0011;

  const printed: [number, Bit, string, number][] = [
    [0b0000, 0, 'F = A', A],
    [0b0000, 1, 'F = A + 1', 0b0111],
    [0b0001, 0, 'F = A + B', 0b1001],
    [0b0001, 1, 'F = A + B + 1', 0b1010],
    [0b0010, 0, "F = A + B'", 0b0010],
    [0b0010, 1, "F = A + B' + 1", 0b0011],
    [0b0011, 0, 'F = A − 1', 0b0101],
    [0b0011, 1, 'F = A', A],
    [0b0100, 0, 'F = A ∧ B', 0b0010],
    [0b0101, 0, 'F = A ∨ B', 0b0111],
    [0b0110, 0, 'F = A ⊕ B', 0b0101],
    [0b0111, 0, "F = A'", 0b1001],
    [0b1000, 0, 'F = shr A', 0b0011],
    [0b1100, 0, 'F = shl A', 0b1100],
  ];

  it.each(printed)('as printed: select %i Cin %i → %s', (sel, cin, op, f) => {
    const r = alu(A, B, sel, cin, 4, 'table4-8');
    expect(r.operation).toBe(op);
    expect(r.f).toBe(f);
  });

  const wiring: [number, Bit, string][] = [
    [0, 0, 'F = A + B'],
    [0, 1, 'F = A + B + 1'],
    [1, 0, "F = A + B'"],
    [1, 1, "F = A + B' + 1"],
    [2, 0, 'F = A'],
    [2, 1, 'F = A + 1'],
    [3, 0, 'F = A − 1'],
    [3, 1, 'F = A'],
  ];

  it.each(wiring)('Fig. 4-9 wiring: select %i Cin %i → %s', (sel, cin, op) => {
    expect(alu(A, B, sel, cin, 4, 'fig4-9').operation).toBe(op);
  });

  it('shows every candidate result at once', () => {
    const r = alu(A, B, 0b0101, 0, 4);
    expect(r.candidates).toEqual({ arithmetic: 0b1001, logic: 0b0111, shr: 0b0011, shl: 0b1100 });
    expect(r.unit).toBe('logic');
    expect(r.carryMeaningful).toBe(false);
  });

  it('shr and shl ignore S1S0 and Cin', () => {
    expect(alu(A, B, 0b1011, 1, 4).f).toBe(0b0011);
    expect(alu(A, B, 0b1110, 1, 4).f).toBe(0b1100);
  });

  it('lists the 14 rows of Table 4-8', () => {
    expect(aluTable().map((r) => r.operation)).toEqual(printed.map((r) => r[2]));
  });
});

describe('status bits (Sec. 8-7, Fig. 8-8)', () => {
  it('0110 + 0011 = 1001: C = 0, S = 1, Z = 0, V = 1', () => {
    const r = alu(0b0110, 0b0011, 0b0001, 0, 4);
    expect(r.f).toBe(0b1001);
    expect(r.status).toEqual({ c: 0, s: 1, z: 0, v: 1 });
  });

  it('1100 + 1011 = 0111: C = 1, V = 1', () => {
    const r = alu(0b1100, 0b1011, 0b0001, 0, 4);
    expect(r.f).toBe(0b0111);
    expect(r.status).toMatchObject({ c: 1, s: 0, z: 0, v: 1 });
  });

  it('Z is set when every output bit is 0', () => {
    expect(alu(0b0101, 0b0101, 0b0010, 1, 4).status).toMatchObject({ z: 1, c: 1, v: 0 });
    expect(statusBits(0, [0, 0, 0, 0, 0], 4).z).toBe(1);
  });
});
