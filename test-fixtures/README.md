# Test Fixtures

This directory contains minimal binary fixtures for unit testing the InPage decoders.

Fixtures are **not** full `.INP` documents — they are the smallest possible byte sequences that demonstrate a specific decoding behavior. This keeps the repository free of potentially copyrighted document content.

---

## Why Minimal Fixtures?

- InPage documents may contain copyrighted text.
- Small fixtures are self-documenting: you can read the bytes and understand exactly what is being tested.
- Fixtures can be regenerated from their hex descriptions if lost.

---

## Fixture Structure

Each fixture lives in its own directory:

```
test-fixtures/
└── <fixture-name>/
    ├── input.bin        Raw bytes (the content stream, NOT the OLE2 container)
    ├── expected.txt     Expected decoded output (UTF-8)
    └── README.md        What this fixture tests and how the bytes were generated
```

---

## Creating a Fixture

### From a hex string (PowerShell)

```powershell
# Create input.bin from hex bytes
$bytes = [byte[]](0x04, 0x81, 0x04, 0xBF, 0x0D)
[System.IO.File]::WriteAllBytes("input.bin", $bytes)
```

### From a hex string (Bash)

```bash
printf '\x04\x81\x04\xBF\x0D' > input.bin
```

### From an existing .INP file (extract just a few paragraphs)

Use a hex editor (HxD on Windows, xxd on Linux/macOS) to copy the bytes of the content stream starting after the OLE2 header. Take only the bytes you need for the specific test — typically 20–100 bytes.

---

## Existing Fixtures

*(None committed yet — add yours via PR, following CONTRIBUTING.md)*

---

## Fixture Naming Convention

Use descriptive names that explain the test case:

| Name | Tests |
|---|---|
| `v1-alef` | Basic single-char V1 decoding |
| `v1-composite-alef-hamza` | Composite sequence (أ) |
| `v1-page-break` | Form Feed → PAGE_BREAK_MARKER |
| `v1-word-spacing` | pendingSpace word recovery |
| `v1-diacritic-c3` | Alternate diacritic byte 0xC3 (Hamza Below) |
| `v3-simple-paragraph` | Basic V3 UTF-16LE extraction |
| `v3-control-code-skip` | V3 control code injection filtering |
| `v3-boundary-fallback` | V3 boundary marker below 0x1000 |

---

## Privacy Guidelines

- Never commit a full `.INP` document without explicit permission.
- Strip the OLE2 container — commit only the raw stream bytes.
- Use synthetic test data (hand-crafted hex) when possible.
- If extracting from a real document, take only the minimal slice needed.
