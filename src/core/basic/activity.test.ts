import { describe, expect, it } from 'vitest';
import { activeElements, instructionXray, usage } from './activity';
import { Simulator } from './simulator';
import { initialState } from './types';
import { DEFAULT_LANES, instructionBand, LANE_BY_ID } from './waveforms';

function example1() {
  const sim = new Simulator();
  sim.load(
    [
      [0x020, 0x1205],
      [0x021, 0x7001],
      [0x205, 0x0003],
    ],
    0x020,
  );
  sim.state.reg.AC = 7;
  return sim;
}

describe('activity', () => {
  it('names what D1T4 uses', () => {
    const sim = example1();
    for (let i = 0; i < 4; i++) sim.step();
    const e = activeElements(sim.step());
    for (const id of ['T4', 'D1', 'gate:D1T4', 'pin:DR.LD', 'pin:MEM.READ', 'pin:x7', 'bus', 'src:Memory', 'dst:DR', 'mem:read', 'reg:DR', 'reg:SC'])
      expect(e.has(id), id).toBe(true);
    expect(e.has('mem:write')).toBe(false);
    expect(e.has('src:AC')).toBe(false);
  });

  it('x-ray of a direct ADD covers fetch, decode and execute without changing the machine', () => {
    const sim = example1();
    const before = sim.state.reg.PC;
    const x = instructionXray(sim.state, 0x020);
    expect(x.pulses.map((p) => p[0].control)).toEqual(["R'T0", "R'T1", "R'T2", "D7'I'T3", 'D1T4', 'D1T5']);
    for (const id of ['gate:D1T4', 'gate:D1T5', 'alu:ADD', 'src:PC', 'src:IR', 'dst:AR', 'dst:IR']) expect(x.elements.has(id), id).toBe(true);
    expect(sim.state.reg.PC).toBe(before);
    expect(sim.pulses).toBe(0);
  });

  it('x-ray of STA, indirect ADD, BSA, register-reference and I/O words', () => {
    const s = initialState();
    s.mem[0x10] = 0x3200; // STA 200
    s.mem[0x11] = 0x9300; // ADD 300 I
    s.mem[0x12] = 0x5135; // BSA 135
    s.mem[0x13] = 0x7020; // INC
    s.mem[0x14] = 0xf400; // OUT
    expect(instructionXray(s, 0x10).elements.has('mem:write')).toBe(true);
    expect(instructionXray(s, 0x11).pulses[3][0].control).toBe("D7'IT3");
    const bsa = instructionXray(s, 0x12);
    expect(bsa.elements.has('pin:AR.INR')).toBe(true);
    expect(bsa.elements.has('pin:PC.LD')).toBe(true);
    const inc = instructionXray(s, 0x13);
    expect(inc.pulses).toHaveLength(4);
    expect(inc.elements.has('pin:AC.INR')).toBe(true);
    expect(instructionXray(s, 0x14).elements.has('dst:OUTR')).toBe(true);
  });

  it('counts usage over the timeline', () => {
    const sim = example1();
    sim.run();
    const u = usage(sim.timeline);
    expect(u.get('T0')).toBe(2);
    expect(u.get('gate:D1T4')).toBe(1);
    expect(u.get('bus')).toBeGreaterThan(3);
  });
});

describe('waveforms', () => {
  it('lanes read example 1 like a timing diagram', () => {
    const sim = example1();
    sim.stepInstruction();
    const tl = sim.timeline;
    const row = (id: string) => tl.map((t) => (LANE_BY_ID[id].bit ? (LANE_BY_ID[id].bit!(t) ? 1 : 0) : LANE_BY_ID[id].value!(t)));
    expect(row('T0')).toEqual([1, 0, 0, 0, 0, 0]);
    expect(row('T4')).toEqual([0, 0, 0, 0, 1, 0]);
    expect(row('pin:MEM.READ')).toEqual([0, 1, 0, 0, 1, 0]);
    expect(row('pin:DR.LD')).toEqual([0, 0, 0, 0, 1, 0]);
    expect(row('pin:SC.CLR')).toEqual([0, 0, 0, 0, 0, 1]);
    expect(row('bus')).toEqual(['PC 0020', 'M 1205', 'IR 1205', null, 'M 0003', null]);
    expect(row('SC')).toEqual(['0', '1', '2', '3', '4', '5']);
    expect(DEFAULT_LANES.every((id) => LANE_BY_ID[id])).toBe(true);
  });

  it('builds the instruction band', () => {
    const sim = example1();
    sim.run();
    expect(instructionBand(sim.history, sim.pulses)).toEqual([
      { from: 0, to: 5, text: 'ADD 205', kind: 'instruction' },
      { from: 6, to: 9, text: 'HLT', kind: 'instruction' },
    ]);
  });
});
