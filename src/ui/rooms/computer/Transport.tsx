import { say } from '../../../core/i18n';
import { ASM_EXAMPLES } from '../../../core/programs/asmExamples';
import { HEX_EXAMPLES } from '../../../core/programs/examples';
import { SPEEDS, useLang, useSettings } from '../../settings';
import { loadAssembly, useAssembler } from './AssemblerPanel';
import { useComputer, useSim } from './store';

export const Icon = ({ d, size = 15 }: { d: string; size?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

/** Clock controls and the program picker, at the left of the dock. */
export function Transport() {
  const sim = useSim();
  const s = useComputer();
  const { speedIndex, setSpeedIndex } = useSettings();
  const { lang, L } = useLang();
  const asm = useAssembler();
  const exampleIds = [...HEX_EXAMPLES, ...ASM_EXAMPLES].map((e) => e.id);
  const canNext = !sim.halted || sim.canRedo || (!!sim.lastTrace && s.sub < 3);
  const micro = [L('decode', 'çözme'), L('control gates', 'kontrol kapıları'), L('data flow', 'veri akışı'), L('clock edge', 'saat kenarı')];
  const speed = SPEEDS[speedIndex];
  const speedLabel = speed === Infinity ? L('as fast as possible', 'olabildiğince hızlı') : L(`${speed} pulse${speed === 1 ? '' : 's'} per second`, `saniyede ${speed} darbe`);
  const title = (e: { title: string; titleTr: string }) => (lang === 'tr' ? e.titleTr : e.title);
  const programTitle = s.program ? (lang === 'tr' ? (s.program.titleTr ?? s.program.title) : s.program.title) : null;
  const more = sim.latestPulse - sim.pulses;

  return (
    <section className="transport" aria-label={L('Clock controls', 'Saat kontrolleri')}>
      <div className="transport-row">
        <button
          className="btn icon"
          onClick={s.subPrev}
          disabled={!sim.canStepBack && !(sim.lastTrace && s.sub > 0)}
          title={L('Back one sub-step (undoes pulses and edits)', 'Bir alt adım geri (darbeleri ve düzenlemeleri geri alır)')}
          aria-label={L('Back one sub-step', 'Bir alt adım geri')}
        >
          <Icon d="M15 5l-7 7 7 7" />
        </button>
        <button className="btn primary grow" onClick={s.subNext} disabled={!canNext} title={L('Next sub-step: decode, control gates, data flow, clock edge', 'Sonraki alt adım: çözme, kontrol kapıları, veri akışı, saat kenarı')}>
          {L('Step', 'Adım')}
        </button>
        <button className="btn" onClick={s.pulse} disabled={!canNext} title={L('Finish this clock pulse, or do the next one', 'Bu saat darbesini bitir ya da sıradakini yap')}>
          {L('Pulse', 'Darbe')}
        </button>
        <button className="btn" onClick={s.instruction} disabled={!canNext} title={L('Pulse until SC returns to 0', 'SC 0\'a dönene kadar darbe ver')}>
          {L('Instruction', 'Komut')}
        </button>
      </div>
      <div className="transport-row">
        {s.running ? (
          <button className="btn grow" onClick={s.pause}>
            <Icon d="M8 5v14M16 5v14" />
            {L('Pause', 'Duraklat')}
          </button>
        ) : (
          <button className="btn grow" onClick={s.run} title={L('Run until HLT or a breakpoint', 'HLT ya da bir kesme noktasına kadar çalıştır')}>
            <Icon d="M7 4l13 8-13 8z" />
            {L('Run', 'Çalıştır')}
          </button>
        )}
        <button className="btn" onClick={s.reset} title={L("Go back to the loaded program's start", 'Yüklenen programın başına dön')}>
          {L('Reset', 'Sıfırla')}
        </button>
      </div>
      <label className="transport-speed">
        <span className="cap">{L('Speed', 'Hız')}</span>
        <input type="range" min={0} max={SPEEDS.length - 1} value={speedIndex} onChange={(e) => setSpeedIndex(Number(e.target.value))} aria-valuetext={speedLabel} />
        <span className="muted">{speedLabel}</span>
      </label>
      <p className="transport-note muted">
        {s.status
          ? say(s.status, lang)
          : sim.lastTrace
            ? L(`Pulse ${sim.pulses}, ${micro[s.sub]}`, `Darbe ${sim.pulses}, ${micro[s.sub]}`) +
              (sim.canRedo ? L(`. ${more} more can be redone.`, `. ${more} darbe daha yeniden yapılabilir.`) : '')
            : L('Ready.', 'Hazır.')}
      </p>
      <div className="transport-program">
        <label>
          <span className="cap">{L('Program', 'Program')}</span>
          <select
            className="input"
            value={s.program && exampleIds.includes(s.program.id) ? s.program.id : ''}
            onChange={(e) => {
              const ex = HEX_EXAMPLES.find((x) => x.id === e.target.value);
              if (ex) s.load({ id: ex.id, title: ex.title, titleTr: ex.titleTr, mem: ex.mem, reg: ex.reg, flag: ex.flag, expect: ex.expect, expectTr: ex.expectTr });
              const asmEx = ASM_EXAMPLES.find((x) => x.id === e.target.value);
              if (asmEx) {
                asm.setSource(asmEx.source);
                loadAssembly(asmEx.source, asmEx.title, asmEx);
              }
            }}
          >
            <option value="">{programTitle ?? L('Choose an example…', 'Bir örnek seç…')}</option>
            <optgroup label={L('Machine code (Ch. 5)', 'Makine kodu (Bölüm 5)')}>
              {HEX_EXAMPLES.map((e) => (
                <option key={e.id} value={e.id}>
                  {title(e)}
                </option>
              ))}
            </optgroup>
            <optgroup label={L('Assembly (Ch. 6)', 'Assembly (Bölüm 6)')}>
              {ASM_EXAMPLES.map((e) => (
                <option key={e.id} value={e.id}>
                  {title(e)}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="transport-row">
          <button className="btn grow" aria-pressed={asm.open} onClick={() => asm.setOpen(!asm.open)}>
            {L('Write a program', 'Program yaz')}
          </button>
          <button className="btn" onClick={s.clearAll} title={L('Clear memory, registers and breakpoints', 'Belleği, yazmaçları ve kesme noktalarını temizle')}>
            {L('Clear', 'Temizle')}
          </button>
        </div>
      </div>
    </section>
  );
}
