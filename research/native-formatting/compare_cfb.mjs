// Independent extraction: SheetJS cfb 1.2.2 versus recorded olefile bytes.
// Arguments: cfb.js module, native corpus directory, new report.json
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
process.on('uncaughtException', () => { console.error('FAIL: independent CFB extraction did not complete'); process.exitCode=1; });
const [modulePath, corpusPath, outputPath] = process.argv.slice(2);
const imported = await import(pathToFileURL(resolve(modulePath)).href);
const cfb = imported.default ?? imported;
if (cfb.version!=='1.2.2') throw new Error('Unexpected cfb version');
const sha = x => createHash('sha256').update(x).digest('hex');
const evidence = JSON.parse(readFileSync(new URL('./evidence.json',import.meta.url)));
const samples=evidence.samples.map(sample => {
  const raw=readFileSync(resolve(corpusPath,sample.file));
  if (sha(raw)!==sample.file_sha256) throw new Error('Native original file hash mismatch');
  const container=cfb.read(raw,{type:'buffer'});
  const stream=cfb.find(container,'InPage100');
  if (!stream || sha(stream.content)!==sample.stream_sha256) throw new Error('Independent logical stream hash mismatch');
  return {file:sample.file,stream_length:stream.content.length,stream_sha256:sha(stream.content),identical:true};
});
writeFileSync(outputPath,JSON.stringify({reader:'SheetJS cfb',version:cfb.version,compared_to:'olefile 0.47',passed:true,samples},null,2)+'\n',{flag:'wx'});
console.log('PASS: independent CFB extraction matches all '+samples.length+' native InPage100 streams');
