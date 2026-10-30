import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Bit } from '../../../core/bits';
import { aluTable } from '../../../core/alu/alu';
import { aluCircuit } from '../../../core/alu/aluSteps';
import { BitInput, BitToggle, Ref } from '../../common/controls';
import { useSettings } from '../../settings';
import { AluCircuit } from './AluCircuit';
import '../computer/computer.css';

const WIDTH = 4;

/** The ALU of Fig. 4-13 as a circuit you can step through, one settling stage at a time. */
export function AluCircuitPage() {
  const { encoding, setEncoding } = useSettings();
  const [a, setA] = useState(0b0110);
  const [b, setB] = useState(0b0011);
  const [select, setSelect] = useState(0b0001);
  const [cin, setCin] = useState<Bit>(0);
  const data = useMemo(() => aluCircuit(a, b, select, cin, WIDTH, encoding), [a, b, select, cin, encoding]);
  const last = data.steps.length - 1;
  const [step, setStep] = useState(last);
  const [playing, setPlaying] = useState(false);

  // Changing an input restarts the propagation from the inputs.
  const change = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setStep(0);
  };

  useEffect(() => {
    if (!playing) return;
    if (step >= last) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setStep((s) => s + 1), 900);
    return () => clearTimeout(id);
  }, [playing, step, last]);

  const table = aluTable(encoding);
  const s3s2 = select >> 2;
  const rowHit = (row: (typeof table)[number]) =>
    s3s2 >= 2 ? row.select === (s3s2 === 2 ? 8 : 12) : s3s2 === 1 ? row.select === select : row.select === select && row.cin === cin;

  return (
    <div className="computer">
      <section className="cbar" aria-label="ALU inputs and stepping">
        <BitInput label="A" value={a} width={WIDTH} onChange={change(setA)} />
        <BitInput label="B" value={b} width={WIDTH} onChange={change(setB)} />
        <BitInput label="S3 S2 S1 S0" value={select} width={4} onChange={change(setSelect)} names={['S0', 'S1', 'S2', 'S3']} />
        <BitToggle label="Cin" value={cin} onChange={change(setCin)} />
        <span style={{ display: 'flex', gap: 4, alignSelf: 'flex-end', marginLeft: 8 }}>
          <button className="btn" onClick={() => { setPlaying(false); setStep(Math.max(0, step - 1)); }} disabled={step === 0}>
            ‹ Back
          </button>
          <button className="btn primary" onClick={() => { setPlaying(false); setStep(Math.min(last, step + 1)); }} disabled={step === last}>
            Step ›
          </button>
          <button className="btn" onClick={() => { if (step >= last) setStep(0); setPlaying(!playing); }}>
            {playing ? 'Pause' : step >= last ? 'Replay' : 'Play'}
          </button>
          <button className="btn" onClick={() => { setPlaying(false); setStep(last); }} disabled={step === last}>
            Result
          </button>
        </span>
        <div className="seg" role="radiogroup" aria-label="Arithmetic encoding" style={{ alignSelf: 'flex-end', marginLeft: 'auto' }}>
          <button role="radio" aria-checked={encoding === 'table4-8'} onClick={() => { setEncoding('table4-8'); setStep(0); }}>
            Table 4-8 (as printed)
          </button>
          <button role="radio" aria-checked={encoding === 'fig4-9'} onClick={() => { setEncoding('fig4-9'); setStep(0); }}>
            Fig. 4-9 wiring
          </button>
        </div>
      </section>

      <div className="workbench">
        <div className="stage">
          <AluCircuit data={data} step={step} />
          <p className="expect">
            <b>{data.operation}</b> · all {WIDTH} stages share the select lines; the carry ripples from stage 0 to stage {WIDTH - 1}. More detail on each part:{' '}
            <Link to="/lab/arithmetic">arithmetic circuit</Link>, <Link to="/lab/logic">logic circuit</Link>, <Link to="/lab/status">status bits</Link>.
          </p>
        </div>
        <aside className="side">
          <section className="panel step-panel" aria-label="Propagation steps">
            <div className="panel-head" style={{ marginBottom: 6 }}>
              <span className="cap">Arithmetic logic shift unit</span>
              <Ref>Fig. 4-13</Ref>
            </div>
            <div className="mono rtl-sm">
              <span className="cf">S3S2S1S0 = {select.toString(2).padStart(4, '0')}, Cin = {cin}:</span> {data.operation}
            </div>
            <ol className="substeps">
              {data.steps.map((s, i) => {
                const state = i < step ? 'done' : i === step ? 'current' : 'todo';
                return (
                  <li key={i} className={state}>
                    <button className="substep-head" onClick={() => { setPlaying(false); setStep(i); }} aria-current={state === 'current' ? 'step' : undefined}>
                      <span className="substep-no">{i + 1}</span>
                      {s.title}
                    </button>
                    {state === 'current' && (
                      <div className="substep-text">
                        {s.text.map((p, k) => (
                          <p key={k}>{p}</p>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
          <section className="panel" aria-label="Table 4-8">
            <div className="panel-head">
              <span className="cap">Table 4-8 · click a row</span>
              <Ref>Table 4-8</Ref>
            </div>
            <table className="data" style={{ width: '100%' }}>
              <tbody>
                {table.map((row) => (
                  <tr
                    key={`${row.select}-${row.cin}`}
                    className={rowHit(row) ? 'hit' : ''}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSelect(row.select);
                      if (row.cin !== null) setCin(row.cin);
                      setStep(0);
                    }}
                  >
                    <td>{row.select >= 8 ? `${(row.select >> 2).toString(2)}××` : row.select.toString(2).padStart(4, '0')}</td>
                    <td>{row.cin ?? '×'}</td>
                    <td>{row.operation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </aside>
      </div>
    </div>
  );
}
