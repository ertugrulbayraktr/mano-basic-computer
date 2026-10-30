import { toBin } from '../../../core/bits';
import { fieldOpcode } from '../../../core/basic/isa';
import { FLAG_TITLE, FLAGS } from '../../../core/basic/types';
import { Ref } from '../../common/controls';
import { useComputer, useSim } from './store';

/** Timing signals T0…T15, SC, the operation decoder D0…D7 and the flip-flops. */
export function StateStrip() {
  const sim = useSim();
  const setFlag = useComputer((s) => s.setFlag);
  const setSC = useComputer((s) => s.setSC);
  const t = sim.lastTrace;
  const executedT = t && t.signals.phase !== 'halted' ? t.signals.T : null;
  const D = fieldOpcode(sim.state.reg.IR);

  return (
    <section className="panel state-strip" aria-label="Timing and control state">
      <div className="group">
        <span className="cap">
          Timing · SC = <span className="mono" style={{ color: 'var(--text)' }}>{toBin(sim.state.SC, 4)}</span>{' '}
          <Ref title="Fig. 5-6: SC drives a 4 × 16 decoder that produces T0…T15">Fig. 5-6</Ref>
        </span>
        <div className="chips" role="list" aria-label="Timing signals">
          {Array.from({ length: 16 }, (_, i) => (
            <button
              key={i}
              role="listitem"
              className={`chip ${executedT === i ? 'on' : ''} ${sim.state.SC === i && !sim.halted ? 'next' : ''}`}
              title={executedT === i ? `T${i}: executed in the last pulse` : sim.state.SC === i ? `T${i}: next pulse (click to set SC)` : `Set SC = ${i}`}
              onClick={() => setSC(i)}
            >
              T{i}
            </button>
          ))}
        </div>
      </div>
      <div className="group">
        <span className="cap">
          Operation decoder · IR(12-14) <Ref>Fig. 5-6</Ref>
        </span>
        <div className="chips">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className={`chip ${D === i ? 'on' : ''}`}>
              D{i}
            </span>
          ))}
        </div>
      </div>
      <div className="group">
        <span className="cap">Flip-flops · click to toggle</span>
        <div className="chips">
          {FLAGS.map((f) => {
            const changed = t?.changes.some((c) => c.name === f);
            return (
              <button
                key={f}
                className={`chip ${changed ? 'changed' : ''}`}
                title={FLAG_TITLE[f]}
                aria-label={`${f} = ${sim.state.flag[f]}, ${FLAG_TITLE[f]}`}
                onClick={() => setFlag(f, sim.state.flag[f] ? 0 : 1)}
              >
                {f}&nbsp;<b style={{ color: changed ? 'var(--changed)' : 'var(--text)' }}>{sim.state.flag[f]}</b>
              </button>
            );
          })}
        </div>
      </div>
      <div className="group">
        <span className="cap">Pulse</span>
        <span className="mono" style={{ fontSize: 18 }}>
          {sim.pulses}
        </span>
      </div>
    </section>
  );
}
