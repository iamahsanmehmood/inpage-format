# Modern Encoding: InPage v3.x (UTF-16LE)

The `InPage300` stream stores text as standard UTF-16LE Unicode, but with a proprietary framing structure that must be decoded before text can be extracted.

## Stream Structure Overview

```
┌─────────────────────────────────────────────────────────┐
│  Header / Formatting Data                               │
│  (font table, color palette, style block)               │
│  Offsets ~0x0000–0x0FFF                                 │
├─────────────────────────────────────────────────────────┤
│  Style Struct Array                                     │
│  N × 8 bytes: [StyleID: uint32, ByteLength: uint32]     │
│  Grows backward from the boundary marker                │
├─────────────────────────────────────────────────────────┤
│  Boundary Marker (6 bytes)                              │
│  FF FF FF FF  0D 00                                     │
├─────────────────────────────────────────────────────────┤
│  Text Data (UTF-16LE)                                   │
│  Paragraphs delimited by U+000D (CR)                    │
│  Control codes interspersed for formatting              │
└─────────────────────────────────────────────────────────┘
```

## Step 1: Find the Boundary Marker

The boundary marker is `FF FF FF FF 0D 00` (6 bytes). It separates the style struct array from the text data.

**Search strategy:**
1. First, scan forward from offset `0x1000` (covers ~95% of files)
2. If not found, fall back to scanning from offset `0` to `0x1000`
3. If still not found, log a warning and return an empty document

```
textStart = boundaryMarkerOffset + 6
```

**Why start at 0x1000?**
The header/formatting region is typically 3–10 KB. Starting the scan at 0x1000 (4096 bytes) skips this region efficiently. The marker has never been observed below 0x800 in tested files.

## Step 2: Read the Style Struct Array

Immediately **before** the boundary marker is an array of 8-byte structs:

```
struct TextSpan {
  styleId:    uint32 LE   // Style/formatting identifier
  byteLength: uint32 LE   // Byte length of the corresponding UTF-16LE text span
}
```

The array grows **backward** from the boundary marker. Read structs at:
- `boundaryMarkerOffset - 8`
- `boundaryMarkerOffset - 16`
- `boundaryMarkerOffset - 24`
- …continue until styleId > 1000 OR byteLength > 100000 OR both are 0

The structs must be **reversed** after collection to read them in document order.

**Struct validation rules:**
- `styleId > 1000` → stop collecting (invalid / not a struct)
- `byteLength > 100000` → stop collecting (sanity bound)
- `styleId == 0 AND byteLength == 0` → stop collecting (null terminator)

**Important:** These structs map to **text spans**, not full paragraphs. A single paragraph may span multiple structs (e.g., inline bold within a sentence), and a single struct may span multiple paragraphs (e.g., a large section with consistent styling).

## Step 3: Decode Text Spans

For each struct in order:
1. Read `byteLength` bytes from the current text position
2. Decode as UTF-16LE code points
3. For each code point:
   - `0x000D` → end of paragraph: flush `currentParagraphText`, push to output
   - Control codes `0x0001`–`0x001F` (except `0x000D`, `0x0009`, `0x000A`) → formatting injection (see below)
   - `0x007E` → formatting injection
   - All others ≥ `0x0020`, plus tab `0x0009` and LF `0x000A` → append to current paragraph

## Control Code Filtering

V3 files interleave **formatting records** into the text stream using a length-prefixed scheme:

```
[controlCode: uint16] [recordLength: uint16] [recordData: byte[recordLength]]
```

When a code point `cp` satisfies: `cp >= 0x0001 AND cp <= 0x001F AND cp != 0x000D AND cp != 0x0009 AND cp != 0x000A` OR `cp == 0x007E`:

```
recordLength = readUint16LE(currentOffset + 2)
skip (4 + recordLength) bytes
```

This skips the entire record (2-byte code + 2-byte length + data bytes).

**Example:**
```
Text stream (hex): 28 06  01 00  06 00  AA BB CC DD EE FF  2C 06
                   ↑ Urdu  ↑ ctrl code  ↑ len=6  ↑ 6 bytes data  ↑ Urdu
                     char   (skip this entire record)                char
```

## Text Extraction Loop (Pseudocode)

```python
def decode_v3(structs, text_data: bytes) -> list[str]:
    paragraphs = []
    current = ""
    pos = 0

    for span in structs:
        chunk = text_data[pos : pos + span.byte_length]
        view = memoryview(chunk)
        i = 0

        while i + 1 < len(chunk):
            cp = int.from_bytes(chunk[i:i+2], 'little')

            # Control code injection (skip record)
            is_ctrl = (0x0001 <= cp <= 0x001F and cp not in (0x000D, 0x0009, 0x000A)) or cp == 0x007E
            if is_ctrl and i + 3 < len(chunk):
                record_len = int.from_bytes(chunk[i+2:i+4], 'little')
                i += 4 + record_len
                continue

            if cp == 0x000D:               # Paragraph end
                current = current.strip()
                if current: paragraphs.append(current)
                current = ""
            elif cp >= 0x0020 or cp in (0x0009, 0x000A):
                current += chr(cp)

            i += 2

        pos += span.byte_length

    if current.strip():
        paragraphs.append(current.strip())

    return paragraphs
```

## Style ID Usage

The `styleId` in each struct is an index into InPage's internal style sheet. The mapping of style IDs to formatting properties (font size, alignment, bold, etc.) is documented in `specs/06-formatting-structures.md`. For pure text extraction, style IDs can be ignored.

## Paragraph Metadata

For formatting-aware extraction, track:
- `paragraphStartOffset` — byte offset in text data where this paragraph's text began
- `paragraphStartStyleId` — style ID of the span that started this paragraph
- `paragraphEndOffset` — offset where the `0x000D` was found

This allows correlating paragraphs with formatting information extracted from the header region.

## Known Unknowns

- **Header structure** — The first ~4 KB of the stream contains font tables, color palettes, and default style properties. The structure is partially documented in `specs/06-formatting-structures.md` but is not fully understood.
- **Page breaks in V3** — Page break handling in V3 has not been confirmed from binary evidence. In tested files, page breaks appear to be implicit (calculated from content height) rather than explicit bytes.
- **Multiple text sections** — Some V3 files may contain multiple text blocks separated by additional boundary markers. This has not been observed in tested files but cannot be ruled out.
- **`0x007E` records** — The `0x007E` control code triggers the same length-skip as `0x0001–0x001F`, but its semantic meaning is unknown.
