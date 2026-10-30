import { describe, expect, it } from 'vitest';
import { Simulator } from '../basic/simulator';
import { HEX_EXAMPLES, type HexExample } from './examples';

function boot(id: string): Simulator {
  const ex = HEX_EXAMPLES.find((e) => e.id === id) as HexExample;
  const sim = new Simulator();
  sim.load(ex.mem, ex.reg?.PC ?? 0);
  Object.assign(sim.state.reg, ex.reg);
  Object.assign(sim.state.flag, ex.flag);
  return sim;
}

describe('loadable examples 1-6 produce the spec results', () => {
  it('1 direct ADD', () => {
    const sim = boot('direct-add');
    expect(sim.stepInstruction()).toHaveLength(6);
    expect(sim.state.reg).toMatchObject({ AC: 0x000a, PC: 0x021, DR: 0x0003 });
    expect(sim.state.flag.E).toBe(0);
  });

  it('2 indirect ADD', () => {
    const sim = boot('indirect-add');
    for (let i = 0; i < 4; i++) sim.step();
    expect(sim.state.reg.AR).toBe(0x450);
    sim.stepInstruction();
    expect(sim.state.reg.AC).toBe(0x0009);
    expect(sim.state.flag.E).toBe(1);
  });

  it('3 indirect LDA', () => {
    const sim = boot('indirect-lda');
    sim.stepInstruction();
    expect(sim.state.reg.AC).toBe(0x1234);
  });

  it('4 register-reference INC', () => {
    const sim = boot('register-reference');
    expect(sim.stepInstruction()).toHaveLength(4);
    expect(sim.state.reg.AC).toBe(0x000a);
  });

  it('5 BSA call and return', () => {
    const sim = boot('bsa');
    sim.stepInstruction();
    expect(sim.state.mem[0x135]).toBe(0x021);
    expect(sim.state.reg.PC).toBe(0x136);
    expect(sim.run()).toBe('halted');
    expect(sim.history.map((h) => h.text)).toEqual(['BSA 135', 'INC', 'BUN 135 I', 'HLT']);
  });

  it('6 ISZ loop counter', () => {
    const sim = boot('isz');
    sim.stepInstruction();
    expect(sim.state.mem[0x0a0]).toBe(0xffff);
    expect(sim.state.reg.PC).toBe(0x011);
    sim.stepInstruction();
    expect(sim.state.mem[0x0a0]).toBe(0);
    expect(sim.state.reg.PC).toBe(0x013);
    expect(sim.run()).toBe('halted');
    expect(sim.state.reg.AC).toBe(0);
  });
});
