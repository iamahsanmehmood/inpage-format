import { describe, it, expect } from 'vitest';
import { decodeV1V2, decodeV3, PAGE_BREAK_MARKER } from '../src/decoder.js';

// Helper: build a Uint8Array from hex byte values
function bytes(...hex: number[]): Uint8Array {
  return new Uint8Array(hex);
}

// Helper: build a 04-prefix encoded pair
function ch(charByte: number): number[] {
  return [0x04, charByte];
}

describe('decodeV1V2 — basic character mapping', () => {
  it('decodes Alef (0x81)', () => {
    const data = bytes(0x04, 0x81, 0x0D);
    const { paragraphs } = decodeV1V2(data);
    expect(paragraphs[0]).toBe('\u0627'); // ا
  });

  it('decodes a short Urdu word: ابی (Abhi)', () => {
    // 04 81 = ا, 04 82 = ب, 04 A4 = ی, then CR
    const data = bytes(0x04, 0x81, 0x04, 0x82, 0x04, 0xA4, 0x0D);
    const { paragraphs } = decodeV1V2(data);
    expect(paragraphs[0]).toBe('\u0627\u0628\u06CC');
  });

  it('decodes Urdu numerals', () => {
    const data = bytes(0x04, 0xD1, 0x04, 0xD2, 0x04, 0xD3, 0x0D);
    const { paragraphs } = decodeV1V2(data);
    expect(paragraphs[0]).toBe('\u06F1\u06F2\u06F3'); // ۱۲۳
  });

  it('ignores unknown byte values (no crash)', () => {
    const data = bytes(0xAA, 0xBB, 0x04, 0x81, 0x0D);
    expect(() => decodeV1V2(data)).not.toThrow();
  });

  it('does not crash on empty input', () => {
    const { paragraphs } = decodeV1V2(new Uint8Array(0));
    expect(paragraphs).toEqual([]);
  });
});

describe('decodeV1V2 — composite sequences', () => {
  it('decodes Alef + Hamza Above → أ', () => {
    // 04 81 04 BF (composite) then CR
    const data = bytes(0x04, 0x81, 0x04, 0xBF, 0x0D);
    const { paragraphs } = decodeV1V2(data);
    expect(paragraphs[0]).toBe('\u0623'); // أ not ا + ٔ
  });

  it('decodes Alef + Madda → آ', () => {
    const data = bytes(0x04, 0x81, 0x04, 0xB3, 0x0D);
    const { paragraphs } = decodeV1V2(data);
    expect(paragraphs[0]).toBe('\u0622');
  });

  it('decodes Wao + Hamza → ؤ', () => {
    const data = bytes(0x04, 0xA2, 0x04, 0xBF, 0x0D);
    const { paragraphs } = decodeV1V2(data);
    expect(paragraphs[0]).toBe('\u0624');
  });

  it('matches composite before single byte', () => {
    // If composite is matched first, we get أ (U+0623) not ا (U+0627) + ٔ (U+0654)
    const data = bytes(0x04, 0x81, 0x04, 0xBF, 0x0D);
    const { paragraphs } = decodeV1V2(data);
    expect(paragraphs[0]).toBe('\u0623');
    expect(paragraphs[0]).not.toBe('\u0627\u0654');
  });
});

describe('decodeV1V2 — paragraph breaks', () => {
  it('splits on CR (0x0D)', () => {
    const data = bytes(
      0x04, 0x81, 0x0D,        // paragraph 1: ا
      0x04, 0x82, 0x0D,        // paragraph 2: ب
    );
    const { paragraphs } = decodeV1V2(data);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toBe('\u0627');
    expect(paragraphs[1]).toBe('\u0628');
  });

  it('splits on CR+LF (0x0D 0x0A) as a single break', () => {
    const data = bytes(0x04, 0x81, 0x0D, 0x0A, 0x04, 0x82, 0x0D);
    const { paragraphs } = decodeV1V2(data);
    expect(paragraphs).toHaveLength(2);
  });

  it('discards empty paragraphs', () => {
    const data = bytes(0x0D, 0x0D, 0x04, 0x81, 0x0D);
    const { paragraphs } = decodeV1V2(data);
    expect(paragraphs).toHaveLength(1);
  });
});

describe('decodeV1V2 — page breaks', () => {
  it('emits PAGE_BREAK_MARKER on Form Feed (0x0C)', () => {
    const data = bytes(
      0x04, 0x81, 0x0D,        // paragraph before break
      0x0C,                     // page break
      0x04, 0x82, 0x0D,        // paragraph after break
    );
    const { paragraphs, pageBreakIndices } = decodeV1V2(data);
    expect(paragraphs).toContain(PAGE_BREAK_MARKER);
    expect(pageBreakIndices).toHaveLength(1);
  });

  it('includes content before and after page break', () => {
    const data = bytes(
      0x04, 0x81, 0x0D,
      0x0C,
      0x04, 0x82, 0x0D,
    );
    const { paragraphs } = decodeV1V2(data);
    expect(paragraphs[0]).toBe('\u0627');
    expect(paragraphs[1]).toBe(PAGE_BREAK_MARKER);
    expect(paragraphs[2]).toBe('\u0628');
  });
});

describe('decodeV1V2 — word spacing (pendingSpace)', () => {
  it('inserts a space between words separated by a control byte', () => {
    // ا (word 1) + unknown control byte + ب (word 2)
    const data = bytes(0x04, 0x81, 0xFF, 0x04, 0x82, 0x0D);
    const { paragraphs } = decodeV1V2(data);
    expect(paragraphs[0]).toBe('\u0627 \u0628'); // space inserted
  });

  it('does not insert a leading space before the first character', () => {
    const data = bytes(0xFF, 0x04, 0x81, 0x0D);
    const { paragraphs } = decodeV1V2(data);
    expect(paragraphs[0]).toBe('\u0627'); // no leading space
  });

  it('does not double-space', () => {
    // Two control bytes between words
    const data = bytes(0x04, 0x81, 0xFF, 0xFE, 0x04, 0x82, 0x0D);
    const { paragraphs } = decodeV1V2(data);
    expect(paragraphs[0]).toBe('\u0627 \u0628');
  });
});

describe('decodeV1V2 — paragraph metadata', () => {
  it('returns paragraphMeta aligned with paragraphs', () => {
    const data = bytes(0x04, 0x81, 0x0D, 0x04, 0x82, 0x0D);
    const { paragraphs, paragraphMeta } = decodeV1V2(data);
    expect(paragraphMeta).toHaveLength(paragraphs.length);
  });

  it('marks page break meta correctly', () => {
    const data = bytes(0x04, 0x81, 0x0D, 0x0C, 0x04, 0x82, 0x0D);
    const { paragraphMeta } = decodeV1V2(data);
    const pb = paragraphMeta.find(m => m.isPageBreak);
    expect(pb).toBeDefined();
    expect(pb!.text).toBe(PAGE_BREAK_MARKER);
  });
});

// ─── V3 Decoder Tests ─────────────────────────────────────────────────────────

/**
 * Build a minimal valid V3 stream with one text span.
 *   - 8-byte struct: [styleId=1, byteLength=textBytes.length]
 *   - 6-byte boundary marker: FF FF FF FF 0D 00
 *   - text bytes (UTF-16LE encoded)
 */
function buildV3Stream(text: string, styleId = 1): Uint8Array {
  // Encode text as UTF-16LE + CR terminator
  const textCodes: number[] = [];
  for (const ch of text) {
    const cp = ch.charCodeAt(0);
    textCodes.push(cp & 0xFF, (cp >> 8) & 0xFF);
  }
  textCodes.push(0x0D, 0x00); // paragraph terminator CR

  const byteLength = textCodes.length;

  // Build the struct (8 bytes: styleId LE32, byteLength LE32)
  const struct = [
    styleId & 0xFF, (styleId >> 8) & 0xFF, 0, 0,
    byteLength & 0xFF, (byteLength >> 8) & 0xFF, 0, 0,
  ];

  // Pad header to 0x1000 so boundary marker is found in the normal scan range
  const header = new Array(0x1000).fill(0);
  const result: number[] = [
    ...header,
    ...struct,
    0xFF, 0xFF, 0xFF, 0xFF, 0x0D, 0x00, // boundary marker
    ...textCodes,
  ];

  return new Uint8Array(result);
}

describe('decodeV3 — basic text extraction', () => {
  it('extracts a simple Urdu paragraph', () => {
    const stream = buildV3Stream('\u0627\u0628\u06CC'); // ابی
    const { paragraphs } = decodeV3(stream);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]).toBe('\u0627\u0628\u06CC');
  });

  it('returns empty array when boundary marker not found', () => {
    const data = new Uint8Array(100).fill(0);
    const { paragraphs } = decodeV3(data);
    expect(paragraphs).toEqual([]);
  });

  it('does not crash on empty input', () => {
    expect(() => decodeV3(new Uint8Array(0))).not.toThrow();
  });
});

describe('decodeV3 — control code filtering', () => {
  it('skips control code injection records', () => {
    // Build text: ا + [ctrl 0x01, len 2, data AA BB] + ب + CR
    const rawText: number[] = [
      0x27, 0x06,             // ا (U+0627)
      0x01, 0x00, 0x02, 0x00, 0xAA, 0xBB, // ctrl record: code=0x0001, len=2, data
      0x28, 0x06,             // ب (U+0628)
      0x0D, 0x00,             // CR
    ];

    const struct = [1, 0, 0, 0, rawText.length & 0xFF, (rawText.length >> 8) & 0xFF, 0, 0];
    const header = new Array(0x1000).fill(0);
    const stream = new Uint8Array([
      ...header, ...struct,
      0xFF, 0xFF, 0xFF, 0xFF, 0x0D, 0x00,
      ...rawText,
    ]);

    const { paragraphs } = decodeV3(stream);
    expect(paragraphs[0]).toBe('\u0627\u0628'); // control record skipped
  });
});

describe('decodeV3 — paragraph metadata', () => {
  it('returns styleId in paragraphMeta', () => {
    const stream = buildV3Stream('\u0627', 42);
    const { paragraphMeta } = decodeV3(stream);
    expect(paragraphMeta[0]?.styleId).toBe(42);
  });
});
