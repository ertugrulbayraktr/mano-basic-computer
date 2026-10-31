import { say, type Lang } from '../i18n';
import type { PulseTrace } from './pulse';

/**
 * Plain-language explanation of each Table 5-6 line, for a beginner, in English and Turkish.
 * Keyed by `RtlLine.id`.
 */
const EXPLAIN: Record<string, [en: string, tr: string]> = {
  'fetch-T0': [
    'Fetch begins. The address of the next instruction is in PC, but memory reads its address only from AR, so PC is copied to AR over the bus.',
    'Getirme başlar. Sıradaki komutun adresi PC\'dedir, ama bellek adresi yalnızca AR\'den okur; bu yüzden PC ortak yol üzerinden AR\'ye kopyalanır.',
  ],
  'fetch-T1': [
    'Memory is read at the address in AR and the instruction word is loaded into IR. At the same time PC is incremented so that it points to the next instruction.',
    'AR\'deki adresten bellek okunur ve komut kelimesi IR\'ye yüklenir. Aynı anda PC bir artırılır, böylece sıradaki komutu gösterir.',
  ],
  'decode-T2': [
    'Decode: the operation decoder looks at IR(12-14) and activates one of D0…D7. The address part IR(0-11) goes to AR, and the mode bit IR(15) goes to I.',
    'Çözme: işlem kod çözücüsü IR(12-14)\'e bakar ve D0…D7\'den birini etkinleştirir. Adres kısmı IR(0-11) AR\'ye, mod biti IR(15) ise I\'ya gider.',
  ],
  indirect: [
    'Indirect addressing (I = 1): the word in memory at AR is not the operand, it is the address of the operand. Memory is read and that effective address is loaded into AR.',
    'Dolaylı adresleme (I = 1): bellekte AR\'nin gösterdiği kelime işlenen değil, işlenenin adresidir. Bellek okunur ve bu etkin adres AR\'ye yüklenir.',
  ],
  direct: [
    'Direct addressing (I = 0): AR already holds the effective address, so nothing happens at T3. SC just advances to T4.',
    'Doğrudan adresleme (I = 0): AR zaten etkin adresi tutuyor, bu yüzden T3\'te hiçbir şey olmaz. SC yalnızca T4\'e ilerler.',
  ],
  'AND-T4': [
    'The operand is read from memory into DR, because the AC logic circuit takes its second input from DR.',
    'İşlenen bellekten DR\'ye okunur, çünkü AC mantık devresi ikinci girişini DR\'den alır.',
  ],
  'AND-T5': [
    'AC is ANDed bit by bit with DR. The instruction is done, so SC is cleared to start the next fetch.',
    'AC, DR ile bit bit VE\'lenir. Komut bitti; sıradaki getirmeyi başlatmak için SC temizlenir.',
  ],
  'ADD-T4': [
    'The operand is read from memory into DR, because the adder takes its second input from DR.',
    'İşlenen bellekten DR\'ye okunur, çünkü toplayıcı ikinci girişini DR\'den alır.',
  ],
  'ADD-T5': [
    'The adder computes AC + DR. The 16-bit sum goes to AC and the carry out goes to E. SC is cleared: the instruction is complete.',
    'Toplayıcı AC + DR\'yi hesaplar. 16 bitlik toplam AC\'ye, dışarı çıkan elde E\'ye gider. SC temizlenir: komut tamamlandı.',
  ],
  'LDA-T4': [
    'The word to load is read from memory into DR. AC cannot be loaded from the bus directly; it is loaded through the adder and logic circuit.',
    'Yüklenecek kelime bellekten DR\'ye okunur. AC ortak yoldan doğrudan yüklenemez; toplayıcı ve mantık devresi üzerinden yüklenir.',
  ],
  'LDA-T5': [
    'DR is transferred to AC through the adder and logic circuit. SC is cleared: the instruction is complete.',
    'DR, toplayıcı ve mantık devresi üzerinden AC\'ye aktarılır. SC temizlenir: komut tamamlandı.',
  ],
  'STA-T4': [
    'AC is placed on the bus and written into memory at the address in AR. SC is cleared: the instruction is complete.',
    'AC ortak yola konur ve AR\'deki adrese belleğe yazılır. SC temizlenir: komut tamamlandı.',
  ],
  'BUN-T4': [
    'Branch: the effective address in AR is loaded into PC, so the next fetch comes from there. SC is cleared.',
    'Dallanma: AR\'deki etkin adres PC\'ye yüklenir, böylece sıradaki getirme oradan yapılır. SC temizlenir.',
  ],
  'BSA-T4': [
    'Branch and save: the return address (PC, which already points past BSA) is stored in memory at the effective address, and AR is incremented to the first instruction of the subroutine.',
    'Dallan ve sakla: dönüş adresi (zaten BSA\'nın sonrasını gösteren PC) etkin adrese belleğe yazılır, AR de alt programın ilk komutunu gösterecek şekilde artırılır.',
  ],
  'BSA-T5': [
    'PC gets the subroutine start address from AR. SC is cleared: the subroutine begins with the next fetch.',
    'PC, alt programın başlangıç adresini AR\'den alır. SC temizlenir: alt program sıradaki getirmeyle başlar.',
  ],
  'ISZ-T4': ['The memory word is read into DR so it can be incremented.', 'Bellek kelimesi artırılabilmesi için DR\'ye okunur.'],
  'ISZ-T5': [
    'DR is incremented. Memory itself cannot count, so the word is incremented in DR.',
    'DR bir artırılır. Bellek kendisi sayamaz; bu yüzden kelime DR\'de artırılır.',
  ],
  'ISZ-T6': [
    'The incremented word is written back to memory. If it became zero, PC is incremented to skip the next instruction. SC is cleared.',
    'Artırılan kelime belleğe geri yazılır. Sıfır olduysa PC artırılarak sıradaki komut atlanır. SC temizlenir.',
  ],
  r: [
    'Register-reference instruction (D7 = 1, I = 0). It needs no operand from memory, so it completes in T3; SC is cleared.',
    'Yazmaç başvurulu komut (D7 = 1, I = 0). Bellekten işlenen gerekmez, bu yüzden T3\'te tamamlanır; SC temizlenir.',
  ],
  CLA: ['AC is cleared to 0.', 'AC 0\'a temizlenir.'],
  CLE: ['The E flip-flop is cleared to 0.', 'E flip-flop\'u 0\'a temizlenir.'],
  CMA: ['Every bit of AC is complemented.', 'AC\'nin her biti tümlenir.'],
  CME: ['The E flip-flop is complemented.', 'E flip-flop\'u tümlenir.'],
  CIR: [
    'AC and E are circulated right as one 17-bit ring: E enters AC(15), and AC(0) goes to E.',
    'AC ve E, 17 bitlik tek bir halka gibi sağa döndürülür: E, AC(15)\'e girer; AC(0) E\'ye gider.',
  ],
  CIL: [
    'AC and E are circulated left as one 17-bit ring: E enters AC(0), and AC(15) goes to E.',
    'AC ve E, 17 bitlik tek bir halka gibi sola döndürülür: E, AC(0)\'a girer; AC(15) E\'ye gider.',
  ],
  INC: ['AC is incremented by one (the carry out of AC is lost; E does not change).', 'AC bir artırılır (AC\'den taşan elde kaybolur; E değişmez).'],
  SPA: [
    'If AC is positive (sign bit AC(15) = 0), PC is incremented to skip the next instruction.',
    'AC pozitifse (işaret biti AC(15) = 0) PC artırılarak sıradaki komut atlanır.',
  ],
  SNA: [
    'If AC is negative (sign bit AC(15) = 1), PC is incremented to skip the next instruction.',
    'AC negatifse (işaret biti AC(15) = 1) PC artırılarak sıradaki komut atlanır.',
  ],
  SZA: ['If AC is zero, PC is incremented to skip the next instruction.', 'AC sıfırsa PC artırılarak sıradaki komut atlanır.'],
  SZE: ['If E is 0, PC is incremented to skip the next instruction.', 'E 0 ise PC artırılarak sıradaki komut atlanır.'],
  HLT: [
    'The start-stop flip-flop S is cleared, which stops the clock. The computer halts.',
    'Başlat-durdur flip-flop\'u S temizlenir ve saat durur. Bilgisayar durur.',
  ],
  p: [
    'Input-output instruction (D7 = 1, I = 1). It completes in T3; SC is cleared.',
    'Giriş-çıkış komutu (D7 = 1, I = 1). T3\'te tamamlanır; SC temizlenir.',
  ],
  INP: [
    'The character in INPR goes into the low byte of AC, and FGI is cleared so the keyboard can deliver the next character.',
    'INPR\'deki karakter AC\'nin düşük baytına girer ve klavyenin sıradaki karakteri verebilmesi için FGI temizlenir.',
  ],
  OUT: [
    'The low byte of AC is placed on the bus and loaded into OUTR for the printer. FGO is cleared until the printer is ready again.',
    'AC\'nin düşük baytı ortak yola konur ve yazıcı için OUTR\'ye yüklenir. Yazıcı yeniden hazır olana kadar FGO temizlenir.',
  ],
  SKI: [
    'If a new character is waiting (FGI = 1), PC is incremented to skip the next instruction.',
    'Bekleyen yeni bir karakter varsa (FGI = 1) PC artırılarak sıradaki komut atlanır.',
  ],
  SKO: [
    'If the printer is ready (FGO = 1), PC is incremented to skip the next instruction.',
    'Yazıcı hazırsa (FGO = 1) PC artırılarak sıradaki komut atlanır.',
  ],
  ION: ['Interrupts are enabled (IEN ← 1).', 'Kesmeler etkinleştirilir (IEN ← 1).'],
  IOF: ['Interrupts are disabled (IEN ← 0).', 'Kesmeler devre dışı bırakılır (IEN ← 0).'],
  'int-request': [
    'Interrupts are enabled and a device flag is set, so R is set. The current instruction finishes normally; the next cycle will be an interrupt cycle instead of a fetch.',
    'Kesmeler etkin ve bir aygıt bayrağı 1, bu yüzden R 1 yapılır. Mevcut komut normal şekilde biter; sıradaki çevrim getirme yerine bir kesme çevrimi olur.',
  ],
  'int-T0': [
    'Interrupt cycle: AR is cleared to 0 (where the return address will be saved) and PC is copied to TR.',
    'Kesme çevrimi: AR 0\'a temizlenir (dönüş adresi buraya kaydedilecek) ve PC, TR\'ye kopyalanır.',
  ],
  'int-T1': [
    'The return address in TR is written to memory location 0, and PC is cleared.',
    'TR\'deki dönüş adresi belleğin 0 numaralı konumuna yazılır ve PC temizlenir.',
  ],
  'int-T2': [
    'PC is incremented to 1, the start of the interrupt service routine. IEN and R are cleared so the routine is not interrupted again, and SC is cleared.',
    'PC, kesme hizmet programının başı olan 1\'e artırılır. Program yeniden kesilmesin diye IEN ve R temizlenir; SC de temizlenir.',
  ],
};

export const explainLine = (id: string, lang: Lang = 'en'): string | undefined => EXPLAIN[id]?.[lang === 'tr' ? 1 : 0];

/** The "What happened?" text of a pulse: one paragraph per executed line, plus notices. */
export function explainPulse(trace: PulseTrace, lang: Lang = 'en'): string[] {
  if (trace.signals.phase === 'halted')
    return [lang === 'tr' ? 'Bilgisayar durdu (S = 0). Yeniden başlatmak için Çalıştır ya da Sıfırla\'ya bas.' : 'The computer is halted (S = 0). Press Run or Reset to start it again.'];
  const parts = trace.signals.lines.map((l) => explainLine(l.id, lang)).filter((t): t is string => !!t);
  return [...parts, ...trace.notices.map((n) => say(n, lang))];
}
