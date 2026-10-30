import { useState } from 'react';
import type { Bit } from '../../../core/bits';
import { clockRegister, countUp, shiftRegister } from '../../../core/blocks/sequential';
import { BlockHeader, useWord, WidthSelect } from '../../common/blocks';
import { BitInput, BitToggle, Panel, Word } from '../../common/controls';
import { useSettings } from '../../settings';

function ClockButton({ onClick, pulses }: { onClick: () => void; pulses: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button className="btn primary" onClick={onClick}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M4 18h4V6h8v12h4" />
        </svg>
        Clock pulse
      </button>
      <span className="mono muted">pulses: {pulses}</span>
    </div>
  );
}

function RegisterView({ label, value, width, next, changed }: { label: string; value: number; width: number; next?: number; changed: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <BitInput label={label} value={value} width={width} />
      <span className="mono" style={{ fontSize: 14 }}>
        <span className={changed ? 'changed-value' : ''}>
          <Word value={value} width={width} />
        </span>
        {next !== undefined && (
          <span className="muted">
            {' '}
            · on the next pulse → <Word value={next} width={width} />
          </span>
        )}
      </span>
    </div>
  );
}

export function RegisterBlock() {
  const n = useSettings((s) => s.width);
  const [reg, setReg] = useWord(0, n);
  const [input, setInput] = useWord(0b1010, n);
  const [ld, setLd] = useState<Bit>(1);
  const [clr, setClr] = useState<Bit>(0);
  const [inr, setInr] = useState<Bit>(0);
  const [pulses, setPulses] = useState(0);
  const [changed, setChanged] = useState(false);
  const next = clockRegister(reg, n, { ld: !!ld, clr: !!clr, inr: !!inr }, input);
  return (
    <>
      <BlockHeader title="Register with parallel load" refs="Fig. 2-7" right={<WidthSelect />}>
        Nothing happens until a clock pulse arrives. With LD = 1 the inputs are loaded; with LD = 0 the register keeps its value. CLR and INR are the extra controls the Basic Computer's registers have; priority is Clear, Load, Increment (Table 2-4).
      </BlockHeader>
      <Panel title="Inputs and control">
        <div className="row">
          <BitInput label="Inputs I" value={input} width={n} onChange={setInput} />
          <BitToggle label="LD" value={ld} onChange={setLd} />
          <BitToggle label="CLR" value={clr} onChange={setClr} />
          <BitToggle label="INR" value={inr} onChange={setInr} />
        </div>
      </Panel>
      <Panel title="Register">
        <div className="row" style={{ alignItems: 'center' }}>
          <RegisterView label="A" value={reg} width={n} next={next} changed={changed} />
          <ClockButton
            pulses={pulses}
            onClick={() => {
              setChanged(next !== reg);
              setReg(next);
              setPulses(pulses + 1);
            }}
          />
        </div>
      </Panel>
    </>
  );
}

export function ShiftRegisterBlock() {
  const n = useSettings((s) => s.width);
  const [reg, setReg] = useWord(0b1011, n);
  const [serial, setSerial] = useState<Bit>(0);
  const [dir, setDir] = useState<'right' | 'left'>('right');
  const [circular, setCircular] = useState(false);
  const [pulses, setPulses] = useState(0);
  const [out, setOut] = useState<Bit | null>(null);
  const next = shiftRegister(reg, n, dir, serial, circular);
  return (
    <>
      <BlockHeader title="Shift register" refs="Fig. 2-8, 2-9" right={<WidthSelect />}>
        On each clock pulse every bit moves one position. Shifting right, the serial input enters the leftmost bit and the rightmost bit leaves as serial output; shifting left, the reverse. In circular mode the bit that leaves re-enters at the other end.
      </BlockHeader>
      <Panel title="Control">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="seg" role="group" aria-label="Direction">
            <button aria-pressed={dir === 'right'} onClick={() => setDir('right')}>Shift right</button>
            <button aria-pressed={dir === 'left'} onClick={() => setDir('left')}>Shift left</button>
          </div>
          <BitToggle label="Serial input" value={serial} onChange={setSerial} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={circular} onChange={(e) => setCircular(e.target.checked)} /> Circular
          </label>
        </div>
      </Panel>
      <Panel title="Register">
        <div className="row" style={{ alignItems: 'center' }}>
          <div>
            <BitInput label="Register (click bits to preset)" value={reg} width={n} onChange={setReg} />
            <span className="mono muted" style={{ fontSize: 13 }}>
              next → <Word value={next.value} width={n} /> {out !== null && <>· last serial output = {out}</>}
            </span>
          </div>
          <ClockButton
            pulses={pulses}
            onClick={() => {
              setOut(next.serialOut);
              setReg(next.value);
              setPulses(pulses + 1);
            }}
          />
        </div>
      </Panel>
    </>
  );
}

export function CounterBlock() {
  const n = useSettings((s) => s.width);
  const [reg, setReg] = useWord(0b1101, n);
  const [inr, setInr] = useState<Bit>(1);
  const [pulses, setPulses] = useState(0);
  const next = inr ? countUp(reg, n) : reg;
  return (
    <>
      <BlockHeader title="Binary counter" refs="Fig. 2-10" right={<WidthSelect />}>
        A register that goes through the binary sequence. With INR (count enable) = 1 each clock pulse adds one; after all 1s it wraps to all 0s.
      </BlockHeader>
      <Panel title="Counter">
        <div className="row" style={{ alignItems: 'center' }}>
          <BitToggle label="INR" value={inr} onChange={setInr} />
          <div>
            <BitInput label="Count (click bits to preset)" value={reg} width={n} onChange={setReg} />
            <span className="mono muted" style={{ fontSize: 13 }}>
              decimal {reg} · next → <Word value={next} width={n} />
              {inr && reg === 2 ** n - 1 ? ' (wraps around)' : ''}
            </span>
          </div>
          <ClockButton
            pulses={pulses}
            onClick={() => {
              setReg(next);
              setPulses(pulses + 1);
            }}
          />
        </div>
      </Panel>
    </>
  );
}
