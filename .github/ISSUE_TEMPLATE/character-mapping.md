---
name: Character mapping issue
about: A byte decodes to the wrong character, or a character is missing
title: '[char-map] byte 0xXX decodes to wrong character'
labels: character-map
assignees: ''
---

## Byte value
`0x??`  (e.g. `0xC3`)

## Expected Unicode output
Character: ` ` (paste here)
Unicode: `U+????`
Name: e.g. "Arabic Hamza Below"

## Actual output
What character is currently rendered, or "missing / blank"

## Hex dump context
Paste 10–20 bytes around the problematic sequence:
```
Offset  00 01 02 03 04 05 06 07
0000C0  04 C3 04 82 ...
```

## InPage version
- [ ] v1.x (`InPage100` stream)
- [ ] v2.x (`InPage200` stream)
- [ ] v3.x (`InPage300` stream)

## How discovered
e.g. "Comparison between InPage screenshot and library output"
