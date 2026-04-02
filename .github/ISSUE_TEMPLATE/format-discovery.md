---
name: Format discovery
about: You found a new binary structure, byte sequence, or formatting property
title: '[format] description of discovery'
labels: format-research
assignees: ''
---

## What was discovered
Brief description of the binary structure / byte sequence.

## Binary evidence
```
Offset  00 01 02 03 04 05 06 07
000000  XX XX XX XX XX XX XX XX
```

## Interpretation
What you believe this encodes (e.g. "alignment = center", "page break", etc.)

## How it was found
e.g. "hex comparison of a file with known center-aligned text vs. left-aligned"

## InPage version
- [ ] v1.x
- [ ] v2.x
- [ ] v3.x

## Confidence
- [ ] Confirmed (tested in multiple files)
- [ ] Likely (one file, pattern makes sense)
- [ ] Speculative (educated guess)
