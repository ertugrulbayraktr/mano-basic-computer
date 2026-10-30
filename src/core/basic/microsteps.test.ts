import { describe, expect, it } from 'vitest';
import { HEX_EXAMPLES } from '../programs/examples';
import { viewPulse } from './microsteps';
import { Simulator } from './simulator';

function example1() {
  const ex = HEX_EXAMPLES[0];
  const sim = new Simulator();
  sim.load(ex.mem, 0x020);
  Object.assign(sim.state.reg, ex.reg);
  return sim;
}

describe('pulse micro-steps', () => {
  it('splits D1T4 of ADD into decode, control gates, data flow and clock edge', () => {
    const sim = example1();
    for (let i = 0; i < 4; i++) sim.step();
    const t = sim.step();
    const v = viewPulse(t, sim.state.mem);
    expect(v.T).toBe(4);
    expect(v.D).toBe(1);
    expect(v.steps.map((s) => s.kind)).toEqual(['decode', 'control', 'transfer', 'latch']);
    expect(v.steps[0].text[0]).toBe('SC = 0100 → the 4 × 16 decoder raises T4.');
    expect(v.steps[0].text[1]).toContain('raises D1');
    expect(v.active.map((a) => a.output).sort()).toEqual(['DR.LD', 'MEM.READ', 'x7']);
    expect(v.steps[1].text[0]).toBe('D1T4 = 1 → LD(DR), Read, x7 (Memory).');
    expect(v.steps[2].text[0]).toContain('S2S1S0 = 111');
    expect(v.steps[2].text[0]).toContain('= 0003');
    expect(v.steps[3].text[0]).toBe('On the clock edge, at the same instant: DR ← 0003 (was 0000), SC ← 5.');
  });

  it('uses pre-pulse values even after the simulator moved on', () => {
    const sim = example1();
    const t0 = sim.step();
    sim.step();
    const v = viewPulse(t0);
    expect(v.T).toBe(0);
    expect(v.active.map((a) => a.output).sort()).toEqual(['AR.LD', 'x2']);
    expect(v.steps[1].text[0]).toBe("R'T0 = 1 → LD(AR), x2 (PC).");
  });

  it('describes the AC circuit and SC clear at D1T5', () => {
    const sim = example1();
    for (let i = 0; i < 5; i++) sim.step();
    const v = viewPulse(sim.step());
    expect(v.steps[1].text[0]).toBe('D1T5 = 1 → LD(AC), ADD, LD(E), CLR(SC).');
    expect(v.steps[2].text).toContain('S2S1S0 = 000: no source drives the bus.');
    expect(v.steps[2].text.join(' ')).toContain('produces 000A, E input 0');
  });

  it('marks r for register-reference instructions', () => {
    const sim = new Simulator();
    sim.load([[0, 0x7020]], 0);
    for (let i = 0; i < 3; i++) sim.step();
    const v = viewPulse(sim.step());
    expect(v.steps[0].text[2]).toContain("r = D7I'T3");
    expect(v.steps[1].text).toContain('rB5 = 1 → INR(AC).');
  });
});
