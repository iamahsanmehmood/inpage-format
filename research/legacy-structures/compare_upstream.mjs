// Run the pinned upstream function on the logical stream, without modifying it.
// Usage: node compare_upstream.mjs SOURCE_TS TYPESCRIPT_MODULE STREAM_BIN
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [sourcePath, compilerPath, streamPath] = process.argv.slice(2);
if (!sourcePath || !compilerPath || !streamPath) {
  throw new Error('Supply upstream format-extractor.ts, typescript.js, and extracted InPage100 stream');
}
const sha = x => createHash('sha256').update(x).digest('hex');
// Git checkouts can translate LF to CRLF on Windows; hash canonical LF text.
const source = Buffer.from(readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n'));
const stream = readFileSync(streamPath);
const expected = JSON.parse(readFileSync(new URL('./upstream-comparison.json', import.meta.url)));
if (sha(source) !== expected.source_sha256 || sha(stream) !== expected.stream_sha256) {
  throw new Error('Pinned upstream source or native stream hash mismatch');
}
const imported = await import(pathToFileURL(resolve(compilerPath)).href);
const ts = imported.default ?? imported;
const compiled = ts.transpileModule(source.toString('utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
}).outputText;
const reader = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const fonts = reader.extractFontTable(stream);
console.log(JSON.stringify({ upstream_commit: expected.upstream_commit,
  source_sha256: sha(source), source_hash_normalization: 'CRLF to LF',
  stream_sha256: sha(stream), upstream_fonts: fonts,
  upstream_font_count: fonts.length, observed_nonempty_ascii_slots: 7 }, null, 2));
if (fonts.length !== 0) process.exitCode = 1;
