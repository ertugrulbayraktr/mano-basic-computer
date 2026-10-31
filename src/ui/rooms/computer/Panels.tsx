import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AC_OP_LABEL, AC_OP_LABEL_TR } from '../../../core/basic/adderLogic';
import type { AcOp } from '../../../core/basic/control';
import { Ref, Word } from '../../common/controls';
import { useLang, useSettings } from '../../settings';
import { useComputer, useSim } from './store';

export function IODevices() {
  const sim = useSim();
  const pressKey = useComputer((s) => s.pressKey);
  const { printerDelay, setPrinterDelay } = useSettings();
  const [last, setLast] = useState<string | null>(null);
  const { L } = useLang();
  const send = (ch: string) =>
    setLast(
      pressKey(ch)
        ? `'${ch === '\r' ? 'CR' : ch}' → INPR = ${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}, FGI = 1`
        : L('Rejected: FGI is still 1', 'Reddedildi: FGI hâlâ 1'),
    );
  return (
    <section className="panel" aria-label={L('Input and output devices', 'Giriş ve çıkış aygıtları')} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <span className="cap">{L('I/O devices', 'G/Ç aygıtları')}</span>
        <Ref title={L('Fig. 5-12: Input-output configuration', 'Şekil 5-12: Giriş-çıkış yapılandırması')}>Fig. 5-12</Ref>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 14, color: 'var(--text-2)' }}>
          {L('Keyboard', 'Klavye')} → INPR <span className="mono muted">{L('(accepted only when FGI = 0)', '(yalnızca FGI = 0 iken kabul edilir)')}</span>
        </span>
        <input
          className="input mono"
          placeholder={L('Click here and type a character', 'Buraya tıkla ve bir karakter yaz')}
          value=""
          // Text that arrives without a keydown (paste, IME, automation) is handled here.
          onChange={(e) => {
            const ch = e.target.value.slice(-1);
            if (ch) send(ch);
          }}
          onKeyDown={(e) => {
            const ch = e.key === 'Enter' ? '\r' : e.key.length === 1 && !e.ctrlKey && !e.metaKey ? e.key : null;
            if (ch === null) return;
            e.preventDefault();
            send(ch);
          }}
          style={{ minHeight: 44 }}
        />
        {last && <span className="mono muted" style={{ fontSize: 12 }}>{last}</span>}
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 14, color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {L('Printer', 'Yazıcı')} ← OUTR. {L('FGO returns to 1 after', 'FGO şu kadar sonra 1 olur:')}
          <input
            className="input mono"
            type="number"
            min={1}
            max={999}
            value={printerDelay}
            aria-label={L('Printer delay in pulses', 'Yazıcı gecikmesi (darbe)')}
            onChange={(e) => setPrinterDelay(Number(e.target.value) || 1)}
            style={{ width: 70, minHeight: 28 }}
          />
          {L('pulses', 'darbe')}
          {sim.devices.printerBusy > 0 && <span className="mono" style={{ color: 'var(--changed)' }}>{L('busy', 'meşgul')}: {sim.devices.printerBusy}</span>}
        </span>
        <div className="printer" aria-live="polite" aria-label={L('Printer output', 'Yazıcı çıktısı')}>
          {sim.devices.printed.replace(/\r/g, '\n')}
          <span style={{ opacity: 0.6 }}>▌</span>
        </div>
      </div>
    </section>
  );
}

/** One stage of the adder and logic circuit that loads AC (Fig. 5-21). */
const AC_INPUTS: { op: AcOp; control: string; data: string; dataTr?: string }[] = [
  { op: 'AND', control: 'D0T5', data: 'AC(i) ∧ DR(i)' },
  { op: 'ADD', control: 'D1T5', data: 'adder sum(i)', dataTr: 'toplayıcı toplamı(i)' },
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
  // The circuit settles in the data-flow sub-step (see microsteps.ts).
  const sub = useComputer((s) => s.sub);
  const active = new Map(sub >= 2 ? t?.acPaths.map((p) => [p.op, p]) : []);
  const rowH = 44;
  const { lang, L } = useLang();
  const label = lang === 'tr' ? AC_OP_LABEL_TR : AC_OP_LABEL;
  return (
    <dialog ref={ref} className="modal" onClose={onClose} aria-labelledby="alu-title">
      <div className="panel-head">
        <h2 id="alu-title" style={{ margin: 0, fontSize: 22 }}>
          {L('Adder and logic circuit for AC', 'AC için toplayıcı ve mantık devresi')}
        </h2>
        <Ref title={L('Fig. 5-21: One stage of adder and logic circuit', 'Şekil 5-21: Toplayıcı ve mantık devresinin bir katı')}>Fig. 5-21</Ref>
      </div>
      <p style={{ margin: '0 0 12px', color: 'var(--text-2)', lineHeight: 1.5 }}>
        {L(
          "One stage i of 16. Each AND gate passes its data input only while its control function is 1; the OR gate feeds AC(i) when AC's LD is enabled. INC uses AC's INR input (rB5) and CLA its CLR input (rB11), so they do not go through this circuit. The carry out of the adder goes to E.",
          "16 kattan i. kat. Her AND kapısı veri girişini yalnızca kontrol fonksiyonu 1 iken geçirir; AC'nin LD'si etkinken OR kapısı AC(i)'yi besler. INC, AC'nin INR girişini (rB5), CLA ise CLR girişini (rB11) kullanır; bu yüzden bu devreden geçmezler. Toplayıcının dışarı çıkan eldesi E'ye gider.",
        )}
      </p>
      <div className="scroll-x">
        <svg width={720} height={AC_INPUTS.length * rowH + 20} role="img" aria-label={L('Fig. 5-21 one stage of the AC adder and logic circuit, active inputs highlighted', 'Şekil 5-21: AC toplayıcı ve mantık devresinin bir katı, etkin girişler vurgulu')}>
          {AC_INPUTS.map((inp, i) => {
            const y = 20 + i * rowH;
            const on = active.has(inp.op);
            const col = on ? 'var(--active)' : 'var(--line)';
            return (
              <g key={inp.op}>
                <text x={0} y={y + 12} fontFamily="var(--mono)" fontSize={13} fill={on ? 'var(--active)' : 'var(--muted)'}>
                  {inp.control}
                </text>
                <text x={0} y={y + 28} fontFamily="var(--mono)" fontSize={12} fill="var(--text-2)">
                  {lang === 'tr' && inp.dataTr ? inp.dataTr : inp.data}
                </text>
                <line x1={150} x2={260} y1={y + 8} y2={y + 8} stroke={col} strokeWidth={2} />
                <line x1={150} x2={260} y1={y + 24} y2={y + 24} stroke={col} strokeWidth={2} />
                <path d={`M260 ${y} h18 a16 16 0 0 1 0 32 h-18 z`} fill="var(--box)" stroke={col} strokeWidth={2} />
                <line x1={294} x2={470} y1={y + 16} y2={160} stroke={col} strokeWidth={on ? 2 : 1.5} />
                <text x={310} y={y + 12} fontFamily="var(--sans)" fontSize={12} fill={on ? 'var(--text)' : 'var(--muted)'}>
                  {label[inp.op]}
                </text>
              </g>
            );
          })}
          <path d="M470 130 q30 0 50 30 q-20 30 -50 30 q14 -30 0 -60 z" fill="var(--box)" stroke={active.size ? 'var(--active)' : 'var(--line)'} strokeWidth={2} />
          <line x1={520} x2={600} y1={160} y2={160} stroke={active.size ? 'var(--active)' : 'var(--line)'} strokeWidth={2} />
          <text x={606} y={156} fontFamily="var(--mono)" fontSize={14} fill="var(--text)">
            {L('to AC(i)', 'AC(i)\'ye')}
          </text>
          <text x={606} y={176} fontFamily="var(--mono)" fontSize={12} fill="var(--muted)">
            LD = {active.size ? '1' : '0'}
          </text>
        </svg>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        <span className="mono" style={{ fontSize: 14 }}>
          {L('Last pulse:', 'Son darbe:')}{' '}
          {t && t.acPaths.length ? (
            t.acPaths.map((p) => (
              <span key={p.op} style={{ marginRight: 12 }}>
                {label[p.op]} → <Word value={p.ac} width={16} className="changed-value" />
                {p.e !== undefined && <> , E ← {p.e}</>}
              </span>
            ))
          ) : (
            <span className="muted">{L('circuit not used', 'devre kullanılmadı')}</span>
          )}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Link to="/alu" className="btn" onClick={onClose}>
            {L('Open the ALU circuit (Fig. 4-13)', 'ALU devresini aç (Şekil 4-13)')}
          </Link>
          <button className="btn primary" onClick={onClose}>
            {L('Close', 'Kapat')}
          </button>
        </span>
      </div>
    </dialog>
  );
}
