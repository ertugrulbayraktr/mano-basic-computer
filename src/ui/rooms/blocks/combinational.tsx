import { useState } from 'react';
import { bitAt, type Bit } from '../../../core/bits';
import { decoder, encoder, mux } from '../../../core/blocks/combinational';
import { BlockHeader } from '../../common/blocks';
import { BitInput, BitToggle, Panel } from '../../common/controls';
import { useLang } from '../../settings';

const OutputChips = ({ bits, prefix }: { bits: Bit[]; prefix: string }) => (
  <div className="chips">
    {bits.map((b, i) => (
      <span key={i} className={`chip ${b ? 'on' : ''}`}>
        {prefix}
        {i} = {b}
      </span>
    ))}
  </div>
);

export function DecoderBlock() {
  const { L } = useLang();
  const [a, setA] = useState(0b101);
  const [e, setE] = useState<Bit>(1);
  const out = decoder(a, 3, e);
  return (
    <>
      <BlockHeader title={L("3 × 8 decoder with enable", "Etkinleştirmeli 3 × 8 kod çözücü")} refs="Fig. 2-1">
        {L("A decoder turns an n-bit code into 2^n outputs. With E = 1 exactly one output, D(A2A1A0), is 1; with E = 0 all outputs are 0.", "Kod çözücü n bitlik bir kodu 2^n çıkışa dönüştürür. E = 1 iken tam olarak bir çıkış, D(A2A1A0), 1 olur; E = 0 iken tüm çıkışlar 0'dır.")}
      </BlockHeader>
      <Panel title={L("Inputs and outputs", "Girişler ve çıkışlar")}>
        <div className="row" style={{ marginBottom: 14 }}>
          <BitToggle label={L("E (enable)", "E (etkinleştirme)")} value={e} onChange={setE} />
          <BitInput label="A2 A1 A0" value={a} width={3} onChange={setA} names={['A0', 'A1', 'A2']} />
        </div>
        <OutputChips bits={out} prefix="D" />
      </Panel>
      <Panel title={L("Truth table", "Doğruluk tablosu")}>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>E</th>
                <th>A2 A1 A0</th>
                {out.map((_, i) => (
                  <th key={i}>D{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className={e === 0 ? 'hit' : ''}>
                <td>0</td>
                <td>× × ×</td>
                {out.map((_, i) => (
                  <td key={i}>0</td>
                ))}
              </tr>
              {Array.from({ length: 8 }, (_, v) => (
                <tr key={v} className={e === 1 && v === a ? 'hit' : ''}>
                  <td>1</td>
                  <td>{v.toString(2).padStart(3, '0').split('').join(' ')}</td>
                  {decoder(v, 3).map((d, i) => (
                    <td key={i} style={{ color: d ? 'var(--active)' : undefined }}>
                      {d}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

export function EncoderBlock() {
  const { L } = useLang();
  const [d, setD] = useState(0b0010_0000);
  const inputs = Array.from({ length: 8 }, (_, i) => bitAt(d, i));
  const r = encoder(inputs);
  return (
    <>
      <BlockHeader title={L("8 × 3 encoder", "8 × 3 kodlayıcı")} refs="Sec. 2-2">
        {L("The inverse of a decoder: when input Di is 1, the outputs A2A1A0 give the binary code of i. Each output is an OR of the inputs whose code has a 1 in that position (A0 = D1 + D3 + D5 + D7, and so on). It assumes only one input is 1 at a time.", "Kod çözücünün tersi: Di girişi 1 olduğunda A2A1A0 çıkışları i'nin ikili kodunu verir. Her çıkış, kodunda o konumda 1 bulunan girişlerin OR'udur (A0 = D1 + D3 + D5 + D7 vb.). Aynı anda yalnızca bir girişin 1 olduğunu varsayar.")}
      </BlockHeader>
      <Panel title={L("Inputs and outputs", "Girişler ve çıkışlar")}>
        <BitInput label="D7 … D0" value={d} width={8} onChange={setD} names={inputs.map((_, i) => `D${i}`)} />
        <div className="row" style={{ marginTop: 14, alignItems: 'center' }}>
          <span className="result">
            A2 A1 A0 = {r.bits.slice().reverse().join(' ')}
          </span>
          {!r.valid && (
            <span className="notice">
              {inputs.filter(Boolean).length === 0
                ? L("No input is 1; the output 000 looks the same as D0 = 1.", "Hiçbir giriş 1 değil; 000 çıkışı D0 = 1 ile aynı görünür.")
                : L("More than one input is 1; the OR gates combine their codes, so the output is not meaningful (a priority encoder solves this).", "Birden fazla giriş 1; OR kapıları kodlarını birleştirir, bu yüzden çıkış anlamlı değildir (öncelikli kodlayıcı bunu çözer).")}
            </span>
          )}
        </div>
      </Panel>
    </>
  );
}

export function MuxBlock() {
  const { L } = useLang();
  const [data, setData] = useState(0b0110);
  const [s, setS] = useState(0b10);
  const inputs = Array.from({ length: 4 }, (_, i) => bitAt(data, i));
  const y = mux(inputs, s);
  return (
    <>
      <BlockHeader title={L("4 × 1 multiplexer", "4 × 1 çoklayıcı")} refs="Fig. 2-2">
        {L("The selection inputs S1S0 choose which data input reaches the output Y. Inside, a 2 × 4 decoder enables one AND gate per data input, and an OR gate collects them.", "S1S0 seçim girişleri hangi veri girişinin Y çıkışına ulaşacağını seçer. İçeride 2 × 4 bir kod çözücü her veri girişi için bir AND kapısını etkinleştirir, bir OR kapısı da bunları toplar.")}
      </BlockHeader>
      <div className="grid2">
        <Panel title={L("Inputs", "Girişler")}>
          <div className="row">
            <BitInput label="I3 I2 I1 I0" value={data} width={4} onChange={setData} names={['I0', 'I1', 'I2', 'I3']} />
            <BitInput label="S1 S0" value={s} width={2} onChange={setS} names={['S0', 'S1']} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 14, fontFamily: 'var(--mono)' }}>
            {inputs.map((v, i) => (
              <span key={i} style={{ color: i === s ? 'var(--active)' : 'var(--muted)' }}>
                I{i} = {v} {i === s ? '→ Y' : ''}
              </span>
            ))}
          </div>
          <p className="result" style={{ margin: '12px 0 0' }}>
            Y = {y}
          </p>
        </Panel>
        <Panel title={L("Function table", "Fonksiyon tablosu")}>
          <table className="data">
            <thead>
              <tr>
                <th>S1</th>
                <th>S0</th>
                <th>Y</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3].map((v) => (
                <tr key={v} className={v === s ? 'hit' : ''}>
                  <td>{v >> 1}</td>
                  <td>{v & 1}</td>
                  <td>I{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
