import { toBin, toHex } from '../bits';
import { pick, type Lang } from '../i18n';
import { AC_OP_LABEL, AC_OP_LABEL_TR } from './adderLogic';
import { evaluateControl, termLabel, type EquationValue } from './controlLogic';
import { fieldOpcode } from './isa';
import type { PulseTrace } from './pulse';
import { REG_WIDTH, type MachineState, type RegName } from './types';

/**
 * One clock pulse split into the order in which its signals settle in the hardware:
 * 1. timing and decode: SC drives the 4×16 decoder (T0…T15) and IR(12-14) the 3×8 decoder (D0…D7);
 * 2. control gates: the AND/OR gates of Sec. 5-10 raise the control inputs;
 * 3. data flow: the bus encoder selects a source, values travel on the bus and through the
 *    adder and logic circuit to the inputs of the registers;
 * 4. clock edge: every enabled register and flip-flop latches at the same instant.
 * Steps 1-3 happen between two clock edges; nothing is stored until step 4.
 */
export type MicroStepKind = 'decode' | 'control' | 'transfer' | 'latch';

export const MICRO_STEP_KINDS: MicroStepKind[] = ['decode', 'control', 'transfer', 'latch'];

export const MICRO_STEP_TITLE: Record<MicroStepKind, string> = {
  decode: 'Timing and decode',
  control: 'Control gates',
  transfer: 'Data flow',
  latch: 'Clock edge',
};

export interface ActiveGate {
  /** Equation id, e.g. "DR.LD". */
  output: string;
  /** Output name as in the book, e.g. "LD(DR)". */
  name: string;
  /** Labels of the AND terms that are 1, e.g. ["D1T4"]. */
  terms: string[];
}

export interface PulseView {
  trace: PulseTrace;
  T: number;
  D: number;
  /** Every control gate evaluated on the pre-pulse state. */
  gates: Record<string, EquationValue>;
  active: ActiveGate[];
  steps: { kind: MicroStepKind; title: string; text: string[] }[];
}

const hex = (v: number, w: number) => toHex(v, w);

export const MICRO_STEP_TITLE_TR: Record<MicroStepKind, string> = {
  decode: 'Zamanlama ve çözme',
  control: 'Kontrol kapıları',
  transfer: 'Veri akışı',
  latch: 'Saat kenarı',
};

/** Title of a sub-step in a language. */
export const microStepTitle = (k: MicroStepKind, lang: Lang = 'en') => (lang === 'tr' ? MICRO_STEP_TITLE_TR[k] : MICRO_STEP_TITLE[k]);

/** Builds the four sub-steps of a pulse from its trace. */
export function viewPulse(trace: PulseTrace, mem?: Uint16Array, lang: Lang = 'en'): PulseView {
  const L = (en: string, tr: string) => pick(lang, en, tr);
  const pre = { ...trace.before, mem: mem ?? new Uint16Array(4096) } as MachineState;
  const T = pre.SC;
  const D = fieldOpcode(pre.reg.IR);
  const gates = evaluateControl(pre);
  const active: ActiveGate[] = Object.values(gates)
    .filter((g) => g.out)
    .map((g) => ({
      output: g.equation.id,
      name: g.equation.name,
      terms: g.equation.terms.filter((_, i) => g.terms[i]).map(termLabel),
    }));

  if (trace.signals.phase === 'halted') {
    return {
      trace,
      T,
      D,
      gates,
      active: [],
      steps: [
        {
          kind: 'decode',
          title: L('Halted', 'Durdu'),
          text: [L('S = 0: the clock is stopped, so no timing signal advances.', 'S = 0: saat durdu, bu yüzden hiçbir zamanlama sinyali ilerlemiyor.')],
        },
      ],
    };
  }

  const { I, R } = pre.flag;
  const decode = [
    L(`SC = ${toBin(T, 4)} → the 4 × 16 decoder raises T${T}.`, `SC = ${toBin(T, 4)} → 4 × 16 kod çözücü T${T}'yı 1 yapar.`),
    L(
      `IR(12-14) = ${toBin(D, 3)} → the 3 × 8 decoder raises D${D}. I = ${I}, R = ${R}.`,
      `IR(12-14) = ${toBin(D, 3)} → 3 × 8 kod çözücü D${D}'yi 1 yapar. I = ${I}, R = ${R}.`,
    ),
  ];
  if (D === 7 && T === 3)
    decode.push(
      I
        ? L('D7 and I with T3 form p = D7IT3 (input-output).', 'D7, I ve T3 birlikte p = D7IT3 olur (giriş-çıkış).')
        : L("D7, I' and T3 form r = D7I'T3 (register-reference).", "D7, I' ve T3 birlikte r = D7I'T3 olur (yazmaç başvurulu)."),
    );

  // Group active gates by their product term so the text reads "D1T4 → LD(DR), Read, x7".
  const byTerm = new Map<string, string[]>();
  for (const g of active) for (const term of g.terms) byTerm.set(term, [...(byTerm.get(term) ?? []), g.name]);
  const control = byTerm.size
    ? [...byTerm].map(([term, outs]) => `${term} = 1 → ${outs.join(', ')}.`)
    : [L('No control gate is 1 in this pulse; only SC counts up.', 'Bu darbede hiçbir kontrol kapısı 1 değil; yalnızca SC sayar.')];
  if (!gates['SC.CLR'].out) control.push(L('CLR(SC) is 0, so SC will count up.', 'CLR(SC) 0, bu yüzden SC bir artacak.'));

  const transfer: string[] = [];
  const c = trace.signals;
  if (trace.busValue !== null) {
    const x = c.busSelect;
    const width = trace.busSource === 'Memory' ? 16 : REG_WIDTH[trace.busSource as RegName];
    const v = hex(trace.busValue, width);
    const addr = hex(pre.reg.AR, 12);
    transfer.push(
      trace.busSource === 'Memory'
        ? L(
            `x${x} = 1 → the bus encoder sets S2S1S0 = ${toBin(x, 3)}; memory places M[AR] = M[${addr}] = ${v} on the bus.`,
            `x${x} = 1 → yol kodlayıcısı S2S1S0 = ${toBin(x, 3)} yapar; bellek M[AR] = M[${addr}] = ${v} değerini ortak yola koyar.`,
          )
        : L(
            `x${x} = 1 → the bus encoder sets S2S1S0 = ${toBin(x, 3)}; ${trace.busSource} places its value = ${v} on the bus.`,
            `x${x} = 1 → yol kodlayıcısı S2S1S0 = ${toBin(x, 3)} yapar; ${trace.busSource} değerini (${v}) ortak yola koyar.`,
          ),
    );
    const takers = (['AR', 'PC', 'DR', 'IR', 'TR', 'OUTR'] as RegName[]).filter((r) => c.reg[r].ld);
    if (takers.length)
      transfer.push(L(`The bus value waits at the inputs of ${takers.join(', ')} (LD = 1).`, `Ortak yoldaki değer ${takers.join(', ')} girişlerinde bekler (LD = 1).`));
    if (c.memWrite)
      transfer.push(
        L(`Memory Write = 1: the bus value waits to be written at M[${addr}].`, `Bellek Write = 1: ortak yoldaki değer M[${addr}] adresine yazılmayı bekler.`),
      );
  } else {
    transfer.push(L('S2S1S0 = 000: no source drives the bus.', 'S2S1S0 = 000: ortak yolu hiçbir kaynak sürmüyor.'));
  }
  for (const p of trace.acPaths) {
    const e = p.e !== undefined ? L(`, E input ${p.e}`, `, E girişi ${p.e}`) : '';
    transfer.push(
      L(
        `Adder and logic circuit (${AC_OP_LABEL[p.op]}) produces ${hex(p.ac, 16)}${e} at the inputs of AC.`,
        `Toplayıcı ve mantık devresi (${AC_OP_LABEL_TR[p.op]}) AC'nin girişlerinde ${hex(p.ac, 16)} üretir${e}.`,
      ),
    );
  }
  const incs = (Object.keys(c.reg) as RegName[]).filter((r) => c.reg[r].inr).map((r) => `INR(${r})`);
  const clrs = (Object.keys(c.reg) as RegName[]).filter((r) => c.reg[r].clr).map((r) => `CLR(${r})`);
  if (incs.length || clrs.length) {
    const list = [...incs, ...clrs].join(', ');
    transfer.push(L(`${list} are ready for the clock edge.`, `${list} saat kenarı için hazır.`));
  }

  const latch = trace.changes.map((ch) => {
    const w = ch.name in REG_WIDTH ? REG_WIDTH[ch.name as RegName] : 0;
    return w ? `${ch.name} ← ${hex(ch.after, w)} (${L('was', 'önceden')} ${hex(ch.before, w)})` : `${ch.name} ← ${ch.after}`;
  });
  for (const m of trace.memory) latch.push(`M[${hex(m.address, 12)}] ← ${hex(m.after, 16)}`);
  const latchText = latch.length
    ? [L(`On the clock edge, at the same instant: ${latch.join(', ')}.`, `Saat kenarında, aynı anda: ${latch.join(', ')}.`)]
    : [L('The clock edge stores nothing new.', 'Saat kenarı yeni bir şey saklamaz.')];

  return {
    trace,
    T,
    D,
    gates,
    active,
    steps: [
      { kind: 'decode', title: microStepTitle('decode', lang), text: decode },
      { kind: 'control', title: microStepTitle('control', lang), text: control },
      { kind: 'transfer', title: microStepTitle('transfer', lang), text: transfer },
      { kind: 'latch', title: microStepTitle('latch', lang), text: latchText },
    ],
  };
}
