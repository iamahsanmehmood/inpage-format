# Formatting Structures

InPage stores formatting metadata (font, size, alignment, bold, color, indentation) in binary tag-value structures embedded in the stream. This document describes the known structures.

> **Status**: Partially reverse-engineered. Text extraction works without this. Formatting extraction is optional and approximate.

---

## Unit Conversion

InPage stores sizes in **proprietary internal units**, not points or millimetres.

### Font Size Conversion

```
points = round(internalUnits / INPAGE_UNITS_PER_POINT)
INPAGE_UNITS_PER_POINT = 8.33
```

**Origin of 8.33:** Reverse-engineered from binary comparison of known font sizes against raw values. Best fit across multiple test files. Not officially documented.

**Valid font size range:** 4–400 pt. Values outside this range after conversion are noise.

### Indent / Margin Conversion

```
millimetres = internalUnits / 1000   (approximate)
```

This conversion is approximate. The exact unit base is not confirmed.

---

## Tag-Value Property Format

Properties are stored as 4-byte records:

```
[propId: uint8] [group: uint8] [value: uint16 LE]
```

Three group bytes are observed:

| Group byte | Meaning |
|---|---|
| `0x01` | Character/style property (font size, font index, bold) |
| `0x7E` | Paragraph-level property (alignment, indent, line spacing) |
| `0x03` | Page-level property (skip, not yet analyzed) |

---

## Known Property IDs — Group `0x01` (Character)

| propId | Property | Value encoding |
|---|---|---|
| `0x01` | Font size | Internal units → divide by 8.33 for points |
| `0x03` | Font index | Index into the font table |
| `0x04` | Alignment (primary) | 0=right, 1=center, 2=left, 3=justify |
| `0x05` | Font style variant | Observed value = 6 regardless of bold/italic; meaning unclear |
| `0x0C` | Alignment (secondary) | Same encoding as `0x04`; only apply if `0x04` not seen |
| `0x0E` | Bold | 0=normal, 1=bold |
| `0x12` | Font size (alternate) | Same encoding as `0x01` |

**Alignment note:** `0x04` is the authoritative alignment property. `0x0C` is a secondary/fallback that appears later in the block. Only apply `0x0C` if `0x04` was not found. Applying both causes `0x0C` to incorrectly overwrite center/justified alignments.

---

## Known Property IDs — Group `0x7E` (Paragraph)

| propId | Property | Value encoding |
|---|---|---|
| `0x00` | First-line indent | Internal units / 1000 → mm |
| `0x01` | Left indent | Internal units / 1000 → mm |
| `0x02` | Right indent | Internal units / 1000 → mm |
| `0x04` | Alignment | 0=inherit, 1=center, 2=left, 3=justify |
| `0x05` | Font size / text height | Internal units → divide by 8.33 for points |
| `0x06` | Paragraph direction | 0=RTL, 2=LTR |
| `0x0E` | Bold override | 0=normal, 1=bold |
| `0x0F` | Alignment override | 0=right, 1=center, 2=left, 3=justify |
| `0x10` | Italic override | 0=normal, 1=italic |
| `0x11` | Left margin | Internal units / 1000 → mm |
| `0x12` | Right margin | Internal units / 1000 → mm |
| `0x15` | Color index | Index into color palette (0–255) |

**Alignment note for `0x04`:** When `val=0`, it means **inherit from default style**, NOT right-align. Right-align is the default for RTL documents. Only apply alignment from this property when `val > 0`.

---

## Default Style Block

The default style block is located at approximately offset `0xD0` in the stream. Scan up to `0x400` bytes from this offset for `XX 01 YY YY` patterns (group `0x01` properties).

```
For each i in range(0, min(streamLength-4, 0x400), step=2):
  if data[i+1] == 0x01:
    propId = data[i]
    value  = uint16LE(data[i+2:i+4])
    apply property to defaultStyle
```

The default style is:
- Font size: 18 pt
- Alignment: right (RTL)
- Bold: false
- Line spacing: 2.4×

---

## V1/V2: Per-Paragraph Format Detection

In v1/v2 streams, a paragraph's formatting bytes appear **before** the `04 XX` character sequence. The pattern `0D XX XX 00 00 09` followed by `04 XX` (Urdu text) marks a new formatted paragraph section:

```
0D [paragraphByteCount: uint16] 00 00 09 [04 urduChar...]
```

To find formatting for a paragraph:
1. Find the `0D XX XX 00 00 09 04` pattern
2. Scan backward up to 64 bytes for `XX 01 YY YY` and `XX 7E YY YY` pairs
3. Parse each found pair as a style property

---

## V3: Per-Paragraph Format Detection

In v3 streams, formatting records appear inline within the text stream as control code sequences. The style struct array (described in `specs/04-encoding-v3.md`) maps `styleId` values to text spans.

Known V3 control codes relevant to formatting:

| Code | Meaning |
|---|---|
| `0x0001` | Style change — property pairs follow |
| `0x0004` | Content marker — property pairs follow |
| `0x0009` | Text rendering record — property pairs follow |
| `0x000D` | Line break |

After each control code, parse up to 48 bytes as `XX 7E YY YY` (paragraph) and `XX 01 YY YY` (character) property pairs.

---

## Font Table

Fonts are stored as **UTF-16LE null-terminated strings** in the header region. Detection uses pattern matching against known InPage font name prefixes:

Known font name patterns:
- `InPage`, `Nastaliq`, `Arial`, `Faiz`, `Noori`, `Jameel`
- `Times`, `Noto`, `Tahoma`, `Verdana`, `Courier`, `Symbol`
- `Gulzar`, `Alvi`, `Mehr`, `Nafees`

Font entries are deduplicated by name. The index in the resulting array corresponds to the `fontIndex` property value.

**Font-to-web mapping** (for rendering):

| InPage font | Web CSS equivalent |
|---|---|
| InPage Nastaliq | `'Noto Nastaliq Urdu', serif` |
| Faiz Nastaliq | `'Noto Nastaliq Urdu', serif` |
| Noori Nastaliq | `'Noto Nastaliq Urdu', serif` |
| Jameel Noori Nastaleeq | `'Noto Nastaliq Urdu', serif` |
| Arial Unicode MS | `'Noto Nastaliq Urdu', 'Arial', sans-serif` |
| Arial | `'Arial', sans-serif` |
| Times New Roman | `'Times New Roman', serif` |

Any font name containing "nastal" (case-insensitive) falls back to Noto Nastaliq Urdu.

---

## Color Palette

Colors are stored as **UTF-16LE color name strings** followed by RGB byte values. Names match known color words (Black, Blue, Red, etc.). After the name string and null padding, three bytes give R, G, B values.

---

## Known Unknowns

| Item | Status |
|---|---|
| Inline bold/italic within text runs | Not yet reverse-engineered |
| Underline | `0x7E:0x10` observed but needs confirmation |
| Text boxes / frames coordinates | Unknown |
| Column layout settings | Unknown |
| Line spacing precise encoding | Approximate (2.4× hardcoded default) |
| Border/frame flags | Observed `0x01:0x0D = 1` is NOT underline — likely a frame flag |
