import { useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { assemble } from '../../../core/assembler/assembler';
import { ASM_EXAMPLES, type AsmExample } from '../../../core/programs/asmExamples';
import { toHex } from '../../../core/bits';
import { Ref } from '../../common/controls';
import { safeStorage } from '../../settings';
import { useComputer } from './store';

interface AsmStore {
  open: boolean;
  source: string;
  saved: Record<string, string>;
  setOpen: (o: boolean) => void;
  setSource: (s: string) => void;
  save: (name: string) => void;
  remove: (name: string) => void;
}

export const useAssembler = create<AsmStore>()(
  persist(
    (set) => ({
      open: false,
      source: ASM_EXAMPLES[0].source,
      saved: {},
      setOpen: (open) => set({ open }),
      setSource: (source) => set({ source }),
      save: (name) => set((s) => ({ saved: { ...s.saved, [name]: s.source } })),
      remove: (name) =>
        set((s) => {
          const saved = { ...s.saved };
          delete saved[name];
          return { saved };
        }),
    }),
    { name: 'mano-assembler', storage: createJSONStorage(() => safeStorage), partialize: (s) => ({ source: s.source, saved: s.saved, open: s.open }) },
  ),
);

/** Assembles a source and loads it into the computer. Returns false when it has errors. */
export function loadAssembly(source: string, title: string, ex?: AsmExample): boolean {
  const r = assemble(source);
  if (!r.ok) return false;
  useComputer.getState().load({
    id: ex?.id ?? 'assembled',
    title,
    mem: [...r.words],
    reg: { PC: r.start },
    flag: ex?.flag,
    expect: ex?.expect,
  });
  return true;
}

export function AssemblerPanel() {
  const { source, setSource, saved, save, remove, setOpen } = useAssembler();
  const [name, setName] = useState('');
  const editor = useRef<HTMLTextAreaElement>(null);
  const result = useMemo(() => assemble(source), [source]);
  const [message, setMessage] = useState<string | null>(null);

  const goToLine = (line: number) => {
    const ta = editor.current;
    if (!ta) return;
    const lines = source.split('\n');
    const startPos = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
    ta.focus();
    ta.setSelectionRange(startPos, startPos + (lines[line - 1]?.length ?? 0));
  };

  return (
    <section className="panel" aria-label="Assembler" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <span className="cap">Assembler · two passes</span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Ref title="Ch. 6: Programming the Basic Computer; Sec. 6-3: Assembler">Ch. 6</Ref>
          <button className="btn small" onClick={() => setOpen(false)}>
            Close
          </button>
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="cap">Open</span>
          <select
            className="input"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              const ex = ASM_EXAMPLES.find((x) => x.id === v);
              if (ex) setSource(ex.source);
              else if (v.startsWith('saved:')) setSource(saved[v.slice(6)]);
              setMessage(null);
            }}
          >
            <option value="">Example or saved program…</option>
            <optgroup label="Examples">
              {ASM_EXAMPLES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </optgroup>
            {Object.keys(saved).length > 0 && (
              <optgroup label="Saved in this browser">
                {Object.keys(saved).map((n) => (
                  <option key={n} value={`saved:${n}`}>
                    {n}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            save(name.trim());
            setMessage(`Saved as "${name.trim()}".`);
          }}
          style={{ display: 'flex', gap: 6 }}
        >
          <input className="input" aria-label="Program name" placeholder="name" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 120 }} />
          <button className="btn small" type="submit">
            Save
          </button>
          {saved[name.trim()] !== undefined && (
            <button className="btn small" type="button" onClick={() => { remove(name.trim()); setMessage(`Deleted "${name.trim()}".`); }}>
              Delete
            </button>
          )}
        </form>
        <button
          className="btn primary"
          disabled={!result.ok}
          onClick={() => {
            const ex = ASM_EXAMPLES.find((x) => x.source === source);
            loadAssembly(source, ex?.title ?? 'Assembled program', ex);
            setMessage(`Loaded ${result.words.size} words; PC = ${toHex(result.start, 12)}.`);
          }}
        >
          Assemble &amp; load
        </button>
        {message && <span className="mono muted" style={{ fontSize: 12 }}>{message}</span>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <label style={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="cap">Source</span>
          <textarea
            ref={editor}
            className="mono"
            spellCheck={false}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            rows={18}
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 4, padding: 10, fontSize: 13, lineHeight: 1.5, resize: 'vertical', tabSize: 8 }}
          />
          {result.errors.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }} aria-label="Errors">
              {result.errors.map((e, i) => (
                <li key={i}>
                  <button className="mono" onClick={() => goToLine(e.line)} style={{ background: 'none', border: 0, color: 'var(--alert)', cursor: 'pointer', textAlign: 'left', padding: 0, fontSize: 13 }}>
                    Line {e.line}: {e.message}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {result.warnings.map((w, i) => (
            <span key={i} className="mono" style={{ color: 'var(--changed)', fontSize: 13 }}>
              Line {w.line}: {w.message}
            </span>
          ))}
        </label>

        <div style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <span className="cap">Listing</span>
            <div style={{ maxHeight: 330, overflow: 'auto', marginTop: 6 }}>
              <table className="data" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Addr</th>
                    <th>Code</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {result.listing.map((l) => (
                    <tr key={l.line} className={result.errors.some((e) => e.line === l.line) ? 'hit' : ''}>
                      <td className="muted">{l.line}</td>
                      <td>{l.address !== undefined ? toHex(l.address, 12) : ''}</td>
                      <td>{l.code !== undefined ? toHex(l.code, 16) : ''}</td>
                      <td style={{ whiteSpace: 'pre', color: 'var(--text-2)' }}>{l.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <span className="cap">Symbol table · start {toHex(result.start, 12)}</span>
            <div className="mono" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 6, fontSize: 13 }}>
              {[...result.symbols].map(([s, a]) => (
                <span key={s}>
                  {s} = {toHex(a, 12)}
                </span>
              ))}
              {result.symbols.size === 0 && <span className="muted">no labels</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
