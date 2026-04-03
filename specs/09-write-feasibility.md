# Feasibility Report: Generating InPage .INP Files

**Date:** April 2026
**Scope:** Can we write `.INP` files from plain text or PDF source material?
**Verdict summary:** ✅ Text → INP (basic) is feasible now. ⚠️ Full formatting is hard. ❌ PDF → INP is very hard.

---

## 1. Background

All prior work on InPage reverse engineering has focused on *reading* `.INP` files. This report
asks the opposite question: **can we generate valid `.INP` files** that InPage itself can open?

Two target workflows:

| Workflow | Goal |
|---|---|
| **Text → INP** | Convert a plain Unicode Urdu/Arabic text file into a `.INP` document |
| **PDF → INP** | Extract Urdu/Arabic text from a PDF and produce an `.INP` document |

---

## 2. What a Valid .INP File Requires

A valid `.INP` file has three layers, each with its own complexity:

```
Layer 1: OLE2/CFB Container
  └─ Layer 2: InPage Content Stream  (InPage200 or InPage300)
       └─ Layer 3: Formatting Structures (styles, fonts, colors)
```

### Layer 1 — OLE2 Container

The outer container follows the OLE2/CFB standard (same as `.doc`, `.xls`). It has a fixed
512-byte sector structure with FAT chains and a directory tree.

**Status:** ✅ Fully handled by existing libraries.

| Language | Library | Notes |
|---|---|---|
| JavaScript / TypeScript | `cfb` (SheetJS) | Already used for reading — supports writing too |
| C# / .NET | `OpenMcdf` | Already used for reading — supports writing too |
| Python | `compoundfiles` or `olefile` | Read-only; use `compoundfiles` fork for write |
| Go | `github.com/richardlehane/mscfb` | Read-only — would need raw OLE2 implementation |

**Effort:** Low — drop-in API calls, no format research needed.

---

### Layer 2 — Content Stream

This is where Urdu text lives. Two sub-formats exist.

#### V1/V2 Stream (InPage 1.x / 2.x — `InPage200`)

Text is stored as **byte pairs**: every Urdu character is `0x04 XX` where `XX` is a lookup index.

**What we know:**

```
Character encoding:   FULLY KNOWN — 110+ Unicode ↔ byte mappings documented
Composite sequences:  FULLY KNOWN — 4 composites (أ آ ؤ یئ), must check before single chars
Paragraph breaks:     FULLY KNOWN — 0x0D byte
Page breaks:          FULLY KNOWN — 0x0C byte
Word spacing:         FULLY KNOWN — non-0x04 control bytes signal word boundaries
```

**For writing**, the reverse lookup is trivial:

```
Unicode → V1/V2 bytes:
  ا  (U+0627)  →  04 81
  ب  (U+0628)  →  04 82
  آ  (U+0622)  →  04 81 04 B3  (composite — must check BEFORE single)
  ...
  paragraph end  →  0D
  word space     →  20 (or any non-04 byte)
```

**What we do NOT know:**

- Formatting byte markers (`0x01`, `0x03` sequences) — can be omitted for plain text
- Some rare character codes (`0xE3`, `0xE5`, `0xF0`, `0xF4`) — not needed for standard Urdu

**Verdict:** ✅ Writing plain Urdu text to V1/V2 stream is fully feasible today.

---

#### V3 Stream (InPage 3.x — `InPage300`)

Text is **UTF-16LE**, preceded by a struct array and header block.

**What we know:**

```
Text encoding:      FULLY KNOWN — standard UTF-16LE, no custom mapping
Paragraph breaks:   FULLY KNOWN — U+000D (CR) as 2 bytes: 0D 00
Struct array:       FULLY KNOWN — [styleId: u32 LE][byteLength: u32 LE] × N, written backward
Boundary marker:    FULLY KNOWN — FF FF FF FF 0D 00 (6 bytes between array and text)
```

**Minimal valid V3 stream layout:**

```
[Header region — COPY FROM TEMPLATE]
[Struct array — write in reverse order]  ← calculated from paragraph lengths
[FF FF FF FF 0D 00]                       ← boundary marker
[UTF-16LE text with 0D 00 paragraph breaks]
```

**What we do NOT know:**

| Unknown | Impact on writing |
|---|---|
| Header region (font tables, color palette, style sheet) | **Blocking** — must copy from template file |
| Style IDs meaning (0–1000) | Partial — use ID `1` (default style) for all paragraphs |
| V3 control code payload format | Can be omitted for plain text |

**Verdict:** ⚠️ Writing plain text to V3 is feasible **if** we use a template file's header region.
Without a template, the header structure is too incomplete to construct from scratch.

---

### Layer 3 — Formatting (Fonts, Bold, Alignment, etc.)

This is the hardest layer.

| Feature | V1/V2 | V3 | Effort |
|---|---|---|---|
| Font name | Pattern-matched in header — write not documented | Header region — unknown | High |
| Font size | `[0x01 0x01 size*8.33 LE]` byte sequence — known | Style block — partial | Medium |
| Alignment (RTL/LTR) | `[0x03 0x7E 0x00 0x00]` — known | Style ID maps — partial | Medium |
| Bold | `[0x0E 0x01 0x01 0x00]` — known | Style block — partial | Medium |
| Italic | Not confirmed | Not confirmed | Very High |
| Page size / margins | Unknown | Unknown | Very High |
| Tables, columns | Unknown | Unknown | Not feasible |
| Embedded images | Unknown | Unknown | Not feasible |

**Verdict:** ❌ Generating arbitrary formatting from scratch is not currently feasible.
For a simple writer (unformatted Urdu text), formatting can be hardcoded or copied from a template.

---

## 3. Workflow Feasibility

### 3A — Text → INP

```
Input:  Plain text file (UTF-8 Urdu/Arabic)
Output: .INP file openable in InPage 2.x or 3.x
```

#### Feasibility: ✅ Achievable

**V2 target (recommended for widest compatibility):**

1. Read Unicode text, split on newlines → paragraphs
2. For each paragraph, encode each character to `0x04 XX` using the reverse lookup table
   - Check composites first (4-byte sequences)
   - Insert `0x20` (space) between words
   - Append `0x0D` at paragraph end
3. Wrap in OLE2 container with stream name `InPage200`
4. Done — InPage 2.x and 3.x can both open it

**V3 target (InPage 3.x only):**

1. Read Unicode text, split on newlines → paragraphs
2. Encode as UTF-16LE with `0x0D 0x00` paragraph breaks
3. Build struct array: one entry per paragraph `[styleId=1, byteLength=paragraphBytes]`, written in reverse
4. Insert boundary marker `FF FF FF FF 0D 00` between array and text
5. Prepend a minimal header (copy from a known-good V3 template file, first ~0x1000 bytes)
6. Wrap in OLE2 container with stream name `InPage300`

**Limitations of plain text writer:**

- No bold, italic, font size — everything in default InPage style
- No page size control — InPage will use its default A4/letter
- No column layout, tables, images

**Estimated implementation effort:**

| Component | Effort |
|---|---|
| Reverse character map (Unicode → V2 bytes) | 1–2 days |
| V2 stream builder | 1 day |
| OLE2 wrapper (using cfb/OpenMcdf) | 0.5 day |
| V3 stream builder (with template header) | 2–3 days |
| Tests + validation (open in InPage) | 1–2 days |
| **Total (V2 only)** | **~3–4 days** |
| **Total (V2 + V3)** | **~6–8 days** |

---

### 3B — PDF → INP

```
Input:  PDF file (containing Urdu/Arabic text)
Output: .INP file with extracted text
```

#### Feasibility: ❌ Very Difficult

PDF → INP breaks into two sub-problems, each with serious challenges:

**Sub-problem 1: Extract Urdu/Arabic text from PDF**

Urdu/Arabic PDF text extraction is notoriously unreliable because:

| Problem | Detail |
|---|---|
| **Glyph ordering** | PDFs store glyphs in visual (left-to-right) order on screen, not logical reading order. A word like `کتاب` may be stored as `ب ا ت ک` internally. |
| **Custom font encodings** | InPage-exported PDFs often use private-use-area Unicode (U+E000–U+F8FF) mapped to Urdu glyphs via embedded font tables. The mapping is per-font, per-file. |
| **Missing ToUnicode maps** | Many Urdu PDFs (especially those exported from InPage) have no `ToUnicode` table. PDF text extraction tools return garbage or nothing. |
| **Ligatures** | Arabic shaping ligatures (lam-alef, etc.) are stored as single glyphs with no standard Unicode. |
| **Ligature reordering** | Even when text is extracted, RTL reordering is often wrong. |

**Known tools and their limits:**

| Tool | Urdu/Arabic result |
|---|---|
| `pdfjs-dist` | Fails on most InPage-exported PDFs (no ToUnicode) |
| `pdfplumber` / `pdfminer` | Same — fails without ToUnicode |
| `Tesseract OCR` (Arabic model) | Works on scanned PDFs — 70–80% accuracy for clean Urdu |
| `EasyOCR` | Better than Tesseract for Urdu — 80–90% on clean scans |
| `Google Vision API` | 90%+ on clean scans, costs money per page |
| Manual `ToUnicode` reverse-mapping | Works only if the PDF has the font's cmap table |

**Sub-problem 2: INP formatting from PDF structure**

Even if text is extracted cleanly:
- PDF page coordinates (x, y, font-size) → InPage paragraph/style mapping is not documented
- InPage column layout structures are unknown
- Reproducing headings, body text, captions as InPage styles is not feasible

**Verdict for PDF → INP:**

| Scenario | Feasibility |
|---|---|
| Scanned Urdu PDF → plain text INP (via OCR) | ⚠️ Partially feasible (70–90% text accuracy, no formatting) |
| Digitally-typed Urdu PDF (with ToUnicode) → INP | ⚠️ Feasible only if PDF has proper Unicode mapping (rare) |
| InPage-exported PDF → INP round-trip | ❌ Not feasible (custom font encodings, no ToUnicode) |
| Full formatting preserved PDF → INP | ❌ Not feasible |

---

## 4. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| InPage rejects the generated file (corrupt OLE2) | Low | High | Use battle-tested OLE2 library, test against multiple InPage versions |
| InPage opens file but shows garbage text | Medium | High | Write round-trip tests: decode the output with the existing decoder |
| V3 header region causes InPage to crash | Medium | Medium | Use template header from known-good file |
| PDF text extraction fails for most files | High | High | Focus on V2 writer first, skip PDF path |
| Character composites encoded wrong | Low | Medium | Covered by existing 67 JS / 54 C# tests |
| Unknown bytes in V1/V2 cause InPage to reject file | Low | Low | Can be omitted — no known checksums in stream |

---

## 5. Recommendation

### Phase 1 — Text → V2 INP Writer (Do This First)

**Scope:** Plain Unicode Urdu/Arabic text → InPage 2.x compatible `.INP` file

**Why V2 over V3:**
- V2 requires no template header — stream can be constructed entirely from first principles
- V2 files are readable by InPage 2.x, 3.x — widest compatibility
- V2 reverse character map is 100% known today

**Deliverables:**
- `encodeV1V2(text: string): Uint8Array` function (TypeScript)
- `EncodeV1V2(text: string): byte[]` method (C#)
- OLE2 wrapper producing a valid `.INP` file
- Integration test: encode → decode → compare original text

**Estimated effort:** 3–4 days

---

### Phase 2 — Text → V3 INP Writer (After Phase 1)

**Scope:** Plain Unicode Urdu/Arabic text → InPage 3.x compatible `.INP` file

**Requires:**
- A "blank" InPage 3.x template file with minimal styling (use an existing .inp as the header template)
- Struct array builder
- UTF-16LE encoder

**Estimated effort:** 4–5 additional days

---

### Phase 3 — PDF → INP (Scanned documents only)

**Scope:** Scanned Urdu PDF → OCR → plain text → INP (via Phase 1 writer)

**Approach:**
1. OCR the PDF pages using Tesseract (Arabic + Urdu models) or EasyOCR
2. Post-process: remove noise, fix common OCR errors for Nastaliq script
3. Feed extracted text to the Phase 1 V2 writer

**Limitations to document clearly:**
- 70–90% text accuracy (OCR errors)
- No formatting preserved — all paragraphs in default InPage style
- Will not work on non-scanned (digitally-generated) PDFs with custom font encodings

**Estimated effort:** 5–7 additional days

---

### What NOT to build

| Feature | Reason |
|---|---|
| PDF → INP with formatting | Formatting structures not fully documented |
| InPage-exported PDF → INP round-trip | Custom font encoding blocks text extraction |
| V3 writer with full font/style control | V3 header encoding unknown |
| V1/V2 writer with bold, font size | Formatting byte sequences partially known but not validated |

---

## 6. Summary Table

| Feature | Feasible? | Effort | Blocker |
|---|---|---|---|
| Text → V2 INP (plain text) | ✅ Yes | 3–4 days | None |
| Text → V3 INP (with template) | ✅ Yes | 4–5 days | Need template .INP file |
| Text → INP with bold/font-size | ⚠️ Partial | +3 days | Formatting sequences partially known |
| Text → INP with full formatting | ❌ No | Unknown | Header structures unknown |
| Scanned PDF → INP (via OCR) | ⚠️ Partial | +5–7 days | OCR accuracy 70–90% |
| Digital PDF → INP (with ToUnicode) | ⚠️ Rare | +3 days | Only works on well-formed PDFs |
| InPage PDF → INP round-trip | ❌ No | — | Custom font encoding |
| Tables, columns, images | ❌ No | — | Layout structures unknown |

---

## 7. Next Steps

To proceed with Phase 1:

1. Build `encodeV2(text: string): Uint8Array` — reverse of existing `decodeV1V2`
2. Add `buildInpFile(text: string): Uint8Array` using `cfb.utils.aoa_to_sheet`-style API
3. Write a round-trip test: `buildInpFile(text)` → `decodeV1V2()` → compare
4. Manual validation: open the output file in InPage 3.x on Windows

No new format research is required for Phase 1. The character map in
`specs/05-character-maps.md` is sufficient.
