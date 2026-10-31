import { useMemo, useRef, useState } from 'react';
import { instructionXray, usage as computeUsage } from '../../../core/basic/activity';
import { disassemble } from '../../../core/basic/disasm';
import { viewPulse } from '../../../core/basic/microsteps';
import { toHex } from '../../../core/bits';
import { SPEEDS, useSettings } from '../../settings';
import { TimingDiagram } from '../../timeline/TimingDiagram';
import { AssemblerPanel, useAssembler } from './AssemblerPanel';
import { BasicComputerCircuit } from './BasicComputerCircuit';
import { GatesDialog } from './GatesDialog';
import { MemoryView } from './MemoryView';
import { AluDialog, IODevices } from './Panels';
import { RegistersPanel, type EditTarget } from './RegistersPanel';
import { StepPanel } from './StepPanel';
import { SUBSTEP_SPEED, useComputer, useSim } from './store';
import { Transport } from './Transport';
import './computer.css';

type Tab = 'registers' | 'memory' | 'io';

/**
 * The Basic Computer workbench: the circuit, an inspector for the pulse being shown, and a dock
 * with the clock controls and the timing diagram.
 */
export function BasicComputerRoom() {
  const sim = useSim();
  const [aluOpen, setAluOpen] = useState(false);
  const [gatesOpen, setGatesOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('registers');
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const running = useComputer((s) => s.running);
  const sub = useComputer((s) => s.sub);
  const program = useComputer((s) => s.program);
  const follow = useComputer((s) => s.follow);
  const usageOn = useComputer((s) => s.usage);
  const xrayAt = useComputer((s) => s.xray);
  const setView = useComputer((s) => s.setView);
  const speed = SPEEDS[useSettings((s) => s.speedIndex)];
  const dockHeight = useSettings((s) => s.dockHeight);
  const setDockHeight = useSettings((s) => s.setDockHeight);
  const asmOpen = useAssembler((s) => s.open);
  const trace = sim.lastTrace;
  const view = useMemo(() => (trace ? viewPulse(trace, sim.state.mem) : null), [trace, sim.state.mem]);
  const xray = useMemo(() => (xrayAt === null ? null : instructionXray(sim.state, xrayAt)), [xrayAt, sim.state]);
  const timelineLength = sim.timeline.length;
  const usage = useMemo(() => (usageOn ? computeUsage(sim.timeline) : null), [usageOn, sim.pulses, timelineLength, sim.timeline]);
  const resize = useRef<{ y: number; h: number } | null>(null);
  const fast = running && speed > SUBSTEP_SPEED;
  const step = view?.steps[Math.min(sub, view.steps.length - 1)];

  return (
    <div className="computer" data-fast={fast}>
      <div className="bench" style={{ ['--dock-h' as string]: `${dockHeight}px` }}>
        <div className="bench-stage">
          <div className="stage-tools" role="toolbar" aria-label="Circuit view">
            <button className="btn small" aria-pressed={follow} onClick={() => setView({ follow: !follow })} title="The camera follows each sub-step of the pulse">
              Follow
            </button>
            <button className="btn small" aria-pressed={usageOn} onClick={() => setView({ usage: !usageOn })} title="Shade every part of the circuit by how many pulses used it">
              Usage
            </button>
            {xray && xrayAt !== null ? (
              <span className="xray-tag">
                X-ray of {toHex(xrayAt, 12)}: {disassemble(sim.state.mem[xrayAt]).text}, {xray.pulses.length} pulses
              </span>
            ) : (
              <span className="muted" style={{ fontSize: 12 }}>
                Hover a memory word to x-ray its instruction.
              </span>
            )}
          </div>
          <BasicComputerCircuit
            view={view}
            sub={sub}
            state={sim.state}
            follow={follow && !fast}
            xray={xray?.elements ?? null}
            usage={usage}
            onOpenAlu={() => setAluOpen(true)}
            onOpenGates={() => setGatesOpen(true)}
            onEdit={(name) => {
              if (name === 'Memory') return setTab('memory');
              setTab('registers');
              setEditTarget((t) => ({ name, n: (t?.n ?? 0) + 1 }));
            }}
          />
          {follow && step && !fast && (
            <p className="caption" aria-live="polite">
              <b>{step.title}</b>
              {step.text[0]}
            </p>
          )}
          {asmOpen && (
            <div className="sheet" role="dialog" aria-label="Write a program" onKeyDown={(e) => e.key === 'Escape' && useAssembler.getState().setOpen(false)}>
              <AssemblerPanel />
            </div>
          )}
        </div>

        <aside className="bench-inspector" aria-label="Inspector">
          <StepPanel view={view} />
          {program?.expect && (
            <section className="example-note">
              <span className="cap">{program.title}</span>
              <p>{program.expect}</p>
            </section>
          )}
          <div className="tabs" role="tablist" aria-label="Machine state">
            {(
              [
                ['registers', 'Registers'],
                ['memory', 'Memory'],
                ['io', 'I/O'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'registers' && <RegistersPanel target={editTarget} />}
          {tab === 'memory' && <MemoryView />}
          {tab === 'io' && <IODevices />}
        </aside>

        <div className="bench-dock">
          <button
            className="dock-handle"
            aria-label="Resize the timeline (arrow keys)"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              resize.current = { y: e.clientY, h: dockHeight };
            }}
            onPointerMove={(e) => resize.current && setDockHeight(resize.current.h - (e.clientY - resize.current.y))}
            onPointerUp={() => (resize.current = null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') setDockHeight(dockHeight + 20);
              if (e.key === 'ArrowDown') setDockHeight(dockHeight - 20);
            }}
          />
          <Transport />
          <TimingDiagram />
        </div>
      </div>
      <AluDialog open={aluOpen} onClose={() => setAluOpen(false)} />
      <GatesDialog open={gatesOpen} onClose={() => setGatesOpen(false)} view={view} />
    </div>
  );
}
