# Problem Statement

## What is InPage?

InPage is a proprietary word processor developed by Concept Software (Pakistan) and used throughout Pakistan, India, Bangladesh, and the Middle East for typesetting Urdu, Arabic, and other Nastaliq-script languages. It has been the dominant Urdu desktop publishing tool since the 1990s.

InPage documents use the `.INP` file extension and are stored in a proprietary binary format.

## The Access Problem

### No Open Tooling

Unlike `.docx`, `.odt`, or `.pdf`, InPage's format has never been documented or standardized. There are no open-source libraries, no importers in LibreOffice, no converters in Pandoc. The only application that can open `.INP` files is InPage itself.

### Version Fragmentation

InPage has released incompatible format versions over 30 years:

| Era | Version | Encoding | Status |
|---|---|---|---|
| 1994–2006 | InPage 1.x / 2.x | Proprietary byte-map (`0x04` prefix) | Abandoned by vendor |
| 2006–present | InPage 3.x | UTF-16LE with control codes | Current |

**InPage 3.x cannot open InPage 2.x files.** Users who upgrade lose access to their own documents unless they have an old installation. Newspapers, publishing houses, and government offices that created archives in the 1990s and 2000s face permanent document loss.

### Platform Lock-In

InPage is Windows-only. There is no Linux, macOS, iOS, or Android version. Organizations running Linux servers cannot programmatically process InPage documents. Mobile users cannot read them. Cloud pipelines cannot index them.

### The Web Version Gap

InPage released a web-based version, but as of 2026 it does not support importing local `.INP` files. Existing archives cannot be migrated.

## The Cultural Significance

Millions of Urdu-language documents exist in `.INP` format:

- **Newspapers**: Urdu-language dailies (Jang, Nawa-i-Waqt, Dawn Urdu) composed their archives in InPage
- **Books**: Entire Urdu literature catalogs, poetry collections, religious texts
- **Government records**: Pakistani federal and provincial documents
- **Legal documents**: Court filings, contracts typeset in Urdu

Without tooling to read `.INP` files, this cultural record is inaccessible to any system that does not run Windows with InPage installed.

## Prior Work

The following open-source projects have partially reverse-engineered the format:

| Project | Language | License | Scope |
|---|---|---|---|
| [ltrc/inPageToUnicode](https://github.com/AArhamm/inPageToUnicode) | JavaScript | GPL-2.0 | V1/V2 character mapping |
| [KamalAbdali/InpageToUnicode](https://github.com/kamalabdali/InpageToUnicode) | C | Unknown | V1/V2 character mapping |
| [UmerCodez/unicode-inpage-converter](https://github.com/UmerCodez/unicode-inpage-converter) | C++ | Unknown | V1/V2 conversion |

These projects provide character mapping tables but do not:
- Parse the OLE2/CFB container
- Handle V3 (UTF-16LE) encoding
- Extract formatting metadata
- Filter binary noise from decoded text
- Handle page breaks or multi-page documents

## Goals of This Project

1. **Document the format completely** — Everything known, including gaps and uncertainties
2. **Provide tested reference implementations** — Not proof-of-concepts, but tested library code
3. **Be language-agnostic** — TypeScript and C# implementations demonstrate the algorithms so any developer can port them
4. **Be honest about limitations** — Unknown byte sequences, unverified assumptions, and open problems are documented as such

## Non-Goals

- **Rendering** — This project does not render Nastaliq text. Use a rendering engine (browser, Noto font, etc.)
- **InPage application** — This project does not interact with or replace the InPage application
- **Image extraction** — Embedded images are out of scope (not yet analyzed)
- **Layout** — Table, column, and master-page layout structures are not yet understood
