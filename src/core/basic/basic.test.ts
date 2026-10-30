import { describe, expect, it } from 'vitest';
import type { Bit } from '../bits';
import { disassemble } from './disasm';
import { explainPulse } from './explain';
import { Simulator } from './simulator';
import type { FlagName, RegName } from './types';

interface Setup {
  mem?: Record<number, number>;
  reg?: Partial<Record<RegName, number>>;
  flag?: Partial<Record<FlagName, Bit>>;
}

function machine({ mem = {}, reg = {}, flag = {} }: Setup, printerDelay = 3): Simulator {
  const sim = new Simulator({ printerDelay });
  sim.load(
    Object.entries(mem).map(([a, v]) => [Number(a), v] as const),
    reg.PC ?? 0,
  );
  Object.assign(sim.state.reg, reg);
  Object.assign(sim.state.flag, flag);
  return sim;
}

describe('example 1: direct ADD, pulse by pulse', () => {
  it('follows Table 5-6 from T0 to T5', () => {
    const sim = machine({ mem: { 0x020: 0x1205, 0x205: 0x0003 }, reg: { PC: 0x020, AC: 0x0007 }, flag: { E: 0 } });
    const s = () => sim.state;

    let t = sim.step();
    expect(t.signals.T).toBe(0);
    expect(t.signals.lines[0]).toMatchObject({ control: "R'T0", statement: 'AR ← PC' });
    expect(t.busSource).toBe('PC');
    expect(t.signals.busSelect).toBe(0b010);
    expect(t.busValue).toBe(0x020);
    expect(s().reg.AR).toBe(0x020);

    t = sim.step();
    expect(t.signals.lines[0].statement).toBe('IR ← M[AR], PC ← PC + 1');
    expect(t.busSource).toBe('Memory');
    expect(t.signals.memRead).toBe(true);
    expect(s().reg.IR).toBe(0x1205);
    expect(s().reg.PC).toBe(0x021);

    t = sim.step();
    expect(t.signals.lines[0].control).toBe("R'T2");
    expect(t.busSource).toBe('IR');
    expect(s().reg.AR).toBe(0x205);
    expect(s().flag.I).toBe(0);

    t = sim.step();
    expect(t.signals.D).toBe(1);
    expect(t.signals.lines[0]).toMatchObject({ control: "D7'I'T3", statement: 'Nothing' });
    expect(t.changes).toEqual([{ name: 'SC', before: 3, after: 4 }]);

    t = sim.step();
    expect(t.signals.lines[0]).toMatchObject({ control: 'D1T4', statement: 'DR ← M[AR]' });
    expect(s().reg.DR).toBe(0x0003);

    t = sim.step();
    expect(t.signals.lines[0]).toMatchObject({ control: 'D1T5', statement: 'AC ← AC + DR, E ← Cout, SC ← 0' });
    expect(t.busSource).toBe('none');
    expect(t.busValue).toBeNull();
    expect(s().reg).toMatchObject({ AC: 0x000a, PC: 0x021, DR: 0x0003 });
    expect(s().flag.E).toBe(0);
    expect(s().SC).toBe(0);
    expect(sim.pulses).toBe(6);
  });
});

describe('spec example programs 2-6', () => {
  it('example 2: indirect ADD', () => {
    const sim = machine({
      mem: { 0x021: 0x9300, 0x300: 0x0450, 0x450: 0xffff },
      reg: { PC: 0x021, AC: 0x000a },
    });
    sim.step();
    sim.step();
    sim.step();
    const t3 = sim.step();
    expect(t3.signals.lines[0]).toMatchObject({ control: "D7'IT3", statement: 'AR ← M[AR]' });
    expect(sim.state.reg.AR).toBe(0x450);
    sim.stepInstruction();
    expect(sim.state.reg.AC).toBe(0x0009);
    expect(sim.state.flag.E).toBe(1);
  });

  it('example 3: indirect LDA', () => {
    const sim = machine({ mem: { 0x021: 0xa300, 0x300: 0x0450, 0x450: 0x1234 }, reg: { PC: 0x021 } });
    sim.stepInstruction();
    expect(sim.state.reg.AC).toBe(0x1234);
  });

  it('example 4: register-reference INC completes at T3', () => {
    const sim = machine({ mem: { 0x022: 0x7020 }, reg: { PC: 0x022, AC: 0x0009 } });
    const traces = sim.stepInstruction();
    expect(traces).toHaveLength(4);
    expect(traces[3].signals.lines.map((l) => l.control)).toEqual(["D7I'T3 = r", 'rB5']);
    expect(sim.state.reg.AC).toBe(0x000a);
    expect(sim.state.SC).toBe(0);
  });

  it('example 5: BSA subroutine call and return', () => {
    const sim = machine({ mem: { 0x020: 0x5135, 0x135: 0x0000, 0x136: 0xc135 }, reg: { PC: 0x020 } });
    const t = sim.stepInstruction();
    expect(t.map((x) => x.signals.lines[0].control).slice(4)).toEqual(['D5T4', 'D5T5']);
    expect(sim.state.mem[0x135]).toBe(0x021);
    expect(sim.state.reg.PC).toBe(0x136);
    sim.stepInstruction(); // BUN 135 I
    expect(sim.state.reg.PC).toBe(0x021);
  });

  it('example 6: ISZ loop counter skips on zero', () => {
    const sim = machine({
      mem: { 0x010: 0x60a0, 0x011: 0x60a0, 0x012: 0x7001, 0x0a0: 0xfffe },
      reg: { PC: 0x010 },
    });
    const t = sim.stepInstruction();
    expect(t).toHaveLength(7);
    expect(sim.state.mem[0x0a0]).toBe(0xffff);
    expect(sim.state.reg.PC).toBe(0x011);
    sim.stepInstruction();
    expect(sim.state.mem[0x0a0]).toBe(0x0000);
    expect(sim.state.reg.PC).toBe(0x013);
  });
});

describe('memory-reference instructions at pulse granularity', () => {
  /** Runs fetch + decode + T3, then returns the traces of the execute pulses. */
  function execute(word: number, setup: Setup) {
    const sim = machine({ ...setup, mem: { 0x100: word, ...setup.mem }, reg: { PC: 0x100, ...setup.reg } });
    const traces = sim.stepInstruction().slice(4);
    return { sim, traces, controls: traces.map((t) => t.signals.lines[0].control) };
  }

  it('AND: D0T4, D0T5', () => {
    const { sim, controls } = execute(0x0200, { mem: { 0x200: 0x0ff0 }, reg: { AC: 0x3c3c } });
    expect(controls).toEqual(['D0T4', 'D0T5']);
    expect(sim.state.reg.AC).toBe(0x0c30);
  });

  it('ADD: carry goes to E', () => {
    const { sim, traces } = execute(0x1200, { mem: { 0x200: 0x8001 }, reg: { AC: 0x8001 } });
    expect(traces[1].acPaths).toEqual([{ op: 'ADD', ac: 0x0002, e: 1 }]);
    expect(sim.state.reg.AC).toBe(0x0002);
    expect(sim.state.flag.E).toBe(1);
  });

  it('LDA: D2T4, D2T5', () => {
    const { sim, controls } = execute(0x2200, { mem: { 0x200: 0xbeef } });
    expect(controls).toEqual(['D2T4', 'D2T5']);
    expect(sim.state.reg.AC).toBe(0xbeef);
  });

  it('STA: D3T4 writes AC through the bus', () => {
    const { sim, traces } = execute(0x3200, { reg: { AC: 0x1234 } });
    expect(traces).toHaveLength(1);
    expect(traces[0].busSource).toBe('AC');
    expect(traces[0].signals.memWrite).toBe(true);
    expect(traces[0].memory).toEqual([{ address: 0x200, before: 0, after: 0x1234 }]);
    expect(sim.state.mem[0x200]).toBe(0x1234);
  });

  it('BUN: D4T4 loads PC from AR', () => {
    const { sim, traces } = execute(0x4abc, {});
    expect(traces[0].busSource).toBe('AR');
    expect(sim.state.reg.PC).toBe(0xabc);
  });

  it('BSA: M[AR] ← PC and AR ← AR + 1 use pre-pulse values', () => {
    const { sim, traces } = execute(0x5200, {});
    expect(traces[0].busSource).toBe('PC');
    expect(traces[0].memory[0]).toMatchObject({ address: 0x200, after: 0x101 });
    expect(sim.state.reg.AR).toBe(0x201);
    expect(sim.state.reg.PC).toBe(0x201);
  });

  it('ISZ: D6T4, D6T5, D6T6 without skip', () => {
    const { sim, controls } = execute(0x6200, { mem: { 0x200: 0x0005 } });
    expect(controls).toEqual(['D6T4', 'D6T5', 'D6T6']);
    expect(sim.state.mem[0x200]).toBe(0x0006);
    expect(sim.state.reg.PC).toBe(0x101);
  });

  it('an indirect STA stores at the effective address', () => {
    const { sim } = execute(0xb200, { mem: { 0x200: 0x0300 }, reg: { AC: 0x00ff } });
    expect(sim.state.mem[0x300]).toBe(0x00ff);
  });
});

describe('register-reference instructions', () => {
  const run = (word: number, setup: Setup = {}) => {
    const sim = machine({ ...setup, mem: { 0x100: word }, reg: { PC: 0x100, ...setup.reg } });
    const traces = sim.stepInstruction();
    return { s: sim.state, t3: traces[3] };
  };

  it('CLA, CLE, CMA, CME', () => {
    expect(run(0x7800, { reg: { AC: 0x1234 } }).s.reg.AC).toBe(0);
    expect(run(0x7400, { flag: { E: 1 } }).s.flag.E).toBe(0);
    expect(run(0x7200, { reg: { AC: 0x00ff } }).s.reg.AC).toBe(0xff00);
    expect(run(0x7100, { flag: { E: 0 } }).s.flag.E).toBe(1);
  });

  it('CIR and CIL circulate through E', () => {
    const cir = run(0x7080, { reg: { AC: 0x0003 }, flag: { E: 0 } }).s;
    expect(cir.reg.AC).toBe(0x0001);
    expect(cir.flag.E).toBe(1);
    const cir2 = run(0x7080, { reg: { AC: 0x0002 }, flag: { E: 1 } }).s;
    expect(cir2.reg.AC).toBe(0x8001);
    expect(cir2.flag.E).toBe(0);
    const cil = run(0x7040, { reg: { AC: 0x8000 }, flag: { E: 1 } }).s;
    expect(cil.reg.AC).toBe(0x0001);
    expect(cil.flag.E).toBe(1);
  });

  it('INC wraps and leaves E unchanged', () => {
    const s = run(0x7020, { reg: { AC: 0xffff }, flag: { E: 0 } }).s;
    expect(s.reg.AC).toBe(0);
    expect(s.flag.E).toBe(0);
  });

  it.each([
    ['SPA', 0x7010, { reg: { AC: 0x0001 } }, true],
    ['SPA', 0x7010, { reg: { AC: 0x8000 } }, false],
    ['SNA', 0x7008, { reg: { AC: 0x8000 } }, true],
    ['SNA', 0x7008, { reg: { AC: 0x0000 } }, false],
    ['SZA', 0x7004, { reg: { AC: 0x0000 } }, true],
    ['SZA', 0x7004, { reg: { AC: 0x0001 } }, false],
    ['SZE', 0x7002, { flag: { E: 0 } }, true],
    ['SZE', 0x7002, { flag: { E: 1 } }, false],
  ] as [string, number, Setup, boolean][])('%s (word %s) skip=%s', (_m, word, setup, skip) => {
    expect(run(word, setup).s.reg.PC).toBe(skip ? 0x102 : 0x101);
  });

  it('HLT clears S and further pulses do nothing', () => {
    const sim = machine({ mem: { 0x100: 0x7001 }, reg: { PC: 0x100 } });
    sim.stepInstruction();
    expect(sim.halted).toBe(true);
    const t = sim.step();
    expect(t.signals.phase).toBe('halted');
    expect(sim.pulses).toBe(4);
    expect(sim.run()).toBe('halted');
  });

  it('executes every selected bit in the same T3 and shows a notice', () => {
    const { s, t3 } = run(0x7c00, { reg: { AC: 0x1234 }, flag: { E: 1 } }); // CLA CLE
    expect(s.reg.AC).toBe(0);
    expect(s.flag.E).toBe(0);
    expect(t3.signals.lines.map((l) => l.control)).toEqual(["D7I'T3 = r", 'rB11', 'rB10']);
    expect(t3.notices.join(' ')).toMatch(/2 operation bits set \(CLA, CLE\)/);
  });

  it('ORs the AC circuit outputs when several AC inputs are enabled (CMA + CIR)', () => {
    const { s, t3 } = run(0x7280, { reg: { AC: 0x0002 }, flag: { E: 0 } });
    expect(s.reg.AC).toBe(0xfffd | 0x0001);
    expect(t3.notices.some((n) => n.includes('ORed'))).toBe(true);
  });
});

describe('input-output instructions', () => {
  const run = (word: number, setup: Setup = {}) => {
    const sim = machine({ ...setup, mem: { 0x100: word }, reg: { PC: 0x100, ...setup.reg } });
    sim.stepInstruction();
    return sim;
  };

  it('INP loads AC(0-7) from INPR and clears FGI', () => {
    const s = run(0xf800, { reg: { AC: 0xab00, INPR: 0x41 }, flag: { FGI: 1 } }).state;
    expect(s.reg.AC).toBe(0xab41);
    expect(s.flag.FGI).toBe(0);
  });

  it('OUT loads OUTR from AC(0-7), clears FGO and prints', () => {
    const sim = run(0xf400, { reg: { AC: 0x1248 } });
    expect(sim.state.reg.OUTR).toBe(0x48);
    expect(sim.state.flag.FGO).toBe(0);
    expect(sim.devices.printed).toBe('H');
    expect(sim.lastTrace?.busSource).toBe('AC');
  });

  it('SKI and SKO skip on their flags', () => {
    expect(run(0xf200, { flag: { FGI: 1 } }).state.reg.PC).toBe(0x102);
    expect(run(0xf200, { flag: { FGI: 0 } }).state.reg.PC).toBe(0x101);
    expect(run(0xf100, { flag: { FGO: 1 } }).state.reg.PC).toBe(0x102);
    expect(run(0xf100, { flag: { FGO: 0 } }).state.reg.PC).toBe(0x101);
  });

  it('ION and IOF set and clear IEN', () => {
    expect(run(0xf080).state.flag.IEN).toBe(1);
    expect(run(0xf040, { flag: { IEN: 1 } }).state.flag.IEN).toBe(0);
  });
});

describe('devices', () => {
  it('keyboard sets INPR and FGI only when FGI = 0', () => {
    const sim = new Simulator();
    expect(sim.pressKey('A')).toBe(true);
    expect(sim.state.reg.INPR).toBe(0x41);
    expect(sim.state.flag.FGI).toBe(1);
    expect(sim.pressKey('B')).toBe(false);
    expect(sim.state.reg.INPR).toBe(0x41);
  });

  it('printer sets FGO back to 1 after the configured delay', () => {
    const sim = machine({ mem: { 0x100: 0xf400, 0x101: 0x4101 }, reg: { PC: 0x100, AC: 0x41 } }, 3);
    sim.stepInstruction();
    expect(sim.state.flag.FGO).toBe(0);
    sim.step();
    sim.step();
    expect(sim.state.flag.FGO).toBe(0);
    const t = sim.step();
    expect(sim.state.flag.FGO).toBe(1);
    expect(t.changes).toContainEqual({ name: 'FGO', before: 0, after: 1 });
  });
});

describe('interrupt cycle (Fig. 5-13)', () => {
  it('sets R during execution, saves the return address at 0 and jumps to 1', () => {
    const sim = machine({
      mem: { 0x100: 0x7020, 0x101: 0x7020 },
      reg: { PC: 0x100 },
      flag: { IEN: 1, FGI: 0, FGO: 0 },
    });
    sim.step();
    sim.step();
    sim.step();
    sim.pressKey('x');
    const t3 = sim.step();
    expect(t3.signals.lines.map((l) => l.control)).toContain("T0'T1'T2'(IEN)(FGI + FGO)");
    expect(sim.state.flag.R).toBe(1);
    expect(sim.state.reg.AC).toBe(1);

    const cycle = sim.stepInstruction();
    expect(cycle.map((t) => t.signals.lines[0].control)).toEqual(['RT0', 'RT1', 'RT2']);
    expect(cycle[0].busSource).toBe('PC');
    expect(cycle[1].busSource).toBe('TR');
    expect(sim.state.mem[0]).toBe(0x101);
    expect(sim.state.reg.PC).toBe(0x001);
    expect(sim.state.flag).toMatchObject({ IEN: 0, R: 0 });
    expect(sim.history.map((h) => h.text)).toEqual(['INC', 'Interrupt cycle']);
  });

  it('lets a memory-reference instruction finish after R is set at T3', () => {
    // BUN 105 at 100: R is set at T3 (IEN = 1, FGI = 1), and D4T4 must still load PC.
    const sim = machine({ mem: { 0x100: 0x4105 }, reg: { PC: 0x100 }, flag: { IEN: 1, FGI: 1 } });
    const traces = sim.stepInstruction();
    expect(traces.map((t) => t.signals.lines[0].control)).toEqual(["R'T0", "R'T1", "R'T2", "D7'I'T3", 'D4T4']);
    expect(sim.state.flag.R).toBe(1);
    expect(sim.state.reg.PC).toBe(0x105);
    const cycle = sim.stepInstruction();
    expect(cycle.map((t) => t.signals.lines[0].control)).toEqual(['RT0', 'RT1', 'RT2']);
    expect(sim.state.mem[0]).toBe(0x105);
  });

  it('does not request an interrupt during T0-T2 or while IEN = 0', () => {
    const sim = machine({ mem: { 0x100: 0x7020 }, reg: { PC: 0x100 }, flag: { IEN: 0, FGI: 1 } });
    sim.stepInstruction();
    expect(sim.state.flag.R).toBe(0);
    const sim2 = machine({ mem: { 0x100: 0x7020 }, reg: { PC: 0x100 }, flag: { IEN: 1, FGI: 1 } });
    for (let i = 0; i < 3; i++) {
      sim2.step();
      expect(sim2.state.flag.R).toBe(0);
    }
  });
});

describe('simulator controls', () => {
  const program = { 0x100: 0x2104, 0x101: 0x1105, 0x102: 0x3106, 0x103: 0x7001, 0x104: 0x0053, 0x105: 0xffe9, 0x106: 0 };

  it('runs until HLT', () => {
    const sim = machine({ mem: program, reg: { PC: 0x100 } });
    expect(sim.run()).toBe('halted');
    expect(sim.state.mem[0x106]).toBe(0x003c);
    expect(sim.history.map((h) => h.text)).toEqual(['LDA 104', 'ADD 105', 'STA 106', 'HLT']);
  });

  it('steps back through every pulse to the exact start state', () => {
    const sim = machine({ mem: program, reg: { PC: 0x100 } });
    const start = structuredClone({ reg: sim.state.reg, flag: sim.state.flag, mem: Array.from(sim.state.mem) });
    sim.run();
    while (sim.stepBack());
    expect({ reg: sim.state.reg, flag: sim.state.flag, mem: Array.from(sim.state.mem) }).toEqual(start);
    expect(sim.pulses).toBe(0);
    expect(sim.history).toEqual([]);
  });

  it('undoes edits and key presses', () => {
    const sim = new Simulator();
    sim.setMemory(5, 0x1234);
    sim.setRegister('AC', 0x1ffff);
    expect(sim.state.reg.AC).toBe(0xffff);
    sim.pressKey('A');
    sim.stepBack();
    expect(sim.state.flag.FGI).toBe(0);
    sim.stepBack();
    sim.stepBack();
    expect(sim.state.mem[5]).toBe(0);
    expect(sim.state.reg.AC).toBe(0);
  });

  it('stops at a breakpoint before fetching that address, and continues past it', () => {
    const sim = machine({ mem: program, reg: { PC: 0x100 } });
    sim.breakpoints.add(0x102);
    expect(sim.run()).toBe('breakpoint');
    expect(sim.state.reg.PC).toBe(0x102);
    expect(sim.state.SC).toBe(0);
    expect(sim.run()).toBe('halted');
  });
});

describe('disassembler', () => {
  it('formats memory-reference, register-reference and I/O words', () => {
    expect(disassemble(0x1205).text).toBe('ADD 205');
    expect(disassemble(0x9300).text).toBe('ADD 300 I');
    expect(disassemble(0x7020).text).toBe('INC');
    expect(disassemble(0xf800).text).toBe('INP');
    expect(disassemble(0x7c00).text).toBe('CLA CLE');
    expect(disassemble(0x7000)).toMatchObject({ text: 'HEX 7000', valid: false });
    expect(disassemble(0xf001)).toMatchObject({ valid: false });
    expect(disassemble(0xc135).text).toBe('BUN 135 I');
  });
});

describe('explanations', () => {
  it('has a plain-language text for every pulse of an instruction', () => {
    const sim = machine({ mem: { 0x020: 0x1205, 0x205: 3 }, reg: { PC: 0x20 } });
    for (const t of sim.stepInstruction()) expect(explainPulse(t).length).toBeGreaterThan(0);
  });
});
