import { bitAt, toBin, type Bit } from '../bits';
import { pick, type Lang } from '../i18n';
import { fullAdder } from '../blocks/adders';
import { alu, type AluUnit } from './alu';
import { ySource, type ArithmeticEncoding, type YSource } from './arithmetic';

/**
 * Signals inside every stage of the ALU of Fig. 4-13, and the order in which they settle.
 * Stage i has an arithmetic part (a 4×1 MUX choosing Y_i, and a full adder), a logic part
 * (AND, OR, XOR, NOT gates and a 4×1 MUX) and an output 4×1 MUX selected by S3S2.
 */

export interface AluStage {
  i: number;
  a: Bit;
  b: Bit;
  /** The four MUX inputs for Y_i in select order, e.g. [0, B, B', 1] for Table 4-8. */
  yInputs: { source: YSource; value: Bit }[];
  y: Bit;
  cin: Bit;
  d: Bit;
  cout: Bit;
  gates: { and: Bit; or: Bit; xor: Bit; not: Bit };
  e: Bit;
  /** Input of the output MUX for shr (A_{i+1}, 0 at the MSB) and shl (A_{i-1}, 0 at the LSB). */
  shr: Bit;
  shl: Bit;
  f: Bit;
}

export type AluStepKind = 'inputs' | 'y' | 'carry' | 'logic' | 'output' | 'status';

export interface AluStep {
  kind: AluStepKind;
  /** For 'carry': the stage whose full adder settles in this step. */
  stage?: number;
  title: string;
  text: string[];
}

export interface AluCircuit {
  width: number;
  select: number;
  cin: Bit;
  unit: AluUnit;
  operation: string;
  stages: AluStage[];
  f: number;
  status: { c: Bit; s: Bit; z: Bit; v: Bit };
  carryMeaningful: boolean;
  steps: AluStep[];
}

const UNIT_NAME: Record<AluUnit, string> = { arithmetic: 'arithmetic result D', logic: 'logic result E', shr: 'A shifted right', shl: 'A shifted left' };
const UNIT_NAME_TR: Record<AluUnit, string> = { arithmetic: 'aritmetik sonucu D\'yi', logic: 'mantık sonucu E\'yi', shr: 'sağa kaydırılmış A\'yı', shl: 'sola kaydırılmış A\'yı' };

export function aluCircuit(
  a: number,
  b: number,
  select: number,
  cin: Bit,
  width: number,
  enc: ArithmeticEncoding = 'table4-8',
  lang: Lang = 'en',
): AluCircuit {
  const s1s0 = select & 3;
  const s3s2 = (select >> 2) & 3;
  const whole = alu(a, b, select, cin, width, enc);
  const stages: AluStage[] = [];
  let carry = cin;
  for (let i = 0; i < width; i++) {
    const ai = bitAt(a, i);
    const bi = bitAt(b, i);
    const yInputs = [0, 1, 2, 3].map((s) => {
      const source = ySource(s, enc);
      const value = (source === 'B' ? bi : source === "B'" ? bi ^ 1 : source === '0' ? 0 : 1) as Bit;
      return { source, value };
    });
    const y = yInputs[s1s0].value;
    const fa = fullAdder(ai, y, carry);
    const gates = { and: (ai & bi) as Bit, or: (ai | bi) as Bit, xor: (ai ^ bi) as Bit, not: (ai ^ 1) as Bit };
    const e = [gates.and, gates.or, gates.xor, gates.not][s1s0];
    const shr = i === width - 1 ? 0 : bitAt(a, i + 1);
    const shl = i === 0 ? 0 : bitAt(a, i - 1);
    const f = [fa.s, e, shr, shl][s3s2] as Bit;
    stages.push({ i, a: ai, b: bi, yInputs, y, cin: carry, d: fa.s, cout: fa.c, gates, e, shr, shl, f });
    carry = fa.c;
  }

  const sel = toBin(select, 4);
  const yName = stages[0].yInputs[s1s0].source;
  const L = (en: string, tr: string) => pick(lang, en, tr);
  const yWord = toBin(stages.reduce((v, s) => v | (s.y << s.i), 0), width);
  const eWord = toBin(stages.reduce((v, s) => v | (s.e << s.i), 0), width);
  const yExtra = yName === 'B' || yName === "B'" ? '' : yName === '0' ? L(' (all 0s)', ' (hepsi 0)') : L(' (all 1s)', ' (hepsi 1)');
  const steps: AluStep[] = [
    {
      kind: 'inputs',
      title: L('Inputs and select lines', 'Girişler ve seçim hatları'),
      text: [
        `A = ${toBin(a, width)}, B = ${toBin(b, width)}, Cin = ${cin}.`,
        L(
          `S3S2S1S0 = ${sel}: every stage receives the same select lines. S1S0 = ${toBin(s1s0, 2)} goes to the Y multiplexers and the logic multiplexers; S3S2 = ${toBin(s3s2, 2)} to the output multiplexers.`,
          `S3S2S1S0 = ${sel}: her kat aynı seçim hatlarını alır. S1S0 = ${toBin(s1s0, 2)} Y çoklayıcılarına ve mantık çoklayıcılarına, S3S2 = ${toBin(s3s2, 2)} çıkış çoklayıcılarına gider.`,
        ),
      ],
    },
    {
      kind: 'y',
      title: L('Y multiplexers', 'Y çoklayıcıları'),
      text: [
        L(
          `S1S0 = ${toBin(s1s0, 2)} selects input ${s1s0} of each 4×1 MUX: Y = ${yName}${yExtra} = ${yWord}.`,
          `S1S0 = ${toBin(s1s0, 2)} her 4×1 MUX'un ${s1s0}. girişini seçer: Y = ${yName}${yExtra} = ${yWord}.`,
        ),
      ],
    },
    ...stages.map((s) => ({
      kind: 'carry' as const,
      stage: s.i,
      title: L(`Full adder ${s.i}`, `Tam toplayıcı ${s.i}`),
      text: [
        L(
          `Stage ${s.i}: A${s.i} + Y${s.i} + C${s.i} = ${s.a} + ${s.y} + ${s.cin} → D${s.i} = ${s.d}, carry C${s.i + 1} = ${s.cout}.`,
          `Kat ${s.i}: A${s.i} + Y${s.i} + C${s.i} = ${s.a} + ${s.y} + ${s.cin} → D${s.i} = ${s.d}, elde C${s.i + 1} = ${s.cout}.`,
        ),
        s.i < width - 1
          ? L(`C${s.i + 1} ripples to stage ${s.i + 1}; it cannot finish before this carry arrives.`, `C${s.i + 1} kat ${s.i + 1}'e yayılır; o kat bu elde gelmeden bitemez.`)
          : L(`C${width} is the output carry.`, `C${width} çıkış eldesidir.`),
      ],
    })),
    {
      kind: 'logic',
      title: L('Logic stage', 'Mantık katı'),
      text: [
        L(
          `The AND, OR, XOR and NOT gates work on A and B in parallel with the adder; S1S0 = ${toBin(s1s0, 2)} lets the ${['AND', 'OR', 'XOR', 'NOT'][s1s0]} output through: E = ${eWord}.`,
          `AND, OR, XOR ve NOT kapıları toplayıcıyla paralel olarak A ve B üzerinde çalışır; S1S0 = ${toBin(s1s0, 2)} ${['AND', 'OR', 'XOR', 'NOT'][s1s0]} çıkışını geçirir: E = ${eWord}.`,
        ),
      ],
    },
    {
      kind: 'output',
      title: L('Output multiplexers', 'Çıkış çoklayıcıları'),
      text: [
        L(
          `S3S2 = ${toBin(s3s2, 2)} selects the ${UNIT_NAME[whole.unit]} in every stage: F = ${toBin(whole.f, width)}.`,
          `S3S2 = ${toBin(s3s2, 2)} her katta ${UNIT_NAME_TR[whole.unit]} seçer: F = ${toBin(whole.f, width)}.`,
        ),
        `${whole.operation}.`,
      ],
    },
    {
      kind: 'status',
      title: L('Status bits', 'Durum bitleri'),
      text: [
        `C = C${width} = ${whole.status.c}, S = F${width - 1} = ${whole.status.s}, Z = ${whole.status.z} (${
          whole.status.z ? L('all output bits are 0', 'tüm çıkış bitleri 0') : L('some output bit is 1', 'en az bir çıkış biti 1')
        }), V = C${width - 1} ⊕ C${width} = ${whole.status.v}.`,
        whole.unit === 'arithmetic'
          ? L('C matters for unsigned numbers, V for signed numbers.', 'İşaretsiz sayılar için C, işaretli sayılar için V önemlidir.')
          : L('C and V are meaningless after a logic or shift operation.', 'Mantık ya da kaydırma işleminden sonra C ve V anlamsızdır.'),
      ],
    },
  ];

  return {
    width,
    select,
    cin,
    unit: whole.unit,
    operation: whole.operation,
    stages,
    f: whole.f,
    status: whole.status,
    carryMeaningful: whole.carryMeaningful,
    steps,
  };
}

export interface AluLaneValue {
  id: 'Y' | 'C' | 'D' | 'E' | 'F' | 'CSZV';
  label: string;
  /** Bits MSB first; '·' marks a bit that has not settled yet at that step. */
  value: string;
}

/**
 * The words inside the ALU as they look after `step` of the propagation: which bits of Y, the
 * carries C(n)…C(1), D, E, F and the status bits have settled. Used by the propagation timeline.
 */
export function aluSnapshot(c: AluCircuit, step: number): AluLaneValue[] {
  const n = c.width;
  const word = (bit: (s: AluStage) => Bit, settled: (s: AluStage) => boolean) =>
    [...c.stages].reverse().map((s) => (settled(s) ? String(bit(s)) : '·')).join('');
  const faDone = (i: number) => step >= 2 + i;
  return [
    { id: 'Y', label: 'Y', value: word((s) => s.y, () => step >= 1) },
    { id: 'C', label: `C${n}…C1`, value: word((s) => s.cout, (s) => faDone(s.i)) },
    { id: 'D', label: 'D', value: word((s) => s.d, (s) => faDone(s.i)) },
    { id: 'E', label: 'E', value: word((s) => s.e, () => step >= 2 + n) },
    { id: 'F', label: 'F', value: word((s) => s.f, () => step >= 3 + n) },
    {
      id: 'CSZV',
      label: 'C S Z V',
      value: step >= 4 + n ? `${c.status.c}${c.status.s}${c.status.z}${c.status.v}` : '····',
    },
  ];
}
