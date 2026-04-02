# Changelog

All notable changes to inpage-format are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-04-02

### Added — Initial Research Release

**Format Specifications**
- `specs/01-problem-statement.md` — Background on InPage and why no open tooling exists
- `specs/02-container-format.md` — OLE2/CFB container layout (magic signature, stream names)
- `specs/03-encoding-legacy.md` — v1/v2 `0x04`-prefix byte-pair encoding with composite sequences
- `specs/04-encoding-v3.md` — v3 UTF-16LE encoding, struct array, control code filtering
- `specs/05-character-maps.md` — Complete 110+ entry character mapping table, Arabic-Indic digits, diacritics
- `specs/06-formatting-structures.md` — Style tag-value binary structures, property IDs, unit conversions
- `specs/07-text-filtering.md` — 3-layer noise filter algorithm with rationale and thresholds
- `specs/08-security.md` — CVE-2017-12824 analysis, exploit markers, threat model

**TypeScript Library** (`lib/javascript/`)
- OLE2 version detection (InPage100/200/300 stream names)
- V1/V2 decoder: `0x04`-prefix + composite sequence resolution
- V3 decoder: UTF-16LE with struct array boundary detection and fallback scan
- Word spacing recovery via `pendingSpace` heuristic
- Page break detection (Form Feed 0x0C → `PAGE_BREAK_MARKER`)
- 3-layer text filter + deduplication
- Format extractor: font table, color palette, default style, per-paragraph styles
- Full unit test suite (Vitest)

**C# Library** (`lib/dotnet/`)
- Port of all TypeScript functionality to C# (.NET 8)
- `InPageDecoder.Parse(byte[])` main entry point
- `CharMaps` with all Urdu, Arabic-override, and composite mappings
- `TextFilter` with 3-layer filtering
- Full unit test suite (xUnit)
