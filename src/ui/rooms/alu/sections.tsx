import { useState } from 'react';
import { bitAt, complement, type Bit } from '../../../core/bits';
import { alu, aluTable } from '../../../core/alu/alu';
import { adderSubtractor, ARITH_NAME_TR, arithmeticCircuit, arithmeticTable, incrementer } from '../../../core/alu/arithmetic';
import { LOGIC_FUNCTIONS, LOGIC_OPS, logicApplications, logicCircuit, logicFunction } from '../../../core/alu/logic';
import { combinationalShifter, SHIFT_OPS, shiftMicro } from '../../../core/alu/shift';
import { BlockHeader, Candidate, CarryChain, Flag, Interpret, useWord, WidthSelect } from '../../common/blocks';
import { BitInput, BitToggle, Panel, Ref, Word } from '../../common/controls';
import { useLang, useSettings } from '../../settings';

const bin = (v: number, n: number) => v.toString(2).padStart(n, '0');

/** Fig. 4-7 */
export function AdderSubtractorBlock() {
  const { L } = useLang();
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b0110, n);
  const [b, setB] = useWord(0b0011, n);
  const [m, setM] = useState<Bit>(0);
  const r = adderSubtractor(a, b, m, n);
  return (
    <>
      <BlockHeader title={L("Adder-subtractor", "Toplayıcı-çıkarıcı")} refs="Fig. 4-7" right={<WidthSelect />}>
        {L("M = 0 adds A + B. M = 1 subtracts: each B bit goes through an XOR gate with M, giving B', and M also enters as C0, so the circuit computes A + B' + 1 = A − B in 2's complement.", "M = 0 iken A + B toplanır. M = 1 iken çıkarma yapılır: her B biti M ile bir XOR kapısından geçip B' olur, M ayrıca C0 olarak girer; böylece devre 2'ye tümleyende A + B' + 1 = A − B hesaplar.")}
      </BlockHeader>
      <Panel title={L("Inputs", "Girişler")}>
        <div className="row">
          <div>
            <BitInput label="A" value={a} width={n} onChange={setA} />
            <Interpret value={a} width={n} />
          </div>
          <div>
            <BitInput label="B" value={b} width={n} onChange={setB} />
            <Interpret value={b} width={n} />
          </div>
          <BitToggle label={L("M (mode)", "M (mod)")} value={m} onChange={setM} />
        </div>
      </Panel>
      <Panel title={L(`Full-adder chain, B ⊕ M = ${bin(r.bIn, n)}`, `Tam toplayıcı zinciri, B ⊕ M = ${bin(r.bIn, n)}`)} refs={<Ref>Fig. 4-7</Ref>}>
        <CarryChain width={n} rows={[{ label: 'A', value: a }, { label: 'B⊕M', value: r.bIn }]} carries={r.carries} outLabel="S" out={r.sum} stageLabel="FA" />
      </Panel>
      <Panel title={L("Result and the flag that matters", "Sonuç ve belirleyici bayrak")}>
        <div className="row" style={{ alignItems: 'center' }}>
          <span className="result">
            {m ? 'A − B' : 'A + B'} = <Word value={r.sum} width={n} />
          </span>
          <Flag name={`C${n}`} v={r.c} note={L("Carry out", "Çıkış eldesi")} />
          <Flag name="V" v={r.v} note={`V = C${n - 1} ⊕ C${n}`} />
        </div>
        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="sig" style={{ border: '1px solid var(--line-soft)', borderRadius: 4, padding: 12 }}>
            <span className="cap">{L(`Unsigned interpretation: watch C${n}`, `İşaretsiz yorum: C${n} belirleyici`)}</span>
            <p style={{ margin: '6px 0 0' }}>
              {m
                ? `C${n} = ${r.c}: ${r.c ? L("A ≥ B, no borrow; the result is correct.", "A ≥ B, ödünç yok; sonuç doğru.") : L("A < B; the unsigned result wrapped around (borrow).", "A < B; işaretsiz sonuç başa sardı (ödünç).")}`
                : `C${n} = ${r.c}: ${r.c ? L(`the sum does not fit in ${n} bits (carry out).`, `toplam ${n} bite sığmıyor (çıkış eldesi).`) : L("the sum fits; the result is correct.", "toplam sığıyor; sonuç doğru.")}`}
            </p>
          </div>
          <div className="sig" style={{ border: '1px solid var(--line-soft)', borderRadius: 4, padding: 12 }}>
            <span className="cap">{L("Signed (2's complement) interpretation: watch V", "İşaretli (2'ye tümleyen) yorum: V belirleyici")}</span>
            <p style={{ margin: '6px 0 0' }}>
              V = C{n - 1} ⊕ C{n} = {r.carries[n - 1]} ⊕ {r.carries[n]} = {r.v}: {r.v ? L("overflow, the signed result is wrong.", "taşma var, işaretli sonuç yanlış.") : L("no overflow, the signed result is correct.", "taşma yok, işaretli sonuç doğru.")}
            </p>
          </div>
        </div>
      </Panel>
    </>
  );
}

/** Fig. 4-8 */
export function IncrementerBlock() {
  const { L } = useLang();
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b0111, n);
  const r = incrementer(a, n);
  return (
    <>
      <BlockHeader title={L("Binary incrementer", "İkili arttırıcı")} refs="Fig. 4-8" right={<WidthSelect />}>
        {L("A chain of half adders. A constant 1 enters the first one; each carry becomes the second input of the next half adder.", "Yarım toplayıcılardan oluşan bir zincir. Sabit 1 ilkine girer; her elde bir sonraki yarım toplayıcının ikinci girişi olur.")}
      </BlockHeader>
      <Panel title={L("Input", "Giriş")}>
        <BitInput label="A" value={a} width={n} onChange={setA} />
      </Panel>
      <Panel title={L("Half-adder chain", "Yarım toplayıcı zinciri")}>
        <CarryChain width={n} rows={[{ label: 'A', value: a }]} carries={r.carries} outLabel="S" out={r.sum} stageLabel="HA" />
        <div className="row" style={{ marginTop: 12, alignItems: 'center' }}>
          <span className="result">
            A + 1 = <Word value={r.sum} width={n} />
          </span>
          <Flag name={`C${n}`} v={r.cout} note={L("Carry out", "Çıkış eldesi")} />
        </div>
      </Panel>
    </>
  );
}

/** Fig. 4-9, Table 4-4 */
export function ArithmeticBlock() {
  const { lang, L } = useLang();
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b0110, n);
  const [b, setB] = useWord(0b0011, n);
  const [s, setS] = useState(0);
  const [cin, setCin] = useState<Bit>(0);
  const r = arithmeticCircuit(a, b, s, cin, n, 'fig4-9');
  const rows = arithmeticTable('fig4-9');
  return (
    <>
      <BlockHeader title={L("Arithmetic circuit", "Aritmetik devre")} refs="Fig. 4-9, Table 4-4" right={<WidthSelect />}>
        {L("D = A + Y + Cin. A 4×1 MUX in every stage selects Y: S1S0 = 00 → B, 01 → B', 10 → 0, 11 → all 1s. With Cin this gives the eight microoperations of Table 4-4.", "D = A + Y + Cin. Her kattaki 4×1 MUX Y'yi seçer: S1S0 = 00 → B, 01 → B', 10 → 0, 11 → tümü 1. Cin ile birlikte bu, Tablo 4-4'teki sekiz mikroişlemi verir.")}
      </BlockHeader>
      <Panel title={L("Inputs", "Girişler")}>
        <div className="row">
          <BitInput label="A" value={a} width={n} onChange={setA} />
          <BitInput label="B" value={b} width={n} onChange={setB} />
          <BitInput label="S1 S0" value={s} width={2} onChange={setS} names={['S0', 'S1']} />
          <BitToggle label="Cin" value={cin} onChange={setCin} />
        </div>
      </Panel>
      <Panel title={L(`MUX output Y = ${r.y} = ${bin(r.yValue, n)}`, `MUX çıkışı Y = ${r.y} = ${bin(r.yValue, n)}`)}>
        <CarryChain width={n} rows={[{ label: 'A', value: a }, { label: 'Y', value: r.yValue }]} carries={r.carries} outLabel="D" out={r.d} stageLabel="FA" />
        <p className="result" style={{ margin: '12px 0 0' }}>
          {r.microoperation} = <Word value={r.d} width={n} />{' '}
          <span className="muted" style={{ fontSize: 14, fontFamily: 'var(--sans)' }}>
            ({lang === 'tr' ? ARITH_NAME_TR[r.name] : r.name})
          </span>
        </p>
      </Panel>
      <Panel title={L("Arithmetic circuit function table", "Aritmetik devre fonksiyon tablosu")} refs={<Ref>Table 4-4</Ref>}>
        <div className="scroll-x">
          <table className="data" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>S1</th>
                <th>S0</th>
                <th>Cin</th>
                <th>Y</th>
                <th>{L("Output", "Çıkış")}</th>
                <th>{L("Microoperation", "Mikroişlem")}</th>
                <th>{L("Result here", "Buradaki sonuç")}</th>
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
                  <td style={{ fontFamily: 'var(--sans)' }}>{lang === 'tr' ? ARITH_NAME_TR[row.name] : row.name}</td>
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
  const { L } = useLang();
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b1010, n);
  const [b, setB] = useWord(0b1100, n);
  const [s, setS] = useState(0);
  const r = logicCircuit(a, b, s, n);
  return (
    <>
      <BlockHeader title={L("Logic circuit", "Mantık devresi")} refs="Fig. 4-10" right={<WidthSelect />}>
        {L("One stage has four gates (AND, OR, XOR, NOT A) whose outputs go into a 4×1 MUX. S1S0 picks which one reaches the output E.", "Bir katta çıkışları 4×1 MUX'a giden dört kapı (AND, OR, XOR, NOT A) vardır. S1S0 hangisinin E çıkışına ulaşacağını seçer.")}
      </BlockHeader>
      <Panel title={L("Inputs", "Girişler")}>
        <div className="row">
          <BitInput label="A" value={a} width={n} onChange={setA} />
          <BitInput label="B" value={b} width={n} onChange={setB} />
          <BitInput label="S1 S0" value={s} width={2} onChange={setS} names={['S0', 'S1']} />
        </div>
      </Panel>
      <Panel title={L("All four gates compute; the MUX passes one", "Dört kapı da hesaplar; MUX birini geçirir")}>
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
  const { lang, L } = useLang();
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b1010, n);
  const [b, setB] = useWord(0b1100, n);
  const [f, setF] = useState(6);
  return (
    <>
      <BlockHeader title={L("Sixteen logic functions", "On altı mantık fonksiyonu")} refs="Tables 4-5, 4-6" right={<WidthSelect />}>
        {L("Two binary variables have 16 possible functions. As microoperations they are applied bit by bit to registers A and B. Click a row to select one; its column in the truth table is the binary number of F.", "İki ikili değişkenin 16 olası fonksiyonu vardır. Mikroişlem olarak A ve B yazmaçlarına bit bit uygulanırlar. Birini seçmek için bir satıra tıkla; doğruluk tablosundaki sütunu F'nin numarasının ikili yazılışıdır.")}
      </BlockHeader>
      <Panel title={L("Inputs", "Girişler")}>
        <div className="row">
          <BitInput label="A" value={a} width={n} onChange={setA} />
          <BitInput label="B" value={b} width={n} onChange={setB} />
        </div>
      </Panel>
      <Panel title={L("Truth tables and microoperations", "Doğruluk tabloları ve mikroişlemler")} refs={<Ref>Tables 4-5, 4-6</Ref>}>
        <div className="scroll-x">
          <table className="data" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>F</th>
                <th title={L("Outputs for xy = 00, 01, 10, 11", "xy = 00, 01, 10, 11 için çıkışlar")}>xy: 00 01 10 11</th>
                <th>{L("Boolean function", "Boole fonksiyonu")}</th>
                <th>{L("Microoperation", "Mikroişlem")}</th>
                <th>{L("Name", "Ad")}</th>
                <th>{L("Result", "Sonuç")}</th>
              </tr>
            </thead>
            <tbody>
              {LOGIC_FUNCTIONS.map((fn) => (
                <tr key={fn.f} className={fn.f === f ? 'hit' : ''} onClick={() => setF(fn.f)} style={{ cursor: 'pointer' }}>
                  <td>F{fn.f}</td>
                  <td>{bin(fn.f, 4).split('').join('  ')}</td>
                  <td>{fn.boolean}</td>
                  <td>{fn.micro}</td>
                  <td style={{ fontFamily: 'var(--sans)' }}>{lang === 'tr' ? fn.nameTr : fn.name}</td>
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
  const { L } = useLang();
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b0110_1010, n);
  const [b, setB] = useWord(0b0000_1111, n);
  const [c, setC] = useWord(0b1001_0000, n);
  const ins = logicApplications.insert(a, b, c);
  const cmp = logicApplications.clear(a, b);
  const apps = [
    { name: L('Selective-set', 'Seçici kurma'), op: 'A ← A ∨ B', v: logicApplications.selectiveSet(a, b), note: L('Sets the bits of A where B has 1s.', "A'nın, B'de 1 olan bitlerini 1 yapar.") },
    { name: L('Selective-complement', 'Seçici tümleme'), op: 'A ← A ⊕ B', v: logicApplications.selectiveComplement(a, b), note: L('Complements the bits of A where B has 1s.', "A'nın, B'de 1 olan bitlerini tümler.") },
    { name: L('Selective-clear', 'Seçici temizleme'), op: "A ← A ∧ B'", v: logicApplications.selectiveClear(a, b, n), note: L('Clears the bits of A where B has 1s.', "A'nın, B'de 1 olan bitlerini 0 yapar.") },
    { name: L('Mask', 'Maskeleme'), op: 'A ← A ∧ B', v: logicApplications.mask(a, b), note: L('Keeps only the bits of A where B has 1s.', "A'nın yalnızca B'de 1 olan bitlerini tutar.") },
    { name: L('Insert', 'Ekleme'), op: 'A ← (A ∧ B) ∨ C', v: ins.result, note: L(`Mask with B first (gives ${bin(ins.masked, n)}), then OR the new bits C.`, `Önce B ile maskele (${bin(ins.masked, n)} verir), sonra yeni C bitleriyle OR'la.`) },
    { name: L('Clear / compare', 'Temizle / karşılaştır'), op: 'A ← A ⊕ B', v: cmp.result, note: cmp.equal ? L('Result is 0: A and B are equal.', 'Sonuç 0: A ve B eşit.') : L('Result is not 0: A and B differ.', 'Sonuç 0 değil: A ve B farklı.') },
  ];
  return (
    <Panel title={L("Applications of logic microoperations", "Mantık mikroişlemlerinin uygulamaları")} refs={<Ref>Sec. 4-5</Ref>}>
      <div className="row" style={{ marginBottom: 12 }}>
        <BitInput label="A" value={a} width={n} onChange={setA} />
        <BitInput label={L("B (mask)", "B (maske)")} value={b} width={n} onChange={setB} />
        <BitInput label={L("C (insert bits)", "C (eklenecek bitler)")} value={c} width={n} onChange={setC} />
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
  const { lang, L } = useLang();
  const n = useSettings((s) => s.width);
  const [r, setR] = useWord(0b0110, n);
  const [sel, setSel] = useState('ashl');
  return (
    <>
      <BlockHeader title={L("Shift microoperations", "Kaydırma mikroişlemleri")} refs="Table 4-7, Sec. 4-6" right={<WidthSelect />}>
        {L("Logical shifts insert 0. Circular shifts feed the bit shifted out back in at the other end. ashr keeps the sign bit and copies it right; ashl overflows when the sign bit would change, Vs = R(n−1) ⊕ R(n−2), evaluated before the shift.", "Mantıksal kaydırmalar 0 sokar. Dairesel kaydırmalar dışarı çıkan biti diğer uçtan geri besler. ashr işaret bitini korur ve sağa kopyalar; ashl, işaret biti değişecekse taşar: Vs = R(n−1) ⊕ R(n−2), kaydırmadan önce hesaplanır.")}
      </BlockHeader>
      <Panel title={L("Register R", "Yazmaç R")}>
        <BitInput label="R" value={r} width={n} onChange={setR} />
        <Interpret value={r} width={n} />
      </Panel>
      <Panel title={L("Results", "Sonuçlar")} refs={<Ref>Table 4-7</Ref>}>
        <div className="scroll-x">
          <table className="data" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>{L("Symbolic designation", "Sembolik gösterim")}</th>
                <th>{L("Description", "Açıklama")}</th>
                <th>{L("R after", "Sonraki R")}</th>
                <th>{L("Signed", "İşaretli")}</th>
                <th>{L("Overflow", "Taşma")}</th>
              </tr>
            </thead>
            <tbody>
              {SHIFT_OPS.map((op) => {
                const out = shiftMicro(op.op, r, n);
                return (
                  <tr key={op.op} className={op.op === sel ? 'hit' : ''} onClick={() => setSel(op.op)} style={{ cursor: 'pointer' }}>
                    <td>{op.rtl}</td>
                    <td style={{ fontFamily: 'var(--sans)' }}>{lang === 'tr' ? op.nameTr : op.name}</td>
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
  const { L } = useLang();
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b1010, n);
  const [s, setS] = useState<Bit>(0);
  const [ir, setIr] = useState<Bit>(0);
  const [il, setIl] = useState<Bit>(0);
  const r = combinationalShifter(a, s, ir, il, n);
  return (
    <>
      <BlockHeader title={L("Combinational shifter", "Kombinasyonel kaydırıcı")} refs="Fig. 4-12" right={<WidthSelect />}>
        {L("One 2×1 MUX per output bit H. With S = 0 every MUX takes the bit to its left (shift right, serial input IR enters the leftmost bit); with S = 1 the bit to its right (shift left, IL enters the rightmost bit).", "Her H çıkış biti için bir 2×1 MUX. S = 0 iken her MUX solundaki biti alır (sağa kaydırma, seri giriş IR en soldaki bite girer); S = 1 iken sağındaki biti alır (sola kaydırma, IL en sağdaki bite girer).")}
      </BlockHeader>
      <Panel title={L("Inputs", "Girişler")}>
        <div className="row">
          <BitInput label="A" value={a} width={n} onChange={setA} />
          <BitToggle label="S" value={s} onChange={setS} />
          <BitToggle label={L("IR (serial in, right shift)", "IR (seri giriş, sağa kaydırma)")} value={ir} onChange={setIr} />
          <BitToggle label={L("IL (serial in, left shift)", "IL (seri giriş, sola kaydırma)")} value={il} onChange={setIl} />
        </div>
      </Panel>
      <Panel title={L(`2×1 multiplexers, S = ${s} selects input ${s}`, `2×1 çoklayıcılar, S = ${s} ile ${s} girişi seçili`)}>
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
  const { L } = useLang();
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
      <BlockHeader title={L("Arithmetic logic shift unit", "Aritmetik mantık kaydırma birimi")} refs="Fig. 4-13, Table 4-8" right={<WidthSelect />}>
        {L("Each stage has an arithmetic part and a logic part; an output 4×1 MUX selected by S3S2 passes the arithmetic result (00), the logic result (01), shr A (10) or shl A (11). All n stages share the select inputs and are joined by the carry chain.", "Her katta bir aritmetik ve bir mantık kısmı vardır; S3S2 ile seçilen 4×1 çıkış MUX'u aritmetik sonucu (00), mantık sonucunu (01), shr A'yı (10) ya da shl A'yı (11) geçirir. n katın hepsi seçim girişlerini paylaşır ve elde zinciriyle birbirine bağlanır.")}
      </BlockHeader>
      <Panel
        title={L("Arithmetic encoding", "Aritmetik kodlama")}
        refs={
          <div className="seg" role="radiogroup" aria-label={L("Arithmetic encoding", "Aritmetik kodlama")}>
            <button role="radio" aria-checked={encoding === 'table4-8'} onClick={() => setEncoding('table4-8')}>
              {L("Table 4-8 (as printed)", "Tablo 4-8 (basıldığı gibi)")}
            </button>
            <button role="radio" aria-checked={encoding === 'fig4-9'} onClick={() => setEncoding('fig4-9')}>
              {L("Fig. 4-9 wiring (Table 4-4)", "Şekil 4-9 bağlantısı (Tablo 4-4)")}
            </button>
          </div>
        }
      >
        <p style={{ margin: 0, color: 'var(--text-2)', lineHeight: 1.5, fontSize: 14 }}>
          {L("The book has an inconsistency: the text says the arithmetic stage is the circuit of Fig. 4-9 (Table 4-4: S1S0 = 00 gives A + B), but Table 4-8 prints the arithmetic rows in another order (00000 → F = A, 00001 → F = A + 1, 00010 → F = A + B). \"As printed\" follows Table 4-8; \"Fig. 4-9 wiring\" follows Table 4-4.", "Kitapta bir tutarsızlık var: metin aritmetik katın Şekil 4-9'daki devre olduğunu söyler (Tablo 4-4: S1S0 = 00, A + B verir), ama Tablo 4-8 aritmetik satırları başka bir sırayla basar (00000 → F = A, 00001 → F = A + 1, 00010 → F = A + B). \"Basıldığı gibi\" Tablo 4-8'i, \"Şekil 4-9 bağlantısı\" Tablo 4-4'ü izler.")}
        </p>
      </Panel>
      <Panel title={L("Inputs", "Girişler")}>
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
      <Panel title={L(`Every stage computes all four; the output MUX passes S3S2 = ${bin(s3s2, 2)}`, `Her kat dördünü de hesaplar; çıkış MUX'u S3S2 = ${bin(s3s2, 2)} olanı geçirir`)}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          <Candidate title={L("00: arithmetic", "00: aritmetik")} op={r.arithmetic.microoperation.replace('D =', 'F =')} value={<Word value={r.candidates.arithmetic} width={n} />} selected={s3s2 === 0} />
          <Candidate title={L("01: logic", "01: mantık")} op={r.logic.microoperation.replace('E =', 'F =')} value={<Word value={r.candidates.logic} width={n} />} selected={s3s2 === 1} />
          <Candidate title={L("10: shift right", "10: sağa kaydırma")} op="F = shr A" value={<Word value={r.candidates.shr} width={n} />} selected={s3s2 === 2} />
          <Candidate title={L("11: shift left", "11: sola kaydırma")} op="F = shl A" value={<Word value={r.candidates.shl} width={n} />} selected={s3s2 === 3} />
        </div>
        <div className="row" style={{ marginTop: 14, alignItems: 'center' }}>
          <span className="result">
            F = <span style={{ color: 'var(--active)' }}><Word value={r.f} width={n} /></span>
          </span>
          <Flag name="C" v={r.status.c} meaningless={!r.carryMeaningful} note={L("Carry out of the last stage", "Son katın çıkış eldesi")} />
          <Flag name="S" v={r.status.s} note={L("Sign bit F(n−1)", "İşaret biti F(n−1)")} />
          <Flag name="Z" v={r.status.z} note={L("Zero: NOR of all output bits", "Sıfır: tüm çıkış bitlerinin NOR'u")} />
          <Flag name="V" v={r.status.v} meaningless={!r.carryMeaningful} note={L("Overflow: XOR of the last two carries", "Taşma: son iki eldenin XOR'u")} />
          {!r.carryMeaningful && <span className="muted" style={{ fontSize: 13 }}>{L("C and V are meaningless for logic and shift operations.", "C ve V mantık ve kaydırma işlemlerinde anlamsızdır.")}</span>}
        </div>
      </Panel>
      <Panel title={L("Function table for the ALU", "ALU fonksiyon tablosu")} refs={<Ref>Table 4-8</Ref>}>
        <div className="scroll-x">
          <table className="data" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>S3 S2 S1 S0</th>
                <th>Cin</th>
                <th>{L("Operation", "İşlem")}</th>
                <th>{L("Result here", "Buradaki sonuç")}</th>
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
  const { L } = useLang();
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
      <BlockHeader title={L("Status bits", "Durum bitleri")} refs="Sec. 8-7, Fig. 8-8" right={<WidthSelect />}>
        {L("C is the carry out of the last stage. S is the sign, the most significant output bit. Z is 1 when every output bit is 0 (a NOR of all outputs). V is the overflow, the XOR of the last two carries. C and V only mean something after an arithmetic operation.", "C son katın çıkış eldesidir. S işarettir, yani en anlamlı çıkış biti. Z, tüm çıkış bitleri 0 olduğunda 1 olur (tüm çıkışların NOR'u). V taşmadır, son iki eldenin XOR'u. C ve V yalnızca aritmetik bir işlemden sonra anlam taşır.")}
      </BlockHeader>
      <Panel title={L("Inputs", "Girişler")}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div>
            <BitInput label="A" value={a} width={n} onChange={setA} />
            <Interpret value={a} width={n} />
          </div>
          <div>
            <BitInput label="B" value={b} width={n} onChange={setB} />
            <Interpret value={b} width={n} />
          </div>
          <div className="seg" role="group" aria-label={L("Operation", "İşlem")}>
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
      <Panel title={L("Result and status bits", "Sonuç ve durum bitleri")} refs={<Ref>Fig. 8-8</Ref>}>
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
