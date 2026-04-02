# inpage-format (JavaScript / TypeScript)

[![npm](https://img.shields.io/npm/v/inpage-format?color=cb3837&logo=npm)](https://www.npmjs.com/package/inpage-format)
[![CI](https://github.com/iamahsanmehmood/inpage-format/actions/workflows/ci.yml/badge.svg)](https://github.com/iamahsanmehmood/inpage-format/actions/workflows/ci.yml)

TypeScript library for decoding InPage `.INP` Urdu/Arabic word processor files.

**Works in Node.js 18+ and modern browsers (pure ESM, no native deps).**

## Install

```bash
npm install inpage-format
```

## Usage

```typescript
import * as CFB from 'cfb';
import { decodeV1V2, decodeV3, filterParagraphsWithMeta } from 'inpage-format';

const cfbFile = CFB.read(new Uint8Array(fileBuffer), { type: 'array' });
const entry = CFB.find(cfbFile, '/InPage200') ?? CFB.find(cfbFile, '/InPage300');
const stream = new Uint8Array(entry.content);
const version = entry.name.includes('300') ? 3 : 2;

const decoded = version === 3 ? decodeV3(stream) : decodeV1V2(stream);
const { paragraphs, filteredCount } = filterParagraphsWithMeta(
  decoded.paragraphs, decoded.paragraphMeta
);

paragraphs.forEach(p => console.log(p));
```

## API

| Export | Description |
|---|---|
| `decodeV1V2(data: Uint8Array)` | Decode InPage v1/v2 stream |
| `decodeV3(data: Uint8Array)` | Decode InPage v3 stream |
| `filterParagraphs(raw: string[])` | Remove noise paragraphs |
| `filterParagraphsWithMeta(raw, meta)` | Filter + return metadata + count |
| `CHAR_MAP_URDU` | 110+ byte→Unicode mappings |
| `CHAR_MAP_ARABIC` | Arabic-mode overrides |
| `COMPOSITE_SEQUENCES` | 4-byte composite sequence map |
| `isUrduChar(ch: string)` | Test if char is Urdu/Arabic |
| `PAGE_BREAK_MARKER` | Sentinel string for page breaks |

Full documentation: [github.com/iamahsanmehmood/inpage-format](https://github.com/iamahsanmehmood/inpage-format)
