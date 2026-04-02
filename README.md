# inpage-format

**Community reverse-engineering research for the InPage `.INP` binary file format.**

InPage is a proprietary Urdu/Arabic word processor widely used in Pakistan, India, and the Middle East. Despite its cultural importance — newspapers, books, legal documents — no open-source tooling exists to read its files. This repository documents everything known about the format and provides reference implementations in TypeScript and C#.

---

## The Problem

- InPage is **closed-source** and **Windows-only**. No Linux, macOS, or mobile support.
- InPage 3.x **cannot open InPage 2.x files**. Millions of legacy documents are stranded.
- InPage's new web version does not support file import of local `.INP` files.
- **No open standard** exists. The format is undocumented.
- Millions of Urdu-language documents — newspapers, books, government records — are locked in `.INP` files with no migration path.

This project provides the reverse-engineered format specification and reference decoders so that developers can build tools that read these files.

---

## What This Repository Is (and Isn't)

| Is | Is Not |
|---|---|
| Format specification derived from reverse engineering | A ready-to-use application |
| Reference library implementations (TypeScript, C#) | Official InPage software |
| Unit-tested decoding primitives | A complete document renderer |
| Research notes, edge cases, known gaps | A production-ready parser for all files |

If you want a browser-based viewer that uses this research, see the companion project.

---

## Format Overview

InPage files use the **OLE2/CFB** (Compound File Binary) container — the same format used by legacy `.doc`, `.xls`, and `.ppt` files. Inside, one named stream holds the actual content:

| Stream Name | InPage Version |
|---|---|
| `InPage100` | v1.x |
| `InPage200` | v2.x |
| `InPage300` | v3.x (Unicode) |

**Two encoding modes exist:**

1. **Legacy (v1/v2)** — Proprietary `0x04`-prefix byte-pair encoding. Each character is 2 bytes: `0x04` + an index byte mapped to a Unicode code point via a lookup table of ~110 entries.
2. **Modern (v3)** — Standard UTF-16LE text, but with proprietary control codes interspersed for formatting. A struct array before the text maps style IDs to text spans.

---

## Repository Structure

```
inpage-format/
├── specs/                        Format specification documents
│   ├── 01-problem-statement.md   Background and context
│   ├── 02-container-format.md    OLE2/CFB container layout
│   ├── 03-encoding-legacy.md     v1/v2 0x04-prefix encoding
│   ├── 04-encoding-v3.md         v3 UTF-16LE + control codes
│   ├── 05-character-maps.md      Complete character mapping tables
│   ├── 06-formatting-structures.md  Style/formatting binary structures
│   ├── 07-text-filtering.md      Noise filtering algorithms
│   └── 08-security.md            CVE-2017-12824 and threat model
│
├── lib/
│   ├── javascript/               TypeScript library (runs in Node.js and browser)
│   │   ├── src/                  Source code
│   │   └── tests/                Unit tests (Vitest)
│   └── dotnet/                   C# library (.NET 8+)
│       ├── InPage.Format/        Library project
│       └── InPage.Format.Tests/  xUnit test project
│
└── test-fixtures/                Sample binary fixtures for tests
    └── README.md                 How to obtain real test files
```

---

## Quick Start

### JavaScript / TypeScript

```bash
cd lib/javascript
npm install
npm test
```

```typescript
import { parseInPageBuffer } from './src/index';

const buffer = await fs.promises.readFile('document.inp');
const result = parseInPageBuffer(buffer);

console.log(`Version: ${result.version}`);
console.log(`Paragraphs: ${result.paragraphs.length}`);
result.paragraphs.forEach(p => console.log(p));
```

### C# / .NET

```bash
cd lib/dotnet
dotnet test
```

```csharp
using InPage.Format;

var bytes = File.ReadAllBytes("document.inp");
var result = InPageDecoder.Parse(bytes);

Console.WriteLine($"Version: {result.Version}");
foreach (var para in result.Paragraphs)
    Console.WriteLine(para);
```

---

## Known Limitations and Open Problems

| Area | Status | Notes |
|---|---|---|
| Text extraction (v1/v2) | Working | ~85-90% accuracy on tested files |
| Text extraction (v3) | Working | Relies on struct array boundary marker |
| Character maps | ~95% complete | Some diacritic byte codes may differ by InPage build |
| Formatting (font size, alignment) | Partial | Tag-value structure reverse-engineered but not all IDs known |
| Page breaks | Working | Form Feed (0x0C) in v1/v2; implicit in v3 |
| Word spacing (v1/v2) | Working | Recovered via `pendingSpace` heuristic |
| Embedded images | Not implemented | Binary blobs not yet analyzed |
| Tables / columns | Not implemented | Requires layout engine research |
| Headers / footers | Not implemented | Master page structure unknown |
| Arabic mode | Partial | Different Kaf/Yeh/Heh variants + Arabic-Indic digits handled |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions — new character mappings, additional language implementations, test fixtures, or format discoveries — are welcome.

Key contribution areas:
- **New character mappings** — If you find a byte that decodes to the wrong glyph, open an issue with the hex dump
- **New language ports** — Python, Go, Rust, Java implementations welcome
- **Test fixtures** — Anonymized `.INP` snippets demonstrating edge cases
- **Format discoveries** — Binary analysis of unknown byte sequences

---

## Research Sources

- [ltrc/inPageToUnicode](https://github.com/AArhamm/inPageToUnicode) — JavaScript, GPL-2.0
- [KamalAbdali/InpageToUnicode](https://github.com/kamalabdali/InpageToUnicode) — C
- [UmerCodez/unicode-inpage-converter](https://github.com/UmerCodez/unicode-inpage-converter) — C++
- [SheetJS/cfb](https://github.com/SheetJS/js-cfb) — OLE2 container parser
- CVE-2017-12824 — Buffer overflow in InPage (documented exploit markers)

---

## License

MIT. See [LICENSE](LICENSE).

Character mapping data derived from community reverse-engineering work licensed under GPL-2.0. The mapping tables in this repository are factual data (Unicode code point assignments) and are not themselves copyrightable, but attribution to prior researchers is maintained in source comments.
