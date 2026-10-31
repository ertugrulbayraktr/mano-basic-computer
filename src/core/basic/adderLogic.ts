import type { Bit } from '../bits';
import type { AcOp } from './control';

/** Output of one adder-and-logic input path for AC (Fig. 5-21). `e` is the value for E, if any. */
export interface AcPathResult {
  op: AcOp;
  ac: number;
  e?: Bit;
}

/**
 * The adder and logic circuit that feeds AC (Fig. 5-21). Its inputs are AC, DR, INPR and E;
 * E receives the carry of the adder or the bit shifted out by a circulate.
 */
export function adderLogicPath(op: AcOp, AC: number, DR: number, INPR: number, E: Bit): AcPathResult {
  switch (op) {
    case 'AND':
      return { op, ac: AC & DR };
    case 'ADD': {
      const sum = AC + DR;
      return { op, ac: sum & 0xffff, e: (sum >>> 16) as Bit };
    }
    case 'DR':
      return { op, ac: DR };
    case 'INPR':
      // AC(0-7) ← INPR; the high byte of AC is not changed.
      return { op, ac: (AC & 0xff00) | (INPR & 0xff) };
    case 'COM':
      return { op, ac: ~AC & 0xffff };
    case 'SHR':
      return { op, ac: (AC >>> 1) | (E << 15), e: (AC & 1) as Bit };
    case 'SHL':
      return { op, ac: ((AC << 1) & 0xffff) | E, e: ((AC >>> 15) & 1) as Bit };
  }
}

export const AC_OP_LABEL: Record<AcOp, string> = {
  AND: 'AND (AC ∧ DR)',
  ADD: 'ADD (AC + DR)',
  DR: 'Transfer DR',
  INPR: 'Transfer INPR',
  COM: "Complement (AC')",
  SHR: 'Shift right (with E)',
  SHL: 'Shift left (with E)',
};

export const AC_OP_LABEL_TR: Record<AcOp, string> = {
  AND: 'AND (AC ∧ DR)',
  ADD: 'ADD (AC + DR)',
  DR: 'DR aktarımı',
  INPR: 'INPR aktarımı',
  COM: "Tümleme (AC')",
  SHR: 'Sağa kaydır (E ile)',
  SHL: 'Sola kaydır (E ile)',
};
