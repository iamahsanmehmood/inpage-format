# Native InPage100 formatting evidence from controlled Urdu samples

Research date: 7 October 2026. Fifteen native documents demonstrate
length-bounded formatting properties missed by the reviewed upstream reader.
The strongest new results are an exact candidate size scale preserving half
points, distinct weight and italic properties, a different alignment encoding,
and formatting envelopes located after the text.

This is measured evidence and a conservative research reader for this corpus.
It does not establish general inline range ownership or a complete INP model.

## Corpus and producing application

I compared fifteen native Urdu documents created in **InPage2014 Khattat
Professionals**, changing one formatting setting per variant except the
combined bold/italic check and the unchanged-save controls. The creator,
ImadC9, identified that installation, confirmed the baseline font was Naskh,
and confirmed that the files saved and reopened correctly. All fifteen
complete originals are committed in
[`research/native-formatting/fixtures`](../research/native-formatting/fixtures/)
under the repository's MIT licence. Their complete file and stream hashes are
recorded in `evidence.json`; reviewers can inspect every byte.

I checked Help > About in the identified installation: it displays
**INPAGE 2014**. The executable's FileVersion resource is **1.0.0.1** and its
ProductVersion resource is **2.0.0.0**. The observed About branding, version
resources and executable hash are recorded in
[`provenance/producer.json`](../research/native-formatting/provenance/producer.json).
These are literal observations of this modified installation, not evidence
that it is an official InPage 3 release. Its documents contain `InPage100`.
The stream name selects a document-format family; it does not identify the
producing application's branding or exact executable build.

All fifteen streams contain the same 43-byte text record: 21 Urdu/space pairs
and a final one-byte CR. Experiment names label the intended settings;
whole-text coverage is inferred from the records. I did not capture the
original formatting UI state. Successful native reopening is the creator's
observation; the verifier checks bytes and does not launch InPage.

I use **`02-control-a.inp` as the reference**, because all three unchanged-save
control streams are identical. The saved baseline body is **Naskh, 11 pt**;
the header default is 12 pt. The initial checklist's requested 12 pt was not
the saved body setting. I retain `01-baseline.inp` as an original fixture,
but do not use its unexplained changed fields to derive formatting semantics.

All offsets below refer to the reconstructed logical `InPage100` stream.

## 1. Stable unchanged-save controls

The three control streams are byte-identical: 4,249 bytes with SHA-256
`7e3223d049c4b5a8b759b2c1574f696944716bc0ad088d3c4befd3c39da4a116`.
The CFB files have different hashes, so whole-file comparison alone would
obscure this stable content. The reference and baseline have identical text,
default-style headers, font blocks and formatting entries, and identical
`DocumentInfo` streams. Their
`InPage100` streams differ only in these ten intervals (offsets are decimal):

| Offset | Baseline bytes | Reference bytes |
|---:|---|---|
| 1298 | `AE` | `12` |
| 1376 | `B1` | `15` |
| 1702 | `C8` | `2C` |
| 1708 | `CA` | `2E` |
| 1718 | `C7` | `2B` |
| 1728 | `B9` | `1D` |
| 2054 | `C9` | `2D` |
| 3975 | `F0 12` | `DE 10` |
| 3978 | `6E` | `8A` |
| 4191 | `B0 E8` | `A8 E9` |

I have not established these fields' meanings. `verify.py` reproduces this
complete stream comparison in its report. They are not classified as
formatting changes or discarded as volatile data.

`olefile` 0.47 and SheetJS `cfb` 1.2.2 independently reconstruct identical
content streams from all fifteen originals. The independent extraction report
records every stream hash.

## 2. Framed records after the text

The shared text begins at offset 3671. A four-byte length at 3667 is 43. The
payload ends with CR at 3713. Five zero bytes and `FF FF FF FF` follow it.
The first formatting entry begins at 3723. Each entry has this measured form:

```text
u32 span_value
u32 outer_length B
u16 envelope_marker = 1          meaning unresolved
u32 inner_length P
P bytes of property payload

B = P + 6
```

The envelope does not justify interpreting all properties as four-byte values.
The first property in every payload is `80 00` with a four-byte zero value.
A base/style-reference interpretation is plausible but unresolved; the reader
accepts only the observed zero reference.

There are three entries with span values `1, 42, 1`, then
`FE FF FF FF FF FF FF FF 00 00`. In the control:

| Entry offset | Span value | Outer length | Inner length |
|---:|---:|---:|---:|
| 3723 | 1 | 12 | 6 |
| 3743 | 42 | 22 | 16 |
| 3773 | 1 | 12 | 6 |

The second span equals the 42 encoded bytes of visible text; the third equals
the one-byte final CR. This supports a body/CR interpretation for these files.
It remains an inference: the first entry's ownership is unresolved, and summing
all three spans gives 44, not the 43-byte text length. The reader explicitly
exposes this unresolved entry. It does not claim a general run table or silently
map all three entries onto the text.

## 3. Property values and widths

Tags in this table are shown as their two stored bytes, not as host integers.

| Stored tag | Value width | Association supported by the fixtures |
|---|---:|---|
| `02 02` | 2 bytes | Urdu font physical slot; body value 1 selects Naskh |
| `00 7F` | 4 bytes | Font-size candidate in 2,000 units per point |
| `02 7F` | 2 bytes | Weight; header default 400, bold variant 700 |
| `03 7F` | 2 bytes | Italic; header default 0, italic variant 1 |
| `80 7F` | 2 bytes | Alignment; variants left 0, center 2, justified 4 |

All values are little-endian. Unknown widths must not be guessed by advancing
four bytes. The reader rejects unknown tags within the bounded payload.

### Size

| Filename | Body value | Stored value bytes | Inferred points |
|---|---:|---|---:|
| `05-size-11.inp` | 22,000 | `F0 55 00 00` | 11 |
| `06-size-11_5.inp` | 23,000 | `D8 59 00 00` | 11.5 |
| `07-size-14.inp` | 28,000 | `60 6D 00 00` | 14 |
| `08-size-24.inp` | 48,000 | `80 BB 00 00` | 24 |

Each value exactly matches `points * 2000`. Fractional sizes must not be
rounded. In these four files the same size appears in the third format entry.
The baseline body also stores 22,000; it does not contain the requested
12-point body setting. Its unoverridden third entry resolves to the header's
24,000 (12-point) value in this research model. Thus a file can have different
body and end-of-paragraph formatting; a single global size loses information.

### Bold and italic

The bold body payload adds exactly `02 7F BC 02`, with value 700. The italic
payload adds `03 7F 01 00`. The combined file contains both distinct fields,
providing a composition cross-check. This is not an independent held-out
document. Other weights, font variant behavior, and actual glyph rendering
were not validated. The reader accepts only 400 and 700 for resolved weight.

### Alignment

The three alignment variants add `80 7F 00 00`, `80 7F 02 00`, and
`80 7F 04 00` respectively. Explicit zero in the left sample must override
the inferred header default, not disappear as a false/missing value. The
unchanged header contains `80 7F 01 00`; interpreting 1 as right alignment
is inferred from the baseline/default context. Full justification, start/end
alignment, LTR interaction, and paragraph-level ownership are unverified.

### Font slot and default profile

The font-length field at 3329 is 324: six physical 54-byte slots. Slot 0
at 3333 is Noori Nastaliq and slot 1 at 3387 is Naskh. The Noori variant
removes the body field `02 02 01 00`, while the unchanged header's value is
zero. That supports physical slot 1 for explicit Naskh and inherited slot 0
for Noori in this corpus. Deleted slots must not be compacted.

The reader resolves defaults only when the 1,041-byte header interval starting
at 2164 matches SHA-256
`27c6364cca7e5646a0a27131feaebd260f69ce7559731453335cfe73cb2c3d55`.
That interval is identical across all fifteen files. A nonmatching header is
rejected. These fixed profile checks are intentional limitations, not evidence
of a general style-inheritance implementation.

## 4. Reproduced upstream gap

The unmodified formatting source at upstream commit
[`45105c6`](https://github.com/iamahsanmehmood/inpage-format/tree/45105c60b35b59a69b7bbdee7d76bf539abf9968)
has canonical-LF SHA-256
`3afcbc12f8860e8f24576e6eb9bceeb8c7e2df8228059434736b4aa1d21366bf`.
On every fixture stream it returns zero fonts, zero legacy paragraph formats,
and its default size of 18 points. `compare_upstream.mjs` checks that exact
source and each stream hash before invoking its functions.

The pinned [formatting spec](https://github.com/iamahsanmehmood/inpage-format/blob/45105c60b35b59a69b7bbdee7d76bf539abf9968/specs/06-formatting-structures.md)
describes an approximate 8.33-unit scale, four-byte property records, and other
tag families. The controlled corpus is a counterexample to applying that
description universally. It does not justify replacing those encodings for
all other files or changing production parsers based only on this profile.

## Verification and remaining work

`evidence.json` contains file/stream hashes and native formatting/font
excerpts; the complete corresponding files are included as fixtures. Fifteen unit tests exercise those native envelopes, fractional size,
explicit zero alignment, composition, exact envelope rebuilding, truncation,
unknown widths, and unsupported references. The native verifier additionally
checks all original hashes/excerpts, shared text hash, control equality, all
listed body settings, and seven malformed in-memory inputs.

Those negative inputs are synthetic robustness tests, not extra native samples.
The shared 15-file corpus was used for discovery and checking; no independent
held-out test exists. General word-level ownership, multiple paragraphs,
multiple stories, style inheritance across profiles, tables, columns, images,
headers, footers, and masters remain unverified. Word-specific formatting and
a separately created multi-paragraph document are the next native experiments.
They are not part of this corpus or its claimed validation.
