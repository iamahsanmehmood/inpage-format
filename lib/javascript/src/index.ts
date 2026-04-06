/**
 * @inpage-format/javascript
 *
 * Reference TypeScript library for decoding InPage .INP binary files.
 *
 * Usage:
 *   import { decodeV1V2, decodeV3, filterParagraphsWithMeta, PAGE_BREAK_MARKER } from '@inpage-format/javascript';
 *
 * The library operates on raw content stream bytes (Uint8Array). You must
 * extract the stream from the OLE2/CFB container yourself using a library
 * such as `cfb` (npm) before calling these functions.
 *
 * @example
 * ```typescript
 * import * as CFB from 'cfb';
 * import { decodeV1V2, decodeV3, filterParagraphsWithMeta } from '@inpage-format/javascript';
 *
 * const cfbFile = CFB.read(new Uint8Array(fileBuffer), { type: 'array' });
 * const entry = CFB.find(cfbFile, '/InPage200');
 * const stream = new Uint8Array(entry.content);
 *
 * const decoded = decodeV1V2(stream);       // or decodeV3(stream) for InPage300
 * const { paragraphs, filteredCount } = filterParagraphsWithMeta(
 *   decoded.paragraphs, decoded.paragraphMeta
 * );
 * ```
 */

export { decodeV1V2, decodeV3, PAGE_BREAK_MARKER } from './decoder.js';
export { filterParagraphs, filterParagraphsWithMeta } from './text-filter.js';
export {
  CHAR_MAP_URDU,
  CHAR_MAP_ARABIC,
  COMPOSITE_SEQUENCES,
  isUrduChar,
  isUrduCodePoint,
} from './char-maps.js';
export type {
  InPageVersion,
  InPageResult,
  DecodeResult,
  ParagraphMeta,
  StyleProperties,
  Alignment,
} from './types.js';

export {
  extractDocumentFormat,
  extractFontTable,
  extractColorPalette,
  parseDefaultStyle,
  extractParagraphFormats,
  getStyleForOffset,
  mapFontToWeb,
} from './format-extractor.js';
export type {
  FontEntry,
  ColorEntry,
  ParagraphFormat,
  DocumentFormat,
} from './format-extractor.js';
