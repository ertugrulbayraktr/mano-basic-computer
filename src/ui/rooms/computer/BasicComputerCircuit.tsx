import { toBin } from '../../../core/bits';
import { CONTROL_EQUATIONS, literalValue, literalValues, termLabel } from '../../../core/basic/controlLogic';
import type { PulseView } from '../../../core/basic/microsteps';
import { REG_WIDTH, REGISTERS, type FlagName, type MachineState, type RegName } from '../../../core/basic/types';
import type { EditTarget } from './RegistersPanel';
import { CircuitCanvas, type Rect } from '../../circuit/CircuitCanvas';
import { Block, Dot, Gate, Pin, Text, Wire } from '../../circuit/parts';
import { fmt } from '../../common/format';
import { useLang, useSettings } from '../../settings';

/**
 * The Basic Computer drawn as one circuit: the control unit of Fig. 5-6 on the left (IR, the
 * 3 × 8 and 4 × 16 decoders, SC, flip-flops and the control gates of Sec. 5-10), the bus
 * select encoder (Table 5-7), the common bus and the registers of Fig. 5-4 on the right.
 * `sub` is the sub-step of the pulse being shown; values are pre-pulse until the clock edge.
 */

const W = 1490;
const H = 1040;

// Control unit.
const IRV = { x: 30, y: 40, w: 150, h: 48 };
const DEC3 = { x: 220, y: 30, w: 60, h: 196 };
const IFF = { x: 220, y: 246, w: 60, h: 34 };
const SCB = { x: 30, y: 330, w: 150, h: 54 };
const DEC4 = { x: 220, y: 300, w: 60, h: 384 };
const FFS: FlagName[] = ['R', 'IEN', 'FGI', 'FGO', 'S'];
const FF_Y = 720;
const CL = { x: 360, y: 20, w: 330, h: 920 };

/** Control outputs along the right edge of the control logic, bus encoder inputs first. */
const GROUP_ORDER = ['Bus', 'Memory', 'AR', 'PC', 'DR', 'AC', 'IR', 'TR', 'OUTR', 'Adder & logic', 'E', 'SC', 'Flip-flops'];
const OUTPUTS = GROUP_ORDER.flatMap((g) => CONTROL_EQUATIONS.filter((e) => e.group === g));
const pinY = (id: string) => CL.y + 58 + OUTPUTS.findIndex((e) => e.id === id) * 21.2;

// Bus side.
const ENC = { x: 730, y: 60, w: 80, h: 156 };
const BUS_X = 870;
const BUS_TOP = 236;
const BUS_BOTTOM = 1010;
const RX = 940;
const RW = 300;

const dLineY = (i: number) => DEC3.y + 24 + i * 21.5;
const tLineY = (i: number) => DEC4.y + 18 + i * 22.8;
const ffY = (i: number) => FF_Y + i * 42;
const xInY = (i: number) => pinY(`x${i}`);

/** Where each literal enters the control logic block (the y of its line), if it has a line. */
function literalEntryY(name: string): number | undefined {
  let m = /^D(\d)$/.exec(name);
  if (m) return dLineY(Number(m[1]));
  m = /^T(\d+)$/.exec(name);
  if (m) return tLineY(Number(m[1]));
  if (name === 'I') return IFF.y + IFF.h / 2;
  const f = FFS.indexOf(name as FlagName);
  if (f >= 0) return ffY(f) + 15;
  if (/^B\d+$/.test(name)) return 40;
  return undefined;
}

interface Row {
  name: RegName | 'Memory';
  y: number;
  h: number;
  sel?: number;
  fromBus: boolean;
}

const ROWS: Row[] = [
  { name: 'Memory', y: 250, h: 74, sel: 7, fromBus: true },
  { name: 'AR', y: 370, h: 54, sel: 1, fromBus: true },
  { name: 'PC', y: 456, h: 54, sel: 2, fromBus: true },
  { name: 'DR', y: 542, h: 54, sel: 3, fromBus: true },
  { name: 'AC', y: 714, h: 54, sel: 4, fromBus: false },
  { name: 'IR', y: 806, h: 54, sel: 5, fromBus: true },
  { name: 'TR', y: 892, h: 54, sel: 6, fromBus: true },
  { name: 'OUTR', y: 970, h: 44, fromBus: true },
];
const ADDER = { x: RX, y: 632, w: RW, h: 46 };
const EBOX = { x: RX - 64, y: 714, w: 48, h: 54 };
const INPR = { x: RX + RW + 40, y: 632, w: 140, h: 46 };

// ---------------- Geometry for the follow camera, x-ray and usage overlays ----------------

const union = (rs: Rect[]): Rect | null => {
  if (!rs.length) return null;
  const x0 = Math.min(...rs.map((r) => r.x));
  const y0 = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w));
  const y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

const FF_INDEX: Record<string, number> = { R: 0, IEN: 1, FGI: 2, FGO: 3, S: 4 };

/** Where an element of `activity.ts` sits in this drawing (for overlays and the camera). */
export function elementRect(id: string): Rect | null {
  const [kind, name] = id.includes(':') ? (id.split(':') as [string, string]) : ['line', id];
  if (kind === 'line') {
    const t = /^T(\d+)$/.exec(name);
    if (t) return { x: DEC4.x + DEC4.w, y: tLineY(Number(t[1])) - 4, w: CL.x - DEC4.x - DEC4.w, h: 8 };
    const d = /^D(\d)$/.exec(name);
    if (d) return { x: DEC3.x + DEC3.w, y: dLineY(Number(d[1])) - 4, w: CL.x - DEC3.x - DEC3.w, h: 8 };
    if (name === 'bus') return { x: BUS_X - 8, y: BUS_TOP, w: 16, h: BUS_BOTTOM - BUS_TOP };
    return null;
  }
  if (kind === 'pin') {
    if (!OUTPUTS.some((e) => e.id === name)) return null;
    return { x: CL.x + CL.w - 88, y: pinY(name) - 9, w: 88, h: 14 };
  }
  if (kind === 'alu') return { ...ADDER };
  if (kind === 'mem') return rowRect('Memory');
  if (kind === 'ff' || kind === 'reg' || kind === 'src' || kind === 'dst') {
    if (name === 'SC') return { ...SCB };
    if (name === 'I') return { ...IFF };
    if (name === 'E') return { ...EBOX };
    if (name === 'INPR') return { ...INPR };
    if (name in FF_INDEX) return { x: DEC4.x - 10, y: ffY(FF_INDEX[name]), w: 70, h: 30 };
    return rowRect(name);
  }
  return null;
}

function rowRect(name: string): Rect | null {
  const r = ROWS.find((row) => row.name === name);
  return r ? { x: RX, y: r.y, w: RW, h: r.h } : null;
}

/** What the follow camera frames in each sub-step of a pulse. */
export function focusRect(view: PulseView | null, sub: number): Rect {
  const whole = { x: 0, y: 0, w: W, h: H };
  if (!view || view.trace.signals.phase === 'halted') return whole;
  const t = view.trace;
  const c = t.signals;
  if (sub === 0) return { x: 20, y: 20, w: CL.x - 10, h: DEC4.y + DEC4.h - 10 };
  if (sub === 1) {
    const pins = view.active.map((a) => elementRect(`pin:${a.output}`)).filter((r): r is Rect => !!r);
    const r = union(pins);
    if (!r) return whole;
    const right = c.busSelect ? ENC.x + ENC.w : CL.x + CL.w;
    return { x: CL.x, y: r.y - 50, w: right - CL.x, h: r.h + 100 };
  }
  if (sub === 2) {
    const names = new Set<string>();
    if (t.busSource !== 'none') {
      names.add(t.busSource);
      for (const r of REGISTERS) if (c.reg[r].ld && r !== 'AC') names.add(r);
    }
    if (c.memRead || c.memWrite) names.add('Memory');
    if (t.acPaths.length) ['DR', 'AC', 'INPR'].forEach((n) => names.add(n));
    for (const r of REGISTERS) if (c.reg[r].inr || c.reg[r].clr) names.add(r);
    const rects = [...names].map((n) => elementRect(`reg:${n}`)).filter((r): r is Rect => !!r);
    if (t.acPaths.length) rects.push({ ...ADDER });
    const u = union(rects);
    if (!u) return whole;
    const x0 = t.busSource !== 'none' ? BUS_X - 40 : u.x - 70;
    return { x: x0, y: u.y - 30, w: u.x + u.w - x0 + 30, h: u.h + 60 };
  }
  const changedRects = t.changes.map((ch) => elementRect(`reg:${ch.name}`)).filter((r): r is Rect => !!r);
  if (t.memory.length) changedRects.push(rowRect('Memory')!);
  return union(changedRects) ?? whole;
}

export function BasicComputerCircuit({
  view,
  sub,
  state,
  onOpenAlu,
  onOpenGates,
  onEdit,
  follow = false,
  xray = null,
  usage = null,
}: {
  view: PulseView | null;
  sub: number;
  state: MachineState;
  onOpenAlu: () => void;
  onOpenGates: () => void;
  /** A register, flip-flop or SC was clicked: open it for editing. */
  onEdit: (name: EditTarget['name'] | 'Memory') => void;
  /** Camera frames each sub-step. */
  follow?: boolean;
  /** Elements of an instruction being x-rayed. */
  xray?: Set<string> | null;
  /** Use counts per element over the timeline. */
  usage?: Map<string, number> | null;
}) {
  const { base } = useSettings();
  const { L } = useLang();
  const t = view?.trace ?? null;
  const live = !!view && t?.signals.phase !== 'halted';
  const s1 = live && sub >= 1;
  const s2 = live && sub >= 2;
  const s3 = live && sub >= 3;
  const c = t?.signals;
  // Values on the drawing: before the clock edge we still see the old contents.
  const shown = view && !s3 ? { ...state, reg: view.trace.before.reg, flag: view.trace.before.flag, SC: view.trace.before.SC } : state;
  const changed = (n: string) => s3 && !!t?.changes.some((ch) => ch.name === n);
  const oldValue = (n: string) => t?.changes.find((ch) => ch.name === n)?.before;
  const T = live ? view!.T : -1;
  const D = live ? view!.D : -1;
  const v = (val: number, width: number) => fmt(val, width, base === 'bin' && width > 12 ? 'hex' : base);

  const sourceOf = (n: string) => s2 && t?.busSource === n;
  const destOf = (r: Row) => s2 && !!c && (r.name === 'Memory' ? c.memWrite : r.name !== 'AC' && c.reg[r.name].ld);
  const busOn = s2 && t?.busSource !== 'none';

  return (
    <CircuitCanvas width={W} height={H} label={L('Basic Computer circuit: control unit, bus and registers', 'Temel Bilgisayar devresi: kontrol birimi, ortak yol ve yazmaçlar')} focus={follow ? focusRect(view, sub) : null}>
      {/* ---------------- Control unit ---------------- */}
      <Text at={[30, 14]} size={12.5} weight={600} tone="muted">
        {L('Control unit (Fig. 5-6)', 'Kontrol birimi (Şekil 5-6)')}
      </Text>

      {/* IR as seen by the control unit. */}
      <Block x={IRV.x} y={IRV.y} w={IRV.w} h={IRV.h} dashed title={L('Instruction register (the same IR as on the bus)', 'Komut yazmacı (ortak yoldaki IR ile aynı)')}>
        <Text at={[IRV.x + 10, IRV.y + 16]} size={12.5} tone="muted">
          IR
        </Text>
        <Text at={[IRV.x + 10, IRV.y + 34]} size={14} mono>
          {toBin(shown.reg.IR >> 15, 1)} {toBin((shown.reg.IR >> 12) & 7, 3)} {fmt(shown.reg.IR & 0xfff, 12, 'hex')}
        </Text>
      </Block>
      {/* IR(12-14) → 3×8 decoder, IR(15) → I, IR(0-11) → control logic as B0…B11 */}
      <Wire points={[[IRV.x + IRV.w, IRV.y + 24], [200, IRV.y + 24], [200, DEC3.y + DEC3.h / 2], [DEC3.x, DEC3.y + DEC3.h / 2]]} on={live} kind="data" />
      <Text at={[188, IRV.y + 14]} size={12} mono tone="muted" anchor="end">
        12-14
      </Text>
      <Wire points={[[IRV.x + 40, IRV.y + IRV.h], [IRV.x + 40, IFF.y + IFF.h / 2], [IFF.x, IFF.y + IFF.h / 2]]} on={live} />
      <Text at={[IRV.x + 46, IRV.y + IRV.h + 12]} size={12} mono tone="muted">
        15
      </Text>
      <Wire points={[[IRV.x + 110, IRV.y], [IRV.x + 110, 10], [345, 10], [345, 40], [CL.x, 40]]} on={live && T === 3 && D === 7} kind="data" />
      <Text at={[200, 4]} size={12} mono tone="muted">
        IR(0-11) = B0…B11
      </Text>

      {/* 3 × 8 operation decoder */}
      <Block x={DEC3.x} y={DEC3.y} w={DEC3.w} h={DEC3.h} on={live}>
        <Text at={[DEC3.x + DEC3.w / 2, DEC3.y + DEC3.h / 2 - 8]} size={11.5} anchor="middle" tone="muted">
          3 × 8
        </Text>
        <Text at={[DEC3.x + DEC3.w / 2, DEC3.y + DEC3.h / 2 + 6]} size={11.5} anchor="middle" tone="muted">
          {L('decoder', 'kod çözücü')}
        </Text>
      </Block>
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i}>
          <Wire points={[[DEC3.x + DEC3.w, dLineY(i)], [CL.x, dLineY(i)]]} on={D === i} />
          <Text at={[DEC3.x + DEC3.w + 6, dLineY(i) - 6]} size={12.5} mono tone={D === i ? 'active' : 'muted'} weight={D === i ? 600 : 400}>
            D{i}
          </Text>
        </g>
      ))}

      {/* I flip-flop */}
      <Block x={IFF.x} y={IFF.y} w={IFF.w} h={IFF.h} on={live && shown.flag.I === 1} title={L('I flip-flop: addressing mode. Click to edit.', 'I flip-flop\'u: adresleme modu. Düzenlemek için tıkla.')} onClick={() => onEdit('I')}>
        <Text at={[IFF.x + 10, IFF.y + IFF.h / 2]} size={12} weight={600}>
          I
        </Text>
        <Text at={[IFF.x + IFF.w - 10, IFF.y + IFF.h / 2]} size={13} mono anchor="end" tone={changed('I') ? 'changed' : 'text'}>
          {shown.flag.I}
        </Text>
      </Block>
      <Wire points={[[IFF.x + IFF.w, IFF.y + IFF.h / 2], [CL.x, IFF.y + IFF.h / 2]]} on={live && shown.flag.I === 1} />

      {/* Sequence counter */}
      <Block x={SCB.x} y={SCB.y} w={SCB.w} h={SCB.h} on={live} changed={changed('SC')} title={L('Sequence counter SC (4 bits). Click to edit.', 'Sıra sayıcı SC (4 bit). Düzenlemek için tıkla.')} onClick={() => onEdit('SC')}>
        <Text at={[SCB.x + 10, SCB.y + 18]} size={12.5} tone="muted">
          SC
        </Text>
        <Text at={[SCB.x + 10, SCB.y + 38]} size={16} mono tone={changed('SC') ? 'changed' : 'text'}>
          {toBin(shown.SC, 4)}
        </Text>
        <Text at={[SCB.x + SCB.w - 10, SCB.y + 38]} size={12.5} mono anchor="end" tone="muted">
          = {shown.SC}
        </Text>
      </Block>
      <Pin at={[SCB.x + 50, SCB.y]} name="INR" on={s1 && c?.sc === 'inc'} />
      <Pin at={[SCB.x + 100, SCB.y]} name="CLR" on={s1 && c?.sc === 'clr'} />
      <Wire points={[[SCB.x + SCB.w, SCB.y + SCB.h / 2], [DEC4.x, SCB.y + SCB.h / 2]]} on={live} kind="data" />

      {/* 4 × 16 timing decoder */}
      <Block x={DEC4.x} y={DEC4.y} w={DEC4.w} h={DEC4.h} on={live}>
        <Text at={[DEC4.x + DEC4.w / 2, DEC4.y + DEC4.h / 2 - 8]} size={11.5} anchor="middle" tone="muted">
          4 × 16
        </Text>
        <Text at={[DEC4.x + DEC4.w / 2, DEC4.y + DEC4.h / 2 + 6]} size={11.5} anchor="middle" tone="muted">
          {L('decoder', 'kod çözücü')}
        </Text>
      </Block>
      {Array.from({ length: 16 }, (_, i) => (
        <g key={i}>
          <Wire points={[[DEC4.x + DEC4.w, tLineY(i)], [CL.x, tLineY(i)]]} on={T === i} />
          <Text at={[DEC4.x + DEC4.w + 6, tLineY(i) - 6]} size={12.5} mono tone={T === i ? 'active' : 'muted'} weight={T === i ? 600 : 400}>
            T{i}
          </Text>
        </g>
      ))}

      {/* Other flip-flops that feed the control logic */}
      {FFS.map((f, i) => {
        const on = live && shown.flag[f] === 1;
        return (
          <g key={f}>
            <Block x={DEC4.x - 10} y={ffY(i)} w={70} h={30} on={on} changed={changed(f)} title={L(`${f} flip-flop. Click to edit.`, `${f} flip-flop'u. Düzenlemek için tıkla.`)} onClick={() => onEdit(f)}>
              <Text at={[DEC4.x, ffY(i) + 15]} size={12.5} weight={600}>
                {f}
              </Text>
              <Text at={[DEC4.x + 50, ffY(i) + 15]} size={13} mono anchor="end" tone={changed(f) ? 'changed' : 'text'}>
                {shown.flag[f]}
              </Text>
            </Block>
            <Wire points={[[DEC4.x + 60, ffY(i) + 15], [CL.x, ffY(i) + 15]]} on={on} />
          </g>
        );
      })}

      {/* Control logic gates */}
      <ControlGates view={view} sub={sub} live={live} onOpen={onOpenGates} />

      {/* ---------------- Bus select encoder (Table 5-7) ---------------- */}
      <Block x={ENC.x} y={ENC.y} w={ENC.w} h={ENC.h} on={s2 && busOn} title={L('Bus select encoder (Table 5-7)', 'Yol seçim kodlayıcısı (Tablo 5-7)')}>
        <Text at={[ENC.x + ENC.w / 2, ENC.y + ENC.h / 2 - 8]} size={11.5} anchor="middle" tone="muted">
          {L('encoder', 'kodlayıcı')}
        </Text>
        <Text at={[ENC.x + ENC.w / 2, ENC.y + ENC.h / 2 + 6]} size={11.5} anchor="middle" tone="muted">
          {L('Table 5-7', 'Tablo 5-7')}
        </Text>
      </Block>
      {[1, 2, 3, 4, 5, 6, 7].map((i) => {
        const on = s1 && c?.busSelect === i;
        return (
          <g key={i}>
            <Wire points={[[CL.x + CL.w, xInY(i)], [ENC.x, xInY(i)]]} on={on} />
            <Text at={[ENC.x - 6, xInY(i) - 6]} size={12.5} mono anchor="end" tone={on ? 'active' : 'muted'} weight={on ? 600 : 400}>
              x{i}
            </Text>
          </g>
        );
      })}
      <Wire points={[[ENC.x + ENC.w / 2, ENC.y + ENC.h], [ENC.x + ENC.w / 2, BUS_TOP - 10], [BUS_X - 30, BUS_TOP - 10]]} on={busOn} kind="data" arrow />
      <Text at={[ENC.x + ENC.w / 2 + 8, ENC.y + ENC.h + 14]} size={11.5} mono tone={busOn ? 'active' : 'muted'} weight={busOn ? 600 : 400}>
        S2S1S0 = {toBin(s2 ? (c?.busSelect ?? 0) : 0, 3)}
      </Text>

      {/* ---------------- Common bus (Fig. 5-4) ---------------- */}
      <Text at={[BUS_X - 28, BUS_TOP - 30]} size={12.5} weight={600} tone="muted">
        {L('Common bus (Fig. 5-4)', 'Ortak yol (Şekil 5-4)')}
      </Text>
      <Block x={BUS_X - 30} y={BUS_TOP - 22} w={60} h={24} on={busOn} title={L('Bus multiplexer: S2S1S0 selects the source', 'Yol çoklayıcısı: S2S1S0 kaynağı seçer')}>
        <Text at={[BUS_X, BUS_TOP - 10]} size={11.5} anchor="middle" mono tone={busOn ? 'active' : 'muted'}>
          {L('select', 'seçim')}
        </Text>
      </Block>
      <Wire points={[[BUS_X, BUS_TOP + 2], [BUS_X, BUS_BOTTOM]]} on={busOn} kind="bus" />
      {busOn && t?.busValue !== null && t?.busValue !== undefined && (
        <g>
          <rect x={BUS_X - 34} y={BUS_TOP + 8} width={68} height={22} rx={5} fill="var(--active)" />
          <Text at={[BUS_X, BUS_TOP + 19]} size={12} mono anchor="middle" weight={600}>
            <tspan fill="#fff">{v(t.busValue, 16)}</tspan>
          </Text>
        </g>
      )}

      {/* ---------------- Registers and memory ---------------- */}
      {ROWS.map((r) => {
        const inY = r.y + 14;
        const outY = r.y + r.h - 14;
        const name = r.name;
        const width = name === 'Memory' ? 16 : REG_WIDTH[name];
        const value = name === 'Memory' ? shown.mem[shown.reg.AR] : shown.reg[name];
        const ch = name !== 'Memory' && changed(name);
        const memWritten = name === 'Memory' && s3 && !!t?.memory.length;
        const src = sourceOf(name);
        const dst = destOf(r);
        const ctl = name === 'Memory' ? null : c?.reg[name];
        const pins: [string, boolean][] =
          name === 'Memory'
            ? [['Read', !!c?.memRead], ['Write', !!c?.memWrite]]
            : name === 'IR' || name === 'OUTR'
              ? [['LD', !!ctl?.ld]]
              : [['LD', !!ctl?.ld], ['INR', !!ctl?.inr], ['CLR', !!ctl?.clr]];
        return (
          <g key={name}>
            {r.fromBus && (
              <Wire points={[[BUS_X + 4, inY], [RX, inY]]} on={dst} kind="data" arrow travel />
            )}
            {r.sel !== undefined && (
              <>
                <Wire points={[[RX, outY], [BUS_X + 4, outY]]} on={src} kind="data" arrow travel />
                <Text at={[BUS_X + 16, outY - 8]} size={12.5} mono tone={src ? 'active' : 'muted'} weight={src ? 600 : 400}>
                  {r.sel}
                </Text>
              </>
            )}
            <Block
              x={RX}
              y={r.y}
              w={RW}
              h={r.h}
              on={src || dst}
              changed={ch || memWritten}
              title={name === 'Memory' ? L('Memory unit 4096 × 16. Click to see the memory.', 'Bellek birimi 4096 × 16. Belleği görmek için tıkla.') : L(`${name} (${width} bits). Click to edit.`, `${name} (${width} bit). Düzenlemek için tıkla.`)}
              onClick={() => onEdit(name)}
            >
              <Text at={[RX + 12, r.y + r.h / 2 - (name === 'Memory' ? 8 : 0)]} size={13} weight={600}>
                {name === 'Memory' ? L('Memory 4096 × 16', 'Bellek 4096 × 16') : name}
              </Text>
              {name === 'Memory' && (
                <Text at={[RX + 12, r.y + r.h / 2 + 12]} size={11.5} mono tone="muted">
                  M[AR] = M[{fmt(shown.reg.AR, 12, 'hex')}]
                </Text>
              )}
              {ch && oldValue(name) !== undefined && (
                <Text at={[RX + RW - 12, r.y + 14]} size={11.5} mono anchor="end" tone="muted">
                  {L('was', 'önceden')} {v(oldValue(name)!, width)}
                </Text>
              )}
              <Text at={[RX + RW - 12, r.y + r.h / 2 + (ch ? 6 : 0)]} size={17} mono anchor="end" tone={ch || memWritten ? 'changed' : 'text'} weight={500}>
                {memWritten ? v(t!.memory[0].after, 16) : v(value, width)}
              </Text>
            </Block>
            {pins.map(([p, on], i) => (
              <Pin key={p} at={[RX + 70 + i * 46, r.y]} name={p} on={s1 && on} />
            ))}
          </g>
        );
      })}

      {/* Memory address comes from AR, not from the bus. */}
      <Wire
        points={[[RX + RW, 397], [RX + RW + 24, 397], [RX + RW + 24, 287], [RX + RW, 287]]}
        on={s2 && !!(c?.memRead || c?.memWrite)}
        kind="data"
        arrow
      />
      <Text at={[RX + RW + 30, 342]} size={12.5} tone="muted">
        {L('address', 'adres')}
      </Text>

      {/* Adder and logic circuit, E and AC (Fig. 5-20, 5-21). */}
      <Block x={ADDER.x} y={ADDER.y} w={ADDER.w} h={ADDER.h} on={s2 && !!t?.acPaths.length} onClick={onOpenAlu} title={L('Adder and logic circuit, click to open Fig. 5-21', 'Toplayıcı ve mantık devresi; Şekil 5-21\'i açmak için tıkla')}>
        <Text at={[ADDER.x + 12, ADDER.y + ADDER.h / 2]} size={12} weight={600}>
          {L('Adder & logic', 'Toplayıcı ve mantık')}
        </Text>
        <Text at={[ADDER.x + ADDER.w - 12, ADDER.y + ADDER.h / 2]} size={11.5} anchor="end" tone="active">
          {L('Open Fig. 5-21', 'Şekil 5-21\'i aç')}
        </Text>
        {s2 && t?.acPaths.length ? (
          <Text at={[ADDER.x + 120, ADDER.y + ADDER.h / 2]} size={12.5} mono tone="active">
            {t.acPaths.map((p) => p.op).join(' + ')}
          </Text>
        ) : null}
      </Block>
      <Wire points={[[RX + 200, 596], [RX + 200, ADDER.y]]} on={s2 && !!t?.acPaths.some((p) => ['AND', 'ADD', 'DR'].includes(p.op))} kind="data" arrow />
      <Text at={[RX + 206, 614]} size={12.5} tone="muted">
        DR
      </Text>
      <Wire points={[[RX + 150, ADDER.y + ADDER.h], [RX + 150, 714]]} on={s2 && !!t?.acPaths.length} kind="data" arrow />
      <Wire points={[[INPR.x, INPR.y + INPR.h / 2], [ADDER.x + ADDER.w, INPR.y + INPR.h / 2]]} on={s2 && !!t?.acPaths.some((p) => p.op === 'INPR')} kind="data" arrow />
      <Block x={INPR.x} y={INPR.y} w={INPR.w} h={INPR.h} changed={changed('INPR')} title={L('Input register, filled by the keyboard. Click to edit.', 'Giriş yazmacı, klavyeden dolar. Düzenlemek için tıkla.')} onClick={() => onEdit('INPR')}>
        <Text at={[INPR.x + 10, INPR.y + INPR.h / 2]} size={12} weight={600}>
          INPR
        </Text>
        <Text at={[INPR.x + INPR.w - 10, INPR.y + INPR.h / 2]} size={15} mono anchor="end">
          {v(shown.reg.INPR, 8)}
        </Text>
      </Block>
      <Block x={EBOX.x} y={EBOX.y} w={EBOX.w} h={EBOX.h} changed={changed('E')} on={s1 && !!(c?.e.clr || c?.e.com || c?.e.load)} title={L('E flip-flop: carry / extended AC bit. Click to edit.', 'E flip-flop\'u: elde / genişletilmiş AC biti. Düzenlemek için tıkla.')} onClick={() => onEdit('E')}>
        <Text at={[EBOX.x + 10, EBOX.y + EBOX.h / 2]} size={12} weight={600}>
          E
        </Text>
        <Text at={[EBOX.x + EBOX.w - 10, EBOX.y + EBOX.h / 2]} size={15} mono anchor="end" tone={changed('E') ? 'changed' : 'text'}>
          {shown.flag.E}
        </Text>
      </Block>
      <Wire points={[[EBOX.x + EBOX.w / 2, EBOX.y], [EBOX.x + EBOX.w / 2, ADDER.y + ADDER.h / 2], [ADDER.x, ADDER.y + ADDER.h / 2]]} on={s2 && !!t?.acPaths.some((p) => p.e !== undefined)} />

      {/* Clock: every register latches on the same edge. */}
      {s3 && (
        <g>
          <rect x={RX + RW + 50} y={940} width={120} height={28} rx={6} fill="var(--changed-soft)" stroke="var(--changed)" />
          <Text at={[RX + RW + 110, 954]} size={12.5} anchor="middle" tone="changed" weight={600}>
            ⎍ {L('clock edge', 'saat kenarı')}
          </Text>
        </g>
      )}
      <Dot at={[BUS_X, BUS_TOP + 2]} on={busOn} />

      {/* A pulse of data travelling from the bus source to each destination. */}
      {busOn && !s3 && t && <BusPulse source={t.busSource} targets={ROWS.filter((r) => destOf(r)).map((r) => r.name)} />}

      {xray && <Overlay ids={xray} kind="xray" />}
      {usage && <Overlay ids={new Set(usage.keys())} kind="usage" counts={usage} />}
    </CircuitCanvas>
  );
}

/**
 * The control logic block. Every control output of Sec. 5-10 is a pin on its right edge. The
 * AND gates whose term is 1 in this pulse are drawn with wires from the T, D and flip-flop
 * lines that feed them to the outputs they raise.
 */
function ControlGates({ view, sub, live, onOpen }: { view: PulseView | null; sub: number; live: boolean; onOpen: () => void }) {
  const { L } = useLang();
  const lit = live && sub >= 1;
  const values = view ? literalValues({ ...view.trace.before, mem: new Uint16Array(0) }) : null;

  // One row per distinct product term that is 1, with every output it drives.
  const terms = new Map<string, { term: string[]; outputs: string[] }>();
  if (view && live) {
    for (const g of Object.values(view.gates)) {
      if (!g.out) continue;
      g.equation.terms.forEach((term, i) => {
        if (!g.terms[i]) return;
        const key = termLabel(term);
        const row = terms.get(key) ?? { term, outputs: [] };
        row.outputs.push(g.equation.id);
        terms.set(key, row);
      });
    }
  }
  const avgPin = (outs: string[]) => outs.reduce((a, o) => a + pinY(o), 0) / outs.length;
  const rows = [...terms.entries()].sort((a, b) => avgPin(a[1].outputs) - avgPin(b[1].outputs));
  let bottom = CL.y + 60;
  const placed = rows.map(([label, r], idx) => {
    const h = Math.max(22, r.term.length * 10 + 4);
    const y = Math.max(bottom + 18, avgPin(r.outputs) - h / 2);
    bottom = y + h;
    return { label, ...r, y, h, idx };
  });
  const gx = CL.x + 170;
  const pinX = CL.x + CL.w - 84;

  return (
    <g>
      <Block x={CL.x} y={CL.y} w={CL.w} h={CL.h} dashed onClick={onOpen} title={L('Control logic gates, click to see every equation', 'Kontrol mantık kapıları; tüm denklemleri görmek için tıkla')}>
        <Text at={[CL.x + 14, CL.y + 20]} size={12.5} weight={600} tone="muted">
          {L('Control logic gates', 'Kontrol mantık kapıları')}
        </Text>
        <Text at={[CL.x + 14, CL.y + 36]} size={11.5} tone="muted">
          {L('Sec. 5-10. Click for every equation.', 'Kısım 5-10. Tüm denklemler için tıkla.')}
        </Text>
      </Block>

      {/* Output pins */}
      {OUTPUTS.map((e) => {
        const on = lit && !!view?.gates[e.id].out;
        return (
          <g key={e.id}>
            <Wire points={[[pinX, pinY(e.id)], [CL.x + CL.w, pinY(e.id)]]} on={on} />
            <Text at={[CL.x + CL.w - 6, pinY(e.id) - 6]} size={12} mono anchor="end" tone={on ? 'active' : 'muted'} weight={on ? 600 : 400}>
              {e.name}
            </Text>
          </g>
        );
      })}

      {placed.length === 0 && (
        <Text at={[CL.x + 14, CL.y + 70]} size={12.5} tone="muted">
          {live ? L('No gate outputs 1 in this pulse.', 'Bu darbede hiçbir kapı 1 vermiyor.') : L('Step a pulse to see the gates.', 'Kapıları görmek için bir darbe ilerlet.')}
        </Text>
      )}

      {placed.map((r) => {
        const outY = r.y + r.h / 2;
        const trunk = CL.x + 214 + r.idx * 7;
        return (
          <g key={r.label} opacity={lit ? 1 : 0.4}>
            {r.term.map((litName, k) => {
              const neg = litName.endsWith("'");
              const name = neg ? litName.slice(0, -1) : litName;
              const inY = r.y + 7 + k * 10;
              const ey = literalEntryY(name);
              const on = lit && !!values && literalValue(litName, values) === 1;
              const vx = CL.x + 24 + r.idx * 12 + k * 4;
              return (
                <g key={k}>
                  {ey !== undefined ? (
                    <Wire points={[[CL.x, ey], [vx, ey], [vx, inY], [gx - (neg ? 6 : 0), inY]]} on={on} />
                  ) : (
                    <Wire points={[[gx - 30, inY], [gx - (neg ? 6 : 0), inY]]} on={on} />
                  )}
                  {neg && <circle cx={gx - 3} cy={inY} r={3} fill="var(--surface)" stroke={on ? 'var(--active)' : 'var(--wire)'} strokeWidth={1.2} />}
                  <Text at={[gx - 8, inY - 4]} size={12.5} mono anchor="end" tone={on ? 'active' : 'muted'}>
                    {litName.replace('AC15', 'AC(15)').replace('ACZ', 'AC=0').replace('DRZ', 'DR=0')}
                  </Text>
                </g>
              );
            })}
            <Gate type="AND" x={gx} y={r.y} w={30} h={r.h} on={lit} />
            <Text at={[gx + 15, r.y - 6]} size={12.5} mono anchor="middle" tone={lit ? 'active' : 'muted'} weight={600}>
              {r.label}
            </Text>
            {r.outputs.map((o) => (
              <Wire key={o} points={[[gx + 30, outY], [trunk, outY], [trunk, pinY(o)], [pinX, pinY(o)]]} on={lit} />
            ))}
          </g>
        );
      })}
    </g>
  );
}

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A dot that rides the wires from the bus source to a destination register. */
function BusPulse({ source, targets }: { source: string; targets: string[] }) {
  if (reduced()) return null;
  const src = ROWS.find((r) => r.name === source);
  if (!src) return null;
  const outY = src.y + src.h - 14;
  return (
    <g pointerEvents="none">
      {targets.map((name) => {
        const dst = ROWS.find((r) => r.name === name)!;
        const inY = dst.y + 14;
        const path = `M${RX} ${outY} H${BUS_X} V${inY} H${RX}`;
        return (
          <circle key={name} r={5.5} fill="var(--signal)" stroke="#fff" strokeWidth={2}>
            <animateMotion dur="1.4s" repeatCount="indefinite" path={path} />
          </circle>
        );
      })}
    </g>
  );
}

/**
 * X-ray: a dashed outline around every element an instruction will use.
 * Usage: elements shaded by how many pulses used them, with the count.
 */
function Overlay({ ids, kind, counts }: { ids: Set<string>; kind: 'xray' | 'usage'; counts?: Map<string, number> }) {
  const max = counts ? Math.max(1, ...counts.values()) : 1;
  const items = new Map<string, { r: Rect; n: number }>();
  for (const id of ids) {
    const r = elementRect(id);
    if (!r) continue;
    const key = `${r.x},${r.y},${r.w},${r.h}`;
    const n = counts?.get(id) ?? 0;
    const prev = items.get(key);
    if (!prev || n > prev.n) items.set(key, { r, n });
  }
  return (
    <g pointerEvents="none">
      {[...items].map(([key, { r, n }]) =>
        kind === 'xray' ? (
          <rect key={key} x={r.x - 4} y={r.y - 4} width={r.w + 8} height={r.h + 8} rx={4} fill="rgb(35 39 47 / 0.05)" stroke="var(--ink)" strokeWidth={1.4} strokeDasharray="5 3" />
        ) : (
          <g key={key}>
            <rect x={r.x - 3} y={r.y - 3} width={r.w + 6} height={r.h + 6} rx={3} fill={`rgb(35 39 47 / ${0.04 + 0.22 * (n / max)})`} />
            <g transform={`translate(${r.x + r.w + 3}, ${r.y + 2})`}>
              <rect x={0} y={-7} width={String(n).length * 6.5 + 10} height={14} rx={7} fill="var(--ink)" />
              <text x={5} y={0.5} dominantBaseline="middle" fontSize={10} fontFamily="var(--mono)" fill="#fff">
                {n}
              </text>
            </g>
          </g>
        ),
      )}
    </g>
  );
}
