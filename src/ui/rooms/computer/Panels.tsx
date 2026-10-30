import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AC_OP_LABEL } from '../../../core/basic/adderLogic';
import type { AcOp } from '../../../core/basic/control';
import { Ref, Word } from '../../common/controls';
import { useSettings } from '../../settings';
import { useComputer, useSim } from './store';

export function HistoryPanel() {
  const sim = useSim();
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [sim.history.length]);
  return (
    <section className="panel" aria-label="Instruction history">
      <div className="panel-head">
        <span className="cap">Instruction history</span>
        <span className="cap">{sim.history.length} so far</span>
      </div>
      {sim.history.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No instruction has started yet.</p>
      ) : (
        <ol className="history" ref={list}>
          {sim.history.map((h, i) => {
            const current = i === sim.history.length - 1 && sim.state.SC !== 0;
            return (
              <li key={i} className={current ? 'current' : ''}>
                <span className="muted">#{i + 1}</span>
                <Word value={h.address} width={12} />
                <span>{h.kind === 'interrupt' ? '—' : <Word value={h.word} width={16} />}</span>
                <span style={{ color: h.kind === 'interrupt' ? 'var(--amber)' : 'var(--text)' }}>{h.text}</span>
                <span className="muted">{current ? `T${sim.state.SC}…` : `p${h.pulse}`}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function IODevices() {
  const sim = useSim();
  const pressKey = useComputer((s) => s.pressKey);
  const { printerDelay, setPrinterDelay } = useSettings();
  const [last, setLast] = useState<string | null>(null);
  return (
    <section className="panel" aria-label="Input and output devices" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <span className="cap">I/O devices</span>
        <Ref title="Fig. 5-12: Input-output configuration">Fig. 5-12</Ref>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
          Keyboard → INPR <span className="mono muted">(accepted only when FGI = 0)</span>
        </span>
        <input
          className="input mono"
          placeholder="Click here and type a character"
          value=""
          onChange={() => {}}
          onKeyDown={(e) => {
            const ch = e.key === 'Enter' ? '\r' : e.key.length === 1 ? e.key : null;
            if (ch === null) return;
            e.preventDefault();
            setLast(pressKey(ch) ? `'${ch === '\r' ? 'CR' : ch}' → INPR = ${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}, FGI = 1` : 'Rejected: FGI is still 1');
          }}
          style={{ minHeight: 44 }}
        />
        {last && <span className="mono muted" style={{ fontSize: 12 }}>{last}</span>}
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 14, color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          Printer ← OUTR · FGO returns to 1 after
          <input
            className="input mono"
            type="number"
            min={1}
            max={999}
            value={printerDelay}
            aria-label="Printer delay in pulses"
            onChange={(e) => setPrinterDelay(Number(e.target.value) || 1)}
            style={{ width: 70, minHeight: 28 }}
          />
          pulses
          {sim.devices.printerBusy > 0 && <span className="mono" style={{ color: 'var(--amber)' }}>busy: {sim.devices.printerBusy}</span>}
        </span>
        <div className="printer" aria-live="polite" aria-label="Printer output">
          {sim.devices.printed.replace(/\r/g, '\n')}
          <span style={{ opacity: 0.6 }}>▌</span>
        </div>
      </div>
    </section>
  );
}

/** One stage of the adder and logic circuit that loads AC (Fig. 5-21). */
const AC_INPUTS: { op: AcOp; control: string; data: string }[] = [
  { op: 'AND', control: 'D0T5', data: 'AC(i) ∧ DR(i)' },
  { op: 'ADD', control: 'D1T5', data: 'adder sum(i)' },
  { op: 'DR', control: 'D2T5', data: 'DR(i)' },
  { op: 'INPR', control: 'pB11', data: 'INPR(i), i < 8' },
  { op: 'COM', control: 'rB9', data: "AC(i)'" },
  { op: 'SHR', control: 'rB7', data: 'AC(i + 1)' },
  { op: 'SHL', control: 'rB6', data: 'AC(i − 1)' },
];

export function AluDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sim = useSim();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const t = sim.lastTrace;
  const active = new Map(t?.acPaths.map((p) => [p.op, p]));
  const rowH = 44;
  return (
    <dialog ref={ref} className="modal" onClose={onClose} aria-labelledby="alu-title">
      <div className="panel-head">
        <h2 id="alu-title" style={{ margin: 0, fontSize: 22 }}>
          Adder and logic circuit for AC
        </h2>
        <Ref title="Fig. 5-21: One stage of adder and logic circuit">Fig. 5-21</Ref>
      </div>
      <p style={{ margin: '0 0 12px', color: 'var(--text-2)', lineHeight: 1.5 }}>
        One stage i of 16. Each AND gate passes its data input only while its control function is 1; the OR gate feeds AC(i) when AC's LD is enabled. INC uses AC's INR input (rB5) and CLA its CLR input (rB11), so they do not go through this circuit. The carry out of the adder goes to E.
      </p>
      <div className="scroll-x">
        <svg width={720} height={AC_INPUTS.length * rowH + 20} role="img" aria-label="Fig. 5-21 one stage of the AC adder and logic circuit, active inputs highlighted">
          {AC_INPUTS.map((inp, i) => {
            const y = 20 + i * rowH;
            const on = active.has(inp.op);
            const col = on ? 'var(--cyan)' : 'var(--line)';
            return (
              <g key={inp.op}>
                <text x={0} y={y + 12} fontFamily="var(--mono)" fontSize={13} fill={on ? 'var(--cyan)' : 'var(--muted)'}>
                  {inp.control}
                </text>
                <text x={0} y={y + 28} fontFamily="var(--mono)" fontSize={12} fill="var(--text-2)">
                  {inp.data}
                </text>
                <line x1={150} x2={260} y1={y + 8} y2={y + 8} stroke={col} strokeWidth={2} />
                <line x1={150} x2={260} y1={y + 24} y2={y + 24} stroke={col} strokeWidth={2} />
                <path d={`M260 ${y} h18 a16 16 0 0 1 0 32 h-18 z`} fill="var(--box)" stroke={col} strokeWidth={2} />
                <line x1={294} x2={470} y1={y + 16} y2={160} stroke={col} strokeWidth={on ? 2 : 1.5} />
                <text x={310} y={y + 12} fontFamily="var(--sans)" fontSize={12} fill={on ? 'var(--text)' : 'var(--muted)'}>
                  {AC_OP_LABEL[inp.op]}
                </text>
              </g>
            );
          })}
          <path d="M470 130 q30 0 50 30 q-20 30 -50 30 q14 -30 0 -60 z" fill="var(--box)" stroke={active.size ? 'var(--cyan)' : 'var(--line)'} strokeWidth={2} />
          <line x1={520} x2={600} y1={160} y2={160} stroke={active.size ? 'var(--cyan)' : 'var(--line)'} strokeWidth={2} />
          <text x={606} y={156} fontFamily="var(--mono)" fontSize={14} fill="var(--text)">
            to AC(i)
          </text>
          <text x={606} y={176} fontFamily="var(--mono)" fontSize={12} fill="var(--muted)">
            LD = {active.size ? '1' : '0'}
          </text>
        </svg>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        <span className="mono" style={{ fontSize: 14 }}>
          Last pulse:{' '}
          {t && t.acPaths.length ? (
            t.acPaths.map((p) => (
              <span key={p.op} style={{ marginRight: 12 }}>
                {AC_OP_LABEL[p.op]} → <Word value={p.ac} width={16} className="changed-value" />
                {p.e !== undefined && <> , E ← {p.e}</>}
              </span>
            ))
          ) : (
            <span className="muted">circuit not used</span>
          )}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Link to="/alu/alu" className="btn" onClick={onClose}>
            Explore the general ALU in Room 2 ›
          </Link>
          <button className="btn primary" onClick={onClose}>
            Close
          </button>
        </span>
      </div>
    </dialog>
  );
}
