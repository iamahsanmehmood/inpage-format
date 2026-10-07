// Compare the unchanged upstream source with the complete committed fixtures.
// Arguments: source.ts, typescript.js, cfb.js, fixture directory, report.json
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [sourcePath, compilerPath, cfbPath, fixturesDir, reportPath] = process.argv.slice(2);
process.on('uncaughtException', () => { console.error('FAIL: upstream comparison did not complete'); process.exitCode=1; });
const sha = x => createHash('sha256').update(x).digest('hex');
const source = readFileSync(sourcePath, 'utf8').replace(/\r\n/g,'\n');
const pinned = '3afcbc12f8860e8f24576e6eb9bceeb8c7e2df8228059434736b4aa1d21366bf';
if (sha(source)!==pinned) throw new Error('Pinned upstream source hash mismatch');
const tsImport = await import(pathToFileURL(resolve(compilerPath)).href);
const ts = tsImport.default ?? tsImport;
const cfbImport = await import(pathToFileURL(resolve(cfbPath)).href);
const cfb = cfbImport.default ?? cfbImport;
if (cfb.version!=='1.2.2') throw new Error('Unexpected cfb version');
const compiled = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const upstream = await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const evidence = JSON.parse(readFileSync(new URL('./evidence.json',import.meta.url)));
const results = evidence.samples.map(sample => {
  const raw = readFileSync(resolve(fixturesDir,sample.file));
  if (sha(raw)!==sample.file_sha256) throw new Error('Native original file hash mismatch');
  const container = cfb.read(raw,{type:'buffer'});
  const entry = cfb.find(container,'InPage100');
  if (!entry) throw new Error('Native InPage100 stream missing');
  const data = entry.content;
  if (sha(data)!==sample.stream_sha256) throw new Error('Native stream hash mismatch');
  return {file:sample.file,stream_sha256:sha(data),font_count:upstream.extractFontTable(data).length,
    default_style:upstream.parseDefaultStyle(data),paragraph_format_count:upstream.extractParagraphFormats(data,2).length};
});
const report={upstream_commit:'45105c60b35b59a69b7bbdee7d76bf539abf9968',source_sha256:sha(source),source_hash_normalization:'CRLF to LF',results};
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({checked:results.length,font_counts:[...new Set(results.map(x=>x.font_count))],
  paragraph_format_counts:[...new Set(results.map(x=>x.paragraph_format_count))],
  default_font_sizes:[...new Set(results.map(x=>x.default_style.fontSize))]}));
