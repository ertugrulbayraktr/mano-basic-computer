import { controlSignals } from '../../../core/basic/control';
import { explainPulse } from '../../../core/basic/explain';
import type { PulseView } from '../../../core/basic/microsteps';
import { MICRO_STEP_KINDS, MICRO_STEP_TITLE } from '../../../core/basic/microsteps';
import { Ref } from '../../common/controls';
import { useComputer, useSim } from './store';

/** Side panel: the pulse being shown, its four sub-steps and a plain-language explanation. */
export function StepPanel({ view }: { view: PulseView | null }) {
  const sim = useSim();
  const sub = useComputer((s) => s.sub);
  const subTo = (i: number) => useComputer.setState((s) => ({ sub: i, version: s.version + 1 }));

  if (!view) {
    const next = controlSignals(sim.state);
    return (
      <section className="panel step-panel" aria-label="Current pulse">
        <h2 className="step-title">Ready for the first clock pulse</h2>
        <p style={{ margin: '4px 0 10px', color: 'var(--ink-2)', maxWidth: '44ch' }}>
          Pick an example and press Step. Each pulse plays in four parts: the decoders, the control gates, the data on the bus and the clock edge.
        </p>
        <span className="cap">The first pulse will do</span>
        {next.lines.map((l) => (
          <div key={l.id} className="mono rtl-sm">
            <span className="cf">{l.control}:</span> {l.statement}
          </div>
        ))}
      </section>
    );
  }

  const t = view.trace;
  const mnemonic = sim.history.at(-1)?.text;
  const halted = t.signals.phase === 'halted';
  return (
    <section className="panel step-panel" aria-label="Current pulse">
      <div className="panel-head" style={{ marginBottom: 2 }}>
        <h2 className="step-title">
          Pulse {sim.pulses}, T{view.T}
        </h2>
        <Ref>Table 5-6</Ref>
      </div>
      <span className="step-meta">
        {t.signals.phase === 'interrupt' ? 'Interrupt cycle' : mnemonic ? `Instruction ${mnemonic}` : ''}
      </span>
      {t.signals.lines.map((l) => (
        <div key={l.id} className="mono rtl-sm">
          <span className="cf">{l.control}:</span> {l.statement}
        </div>
      ))}
      <ol className="substeps">
        {(halted ? view.steps : MICRO_STEP_KINDS.map((k, i) => view.steps[i] ?? { kind: k, title: MICRO_STEP_TITLE[k], text: [] })).map((s, i) => {
          const state = i < sub ? 'done' : i === sub ? 'current' : 'todo';
          return (
            <li key={s.kind} className={state}>
              <button className="substep-head" onClick={() => subTo(i)} aria-current={state === 'current' ? 'step' : undefined}>
                <span className="substep-no">{i + 1}</span>
                {s.title}
              </button>
              {state !== 'todo' && (
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
      {sub === 3 && !halted && (
        <div className="why">
          <span className="cap">Why?</span>
          {explainPulse(t).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
    </section>
  );
}
