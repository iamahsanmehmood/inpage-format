# Contributing to inpage-format

Thank you for contributing to this research project. Every contribution — a corrected character mapping, a new test fixture, a new language port — helps preserve access to Urdu documents.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How to Contribute](#how-to-contribute)
3. [Reporting Format Discoveries](#reporting-format-discoveries)
4. [Adding Character Mappings](#adding-character-mappings)
5. [Adding Test Fixtures](#adding-test-fixtures)
6. [Adding a New Language Library](#adding-a-new-language-library)
7. [Development Setup](#development-setup)
8. [Pull Request Guidelines](#pull-request-guidelines)
9. [Commit Message Format](#commit-message-format)

---

## Code of Conduct

Be respectful. This project serves Urdu/Arabic language communities. Contributions that demean or misrepresent these communities will be rejected.

---

## How to Contribute

| What you have | What to do |
|---|---|
| A wrong character renders for a specific `.INP` file | Open an issue with a hex dump |
| A new byte mapping discovered | Add it to `specs/05-character-maps.md` and both libraries |
| A test `.INP` file demonstrating an edge case | Add a fixture following `test-fixtures/README.md` |
| A new language implementation | Create `lib/<language>/` following the structure below |
| A format structure discovery | Document in the relevant `specs/` file and open a PR |

---

## Reporting Format Discoveries

When you find a byte sequence that decodes to a known glyph:

1. Open an issue titled: `[format] byte 0xXX decodes to U+XXXX <name>`
2. Include:
   - The raw hex bytes (e.g., `04 C3`)
   - The expected Unicode character and its name
   - How you discovered it (hex editor comparison, InPage screenshot, etc.)
   - Which InPage version / file version produced it

**Hex dump format** (use any hex editor, xxd, or HxD):
```
Offset  00 01 02 03 04 05 06 07  ASCII
0000C0  04 81 04 82 04 C3 04 9C  ....
```

---

## Adding Character Mappings

1. Update `specs/05-character-maps.md` — add a row to the appropriate table
2. Update `lib/javascript/src/char-maps.ts` — add to the relevant `Map`
3. Update `lib/dotnet/InPage.Format/CharMaps.cs` — add to the `Dictionary`
4. Add a unit test in both libraries verifying the new mapping
5. PR title: `feat(char-maps): add 0xXX → U+XXXX <name>`

**Important rules for character maps:**
- Always verify against multiple `.INP` files before adding
- Document whether a byte is a primary mapping or an alternate encoding
- For Arabic-mode overrides, add to `CHAR_MAP_ARABIC` / `ArabicOverrides`, not the main table
- Composites (multi-byte sequences) go in `COMPOSITE_SEQUENCES` and must be matched before single-byte lookups

---

## Adding Test Fixtures

Test fixtures are small binary snippets — not full `.INP` files — that demonstrate a specific decoding behavior.

**Format for a fixture:**
```
test-fixtures/
└── v1-alef-hamza/
    ├── input.bin        Raw bytes to decode (hex: 04 81 04 BF)
    ├── expected.txt     Expected Unicode output: أ
    └── README.md        What this fixture tests
```

**Privacy:** Never commit a full `.INP` document without explicit permission from its author. Extract the minimal byte sequence that demonstrates the behavior.

**Generating a fixture from a hex string:**
```bash
# Linux/macOS
printf '\x04\x81\x04\xBF' > test-fixtures/v1-alef-hamza/input.bin

# PowerShell
[byte[]](0x04,0x81,0x04,0xBF) | Set-Content test-fixtures/v1-alef-hamza/input.bin -Encoding Byte
```

---

## Adding a New Language Library

Create `lib/<language>/` following this structure:

```
lib/<language>/
├── README.md             Usage examples and build instructions
├── src/
│   ├── char-maps.*       Character mapping tables (from specs/05-character-maps.md)
│   ├── decoder.*         Main decoder (v1/v2 + v3 paths)
│   ├── text-filter.*     3-layer noise filter
│   └── types.*           Public interfaces/structs
└── tests/
    ├── char-maps.test.*  Verify all mappings in specs/05-character-maps.md
    ├── decoder.test.*    Verify V1 and V3 decoding paths
    └── text-filter.test.*  Verify all 3 filter layers
```

**Minimum requirements for a new language port:**
- All character mappings from `specs/05-character-maps.md` implemented
- Composite sequence matching before single-byte matching
- Both V1/V2 (0x04 prefix) and V3 (UTF-16LE) decoding paths
- 3-layer text filter
- Unit tests with 80%+ coverage
- README with build/test instructions

**Not required** (out of scope for this research library):
- OLE2/CFB container parsing — use an existing library for your language
- Rendering or display logic
- Export functionality

---

## Development Setup

### JavaScript / TypeScript

Requirements: Node.js 18+, npm 9+

```bash
cd lib/javascript
npm install
npm test          # Run all tests
npm run build     # Compile TypeScript
npm run typecheck # Type-check only
```

### C# / .NET

Requirements: .NET 8 SDK

```bash
cd lib/dotnet
dotnet restore
dotnet build
dotnet test
```

---

## Pull Request Guidelines

1. **One concern per PR.** A character map fix and a new spec section belong in separate PRs.
2. **Tests must pass.** Run `npm test` / `dotnet test` before submitting.
3. **Update both libraries.** If you add a character mapping, add it to TypeScript AND C# (or note in the PR that you need help with one language).
4. **Update the spec.** Format discoveries must be documented in `specs/` — code without documentation will not be merged.
5. **No breaking changes without a major version bump.** Public API changes require updating the CHANGELOG.

### PR Title Format

```
<type>(<scope>): <description>

Types: feat, fix, docs, test, refactor
Scopes: char-maps, decoder, filter, spec, javascript, dotnet
```

Examples:
- `feat(char-maps): add 0xC3 Hamza Below mapping`
- `fix(decoder): handle missing V3 boundary marker`
- `docs(spec): document group-7E property IDs`
- `test(javascript): add composite sequence edge cases`

---

## Commit Message Format

```
<type>(<scope>): <short description>

[optional body: what and why, not how]

[optional footer: Breaking changes, issue refs]
```

Example:
```
fix(decoder): recover word spacing in V1/V2 files

Non-text control bytes between character runs indicate word boundaries
in InPage v1/v2 encoding. Previously these were silently skipped,
causing adjacent words to merge. Now a pendingSpace flag is set on
any non-0x04 control byte encountered after decoded text.

Fixes #12
```
