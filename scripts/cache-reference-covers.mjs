// Download the original exported covers unchanged; never generate substitutes.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const source = await readFile('apps/web/src/design/Reference.tsx', 'utf8');
const urls = [...new Set(source.match(/https:\/\/covers\.openlibrary\.org\/b\/isbn\/[\dX]+-L\.jpg/g))];
await mkdir('apps/web/public/design/covers', {recursive:true});
for (const url of urls) {
  try {
    const response = await fetch(url, { signal:AbortSignal.timeout(25000) });
    if (!response.ok) throw Error('HTTP '+response.status);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 1000) throw Error('Empty cover');
    const file = url.split('/').at(-1);
    await writeFile('apps/web/public/design/covers/'+file, bytes);
    console.log(file, bytes.length, response.url);
  } catch (error) { console.log('Unavailable:', url, error.message); }
}
