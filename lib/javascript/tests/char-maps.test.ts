import { describe, it, expect } from 'vitest';
import {
  CHAR_MAP_URDU,
  CHAR_MAP_ARABIC,
  COMPOSITE_SEQUENCES,
  isUrduChar,
  isUrduCodePoint,
} from '../src/char-maps.js';

describe('CHAR_MAP_URDU', () => {
  it('maps core Urdu letters', () => {
    expect(CHAR_MAP_URDU.get(0x81)).toBe('\u0627'); // ا Alef
    expect(CHAR_MAP_URDU.get(0x82)).toBe('\u0628'); // ب Beh
    expect(CHAR_MAP_URDU.get(0x83)).toBe('\u067E'); // پ Peh
    expect(CHAR_MAP_URDU.get(0x9C)).toBe('\u06A9'); // ک Keheh
    expect(CHAR_MAP_URDU.get(0xA4)).toBe('\u06CC'); // ی Farsi Yeh
    expect(CHAR_MAP_URDU.get(0xA5)).toBe('\u06D2'); // ے Yeh Barree
    expect(CHAR_MAP_URDU.get(0xA6)).toBe('\u06C1'); // ہ Heh Goal
  });

  it('maps all 28 Urdu consonants', () => {
    const letters = [
      0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A,
      0x8B, 0x8C, 0x8D, 0x8E, 0x8F, 0x90, 0x91, 0x92, 0x93, 0x94,
      0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0x9E,
      0x9F, 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7,
    ];
    for (const byte of letters) {
      expect(CHAR_MAP_URDU.has(byte), `missing byte 0x${byte.toString(16)}`).toBe(true);
    }
  });

  it('maps diacritical marks', () => {
    expect(CHAR_MAP_URDU.get(0xAA)).toBe('\u0650'); // Zer (Kasra)
    expect(CHAR_MAP_URDU.get(0xAB)).toBe('\u064E'); // Zabar (Fatha)
    expect(CHAR_MAP_URDU.get(0xAC)).toBe('\u064F'); // Pesh (Damma)
    expect(CHAR_MAP_URDU.get(0xAD)).toBe('\u0651'); // Shadda
    expect(CHAR_MAP_URDU.get(0xB1)).toBe('\u0652'); // Sukun
    expect(CHAR_MAP_URDU.get(0xBF)).toBe('\u0654'); // Hamza Above
  });

  it('maps alternate diacritic encodings (0xC0–0xCF range)', () => {
    expect(CHAR_MAP_URDU.get(0xC1)).toBe('\u0657'); // Inverted Damma (alt)
    expect(CHAR_MAP_URDU.get(0xC2)).toBe('\u0654'); // Hamza Above (alt)
    expect(CHAR_MAP_URDU.get(0xC3)).toBe('\u0655'); // Hamza Below (unique)
    expect(CHAR_MAP_URDU.get(0xC6)).toBe('\u0651'); // Shadda (alt)
    expect(CHAR_MAP_URDU.get(0xC9)).toBe('\u0670'); // Superscript Alef (alt)
    expect(CHAR_MAP_URDU.get(0xCA)).toBe('\u0656'); // Subscript Alef (alt)
  });

  it('maps Urdu numerals (Extended Arabic-Indic)', () => {
    expect(CHAR_MAP_URDU.get(0xD0)).toBe('\u06F0'); // ۰
    expect(CHAR_MAP_URDU.get(0xD5)).toBe('\u06F5'); // ۵
    expect(CHAR_MAP_URDU.get(0xD9)).toBe('\u06F9'); // ۹
  });

  it('maps Urdu punctuation', () => {
    expect(CHAR_MAP_URDU.get(0xF3)).toBe('\u06D4'); // ۔ Urdu Full Stop
    expect(CHAR_MAP_URDU.get(0xED)).toBe('\u060C'); // ، Arabic Comma
    expect(CHAR_MAP_URDU.get(0xEE)).toBe('\u061F'); // ؟ Arabic Question Mark
    expect(CHAR_MAP_URDU.get(0xF6)).toBe('\uFDFA'); // ﷺ PBUH
  });

  it('maps space as alternate encoding', () => {
    expect(CHAR_MAP_URDU.get(0x20)).toBe(' ');
  });
});

describe('CHAR_MAP_ARABIC', () => {
  it('overrides Kaf, Yeh, Heh for Arabic mode', () => {
    expect(CHAR_MAP_ARABIC.get(0x9C)).toBe('\u0643'); // ك Arabic Kaf (not Urdu Keheh)
    expect(CHAR_MAP_ARABIC.get(0xA4)).toBe('\u064A'); // ي Arabic Yeh (not Farsi Yeh)
    expect(CHAR_MAP_ARABIC.get(0xA6)).toBe('\u0647'); // ه Arabic Heh (not Heh Goal)
  });

  it('maps Arabic-Indic digits 0–9', () => {
    expect(CHAR_MAP_ARABIC.get(0x7C)).toBe('\u0660'); // ٠ 0
    expect(CHAR_MAP_ARABIC.get(0x80)).toBe('\u0664'); // ٤ 4
    expect(CHAR_MAP_ARABIC.get(0x81)).toBe('\u0665'); // ٥ 5
    expect(CHAR_MAP_ARABIC.get(0x85)).toBe('\u0669'); // ٩ 9
  });
});

describe('COMPOSITE_SEQUENCES', () => {
  it('maps Alef + Hamza Above → أ', () => {
    expect(COMPOSITE_SEQUENCES.get('81_BF')).toBe('\u0623');
  });

  it('maps Alef + Madda → آ', () => {
    expect(COMPOSITE_SEQUENCES.get('81_B3')).toBe('\u0622');
  });

  it('maps Wao + Hamza → ؤ', () => {
    expect(COMPOSITE_SEQUENCES.get('A2_BF')).toBe('\u0624');
  });

  it('maps Farsi Yeh + Hamza → یئ', () => {
    expect(COMPOSITE_SEQUENCES.get('A4_BF')).toBe('\u06CC\u0626');
  });

  it('has exactly 4 composite entries', () => {
    expect(COMPOSITE_SEQUENCES.size).toBe(4);
  });
});

describe('isUrduCodePoint', () => {
  it('accepts Arabic block (U+0600–U+06FF)', () => {
    expect(isUrduCodePoint(0x0627)).toBe(true); // ا
    expect(isUrduCodePoint(0x06CC)).toBe(true); // ی
  });

  it('accepts Arabic Presentation Forms-A', () => {
    expect(isUrduCodePoint(0xFB50)).toBe(true);
    expect(isUrduCodePoint(0xFDFA)).toBe(true); // ﷺ
  });

  it('rejects Latin characters', () => {
    expect(isUrduCodePoint(0x0041)).toBe(false); // A
    expect(isUrduCodePoint(0x0031)).toBe(false); // 1
  });
});

describe('isUrduChar', () => {
  it('returns true for Urdu character string', () => {
    expect(isUrduChar('ا')).toBe(true);
    expect(isUrduChar('ی')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isUrduChar('')).toBe(false);
  });

  it('returns false for Latin string', () => {
    expect(isUrduChar('A')).toBe(false);
  });
});
