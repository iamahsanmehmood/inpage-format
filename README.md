# inpage-format

<div align="center">

**Open research for the InPage `.INP` binary file format**

*The only documented, tested, multi-language implementation of the InPage decoder*

[![CI](https://github.com/iamahsanmehmood/inpage-format/actions/workflows/ci.yml/badge.svg)](https://github.com/iamahsanmehmood/inpage-format/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/inpage-format?color=cb3837&logo=npm)](https://www.npmjs.com/package/inpage-format)
[![NuGet](https://img.shields.io/nuget/v/InPage.Format?color=004880&logo=nuget)](https://www.nuget.org/packages/InPage.Format)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![JS Tests](https://img.shields.io/badge/JS%20tests-67%20passing-brightgreen?logo=vitest)](#)
[![.NET Tests](https://img.shields.io/badge/.NET%20tests-54%20passing-brightgreen?logo=dotnet)](#)

</div>

---

## Why this exists

InPage is the dominant Urdu/Arabic word processor used across Pakistan, India, and the Middle East for 30+ years. Newspapers, government records, books, and legal documents are locked in `.INP` files. No open tooling exists to read them.

| The problem | Impact |
|---|---|
| InPage 3.x **cannot open** InPage 2.x files | Millions of archived documents are stranded |
| InPage is **Windows-only** | No Linux, macOS, mobile, or server-side processing |
| The format is **completely undocumented** | No importers in LibreOffice, Pandoc, or anywhere else |
| InPage web version does **not support local file import** | Archives can't be migrated |

This repository is the community's answer: a complete format specification derived from reverse engineering, with reference implementations in TypeScript and C# that anyone can use to build their own tools.

---

## What's inside

```
inpage-format/
│
├── 📖  specs/              8 detailed specification documents
│   ├── 01-problem-statement.md
│   ├── 02-container-format.md      OLE2/CFB container layout
│   ├── 03-encoding-legacy.md       v1/v2 byte-pair encoding
│   ├── 04-encoding-v3.md           v3 UTF-16LE + struct array
│   ├── 05-character-maps.md        110+ character mappings
│   ├── 06-formatting-structures.md Style/font/alignment binary structures
│   ├── 07-text-filtering.md        Noise separation algorithm
│   └── 08-security.md              CVE-2017-12824 & threat model
│
├── 📦  lib/javascript/     TypeScript library — Node.js & browser
├── 📦  lib/dotnet/         C# library — .NET 9+
└── 🧪  test-fixtures/      Minimal binary fixtures for testing
```

---

## Quick start

### JavaScript / TypeScript

```bash
npm install inpage-format
```

```typescript
import * as CFB from 'cfb';
import { decodeV1V2, decodeV3, filterParagraphsWithMeta } from 'inpage-format';

// 1. Parse the OLE2 container (use cfb or any OLE2 library)
const cfbFile = CFB.read(new Uint8Array(fileBuffer), { type: 'array' });

// 2. Detect version from stream name
const entry200 = CFB.find(cfbFile, '/InPage200');
const entry300 = CFB.find(cfbFile, '/InPage300');
const stream = new Uint8Array((entry300 ?? entry200).content);
const version = entry300 ? 3 : 2;

// 3. Decode
const decoded = version === 3 ? decodeV3(stream) : decodeV1V2(stream);

// 4. Filter noise
const { paragraphs, filteredCount } = filterParagraphsWithMeta(
  decoded.paragraphs,
  decoded.paragraphMeta,
);

console.log(`Extracted ${paragraphs.length} paragraphs (${filteredCount} noise paragraphs removed)`);
paragraphs.forEach(p => console.log(p));
```

### C# / .NET

```bash
dotnet add package InPage.Format
```

```csharp
using OpenMcdf;
using InPage.Format;

// 1. Parse the OLE2 container
using var cf = new CompoundFile("document.inp");

// 2. Detect version
string streamName = cf.RootStorage.TryGetStream("InPage300") != null
    ? "InPage300" : "InPage200";
int version = streamName == "InPage300" ? 3 : 2;

byte[] content = cf.RootStorage.GetStream(streamName).GetData();

// 3. Decode
var decoded = version == 3
    ? InPageDecoder.DecodeV3(content)
    : InPageDecoder.DecodeV1V2(content);

// 4. Filter noise
var (paragraphs, _, filteredCount) = TextFilter.FilterWithMeta(
    decoded.Paragraphs,
    decoded.ParagraphMeta
);

Console.WriteLine($"Extracted {paragraphs.Count} paragraphs ({filteredCount} filtered)");
foreach (var para in paragraphs)
    Console.WriteLine(para);
```

---

## Format overview

InPage files are **OLE2/CFB containers** (same format as legacy `.doc` / `.xls`) with one named content stream:

| Stream name | InPage version | Encoding |
|---|---|---|
| `InPage100` | 1.x | Proprietary byte-pair (`0x04` prefix) |
| `InPage200` | 2.x | Proprietary byte-pair (`0x04` prefix) |
| `InPage300` | 3.x | UTF-16LE with struct array |

### V1/V2 encoding at a glance

Every Urdu character is stored as a 2-byte pair. The first byte is always `0x04`; the second byte indexes into a 110-entry lookup table:

```
04 81 → ا  (Alef)        04 9C → ک  (Kaf)
04 82 → ب  (Beh)         04 A4 → ی  (Yeh)
04 A5 → ے  (Yeh Barree)  04 F3 → ۔  (Urdu Full Stop)
04 F6 → ﷺ  (PBUH)        04 D1 → ۱  (Urdu 1)
```

Composite sequences use 4 bytes (base + modifier):
```
04 81 04 BF → أ  (Alef + Hamza Above)
04 81 04 B3 → آ  (Alef + Madda)
```

Word boundaries are **implicit**: a non-`0x04` control byte between character sequences signals a word break.

### V3 encoding at a glance

Text is standard UTF-16LE. Before the text, an array of `[styleId: u32, byteLength: u32]` structs maps formatting to text spans. The boundary between the struct array and the text is the 6-byte marker `FF FF FF FF 0D 00`.

---

## Supported characters

| Category | Count | Notes |
|---|---|---|
| Urdu/Arabic consonants | 39 | Including Urdu-specific: پ ٹ ڈ ڑ گ ں ے ہ ھ |
| Diacritical marks (harakat) | 14 | Zabar, zer, pesh, shadda, sukun + alternates |
| Urdu numerals (Extended Arabic-Indic) | 10 | ۰–۹ (U+06F0–U+06F9) |
| Arabic-Indic digits (Arabic mode) | 10 | ٠–٩ (U+0660–U+0669) |
| Punctuation & symbols | 22 | Including ۔ ، ؟ ؛ ﴾ ﴿ ﷺ |
| Religious symbols | 4 | ؑ ؔ ؓ ؒ |
| Composite sequences | 4 | أ آ ؤ یئ |

Full table: [`specs/05-character-maps.md`](specs/05-character-maps.md)

---

## Known limitations

| Area | Status |
|---|---|
| Text extraction (v1/v2) | ✅ ~85–90% accuracy |
| Text extraction (v3) | ✅ Working |
| Word spacing (v1/v2) | ✅ Recovered via `pendingSpace` heuristic |
| Page breaks | ✅ Form Feed → `PAGE_BREAK_MARKER` |
| Font name extraction | ✅ Pattern-matched from header |
| Font size / alignment | ⚠️ Partial — most files work, some edge cases |
| Bold / italic | ⚠️ Partially reverse-engineered |
| Embedded images | ❌ Not implemented |
| Tables / columns | ❌ Layout structures unknown |
| Headers / footers | ❌ Master page structure unknown |

---

## Security

InPage files have been used in APT campaigns targeting Pakistani civil society (CVE-2017-12824 — stack overflow in InPage). The library includes:

- OLE2 magic signature validation
- File size limits (50 MB max)
- Exploit pattern scanning (`68 72 68 72` egg-hunter + `LuNdLuNd` shellcode marker)
- Strict bounds checking on all binary reads

Details: [`specs/08-security.md`](specs/08-security.md)

---

## Contributing

All contributions are welcome:
- 🔤 **New character mappings** — found a wrong glyph? Open an issue with the hex bytes
- 🧪 **Test fixtures** — minimal binary snippets demonstrating edge cases
- 🌐 **New language ports** — Python, Go, Rust, Java all welcome
- 📝 **Format discoveries** — binary analysis of unknown byte sequences

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

---

## Research sources

- [ltrc/inPageToUnicode](https://github.com/AArhamm/inPageToUnicode) — JavaScript, GPL-2.0
- [KamalAbdali/InpageToUnicode](https://github.com/kamalabdali/InpageToUnicode) — C
- [UmerCodez/unicode-inpage-converter](https://github.com/UmerCodez/unicode-inpage-converter) — C++
- [SheetJS/cfb](https://github.com/SheetJS/js-cfb) — OLE2 parser
- [CVE-2017-12824](https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2017-12824)

---

## License

MIT © [inpage-format contributors](https://github.com/iamahsanmehmood/inpage-format/graphs/contributors)

Character mapping data is factual Unicode assignment data — not copyrightable. Attribution to prior researchers is maintained in source comments.
