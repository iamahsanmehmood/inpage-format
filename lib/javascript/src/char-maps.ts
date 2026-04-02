/**
 * InPage → Unicode Character Mapping Tables
 *
 * InPage v1/v2 uses a two-byte encoding: 0x04 prefix + character index byte.
 * This module maps the index byte to the corresponding Unicode string.
 *
 * Sources:
 *   - ltrc/inPageToUnicode (JavaScript, GPL-2.0)
 *   - KamalAbdali/InpageToUnicode (C)
 *   - UmerCodez/unicode-inpage-converter (C++)
 *   - Reverse engineering from hex analysis
 *
 * See specs/05-character-maps.md for full documentation.
 */

/**
 * Composite sequences — MUST be matched BEFORE single-byte mappings.
 * Key format: "<baseByte_HEX>_<modifierByte_HEX>" e.g. "81_BF"
 */
export const COMPOSITE_SEQUENCES: ReadonlyMap<string, string> = new Map([
  ['81_BF', '\u0623'],       // أ  Alef + Hamza Above
  ['81_B3', '\u0622'],       // آ  Alef + Madda Above
  ['A2_BF', '\u0624'],       // ؤ  Wao + Hamza Above
  ['A4_BF', '\u06CC\u0626'], // یئ Farsi Yeh + Hamza Above
]);

/**
 * Urdu byte-index → Unicode mapping table.
 * Index is the second byte after 0x04 prefix.
 */
export const CHAR_MAP_URDU: ReadonlyMap<number, string> = new Map([
  // ===== Urdu/Arabic Letters =====
  [0x81, '\u0627'],  // ا Alef
  [0x82, '\u0628'],  // ب Beh
  [0x83, '\u067E'],  // پ Peh
  [0x84, '\u062A'],  // ت Teh
  [0x85, '\u0679'],  // ٹ Tteh
  [0x86, '\u062B'],  // ث Theh
  [0x87, '\u062C'],  // ج Jeem
  [0x88, '\u0686'],  // چ Tcheh
  [0x89, '\u062D'],  // ح Hah
  [0x8A, '\u062E'],  // خ Khah
  [0x8B, '\u062F'],  // د Dal
  [0x8C, '\u0688'],  // ڈ Ddal
  [0x8D, '\u0630'],  // ذ Thal
  [0x8E, '\u0631'],  // ر Reh
  [0x8F, '\u0691'],  // ڑ Rreh
  [0x90, '\u0632'],  // ز Zain
  [0x91, '\u0698'],  // ژ Jeh
  [0x92, '\u0633'],  // س Seen
  [0x93, '\u0634'],  // ش Sheen
  [0x94, '\u0635'],  // ص Sad
  [0x95, '\u0636'],  // ض Dad
  [0x96, '\u0637'],  // ط Tah
  [0x97, '\u0638'],  // ظ Zah
  [0x98, '\u0639'],  // ع Ain
  [0x99, '\u063A'],  // غ Ghain
  [0x9A, '\u0641'],  // ف Feh
  [0x9B, '\u0642'],  // ق Qaf
  [0x9C, '\u06A9'],  // ک Keheh (Urdu Kaf)
  [0x9D, '\u06AF'],  // گ Gaf
  [0x9E, '\u0644'],  // ل Lam
  [0x9F, '\u0645'],  // م Meem
  [0xA0, '\u0646'],  // ن Noon
  [0xA1, '\u06BA'],  // ں Noon Ghunna
  [0xA2, '\u0648'],  // و Wao
  [0xA3, '\u0621'],  // ء Hamza
  [0xA4, '\u06CC'],  // ی Farsi Yeh
  [0xA5, '\u06D2'],  // ے Yeh Barree
  [0xA6, '\u06C1'],  // ہ Heh Goal
  [0xA7, '\u06BE'],  // ھ Heh Doachashmee
  [0xB9, '\u06C3'],  // ۃ Teh Marbuta Goal

  // ===== Diacritical Marks (Harakat) =====
  [0xAA, '\u0650'],  // ِ Zer (Kasra)
  [0xAB, '\u064E'],  // َ Zabar (Fatha)
  [0xAC, '\u064F'],  // ُ Pesh (Damma)
  [0xAD, '\u0651'],  // ّ Shadda
  [0xA8, '\u064D'],  // ٍ Tanween Zer (Kasratan)
  [0xB0, '\u0656'],  // ٖ Khari Zer (Subscript Alef)
  [0xB1, '\u0652'],  // ْ Sukun (Jazm)
  [0xB3, '\u0653'],  // ٓ Madda
  [0xB5, '\u064C'],  // ٌ Tanween Pesh (Dammatan)
  [0xBD, '\u0670'],  // ٰ Khari Zabar (Superscript Alef)
  [0xBE, '\u0657'],  // ٗ Ulta Pesh (Inverted Damma)
  [0xBF, '\u0654'],  // ٔ Hamza Above
  [0xC7, '\u064B'],  // ً Tanween Zabar (Fathatan)

  // ===== Alternate Diacritic Encodings (0xC0–0xCF range) =====
  // Some InPage builds use alternate byte codes for the same diacritics.
  [0xC1, '\u0657'],  // ٗ Inverted Damma (alt; primary: 0xBE)
  [0xC2, '\u0654'],  // ٔ Hamza Above (alt; primary: 0xBF)
  [0xC3, '\u0655'],  // ٕ Arabic Hamza Below — unique, no other mapping
  [0xC6, '\u0651'],  // ّ Shadda (alt; primary: 0xAD)
  [0xC9, '\u0670'],  // ٰ Superscript Alef (alt; primary: 0xBD)
  [0xCA, '\u0656'],  // ٖ Subscript Alef (alt; primary: 0xB0)
  [0xCC, '\u0614'],  // ؔ Sign Takhallus (alt; primary: 0xCF)
  [0xCD, '\u060C'],  // ، Arabic Comma (alt; primary: 0xED)

  // ===== Special =====
  [0xA9, '\u0640'],  // ـ Kashida / Tatweel
  [0xB4, ''],        // Zero-width / null

  // ===== Urdu Numerals (Extended Arabic-Indic) =====
  [0xD0, '\u06F0'], [0xD1, '\u06F1'], [0xD2, '\u06F2'],
  [0xD3, '\u06F3'], [0xD4, '\u06F4'], [0xD5, '\u06F5'],
  [0xD6, '\u06F6'], [0xD7, '\u06F7'], [0xD8, '\u06F8'],
  [0xD9, '\u06F9'],

  // ===== Punctuation & Symbols =====
  [0xDA, '!'],
  [0xDB, '\uFD3E'],  // ﴾ Ornate Left Paren
  [0xDC, '\uFD3F'],  // ﴿ Ornate Right Paren
  [0xDF, '/'],
  [0xE1, ')'],       // RTL-swapped
  [0xE2, '('],       // RTL-swapped
  [0xE4, '+'],
  [0xE8, '\u066D'],  // ٭ Arabic Five-Pointed Star
  [0xE9, ':'],
  [0xEA, '\u061B'],  // ؛ Arabic Semicolon
  [0xEB, '\u00D7'],  // × Multiplication Sign
  [0xEC, '='],
  [0xED, '\u060C'],  // ، Arabic Comma
  [0xEE, '\u061F'],  // ؟ Arabic Question Mark
  [0xEF, '\u00F7'],  // ÷ Division Sign
  [0xF1, '/'],
  [0xF2, '\u060E'],  // ؎ Poetic Verse Sign
  [0xF3, '\u06D4'],  // ۔ Urdu Full Stop
  [0xF5, '-'],
  [0xF6, '\uFDFA'],  // ﷺ PBUH
  [0xF7, '\u0601'],  // ؁ Sign Sanah
  [0xF8, '\u0610'],  // ؐ Sign Sallallahou
  [0xF9, ','],
  [0xFA, ']'],
  [0xFB, '['],
  [0xFC, '.'],
  [0xFD, '\u2018'],  // ' Left Single Quote
  [0xFE, '\u2019'],  // ' Right Single Quote
  [0x20, ' '],       // Space (alternate encoding)

  // ===== Religious Symbols =====
  [0xAE, '\u0611'],  // ؑ Sign Alef Above
  [0xCF, '\u0614'],  // ؔ Sign Takhallus
  [0xE6, '\u0613'],  // ؓ Sign Radi Allahu Anhu
  [0xE7, '\u0612'],  // ؒ Sign Alayhe Assallam
]);

/**
 * Arabic-specific overrides.
 * In Arabic mode these mappings take precedence over CHAR_MAP_URDU.
 * See specs/05-character-maps.md for the full override table.
 */
export const CHAR_MAP_ARABIC: ReadonlyMap<number, string> = new Map([
  [0x9C, '\u0643'],  // ك Arabic Kaf
  [0xA4, '\u064A'],  // ي Arabic Yeh
  [0xA6, '\u0647'],  // ه Arabic Heh
  [0xB8, '\u064A'],  // ي Arabic Yeh (alternate)

  // Arabic-Indic Digits (override letter mappings in Arabic mode)
  [0x7C, '\u0660'], [0x7D, '\u0661'], [0x7E, '\u0662'],
  [0x7F, '\u0663'], [0x80, '\u0664'],
  [0x81, '\u0665'], [0x82, '\u0666'], [0x83, '\u0667'],
  [0x84, '\u0668'], [0x85, '\u0669'],
]);

/** Urdu/Arabic Unicode range check. */
export function isUrduCodePoint(code: number): boolean {
  return (
    (code >= 0x0600 && code <= 0x06FF) ||  // Arabic block
    (code >= 0x0750 && code <= 0x077F) ||  // Arabic Supplement
    (code >= 0xFB50 && code <= 0xFDFF) ||  // Arabic Presentation Forms-A
    (code >= 0xFE70 && code <= 0xFEFF) ||  // Arabic Presentation Forms-B
    (code >= 0x0610 && code <= 0x061A) ||  // Arabic signs
    code === 0xFDFA                         // ﷺ PBUH
  );
}

/** String version of the Urdu character check. */
export function isUrduChar(ch: string): boolean {
  return ch.length > 0 && isUrduCodePoint(ch.charCodeAt(0));
}
