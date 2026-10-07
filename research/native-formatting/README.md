# Controlled native formatting evidence

I compared 15 Urdu files from InPage2014 Khattat Professionals. Read
[the evidence note](../../specs/native-formatting-evidence.md) for the measured
results, producing-application evidence, and remaining uncertainties.
`reader.py` supports this single-paragraph InPage100 header profile; it is a
conservative research reader rather than a complete format parser.

The complete originals are included in [`fixtures/`](fixtures/), with their
creator's permission, under the repository's MIT licence. The test line,
metadata, and font-slot bytes are available for reviewers to inspect.
`evidence.json` pins every file and logical stream by SHA-256. The reference
is `02-control-a.inp`, whose stream matches the other two unchanged controls.
The saved baseline body is Naskh, **11 pt**.

## Reproduce the native evidence

Python 3.10+, from the repository root:

```sh
python -m pip install -r research/native-formatting/requirements.txt
python research/native-formatting/verify.py
python -m unittest discover -s research/native-formatting -p test_reader.py -v
```

No private folder, extracted stream, or native application is needed. The
verifier defaults to the committed fixtures, checks complete file/stream
hashes before reading the formatting, and reproduces the baseline/control
differences. All inputs are read only. To save a report to a new filename:

```sh
python research/native-formatting/verify.py --report reproduced-report.json
```

An explicit folder remains available as an optional positional argument.
`olefile==0.47` is the pinned dependency; it is not copied into this research
folder. `verified-report.json` records verification of the complete fixtures.
Native reopening was confirmed by the creator; the verifier does not launch
InPage or establish visual rendering.

The 15 excerpt tests check length framing, exact envelope rebuilding,
fractional sizes, explicit zero alignment, composition and rejection of
unsupported or malformed fields. The native verifier also runs seven
in-memory malformed-input checks. Those mutations are not native fixtures.

## Independent container check and upstream comparison

With Node.js 18+, install the comparison dependencies in this research folder:

```sh
npm install --prefix research/native-formatting --no-save --package-lock=false --ignore-scripts cfb@1.2.2 typescript@5
node research/native-formatting/compare_cfb.mjs research/native-formatting/node_modules/cfb/cfb.js research/native-formatting/fixtures reproduced-cfb-report.json
node research/native-formatting/compare_upstream.mjs lib/javascript/src/format-extractor.ts research/native-formatting/node_modules/typescript/lib/typescript.js research/native-formatting/node_modules/cfb/cfb.js research/native-formatting/fixtures reproduced-upstream-report.json
```

Both scripts read the committed `.inp` files directly and validate their
hashes. The second reader is SheetJS `cfb` 1.2.2. The upstream comparison checks
the canonical-LF source hash from commit
`45105c60b35b59a69b7bbdee7d76bf539abf9968` before invoking its functions;
the TypeScript compiler is 5.x. No dependency is downloaded by the scripts,
and report filenames must be new.

All 15 documents were used for discovery. Body/CR ownership remains inferred
for this profile; word-specific ownership and an independent native test
remain unverified. See [`provenance/producer.json`](provenance/producer.json)
for the observed About branding, version resources and executable hash. Branding and version resources are recorded separately
from the document-format family; this is not identified as InPage 3.
