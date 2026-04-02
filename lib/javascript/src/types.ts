/**
 * Public types for the inpage-format JavaScript library.
 */

/** InPage document version, determined by stream name in the OLE2 container. */
export type InPageVersion = 1 | 2 | 3;

/** Metadata for a single decoded paragraph. */
export interface ParagraphMeta {
  /** The decoded text of this paragraph. */
  text: string;
  /** Byte offset in the content stream where this paragraph begins. */
  startOffset: number;
  /** Byte offset in the content stream where this paragraph ends. */
  endOffset: number;
  /** True if this is a page break marker, not actual text. */
  isPageBreak: boolean;
  /** V3 only: style ID from the struct array for this paragraph's first span. */
  styleId?: number;
}

/** Result of decoding an InPage content stream. */
export interface DecodeResult {
  /** All paragraphs, including PAGE_BREAK_MARKER entries. */
  paragraphs: string[];
  /** Indices in paragraphs[] where page breaks occur. */
  pageBreakIndices: number[];
  /** Per-paragraph metadata aligned with paragraphs[]. */
  paragraphMeta: ParagraphMeta[];
}

/** Result of the full parse + filter pipeline. */
export interface InPageResult {
  /** InPage version (1, 2, or 3). */
  version: InPageVersion;
  /** Filtered, deduplicated paragraphs ready for display. */
  paragraphs: string[];
  /** Per-paragraph metadata for filtered paragraphs. */
  paragraphMeta: ParagraphMeta[];
  /** Number of paragraphs dropped by the noise filter. */
  filteredCount: number;
}

/** Text alignment values. */
export type Alignment = 'right' | 'center' | 'left' | 'justify';

/** Formatting properties for a paragraph or character run. */
export interface StyleProperties {
  fontSize: number;
  fontIndex: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  colorIndex: number;
  alignment: Alignment;
  lineSpacing: number;
  indentFirstLine?: number;
  indentLeft?: number;
  indentRight?: number;
}
