import { describe, expect, it } from 'vitest';
import { Simulator } from '../basic/simulator';
import { ASM_EXAMPLES } from '../programs/asmExamples';
import { assemble } from './assembler';

const src = (id: string) => ASM_EXAMPLES.find((e) => e.id === id)!;

function boot(id: string): { sim: Simulator; symbols: Map<string, number> } {
  const ex = src(id);
  const r = assemble(ex.source);
  expect(r.errors).toEqual([]);
  const sim = new Simulator({ printerDelay: 5 });
  sim.load(r.words, r.start);
  Object.assign(sim.state.flag, ex.flag);
  return { sim, symbols: r.symbols };
}

describe('assembler', () => {
  it('assembles example 7 with the expected codes, symbols and listing', () => {
    const r = assemble(src('asm-add').source);
    expect(r.ok).toBe(true);
    expect(r.start).toBe(0x100);
    expect([...r.words]).toEqual([
      [0x100, 0x2104],
      [0x101, 0x1105],
      [0x102, 0x3106],
      [0x103, 0x7001],
      [0x104, 0x0053],
      [0x105, 0xffe9],
      [0x106, 0x0000],
    ]);
    expect(Object.fromEntries(r.symbols)).toEqual({ A: 0x104, B: 0x105, C: 0x106 });
    expect(r.listing[1]).toMatchObject({ line: 2, address: 0x100, code: 0x2104 });
    expect(r.listing[0].address).toBeUndefined();
  });

  it('handles indirect addressing, hex addresses and every mnemonic', () => {
    const r = assemble(
      [' ORG 10', ' ADD 300 I', ' BUN 135 I', ' AND X', ' CLA', ' CLE', ' CMA', ' CME', ' CIR', ' CIL', ' INC', ' SPA', ' SNA', ' SZA', ' SZE', ' HLT', ' INP', ' OUT', ' SKI', ' SKO', ' ION', ' IOF', 'X, hex ffff', ' END'].join('\n'),
    );
    expect(r.errors).toEqual([]);
    expect([...r.words.values()]).toEqual([
      0x9300, 0xc135, 0x0025, 0x7800, 0x7400, 0x7200, 0x7100, 0x7080, 0x7040, 0x7020, 0x7010, 0x7008, 0x7004, 0x7002, 0x7001, 0xf800, 0xf400, 0xf200, 0xf100,
      0xf080, 0xf040, 0xffff,
    ]);
  });

  it('a defined label wins over a hex reading of the same token', () => {
    const r = assemble(' ORG 0\n LDA A\nA, DEC 1\n END');
    expect(r.words.get(0)).toBe(0x2001);
  });

  it('reports clear errors with line numbers', () => {
    const r = assemble(
      [' ORG 100', ' LDA NOPE', 'LONG, HEX 1', '1AB, HEX 1', ' FOO', ' CLA 5', ' DEC 70000', ' HEX XYZ', 'A, HEX 1', 'A, HEX 2', ' ADD', ' ADD A J', 'AND, HEX 0', ' END'].join('\n'),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13]);
    expect(r.errors[0].message).toMatch(/Undefined symbol "NOPE"/);
    expect(r.errors[1].message).toMatch(/Invalid label "LONG"/);
    expect(r.errors[3].message).toMatch(/Unknown instruction "FOO"/);
    expect(r.errors[7].message).toMatch(/defined more than once/);
    expect(r.errors[10].message).toMatch(/reserved/);
  });

  it('warns when END is missing and ignores lines after END', () => {
    expect(assemble(' ORG 0\n CLA').warnings[0].message).toMatch(/No END/);
    const r = assemble(' ORG 0\n CLA\n END\n garbage here');
    expect(r.errors).toEqual([]);
    expect(r.words.size).toBe(1);
  });

  it('accepts lower case and comments everywhere', () => {
    const r = assemble('/ only a comment\n  org 20 / start\nlop, inc\n  bun lop\n  end');
    expect(r.errors).toEqual([]);
    expect(r.words.get(0x21)).toBe(0x4020);
  });
});

describe('assembly example programs run to the expected results', () => {
  it('7 add two numbers: C = 60', () => {
    const { sim, symbols } = boot('asm-add');
    expect(sim.run()).toBe('halted');
    expect(sim.state.mem[symbols.get('C')!]).toBe(0x003c);
  });

  it('8 subtraction with CMA, INC, ADD: 83 − 23 = 60', () => {
    const { sim, symbols } = boot('asm-sub');
    expect(sim.run()).toBe('halted');
    expect(sim.state.mem[symbols.get('DIF')!]).toBe(60);
  });

  it('9 OR with De Morgan', () => {
    const { sim, symbols } = boot('asm-or');
    expect(sim.run()).toBe('halted');
    expect(sim.state.mem[symbols.get('C')!]).toBe(0x0f0f | 0x00ff);
  });

  it('10 echoes typed characters to the printer', () => {
    const { sim } = boot('asm-io');
    expect(sim.run(200)).toBe('limit');
    expect(sim.pressKey('H')).toBe(true);
    sim.run(200);
    expect(sim.pressKey('i')).toBe(true);
    sim.run(200);
    expect(sim.devices.printed).toBe('Hi');
    expect(sim.state.flag.FGI).toBe(0);
  });

  it('11 interrupt: saves the return address at 0, services the key at 1 and returns', () => {
    const { sim, symbols } = boot('asm-interrupt');
    sim.run(100);
    expect(sim.state.flag.IEN).toBe(1);
    sim.pressKey('A');
    // Run until the interrupt cycle starts.
    while (!sim.state.flag.R) sim.step();
    const interruptedAt = sim.history.at(-1)!;
    sim.stepInstruction(); // the rest of the current instruction
    const cycle = sim.stepInstruction();
    expect(cycle.map((t) => t.signals.lines[0].control)).toEqual(['RT0', 'RT1', 'RT2']);
    expect(sim.state.reg.PC).toBe(1);
    const saved = sim.state.mem[0];
    expect([0x101, 0x102]).toContain(saved);
    expect(sim.history.at(-1)!.kind).toBe('interrupt');
    expect(interruptedAt.kind).toBe('instruction');

    // Run until the service routine returns to the main loop.
    let guard = 0;
    while (sim.state.reg.PC !== saved && guard++ < 500) sim.stepInstruction();
    expect(sim.state.reg.PC).toBe(saved);
    expect(sim.state.mem[0x200]).toBe(0x41);
    expect(sim.state.mem[symbols.get('PTR')!]).toBe(0x201);
    expect(sim.state.flag.IEN).toBe(1);
    expect(sim.history.some((h) => h.text === 'BUN 000 I')).toBe(true);
  });
});

describe('example texts', () => {
  it('name the addresses the assembler really gives their symbols', () => {
    for (const ex of ASM_EXAMPLES) {
      const symbols = assemble(ex.source).symbols;
      for (const m of `${ex.expect} ${ex.expectTr}`.matchAll(/([A-Z]{1,3}) \((?:address|adres) ([0-9A-F]{3})\)/g)) {
        expect(symbols.get(m[1]), `${ex.id}: ${m[0]}`).toBe(parseInt(m[2], 16));
      }
    }
  });
});
