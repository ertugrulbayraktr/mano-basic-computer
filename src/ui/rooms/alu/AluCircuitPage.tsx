import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Bit } from '../../../core/bits';
import { aluTable } from '../../../core/alu/alu';
import { aluCircuit, aluSnapshot } from '../../../core/alu/aluSteps';
import { BitInput, BitToggle, Ref } from '../../common/controls';
import { useLang, useSettings } from '../../settings';
import { Icon } from '../computer/Transport';
import { AluCircuit } from './AluCircuit';
import '../computer/computer.css';

const WIDTH = 4;
const SPW = 92; // width of one propagation step in the timeline

/**
 * The ALU of Fig. 4-13 on the same workbench as the Basic Computer: the circuit, the propagation
 * steps and Table 4-8 in the inspector, and a dock with the inputs and a propagation timeline.
 */
export function AluCircuitPage() {
  const { encoding, setEncoding } = useSettings();
  const { lang, L } = useLang();
  const [a, setA] = useState(0b0110);
  const [b, setB] = useState(0b0011);
  const [select, setSelect] = useState(0b0001);
  const [cin, setCin] = useState<Bit>(0);
  const [follow, setFollow] = useState(false);
  const data = useMemo(() => aluCircuit(a, b, select, cin, WIDTH, encoding, lang), [a, b, select, cin, encoding, lang]);
  const last = data.steps.length - 1;
  const [step, setStep] = useState(last);
  const [playing, setPlaying] = useState(false);
  const dockHeight = useSettings((s) => s.dockHeight);

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
    const id = setTimeout(() => setStep((s) => s + 1), 1000);
    return () => clearTimeout(id);
  }, [playing, step, last]);

  const table = aluTable(encoding);
  const s3s2 = select >> 2;
  const rowHit = (row: (typeof table)[number]) =>
    s3s2 >= 2 ? row.select === (s3s2 === 2 ? 8 : 12) : s3s2 === 1 ? row.select === select : row.select === select && row.cin === cin;
  const current = data.steps[step];
  const lanes = data.steps.map((_, i) => aluSnapshot(data, i));

  return (
    <div className="computer">
      <div className="bench" style={{ ['--dock-h' as string]: `${Math.max(dockHeight, 230)}px` }}>
        <div className="bench-stage">
          <div className="stage-tools" role="toolbar" aria-label={L('Circuit view', 'Devre görünümü')}>
            <button className="btn small" aria-pressed={follow} onClick={() => setFollow(!follow)} title={L('The camera follows the propagation, stage by stage', 'Kamera yayılımı kat kat takip eder')}>
              {L('Follow', 'Takip')}
            </button>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {data.operation}.{' '}
              {L(
                `All ${WIDTH} stages share the select lines; the carry ripples from stage 0 to stage ${WIDTH - 1}.`,
                `${WIDTH} katın hepsi aynı seçim hatlarını paylaşır; elde kat 0'dan kat ${WIDTH - 1}'e yayılır.`,
              )}
            </span>
          </div>
          <AluCircuit data={data} step={step} follow={follow} />
          {follow && (
            <p className="caption" aria-live="polite">
              <b>{current.title}</b>
              {current.text[0]}
            </p>
          )}
        </div>

        <aside className="bench-inspector" aria-label={L('Inspector', 'İnceleme')}>
          <section className="step-panel" aria-label={L('Propagation steps', 'Yayılım adımları')}>
            <div className="panel-head" style={{ marginBottom: 2 }}>
              <h2 className="step-title">{L('Arithmetic logic shift unit', 'Aritmetik mantık kaydırma birimi')}</h2>
              <Ref>Fig. 4-13</Ref>
            </div>
            <div className="rtl-sm">
              <span className="cf">S3S2S1S0 = {select.toString(2).padStart(4, '0')}, Cin = {cin}:</span> {data.operation}
            </div>
            <ol className="substeps">
              {data.steps.map((s, i) => {
                const state = i < step ? 'done' : i === step ? 'current' : 'todo';
                return (
                  <li key={i} className={state}>
                    <button
                      className="substep-head"
                      onClick={() => {
                        setPlaying(false);
                        setStep(i);
                      }}
                      aria-current={state === 'current' ? 'step' : undefined}
                    >
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
          <section aria-label={L('Function table', 'Fonksiyon tablosu')}>
            <div className="panel-head">
              <span className="cap">{L('Function table: click a row to choose it', 'Fonksiyon tablosu: seçmek için bir satıra tıkla')}</span>
              <Ref>Table 4-8</Ref>
            </div>
            <div className="seg" role="radiogroup" aria-label={L('Arithmetic encoding', 'Aritmetik kodlama')} style={{ marginBottom: 10 }}>
              <button role="radio" aria-checked={encoding === 'table4-8'} onClick={() => { setEncoding('table4-8'); setStep(0); }}>
                {L('As printed', 'Basıldığı gibi')}
              </button>
              <button role="radio" aria-checked={encoding === 'fig4-9'} onClick={() => { setEncoding('fig4-9'); setStep(0); }}>
                {L('Fig. 4-9 wiring', 'Şekil 4-9 bağlantısı')}
              </button>
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
            <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0' }}>
              {L('Each part on its own:', 'Her parça ayrı ayrı:')} <Link to="/lab/arithmetic">{L('arithmetic circuit', 'aritmetik devre')}</Link>,{' '}
              <Link to="/lab/logic">{L('logic circuit', 'mantık devresi')}</Link>, <Link to="/lab/status">{L('status bits', 'durum bitleri')}</Link>.
            </p>
          </section>
        </aside>

        <div className="bench-dock">
          <section className="transport" aria-label={L('Inputs and stepping', 'Girişler ve adımlama')}>
            <div className="transport-row">
              <button className="btn icon" aria-label={L('Back one step', 'Bir adım geri')} onClick={() => { setPlaying(false); setStep(Math.max(0, step - 1)); }} disabled={step === 0}>
                <Icon d="M15 5l-7 7 7 7" />
              </button>
              <button className="btn primary grow" onClick={() => { setPlaying(false); setStep(Math.min(last, step + 1)); }} disabled={step === last}>
                {L('Step', 'Adım')}
              </button>
              <button className="btn" onClick={() => { if (step >= last) setStep(0); setPlaying(!playing); }}>
                {playing ? L('Pause', 'Duraklat') : step >= last ? L('Replay', 'Yeniden oynat') : L('Play', 'Oynat')}
              </button>
              <button className="btn" onClick={() => { setPlaying(false); setStep(last); }} disabled={step === last}>
                {L('Result', 'Sonuç')}
              </button>
            </div>
            <div className="alu-inputs">
              <BitInput label="A" value={a} width={WIDTH} onChange={change(setA)} />
              <BitInput label="B" value={b} width={WIDTH} onChange={change(setB)} />
              <BitInput label="S3 S2 S1 S0" value={select} width={4} onChange={change(setSelect)} names={['S0', 'S1', 'S2', 'S3']} />
              <BitToggle label="Cin" value={cin} onChange={change(setCin)} />
            </div>
          </section>

          <div className="timing" aria-label={L('Propagation timeline', 'Yayılım zaman çizelgesi')}>
            <div className="timing-labels" style={{ width: 90 }}>
              <div className="tl-label muted" style={{ height: 26, marginTop: 3 }}>
                {L('Step', 'Adım')}
              </div>
              {lanes[0].map((l) => (
                <div key={l.id} className="tl-label" style={{ height: 26 }}>
                  <span className="mono">{l.label}</span>
                </div>
              ))}
            </div>
            <div className="timing-scroll">
              <svg
                width={data.steps.length * SPW + 20}
                height={26 * 7 + 6}
                className="timing-svg"
                role="slider"
                tabIndex={0}
                aria-label={L('Propagation step', 'Yayılım adımı')}
                aria-valuemin={1}
                aria-valuemax={data.steps.length}
                aria-valuenow={step + 1}
                onPointerDown={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setPlaying(false);
                  setStep(Math.max(0, Math.min(last, Math.floor((e.clientX - r.left) / SPW))));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') setStep(Math.max(0, step - 1));
                  if (e.key === 'ArrowRight') setStep(Math.min(last, step + 1));
                }}
              >
                {data.steps.map((s, i) => (
                  <g key={i}>
                    <rect x={i * SPW} y={0} width={SPW} height={26 * 7 + 6} fill={i === step ? 'var(--paper-2)' : 'transparent'}>
                      <title>{s.title}</title>
                    </rect>
                    <text x={i * SPW + 6} y={20} fontSize={10.5} fill={i === step ? 'var(--ink)' : 'var(--muted)'} fontWeight={i === step ? 600 : 400}>
                      {i + 1}. {s.title.replace('Full adder', 'FA').replace('Tam toplayıcı', 'FA').replace(' multiplexers', ' MUX').replace(' çoklayıcıları', ' MUX').replace('Inputs and select lines', 'Inputs').replace('Girişler ve seçim hatları', 'Girişler')}
                    </text>
                    {lanes[i].map((l, k) => {
                      const y = 3 + 26 * (k + 1);
                      const changed = i > 0 && lanes[i - 1][k].value !== l.value;
                      return (
                        <g key={l.id}>
                          {changed && <rect x={i * SPW + 4} y={y + 4} width={SPW - 8} height={18} rx={3} fill="var(--highlight-soft)" />}
                          <text x={i * SPW + SPW / 2} y={y + 13} textAnchor="middle" dominantBaseline="middle" fontSize={12.5} fontFamily="var(--mono)" fill={l.value.includes('·') ? 'var(--muted)' : 'var(--ink)'} letterSpacing="0.12em">
                            {l.value}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                ))}
                <line x1={(step + 1) * SPW} x2={(step + 1) * SPW} y1={0} y2={26 * 7 + 6} stroke="var(--ink)" strokeWidth={1.5} />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
