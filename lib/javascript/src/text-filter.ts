/**
 * 3-Layer Text Filter + Deduplication
 *
 * Separates actual Urdu content from binary metadata noise in decoded InPage output.
 *
 * Layer 1: Density filter — minimum Urdu char count + density ratio
 * Layer 2: Pattern filter — metadata strings and repeating ASCII
 * Layer 3: Repetition filter — low-uniqueness Urdu and ligature garbage
 *
 * See specs/07-text-filtering.md for full algorithm documentation.
 */

import { isUrduChar } from './char-maps.js';
import { PAGE_BREAK_MARKER } from './decoder.js';
import type { ParagraphMeta } from './types.js';

// Known metadata strings embedded in InPage streams
const METADATA_STRINGS = [
  'Normal', '@dFF', 'InPage Nastaliq', 'InPage Naskh',
  'Arial Unicode MS', 'Faiz Nastaliq', 'DocumentInfo',
  'InPage100', 'InPage200', 'InPage300', 'Root Entry',
] as const;

function countUrdu(text: string): number {
  let n = 0;
  for (const ch of text) { if (isUrduChar(ch)) n++; }
  return n;
}

function countUniqueUrdu(text: string): number {
  const s = new Set<string>();
  for (const ch of text) { if (isUrduChar(ch)) s.add(ch); }
  return s.size;
}

function isLigatureHeavy(text: string): boolean {
  let lig = 0, total = 0;
  for (const ch of text) {
    total++;
    const c = ch.charCodeAt(0);
    if (c >= 0xFB50 && c <= 0xFDFF) lig++;
  }
  return total > 0 && (lig / total) > 0.5;
}

function hasRepeatingPattern(text: string): boolean {
  const cleaned = text.replace(/\s/g, '');
  if (cleaned.length < 4) return false;

  const chars = new Set(cleaned);
  if (chars.size <= 2 && cleaned.length > 10) return true;

  for (let len = 1; len <= 4; len++) {
    const pattern = cleaned.substring(0, len);
    let hits = 0;
    for (let i = 0; i < cleaned.length - len + 1; i += len) {
      if (cleaned.substring(i, i + len) === pattern) hits++;
    }
    if (hits > (cleaned.length / len) * 0.8) return true;
  }
  return false;
}

// ─── Layer 1: Density Filter ──────────────────────────────────────────────────

function passesLayer1(text: string): boolean {
  if (text === PAGE_BREAK_MARKER) return true;

  const trimmed = text.trim();
  if (trimmed === '') return true;

  // Short numeric/alphanumeric (table cells, dates)
  if (trimmed.length <= 10 && /^[\d\sA-Za-z\-./]+$/.test(trimmed)) return true;

  // Short pure Urdu (titles, captions)
  if (trimmed.length < 15 && /^[\u0600-\u06FF\s،۔0-9]+$/.test(trimmed)) return true;

  const urdu = countUrdu(text);
  const total = [...text].length;
  if (total === 0) return false;

  // Bilingual bypass: short mixed-language with some Urdu
  if (total <= 30 && urdu >= 2 && (urdu / total) >= 0.15) return true;

  const minUrdu = total < 20 ? 3 : 5;
  if (urdu < minUrdu) return false;

  const minDensity = total < 20 ? 0.30 : 0.40;
  return (urdu / total) >= minDensity;
}

// ─── Layer 2: Pattern + Metadata Filter ──────────────────────────────────────

function passesLayer2(text: string): boolean {
  if (text === PAGE_BREAK_MARKER) return true;

  // Only reject metadata strings when there is no Urdu in the paragraph
  if (countUrdu(text) === 0) {
    for (const meta of METADATA_STRINGS) {
      if (text.includes(meta)) return false;
    }
  }

  // Only check repeating patterns for non-Urdu content.
  // Urdu phrases like "اللہ اللہ اللہ" legitimately repeat but are real text.
  if (countUrdu(text) === 0 && hasRepeatingPattern(text)) return false;
  return true;
}

// ─── Layer 3: Repetition + Ligature Filter ───────────────────────────────────

function passesLayer3(text: string): boolean {
  if (text === PAGE_BREAK_MARKER) return true;

  const unique = countUniqueUrdu(text);
  const total = countUrdu(text);

  // ≤3 unique Urdu chars repeating excessively — likely binary garbage
  // Threshold 20 (not 10) so "اللہ اللہ اللہ" (12 chars, 3 unique) passes
  if (unique <= 3 && total > 20) return false;

  return !isLigatureHeavy(text);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Apply all filters and return cleaned paragraphs. */
export function filterParagraphs(raw: string[]): string[] {
  return filterParagraphsWithMeta(raw, []).paragraphs;
}

/**
 * Apply all filters and return paragraphs with their metadata.
 * Also returns the count of paragraphs dropped by the filters.
 */
export function filterParagraphsWithMeta(
  raw: string[],
  meta: ParagraphMeta[],
): { paragraphs: string[]; meta: ParagraphMeta[]; filteredCount: number } {
  const zipped = raw.map((text, i) => ({
    text,
    meta: meta[i] ?? { text, startOffset: 0, endOffset: 0, isPageBreak: text === PAGE_BREAK_MARKER },
  }));

  // Apply 3-layer filter
  let filtered = zipped.filter(({ text }) => {
    if (text === PAGE_BREAK_MARKER) return true;
    return passesLayer1(text) && passesLayer2(text) && passesLayer3(text);
  });

  // Deduplicate (space-stripped fingerprints, skip short strings)
  const seen = new Set<string>();
  filtered = filtered.filter(({ text }) => {
    if (text === PAGE_BREAK_MARKER) return true;
    if (text.trim().length < 15) return true; // keep short (table cells etc.)
    const fp = text.replace(/\s+/g, '');
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });

  // Remove leading/trailing page break markers
  while (filtered.length > 0 && filtered[0]!.text === PAGE_BREAK_MARKER) filtered.shift();
  while (filtered.length > 0 && filtered[filtered.length - 1]!.text === PAGE_BREAK_MARKER) filtered.pop();

  const contentRaw = raw.filter(p => p !== PAGE_BREAK_MARKER).length;
  const contentKept = filtered.filter(f => f.text !== PAGE_BREAK_MARKER).length;

  return {
    paragraphs: filtered.map(f => f.text),
    meta: filtered.map(f => f.meta),
    filteredCount: Math.max(0, contentRaw - contentKept),
  };
}
