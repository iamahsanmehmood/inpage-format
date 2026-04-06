/**
 * InPage Format Extractor
 *
 * Extracts formatting metadata from InPage content streams:
 *   - Font table (UTF-16LE strings in header)
 *   - Color palette (named colors + RGB bytes)
 *   - Default style properties (font size, alignment, bold) from header block at ~0xD0
 *   - Per-paragraph style overrides from tag-value control sequences
 *
 * Based on reverse engineering of .INP binary format.
 * See specs/06-formatting-structures.md for full documentation.
 */

import type { Alignment, StyleProperties } from './types.js';

// ── Public types ──────────────────────────────────────────────────────────────

export interface FontEntry {
  /** Sequential index (0-based) in the order found. */
  index: number;
  /** Font name as stored in the stream (UTF-16LE). */
  name: string;
  /** Byte offset in the stream where this name was found. */
  offset: number;
}

export interface ColorEntry {
  /** Color name as stored in the stream. */
  name: string;
  r: number;
  g: number;
  b: number;
  /** Hex color string e.g. "#ff0000". */
  hex: string;
}

export interface ParagraphFormat {
  /** Byte offset of the paragraph's first decoded character. */
  textStartOffset: number;
  /** Partial style overrides for this paragraph. */
  style: Partial<StyleProperties>;
}

export interface DocumentFormat {
  fonts: FontEntry[];
  colors: ColorEntry[];
  /** Default style applying to all paragraphs unless overridden. */
  defaultStyle: StyleProperties;
  /** Per-paragraph style overrides, ordered by textStartOffset ascending. */
  paragraphFormats: ParagraphFormat[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * InPage internal unit → typographic points.
 * Derived from reverse engineering: 8.33 internal units ≈ 1 pt.
 */
const INPAGE_UNITS_PER_PT = 8.33;

const FONT_PATTERNS = [
  'InPage', 'Nastaliq', 'Nastaleeq', 'Arial', 'Faiz', 'Noori', 'Jameel',
  'Gulzar', 'Alvi', 'Mehr', 'Nafees', 'Times', 'Noto', 'Tahoma', 'Verdana',
  'Courier', 'Symbol', 'Helvetica', 'Georgia',
];

const COLOR_NAMES = [
  'Black', 'Blue', 'Brown', 'Crimson', 'Cyan', 'Gold', 'Gray', 'Grey',
  'Green', 'Magenta', 'Navy', 'Orange', 'Pink', 'Purple', 'Red',
  'Silver', 'Teal', 'Violet', 'White', 'Yellow', 'Maroon', 'Olive',
  'Dark', 'Light', 'Deep', 'Sky', 'Royal', 'Lime', 'Mint',
];

// ── Font extraction ───────────────────────────────────────────────────────────

/**
 * Extract font names from the InPage stream header.
 * Fonts are stored as UTF-16LE null-terminated strings.
 */
export function extractFontTable(data: Uint8Array): FontEntry[] {
  const fonts: FontEntry[] = [];
  const seenOffsets = new Set<number>();

  for (let i = 0; i < data.length - 10; i += 2) {
    for (const pattern of FONT_PATTERNS) {
      if (matchesUTF16LE(data, i, pattern)) {
        if (seenOffsets.has(i)) continue;
        const name = readUTF16LEString(data, i);
        if (name.length >= 3) {
          seenOffsets.add(i);
          fonts.push({ index: fonts.length, name, offset: i });
        }
      }
    }
  }

  // Deduplicate by name, keep first occurrence
  const byName = new Map<string, FontEntry>();
  for (const f of fonts) {
    if (!byName.has(f.name)) {
      byName.set(f.name, { ...f, index: byName.size });
    }
  }
  return Array.from(byName.values());
}

// ── Color extraction ──────────────────────────────────────────────────────────

/**
 * Extract color palette entries from the stream.
 * Each entry is a UTF-16LE name string followed (after null padding) by 3 RGB bytes.
 */
export function extractColorPalette(data: Uint8Array): ColorEntry[] {
  const colors: ColorEntry[] = [];
  const seenOffsets = new Set<number>();

  for (let i = 0; i < data.length - 60; i += 2) {
    for (const colorName of COLOR_NAMES) {
      if (matchesUTF16LE(data, i, colorName)) {
        if (seenOffsets.has(i)) continue;
        seenOffsets.add(i);

        const name = readUTF16LEString(data, i);
        if (name.length < 2) continue;

        // Skip null padding after the name string
        let rgbOffset = i + name.length * 2;
        while (rgbOffset < data.length - 3 && data[rgbOffset] === 0x00 && data[rgbOffset + 1] === 0x00) {
          rgbOffset += 2;
        }

        if (rgbOffset + 3 <= data.length) {
          const r = data[rgbOffset]!;
          const g = data[rgbOffset + 1]!;
          const b = data[rgbOffset + 2]!;
          colors.push({ name, r, g, b, hex: toHex(r, g, b) });
        }
      }
    }
  }
  return colors;
}

// ── Default style extraction ──────────────────────────────────────────────────

/**
 * Parse default style properties from the stream header.
 *
 * InPage stores default style properties as tag-value pairs starting around
 * offset 0xD0, using the structure: [propId: u8][group: u8][value: u16 LE]
 *
 * group 0x01 = character-level properties
 * group 0x7E = paragraph-level properties
 */
export function parseDefaultStyle(data: Uint8Array): StyleProperties {
  const style: StyleProperties = {
    fontSize: 18,
    fontIndex: 0,
    bold: false,
    italic: false,
    underline: false,
    colorIndex: 0,
    alignment: 'right',   // InPage default: RTL right-align
    lineSpacing: 2.2,
  };

  if (data.length < 0x160) return style;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const scanEnd = Math.min(data.length - 4, 0x400);

  // Collect all font size candidates — use the mode (most common) value as the
  // default, not just the last one found. This prevents a single large heading
  // size in the header from overriding the body text default for all paragraphs.
  const fontSizeCandidates: number[] = [];

  for (let i = 0; i < scanEnd; i += 2) {
    if (data[i + 1] === 0x01) {
      const propId = data[i]!;
      const val = view.getUint16(i + 2, true);

      if (propId === 0x01) {
        // Collect body-text font sizes only (≤ 24 pt).
        // Values above 24 pt are heading/display sizes that should not
        // override the body-text default applied to all paragraphs.
        const pts = Math.round(val / INPAGE_UNITS_PER_PT);
        if (pts >= 4 && pts <= 24) fontSizeCandidates.push(pts);
      } else {
        applyGroup01Property(propId, val, style);
      }
      i += 2;
    }
  }

  // Pick the most common (mode) font size; if tie, pick the smallest
  // (body text appears more often than display headings)
  if (fontSizeCandidates.length > 0) {
    const freq = new Map<number, number>();
    for (const s of fontSizeCandidates) freq.set(s, (freq.get(s) ?? 0) + 1);
    let best = fontSizeCandidates[0]!;
    let bestCount = 0;
    for (const [size, count] of freq) {
      if (count > bestCount || (count === bestCount && size < best)) {
        best = size; bestCount = count;
      }
    }
    style.fontSize = best;
  }

  return style;
}

// ── Per-paragraph format extraction ──────────────────────────────────────────

/**
 * Extract per-paragraph style overrides from the stream.
 *
 * For V1/V2: scans for the pattern 0D XX XX 00 00 09 preceding text runs,
 * then reads tag-value pairs in the ~80 bytes before the pattern.
 */
export function extractParagraphFormats(data: Uint8Array, version: number): ParagraphFormat[] {
  if (version >= 3) return extractV3ParagraphFormats(data);
  return extractV1V2ParagraphFormats(data);
}

function extractV1V2ParagraphFormats(data: Uint8Array): ParagraphFormat[] {
  const formats: ParagraphFormat[] = [];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  for (let i = 0; i < data.length - 6; i++) {
    // Pattern preceding a text run: 0D XX XX 00 00 09 04 ...
    if (
      data[i] === 0x0D &&
      data[i + 3] === 0x00 &&
      data[i + 4] === 0x00 &&
      data[i + 5] === 0x09 &&
      i + 6 < data.length &&
      data[i + 6] === 0x04
    ) {
      const textStart = i + 6;
      const style: Partial<StyleProperties> = {};

      // Scan backwards for tag-value pairs
      const scanStart = Math.max(0, i - 80);
      let j = scanStart;
      while (j < i - 3) {
        const propId = data[j]!;
        const group = data[j + 1]!;
        if (group === 0x01) {
          applyGroup01Property(propId, view.getUint16(j + 2, true), style);
          j += 4;
        } else if (group === 0x7E) {
          applyGroup7EProperty(propId, view.getUint16(j + 2, true), style);
          j += 4;
        } else {
          j++;
        }
      }

      if (Object.keys(style).length > 0) {
        formats.push({ textStartOffset: textStart, style });
      }
    }
  }

  return formats;
}

function extractV3ParagraphFormats(data: Uint8Array): ParagraphFormat[] {
  const formats: ParagraphFormat[] = [];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let currentStyle: Partial<StyleProperties> = {};
  let counter = 0;

  let i = 0;
  while (i < data.length - 2) {
    const cp = view.getUint16(i, true);

    if (cp >= 0x0001 && cp <= 0x001F) {
      const props = parseV3InlineProperties(data, i + 2);
      Object.assign(currentStyle, props);

      if (cp === 0x0004 || cp === 0x000D) {
        if (Object.keys(currentStyle).length > 0) {
          formats.push({ textStartOffset: counter++, style: { ...currentStyle } });
          currentStyle = {};
        }
      }
      i += 2;
      continue;
    }
    i += 2;
  }

  return formats;
}

function parseV3InlineProperties(data: Uint8Array, offset: number): Partial<StyleProperties> {
  const style: Partial<StyleProperties> = {};
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const end = Math.min(data.length, offset + 48);
  let i = offset;

  while (i + 4 <= end) {
    const propId = data[i]!;
    const group = data[i + 1]!;
    if (group === 0x01) {
      applyGroup01Property(propId, view.getUint16(i + 2, true), style);
      i += 4;
    } else if (group === 0x7E) {
      applyGroup7EProperty(propId, view.getUint16(i + 2, true), style);
      i += 4;
    } else if (group === 0x03) {
      i += 4; // page-level, skip
    } else if (propId === 0x00 && group === 0x00) {
      break;
    } else {
      break;
    }
  }
  return style;
}

// ── Property parsers ──────────────────────────────────────────────────────────

/**
 * Apply a group-0x01 (character-level) tag-value pair to a style object.
 *
 * Known propIds:
 *   0x01 = font size (internal units / INPAGE_UNITS_PER_PT → points)
 *   0x03 = font index
 *   0x04 = alignment (primary, authoritative)
 *   0x0C = alignment (secondary, only used if primary not set)
 *   0x0E = bold (1 = bold)
 */
function applyGroup01Property(
  propId: number,
  val: number,
  style: StyleProperties | Partial<StyleProperties>,
): void {
  switch (propId) {
    case 0x01: {
      const pts = Math.round(val / INPAGE_UNITS_PER_PT);
      if (pts >= 4 && pts <= 400) style.fontSize = pts;
      break;
    }
    case 0x03:
      style.fontIndex = val;
      break;
    case 0x04: {
      const m: Record<number, Alignment> = { 0: 'right', 1: 'center', 2: 'left', 3: 'justify' };
      if (m[val] !== undefined) style.alignment = m[val];
      break;
    }
    case 0x0C: {
      // Secondary alignment — only apply if primary (0x04) hasn't already set it
      if ((style.alignment === undefined || style.alignment === 'right') && val !== 0) {
        const m: Record<number, Alignment> = { 0: 'right', 1: 'center', 2: 'left', 3: 'justify' };
        if (m[val] !== undefined) style.alignment = m[val];
      }
      break;
    }
    case 0x0E:
      style.bold = val !== 0;
      break;
  }
}

/**
 * Apply a group-0x7E (paragraph-level) tag-value pair to a style object.
 *
 * Known propIds:
 *   0x04 = alignment (val=0 means inherit, not right-align)
 *   0x05 = font size / text height
 *   0x0E = bold override
 *   0x10 = italic override
 *   0x15 = color index
 */
function applyGroup7EProperty(
  propId: number,
  val: number,
  style: StyleProperties | Partial<StyleProperties>,
): void {
  switch (propId) {
    case 0x04: {
      // val=0 = inherit from document default, not an explicit right-align
      if (val > 0) {
        const m: Record<number, Alignment> = { 1: 'center', 2: 'left', 3: 'justify' };
        if (m[val] !== undefined) style.alignment = m[val];
      }
      break;
    }
    case 0x05: {
      const pts = Math.round(val / INPAGE_UNITS_PER_PT);
      if (pts >= 4 && pts <= 400) style.fontSize = pts;
      break;
    }
    case 0x0E:
      style.bold = val !== 0;
      break;
    case 0x10:
      style.italic = val !== 0;
      break;
    case 0x15:
      if (val < 256) style.colorIndex = val;
      break;
  }
}

// ── Style lookup ──────────────────────────────────────────────────────────────

/**
 * Find the best-matching style for a given byte offset.
 * Returns the closest preceding ParagraphFormat merged with the document default.
 */
export function getStyleForOffset(
  offset: number,
  formats: ParagraphFormat[],
  defaultStyle: StyleProperties,
): StyleProperties {
  let best: ParagraphFormat | null = null;
  for (const fmt of formats) {
    if (fmt.textStartOffset <= offset) {
      if (!best || fmt.textStartOffset > best.textStartOffset) best = fmt;
    }
  }

  if (!best || Object.keys(best.style).length === 0) return { ...defaultStyle };

  // Only merge defined (non-undefined) overrides
  const defined: Partial<StyleProperties> = {};
  for (const [k, v] of Object.entries(best.style)) {
    if (v !== undefined) (defined as Record<string, unknown>)[k] = v;
  }
  return { ...defaultStyle, ...defined };
}

// ── Main extraction function ──────────────────────────────────────────────────

/**
 * Extract all formatting metadata from an InPage content stream.
 */
export function extractDocumentFormat(data: Uint8Array, version: number): DocumentFormat {
  return {
    fonts: extractFontTable(data),
    colors: extractColorPalette(data),
    defaultStyle: parseDefaultStyle(data),
    paragraphFormats: extractParagraphFormats(data, version),
  };
}

// ── Font name → web font mapping ──────────────────────────────────────────────

/**
 * Map an InPage font name to a CSS font-family string.
 * Falls back to Noto Nastaliq Urdu for any unrecognised Nastaliq-family name.
 */
export function mapFontToWeb(inPageFontName: string): string {
  const exact: Record<string, string> = {
    'InPage Nastaliq':         "'Noto Nastaliq Urdu', serif",
    'Faiz Nastaliq':           "'Noto Nastaliq Urdu', serif",
    'Noori Nastaliq':          "'Noto Nastaliq Urdu', serif",
    'Jameel Noori Nastaleeq':  "'Noto Nastaliq Urdu', serif",
    'Alvi Nastaleeq':          "'Noto Nastaliq Urdu', serif",
    'Mehr Nastaliq':           "'Noto Nastaliq Urdu', serif",
    'Nafees Nastaleeq':        "'Noto Nastaliq Urdu', serif",
    'Gulzar':                  "'Noto Nastaliq Urdu', serif",
    'Arial Unicode MS':        "'Noto Nastaliq Urdu', 'Arial', sans-serif",
    'Arial':                   "'Arial', sans-serif",
    'Times New Roman':         "'Times New Roman', serif",
    'Tahoma':                  "'Tahoma', sans-serif",
    'Verdana':                 "'Verdana', sans-serif",
    'Courier New':             "'Courier New', monospace",
  };

  if (exact[inPageFontName]) return exact[inPageFontName];

  for (const [key, value] of Object.entries(exact)) {
    if (inPageFontName.toLowerCase().includes(key.toLowerCase())) return value;
  }

  if (inPageFontName.toLowerCase().includes('nastal')) {
    return "'Noto Nastaliq Urdu', serif";
  }

  return "'Noto Nastaliq Urdu', serif";
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function matchesUTF16LE(data: Uint8Array, offset: number, pattern: string): boolean {
  for (let j = 0; j < pattern.length; j++) {
    const pos = offset + j * 2;
    if (pos + 1 >= data.length) return false;
    if (data[pos] !== pattern.charCodeAt(j) || data[pos + 1] !== 0x00) return false;
  }
  return true;
}

function readUTF16LEString(data: Uint8Array, offset: number): string {
  let str = '';
  let k = offset;
  while (k < data.length - 1) {
    const cp = data[k]! | (data[k + 1]! << 8);
    if (cp === 0) break;
    if (cp > 127 && cp < 0x0600) break;
    str += String.fromCharCode(cp);
    k += 2;
  }
  return str;
}

function toHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
