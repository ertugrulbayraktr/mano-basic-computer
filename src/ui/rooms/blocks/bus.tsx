import { useState } from 'react';
import { toBin, type Bit } from '../../../core/bits';
import { busComponentCounts, clockTransfers, muxBus, triStateBus } from '../../../core/blocks/bus';
import { BlockHeader, useWord, WidthSelect } from '../../common/blocks';
import { BitInput, BitToggle, Panel, Ref, Word } from '../../common/controls';
import { useLang, useSettings } from '../../settings';

export function MemoryBlock() {
  const { L } = useLang();
  const n = useSettings((s) => s.width);
  const [k, setK] = useState(3);
  const [words, setWords] = useState<number[]>(() => new Array(16).fill(0).map((_, i) => (i * 5 + 3) & 0xffff));
  const [address, setAddress] = useState(2);
  const [data, setData] = useWord(0b1001, n);
  const [lastOp, setLastOp] = useState<string | null>(null);
  const m = 2 ** k;
  const a = address % m;
  const mask = 2 ** n - 1;
  return (
    <>
      <BlockHeader title={L("Memory unit", "Bellek birimi")} refs="Fig. 2-12" right={<WidthSelect />}>
        {L("m words of n bits each. k address lines select one word, with 2^k = m. Read copies the selected word to the data output; Write stores the data input in it.", "Her biri n bitlik m kelime. k adres hattı bir kelime seçer, 2^k = m. Oku seçili kelimeyi veri çıkışına kopyalar; Yaz veri girişini o kelimeye yazar.")}
      </BlockHeader>
      <Panel title={L(`${m} × ${n} memory, k = ${k}`, `${m} × ${n} bellek, k = ${k}`)}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="seg" role="group" aria-label={L("Address bits k", "Adres bitleri k")}>
            {[2, 3, 4].map((x) => (
              <button key={x} aria-pressed={k === x} onClick={() => setK(x)}>
                k = {x}
              </button>
            ))}
          </div>
          <BitInput label={L("Address", "Adres")} value={a} width={k} onChange={setAddress} />
          <BitInput label={L("Data input", "Veri girişi")} value={data} width={n} onChange={setData} />
          <button className="btn" onClick={() => setLastOp(`${L('Read: word', 'Oku: kelime')} ${a} = ${(words[a] & mask).toString(2).padStart(n, '0')}`)}>
            {L("Read", "Oku")}
          </button>
          <button
            className="btn primary"
            onClick={() => {
              const w = words.slice();
              w[a] = data;
              setWords(w);
              setLastOp(`${L('Write: word', 'Yaz: kelime')} ${a} ← ${data.toString(2).padStart(n, '0')}`);
            }}
          >
            {L("Write", "Yaz")}
          </button>
        </div>
        {lastOp && (
          <p className="mono" style={{ margin: '12px 0 0', color: 'var(--active)' }}>
            {lastOp}
          </p>
        )}
      </Panel>
      <Panel title={L("Contents", "İçerik")}>
        <table className="data">
          <thead>
            <tr>
              <th>{L("Address", "Adres")}</th>
              <th>{L("Word", "Kelime")}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: m }, (_, i) => (
              <tr key={i} className={i === a ? 'hit' : ''} onClick={() => setAddress(i)} style={{ cursor: 'pointer' }}>
                <td>{i.toString(2).padStart(k, '0')}</td>
                <td>
                  <Word value={words[i] & mask} width={n} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

const NAMES = ['A', 'B', 'C', 'D'];

export function BusBlock() {
  const { L } = useLang();
  const n = useSettings((s) => s.width);
  const [regs, setRegs] = useState([0b0001, 0b1010, 0b1100, 0b0111]);
  const [s, setS] = useState(1);
  const values = regs.map((r) => r & (2 ** n - 1));
  const m = muxBus(values, s, n);
  const t = triStateBus(values, s, n);
  const counts = busComponentCounts(4, n);
  const bitsShown = Math.min(n, 8);
  return (
    <>
      <BlockHeader title={L("Common bus: two implementations", "Ortak yol: iki gerçekleme")} refs="Fig. 4-3, 4-4, 4-5" right={<WidthSelect />}>
        {L("Four registers share one bus. Both designs below receive the same registers and the same select value S1S0, and both put the same register on the bus.", "Dört yazmaç tek bir ortak yolu paylaşır. Aşağıdaki iki tasarım da aynı yazmaçları ve aynı S1S0 seçim değerini alır; ikisi de yola aynı yazmacı koyar.")}
      </BlockHeader>
      <Panel title={L("Registers and select", "Yazmaçlar ve seçim")}>
        <div className="row">
          {NAMES.map((name, j) => (
            <BitInput key={name} label={`${L('Register', 'Yazmaç')} ${name} (S1S0 = ${j.toString(2).padStart(2, '0')})`} value={values[j]} width={n} onChange={(v) => setRegs(regs.map((r, i) => (i === j ? v : r)))} />
          ))}
          <BitInput label="S1 S0" value={s} width={2} onChange={setS} names={['S0', 'S1']} />
        </div>
      </Panel>
      <div className="grid2">
        <Panel title={L("Multiplexer bus", "Çoklayıcılı yol")} refs={<Ref>Fig. 4-3</Ref>}>
          <p className="muted" style={{ margin: '0 0 10px', fontSize: 14 }}>
            {L(
              `${n} multiplexers of size 4 × 1. MUX i receives bit i of every register; the shared select lines pick the same register in every MUX.`,
              `4 × 1 boyutunda ${n} çoklayıcı. MUX i her yazmacın i. bitini alır; ortak seçim hatları her MUX'ta aynı yazmacı seçer.`,
            )}
          </p>
          <table className="data">
            <thead>
              <tr>
                <th>MUX</th>
                {NAMES.map((x, j) => (
                  <th key={x}>
                    in{j} ({x})
                  </th>
                ))}
                <th>out</th>
              </tr>
            </thead>
            <tbody>
              {m.muxes
                .slice(0, bitsShown)
                .map((mx, i) => ({ mx, i }))
                .reverse()
                .map(({ mx, i }) => (
                  <tr key={i}>
                    <td>MUX {i}</td>
                    {mx.inputs.map((b, j) => (
                      <td key={j} style={{ color: j === s ? 'var(--active)' : 'var(--muted)' }}>
                        {b}
                      </td>
                    ))}
                    <td style={{ color: 'var(--active)' }}>{mx.out}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {n > bitsShown && <p className="muted" style={{ fontSize: 13 }}>{L(`Showing bits 0-${bitsShown - 1} of ${n}.`, `${n} bitin 0-${bitsShown - 1} arası gösteriliyor.`)}</p>}
          <p className="result" style={{ margin: '12px 0 0' }}>
            {L('Bus', 'Yol')} = {toBin(m.value, n)}, {L('from register', 'kaynak yazmaç')} {NAMES[s]}
          </p>
          <p className="mono muted" style={{ margin: '6px 0 0' }}>
            {L('Components', 'Bileşenler')}: {counts.mux.multiplexers} {L('MUXes of', 'MUX, her biri')} {counts.mux.muxSize}
          </p>
        </Panel>
        <Panel title={L("Three-state buffer bus", "Üç durumlu tampon yolu")} refs={<Ref>Fig. 4-4, 4-5</Ref>}>
          <p className="muted" style={{ margin: '0 0 10px', fontSize: 14 }}>
            {L("One buffer per register bit. A 2 × 4 decoder enables every buffer of one register; disabled buffers are in the high-impedance state Z and do not drive the bus.", "Her yazmaç biti için bir tampon. 2 × 4 bir kod çözücü bir yazmacın tüm tamponlarını etkinleştirir; etkin olmayan tamponlar yüksek empedans durumu Z'dedir ve yolu sürmez.")}
          </p>
          <div className="chips" style={{ marginBottom: 10 }}>
            {t.enables.map((e, j) => (
              <span key={j} className={`chip ${e ? 'on' : ''}`}>
                {L('enable', 'etkin')} {NAMES[j]} = {e}
              </span>
            ))}
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>{L("Register", "Yazmaç")}</th>
                <th>{L('Buffer outputs', 'Tampon çıkışları')} (bit {bitsShown - 1} … 0)</th>
              </tr>
            </thead>
            <tbody>
              {t.buffers.map((row, j) => (
                <tr key={j} className={j === s ? 'hit' : ''}>
                  <td>{NAMES[j]}</td>
                  <td>{row.slice(0, bitsShown).slice().reverse().join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="result" style={{ margin: '12px 0 0' }}>
            {L('Bus', 'Yol')} = {toBin(t.value, n)}, {L('from register', 'kaynak yazmaç')} {NAMES[s]}
          </p>
          <p className="mono muted" style={{ margin: '6px 0 0' }}>
            {L('Components', 'Bileşenler')}: {counts.triState.buffers} {L('buffers', 'tampon')} + {counts.triState.decoders} {L('decoder', 'kod çözücü')} ({counts.triState.decoderSize})
          </p>
        </Panel>
      </div>
      <p className="notice" style={{ margin: 0 }}>
        {L('Same select value, same result:', 'Aynı seçim değeri, aynı sonuç:')} {m.value === t.value ? L('both buses carry', 'iki yol da taşıyor') : L('MISMATCH', 'UYUŞMAZLIK')} {toBin(m.value, n)}.
      </p>
    </>
  );
}

export function TransferBlock() {
  const { L } = useLang();
  const n = useSettings((s) => s.width);
  const [r1, setR1] = useWord(0b0101, n);
  const [r2, setR2] = useWord(0b1110, n);
  const [p, setP] = useState<Bit>(1);
  const [mode, setMode] = useState<'copy' | 'swap'>('copy');
  const [pulses, setPulses] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const transfers = mode === 'copy' ? [{ to: 'R2', from: 'R1' }] : [{ to: 'R2', from: 'R1' }, { to: 'R1', from: 'R2' }];
  return (
    <>
      <BlockHeader title={L("Register transfer", "Yazmaç aktarımı")} refs="Fig. 4-2" right={<WidthSelect />}>
        {L("The control function P is connected to R2's load input. The transfer happens on the clock edge only while P = 1. In the swap, both transfers use the values from before the pulse, so the registers really exchange their contents.", "P kontrol fonksiyonu R2'nin yükleme girişine bağlıdır. Aktarım yalnızca P = 1 iken saat kenarında olur. Takasta iki aktarım da darbe öncesi değerleri kullanır; böylece yazmaçlar içeriklerini gerçekten değiş tokuş eder.")}
      </BlockHeader>
      <Panel title={L("Statement", "İfade")}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="seg" role="group" aria-label={L("Statement", "İfade")}>
            <button aria-pressed={mode === 'copy'} onClick={() => setMode('copy')}>
              P: R2 ← R1
            </button>
            <button aria-pressed={mode === 'swap'} onClick={() => setMode('swap')}>
              T: R2 ← R1, R1 ← R2
            </button>
          </div>
          <BitToggle label={mode === 'copy' ? L("P (control)", "P (kontrol)") : L("T (control)", "T (kontrol)")} value={p} onChange={setP} />
        </div>
      </Panel>
      <Panel title={L("Registers", "Yazmaçlar")}>
        <div className="row" style={{ alignItems: 'center' }}>
          <BitInput label="R1" value={r1} width={n} onChange={setR1} />
          <BitInput label="R2" value={r2} width={n} onChange={setR2} />
          <button
            className="btn primary"
            onClick={() => {
              const next = clockTransfers({ R1: r1, R2: r2 }, p, transfers);
              setLast(p ? `${L('Pulse', 'Darbe')} ${pulses + 1}: ${L('transferred (pre-pulse', 'aktarıldı (darbe öncesi')} R1 = ${r1.toString(2).padStart(n, '0')}, R2 = ${r2.toString(2).padStart(n, '0')})` : `${L('Pulse', 'Darbe')} ${pulses + 1}: ${L('control is 0, nothing changed', 'kontrol 0, hiçbir şey değişmedi')}`);
              setR1(next.R1);
              setR2(next.R2);
              setPulses(pulses + 1);
            }}
          >
            {L("Clock pulse", "Saat darbesi")}
          </button>
        </div>
        {last && (
          <p className="mono" style={{ margin: '12px 0 0', color: 'var(--text-2)' }}>
            {last}
          </p>
        )}
      </Panel>
    </>
  );
}
