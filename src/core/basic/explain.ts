import type { PulseTrace } from './pulse';

/** Plain-language explanation of each Table 5-6 line, for a beginner. Keyed by `RtlLine.id`. */
const EXPLAIN: Record<string, string> = {
  'fetch-T0':
    'Fetch begins. The address of the next instruction is in PC, but memory reads its address only from AR, so PC is copied to AR over the bus.',
  'fetch-T1':
    'Memory is read at the address in AR and the instruction word is loaded into IR. At the same time PC is incremented so that it points to the next instruction.',
  'decode-T2':
    'Decode: the operation decoder looks at IR(12-14) and activates one of D0…D7. The address part IR(0-11) goes to AR, and the mode bit IR(15) goes to I.',
  indirect:
    'Indirect addressing (I = 1): the word in memory at AR is not the operand, it is the address of the operand. Memory is read and that effective address is loaded into AR.',
  direct:
    'Direct addressing (I = 0): AR already holds the effective address, so nothing happens at T3. SC just advances to T4.',
  'AND-T4': 'The operand is read from memory into DR, because the AC logic circuit takes its second input from DR.',
  'AND-T5': 'AC is ANDed bit by bit with DR. The instruction is done, so SC is cleared to start the next fetch.',
  'ADD-T4': 'The operand is read from memory into DR, because the adder takes its second input from DR.',
  'ADD-T5':
    'The adder computes AC + DR. The 16-bit sum goes to AC and the carry out goes to E. SC is cleared: the instruction is complete.',
  'LDA-T4': 'The word to load is read from memory into DR. AC cannot be loaded from the bus directly; it is loaded through the adder and logic circuit.',
  'LDA-T5': 'DR is transferred to AC through the adder and logic circuit. SC is cleared: the instruction is complete.',
  'STA-T4': 'AC is placed on the bus and written into memory at the address in AR. SC is cleared: the instruction is complete.',
  'BUN-T4': 'Branch: the effective address in AR is loaded into PC, so the next fetch comes from there. SC is cleared.',
  'BSA-T4':
    'Branch and save: the return address (PC, which already points past BSA) is stored in memory at the effective address, and AR is incremented to the first instruction of the subroutine.',
  'BSA-T5': 'PC gets the subroutine start address from AR. SC is cleared: the subroutine begins with the next fetch.',
  'ISZ-T4': 'The memory word is read into DR so it can be incremented.',
  'ISZ-T5': 'DR is incremented. Memory itself cannot count, so the word is incremented in DR.',
  'ISZ-T6':
    'The incremented word is written back to memory. If it became zero, PC is incremented to skip the next instruction. SC is cleared.',
  r: 'Register-reference instruction (D7 = 1, I = 0). It needs no operand from memory, so it completes in T3; SC is cleared.',
  CLA: 'AC is cleared to 0.',
  CLE: 'The E flip-flop is cleared to 0.',
  CMA: 'Every bit of AC is complemented.',
  CME: 'The E flip-flop is complemented.',
  CIR: 'AC and E are circulated right as one 17-bit ring: E enters AC(15), and AC(0) goes to E.',
  CIL: 'AC and E are circulated left as one 17-bit ring: E enters AC(0), and AC(15) goes to E.',
  INC: 'AC is incremented by one (the carry out of AC is lost; E does not change).',
  SPA: 'If AC is positive (sign bit AC(15) = 0), PC is incremented to skip the next instruction.',
  SNA: 'If AC is negative (sign bit AC(15) = 1), PC is incremented to skip the next instruction.',
  SZA: 'If AC is zero, PC is incremented to skip the next instruction.',
  SZE: 'If E is 0, PC is incremented to skip the next instruction.',
  HLT: 'The start-stop flip-flop S is cleared, which stops the clock. The computer halts.',
  p: 'Input-output instruction (D7 = 1, I = 1). It completes in T3; SC is cleared.',
  INP: 'The character in INPR goes into the low byte of AC, and FGI is cleared so the keyboard can deliver the next character.',
  OUT: 'The low byte of AC is placed on the bus and loaded into OUTR for the printer. FGO is cleared until the printer is ready again.',
  SKI: 'If a new character is waiting (FGI = 1), PC is incremented to skip the next instruction.',
  SKO: 'If the printer is ready (FGO = 1), PC is incremented to skip the next instruction.',
  ION: 'Interrupts are enabled (IEN ← 1).',
  IOF: 'Interrupts are disabled (IEN ← 0).',
  'int-request':
    'Interrupts are enabled and a device flag is set, so R is set. The current instruction finishes normally; the next cycle will be an interrupt cycle instead of a fetch.',
  'int-T0': 'Interrupt cycle: AR is cleared to 0 (where the return address will be saved) and PC is copied to TR.',
  'int-T1': 'The return address in TR is written to memory location 0, and PC is cleared.',
  'int-T2':
    'PC is incremented to 1, the start of the interrupt service routine. IEN and R are cleared so the routine is not interrupted again, and SC is cleared.',
};

export const explainLine = (id: string): string | undefined => EXPLAIN[id];

/** The "What happened?" text of a pulse: one paragraph per executed line, plus notices. */
export function explainPulse(trace: PulseTrace): string[] {
  if (trace.signals.phase === 'halted') return ['The computer is halted (S = 0). Press Run or Reset to start it again.'];
  const parts = trace.signals.lines.map((l) => EXPLAIN[l.id]).filter((t): t is string => !!t);
  return [...parts, ...trace.notices];
}
