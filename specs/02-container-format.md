# Container Format: OLE2 / CFB

InPage `.INP` files use the **OLE2 Compound File Binary (CFB)** format — the same container format used by legacy Microsoft Office files (`.doc`, `.xls`, `.ppt`). This is a structured storage format that packs multiple named streams into a single file.

## Magic Signature

Every valid OLE2 file begins with this 8-byte signature at offset 0:

```
D0 CF 11 E0 A1 B1 1A E1
```

Files that do not begin with this signature are not InPage documents. Reject them with a clear error.

## File Size Constraints

| Constraint | Value | Rationale |
|---|---|---|
| Minimum size | 512 bytes | Smallest valid OLE2 sector |
| Maximum recommended | 50 MB | Protects against decompression bombs |

## Stream Layout

An InPage document contains up to three named streams:

| Stream Name | Required | Purpose |
|---|---|---|
| `Root Entry` | Yes | OLE2 container root (always present) |
| `DocumentInfo` | No | Document metadata (author, title, page count) |
| `InPage100` | Exclusive | Content — InPage v1.x files |
| `InPage200` | Exclusive | Content — InPage v2.x files |
| `InPage300` | Exclusive | Content — InPage v3.x files |

Only **one** of `InPage100`, `InPage200`, or `InPage300` will be present. The stream name indicates the document version.

## Version Detection

```
IF stream "InPage300" present → version 3 (UTF-16LE)
IF stream "InPage200" present → version 2 (legacy 0x04-prefix)
IF stream "InPage100" present → version 1 (legacy 0x04-prefix)
ELSE → not an InPage file
```

Version 1 and version 2 use the same encoding (both use the `0x04`-prefix character map). The decoder logic is identical for both.

## Parsing with Existing Libraries

Do not write a CFB parser from scratch. Use a well-tested OLE2 library for your language:

| Language | Library |
|---|---|
| JavaScript / TypeScript | `cfb` (SheetJS) — `npm install cfb` |
| C# / .NET | `OpenMcdf` — `dotnet add package OpenMcdf` |
| Python | `olefile` — `pip install olefile` |
| Java | Apache POI `POIFS` |
| Go | `github.com/richardlehane/mscfb` |

## DocumentInfo Stream

The optional `DocumentInfo` stream contains document metadata. The structure is not fully reverse-engineered, but it appears to be UTF-16LE key-value pairs encoding the document title, author name, and creation date. This stream can be ignored for text extraction.

## Security: Exploit Patterns

InPage files have been used as exploit delivery mechanisms in APT campaigns (see `specs/08-security.md`). Before parsing the content stream, scan the raw bytes for known exploit markers:

| Pattern | Type | Description |
|---|---|---|
| `68 72 68 72` (bytes) | Egg-hunter | CVE-2017-12824 shellcode stage 1 |
| `LuNdLuNd` (ASCII) | Shellcode marker | CVE-2017-12824 shellcode payload |

If either pattern is found, reject the file and report a security error. **Do not attempt to parse the content.**

## Example: Stream Extraction (TypeScript)

```typescript
import * as CFB from 'cfb';

const cfbFile = CFB.read(new Uint8Array(buffer), { type: 'array' });

// Version detection from FullPaths
const paths: string[] = cfbFile.FullPaths || [];
let version: 1 | 2 | 3 | null = null;
let streamName = '';

for (const path of paths) {
  const name = path.replace(/^\//, '').replace(/\/$/, '');
  if (name === 'InPage300') { version = 3; streamName = 'InPage300'; break; }
  if (name === 'InPage200') { version = 2; streamName = 'InPage200'; break; }
  if (name === 'InPage100') { version = 1; streamName = 'InPage100'; break; }
}

// Stream extraction
const entry = CFB.find(cfbFile, '/' + streamName);
const contentStream = new Uint8Array(entry.content);
```

## Example: Stream Extraction (C#)

```csharp
using OpenMcdf;

using var cf = new CompoundFile(filePath);

// Version detection
string streamName;
int version;
if (cf.RootStorage.TryGetStorage("InPage300") != null ||
    HasStream(cf, "InPage300")) {
  streamName = "InPage300"; version = 3;
} else if (HasStream(cf, "InPage200")) {
  streamName = "InPage200"; version = 2;
} else if (HasStream(cf, "InPage100")) {
  streamName = "InPage100"; version = 1;
} else {
  throw new InvalidDataException("No InPage content stream found.");
}

// Read stream bytes
var stream = cf.RootStorage.GetStream(streamName);
byte[] content = stream.GetData();
```
