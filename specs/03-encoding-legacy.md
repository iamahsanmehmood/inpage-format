# Legacy Encoding: InPage v1.x / v2.x

The `InPage100` and `InPage200` streams use a proprietary 2-byte character encoding. This document describes how to decode it.

## Encoding Scheme

Each Urdu/Arabic character is stored as a **2-byte pair**:

```
Byte 1: 0x04 (prefix marker)
Byte 2: Character index (maps to Unicode via lookup table)
```

Example:
```
04 81 → U+0627 ا (Alef)
04 82 → U+0628 ب (Beh)
04 A4 → U+06CC ی (Farsi Yeh)
04 F3 → U+06D4 ۔ (Urdu Full Stop)
```

ASCII text and structural bytes appear directly without the `0x04` prefix.

## Composite Sequences (4-byte)

Certain characters require a **modifier byte** following the base character. These composites are 4 bytes:

```
04 <base> 04 <modifier>
```

**Critical rule:** Composites MUST be checked BEFORE single-byte lookups. If you check single-bytes first, you will emit the base character and then misinterpret the modifier.

| Sequence | Unicode | Character | Description |
|---|---|---|---|
| `04 81 04 BF` | U+0623 | أ | Alef + Hamza Above |
| `04 81 04 B3` | U+0622 | آ | Alef + Madda Above |
| `04 A2 04 BF` | U+0624 | ؤ | Wao + Hamza Above |
| `04 A4 04 BF` | U+06CC U+0626 | یئ | Farsi Yeh + Hamza |

> The composite key format used in the reference implementation: `"<baseByte_HEX>_<modifierByte_HEX>"` e.g. `"81_BF"`.

## Control Characters

These bytes appear directly (without `0x04` prefix) and control document structure:

| Byte | Name | Action |
|---|---|---|
| `0x0D` | Carriage Return | End of paragraph |
| `0x0A` | Line Feed | Soft line break (append space if not already trailing) |
| `0x0D 0x0A` | CR+LF | End of paragraph (counts as one break) |
| `0x0C` | Form Feed | Page break — emit `PAGE_BREAK_MARKER` and start new paragraph |
| `0x09` | Tab | Append tab character |

## Word Spacing Recovery (`pendingSpace`)

InPage v1/v2 does **not** use space characters between words. Instead, word boundaries are encoded implicitly: when a non-`0x04` control byte appears between two character sequences, it signals a word boundary.

**Algorithm:**

```
pendingSpace = false

for each byte in stream:
  if byte == 0x04:
    if pendingSpace AND currentParagraph is not empty AND not ends with space:
      append ' ' to currentParagraph
    pendingSpace = false
    decode character using charByte
    append to currentParagraph

  elif byte is paragraph/page break:
    flush current paragraph
    pendingSpace = false

  else (unknown control byte):
    if currentParagraph is not empty:
      pendingSpace = true   ← word boundary hint
    skip byte
```

Without this recovery, words merge: `کاروبارمیں` instead of `کاروبار میں`.

## Paragraph Assembly

```
currentParagraph = ""
paragraphStartOffset = 0
pendingSpace = false
i = 0

while i < data.length:
  byte = data[i]

  if byte == 0x0C:                         // Page break
    flush currentParagraph
    emit PAGE_BREAK_MARKER
    pendingSpace = false
    i += 1

  elif byte == 0x0D:                       // Paragraph break
    flush currentParagraph
    if data[i+1] == 0x0A: i += 2          // CR+LF pair
    else: i += 1
    pendingSpace = false

  elif byte == 0x04 and i+1 < length:     // Character
    charByte = data[i+1]
    if pendingSpace and text exists:
      currentParagraph += ' '
    pendingSpace = false
    check composite first (4-byte)
    else lookup CHAR_MAP_URDU[charByte]
    i += 2 (or 4 for composite)

  else:                                    // Unknown control
    if currentParagraph: pendingSpace = true
    i += 1
```

## Arabic Mode

Some InPage documents use Arabic-specific glyph variants. The `DocumentInfo` stream or file-level flags can indicate Arabic mode, but this is not always reliable. When Arabic mode is active, the following byte values map to **different** Unicode code points than in Urdu mode:

| Byte | Urdu mode | Arabic mode |
|---|---|---|
| `0x9C` | U+06A9 ک (Keheh) | U+0643 ك (Arabic Kaf) |
| `0xA4` | U+06CC ی (Farsi Yeh) | U+064A ي (Arabic Yeh) |
| `0xA6` | U+06C1 ہ (Heh Goal) | U+0647 ه (Arabic Heh) |
| `0x81`–`0x85` | Urdu letters | U+0665–U+0669 (Arabic-Indic digits 5–9) |

Arabic-Indic digits 0–4 use byte codes `0x7C`–`0x80` which do not conflict with letter mappings.

## Decoding Pseudocode (Complete)

```python
def decode_legacy(data: bytes) -> list[str]:
    paragraphs = []
    current = ""
    pending_space = False
    i = 0

    while i < len(data):
        b = data[i]

        if b == 0x0C:          # page break
            if current.strip(): paragraphs.append(current.strip())
            paragraphs.append("___PAGE_BREAK___")
            current = ""; pending_space = False; i += 1

        elif b == 0x0D:        # paragraph break
            if current.strip(): paragraphs.append(current.strip())
            current = ""; pending_space = False
            i += 2 if i+1 < len(data) and data[i+1] == 0x0A else i + 1

        elif b == 0x0A:        # soft line break
            if current and not current.endswith(' '): current += ' '
            pending_space = False; i += 1

        elif b == 0x04 and i+1 < len(data):    # character
            cb = data[i+1]
            if pending_space and current and not current.endswith(' '):
                current += ' '
            pending_space = False

            # Check composite first
            if i+3 < len(data) and data[i+2] == 0x04:
                key = f"{cb:02X}_{data[i+3]:02X}"
                if key in COMPOSITE_SEQUENCES:
                    current += COMPOSITE_SEQUENCES[key]; i += 4; continue

            if cb in CHAR_MAP_URDU:
                current += CHAR_MAP_URDU[cb]
            i += 2

        else:                  # unknown control byte
            if current: pending_space = True
            i += 1

    if current.strip(): paragraphs.append(current.strip())
    return paragraphs
```

## Known Unknowns

- **Bytes `0x01`, `0x03`** — Appear frequently as formatting/section markers. Contents include style property tag-value pairs (see `specs/06-formatting-structures.md`). Currently used only to trigger `pendingSpace`.
- **Bytes `0x05`–`0x0B`** — Observed but not analyzed.
- **Bytes `0xE3`, `0xE5`, `0xF0`, `0xF4`** — Observed in some files but not yet mapped to characters.
