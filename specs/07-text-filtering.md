# Text Filtering

Raw decoded InPage output contains **binary noise** mixed with actual content. This is unavoidable: InPage stores metadata, font names, style strings, and formatting blobs in the same stream as text. Without filtering, the output includes garbage like `Normal`, `InPage Nastaliq`, `Root Entry`, and fragments of binary data decoded as Urdu characters.

This document describes the 3-layer filtering algorithm used to separate content from noise.

---

## Why Filtering Is Necessary

The InPage decoder emits **every decodeable byte sequence** as a paragraph candidate. This includes:

- InPage font names stored as UTF-16LE (e.g., `InPage Nastaliq`, `Faiz Nastaliq`)
- Style sheet names (e.g., `Normal`)
- Stream/container names (e.g., `InPage300`, `Root Entry`)
- Control-code regions decoded as random Urdu letters
- Formatting blobs that partially decode to garbage Urdu sequences

Filtering is applied **after** decoding and **before** output.

---

## Before Filtering: Special Cases

### Page Break Marker

The `PAGE_BREAK_MARKER` sentinel (`"___PAGE_BREAK___"`) always passes all filters. Never filter it.

### Structural Empty Lines

Empty strings are passed through. They serve as table detection boundaries — see below.

### Short Numeric/Alphanumeric Strings

Strings ≤10 chars matching `/^[\d\sA-Za-z\-\.\/]+$/` pass immediately. These are table cells (row numbers, dates, references like `2-A`).

### Short Pure Urdu Strings

Strings <15 chars matching `/^[\u0600-\u06FF\s،۔0-9]+$/` pass immediately. These are short titles (e.g., `اپنا گھر`), captions, or list labels.

---

## Layer 1: Density Filter

**Purpose:** Reject strings with too little Urdu content to be real document text.

**Algorithm:**

```
urduCount = count of characters in Unicode Urdu/Arabic ranges
totalChars = total character count (Unicode code points)

# Bilingual bypass (short mixed-language, e.g. "Photo: عکس")
if totalChars <= 30 AND urduCount >= 2 AND (urduCount/totalChars) >= 0.15:
  PASS

# Minimum Urdu character threshold
minUrdu = 3 if totalChars < 20 else 5
if urduCount < minUrdu: REJECT

# Density threshold
requiredDensity = 0.30 if totalChars < 20 else 0.40
if (urduCount / totalChars) < requiredDensity: REJECT

PASS
```

**Rationale for thresholds:**
- Minimum 3 chars for short text (not 5): Titles like `اپنا گھر` (7 chars, 5 Urdu) were previously cut by the strict minimum.
- 15% density for bilingual: Mixed-language captions like `Photo: عکس` (2 Urdu chars, ~17% density) are real content.
- 40% density for longer text: Prevents English-heavy strings that happen to contain one Urdu word.

---

## Layer 2: Pattern and Metadata Filter

**Purpose:** Reject known metadata strings and repeating garbage.

**Metadata strings (reject ONLY when no Urdu present):**

```
'Normal', '@dFF', 'InPage Nastaliq', 'InPage Naskh',
'Arial Unicode MS', 'Faiz Nastaliq', 'DocumentInfo',
'InPage100', 'InPage200', 'InPage300', 'Root Entry'
```

**Critical rule:** Only reject if `countUrdu(text) == 0`. A paragraph that mentions `InPage300` but also contains Urdu text is legitimate document content, not metadata.

**Repeating ASCII pattern detection:**
- Single-character repetition: string with ≤2 unique chars and length > 10 → REJECT
- Short-pattern repetition: if pattern of length 1–4 accounts for ≥80% of the string → REJECT

---

## Layer 3: Repetition and Ligature Filter

**Purpose:** Reject low-information Urdu sequences that are likely binary artifacts.

**Repetition filter:**
```
uniqueUrdu = count of distinct Urdu characters
totalUrdu = total Urdu character count

if uniqueUrdu <= 3 AND totalUrdu > 20: REJECT
```

**Rationale for threshold 20 (not 10):** Short religious phrases like `اللہ اللہ اللہ` (12 chars, 3 unique) are valid content. The previous threshold of 10 incorrectly rejected these. The threshold of 20 preserves them while still rejecting long binary-garbage sequences.

**Ligature garbage filter:**
```
ligatureCount = count of chars in range U+FB50–U+FDFF
if (ligatureCount / totalChars) > 0.50: REJECT
```

Arabic Presentation Forms (U+FB50–U+FDFF) are pre-composed ligature glyphs. InPage text should use combining characters (U+0600–U+06FF), not presentation forms. A paragraph that is >50% presentation forms is almost certainly binary garbage.

---

## Deduplication

After the 3-layer filter, remove duplicate paragraphs using **space-stripped fingerprints**:

```
fingerprint(text) = text with all whitespace removed
```

Do NOT deduplicate short strings (< 15 chars). Short strings are likely table cells, list items, or repeated structural elements (page numbers, headings) that are legitimately repeated.

---

## Leading/Trailing Trim

> **Status**: The legacy heuristic trim described here was found to **aggressively delete** legitimate short content (e.g., titles like `اپنا گھر`). It is currently disabled in the reference implementation. Documents that use explicit V3 struct pointers or verified text blocks do not need it.

Historical behavior (for reference only):
- **Trailing trim**: Find the last "good" paragraph (≥10 Urdu chars, ≥60% density, ≥5 unique) and discard everything after it.
- **Leading trim**: Find the first "good" paragraph (≥5 Urdu chars, ≥3 unique) and discard everything before it.

If you re-enable this for a specific use case, note that it will drop titles and section headers.

---

## Page Break Handling

Remove leading and trailing `PAGE_BREAK_MARKER` entries from the final output. Page breaks at the very start or end of the document are structural artifacts.

---

## Filter Return Values

The filter should return:
- `paragraphs: string[]` — filtered text
- `filteredCount: number` — how many content paragraphs were dropped (excluding page break markers)

The `filteredCount` is useful for diagnostics: if a document is losing more than ~10% of its paragraphs, something may need tuning.

---

## Known Limitations

- **Too-aggressive in some edge cases**: Binary noise with high Urdu density (e.g., a formatting blob that happens to decode to valid Urdu) will pass all filters.
- **Bilingual documents**: Documents mixing Urdu with English, Chinese, or other scripts may have lower Urdu density overall. Tune the thresholds accordingly.
- **Quranic text**: Highly diacritical text (many harakat per letter) has lower letter-to-total-char ratios. This is generally fine since the diacritics are themselves Urdu range characters.
