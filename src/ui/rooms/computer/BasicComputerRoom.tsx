import { useMemo, useState } from 'react';
import { viewPulse } from '../../../core/basic/microsteps';
import { SPEEDS, useSettings } from '../../settings';
import { AssemblerPanel, useAssembler } from './AssemblerPanel';
import { BasicComputerCircuit } from './BasicComputerCircuit';
import { ControlBar } from './ControlBar';
import { GatesDialog } from './GatesDialog';
import { MemoryView } from './MemoryView';
import { AluDialog, HistoryPanel, IODevices } from './Panels';
import { StepPanel } from './StepPanel';
import { SUBSTEP_SPEED, useComputer, useSim } from './store';
import './computer.css';

type Tab = 'memory' | 'history' | 'io';

export function BasicComputerRoom() {
  const sim = useSim();
  const [aluOpen, setAluOpen] = useState(false);
  const [gatesOpen, setGatesOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('memory');
  const running = useComputer((s) => s.running);
  const sub = useComputer((s) => s.sub);
  const program = useComputer((s) => s.program);
  const speed = SPEEDS[useSettings((s) => s.speedIndex)];
  const asmOpen = useAssembler((s) => s.open);
  const trace = sim.lastTrace;
  const view = useMemo(() => (trace ? viewPulse(trace, sim.state.mem) : null), [trace, sim.state.mem]);

  return (
    <div className="computer" data-fast={running && speed > SUBSTEP_SPEED}>
      <ControlBar />
      {asmOpen && <AssemblerPanel />}
      <div className="workbench">
        <div className="stage">
          <BasicComputerCircuit view={view} sub={sub} state={sim.state} onOpenAlu={() => setAluOpen(true)} onOpenGates={() => setGatesOpen(true)} />
          {program?.expect && (
            <p className="expect">
              <b>{program.title}.</b> {program.expect}
            </p>
          )}
        </div>
        <aside className="side">
          <StepPanel view={view} />
          <div className="tabs" role="tablist" aria-label="Details">
            {(
              [
                ['memory', 'Memory'],
                ['history', 'History'],
                ['io', 'Keyboard & printer'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'memory' && <MemoryView />}
          {tab === 'history' && <HistoryPanel />}
          {tab === 'io' && <IODevices />}
        </aside>
      </div>
      <AluDialog open={aluOpen} onClose={() => setAluOpen(false)} />
      <GatesDialog open={gatesOpen} onClose={() => setGatesOpen(false)} view={view} />
    </div>
  );
}
