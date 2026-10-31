/**
 * Languages of the user interface. The core produces its explanations in the language it is
 * given; Mano's notation (RTL, register names, T0…T15, mnemonics) is the same in every language.
 */
export type Lang = 'en' | 'tr';

/** Chooses the text for a language. Both texts are required so no translation can be missed. */
export const pick = (lang: Lang, en: string, tr: string): string => (lang === 'tr' ? tr : en);

/** Book references: "Fig. 5-4" / "Şekil 5-4", "Table 5-6" / "Tablo 5-6", "Sec." / "Bölüm". */
export function localizeRef(ref: string, lang: Lang): string {
  if (lang === 'en') return ref;
  return ref
    .replace(/\bFigs?\.\s/g, 'Şekil ')
    .replace(/\bTables?\s/g, 'Tablo ')
    .replace(/\bTab\.\s/g, 'Tablo ')
    .replace(/\bSec\.\s/g, 'Kısım ')
    .replace(/\bCh\.\s/g, 'Bölüm ');
}

/** A message stored with both languages, for texts produced during simulation (notices). */
export interface Msg {
  en: string;
  tr: string;
}

export const msg = (en: string, tr: string): Msg => ({ en, tr });

export const say = (m: Msg, lang: Lang): string => m[lang];
