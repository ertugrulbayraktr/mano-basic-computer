import { useEffect, useRef, useState } from 'react';
import { disassemble } from '../../../core/basic/disasm';
import { MEMORY_WORDS } from '../../../core/basic/types';
import { EditableValue } from '../../common/controls';
import { parseWord } from '../../common/format';
import { useLang } from '../../settings';
import { useComputer, useSim } from './store';

const ROW_H = 28;
const VISIBLE = 16;

/** Virtualized view of all 4096 words, with PC/AR markers, disassembly and breakpoints. */
export function MemoryView() {
  const { L } = useLang();
  const sim = useSim();
  const setMemory = useComputer((s) => s.setMemory);
  const toggleBreakpoint = useComputer((s) => s.toggleBreakpoint);
  // Hovering a word x-rays the instruction it holds on the circuit.
  const setXray = (xray: number | null) => useComputer.getState().setView({ xray });
  const [scroll, setScroll] = useState(0);
  const [follow, setFollow] = useState(true);
  const [goto, setGoto] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const { PC, AR } = sim.state.reg;
  const written = new Set(sim.lastTrace?.memory.map((m) => m.address));

  const scrollTo = (address: number) => {
    const top = Math.max(0, (address - 3) * ROW_H);
    if (box.current) box.current.scrollTop = top;
    setScroll(top);
  };

  // Follow PC so the next instruction stays in view.
  useEffect(() => {
    if (!follow || !box.current) return;
    const first = Math.floor(box.current.scrollTop / ROW_H);
    if (PC < first || PC >= first + VISIBLE - 2) scrollTo(PC);
  }, [PC, follow]);

  const first = Math.max(0, Math.floor(scroll / ROW_H) - 2);
  const rows = [];
  for (let a = first; a < Math.min(MEMORY_WORDS, first + VISIBLE + 4); a++) rows.push(a);

  return (
    <section className="panel" aria-label={L('Memory', 'Bellek')}>
      <div className="panel-head">
        <span className="cap">{L('Memory, 4096 × 16', 'Bellek, 4096 × 16')}</span>
        <label className="cap" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> {L('follow PC', 'PC\'yi izle')}
        </label>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const a = parseWord(goto, 'hex', 12);
            if (a !== null) {
              setFollow(false);
              scrollTo(a);
            }
          }}
          style={{ display: 'flex', gap: 6 }}
        >
          <input className="input mono" aria-label={L('Go to address (hex)', 'Adrese git (onaltılık)')} placeholder={L('addr (hex)', 'adres (hex)')} value={goto} onChange={(e) => setGoto(e.target.value)} style={{ width: 110 }} />
          <button className="btn small" type="submit">{L('Go', 'Git')}</button>
        </form>
        <button className="btn small" onClick={() => scrollTo(PC)}>PC</button>
        <button className="btn small" onClick={() => { setFollow(false); scrollTo(AR); }}>AR</button>
      </div>
      <div className="memory" role="table" aria-label={L('Memory words', 'Bellek kelimeleri')}>
        <div className="mem-row cap" role="row" style={{ height: 22 }}>
          <span role="columnheader" title={L('Breakpoint', 'Kesme noktası')}>{L('BP', 'KN')}</span>
          <span role="columnheader" />
          <span role="columnheader">{L('Addr', 'Adres')}</span>
          <span role="columnheader">{L('Word', 'Kelime')}</span>
          <span role="columnheader">{L('Disassembly', 'Tersine çeviri')}</span>
        </div>
        <div ref={box} onScroll={(e) => setScroll(e.currentTarget.scrollTop)} style={{ height: VISIBLE * ROW_H, overflowY: 'auto', position: 'relative' }}>
          <div style={{ height: MEMORY_WORDS * ROW_H, position: 'relative' }}>
            {rows.map((a) => {
              const word = sim.state.mem[a];
              const tag = [a === PC ? 'PC' : '', a === AR ? 'AR' : ''].filter(Boolean).join(' ');
              return (
                <div
                  key={a}
                  role="row"
                  className={`mem-row ${a === AR ? 'ar' : ''} ${written.has(a) ? 'written' : ''}`}
                  style={{ position: 'absolute', top: a * ROW_H, left: 0, right: 0 }}
                  onMouseEnter={() => setXray(a)}
                  onMouseLeave={() => setXray(null)}
                  onFocus={() => setXray(a)}
                  onBlur={() => setXray(null)}
                >
                  <span role="cell">
                    <button className="bp" aria-pressed={sim.breakpoints.has(a)} aria-label={L(`Breakpoint at ${a.toString(16)}`, `${a.toString(16)} adresinde kesme noktası`)} onClick={() => toggleBreakpoint(a)} />
                  </span>
                  <span role="cell" style={{ fontSize: 10, fontWeight: 600, color: a === PC ? 'var(--changed)' : 'var(--active)' }}>
                    {tag}
                  </span>
                  <span role="cell" className="muted">
                    {a.toString(16).toUpperCase().padStart(3, "0")}
                  </span>
                  <span role="cell">
                    <EditableValue compact value={word} width={16} label={L(`memory word ${a.toString(16)}`, `bellek kelimesi ${a.toString(16)}`)} onCommit={(v) => setMemory(a, v)} className={written.has(a) ? 'changed-value' : ''} />
                  </span>
                  <span role="cell" style={{ color: word ? 'var(--text-2)' : 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {disassemble(word).text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
