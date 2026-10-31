import { useState } from 'react';
import { bitAt, complement, type Bit } from '../../../core/bits';
import { alu, aluTable } from '../../../core/alu/alu';
import { adderSubtractor, arithmeticCircuit, arithmeticTable, incrementer } from '../../../core/alu/arithmetic';
import { LOGIC_FUNCTIONS, LOGIC_OPS, logicApplications, logicCircuit, logicFunction } from '../../../core/alu/logic';
import { combinationalShifter, SHIFT_OPS, shiftMicro } from '../../../core/alu/shift';
import { BlockHeader, Candidate, CarryChain, Flag, Interpret, useWord, WidthSelect } from '../../common/blocks';
import { BitInput, BitToggle, Panel, Ref, Word } from '../../common/controls';
import { useSettings } from '../../settings';

const bin = (v: number, n: number) => v.toString(2).padStart(n, '0');

/** Fig. 4-7 */
export function AdderSubtractorBlock() {
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b0110, n);
  const [b, setB] = useWord(0b0011, n);
  const [m, setM] = useState<Bit>(0);
  const r = adderSubtractor(a, b, m, n);
  return (
    <>
      <BlockHeader title="Adder-subtractor" refs="Fig. 4-7" right={<WidthSelect />}>
        M = 0 adds A + B. M = 1 subtracts: each B bit goes through an XOR gate with M, giving B', and M also enters as C0, so the circuit computes A + B' + 1 = A − B in 2's complement.
      </BlockHeader>
      <Panel title="Inputs">
        <div className="row">
          <div>
            <BitInput label="A" value={a} width={n} onChange={setA} />
            <Interpret value={a} width={n} />
          </div>
          <div>
            <BitInput label="B" value={b} width={n} onChange={setB} />
            <Interpret value={b} width={n} />
          </div>
          <BitToggle label="M (mode)" value={m} onChange={setM} />
        </div>
      </Panel>
      <Panel title={`Full-adder chain, B ⊕ M = ${bin(r.bIn, n)}`} refs={<Ref>Fig. 4-7</Ref>}>
        <CarryChain width={n} rows={[{ label: 'A', value: a }, { label: 'B⊕M', value: r.bIn }]} carries={r.carries} outLabel="S" out={r.sum} stageLabel="FA" />
      </Panel>
      <Panel title="Result and the flag that matters">
        <div className="row" style={{ alignItems: 'center' }}>
          <span className="result">
            {m ? 'A − B' : 'A + B'} = <Word value={r.sum} width={n} />
          </span>
          <Flag name={`C${n}`} v={r.c} note="Carry out" />
          <Flag name="V" v={r.v} note={`V = C${n - 1} ⊕ C${n}`} />
        </div>
        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="sig" style={{ border: '1px solid var(--line-soft)', borderRadius: 4, padding: 12 }}>
            <span className="cap">Unsigned interpretation: watch C{n}</span>
            <p style={{ margin: '6px 0 0' }}>
              {m
                ? `C${n} = ${r.c}: ${r.c ? 'A ≥ B, no borrow; the result is correct.' : 'A < B; the unsigned result wrapped around (borrow).'}`
                : `C${n} = ${r.c}: ${r.c ? 'the sum does not fit in ' + n + ' bits (carry out).' : 'the sum fits; the result is correct.'}`}
            </p>
          </div>
          <div className="sig" style={{ border: '1px solid var(--line-soft)', borderRadius: 4, padding: 12 }}>
            <span className="cap">Signed (2's complement) interpretation: watch V</span>
            <p style={{ margin: '6px 0 0' }}>
              V = C{n - 1} ⊕ C{n} = {r.carries[n - 1]} ⊕ {r.carries[n]} = {r.v}: {r.v ? 'overflow, the signed result is wrong.' : 'no overflow, the signed result is correct.'}
            </p>
          </div>
        </div>
      </Panel>
    </>
  );
}

/** Fig. 4-8 */
export function IncrementerBlock() {
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b0111, n);
  const r = incrementer(a, n);
  return (
    <>
      <BlockHeader title="Binary incrementer" refs="Fig. 4-8" right={<WidthSelect />}>
        A chain of half adders. A constant 1 enters the first one; each carry becomes the second input of the next half adder.
      </BlockHeader>
      <Panel title="Input">
        <BitInput label="A" value={a} width={n} onChange={setA} />
      </Panel>
      <Panel title="Half-adder chain">
        <CarryChain width={n} rows={[{ label: 'A', value: a }]} carries={r.carries} outLabel="S" out={r.sum} stageLabel="HA" />
        <div className="row" style={{ marginTop: 12, alignItems: 'center' }}>
          <span className="result">
            A + 1 = <Word value={r.sum} width={n} />
          </span>
          <Flag name={`C${n}`} v={r.cout} note="Carry out" />
        </div>
      </Panel>
    </>
  );
}

/** Fig. 4-9, Table 4-4 */
export function ArithmeticBlock() {
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b0110, n);
  const [b, setB] = useWord(0b0011, n);
  const [s, setS] = useState(0);
  const [cin, setCin] = useState<Bit>(0);
  const r = arithmeticCircuit(a, b, s, cin, n, 'fig4-9');
  const rows = arithmeticTable('fig4-9');
  return (
    <>
      <BlockHeader title="Arithmetic circuit" refs="Fig. 4-9, Table 4-4" right={<WidthSelect />}>
        D = A + Y + Cin. A 4×1 MUX in every stage selects Y: S1S0 = 00 → B, 01 → B', 10 → 0, 11 → all 1s. With Cin this gives the eight microoperations of Table 4-4.
      </BlockHeader>
      <Panel title="Inputs">
        <div className="row">
          <BitInput label="A" value={a} width={n} onChange={setA} />
          <BitInput label="B" value={b} width={n} onChange={setB} />
          <BitInput label="S1 S0" value={s} width={2} onChange={setS} names={['S0', 'S1']} />
          <BitToggle label="Cin" value={cin} onChange={setCin} />
        </div>
      </Panel>
      <Panel title={`MUX output Y = ${r.y} = ${bin(r.yValue, n)}`}>
        <CarryChain width={n} rows={[{ label: 'A', value: a }, { label: 'Y', value: r.yValue }]} carries={r.carries} outLabel="D" out={r.d} stageLabel="FA" />
        <p className="result" style={{ margin: '12px 0 0' }}>
          {r.microoperation} = <Word value={r.d} width={n} />{' '}
          <span className="muted" style={{ fontSize: 14, fontFamily: 'var(--sans)' }}>
            ({r.name})
          </span>
        </p>
      </Panel>
      <Panel title="Arithmetic circuit function table" refs={<Ref>Table 4-4</Ref>}>
        <div className="scroll-x">
          <table className="data" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>S1</th>
                <th>S0</th>
                <th>Cin</th>
                <th>Y</th>
                <th>Output</th>
                <th>Microoperation</th>
                <th>Result here</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.s1s0}${row.cin}`} className={row.s1s0 === s && row.cin === cin ? 'hit' : ''} onClick={() => { setS(row.s1s0); setCin(row.cin); }} style={{ cursor: 'pointer' }}>
                  <td>{row.s1s0 >> 1}</td>
                  <td>{row.s1s0 & 1}</td>
                  <td>{row.cin}</td>
                  <td>{row.y}</td>
                  <td>{row.microoperation}</td>
                  <td style={{ fontFamily: 'var(--sans)' }}>{row.name}</td>
                  <td>
                    <Word value={arithmeticCircuit(a, b, row.s1s0, row.cin, n, 'fig4-9').d} width={n} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/** Fig. 4-10 */
export function LogicBlock() {
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b1010, n);
  const [b, setB] = useWord(0b1100, n);
  const [s, setS] = useState(0);
  const r = logicCircuit(a, b, s, n);
  return (
    <>
      <BlockHeader title="Logic circuit" refs="Fig. 4-10" right={<WidthSelect />}>
        One stage has four gates (AND, OR, XOR, NOT A) whose outputs go into a 4×1 MUX. S1S0 picks which one reaches the output E.
      </BlockHeader>
      <Panel title="Inputs">
        <div className="row">
          <BitInput label="A" value={a} width={n} onChange={setA} />
          <BitInput label="B" value={b} width={n} onChange={setB} />
          <BitInput label="S1 S0" value={s} width={2} onChange={setS} names={['S0', 'S1']} />
        </div>
      </Panel>
      <Panel title="All four gates compute; the MUX passes one">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {LOGIC_OPS.map((op, i) => (
            <Candidate key={op.op} title={`S1S0 = ${bin(i, 2)}: ${op.op}`} op={op.microoperation} value={<Word value={r.candidates[i]} width={n} />} selected={i === s} />
          ))}
        </div>
      </Panel>
    </>
  );
}

/** Tables 4-5, 4-6 and Sec. 4-5 */
export function LogicFunctionsBlock() {
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b1010, n);
  const [b, setB] = useWord(0b1100, n);
  const [f, setF] = useState(6);
  return (
    <>
      <BlockHeader title="Sixteen logic functions" refs="Tables 4-5, 4-6" right={<WidthSelect />}>
        Two binary variables have 16 possible functions. As microoperations they are applied bit by bit to registers A and B. Click a row to select one; its column in the truth table is the binary number of F.
      </BlockHeader>
      <Panel title="Inputs">
        <div className="row">
          <BitInput label="A" value={a} width={n} onChange={setA} />
          <BitInput label="B" value={b} width={n} onChange={setB} />
        </div>
      </Panel>
      <Panel title="Truth tables and microoperations" refs={<Ref>Tables 4-5, 4-6</Ref>}>
        <div className="scroll-x">
          <table className="data" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>F</th>
                <th title="Outputs for xy = 00, 01, 10, 11">xy: 00 01 10 11</th>
                <th>Boolean function</th>
                <th>Microoperation</th>
                <th>Name</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {LOGIC_FUNCTIONS.map((fn) => (
                <tr key={fn.f} className={fn.f === f ? 'hit' : ''} onClick={() => setF(fn.f)} style={{ cursor: 'pointer' }}>
                  <td>F{fn.f}</td>
                  <td>{bin(fn.f, 4).split('').join('  ')}</td>
                  <td>{fn.boolean}</td>
                  <td>{fn.micro}</td>
                  <td style={{ fontFamily: 'var(--sans)' }}>{fn.name}</td>
                  <td>
                    <Word value={logicFunction(fn.f, a, b, n)} width={n} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <LogicApplications />
    </>
  );
}

function LogicApplications() {
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b0110_1010, n);
  const [b, setB] = useWord(0b0000_1111, n);
  const [c, setC] = useWord(0b1001_0000, n);
  const ins = logicApplications.insert(a, b, c);
  const cmp = logicApplications.clear(a, b);
  const apps = [
    { name: 'Selective-set', op: 'A ← A ∨ B', v: logicApplications.selectiveSet(a, b), note: 'Sets the bits of A where B has 1s.' },
    { name: 'Selective-complement', op: 'A ← A ⊕ B', v: logicApplications.selectiveComplement(a, b), note: 'Complements the bits of A where B has 1s.' },
    { name: 'Selective-clear', op: "A ← A ∧ B'", v: logicApplications.selectiveClear(a, b, n), note: 'Clears the bits of A where B has 1s.' },
    { name: 'Mask', op: 'A ← A ∧ B', v: logicApplications.mask(a, b), note: 'Keeps only the bits of A where B has 1s.' },
    { name: 'Insert', op: 'A ← (A ∧ B) ∨ C', v: ins.result, note: `Mask with B first (gives ${bin(ins.masked, n)}), then OR the new bits C.` },
    { name: 'Clear / compare', op: 'A ← A ⊕ B', v: cmp.result, note: cmp.equal ? 'Result is 0: A and B are equal.' : 'Result is not 0: A and B differ.' },
  ];
  return (
    <Panel title="Applications of logic microoperations" refs={<Ref>Sec. 4-5</Ref>}>
      <div className="row" style={{ marginBottom: 12 }}>
        <BitInput label="A" value={a} width={n} onChange={setA} />
        <BitInput label="B (mask)" value={b} width={n} onChange={setB} />
        <BitInput label="C (insert bits)" value={c} width={n} onChange={setC} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {apps.map((x) => (
          <Candidate key={x.name} title={x.name} op={x.op} value={<Word value={x.v} width={n} />} selected={false}>
            <span style={{ fontSize: 13 }}>{x.note}</span>
          </Candidate>
        ))}
      </div>
    </Panel>
  );
}

/** Table 4-7 */
export function ShiftsBlock() {
  const n = useSettings((s) => s.width);
  const [r, setR] = useWord(0b0110, n);
  const [sel, setSel] = useState('ashl');
  return (
    <>
      <BlockHeader title="Shift microoperations" refs="Table 4-7, Sec. 4-6" right={<WidthSelect />}>
        Logical shifts insert 0. Circular shifts feed the bit shifted out back in at the other end. ashr keeps the sign bit and copies it right; ashl overflows when the sign bit would change, Vs = R(n−1) ⊕ R(n−2), evaluated before the shift.
      </BlockHeader>
      <Panel title="Register R">
        <BitInput label="R" value={r} width={n} onChange={setR} />
        <Interpret value={r} width={n} />
      </Panel>
      <Panel title="Results" refs={<Ref>Table 4-7</Ref>}>
        <div className="scroll-x">
          <table className="data" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Symbolic designation</th>
                <th>Description</th>
                <th>R after</th>
                <th>Signed</th>
                <th>Overflow</th>
              </tr>
            </thead>
            <tbody>
              {SHIFT_OPS.map((op) => {
                const out = shiftMicro(op.op, r, n);
                return (
                  <tr key={op.op} className={op.op === sel ? 'hit' : ''} onClick={() => setSel(op.op)} style={{ cursor: 'pointer' }}>
                    <td>{op.rtl}</td>
                    <td style={{ fontFamily: 'var(--sans)' }}>{op.name}</td>
                    <td>
                      <Word value={out.value} width={n} />
                    </td>
                    <td>
                      <Word value={out.value} width={n} signedOverride />
                    </td>
                    <td>
                      {out.vs === undefined ? '—' : (
                        <span style={{ color: out.vs ? 'var(--changed)' : undefined }}>
                          Vs = R{n - 1} ⊕ R{n - 2} = {bitAt(r, n - 1)} ⊕ {bitAt(r, n - 2)} = {out.vs}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/** Fig. 4-12 */
export function ShifterBlock() {
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b1010, n);
  const [s, setS] = useState<Bit>(0);
  const [ir, setIr] = useState<Bit>(0);
  const [il, setIl] = useState<Bit>(0);
  const r = combinationalShifter(a, s, ir, il, n);
  return (
    <>
      <BlockHeader title="Combinational shifter" refs="Fig. 4-12" right={<WidthSelect />}>
        One 2×1 MUX per output bit H. With S = 0 every MUX takes the bit to its left (shift right, serial input IR enters the leftmost bit); with S = 1 the bit to its right (shift left, IL enters the rightmost bit).
      </BlockHeader>
      <Panel title="Inputs">
        <div className="row">
          <BitInput label="A" value={a} width={n} onChange={setA} />
          <BitToggle label="S" value={s} onChange={setS} />
          <BitToggle label="IR (serial in, right shift)" value={ir} onChange={setIr} />
          <BitToggle label="IL (serial in, left shift)" value={il} onChange={setIl} />
        </div>
      </Panel>
      <Panel title={`2×1 multiplexers, S = ${s} selects input ${s}`}>
        <div className="scroll-x">
          <div style={{ display: 'flex', gap: 6, fontFamily: 'var(--mono)', fontSize: n > 8 ? 11 : 13, minWidth: 'min-content' }}>
            {r.muxes
              .map((m, i) => ({ m, i }))
              .reverse()
              .map(({ m, i }) => (
                <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 4, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', background: 'var(--box)' }}>
                  <span style={{ color: s === 0 ? 'var(--active)' : 'var(--muted)' }}>
                    0: {i === n - 1 ? 'IR' : `A${i + 1}`}={m.in0}
                  </span>
                  <span style={{ color: s === 1 ? 'var(--active)' : 'var(--muted)' }}>
                    1: {i === 0 ? 'IL' : `A${i - 1}`}={m.in1}
                  </span>
                  <span className="cap" style={{ fontSize: 9 }}>
                    MUX
                  </span>
                  <span style={{ color: 'var(--active)', fontWeight: 600 }}>
                    H<sub>{i}</sub>={m.out}
                  </span>
                </div>
              ))}
          </div>
        </div>
        <p className="result" style={{ margin: '12px 0 0' }}>
          H = <Word value={r.h} width={n} />
        </p>
      </Panel>
    </>
  );
}

/** Fig. 4-13, Table 4-8 */
export function AluBlock() {
  const { width: n, encoding, setEncoding } = useSettings();
  const [a, setA] = useWord(0b0110, n);
  const [b, setB] = useWord(0b0011, n);
  const [sel, setSel] = useState(0b0001);
  const [cin, setCin] = useState<Bit>(0);
  const r = alu(a, b, sel, cin, n, encoding);
  const s3s2 = sel >> 2;
  const table = aluTable(encoding);
  const rowHit = (row: (typeof table)[number]) =>
    s3s2 >= 2 ? row.select === (s3s2 === 2 ? 8 : 12) : s3s2 === 1 ? row.select === sel : row.select === sel && row.cin === cin;

  return (
    <>
      <BlockHeader title="Arithmetic logic shift unit" refs="Fig. 4-13, Table 4-8" right={<WidthSelect />}>
        Each stage has an arithmetic part and a logic part; an output 4×1 MUX selected by S3S2 passes the arithmetic result (00), the logic result (01), shr A (10) or shl A (11). All n stages share the select inputs and are joined by the carry chain.
      </BlockHeader>
      <Panel
        title="Arithmetic encoding"
        refs={
          <div className="seg" role="radiogroup" aria-label="Arithmetic encoding">
            <button role="radio" aria-checked={encoding === 'table4-8'} onClick={() => setEncoding('table4-8')}>
              Table 4-8 (as printed)
            </button>
            <button role="radio" aria-checked={encoding === 'fig4-9'} onClick={() => setEncoding('fig4-9')}>
              Fig. 4-9 wiring (Table 4-4)
            </button>
          </div>
        }
      >
        <p style={{ margin: 0, color: 'var(--text-2)', lineHeight: 1.5, fontSize: 14 }}>
          The book has an inconsistency: the text says the arithmetic stage is the circuit of Fig. 4-9 (Table 4-4: S1S0 = 00 gives A + B), but Table 4-8 prints the arithmetic rows in another order (00000 → F = A, 00001 → F = A + 1, 00010 → F = A + B). "As printed" follows Table 4-8; "Fig. 4-9 wiring" follows Table 4-4.
        </p>
      </Panel>
      <Panel title="Inputs">
        <div className="row">
          <div>
            <BitInput label="A" value={a} width={n} onChange={setA} />
            <Interpret value={a} width={n} />
          </div>
          <div>
            <BitInput label="B" value={b} width={n} onChange={setB} />
            <Interpret value={b} width={n} />
          </div>
          <BitInput label="S3 S2 S1 S0" value={sel} width={4} onChange={setSel} names={['S0', 'S1', 'S2', 'S3']} />
          <BitToggle label="Cin" value={cin} onChange={setCin} />
        </div>
      </Panel>
      <Panel title={`Every stage computes all four; the output MUX passes S3S2 = ${bin(s3s2, 2)}`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          <Candidate title="00: arithmetic" op={r.arithmetic.microoperation.replace('D =', 'F =')} value={<Word value={r.candidates.arithmetic} width={n} />} selected={s3s2 === 0} />
          <Candidate title="01: logic" op={r.logic.microoperation.replace('E =', 'F =')} value={<Word value={r.candidates.logic} width={n} />} selected={s3s2 === 1} />
          <Candidate title="10: shift right" op="F = shr A" value={<Word value={r.candidates.shr} width={n} />} selected={s3s2 === 2} />
          <Candidate title="11: shift left" op="F = shl A" value={<Word value={r.candidates.shl} width={n} />} selected={s3s2 === 3} />
        </div>
        <div className="row" style={{ marginTop: 14, alignItems: 'center' }}>
          <span className="result">
            F = <span style={{ color: 'var(--active)' }}><Word value={r.f} width={n} /></span>
          </span>
          <Flag name="C" v={r.status.c} meaningless={!r.carryMeaningful} note="Carry out of the last stage" />
          <Flag name="S" v={r.status.s} note="Sign bit F(n−1)" />
          <Flag name="Z" v={r.status.z} note="Zero: NOR of all output bits" />
          <Flag name="V" v={r.status.v} meaningless={!r.carryMeaningful} note="Overflow: XOR of the last two carries" />
          {!r.carryMeaningful && <span className="muted" style={{ fontSize: 13 }}>C and V are meaningless for logic and shift operations.</span>}
        </div>
      </Panel>
      <Panel title="Function table for the ALU" refs={<Ref>Table 4-8</Ref>}>
        <div className="scroll-x">
          <table className="data" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>S3 S2 S1 S0</th>
                <th>Cin</th>
                <th>Operation</th>
                <th>Result here</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row) => {
                const out = alu(a, b, row.select, row.cin ?? 0, n, encoding).f;
                return (
                  <tr
                    key={`${row.select}-${row.cin}`}
                    className={rowHit(row) ? 'hit' : ''}
                    onClick={() => {
                      setSel(row.select);
                      if (row.cin !== null) setCin(row.cin);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{row.select >= 8 ? `${bin(row.select >> 2, 2).split('').join(' ')} × ×` : bin(row.select, 4).split('').join(' ')}</td>
                    <td>{row.cin ?? '×'}</td>
                    <td>{row.operation}</td>
                    <td>
                      <Word value={out} width={n} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/** Sec. 8-7, Fig. 8-8 */
export function StatusBlock() {
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b0110, n);
  const [b, setB] = useWord(0b0011, n);
  const [sub, setSub] = useState<Bit>(0);
  const r = alu(a, sub ? complement(b, n) : b, 0b0001, sub, n, 'table4-8');
  const examples = [
    { a: 0b0110, b: 0b0011, label: '0110 + 0011' },
    { a: 0b1100, b: 0b1011, label: '1100 + 1011' },
  ];
  return (
    <>
      <BlockHeader title="Status bits" refs="Sec. 8-7, Fig. 8-8" right={<WidthSelect />}>
        C is the carry out of the last stage. S is the sign, the most significant output bit. Z is 1 when every output bit is 0 (a NOR of all outputs). V is the overflow, the XOR of the last two carries. C and V only mean something after an arithmetic operation.
      </BlockHeader>
      <Panel title="Inputs">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div>
            <BitInput label="A" value={a} width={n} onChange={setA} />
            <Interpret value={a} width={n} />
          </div>
          <div>
            <BitInput label="B" value={b} width={n} onChange={setB} />
            <Interpret value={b} width={n} />
          </div>
          <div className="seg" role="group" aria-label="Operation">
            <button aria-pressed={!sub} onClick={() => setSub(0)}>A + B</button>
            <button aria-pressed={!!sub} onClick={() => setSub(1)}>A − B</button>
          </div>
          {n === 4 &&
            examples.map((ex) => (
              <button key={ex.label} className="btn small" onClick={() => { setA(ex.a); setB(ex.b); setSub(0); }}>
                {ex.label}
              </button>
            ))}
        </div>
      </Panel>
      <Panel title="Result and status bits" refs={<Ref>Fig. 8-8</Ref>}>
        <CarryChain width={n} rows={[{ label: 'A', value: a }, { label: sub ? "B'" : 'B', value: sub ? complement(b, n) : b }]} carries={r.arithmetic.carries} outLabel="F" out={r.f} stageLabel="FA" />
        <div className="grid2" style={{ marginTop: 14 }}>
          {[
            { k: 'C', v: r.status.c, why: `C = C${n} = ${r.status.c}` },
            { k: 'S', v: r.status.s, why: `S = F${n - 1} = ${r.status.s}` },
            { k: 'Z', v: r.status.z, why: `Z = (F${n - 1} + … + F0)' = ${r.status.z}` },
            { k: 'V', v: r.status.v, why: `V = C${n - 1} ⊕ C${n} = ${r.arithmetic.carries[n - 1]} ⊕ ${r.arithmetic.carries[n]} = ${r.status.v}` },
          ].map((f) => (
            <div key={f.k} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Flag name={f.k} v={f.v as Bit} />
              <span className="mono" style={{ fontSize: 13, color: 'var(--text-2)' }}>
                {f.why}
              </span>
            </div>
          ))}
        </div>
        <p className="result" style={{ margin: '14px 0 0' }}>
          F = <Word value={r.f} width={n} /> <Interpret value={r.f} width={n} />
        </p>
      </Panel>
    </>
  );
}
