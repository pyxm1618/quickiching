import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile('docs/performance/pr-76-assets.json', 'utf8'));
const assets = Object.values(manifest);
assert.equal(assets.length, 14, 'Delivery ledger must cover exactly 14 declared derivatives');
const expected = assets.map(asset => asset.url.split('/').at(-1)).sort();
assert.deepEqual((await readdir('public/performance')).sort(), expected, 'Unreviewed delivery file or missing derivative');
for (const asset of assets) {
  const source = await readFile(`public/${asset.source}`);
  const runtime = await readFile(`public${asset.url}`);
  assert.equal(hash(source), asset.sourceSha256, `Source changed: ${asset.source}; regenerate and review delivery`);
  assert.equal(hash(runtime), asset.sha256, `Runtime hash mismatch: ${asset.url}`);
  assert(asset.url.includes(`.${asset.sha256.slice(0, 16)}.`), `Non-versioned asset: ${asset.url}`);
  assert.equal(runtime.length, asset.bytes);
  assert(runtime.length <= 768 * 1024, `Oversized runtime image: ${asset.url}`);
}
const runtimeSources = await Promise.all([
  'src/components/public-reading/ritual.css', 'src/components/account/account.css',
  'src/components/public-reading/question-first.tsx', 'src/components/public-reading/three-coin-scene.tsx',
  'src/components/public-reading/three-coin-fallback.tsx', 'src/app/(default)/hexagrams/hexagrams-experience.tsx',
].map(path => readFile(path, 'utf8')));
for (const name of ['stageDesktop', 'accountCoins', 'platformDesktop', 'resultDesktop', 'coinFrontDesktop', 'coinBackDesktop']) {
  assert(!runtimeSources.some(source => source.includes('/' + manifest[name].source)), `Master restored to runtime: ${name}`);
}
for (const device of ['Desktop', 'Mobile']) {
  const textureBytes = manifest[`coinFront${device}`].bytes + manifest[`coinBack${device}`].bytes;
  assert(textureBytes <= 1024 * 1024, `${device} texture pair exceeds 1 MiB`);
}
// Includes inherited client layout chunks as well as page chunks; measured compressed build bytes.
const build = JSON.parse(await readFile('.next/app-build-manifest.json', 'utf8')).pages;
for (const route of ['/(default)/page', '/(default)/methods/three-coin/page', '/(default)/readings/three-coin/result/page', '/(default)/hexagrams/page', '/(default)/hexagrams/[slug]/page', '/(default)/my-readings/page', '/(localized)/zh/hexagrams/page', '/(localized)/zh/hexagrams/[slug]/page']) {
  assert(build[route], `Missing page manifest: ${route}`);
  const layout = route.startsWith('/(localized)') ? '/(localized)/zh/layout' : '/(default)/layout';
  assert(build[layout], `Missing layout manifest: ${layout}`);
  const chunks = [...new Set([...build[route], ...build[layout]])].filter(path => path.endsWith('.js'));
  const bytes = (await Promise.all(chunks.map(async path => gzipSync(await readFile(`.next/${path}`)).length))).reduce((sum, size) => sum + size, 0);
  console.log(`${route}: initial JS with inherited layout ${bytes} bytes gzip (limit 240 KiB)`);
  assert(bytes <= 240 * 1024, `${route}: initial JS regression`);
}
console.log('Asset coverage: original=14 pass=14 deferred=0 reject=0 unknown=0. Sources and content hashes verified.');
