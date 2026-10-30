import { useState } from 'react';
import { SPEEDS, useSettings } from '../../settings';
import { ControlBar } from './ControlBar';
import { Datapath } from './Datapath';
import { MemoryView } from './MemoryView';
import { AluDialog, HistoryPanel, IODevices } from './Panels';
import { ExplainPanel, PulsePanel } from './PulsePanel';
import { StateStrip } from './StateStrip';
import { useComputer } from './store';
import './computer.css';

export function BasicComputerRoom() {
  const [aluOpen, setAluOpen] = useState(false);
  const running = useComputer((s) => s.running);
  const program = useComputer((s) => s.program);
  const speed = SPEEDS[useSettings((s) => s.speedIndex)];

  return (
    <div data-fast={running && speed > 10} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ControlBar />
      {program?.expect && (
        <p className="mono" style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>
          <span className="cap">Expected · </span>
          {program.expect}
        </p>
      )}
      <StateStrip />
      <div className="cols">
        <Datapath onOpenAlu={() => setAluOpen(true)} />
        <div className="col">
          <PulsePanel />
          <ExplainPanel />
          <HistoryPanel />
        </div>
        <div className="col narrow">
          <MemoryView />
          <IODevices />
        </div>
      </div>
      <AluDialog open={aluOpen} onClose={() => setAluOpen(false)} />
    </div>
  );
}
