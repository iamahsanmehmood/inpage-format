# Commit-ready InPage legacy-structure evidence

This contribution documents newly measured structures in a real public `.INP`
file and a reproducible font-reader gap. Start with [FINDINGS.md](FINDINGS.md).
It includes exact byte evidence, a lossless research reader, a verifier, tests,
and a patch for the reviewed `inpage-format` repository.

## Reproduce the native evidence

Python 3.10+ is sufficient; the CFB dependency is included with its license.
From this directory:

```sh
python verify.py --download story.inp --report reproduced-report.json
python -m unittest discover -s . -p "test_*.py" -v
```

If the pinned sample already exists:

```sh
python verify.py --input /path/to/story.inp
```

The verifier refuses to replace an existing download or report. It checks the
whole document and logical-stream SHA-256 hashes, the exact excerpts, directory
boundaries, all font slots, and the sized field. It reads without executing or
modifying the native document. `verified-native-report.json` and
`validation.json` record the runs completed during this investigation.

## Contribute to the existing community repository

`inpage-legacy-evidence.patch`, distributed next to this folder, applies to
`iamahsanmehmood/inpage-format` at commit
`45105c60b35b59a69b7bbdee7d76bf539abf9968`. It adds the finding to `specs/`,
links it from the existing container and formatting notes, and adds these tools
under `research/legacy-structures/`. It does not change the production decoder.

From a checkout of that commit, with a clean working tree:

```sh
git apply --check /path/to/inpage-legacy-evidence.patch
git apply /path/to/inpage-legacy-evidence.patch
python -m unittest discover -s research/legacy-structures -p "test_*.py" -v
```

Review the changes and commit them with a message such as:
`docs(format): document native InPage100 directory and font-slot evidence`.
The full native story file is excluded from the patch. Alternatively, commit
this directory as a standalone research contribution under its included license.

## Reproduce the upstream font-reader failure

In the pinned upstream checkout, install its existing JavaScript dependencies.
Extract the logical `InPage100` stream with any CFB reader. Then run:

```sh
node compare_upstream.mjs /path/to/format-extractor.ts /path/to/typescript/lib/typescript.js /path/to/InPage100.bin
```

The TypeScript source is `lib/javascript/src/format-extractor.ts` in the checkout.
The compiler module is normally `lib/javascript/node_modules/typescript/lib/typescript.js`.
The checked source returns zero fonts for the checked native stream.

## Scope

The contribution is evidence from one document. Directory semantics, font-table
location across documents, native font references, and visual style semantics
remain open. The reader intentionally takes an explicit font-block offset and
retains unknown bytes. This is new evidence relative to the reviewed sources,
not a completed implementation of all missing InPage features.
