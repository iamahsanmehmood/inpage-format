/**
 * InPage Text Decoder
 *
 * Two decoding paths:
 *   v1/v2 — proprietary 0x04-prefix byte-pair encoding (decodeV1V2)
 *   v3    — UTF-16LE with struct array and control codes (decodeV3)
 *
 * Neither path performs OLE2/CFB parsing. The caller must extract the raw
 * content stream bytes from the container using a library such as `cfb`
 * (npm) or OpenMcdf (.NET) and pass the Uint8Array here.
 *
 * See specs/03-encoding-legacy.md and specs/04-encoding-v3.md.
 */

import { CHAR_MAP_URDU, COMPOSITE_SEQUENCES } from './char-maps.js';
import type { DecodeResult, ParagraphMeta } from './types.js';

/** Sentinel string emitted in place of a page break byte. */
export const PAGE_BREAK_MARKER = '___PAGE_BREAK___';

// ─── V1 / V2 Decoder ──────────────────────────────────────────────────────────

/**
 * Decode an InPage v1.x or v2.x content stream.
 *
 * Encoding: 0x04 + charByte pairs. Composite sequences (4 bytes) must be
 * matched before single-byte lookups. Unknown control bytes between character
 * sequences trigger the pendingSpace word-boundary recovery heuristic.
 */
export function decodeV1V2(data: Uint8Array): DecodeResult {
  const paragraphs: string[] = [];
  const pageBreakIndices: number[] = [];
  const paragraphMeta: ParagraphMeta[] = [];

  let current = '';
  let paragraphStart = 0;
  // pendingSpace: a non-0x04 control byte appeared after decoded text,
  // suggesting a word boundary. The next character gets a leading space.
  let pendingSpace = false;
  let i = 0;

  const flush = (endOffset: number) => {
    const trimmed = current.trim();
    if (trimmed) {
      paragraphs.push(trimmed);
      paragraphMeta.push({
        text: trimmed,
        startOffset: paragraphStart,
        endOffset,
        isPageBreak: false,
      });
    }
    current = '';
    pendingSpace = false;
  };

  while (i < data.length) {
    const byte = data[i]!;

    // Page break (Form Feed 0x0C)
    if (byte === 0x0C) {
      flush(i);
      paragraphs.push(PAGE_BREAK_MARKER);
      pageBreakIndices.push(paragraphs.length - 1);
      paragraphMeta.push({
        text: PAGE_BREAK_MARKER,
        startOffset: i,
        endOffset: i + 1,
        isPageBreak: true,
      });
      i++;
      paragraphStart = i;
      continue;
    }

    // Paragraph break (CR 0x0D)
    if (byte === 0x0D) {
      flush(i);
      i += (i + 1 < data.length && data[i + 1] === 0x0A) ? 2 : 1;
      paragraphStart = i;
      continue;
    }

    // Soft line break (LF 0x0A)
    if (byte === 0x0A) {
      if (current.length > 0 && !current.endsWith(' ')) current += ' ';
      pendingSpace = false;
      i++;
      continue;
    }

    // Tab
    if (byte === 0x09) {
      current += '\t';
      pendingSpace = false;
      i++;
      continue;
    }

    // 0x04 prefix — character encoding
    if (byte === 0x04 && i + 1 < data.length) {
      const charByte = data[i + 1]!;

      if (current.length === 0) paragraphStart = i;

      // Insert word-boundary space if flagged
      if (pendingSpace && current.length > 0 && !current.endsWith(' ')) {
        current += ' ';
      }
      pendingSpace = false;

      // Check composite first (4-byte sequence)
      if (i + 3 < data.length && data[i + 2] === 0x04) {
        const modByte = data[i + 3]!;
        const key = `${charByte.toString(16).toUpperCase().padStart(2, '0')}_${modByte.toString(16).toUpperCase().padStart(2, '0')}`;
        const composite = COMPOSITE_SEQUENCES.get(key);
        if (composite !== undefined) {
          current += composite;
          i += 4;
          continue;
        }
      }

      // Single character mapping
      const ch = CHAR_MAP_URDU.get(charByte);
      if (ch !== undefined) current += ch;
      i += 2;
      continue;
    }

    // Unknown control byte — signals a potential word boundary
    if (current.length > 0) pendingSpace = true;
    i++;
  }

  flush(data.length);
  return { paragraphs, pageBreakIndices, paragraphMeta };
}

// ─── V3 Decoder ───────────────────────────────────────────────────────────────

interface TextSpan {
  styleId: number;
  byteLength: number;
}

/**
 * Decode an InPage v3 content stream (UTF-16LE with struct array).
 *
 * Strategy:
 *   1. Locate the boundary marker (FF FF FF FF 0D 00) that separates
 *      the style struct array from the text data.
 *   2. Read 8-byte [styleId, byteLength] structs backward from the marker.
 *   3. Iterate spans in order, decoding UTF-16LE and splitting on CR (0x000D).
 *
 * See specs/04-encoding-v3.md for full documentation.
 */
export function decodeV3(data: Uint8Array): DecodeResult {
  const paragraphs: string[] = [];
  const pageBreakIndices: number[] = [];
  const paragraphMeta: ParagraphMeta[] = [];

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Step 1: Find boundary marker FF FF FF FF 0D 00
  let arrayEnd = -1;
  let textStart = -1;

  const findMarker = (from: number, to: number): boolean => {
    for (let i = from; i < to - 5; i += 2) {
      if (view.getUint32(i, true) === 0xFFFFFFFF &&
          view.getUint16(i + 4, true) === 0x000D) {
        arrayEnd = i;
        textStart = i + 6;
        return true;
      }
    }
    return false;
  };

  // Typical location: scan from 0x1000 onwards
  if (!findMarker(0x1000, data.length)) {
    // Fallback: scan from beginning
    console.warn('[decodeV3] Boundary marker not found at 0x1000+, scanning from start...');
    if (!findMarker(0, Math.min(data.length, 0x1000))) {
      // Last resort: some V3 variants (e.g. multi-page InPage 3.x) store text
      // directly without the struct-array/boundary-marker format. In this case
      // scan the entire stream for the largest contiguous UTF-16LE Urdu text
      // region and decode it as plain paragraphs.
      console.warn('[decodeV3] Boundary marker not found. Trying direct UTF-16LE scan fallback...');
      return decodeV3Fallback(data);
    }
  }

  // Step 2: Read struct array backward from boundary marker
  const structs: TextSpan[] = [];
  let pos = arrayEnd - 8;
  while (pos >= 0) {
    const styleId = view.getUint32(pos, true);
    const byteLength = view.getUint32(pos + 4, true);

    if (styleId > 1000 || byteLength > 100_000 || (styleId === 0 && byteLength === 0)) {
      break;
    }
    structs.unshift({ styleId, byteLength });
    pos -= 8;
  }

  // Step 3: Decode spans into paragraphs
  let cursor = textStart;
  let currentText = '';
  let paraStart = cursor;
  let paraStyleId = structs[0]?.styleId ?? 0;

  for (const span of structs) {
    if (cursor + span.byteLength > data.length) break;

    const chunk = data.subarray(cursor, cursor + span.byteLength);
    const chunkView = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    let ci = 0;

    while (ci + 1 < chunk.length) {
      const cp = chunkView.getUint16(ci, true);

      // Control code injection — skip [code(2)] [length(2)] [data(length)] block
      const isCtrl = (cp >= 0x0001 && cp <= 0x001F &&
                      cp !== 0x000D && cp !== 0x0009 && cp !== 0x000A) ||
                     cp === 0x007E;
      if (isCtrl && ci + 3 < chunk.length) {
        const recordLen = chunkView.getUint16(ci + 2, true);
        ci += 4 + recordLen;
        continue;
      }

      if (cp === 0x000D) {
        // End of paragraph
        const trimmed = currentText.replace(/\r/g, '').trim();
        paragraphs.push(trimmed);
        paragraphMeta.push({
          text: trimmed,
          startOffset: paraStart,
          endOffset: cursor + ci,
          isPageBreak: false,
          styleId: paraStyleId,
        });
        currentText = '';
        paraStart = cursor + ci + 2;
        paraStyleId = span.styleId;
      } else if (cp >= 0x0020 || cp === 0x0009 || cp === 0x000A) {
        if (currentText.length === 0) paraStyleId = span.styleId;
        currentText += String.fromCharCode(cp);
      }

      ci += 2;
    }

    cursor += span.byteLength;
  }

  // Flush remaining text
  if (currentText.trim().length > 0) {
    const trimmed = currentText.trim();
    paragraphs.push(trimmed);
    paragraphMeta.push({
      text: trimmed,
      startOffset: paraStart,
      endOffset: cursor,
      isPageBreak: false,
      styleId: paraStyleId,
    });
  }

  return { paragraphs, pageBreakIndices, paragraphMeta };
}

// ─── V3 Fallback Decoder ──────────────────────────────────────────────────────

/**
 * Fallback for V3 files that lack the standard FF FF FF FF 0D 00 boundary marker.
 *
 * Some InPage 3.x variants store text in multiple page-sized blocks rather than
 * a single linearised stream. Strategy: find all contiguous UTF-16LE Urdu/Arabic
 * text regions (≥ 20 consecutive Urdu code points), decode each as plain
 * paragraphs split on CR, and concatenate the results.
 *
 * Yields text without style metadata but prevents blank output.
 */
function decodeV3Fallback(data: Uint8Array): DecodeResult {
  const paragraphs: string[] = [];
  const pageBreakIndices: number[] = [];
  const paragraphMeta: ParagraphMeta[] = [];

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const MIN_RUN = 20; // min consecutive Urdu chars to qualify as real text

  let runStart = -1;
  let urduCount = 0;

  const flushRegion = (from: number, to: number) => {
    let current = '';
    let paraStart = from;

    for (let i = from; i < to - 1; i += 2) {
      const cp = view.getUint16(i, true);

      if (cp === 0x000D) {
        const trimmed = current.trim();
        if (trimmed) {
          paragraphs.push(trimmed);
          paragraphMeta.push({ text: trimmed, startOffset: paraStart, endOffset: i, isPageBreak: false });
        }
        current = '';
        paraStart = i + 2;
        continue;
      }

      // Skip embedded control records
      const isCtrl = (cp >= 0x0001 && cp <= 0x001F && cp !== 0x0009 && cp !== 0x000A) || cp === 0x007E;
      if (isCtrl && i + 3 < to) {
        const recLen = view.getUint16(i + 2, true);
        i += 2 + recLen;
        continue;
      }

      if (cp >= 0x0020 || cp === 0x0009 || cp === 0x000A) {
        current += String.fromCharCode(cp);
      }
    }

    const trimmed = current.trim();
    if (trimmed) {
      paragraphs.push(trimmed);
      paragraphMeta.push({ text: trimmed, startOffset: paraStart, endOffset: to, isPageBreak: false });
    }
  };

  for (let i = 0; i < data.length - 1; i += 2) {
    const cp = view.getUint16(i, true);
    const isUrduLike = (cp >= 0x0600 && cp <= 0x06FF) || cp === 0x0020 || cp === 0x000D || cp === 0x0009;

    if (isUrduLike) {
      if (runStart === -1) runStart = i;
      if (cp >= 0x0600 && cp <= 0x06FF) urduCount++;
    } else {
      if (runStart !== -1 && urduCount >= MIN_RUN) flushRegion(runStart, i);
      runStart = -1;
      urduCount = 0;
    }
  }

  if (runStart !== -1 && urduCount >= MIN_RUN) flushRegion(runStart, data.length);

  console.warn(`[decodeV3Fallback] Recovered ${paragraphs.length} paragraphs via direct UTF-16LE scan.`);
  return { paragraphs, pageBreakIndices, paragraphMeta };
}
