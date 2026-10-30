import { describe, expect, it } from 'vitest';
import type { Bit } from '../bits';
import { alu, aluTable } from './alu';
import { aluCircuit } from './aluSteps';

describe('ALU circuit stages (Fig. 4-13)', () => {
  it('0110 + 0011 = 1001 stage by stage, with C=0 S=1 Z=0 V=1', () => {
    const c = aluCircuit(0b0110, 0b0011, 0b0001, 0, 4);
    expect(c.stages.map((s) => [s.a, s.y, s.cin, s.d, s.cout])).toEqual([
      [0, 1, 0, 1, 0],
      [1, 1, 0, 0, 1],
      [1, 0, 1, 0, 1],
      [0, 0, 1, 1, 0],
    ]);
    expect(c.f).toBe(0b1001);
    expect(c.status).toEqual({ c: 0, s: 1, z: 0, v: 1 });
    expect(c.steps.map((s) => s.kind)).toEqual(['inputs', 'y', 'carry', 'carry', 'carry', 'carry', 'logic', 'output', 'status']);
    expect(c.steps[3].text[0]).toBe('Stage 1: A1 + Y1 + C1 = 1 + 1 + 0 → D1 = 0, carry C2 = 1.');
  });

  it('Y multiplexer inputs follow the chosen encoding', () => {
    expect(aluCircuit(0, 0b1, 0, 0, 4, 'table4-8').stages[0].yInputs.map((x) => x.source)).toEqual(['0', 'B', "B'", '1s']);
    expect(aluCircuit(0, 0b1, 0, 0, 4, 'fig4-9').stages[0].yInputs.map((x) => x.source)).toEqual(['B', "B'", '0', '1s']);
  });

  it('shr and shl inputs of the output MUX insert 0 at the ends', () => {
    const c = aluCircuit(0b1011, 0, 0b1000, 0, 4);
    expect(c.stages.map((s) => s.shr)).toEqual([1, 0, 1, 0]);
    expect(c.stages.map((s) => s.shl)).toEqual([0, 1, 1, 0]);
    expect(c.f).toBe(0b0101);
  });

  it.each(['table4-8', 'fig4-9'] as const)('every Table 4-8 row matches alu() for many inputs (%s)', (enc) => {
    for (const row of aluTable(enc))
      for (const cin of [0, 1] as Bit[])
        for (let a = 0; a < 16; a += 3)
          for (let b = 0; b < 16; b += 5) {
            const c = aluCircuit(a, b, row.select, cin, 4, enc);
            const ref = alu(a, b, row.select, cin, 4, enc);
            expect(c.f).toBe(ref.f);
            expect(c.status).toEqual(ref.status);
            expect(c.stages.reduce((v, s) => v | (s.f << s.i), 0)).toBe(ref.f);
          }
  });
});
