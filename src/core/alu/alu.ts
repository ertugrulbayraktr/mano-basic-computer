import { bitAt, trunc, type Bit } from '../bits';
import { arithmeticCircuit, type ArithmeticEncoding } from './arithmetic';
import { logicCircuit } from './logic';
import { shiftMicro } from './shift';

export type AluUnit = 'arithmetic' | 'logic' | 'shr' | 'shl';

const UNITS: AluUnit[] = ['arithmetic', 'logic', 'shr', 'shl'];

export interface StatusBits {
  /** Carry out of the last stage. */
  c: Bit;
  /** Sign: the most significant bit of the output. */
  s: Bit;
  /** Zero: NOR of all output bits. */
  z: Bit;
  /** Overflow: XOR of the last two carries. */
  v: Bit;
}

/**
 * Status bits of Fig. 8-8. C and V come from the carry chain; they are only meaningful
 * after an arithmetic operation.
 */
export function statusBits(f: number, carries: readonly Bit[], width: number): StatusBits {
  return {
    c: carries[width],
    s: bitAt(f, width - 1),
    z: (trunc(f, width) === 0 ? 1 : 0) as Bit,
    v: (carries[width - 1] ^ carries[width]) as Bit,
  };
}

/**
 * Arithmetic logic shift unit (Fig. 4-13, Table 4-8): every stage has an arithmetic and a logic
 * part, and an output 4×1 MUX selected by S3S2 (00 arithmetic, 01 logic, 10 shr, 11 shl).
 * All candidate results are returned so the unselected ones can be shown too.
 * `select` is S3S2S1S0 as a 4-bit number.
 */
export function alu(
  a: number,
  b: number,
  select: number,
  cin: Bit,
  width: number,
  enc: ArithmeticEncoding = 'table4-8',
) {
  const s3s2 = (select >> 2) & 3;
  const s1s0 = select & 3;
  const arithmetic = arithmeticCircuit(a, b, s1s0, cin, width, enc);
  const logic = logicCircuit(a, b, s1s0, width);
  const shr = shiftMicro('shr', a, width).value;
  const shl = shiftMicro('shl', a, width).value;
  const unit = UNITS[s3s2];
  const f = [arithmetic.d, logic.e, shr, shl][s3s2];
  const status = statusBits(f, arithmetic.carries, width);
  const operation =
    unit === 'arithmetic'
      ? arithmetic.microoperation.replace('D =', 'F =')
      : unit === 'logic'
        ? logic.microoperation.replace('E =', 'F =')
        : `F = ${unit} A`;
  return {
    f,
    unit,
    operation,
    candidates: { arithmetic: arithmetic.d, logic: logic.e, shr, shl },
    arithmetic,
    logic,
    status,
    carryMeaningful: unit === 'arithmetic',
  };
}

/** All rows of Table 4-8 for the given arithmetic encoding. Logic and shift rows ignore Cin. */
export function aluTable(enc: ArithmeticEncoding = 'table4-8') {
  const rows: { select: number; cin: Bit | null; operation: string }[] = [];
  for (let s1s0 = 0; s1s0 < 4; s1s0++)
    for (const cin of [0, 1] as Bit[])
      rows.push({ select: s1s0, cin, operation: alu(0, 0, s1s0, cin, 4, enc).operation });
  for (let select = 4; select < 8; select++)
    rows.push({ select, cin: null, operation: alu(0, 0, select, 0, 4, enc).operation });
  rows.push({ select: 8, cin: null, operation: 'F = shr A' });
  rows.push({ select: 12, cin: null, operation: 'F = shl A' });
  return rows;
}
