import { useState } from 'react';
import type { Bit } from '../../../core/bits';
import { fullAdder, halfAdder, rippleAdder } from '../../../core/blocks/adders';
import { gate, GATES, norOnly, truthTable } from '../../../core/blocks/gates';
import { BlockHeader, CarryChain, Flag, useWord, WidthSelect } from '../../common/blocks';
import { BitInput, BitToggle, Panel, Ref, Word } from '../../common/controls';
import { GateSymbol } from '../../common/GateSymbol';
import { useSettings } from '../../settings';

const B: Bit[] = [0, 1];

/** A small truth table with the current input row highlighted. */
function Truth({ head, rows, hit }: { head: string[]; rows: (number | string)[][]; hit: number }) {
  return (
    <table className="data">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={i === hit ? 'hit' : ''}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Fig. 1-2 and NOR-only constructions. */
export function GatesBlock() {
  const [x, setX] = useState<Bit>(0);
  const [y, setY] = useState<Bit>(1);
  return (
    <>
      <BlockHeader title="Digital logic gates" refs="Fig. 1-2">
        Toggle x and y. Every gate below updates at once; its truth table highlights the row for the current inputs. NOT uses only x.
      </BlockHeader>
      <Panel title="Inputs">
        <div className="row">
          <BitToggle label="x" value={x} onChange={setX} />
          <BitToggle label="y" value={y} onChange={setY} />
        </div>
      </Panel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
        {GATES.map((g) => {
          const out = gate(g, x, y);
          const rows = truthTable(g);
          const hit = g === 'NOT' ? x : x * 2 + y;
          return (
            <Panel key={g} title={g} refs={<span className="mono" style={{ color: out ? 'var(--active)' : 'var(--muted)' }}>F = {out}</span>}>
              <GateSymbol name={g} x={x} y={y} out={out} />
              <Truth head={g === 'NOT' ? ['x', 'F'] : ['x', 'y', 'F']} rows={rows.map((r) => (g === 'NOT' ? [r.x, r.out] : [r.x, r.y, r.out]))} hit={hit} />
            </Panel>
          );
        })}
      </div>
      <Panel title="Universal gate: NOT, OR and AND from NOR gates only" refs={<Ref>Sec. 1-2</Ref>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <div>
            <span className="cap">NOT x = (x + x)'</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <GateSymbol name="NOR" x={x} y={x} out={norOnly.not(x).out} />
            </div>
            <span className="mono">x' = {norOnly.not(x).out}</span>
          </div>
          <div>
            <span className="cap">x + y = ((x + y)')'</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <GateSymbol name="NOR" x={x} y={y} out={norOnly.or(x, y).n1} />
              <GateSymbol name="NOR" x={norOnly.or(x, y).n1} y={norOnly.or(x, y).n1} out={norOnly.or(x, y).out} />
            </div>
            <span className="mono">
              (x + y)' = {norOnly.or(x, y).n1}, x + y = {norOnly.or(x, y).out}
            </span>
          </div>
          <div>
            <span className="cap">xy = (x' + y')'</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <GateSymbol name="NOR" x={x} y={x} out={norOnly.and(x, y).nx} label="NOR as NOT x" />
                <GateSymbol name="NOR" x={y} y={y} out={norOnly.and(x, y).ny} label="NOR as NOT y" />
              </div>
              <GateSymbol name="NOR" x={norOnly.and(x, y).nx} y={norOnly.and(x, y).ny} out={norOnly.and(x, y).out} />
            </div>
            <span className="mono">
              x' = {norOnly.and(x, y).nx}, y' = {norOnly.and(x, y).ny}, xy = {norOnly.and(x, y).out}
            </span>
          </div>
        </div>
      </Panel>
    </>
  );
}

export function HalfAdderBlock() {
  const [x, setX] = useState<Bit>(1);
  const [y, setY] = useState<Bit>(1);
  const r = halfAdder(x, y);
  return (
    <>
      <BlockHeader title="Half adder" refs="Sec. 1-7">
        Adds two bits. The sum is S = x ⊕ y (an XOR gate) and the carry is C = xy (an AND gate).
      </BlockHeader>
      <div className="grid2">
        <Panel title="Circuit">
          <div className="row">
            <BitToggle label="x" value={x} onChange={setX} />
            <BitToggle label="y" value={y} onChange={setY} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GateSymbol name="XOR" x={x} y={y} out={r.s} />
              <span className="result">S = {r.s}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GateSymbol name="AND" x={x} y={y} out={r.c} />
              <span className="result">C = {r.c}</span>
            </span>
          </div>
        </Panel>
        <Panel title="Truth table">
          <Truth head={['x', 'y', 'C', 'S']} rows={B.flatMap((a) => B.map((b) => [a, b, halfAdder(a, b).c, halfAdder(a, b).s]))} hit={x * 2 + y} />
        </Panel>
      </div>
    </>
  );
}

export function FullAdderBlock() {
  const [x, setX] = useState<Bit>(1);
  const [y, setY] = useState<Bit>(0);
  const [z, setZ] = useState<Bit>(1);
  const r = fullAdder(x, y, z);
  const rows = B.flatMap((a) => B.flatMap((b) => B.map((c) => [a, b, c, fullAdder(a, b, c).c, fullAdder(a, b, c).s])));
  return (
    <>
      <BlockHeader title="Full adder" refs="Sec. 1-7">
        Adds three bits: S = x ⊕ y ⊕ z, C = xy + xz + yz. Built from two half adders and an OR gate: the first half adder gives S1 and C1, the second adds z to S1 and gives S and C2, and C = C1 + C2.
      </BlockHeader>
      <div className="grid2">
        <Panel title="Two half adders and an OR gate">
          <div className="row">
            <BitToggle label="x" value={x} onChange={setX} />
            <BitToggle label="y" value={y} onChange={setY} />
            <BitToggle label="z" value={z} onChange={setZ} />
          </div>
          <div className="scroll-x" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--mono)', minWidth: 'min-content' }}>
              <div style={{ border: '1px solid var(--line)', borderRadius: 4, padding: 10, background: 'var(--box)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="cap">HA 1 (x, y)</span>
                <span style={{ color: r.s1 ? 'var(--active)' : undefined }}>S1 = {r.s1}</span>
                <span style={{ color: r.c1 ? 'var(--active)' : undefined }}>C1 = {r.c1}</span>
              </div>
              <span className="muted">→</span>
              <div style={{ border: '1px solid var(--line)', borderRadius: 4, padding: 10, background: 'var(--box)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="cap">HA 2 (S1, z)</span>
                <span style={{ color: r.s ? 'var(--active)' : undefined }}>S = {r.s}</span>
                <span style={{ color: r.c2 ? 'var(--active)' : undefined }}>C2 = {r.c2}</span>
              </div>
              <span className="muted">→</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <GateSymbol name="OR" x={r.c1} y={r.c2} out={r.c} label={`OR gate: C1 + C2 = ${r.c}`} />
                <span>C = C1 + C2 = {r.c}</span>
              </div>
            </div>
          </div>
          <p className="result" style={{ margin: '12px 0 0' }}>
            C S = {r.c}
            {r.s}
          </p>
        </Panel>
        <Panel title="Truth table">
          <Truth head={['x', 'y', 'z', 'C', 'S']} rows={rows} hit={x * 4 + y * 2 + z} />
        </Panel>
      </div>
    </>
  );
}

export function RippleAdderBlock() {
  const n = useSettings((s) => s.width);
  const [a, setA] = useWord(0b1011, n);
  const [b, setB] = useWord(0b0011, n);
  const [c0, setC0] = useState<Bit>(0);
  const r = rippleAdder(a, b, c0, n);
  return (
    <>
      <BlockHeader title="Binary adder (ripple carry)" refs="Fig. 2-6" right={<WidthSelect />}>
        n full adders in a chain. The carry out of each stage is the carry in of the next one, so carries propagate from right (C0) to left (C{n}).
      </BlockHeader>
      <Panel title="Inputs">
        <div className="row">
          <BitInput label="A" value={a} width={n} onChange={setA} />
          <BitInput label="B" value={b} width={n} onChange={setB} />
          <BitToggle label="C0" value={c0} onChange={setC0} />
        </div>
      </Panel>
      <Panel title="Full-adder chain">
        <CarryChain width={n} rows={[{ label: 'A', value: a }, { label: 'B', value: b }]} carries={r.carries} outLabel="S" out={r.sum} stageLabel="FA" />
        <div className="row" style={{ marginTop: 12, alignItems: 'center' }}>
          <span className="result">
            S = <Word value={r.sum} width={n} />
          </span>
          <Flag name={`C${n}`} v={r.cout} note="Output carry" />
        </div>
      </Panel>
    </>
  );
}
