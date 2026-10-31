import type { Bit } from '../../../core/bits';
import type { AluCircuit as AluData, AluStage } from '../../../core/alu/aluSteps';
import { CircuitCanvas, type Rect } from '../../circuit/CircuitCanvas';
import { Block, Mux, muxInputY, Text, Wire, type Pt } from '../../circuit/parts';
import { GateSymbol } from '../../common/GateSymbol';
import { useLang } from '../../settings';

/**
 * Fig. 4-13 drawn for all stages, MSB on the left. Wires show their logic value once it has
 * settled (blue = 1, gray = 0); signals that have not settled yet are dashed.
 * `step` indexes AluData.steps: inputs, Y MUXes, one full adder per stage, logic, output, status.
 */

const COL = 300;
const LEFT = 80;
const SEL_Y = 76;
const LSEL_Y = 262;
const OSEL_Y = 486;

const YMUX = { dx: 22, y: 92, w: 36, h: 112 };
const FA = { dx: 112, y: 100, w: 88, h: 92 };
const GATES_Y = [296, 336, 376, 416];
const LMUX = { dx: 132, y: 276, w: 34, h: 160 };
const OMUX = { dx: 204, y: 506, w: 40, h: 160 };

/** Value wire: on when 1 after it settles, dashed before. */
function V({ points, value, settled, kind = 'data' }: { points: Pt[]; value: Bit; settled: boolean; kind?: 'data' | 'signal' }) {
  return <Wire points={points} on={settled && value === 1} dashed={!settled} kind={kind} />;
}

/** What the follow camera frames at each propagation step. */
export function aluFocusRect(data: AluData, step: number): Rect {
  const n = data.width;
  const W = LEFT + n * COL + 40;
  const x0 = (i: number) => LEFT + (n - 1 - i) * COL;
  if (step <= 0) return { x: 0, y: 0, w: W, h: 860 };
  if (step === 1) return { x: LEFT - 40, y: 60, w: n * COL + 40, h: 170 };
  if (step < 2 + n) {
    const i = step - 2;
    return { x: x0(i) - 100, y: 50, w: COL + 140, h: 200 };
  }
  if (step === 2 + n) return { x: LEFT - 40, y: 250, w: n * COL + 40, h: 210 };
  if (step === 3 + n) return { x: LEFT, y: 470, w: n * COL, h: 270 };
  return { x: LEFT - 30, y: 740, w: n * COL, h: 120 };
}

export function AluCircuit({ data, step, follow = false }: { data: AluData; step: number; follow?: boolean }) {
  const { L } = useLang();
  const n = data.width;
  const W = LEFT + n * COL + 40;
  const H = 860;
  const s1s0 = data.select & 3;
  const s3s2 = (data.select >> 2) & 3;
  const yOn = step >= 1;
  const faDone = (i: number) => step >= 2 + i;
  const logicOn = step >= 2 + n;
  const outOn = step >= 3 + n;
  const statusOn = step >= 4 + n;
  const x0 = (i: number) => LEFT + (n - 1 - i) * COL;
  const bit = (b: Bit, settled: boolean) => (settled ? String(b) : '·');

  return (
    <CircuitCanvas width={W} height={H} label={L('ALU circuit, Fig. 4-13, all stages', 'ALU devresi, Şekil 4-13, tüm katlar')} focus={follow ? aluFocusRect(data, step) : null}>
      {/* Select lines shared by every stage */}
      {[
        [SEL_Y, `S1S0 = ${s1s0.toString(2).padStart(2, '0')}`],
        [LSEL_Y, `S1S0 = ${s1s0.toString(2).padStart(2, '0')}`],
        [OSEL_Y, `S3S2 = ${s3s2.toString(2).padStart(2, '0')}`],
      ].map(([y, label]) => (
        <g key={y as number}>
          <Wire points={[[20, y as number], [W - 30, y as number]]} on kind="signal" />
          <Text at={[20, (y as number) - 9]} size={11.5} mono tone="active" weight={600}>
            {label}
          </Text>
        </g>
      ))}

      {data.stages.map((s) => (
        <Stage key={s.i} s={s} x={x0(s.i)} n={n} s1s0={s1s0} s3s2={s3s2} yOn={yOn} faDone={faDone} logicOn={logicOn} outOn={outOn} bit={bit} />
      ))}

      {/* Carry into stage 0 */}
      <V points={[[x0(0) + FA.dx + FA.w + 50, FA.y + 70], [x0(0) + FA.dx + FA.w, FA.y + 70]]} value={data.cin} settled />
      <Text at={[x0(0) + FA.dx + FA.w + 54, FA.y + 70]} size={12.5} mono tone={data.cin ? 'active' : 'muted'} weight={600}>
        Cin = C0 = {data.cin}
      </Text>
      {/* Output carry */}
      <V points={[[x0(n - 1) + FA.dx + 10, FA.y + FA.h], [x0(n - 1) + FA.dx + 10, 226], [24, 226], [24, 790]]} value={data.stages[n - 1].cout} settled={faDone(n - 1)} />
      <Text at={[30, 236]} size={11.5} mono tone="muted">
        C{n}
      </Text>

      {/* Output word and status bits */}
      <Text at={[LEFT, 768]} size={12.5} weight={600} tone="muted">
        {L('Output', 'Çıkış')}
      </Text>
      <Text at={[LEFT + 70, 768]} size={18} mono tone={outOn ? 'active' : 'muted'} weight={600}>
        F = {outOn ? data.stages.map((s) => s.f).reverse().join('') : '·'.repeat(n)}
      </Text>
      <Block x={LEFT} y={790} w={n * COL - 60} h={52} on={statusOn} title={L('Status bits, Fig. 8-8', 'Durum bitleri, Şekil 8-8')}>
        {[
          ['C', data.status.c, `C = C${n}`],
          ['S', data.status.s, `S = F${n - 1}`],
          ['Z', data.status.z, 'Z = NOR of F'],
          ['V', data.status.v, `V = C${n - 1} ⊕ C${n}`],
        ].map(([k, v, f], j) => {
          const meaningless = !data.carryMeaningful && (k === 'C' || k === 'V');
          return (
            <g key={k as string}>
              <Text at={[LEFT + 20 + j * 250, 816]} size={15} mono weight={600} tone={statusOn && !meaningless ? (v ? 'changed' : 'text') : 'muted'}>
                {k} = {statusOn ? v : '·'}
              </Text>
              <Text at={[LEFT + 90 + j * 250, 816]} size={12} mono tone="muted">
                {f as string}
                {meaningless && statusOn ? L(' (meaningless)', ' (anlamsız)') : ''}
              </Text>
            </g>
          );
        })}
      </Block>
    </CircuitCanvas>
  );
}

function Stage({
  s,
  x,
  n,
  s1s0,
  s3s2,
  yOn,
  faDone,
  logicOn,
  outOn,
  bit,
}: {
  s: AluStage;
  x: number;
  n: number;
  s1s0: number;
  s3s2: number;
  yOn: boolean;
  faDone: (i: number) => boolean;
  logicOn: boolean;
  outOn: boolean;
  bit: (b: Bit, settled: boolean) => string;
}) {
  const i = s.i;
  const { L } = useLang();
  const done = faDone(i);
  const cinSettled = i === 0 || faDone(i - 1);
  const ym = { x: x + YMUX.dx, y: YMUX.y, w: YMUX.w, h: YMUX.h };
  const yOutY = ym.y + ym.h / 2;
  const fa = { x: x + FA.dx, y: FA.y, w: FA.w, h: FA.h };
  const lm = { x: x + LMUX.dx, y: LMUX.y, w: LMUX.w, h: LMUX.h };
  const om = { x: x + OMUX.dx, y: OMUX.y, w: OMUX.w, h: OMUX.h };
  const oIn = (k: number) => muxInputY(om.y, om.h, 4, k);
  const gateVals: Bit[] = [s.gates.and, s.gates.or, s.gates.xor, s.gates.not];
  const yLabels = s.yInputs.map((y) => (y.source === '1s' ? '1' : y.source));

  return (
    <g>
      <Text at={[x + 130, 22]} size={12} weight={600} anchor="middle">
        {L('Stage', 'Kat')} {i}
      </Text>
      <Text at={[x + 130, 40]} size={12.5} mono anchor="middle" tone="muted">
        A{i} = {s.a}, B{i} = {s.b}
      </Text>
      <rect x={x - 6} y={52} width={COL - 24} height={680} rx={10} fill="none" stroke="var(--line-soft)" strokeDasharray="4 4" />

      {/* Arithmetic stage: Y multiplexer and full adder */}
      <Wire points={[[ym.x + ym.w / 2, SEL_Y], [ym.x + ym.w / 2, ym.y + 4]]} on kind="signal" />
      {s.yInputs.map((yi, k) => (
        <g key={k}>
          <V points={[[ym.x - 14, muxInputY(ym.y, ym.h, 4, k)], [ym.x, muxInputY(ym.y, ym.h, 4, k)]]} value={yi.value} settled kind="signal" />
          <Text at={[ym.x - 16, muxInputY(ym.y, ym.h, 4, k)]} size={12.5} mono anchor="end" tone={yOn && k === s1s0 ? 'active' : 'muted'} weight={yOn && k === s1s0 ? 600 : 400}>
            {yLabels[k]}={yi.value}
          </Text>
        </g>
      ))}
      <Mux x={ym.x} y={ym.y} w={ym.w} h={ym.h} inputs={yLabels} selected={s1s0} on={yOn} title={L(`Y${i} multiplexer`, `Y${i} çoklayıcısı`)} />
      <V points={[[ym.x + ym.w, yOutY], [fa.x, yOutY]]} value={s.y} settled={yOn} />
      <Text at={[ym.x + ym.w + 6, yOutY - 9]} size={12.5} mono tone={yOn ? 'active' : 'muted'}>
        Y{i}={bit(s.y, yOn)}
      </Text>

      <V points={[[fa.x + 30, 50], [fa.x + 30, fa.y]]} value={s.a} settled kind="signal" />
      <Block x={fa.x} y={fa.y} w={fa.w} h={fa.h} on={done} title={L(`Full adder of stage ${i}`, `Kat ${i}'in tam toplayıcısı`)}>
        <Text at={[fa.x + fa.w / 2, fa.y + 34]} size={13} anchor="middle" weight={600}>
          FA
        </Text>
        <Text at={[fa.x + fa.w / 2, fa.y + 54]} size={11.5} anchor="middle" mono tone="muted">
          {s.a}+{bit(s.y, yOn)}+{bit(s.cin, cinSettled)}
        </Text>
      </Block>
      <Text at={[fa.x + fa.w + 4, fa.y + 62]} size={12.5} mono tone={cinSettled && s.cin ? 'active' : 'muted'}>
        C{i}
      </Text>
      {/* Carry out to the next stage on the left */}
      {i < n - 1 && (
        <V points={[[fa.x + 10, fa.y + fa.h], [fa.x + 10, 226], [x - 80, 226], [x - 80, fa.y + 70], [x - COL + FA.dx + FA.w, fa.y + 70]]} value={s.cout} settled={done} />
      )}
      {i < n - 1 && (
        <Text at={[fa.x - 4, 236]} size={12.5} mono anchor="end" tone={done && s.cout ? 'active' : 'muted'}>
          C{i + 1}={bit(s.cout, done)}
        </Text>
      )}
      {/* Sum D to the output multiplexer */}
      <V points={[[fa.x + 58, fa.y + fa.h], [fa.x + 58, oIn(0)], [om.x, oIn(0)]]} value={s.d} settled={done} />
      <Text at={[fa.x + 62, fa.y + fa.h + 14]} size={12.5} mono tone={done ? 'active' : 'muted'}>
        D{i}={bit(s.d, done)}
      </Text>

      {/* Logic stage */}
      <Wire points={[[lm.x + lm.w / 2, LSEL_Y], [lm.x + lm.w / 2, lm.y + 4]]} on kind="signal" />
      {(['AND', 'OR', 'XOR', 'NOT'] as const).map((g, k) => {
        const gy = GATES_Y[k];
        return (
          <g key={g}>
            <g transform={`translate(${x + 30}, ${gy - 14.4}) scale(0.45)`} opacity={logicOn ? 1 : 0.55}>
              <GateSymbol name={g} x={s.a} y={s.b} out={gateVals[k]} label={L(`${g} gate of stage ${i}`, `Kat ${i}'in ${g} kapısı`)} />
            </g>
            <Text at={[x + 26, gy]} size={11.5} mono anchor="end" tone="muted">
              {g === 'NOT' ? 'A' : 'A,B'}
            </Text>
            <V points={[[x + 84, gy], [lm.x, muxInputY(lm.y, lm.h, 4, k)]]} value={gateVals[k]} settled={logicOn} kind="signal" />
          </g>
        );
      })}
      <Mux x={lm.x} y={lm.y} w={lm.w} h={lm.h} inputs={['AND', 'OR', 'XOR', 'NOT']} selected={s1s0} on={logicOn} title={L(`Logic multiplexer of stage ${i}`, `Kat ${i}'in mantık çoklayıcısı`)} />
      <V points={[[lm.x + lm.w, lm.y + lm.h / 2], [x + 186, lm.y + lm.h / 2], [x + 186, oIn(1)], [om.x, oIn(1)]]} value={s.e} settled={logicOn} />
      <Text at={[lm.x + lm.w + 4, lm.y + lm.h / 2 - 9]} size={12.5} mono tone={logicOn ? 'active' : 'muted'}>
        E{i}={bit(s.e, logicOn)}
      </Text>

      {/* Output multiplexer: D, E, shr (A_{i+1}), shl (A_{i-1}) */}
      <Wire points={[[om.x + om.w / 2, OSEL_Y], [om.x + om.w / 2, om.y + 4]]} on kind="signal" />
      <V points={[[om.x - 16, oIn(2)], [om.x, oIn(2)]]} value={s.shr} settled kind="signal" />
      <Text at={[om.x - 18, oIn(2)]} size={12} mono anchor="end" tone={outOn && s3s2 === 2 ? 'active' : 'muted'}>
        {i === n - 1 ? '0' : `A${i + 1}`}={s.shr}
      </Text>
      <V points={[[om.x - 16, oIn(3)], [om.x, oIn(3)]]} value={s.shl} settled kind="signal" />
      <Text at={[om.x - 18, oIn(3)]} size={12} mono anchor="end" tone={outOn && s3s2 === 3 ? 'active' : 'muted'}>
        {i === 0 ? '0' : `A${i - 1}`}={s.shl}
      </Text>
      <Mux x={om.x} y={om.y} w={om.w} h={om.h} inputs={['D', 'E', 'shr', 'shl']} selected={s3s2} on={outOn} title={L(`Output multiplexer of stage ${i}`, `Kat ${i}'in çıkış çoklayıcısı`)} />
      <V points={[[om.x + om.w, om.y + om.h / 2], [x + 262, om.y + om.h / 2], [x + 262, 712]]} value={s.f} settled={outOn} />
      <Text at={[x + 262, 724]} size={14} mono anchor="middle" weight={600} tone={outOn ? (s.f ? 'active' : 'text') : 'muted'}>
        F{i}={bit(s.f, outOn)}
      </Text>
    </g>
  );
}
