import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { PulseTrace } from '../../core/basic/pulse';
import { instructionBand, LANE_BY_ID, LANES, type Lane } from '../../core/basic/waveforms';
import { useLang, useSettings } from '../settings';
import { useComputer, useSim } from '../rooms/computer/store';

const GROUP_TR: Record<string, string> = {
  Timing: 'Zamanlama',
  'Flip-flops': "Flip-flop'lar",
  'Bus and memory': 'Ortak yol ve bellek',
  Registers: 'Yazmaçlar',
};

const PW = 34; // width of one pulse
const ROW = 22;
const LABEL_W = 116;

/**
 * Timing diagram of every pulse so far (and of undone pulses that can be redone, faded).
 * Click or drag anywhere to move the machine to that moment; the circuit follows.
 */
export function TimingDiagram() {
  const sim = useSim();
  const sub = useComputer((s) => s.sub);
  const seek = useComputer((s) => s.seek);
  const { lanes, setLanes } = useSettings();
  const { lang, L } = useLang();
  const group = (g: string) => (lang === 'tr' ? (GROUP_TR[g] ?? g.replace('Control: ', 'Kontrol: ')) : g);
  const scroller = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: 0, width: 800 });
  const dragging = useRef(false);

  const start = sim.timelineStart;
  // Past pulses, then the undone ones that redo can bring back (stored nearest last).
  const traces: PulseTrace[] = [...sim.timeline, ...[...sim.future].reverse()];
  const pastCount = sim.timeline.length;
  const total = traces.length;
  const cur = sim.pulses - 1 - start; // column of the pulse being shown
  const shown: Lane[] = lanes.map((id) => LANE_BY_ID[id]).filter(Boolean);
  const band = instructionBand(sim.history, sim.pulses).filter((b) => b.to >= start);
  const width = Math.max(total * PW + PW * 3, scroll.width);
  const rows = 3 + shown.length; // ruler, instructions, clock, lanes
  const height = rows * ROW + 6;
  const playX = cur < 0 ? 0 : (cur + (sim.lastTrace ? (sub + 1) / 4 : 1)) * PW;

  const i0 = Math.max(0, Math.floor(scroll.left / PW) - 2);
  const i1 = Math.min(total, Math.ceil((scroll.left + scroll.width) / PW) + 2);
  const visible = traces.slice(i0, i1).map((t, k) => ({ t, i: i0 + k }));

  // Keep the playhead in view.
  useEffect(() => {
    const el = scroller.current;
    if (!el || dragging.current) return;
    if (playX < el.scrollLeft + 20 || playX > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, playX - el.clientWidth * 0.6);
  }, [playX]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setScroll({ left: el.scrollLeft, width: el.clientWidth });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const seekAt = (clientX: number, target: Element) => {
    const r = target.getBoundingClientRect();
    const x = clientX - r.left;
    const col = Math.floor(x / PW);
    const pulseNo = Math.max(0, Math.min(start + total, start + col + 1));
    if (pulseNo !== sim.pulses) seek(pulseNo);
  };

  const y = (row: number) => row * ROW + 3;
  const laneTop = (k: number) => y(3 + k);

  return (
    <div className="timing" aria-label={L('Timing diagram', 'Zamanlama diyagramı')}>
      <div className="timing-labels" style={{ width: LABEL_W }}>
        <div className="tl-label muted" style={{ height: ROW, marginTop: 3 }}>
          {L('Pulse', 'Darbe')}
        </div>
        <div className="tl-label muted" style={{ height: ROW }}>
          {L('Instruction', 'Komut')}
        </div>
        <div className="tl-label" style={{ height: ROW }}>
          {L('Clock', 'Saat')}
        </div>
        {shown.map((l) => (
          <div key={l.id} className="tl-label" style={{ height: ROW }}>
            <span className="mono">{l.label}</span>
            <button className="tl-remove" aria-label={L(`Remove lane ${l.label}`, `${l.label} şeridini kaldır`)} onClick={() => setLanes(lanes.filter((x) => x !== l.id))}>
              ×
            </button>
          </div>
        ))}
        <select
          className="tl-add"
          aria-label={L('Add a lane', 'Şerit ekle')}
          value=""
          onChange={(e) => e.target.value && setLanes([...lanes, e.target.value])}
        >
          <option value="">{L('Add a signal…', 'Sinyal ekle…')}</option>
          {[...new Set(LANES.map((l) => l.group))].map((g) => (
            <optgroup key={g} label={group(g)}>
              {LANES.filter((l) => l.group === g && !lanes.includes(l.id)).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="timing-scroll" ref={scroller} onScroll={(e) => setScroll({ left: e.currentTarget.scrollLeft, width: e.currentTarget.clientWidth })}>
        <svg
          width={width}
          height={height}
          className="timing-svg"
          role="slider"
          tabIndex={0}
          aria-label={L('Time: drag or use the arrow keys to move through the pulses', 'Zaman: darbeler arasında gezinmek için sürükle ya da ok tuşlarını kullan')}
          aria-valuemin={start}
          aria-valuemax={start + total}
          aria-valuenow={sim.pulses}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            seekAt(e.clientX, e.currentTarget);
          }}
          onPointerMove={(e) => dragging.current && seekAt(e.clientX, e.currentTarget)}
          onPointerUp={() => (dragging.current = false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') seek(Math.max(start, sim.pulses - 1));
            if (e.key === 'ArrowRight') seek(Math.min(start + total, sim.pulses + 1));
            if (e.key === 'Home') seek(start);
            if (e.key === 'End') seek(start + total);
          }}
        >
          {/* columns: current pulse, the future and hover titles */}
          {visible.map(({ t, i }) => (
            <rect
              key={`c${i}`}
              x={i * PW}
              y={0}
              width={PW}
              height={height}
              fill={i === cur ? 'var(--paper-2)' : i % 2 ? '#fbfbfc' : 'transparent'}
              opacity={i >= pastCount ? 0.6 : 1}
            >
              <title>{`${L('Pulse', 'Darbe')} ${start + i + 1}, T${t.before.SC}\n${t.signals.lines.map((l) => `${l.control}: ${l.statement}`).join('\n') || L('no microoperation', 'mikroişlem yok')}`}</title>
            </rect>
          ))}

          {/* ruler */}
          {visible.map(({ i }) => (
            <text key={`r${i}`} x={i * PW + PW / 2} y={y(0) + 14} textAnchor="middle" fontSize={9.5} fontFamily="var(--mono)" fill="var(--muted)">
              {start + i + 1}
            </text>
          ))}

          {/* instruction band */}
          {band.map((b) => {
            const x0 = (b.from - start) * PW;
            const x1 = (b.to - start + 1) * PW;
            const active = cur >= b.from - start && cur <= b.to - start;
            return (
              <g key={`b${b.from}`}>
                <rect x={x0 + 1} y={y(1) + 3} width={Math.max(0, x1 - x0 - 2)} height={ROW - 6} rx={3} fill={active ? 'var(--ink)' : 'var(--paper-2)'} stroke="var(--rule-strong)" />
                <text x={x0 + 6} y={y(1) + ROW / 2 + 1} dominantBaseline="middle" fontSize={11} fontFamily="var(--mono)" fill={active ? '#fff' : 'var(--ink-2)'}>
                  {x1 - x0 > b.text.length * 7 ? b.text : x1 - x0 > 30 ? b.text.split(' ')[0] : ''}
                </text>
              </g>
            );
          })}

          {/* clock */}
          <path
            d={visible.map(({ i }) => `M${i * PW} ${y(2) + ROW - 5} V${y(2) + 5} H${i * PW + PW / 2} V${y(2) + ROW - 5} H${(i + 1) * PW}`).join(' ')}
            fill="none"
            stroke="var(--ink-2)"
            strokeWidth={1.2}
          />

          {/* lanes */}
          {shown.map((lane, k) => (
            <LaneRow key={lane.id} lane={lane} cells={visible} top={laneTop(k)} pastCount={pastCount} />
          ))}

          {/* playhead */}
          {total > 0 && (
            <g pointerEvents="none">
              <line x1={playX} x2={playX} y1={0} y2={height} stroke="var(--ink)" strokeWidth={1.5} />
              <path d={`M${playX - 5} 0 H${playX + 5} L${playX} 7 Z`} fill="var(--ink)" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

function LaneRow({ lane, cells, top, pastCount }: { lane: Lane; cells: { t: PulseTrace; i: number }[]; top: number; pastCount: number }) {
  const hi = top + 5;
  const lo = top + ROW - 5;
  if (lane.kind === 'bit') {
    let d = '';
    const fills: ReactElement[] = [];
    cells.forEach(({ t, i }, k) => {
      const v = lane.bit!(t);
      const yy = v ? hi : lo;
      d += k === 0 ? `M${i * PW} ${yy}` : ` V${yy}`;
      d += ` H${(i + 1) * PW}`;
      if (v) fills.push(<rect key={i} x={i * PW} y={hi} width={PW} height={lo - hi} fill="var(--signal-soft)" opacity={i >= pastCount ? 0.5 : 1} />);
    });
    return (
      <g>
        {fills}
        <path d={d} fill="none" stroke="var(--signal)" strokeWidth={1.4} />
        <line x1={0} x2={99999} y1={top + ROW} y2={top + ROW} stroke="var(--rule)" strokeWidth={0.6} />
      </g>
    );
  }
  // Value lane: merge equal neighbours into one segment, like a bus in a timing diagram.
  const runs: { from: number; to: number; v: string | null }[] = [];
  for (const { t, i } of cells) {
    const v = lane.value!(t);
    const last = runs[runs.length - 1];
    if (last && last.v === v && last.to === i - 1) last.to = i;
    else runs.push({ from: i, to: i, v });
  }
  return (
    <g>
      {runs.map((r) => {
        const x0 = r.from * PW + 2;
        const x1 = (r.to + 1) * PW - 2;
        const mid = (hi + lo) / 2;
        if (r.v === null) return <line key={r.from} x1={x0} x2={x1} y1={mid} y2={mid} stroke="var(--wire)" strokeWidth={1.2} />;
        return (
          <g key={r.from} opacity={r.from >= pastCount ? 0.55 : 1}>
            <path d={`M${x0} ${mid} L${x0 + 4} ${hi} H${x1 - 4} L${x1} ${mid} L${x1 - 4} ${lo} H${x0 + 4} Z`} fill="var(--paper)" stroke="var(--ink-2)" strokeWidth={1.1} />
            {x1 - x0 > r.v.length * 6.2 + 6 && (
              <text x={(x0 + x1) / 2} y={mid + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontFamily="var(--mono)" fill="var(--ink)">
                {r.v}
              </text>
            )}
          </g>
        );
      })}
      <line x1={0} x2={99999} y1={top + ROW} y2={top + ROW} stroke="var(--rule)" strokeWidth={0.6} />
    </g>
  );
}
