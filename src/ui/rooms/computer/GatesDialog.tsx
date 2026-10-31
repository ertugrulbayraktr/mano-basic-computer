import { useEffect, useRef } from 'react';
import { CONTROL_EQUATIONS, termLabel } from '../../../core/basic/controlLogic';
import type { PulseView } from '../../../core/basic/microsteps';
import { Ref } from '../../common/controls';
import { useLang } from '../../settings';

const GROUP_TR: Record<string, string> = {
  Bus: 'Ortak yol',
  Memory: 'Bellek',
  'Adder & logic': 'Toplayıcı ve mantık',
  'Flip-flops': "Flip-flop'lar",
};

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
  const { lang, L } = useLang();
  const groupName = (g: string) => (lang === 'tr' ? (GROUP_TR[g] ?? g) : g);

  return (
    <dialog ref={ref} className="modal" onClose={onClose} aria-labelledby="gates-title">
      <div className="panel-head">
        <h2 id="gates-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          {L('Control logic gates', 'Kontrol mantık kapıları')}
        </h2>
        <Ref title={L('Sec. 5-10: Design of basic computer; Fig. 5-16: control gates of AR; Table 5-7: bus encoder', 'Kısım 5-10: Temel bilgisayarın tasarımı; Şekil 5-16: AR\'nin kontrol kapıları; Tablo 5-7: yol kodlayıcısı')}>Sec. 5-10</Ref>
      </div>
      <p style={{ margin: '0 0 14px', color: 'var(--text-2)' }}>
        {L('Each control input is an OR of AND terms.', 'Her kontrol girişi, AND terimlerinin OR\'udur.')}{' '}
        {view
          ? L(`Terms that are 1 at T${view.T} are highlighted.`, `T${view.T} anında 1 olan terimler vurgulu.`)
          : L('Step a pulse to see which terms are 1.', 'Hangi terimlerin 1 olduğunu görmek için bir darbe ilerlet.')}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '6px 24px', maxHeight: '65vh', overflow: 'auto' }}>
        {groups.map((g) => (
          <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            <span className="cap">{groupName(g)}</span>
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
          {L('Close', 'Kapat')}
        </button>
      </div>
    </dialog>
  );
}
