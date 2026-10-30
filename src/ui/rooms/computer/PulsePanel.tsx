import { toBin } from '../../../core/bits';
import { AC_OP_LABEL } from '../../../core/basic/adderLogic';
import { controlSignals, type RtlLine } from '../../../core/basic/control';
import { explainPulse } from '../../../core/basic/explain';
import { REG_WIDTH, REGISTERS, type RegName } from '../../../core/basic/types';
import { Ref, Word } from '../../common/controls';
import { useSim } from './store';

const PHASE_TITLE = {
  fetch: 'fetch',
  decode: 'decode',
  indirect: 'effective address',
  execute: 'execute',
  interrupt: 'interrupt cycle',
  halted: 'halted',
} as const;

function Rtl({ line }: { line: RtlLine }) {
  return (
    <div className="rtl">
      <span className="cf">{line.control}:</span> {line.statement}
    </div>
  );
}

/** The pulse that just happened: RTL lines, control signals and the changes it made. */
export function PulsePanel() {
  const sim = useSim();
  const t = sim.lastTrace;

  if (!t) {
    const next = controlSignals(sim.state);
    return (
      <section className="panel" aria-label="This pulse">
        <div className="panel-head">
          <span className="cap">Ready</span>
          <Ref>Table 5-6</Ref>
        </div>
        <p style={{ margin: '0 0 10px', color: 'var(--text-2)' }}>
          Press <b>Pulse</b> to apply one clock pulse. The first pulse will be:
        </p>
        {next.lines.map((l) => (
          <Rtl key={l.id} line={l} />
        ))}
      </section>
    );
  }

  const c = t.signals;
  const regCtl = (k: 'ld' | 'inr' | 'clr') =>
    REGISTERS.filter((r) => c.reg[r][k]).join(', ') || '—';
  const mnemonic = sim.history.at(-1)?.text;

  return (
    <section className="panel" aria-label="This pulse" style={{ display: 'flex', flexDirection: 'column', gap: 14, borderColor: 'var(--line)' }}>
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <span className="cap">
          This pulse · {PHASE_TITLE[c.phase]}
          {c.phase !== 'halted' && c.phase !== 'interrupt' && mnemonic ? ` · ${mnemonic}` : ''}
        </span>
        <Ref title="Table 5-6: Control functions and microoperations for the basic computer">Table 5-6</Ref>
      </div>
      <div aria-live="polite">
        {c.lines.map((l) => (
          <Rtl key={l.id} line={l} />
        ))}
        {c.phase === 'halted' && <div className="rtl muted">S = 0 · no clock</div>}
      </div>

      <div className="sig-grid">
        <div className="sig">
          <span className="cap">Bus · S2S1S0 <Ref>Fig. 5-4</Ref></span>
          <span className="mono">
            {toBin(c.busSelect, 3)} → {t.busSource === 'none' ? 'none' : t.busSource}
          </span>
          {t.busValue === null ? (
            <span className="muted">bus not used</span>
          ) : (
            <Word value={t.busValue} width={16} className="" />
          )}
        </div>
        <div className="sig">
          <span className="cap">Memory</span>
          <span className="mono" style={{ color: c.memRead ? 'var(--active)' : 'var(--muted)' }}>
            Read {c.memRead ? '✓' : '—'}
          </span>
          <span className="mono" style={{ color: c.memWrite ? 'var(--changed)' : 'var(--muted)' }}>
            Write {c.memWrite ? '✓' : '—'}
          </span>
        </div>
        <div className="sig">
          <span className="cap">Register controls</span>
          <span className="mono" style={{ fontSize: 13 }}>LD: {regCtl('ld')}</span>
          <span className="mono" style={{ fontSize: 13 }}>INR: {regCtl('inr')}</span>
          <span className="mono" style={{ fontSize: 13 }}>CLR: {regCtl('clr')}</span>
        </div>
        <div className="sig">
          <span className="cap">Adder &amp; logic <Ref>Fig. 5-21</Ref></span>
          {t.acPaths.length === 0 ? (
            <span className="muted mono">idle</span>
          ) : (
            t.acPaths.map((p) => (
              <span key={p.op} className="mono" style={{ fontSize: 13 }}>
                {AC_OP_LABEL[p.op]}
              </span>
            ))
          )}
          <span className="mono muted" style={{ fontSize: 12 }}>
            {c.sc === 'clr' ? 'SC ← 0' : c.sc === 'inc' ? 'SC ← SC + 1' : 'SC holds'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="cap">Changed on this edge</span>
        <div className="mono" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', fontSize: 14 }}>
          {t.changes.length === 0 && t.memory.length === 0 && <span className="muted">nothing</span>}
          {t.changes.map((ch) => (
            <span key={ch.name}>
              {ch.name}{' '}
              <span className="muted">
                <ChangeValue name={ch.name} v={ch.before} />
              </span>{' '}
              → <span className="changed-value"><ChangeValue name={ch.name} v={ch.after} /></span>
            </span>
          ))}
          {t.memory.map((m) => (
            <span key={m.address}>
              M[<Word value={m.address} width={12} />] <Word value={m.before} width={16} className="muted" /> →{' '}
              <Word value={m.after} width={16} className="changed-value" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChangeValue({ name, v }: { name: string; v: number }) {
  if (name === 'SC') return <>{v}</>;
  if (name in REG_WIDTH) return <Word value={v} width={REG_WIDTH[name as RegName]} />;
  return <>{v}</>;
}

/** Plain-language explanation of the last pulse, and a preview of the next one. */
export function ExplainPanel() {
  const sim = useSim();
  const t = sim.lastTrace;
  const next = controlSignals(sim.state);
  return (
    <section className="panel" aria-label="What happened">
      <div className="panel-head">
        <span className="cap">What happened?</span>
      </div>
      {t ? (
        explainPulse(t).map((p, i) => (
          <p key={i} style={{ margin: '0 0 8px', fontSize: 16, lineHeight: 1.55, color: i >= t.signals.lines.length && t.signals.phase !== 'halted' ? 'var(--changed)' : 'var(--text)' }}>
            {p}
          </p>
        ))
      ) : (
        <p style={{ margin: '0 0 8px', fontSize: 16, lineHeight: 1.55, color: 'var(--text)' }}>
          Every instruction starts with a fetch: T0 copies PC to AR, T1 reads the instruction into IR, T2 decodes it. Load an example and step through it pulse by pulse.
        </p>
      )}
      {next.phase !== 'halted' && t && (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>
          Next:{' '}
          {next.lines.map((l) => (
            <span key={l.id} className="mono" style={{ color: 'var(--text)', marginRight: 12 }}>
              {l.control}: {l.statement}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
