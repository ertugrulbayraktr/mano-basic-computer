import { useEffect, useRef } from 'react';
import { CONTROL_EQUATIONS, termLabel } from '../../../core/basic/controlLogic';
import type { PulseView } from '../../../core/basic/microsteps';
import { Ref } from '../../common/controls';

/** Every control equation of Sec. 5-10, with the terms that are 1 in the current pulse lit. */
export function GatesDialog({ open, onClose, view }: { open: boolean; onClose: () => void; view: PulseView | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const groups = [...new Set(CONTROL_EQUATIONS.map((e) => e.group))];

  return (
    <dialog ref={ref} className="modal" onClose={onClose} aria-labelledby="gates-title">
      <div className="panel-head">
        <h2 id="gates-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          Control logic gates
        </h2>
        <Ref title="Sec. 5-10: Design of basic computer; Fig. 5-16: control gates of AR; Table 5-7: bus encoder">Sec. 5-10</Ref>
      </div>
      <p style={{ margin: '0 0 14px', color: 'var(--text-2)' }}>
        Each control input is an OR of AND terms. {view ? `Terms that are 1 at T${view.T} are highlighted.` : 'Step a pulse to see which terms are 1.'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '6px 24px', maxHeight: '65vh', overflow: 'auto' }}>
        {groups.map((g) => (
          <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            <span className="cap">{g}</span>
            {CONTROL_EQUATIONS.filter((e) => e.group === g).map((e) => {
              const val = view?.gates[e.id];
              return (
                <div key={e.id} className="mono" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                  <span style={{ color: val?.out ? 'var(--active)' : 'var(--text)', fontWeight: val?.out ? 600 : 400 }}>{e.name}</span>
                  <span className="muted"> = </span>
                  {e.terms.map((term, i) => (
                    <span key={i}>
                      {i > 0 && <span className="muted"> + </span>}
                      <span
                        style={{
                          color: val?.terms[i] ? 'var(--active)' : 'var(--text-2)',
                          background: val?.terms[i] ? 'var(--active-soft)' : undefined,
                          borderRadius: 3,
                          padding: val?.terms[i] ? '0 3px' : undefined,
                        }}
                      >
                        {termLabel(term)}
                      </span>
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn primary" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
