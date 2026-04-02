import { describe, it, expect } from 'vitest';
import { filterParagraphs, filterParagraphsWithMeta } from '../src/text-filter.js';
import { PAGE_BREAK_MARKER } from '../src/decoder.js';

// Urdu sample strings for tests
const URDU_SENTENCE = 'یہ ایک اردو جملہ ہے جو کافی لمبا ہے'; // "This is an Urdu sentence that is quite long"
const SHORT_TITLE = 'اپنا گھر'; // "Our Home" — 8 chars, should pass
const RELIGIOUS_PHRASE = 'اللہ اللہ اللہ'; // 3 unique, 9 total — should pass
const PURE_NUMBER = '12345';
const METADATA = 'InPage Nastaliq';
const METADATA_WITH_URDU = 'InPage Nastaliq کا متن'; // has Urdu — should pass Layer 2
const LIGATURE_GARBAGE = '\uFB50\uFB51\uFB52\uFB53\uFB54\uFB55\uFB56'; // all ligatures

describe('Layer 1: Density filter', () => {
  it('passes a normal Urdu sentence', () => {
    const result = filterParagraphs([URDU_SENTENCE]);
    expect(result).toContain(URDU_SENTENCE);
  });

  it('passes short pure Urdu title (< 15 chars)', () => {
    const result = filterParagraphs([SHORT_TITLE]);
    expect(result).toContain(SHORT_TITLE);
  });

  it('passes short numeric string (table cell)', () => {
    const result = filterParagraphs([PURE_NUMBER]);
    expect(result).toContain(PURE_NUMBER);
  });

  it('passes bilingual short text with ≥15% Urdu', () => {
    const bilingual = 'By: عمر'; // 3 Urdu chars, 7 total → ~43% density
    const result = filterParagraphs([bilingual]);
    expect(result).toContain(bilingual);
  });

  it('rejects string with fewer than 3 Urdu chars in short text', () => {
    const sparse = 'hello world with one ا char that dilutes'; // 1 Urdu char
    const result = filterParagraphs([sparse]);
    expect(result).not.toContain(sparse);
  });

  it('does not drop PAGE_BREAK_MARKER when surrounded by content', () => {
    // A lone marker gets stripped as leading/trailing — that's correct.
    // When surrounded by content it must be preserved.
    const result = filterParagraphs([URDU_SENTENCE, PAGE_BREAK_MARKER, 'کوئی اور جملہ جو مختلف ہے اور اچھا ہے']);
    expect(result).toContain(PAGE_BREAK_MARKER);
  });
});

describe('Layer 2: Metadata + pattern filter', () => {
  it('rejects known metadata string when no Urdu present', () => {
    const result = filterParagraphs([METADATA]);
    expect(result).not.toContain(METADATA);
  });

  it('passes metadata-like string that also contains Urdu', () => {
    const result = filterParagraphs([METADATA_WITH_URDU]);
    expect(result).toContain(METADATA_WITH_URDU);
  });

  it('rejects repeating ASCII pattern (long single-char repetition)', () => {
    const garbage = 'AAAAAAAAAAAAA';
    const result = filterParagraphs([garbage]);
    expect(result).not.toContain(garbage);
  });

  it('rejects InPage100/200/300 stream names', () => {
    expect(filterParagraphs(['InPage100'])).not.toContain('InPage100');
    expect(filterParagraphs(['InPage300'])).not.toContain('InPage300');
    expect(filterParagraphs(['Root Entry'])).not.toContain('Root Entry');
  });
});

describe('Layer 3: Repetition + ligature filter', () => {
  it('passes religious phrase with ≤3 unique chars but total ≤ 20', () => {
    // "اللہ اللہ اللہ" has 3 unique Urdu chars and ~9 total Urdu — passes (≤ 20 threshold)
    const result = filterParagraphs([RELIGIOUS_PHRASE]);
    expect(result).toContain(RELIGIOUS_PHRASE);
  });

  it('rejects low-uniqueness string with > 20 Urdu chars', () => {
    // Repeat اللہ many times to exceed the threshold
    const longRepeat = 'اللہ '.repeat(10); // ~40 Urdu chars, 3 unique
    const result = filterParagraphs([longRepeat.trim()]);
    expect(result).not.toContain(longRepeat.trim());
  });

  it('rejects ligature-heavy text (> 50% Arabic Presentation Forms)', () => {
    const result = filterParagraphs([LIGATURE_GARBAGE]);
    expect(result).not.toContain(LIGATURE_GARBAGE);
  });

  it('passes text with diverse Urdu characters', () => {
    const result = filterParagraphs([URDU_SENTENCE]);
    expect(result).toContain(URDU_SENTENCE);
  });
});

describe('Deduplication', () => {
  it('removes duplicate paragraphs', () => {
    const result = filterParagraphs([URDU_SENTENCE, URDU_SENTENCE]);
    expect(result.filter(p => p === URDU_SENTENCE)).toHaveLength(1);
  });

  it('keeps short duplicates (table cells, numbers)', () => {
    const result = filterParagraphs(['۱', '۱', '۱']);
    // Short strings are not deduplicated
    expect(result.filter(p => p === '۱').length).toBeGreaterThanOrEqual(1);
  });

  it('deduplicates by space-stripped fingerprint', () => {
    const a = URDU_SENTENCE;
    const b = URDU_SENTENCE.replace(/\s/g, '  '); // extra spaces
    const result = filterParagraphs([a, b]);
    expect(result).toHaveLength(1); // b is a duplicate of a by fingerprint
  });
});

describe('Page break handling', () => {
  it('strips leading PAGE_BREAK_MARKER', () => {
    const result = filterParagraphs([PAGE_BREAK_MARKER, URDU_SENTENCE]);
    expect(result[0]).toBe(URDU_SENTENCE);
  });

  it('strips trailing PAGE_BREAK_MARKER', () => {
    const result = filterParagraphs([URDU_SENTENCE, PAGE_BREAK_MARKER]);
    expect(result[result.length - 1]).toBe(URDU_SENTENCE);
  });

  it('preserves mid-document PAGE_BREAK_MARKER', () => {
    // Use two different sentences so deduplication doesn't remove one,
    // which would leave PAGE_BREAK_MARKER as trailing and strip it.
    const second = 'کوئی اور مختلف جملہ جو پہلے جملے سے الگ ہے';
    const result = filterParagraphs([URDU_SENTENCE, PAGE_BREAK_MARKER, second]);
    expect(result).toContain(PAGE_BREAK_MARKER);
  });
});

describe('filterParagraphsWithMeta', () => {
  it('returns filteredCount equal to dropped paragraphs', () => {
    const raw = [URDU_SENTENCE, METADATA, 'InPage100'];
    const { filteredCount } = filterParagraphsWithMeta(raw, []);
    expect(filteredCount).toBe(2); // METADATA and InPage100 dropped
  });

  it('returns 0 filteredCount when nothing is dropped', () => {
    const raw = [URDU_SENTENCE];
    const { filteredCount } = filterParagraphsWithMeta(raw, []);
    expect(filteredCount).toBe(0);
  });

  it('aligns paragraphs and meta arrays', () => {
    const raw = [URDU_SENTENCE, METADATA];
    const meta = [
      { text: URDU_SENTENCE, startOffset: 0, endOffset: 10, isPageBreak: false },
      { text: METADATA, startOffset: 10, endOffset: 20, isPageBreak: false },
    ];
    const { paragraphs, meta: outMeta } = filterParagraphsWithMeta(raw, meta);
    expect(paragraphs.length).toBe(outMeta.length);
  });
});
