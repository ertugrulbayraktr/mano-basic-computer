import { toBin } from '../../../core/bits';
import type { PulseTrace } from '../../../core/basic/pulse';
import { REG_TITLE, REG_WIDTH, type RegName } from '../../../core/basic/types';
import { EditableValue, Ref, Word } from '../../common/controls';
import { useComputer, useSim } from './store';

const BUS_X = 392;
const BOX_L = 20;
const BOX_R = 320;

interface Row {
  name: RegName;
  top: number;
  sel?: number;
  fromBus: boolean;
}

const ROWS: Row[] = [
  { name: 'AR', top: 112, sel: 1, fromBus: true },
  { name: 'PC', top: 176, sel: 2, fromBus: true },
  { name: 'DR', top: 240, sel: 3, fromBus: true },
  { name: 'INPR', top: 460, fromBus: false },
  { name: 'IR', top: 524, sel: 5, fromBus: true },
  { name: 'TR', top: 588, sel: 6, fromBus: true },
  { name: 'OUTR', top: 652, fromBus: true },
];

const AC_TOP = 306;
const AC_CENTER = 389;

type WireState = 'idle' | 'out' | 'in';

function wireState(t: PulseTrace | null, name: RegName | 'Memory'): WireState {
  if (!t || t.busSource === 'none') return 'idle';
  if (t.busSource === name) return 'out';
  if (name === 'Memory') return t.signals.memWrite ? 'in' : 'idle';
  if (name === 'AC') return 'idle';
  return t.signals.reg[name].ld ? 'in' : 'idle';
}

function Wire({ y, state, sel, pulse }: { y: number; state: WireState; sel?: number; pulse: number }) {
  const active = state !== 'idle';
  return (
    <g>
      <line
        key={`${pulse}-${state}`}
        x1={BOX_R}
        x2={BUS_X}
        y1={y}
        y2={y}
        strokeWidth={2}
        stroke="var(--line)"
        className={active ? 'wire-active wire-travel' : ''}
      />
      {state === 'out' && <polygon points={`${BUS_X - 2},${y} ${BUS_X - 10},${y - 5} ${BUS_X - 10},${y + 5}`} fill="var(--cyan)" />}
      {state === 'in' && <polygon points={`${BOX_R + 1},${y} ${BOX_R + 9},${y - 5} ${BOX_R + 9},${y + 5}`} fill="var(--cyan)" />}
      {sel !== undefined && (
        <text x={BOX_R + 22} y={y - 6} fontFamily="var(--mono)" fontSize={11} fill={active ? 'var(--cyan)' : 'var(--muted)'}>
          {sel}
        </text>
      )}
    </g>
  );
}

function CtlChips({ name, t }: { name: RegName; t: PulseTrace | null }) {
  const c = t?.signals.reg[name];
  const kinds: ('ld' | 'inr' | 'clr')[] = name === 'IR' || name === 'OUTR' ? ['ld'] : name === 'INPR' ? [] : ['ld', 'inr', 'clr'];
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {kinds.map((k) => (
        <span key={k} className={`chip ctl ${c?.[k] ? 'lit' : ''}`} title={`${k.toUpperCase()} control input`}>
          {k.toUpperCase()}
        </span>
      ))}
    </span>
  );
}

function RegisterBox({ name, top, t, height = 50, inline = false }: { name: RegName; top: number; t: PulseTrace | null; height?: number; inline?: boolean }) {
  const sim = useSim();
  const setRegister = useComputer((s) => s.setRegister);
  const change = t?.changes.find((c) => c.name === name);
  return (
    <div
      className="dp-box"
      style={{ top, height, ...(inline ? { left: 0, width: "100%" } : {}), borderColor: change ? "var(--amber)" : undefined, background: change ? "var(--amber-soft)" : undefined }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 600 }} title={`${REG_TITLE[name]} (${REG_WIDTH[name]} bits)`}>
          {name}
        </span>
        <CtlChips name={name} t={t} />
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {change && <Word value={change.before} width={REG_WIDTH[name]} className="old-value" />}
        <span key={change ? sim.pulses : 'static'} className={change ? 'flash' : ''}>
          <EditableValue
            value={sim.state.reg[name]}
            width={REG_WIDTH[name]}
            label={name}
            onCommit={(v) => setRegister(name, v)}
            className={change ? 'changed-value' : ''}
            style={{ fontSize: REG_WIDTH[name] > 12 ? 17 : 18 }}
          />
        </span>
      </span>
    </div>
  );
}

export function Datapath({ onOpenAlu }: { onOpenAlu: () => void }) {
  const sim = useSim();
  const setMemory = useComputer((s) => s.setMemory);
  const setFlag = useComputer((s) => s.setFlag);
  const t = sim.lastTrace;
  const busy = !!t && t.busSource !== 'none';
  const memState = wireState(t, 'Memory');
  const acLoaded = !!t && t.signals.reg.AC.ld;
  const eChange = t?.changes.find((c) => c.name === 'E');
  const acRole = wireState(t, 'AC');
  const AR = sim.state.reg.AR;

  return (
    <section className="panel" aria-label="Datapath" style={{ flex: '0 1 470px', minWidth: 0, padding: '14px 10px 14px 14px' }}>
      <div className="panel-head" style={{ paddingRight: 6 }}>
        <span className="cap">Datapath · common bus</span>
        <Ref title="Fig. 5-4: Basic computer registers connected to a common bus">Fig. 5-4</Ref>
      </div>
      <div className="scroll-x">
        <div className="datapath" style={{ position: 'relative', width: 440, height: 716 }}>
          <svg width={440} height={716} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
            <rect x={BUS_X} y={22} width={8} height={680} rx={2} fill={busy ? 'var(--cyan)' : 'var(--line)'} className={busy ? 'wire-active' : ''} />
            <Wire y={66} state={memState} sel={7} pulse={sim.pulses} />
            {ROWS.filter((r) => r.name !== 'INPR').map((r) => (
              <Wire key={r.name} y={r.top + 25} state={wireState(t, r.name)} sel={r.sel} pulse={sim.pulses} />
            ))}
            <Wire y={AC_CENTER} state={acRole} sel={4} pulse={sim.pulses} />
            {/* INPR feeds the adder and logic circuit. */}
            <line x1={60} x2={60} y1={AC_TOP + 132} y2={460} stroke={t?.acPaths.some((p) => p.op === 'INPR') ? 'var(--cyan)' : 'var(--line)'} strokeWidth={2} />
          </svg>

          <div className="mono" style={{ position: 'absolute', left: 300, top: 0, fontSize: 11, color: busy ? 'var(--cyan)' : 'var(--muted)' }}>
            S2S1S0 = {toBin(t?.signals.busSelect ?? 0, 3)}
          </div>

          <div className="dp-box" style={{ top: 34, height: 64, borderColor: memState !== 'idle' ? 'var(--cyan)' : undefined }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600 }}>Memory unit</span>
              <span className="cap" style={{ fontSize: 10 }}>
                4096 × 16 · address from AR
              </span>
            </span>
            <span style={{ textAlign: 'right' }}>
              <EditableValue value={sim.state.mem[AR]} width={16} label={`M[${AR.toString(16)}]`} onCommit={(v) => setMemory(AR, v)} style={{ fontSize: 18, color: memState !== 'idle' ? 'var(--cyan)' : undefined }} />
              <div className="cap" style={{ fontSize: 10, color: memState !== 'idle' ? 'var(--cyan)' : undefined }}>
                {t?.signals.memRead ? 'Read' : t?.signals.memWrite ? 'Write' : 'M'}[<Word value={AR} width={12} />]
              </div>
            </span>
          </div>

          {ROWS.map((r) => (
            <RegisterBox key={r.name} name={r.name} top={r.top} t={t} />
          ))}

          <div style={{ position: 'absolute', left: BOX_L, top: AC_TOP, width: BOX_R - BOX_L, height: 132, border: '1px dashed var(--line)', borderRadius: 4, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="alu-button"
              onClick={onOpenAlu}
              style={{ borderColor: acLoaded ? 'var(--cyan)' : undefined, boxShadow: acLoaded ? '0 0 10px rgba(79,216,255,.4)' : undefined }}
            >
              <span>
                <b>Adder &amp; logic</b> <Ref>Fig. 5-21</Ref>
              </span>
              <span className="cap" style={{ color: 'var(--cyan)' }}>
                Open ›
              </span>
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="mono e-box"
                onClick={() => setFlag('E', sim.state.flag.E ? 0 : 1)}
                title="E flip-flop (click to toggle)"
                style={{ borderColor: eChange ? 'var(--amber)' : undefined, color: eChange ? 'var(--amber)' : undefined }}
              >
                <b style={{ fontFamily: 'var(--sans)' }}>E</b> {sim.state.flag.E}
              </button>
              <div style={{ flex: 1, position: 'relative' }}>
                <RegisterBox name="AC" top={0} t={t} height={46} inline />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
