import { useState } from 'react';
import { type Bit } from '../../../core/bits';
import { busComponentCounts, clockTransfers, muxBus, triStateBus } from '../../../core/blocks/bus';
import { BlockHeader, useWord, WidthSelect } from '../../common/blocks';
import { BitInput, BitToggle, Panel, Ref, Word } from '../../common/controls';
import { useSettings } from '../../settings';

export function MemoryBlock() {
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
      <BlockHeader title="Memory unit" refs="Fig. 2-12" right={<WidthSelect />}>
        m words of n bits each. k address lines select one word, with 2^k = m. Read copies the selected word to the data output; Write stores the data input in it.
      </BlockHeader>
      <Panel title={`${m} × ${n} memory, k = ${k}`}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="seg" role="group" aria-label="Address bits k">
            {[2, 3, 4].map((x) => (
              <button key={x} aria-pressed={k === x} onClick={() => setK(x)}>
                k = {x}
              </button>
            ))}
          </div>
          <BitInput label="Address" value={a} width={k} onChange={setAddress} />
          <BitInput label="Data input" value={data} width={n} onChange={setData} />
          <button className="btn" onClick={() => setLastOp(`Read: word ${a} = ${(words[a] & mask).toString(2).padStart(n, '0')}`)}>
            Read
          </button>
          <button
            className="btn primary"
            onClick={() => {
              const w = words.slice();
              w[a] = data;
              setWords(w);
              setLastOp(`Write: word ${a} ← ${data.toString(2).padStart(n, '0')}`);
            }}
          >
            Write
          </button>
        </div>
        {lastOp && (
          <p className="mono" style={{ margin: '12px 0 0', color: 'var(--active)' }}>
            {lastOp}
          </p>
        )}
      </Panel>
      <Panel title="Contents">
        <table className="data">
          <thead>
            <tr>
              <th>Address</th>
              <th>Word</th>
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
      <BlockHeader title="Common bus: two implementations" refs="Fig. 4-3, 4-4, 4-5" right={<WidthSelect />}>
        Four registers share one bus. Both designs below receive the same registers and the same select value S1S0, and both put the same register on the bus.
      </BlockHeader>
      <Panel title="Registers and select">
        <div className="row">
          {NAMES.map((name, j) => (
            <BitInput key={name} label={`Register ${name} (S1S0 = ${j.toString(2).padStart(2, '0')})`} value={values[j]} width={n} onChange={(v) => setRegs(regs.map((r, i) => (i === j ? v : r)))} />
          ))}
          <BitInput label="S1 S0" value={s} width={2} onChange={setS} names={['S0', 'S1']} />
        </div>
      </Panel>
      <div className="grid2">
        <Panel title="Multiplexer bus" refs={<Ref>Fig. 4-3</Ref>}>
          <p className="muted" style={{ margin: '0 0 10px', fontSize: 14 }}>
            {n} multiplexers of size 4 × 1. MUX i receives bit i of every register; the shared select lines pick the same register in every MUX.
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
          {n > bitsShown && <p className="muted" style={{ fontSize: 13 }}>Showing bits 0-{bitsShown - 1} of {n}.</p>}
          <p className="result" style={{ margin: '12px 0 0' }}>
            Bus = <Word value={m.value} width={n} /> ({NAMES[s]})
          </p>
          <p className="mono muted" style={{ margin: '6px 0 0' }}>
            Components: {counts.mux.multiplexers} MUXes of {counts.mux.muxSize}
          </p>
        </Panel>
        <Panel title="Three-state buffer bus" refs={<Ref>Fig. 4-4, 4-5</Ref>}>
          <p className="muted" style={{ margin: '0 0 10px', fontSize: 14 }}>
            One buffer per register bit. A 2 × 4 decoder enables every buffer of one register; disabled buffers are in the high-impedance state Z and do not drive the bus.
          </p>
          <div className="chips" style={{ marginBottom: 10 }}>
            {t.enables.map((e, j) => (
              <span key={j} className={`chip ${e ? 'on' : ''}`}>
                enable {NAMES[j]} = {e}
              </span>
            ))}
          </div>
          <table className="data">
            <thead>
              <tr>
                <th>Register</th>
                <th>Buffer outputs (bit {bitsShown - 1} … 0)</th>
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
            Bus = <Word value={t.value} width={n} /> ({NAMES[s]})
          </p>
          <p className="mono muted" style={{ margin: '6px 0 0' }}>
            Components: {counts.triState.buffers} buffers + {counts.triState.decoders} decoder ({counts.triState.decoderSize})
          </p>
        </Panel>
      </div>
      <p className="notice" style={{ margin: 0 }}>
        Same select value, same result: {m.value === t.value ? 'both buses carry' : 'MISMATCH'} <Word value={m.value} width={n} />.
      </p>
    </>
  );
}

export function TransferBlock() {
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
      <BlockHeader title="Register transfer" refs="Fig. 4-2" right={<WidthSelect />}>
        The control function P is connected to R2's load input. The transfer happens on the clock edge only while P = 1. In the swap, both transfers use the values from before the pulse, so the registers really exchange their contents.
      </BlockHeader>
      <Panel title="Statement">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="seg" role="group" aria-label="Statement">
            <button aria-pressed={mode === 'copy'} onClick={() => setMode('copy')}>
              P: R2 ← R1
            </button>
            <button aria-pressed={mode === 'swap'} onClick={() => setMode('swap')}>
              T: R2 ← R1, R1 ← R2
            </button>
          </div>
          <BitToggle label={mode === 'copy' ? 'P (control)' : 'T (control)'} value={p} onChange={setP} />
        </div>
      </Panel>
      <Panel title="Registers">
        <div className="row" style={{ alignItems: 'center' }}>
          <BitInput label="R1" value={r1} width={n} onChange={setR1} />
          <BitInput label="R2" value={r2} width={n} onChange={setR2} />
          <button
            className="btn primary"
            onClick={() => {
              const next = clockTransfers({ R1: r1, R2: r2 }, p, transfers);
              setLast(p ? `Pulse ${pulses + 1}: transferred (pre-pulse R1 = ${r1.toString(2).padStart(n, '0')}, R2 = ${r2.toString(2).padStart(n, '0')})` : `Pulse ${pulses + 1}: control is 0, nothing changed`);
              setR1(next.R1);
              setR2(next.R2);
              setPulses(pulses + 1);
            }}
          >
            Clock pulse
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
