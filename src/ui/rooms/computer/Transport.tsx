import { ASM_EXAMPLES } from '../../../core/programs/asmExamples';
import { HEX_EXAMPLES } from '../../../core/programs/examples';
import { SPEEDS, useSettings } from '../../settings';
import { loadAssembly, useAssembler } from './AssemblerPanel';
import { useComputer, useSim } from './store';

export const Icon = ({ d, size = 15 }: { d: string; size?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const speedLabel = (s: number) => (s === Infinity ? 'as fast as possible' : `${s} pulse${s === 1 ? '' : 's'} per second`);

const MICRO = ['decode', 'control gates', 'data flow', 'clock edge'];

/** Clock controls and the program picker, at the left of the dock. */
export function Transport() {
  const sim = useSim();
  const s = useComputer();
  const { speedIndex, setSpeedIndex } = useSettings();
  const asm = useAssembler();
  const exampleIds = [...HEX_EXAMPLES, ...ASM_EXAMPLES].map((e) => e.id);
  const canNext = !sim.halted || sim.canRedo || (!!sim.lastTrace && s.sub < 3);

  return (
    <section className="transport" aria-label="Clock controls">
      <div className="transport-row">
        <button className="btn icon" onClick={s.subPrev} disabled={!sim.canStepBack && !(sim.lastTrace && s.sub > 0)} title="Back one sub-step (undoes pulses and edits)" aria-label="Back one sub-step">
          <Icon d="M15 5l-7 7 7 7" />
        </button>
        <button className="btn primary grow" onClick={s.subNext} disabled={!canNext} title="Next sub-step: decode, control gates, data flow, clock edge">
          Step
        </button>
        <button className="btn" onClick={s.pulse} disabled={!canNext} title="Finish this clock pulse, or do the next one">
          Pulse
        </button>
        <button className="btn" onClick={s.instruction} disabled={!canNext} title="Pulse until SC returns to 0">
          Instruction
        </button>
      </div>
      <div className="transport-row">
        {s.running ? (
          <button className="btn grow" onClick={s.pause}>
            <Icon d="M8 5v14M16 5v14" />
            Pause
          </button>
        ) : (
          <button className="btn grow" onClick={s.run} title="Run until HLT or a breakpoint">
            <Icon d="M7 4l13 8-13 8z" />
            Run
          </button>
        )}
        <button className="btn" onClick={s.reset} title="Go back to the loaded program's start">
          Reset
        </button>
      </div>
      <label className="transport-speed">
        <span className="cap">Speed</span>
        <input
          type="range"
          min={0}
          max={SPEEDS.length - 1}
          value={speedIndex}
          onChange={(e) => setSpeedIndex(Number(e.target.value))}
          aria-valuetext={speedLabel(SPEEDS[speedIndex])}
        />
        <span className="muted">{speedLabel(SPEEDS[speedIndex])}</span>
      </label>
      <p className="transport-note muted">
        {s.status ??
          (sim.lastTrace
            ? `Pulse ${sim.pulses}, ${MICRO[s.sub]}${sim.canRedo ? `. ${sim.latestPulse - sim.pulses} more can be redone.` : ''}`
            : 'Ready.')}
      </p>
      <div className="transport-program">
        <label>
          <span className="cap">Program</span>
          <select
            className="input"
            value={s.program && exampleIds.includes(s.program.id) ? s.program.id : ''}
            onChange={(e) => {
              const ex = HEX_EXAMPLES.find((x) => x.id === e.target.value);
              if (ex) s.load({ id: ex.id, title: ex.title, mem: ex.mem, reg: ex.reg, flag: ex.flag, expect: ex.expect });
              const asmEx = ASM_EXAMPLES.find((x) => x.id === e.target.value);
              if (asmEx) {
                asm.setSource(asmEx.source);
                loadAssembly(asmEx.source, asmEx.title, asmEx);
              }
            }}
          >
            <option value="">{s.program ? s.program.title : 'Choose an example…'}</option>
            <optgroup label="Machine code (Ch. 5)">
              {HEX_EXAMPLES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Assembly (Ch. 6)">
              {ASM_EXAMPLES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="transport-row">
          <button className="btn grow" aria-pressed={asm.open} onClick={() => asm.setOpen(!asm.open)}>
            Write a program
          </button>
          <button className="btn" onClick={s.clearAll} title="Clear memory, registers and breakpoints">
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}
