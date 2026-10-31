import { useEffect, useRef } from 'react';
import { FLAG_TITLE, FLAG_TITLE_TR, FLAGS, REG_TITLE, REG_TITLE_TR, REG_WIDTH, REGISTERS, type FlagName, type RegName } from '../../../core/basic/types';
import { useLang } from '../../settings';
import { EditableValue } from '../../common/controls';
import { useComputer, useSim } from './store';

/** What was clicked in the circuit, so the matching field can open for editing. */
export interface EditTarget {
  name: RegName | FlagName | 'SC';
  /** Increments on every click so the same register can be opened again. */
  n: number;
}

/**
 * Every register, the sequence counter and every flip-flop, editable. Values are entered in the
 * current number base; each edit can be undone with Back.
 */
export function RegistersPanel({ target }: { target: EditTarget | null }) {
  const sim = useSim();
  const { setRegister, setFlag, setSC } = useComputer();
  const rows = useRef<HTMLDivElement>(null);
  const { lang, L } = useLang();
  const regTitle = lang === 'tr' ? REG_TITLE_TR : REG_TITLE;
  const flagTitle = lang === 'tr' ? FLAG_TITLE_TR : FLAG_TITLE;

  useEffect(() => {
    if (target) rows.current?.querySelector(`[data-name="${target.name}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [target]);

  const signal = (n: string) => (target?.name === n ? target.n : 0);
  const changed = (n: string) => sim.lastTrace?.changes.some((c) => c.name === n);

  return (
    <section aria-label={L('Registers and flip-flops', 'Yazmaçlar ve flip-flop\'lar')}>
      <p style={{ margin: '0 0 10px', color: 'var(--ink-2)', fontSize: 13 }}>
        {L('Click a value to change it. Back undoes an edit.', 'Değiştirmek için bir değere tıkla. Geri düğmesi düzenlemeyi geri alır.')}
      </p>
      <div ref={rows} className="reg-table" role="table" aria-label={L('Registers', 'Yazmaçlar')}>
        {REGISTERS.map((r) => (
          <div key={r} role="row" data-name={r} className={`reg-row ${target?.name === r ? 'targeted' : ''}`}>
            <span role="rowheader" className="reg-name" title={regTitle[r]}>
              {r}
            </span>
            <span role="cell" className="muted reg-desc">
              {regTitle[r]}, {REG_WIDTH[r]} {L('bits', 'bit')}
            </span>
            <span role="cell">
              <EditableValue
                compact
                value={sim.state.reg[r]}
                width={REG_WIDTH[r]}
                label={r}
                onCommit={(v) => setRegister(r, v)}
                editSignal={signal(r)}
                className={changed(r) ? 'changed-value' : ''}
              />
            </span>
          </div>
        ))}
        <div role="row" data-name="SC" className={`reg-row ${target?.name === 'SC' ? 'targeted' : ''}`}>
          <span role="rowheader" className="reg-name">
            SC
          </span>
          <span role="cell" className="muted reg-desc">
            {L('Sequence counter, 4 bits', 'Sıra sayıcı, 4 bit')}
          </span>
          <span role="cell">
            <EditableValue compact value={sim.state.SC} width={4} label="SC" onCommit={setSC} editSignal={signal('SC')} className={changed('SC') ? 'changed-value' : ''} />
          </span>
        </div>
      </div>
      <div className="cap" style={{ margin: '14px 0 6px' }}>
        {L('Flip-flops', 'Flip-flop\'lar')}
      </div>
      <div className="chips" role="group" aria-label={L('Flip-flops', 'Flip-flop\'lar')}>
        {FLAGS.map((f) => (
          <button
            key={f}
            data-name={f}
            className={`chip ff ${sim.state.flag[f] ? 'set' : ''} ${target?.name === f ? 'targeted' : ''}`}
            title={`${flagTitle[f]}. ${L('Click to toggle.', 'Değiştirmek için tıkla.')}`}
            aria-pressed={sim.state.flag[f] === 1}
            onClick={() => setFlag(f, sim.state.flag[f] ? 0 : 1)}
          >
            {f} = {sim.state.flag[f]}
          </button>
        ))}
      </div>
    </section>
  );
}
