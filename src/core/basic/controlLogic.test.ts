import { describe, expect, it } from 'vitest';
import type { Bit } from '../bits';
import { assemble } from '../assembler/assembler';
import { ASM_EXAMPLES } from '../programs/asmExamples';
import { HEX_EXAMPLES } from '../programs/examples';
import { controlSignals } from './control';
import { evaluateControl, termLabel } from './controlLogic';
import { Simulator } from './simulator';
import { initialState, REGISTERS, type MachineState } from './types';

/** Asserts that the gate equations produce exactly the signals of the control unit. */
function crossCheck(s: MachineState) {
  if (!s.flag.S) return;
  const c = controlSignals(s);
  const g = evaluateControl(s);
  const o = (id: string) => g[id].out === 1;
  const where = `SC=${s.SC} IR=${s.reg.IR.toString(16)} R=${s.flag.R}`;

  for (const r of REGISTERS) {
    for (const k of ['ld', 'inr', 'clr'] as const) {
      const id = `${r}.${k.toUpperCase()}`;
      expect(g[id] ? o(id) : false, `${id} at ${where}`).toBe(c.reg[r][k]);
    }
  }
  expect(o('MEM.READ'), `read at ${where}`).toBe(c.memRead);
  expect(o('MEM.WRITE'), `write at ${where}`).toBe(c.memWrite);
  const xs = [1, 2, 3, 4, 5, 6, 7].filter((i) => o(`x${i}`));
  expect(xs, `bus encoder at ${where}`).toEqual(c.busSelect ? [c.busSelect] : []);
  const acOps = ['AND', 'ADD', 'DR', 'INPR', 'COM', 'SHR', 'SHL'].filter((op) => o(`ALU.${op}`));
  expect(acOps.sort(), `AC ops at ${where}`).toEqual([...c.acOps].sort());
  expect(o('E.CLR')).toBe(c.e.clr);
  expect(o('E.COM')).toBe(c.e.com);
  expect(o('E.LD')).toBe(c.e.load);
  expect(o('SC.CLR'), `SC clear at ${where}`).toBe(c.sc === 'clr');
  expect(o('I.LD')).toBe(c.loadI);
  expect(o('S.CLR')).toBe(c.setFlags.S === 0);
  if (!s.flag.R) expect(o('R.SET'), `R set at ${where}`).toBe(c.setFlags.R === 1);
  expect(o('R.CLR')).toBe(c.setFlags.R === 0);
  expect(o('FGI.CLR')).toBe(c.setFlags.FGI === 0);
  expect(o('FGO.CLR')).toBe(c.setFlags.FGO === 0);
  // ION and IOF together: the control unit lets IEN ← 0 win.
  const ien = o('IEN.CLR') ? 0 : o('IEN.SET') ? 1 : undefined;
  expect(ien).toBe(c.setFlags.IEN);
}

describe('control gate equations (Sec. 5-10) match the control unit', () => {
  it('for every T, opcode, I, R and register-reference / I/O bit, with edge data values', () => {
    const words: number[] = [];
    for (let op = 0; op < 7; op++) for (const i of [0, 1]) words.push((i << 15) | (op << 12) | 0x123);
    for (let b = 0; b < 12; b++) words.push(0x7000 | (1 << b), 0xf000 | (1 << b));
    words.push(0x7c00, 0x7280, 0xf0c0, 0xf300);
    let checked = 0;
    for (const ir of words)
      for (let sc = 0; sc < 8; sc++)
        for (const R of [0, 1] as Bit[])
          for (const flags of [
            { IEN: 0, FGI: 0, FGO: 0, E: 0 },
            { IEN: 1, FGI: 1, FGO: 0, E: 1 },
            { IEN: 1, FGI: 0, FGO: 1, E: 0 },
          ])
            for (const data of [
              { AC: 0, DR: 0 },
              { AC: 0x8001, DR: 5 },
              { AC: 0x0001, DR: 0 },
            ]) {
              const s = initialState();
              s.reg.IR = ir;
              s.SC = sc;
              s.flag.R = R;
              s.flag.I = (ir >> 15) as Bit;
              Object.assign(s.flag, flags);
              Object.assign(s.reg, data);
              crossCheck(s);
              checked++;
            }
    expect(checked).toBeGreaterThan(5000);
  });

  it('for every state reached by the example programs', () => {
    const boots: Simulator[] = [];
    for (const ex of HEX_EXAMPLES) {
      const sim = new Simulator();
      sim.load(ex.mem, ex.reg?.PC ?? 0);
      Object.assign(sim.state.reg, ex.reg);
      Object.assign(sim.state.flag, ex.flag);
      boots.push(sim);
    }
    for (const ex of ASM_EXAMPLES) {
      const r = assemble(ex.source);
      const sim = new Simulator({ printerDelay: 3 });
      sim.load(r.words, r.start);
      Object.assign(sim.state.flag, ex.flag);
      boots.push(sim);
    }
    for (const sim of boots) {
      for (let i = 0; i < 400 && !sim.halted; i++) {
        if (i === 60) sim.pressKey('x');
        crossCheck(sim.state);
        sim.step();
      }
    }
  });
});

describe('term labels use Mano notation', () => {
  it('formats terms', () => {
    expect(termLabel(["R'", 'T0'])).toBe("R'T0");
    expect(termLabel(["D7'", 'I', 'T3'])).toBe("D7'IT3");
    expect(termLabel(['r', 'B4', "AC15'"])).toBe("rB4·AC(15)'");
    expect(termLabel(['D6', 'T6', 'DRZ'])).toBe('D6T6·(DR = 0)');
    expect(termLabel(["T0'", "T1'", "T2'", 'IEN', 'FGI'])).toBe("T0'T1'T2'·IEN·FGI");
  });
});
