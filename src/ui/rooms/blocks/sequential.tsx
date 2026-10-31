import { useState } from 'react';
import type { Bit } from '../../../core/bits';
import { clockRegister, countUp, shiftRegister } from '../../../core/blocks/sequential';
import { BlockHeader, useWord, WidthSelect } from '../../common/blocks';
import { BitInput, BitToggle, Panel, Word } from '../../common/controls';
import { useLang, useSettings } from '../../settings';

function ClockButton({ onClick, pulses }: { onClick: () => void; pulses: number }) {
  const { L } = useLang();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button className="btn primary" onClick={onClick}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M4 18h4V6h8v12h4" />
        </svg>
        {L("Clock pulse", "Saat darbesi")}
      </button>
      <span className="mono muted">{L('pulses', 'darbe')}: {pulses}</span>
    </div>
  );
}

function RegisterView({ label, value, width, next, changed }: { label: string; value: number; width: number; next?: number; changed: boolean }) {
  const { L } = useLang();
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
            ({L('next pulse', 'sonraki darbe')}: <Word value={next} width={width} />)
          </span>
        )}
      </span>
    </div>
  );
}

export function RegisterBlock() {
  const { L } = useLang();
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
      <BlockHeader title={L("Register with parallel load", "Paralel yüklemeli yazmaç")} refs="Fig. 2-7" right={<WidthSelect />}>
        {L("Nothing happens until a clock pulse arrives. With LD = 1 the inputs are loaded; with LD = 0 the register keeps its value. CLR and INR are the extra controls the Basic Computer's registers have; priority is Clear, Load, Increment (Table 2-4).", "Saat darbesi gelene kadar hiçbir şey olmaz. LD = 1 iken girişler yüklenir; LD = 0 iken yazmaç değerini korur. CLR ve INR, Temel Bilgisayar yazmaçlarının ek kontrolleridir; öncelik sırası Temizle, Yükle, Arttır'dır (Tablo 2-4).")}
      </BlockHeader>
      <Panel title={L("Inputs and control", "Girişler ve kontrol")}>
        <div className="row">
          <BitInput label={L("Inputs I", "Girişler I")} value={input} width={n} onChange={setInput} />
          <BitToggle label="LD" value={ld} onChange={setLd} />
          <BitToggle label="CLR" value={clr} onChange={setClr} />
          <BitToggle label="INR" value={inr} onChange={setInr} />
        </div>
      </Panel>
      <Panel title={L("Register", "Yazmaç")}>
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
  const { L } = useLang();
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
      <BlockHeader title={L("Shift register", "Kaydırmalı yazmaç")} refs="Fig. 2-8, 2-9" right={<WidthSelect />}>
        {L("On each clock pulse every bit moves one position. Shifting right, the serial input enters the leftmost bit and the rightmost bit leaves as serial output; shifting left, the reverse. In circular mode the bit that leaves re-enters at the other end.", "Her saat darbesinde her bit bir konum kayar. Sağa kaydırmada seri giriş en soldaki bite girer, en sağdaki bit seri çıkış olarak ayrılır; sola kaydırmada tersi olur. Dairesel modda ayrılan bit diğer uçtan geri girer.")}
      </BlockHeader>
      <Panel title={L("Control", "Kontrol")}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="seg" role="group" aria-label={L("Direction", "Yön")}>
            <button aria-pressed={dir === 'right'} onClick={() => setDir('right')}>{L("Shift right", "Sağa kaydır")}</button>
            <button aria-pressed={dir === 'left'} onClick={() => setDir('left')}>{L("Shift left", "Sola kaydır")}</button>
          </div>
          <BitToggle label={L("Serial input", "Seri giriş")} value={serial} onChange={setSerial} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={circular} onChange={(e) => setCircular(e.target.checked)} /> {L("Circular", "Dairesel")}
          </label>
        </div>
      </Panel>
      <Panel title={L("Register", "Yazmaç")}>
        <div className="row" style={{ alignItems: 'center' }}>
          <div>
            <BitInput label={L("Register (click bits to preset)", "Yazmaç (önceden ayarlamak için bitlere tıkla)")} value={reg} width={n} onChange={setReg} />
            <span className="mono muted" style={{ fontSize: 13 }}>
              {L('next pulse', 'sonraki darbe')}: <Word value={next.value} width={n} /> {out !== null && <>, {L('last serial output', 'son seri çıkış')} {out}</>}
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
  const { L } = useLang();
  const n = useSettings((s) => s.width);
  const [reg, setReg] = useWord(0b1101, n);
  const [inr, setInr] = useState<Bit>(1);
  const [pulses, setPulses] = useState(0);
  const next = inr ? countUp(reg, n) : reg;
  return (
    <>
      <BlockHeader title={L("Binary counter", "İkili sayıcı")} refs="Fig. 2-10" right={<WidthSelect />}>
        {L("A register that goes through the binary sequence. With INR (count enable) = 1 each clock pulse adds one; after all 1s it wraps to all 0s.", "İkili diziyi sırayla izleyen bir yazmaç. INR (sayma etkinleştirme) = 1 iken her saat darbesi bir ekler; tüm bitler 1 olduktan sonra hepsi 0'a döner.")}
      </BlockHeader>
      <Panel title={L("Counter", "Sayıcı")}>
        <div className="row" style={{ alignItems: 'center' }}>
          <BitToggle label="INR" value={inr} onChange={setInr} />
          <div>
            <BitInput label={L("Count (click bits to preset)", "Sayım (önceden ayarlamak için bitlere tıkla)")} value={reg} width={n} onChange={setReg} />
            <span className="mono muted" style={{ fontSize: 13 }}>
              {L('decimal', 'onlu')} {reg}, {L('next pulse', 'sonraki darbe')}: <Word value={next} width={n} />
              {inr && reg === 2 ** n - 1 ? L(" (wraps around)", " (başa döner)") : ''}
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
