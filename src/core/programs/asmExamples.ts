import type { Bit } from '../bits';
import type { FlagName } from '../basic/types';

/** Assembly-language example programs (spec examples 7-11). */
export interface AsmExample {
  id: string;
  title: string;
  reference: string;
  source: string;
  /** Flip-flop values different from reset, applied after loading. */
  flag?: Partial<Record<FlagName, Bit>>;
  expect: string;
}

export const ASM_EXAMPLES: AsmExample[] = [
  {
    id: 'asm-add',
    title: '7. Add two numbers',
    reference: 'Sec. 6-2',
    source: `        ORG 100
        LDA A       / load first operand into AC
        ADD B       / add second operand to AC
        STA C       / store the sum in C
        HLT         / halt the computer
A,      DEC 83      / first operand
B,      DEC -23     / second operand
C,      DEC 0       / the sum goes here
        END
`,
    expect: 'C (address 106) = 003C, decimal 60.',
  },
  {
    id: 'asm-sub',
    title: '8. Subtract two numbers',
    reference: 'Sec. 6-4',
    source: `        ORG 100
        LDA SUB     / load the subtrahend
        CMA         / complement it
        INC         / and add 1: AC = -SUB in 2's complement
        ADD MIN     / add the minuend
        STA DIF     / store the difference
        HLT
MIN,    DEC 83      / minuend
SUB,    DEC 23      / subtrahend
DIF,    HEX 0       / the difference goes here
        END
`,
    expect: 'DIF (address 108) = 003C, decimal 60.',
  },
  {
    id: 'asm-or',
    title: '9. OR with De Morgan',
    reference: 'Sec. 6-4',
    source: `/ The Basic Computer has AND but no OR.
/ De Morgan: A OR B = (A' AND B')'
        ORG 100
        LDA A       / AC <- A
        CMA         / AC <- A'
        STA TMP     / keep A'
        LDA B       / AC <- B
        CMA         / AC <- B'
        AND TMP     / AC <- A' AND B'
        CMA         / AC <- (A' AND B')' = A OR B
        STA C
        HLT
A,      HEX 0F0F
B,      HEX 00FF
TMP,    HEX 0
C,      HEX 0
        END
`,
    expect: 'C (address 10C) = 0FFF = 0F0F OR 00FF.',
  },
  {
    id: 'asm-io',
    title: '10. Echo input to output',
    reference: 'Sec. 6-8',
    source: `/ Program-controlled I/O: wait for a key,
/ then wait for the printer and print it.
        ORG 100
CIF,    SKI         / is a character available (FGI = 1)?
        BUN CIF     / no: keep checking
        INP         / yes: AC(0-7) <- INPR, FGI <- 0
COF,    SKO         / is the printer ready (FGO = 1)?
        BUN COF     / no: keep checking
        OUT         / yes: OUTR <- AC(0-7), FGO <- 0
        BUN CIF     / go back for the next character
        END
`,
    expect: 'Run it, then type in the keyboard box: every character appears on the printer. It never halts; press Pause.',
  },
  {
    id: 'asm-interrupt',
    title: '11. Interrupt-driven input',
    reference: 'Fig. 5-13, Sec. 6-8',
    source: `/ The main program counts in AC forever.
/ A key press interrupts it; the service routine
/ stores the character in a buffer at 200 and returns.
        ORG 100
        ION         / enable interrupts
LOP,    INC         / main program: count
        BUN LOP

        ORG 0
ZRO,    HEX 0       / the interrupt cycle saves PC here
        BUN SRV     / M[1]: go to the service routine
SRV,    STA SAC     / save AC
        CIR         / move E into AC(15)
        STA SE      / save E
        SKI         / is it the keyboard?
        BUN EXT     / no
        CLA
        INP         / read the character, FGI <- 0
        STA PTR I   / store it in the buffer
        ISZ PTR     / advance the buffer pointer
EXT,    LDA SE      / restore E
        CIL
        LDA SAC     / restore AC
        ION         / enable interrupts again
        BUN ZRO I   / return to the interrupted program
SAC,    HEX 0
SE,     HEX 0
PTR,    HEX 200     / buffer pointer
        END
`,
    flag: { FGO: 0 },
    expect:
      'Run it and type a key. At the end of the current instruction R = 1; the interrupt cycle saves PC in M[0] and jumps to 1. The character is stored at 200, 201, … FGO starts at 0 (no printer attached) so only the keyboard interrupts.',
  },
];
