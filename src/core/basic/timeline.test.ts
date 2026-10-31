import { describe, expect, it } from 'vitest';
import { Simulator } from './simulator';

const program: [number, number][] = [
  [0x100, 0x2104],
  [0x101, 0x1105],
  [0x102, 0x3106],
  [0x103, 0x7001],
  [0x104, 0x0053],
  [0x105, 0xffe9],
];

const snap = (s: Simulator) => ({ reg: { ...s.state.reg }, flag: { ...s.state.flag }, SC: s.state.SC, mem: Array.from(s.state.mem.slice(0x100, 0x108)), pulses: s.pulses, hist: s.history.length });

describe('timeline, redo and seek', () => {
  it('keeps one trace per pulse', () => {
    const sim = new Simulator();
    sim.load(program, 0x100);
    sim.run();
    expect(sim.timeline).toHaveLength(sim.pulses);
    expect(sim.timeline[0].signals.lines[0].control).toBe("R'T0");
  });

  it('seeks back and forward to identical states, including edits and key presses', () => {
    const sim = new Simulator();
    sim.load(program, 0x100);
    for (let i = 0; i < 5; i++) sim.step();
    sim.setRegister('TR', 0x1234);
    sim.pressKey('A');
    for (let i = 0; i < 7; i++) sim.step();
    const end = snap(sim);
    const atFive = (() => {
      sim.seek(5);
      return snap(sim);
    })();
    expect(atFive.pulses).toBe(5);
    expect(atFive.reg.TR).toBe(0x1234);
    expect(atFive.reg.INPR).toBe(0x41);
    sim.seek(0);
    expect(sim.pulses).toBe(0);
    expect(sim.timeline).toHaveLength(0);
    expect(sim.latestPulse).toBe(12);
    sim.seek(12);
    expect(snap(sim)).toEqual(end);
    expect(sim.timeline).toHaveLength(12);
  });

  it('a new step after seeking back discards the undone future', () => {
    const sim = new Simulator();
    sim.load(program, 0x100);
    for (let i = 0; i < 6; i++) sim.step();
    sim.seek(2);
    expect(sim.canRedo).toBe(true);
    sim.setRegister('AC', 7);
    expect(sim.canRedo).toBe(false);
    expect(sim.latestPulse).toBe(2);
  });

  it('caps the timeline', () => {
    const sim = new Simulator({ timelineLimit: 10 });
    sim.load([[0, 0x4000]], 0);
    for (let i = 0; i < 25; i++) sim.step();
    expect(sim.timeline).toHaveLength(10);
    expect(sim.timelineStart).toBe(15);
  });
});
