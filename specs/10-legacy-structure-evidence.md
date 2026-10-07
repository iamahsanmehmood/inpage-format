# New byte evidence: a legacy InPage100 directory and font-slot block

Research date: 7 October 2026. This note contributes measured structures absent
from the reviewed `inpage-format` specification at commit
[`45105c6`](https://github.com/iamahsanmehmood/inpage-format/tree/45105c60b35b59a69b7bbdee7d76bf539abf9968).
It also demonstrates a real input missed by its font-name reader. This is a
scoped contribution, not a claim of worldwide priority or a complete `.INP`
specification.

## Provenance and reproduction

The input is the converter author's public
[`auxil/story.inp`](https://github.com/KamalAbdali/InpageToUnicode/blob/6eab0278d3717de98c230712121e4460266755b8/auxil/story.inp),
pinned at commit `6eab0278d3717de98c230712121e4460266755b8`. The original
[converter source](https://github.com/KamalAbdali/InpageToUnicode/blob/6eab0278d3717de98c230712121e4460266755b8/src/InpToUni.c)
extracts text; it does not describe the font block or section directory below.
The file is 92,672 bytes, with SHA-256
`50281cde396c92d23d1b49e2196b8ac8ae4f9988ea8a01603779549a342cd0cf`.
Its `InPage100` logical CFB stream is 87,175 bytes, SHA-256
`ea3152468b88562feca7296789051c7a83eb9e8c90a5186fd9516b86e14d280d`.

**Every offset below is a byte offset inside that logical stream.** CFB sectors
must be reconstructed first; these are not physical file offsets. The native
application build that produced this file is unknown. The stream name alone
does not establish the producer's exact version.

`evidence.json` contains exact structural excerpts, their offsets, and hashes.
`verify.py` checks those excerpts against the pinned native input and reads the
structures. `verified-native-report.json` records the actual successful run.
The complete story document is obtained separately, not committed here.

## 1. Seven directory-like entries at offset 16

Reading seven consecutive six-byte entries as `<u16 little-endian id, u32
little-endian stream offset>` produces:

| Entry byte offset | ID | Target byte offset |
|---:|---:|---:|
| 16 | 0 | 6150 |
| 22 | 1 | 6150 |
| 28 | 2 | 6150 |
| 34 | 3 | 6172 |
| 40 | 4 | 87123 |
| 46 | 5 | 87123 |
| 52 | 6 | 87175 |

The first entry is `00 00 06 18 00 00`; the last is
`06 00 87 54 01 00`. Three independent byte relationships support the offset
interpretation:

1. Targets 6150 and 6172 bracket exactly the 22 single-byte characters
   `InPage Arabic Document`, with no NUL terminator in that interval.
2. Targets 87123 and 87175 bracket exactly a 52-byte trailer:
   `FD FF FF FF`, 44 zero bytes, then `FF FF FF FF`.
3. The final target equals the independently extracted stream length.

**Inference:** this is a section-offset directory, and repeated targets may
represent empty intervals. Its ID meanings, header version fields, applicability
to other files, and relation to pages or masters remain unverified. The research
reader rejects nonmatching profiles rather than assigning section meanings.

## 2. A length-prefixed block with 18 fixed-width font-name slots

At offset **7413**, `CC 03 00 00` decodes as the unsigned little-endian value
**972**. The following interval `[7417, 8389)` contains exactly
**18 × 54 bytes**. At each 54-byte boundary, the first 32 bytes form a name
area; the final 22 bytes remain opaque. Seven slots have these nonempty,
NUL-terminated, single-byte ASCII names:

| Physical slot | Name-area offset | Name before first NUL |
|---:|---:|---|
| 0 | 7417 | Noori Nastaliq |
| 1 | 7471 | Naskh |
| 2 | 7525 | Firoz |
| 3 | 7579 | Arial |
| 4 | 7633 | Simplified Arabic |
| 5 | 7687 | ZoharSindhi |
| 6 | 7741 | Sadaf |

Slots 7–17 start with `00`. Several still contain readable fragments after
that first NUL. For example slot 7 begins
`00 61 73 61 61 72 20 42 6F 6C 64 00` (`\0asaar Bold\0`). Slot 2 is
`Firoz\0Character\0...`: reading until the first NUL gives `Firoz`, not
`Firoz Character`. The unused part of a name area is not always zero-filled.

**Inference:** 972 is a byte length for a fixed-slot font block. Regular spacing,
recognizable names, and exact length agreement support this interpretation.
The reader preserves all 18 physical positions, raw name areas, and suffixes;
it reconstructs the full 972 bytes exactly. Empty names may be unused or deleted
entries, but that meaning is not proven. The physical slot number is not yet a
verified value for a native font-reference field. Do not compact slots, repair
their names from residual bytes, or infer the opaque suffix's flags.

The reviewed upstream
[`extractFontTable`](https://github.com/iamahsanmehmood/inpage-format/blob/45105c60b35b59a69b7bbdee7d76bf539abf9968/lib/javascript/src/format-extractor.ts)
searches for selected UTF-16LE strings and deduplicates matches. Running that
exact pinned source on this stream returns **zero fonts**. The new reader
recovers the seven names above at their observed slots. `compare_upstream.mjs`
reproduces the result, checking both source and stream hashes before running.
The source hash uses LF line endings so Windows Git checkout conversion does
not affect reproduction; the binary stream hash uses its unmodified bytes.
This demonstrates that the existing blanket UTF-16LE font-table description
does not cover this legacy sample.

The font-block starting offset is currently a measured coordinate, not a
general locator. The tool requires it explicitly. Non-ASCII name encoding and
the connection between font slots, text runs, font sizes, and bold/italic
variants need further native fixtures.

## 3. A variable-length field near the font block

At offset **7272** the bytes are:

```text
E6 7F  07 00 00 00  4E 6F 72 6D 61 6C 00  E7 7F
tag    length = 7   "Normal" + NUL         next tag
```

The two-byte tag, four-byte length, and seven-byte payload occupy 13 bytes;
`E7 7F` immediately follows at offset 7285. **Inference:** this is a sized
single-byte string field, possibly a style name. The semantic tag meaning and
general serialization grammar are not established. It is useful counterevidence
to treating every property-like sequence as a fixed four-byte record.

## Validation and remaining limits

Verification succeeds on the original local input and on a fresh download from
the pinned public URL. Eleven synthetic unit tests check bounds, invalid
directory profiles, empty and duplicate slots, residual bytes, and unsupported
name encodings. These tests exercise reader behavior; the pinned native-file
checks provide the format evidence. Deliberate changes to directory, label,
font length, slot bytes, and field length are rejected by the evidence verifier.

All three structures are observed in **one independent public document**.
No native rendering, opening, saving, or controlled-setting comparisons have
been performed. The contribution establishes a font-reader gap and concrete
candidate structures; it does not establish table layout, columns, image
embedding, headers/footers, masters, or visual formatting semantics.
