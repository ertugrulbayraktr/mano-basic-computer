import { HEX_EXAMPLES } from '../../../core/programs/examples';
import { SPEEDS, useSettings } from '../../settings';
import { useComputer, useSim } from './store';

const Icon = ({ d }: { d: string }) => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const speedLabel = (s: number) => (s === Infinity ? 'max' : `${s} pulses/s`);

export function ControlBar({ extra }: { extra?: React.ReactNode }) {
  const sim = useSim();
  const s = useComputer();
  const { speedIndex, setSpeedIndex } = useSettings();

  return (
    <section aria-label="Clock controls" className="cbar">
      <button className="btn" onClick={s.reset} title="Restore the loaded program's initial state">
        <Icon d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
        Reset
      </button>
      <button className="btn" onClick={s.back} disabled={!sim.canStepBack} title="Undo the last pulse or edit">
        <Icon d="M19 5L9 12l10 7zM5 5v14" />
        Step back
      </button>
      <button className="btn primary" onClick={s.pulse} disabled={sim.halted} title="Apply one clock pulse">
        <Icon d="M4 18h4V6h8v12h4" />
        Pulse
      </button>
      <button className="btn" onClick={s.instruction} disabled={sim.halted} title="Pulse until SC returns to 0">
        <Icon d="M5 5l8 7-8 7zM13 5l8 7-8 7z" />
        Instruction
      </button>
      {s.running ? (
        <button className="btn" onClick={s.pause}>
          <Icon d="M7 5v14M17 5v14" />
          Pause
        </button>
      ) : (
        <button className="btn" onClick={s.run} title="Run until HLT or a breakpoint">
          <Icon d="M7 4l13 8-13 8z" />
          Run
        </button>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
        <span className="cap">Speed</span>
        <input
          type="range"
          min={0}
          max={SPEEDS.length - 1}
          value={speedIndex}
          onChange={(e) => setSpeedIndex(Number(e.target.value))}
          aria-valuetext={speedLabel(SPEEDS[speedIndex])}
          style={{ width: 120, accentColor: 'var(--cyan)' }}
        />
        <span className="mono muted" style={{ fontSize: 12, width: 92 }}>
          {speedLabel(SPEEDS[speedIndex])}
        </span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="cap">Example</span>
        <select
          className="input"
          value={HEX_EXAMPLES.some((e) => e.id === s.program?.id) ? s.program?.id : ''}
          onChange={(e) => {
            const ex = HEX_EXAMPLES.find((x) => x.id === e.target.value);
            if (ex) s.load({ id: ex.id, title: ex.title, mem: ex.mem, reg: ex.reg, flag: ex.flag, expect: ex.expect });
          }}
        >
          <option value="">Choose…</option>
          {HEX_EXAMPLES.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </label>
      {extra}
      <button className="btn small" onClick={s.clearAll} title="Clear memory, registers and breakpoints">
        Clear all
      </button>
      <span className="mono muted" role="status" style={{ marginLeft: 'auto', fontSize: 13 }}>
        {s.status}
      </span>
    </section>
  );
}
