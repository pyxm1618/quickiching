/** Re-encode approved detail artwork; never changes the source PNGs or design geometry. */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const approved = JSON.parse(await readFile(new URL('docs/design/hexagram-detail/assets.json', root), 'utf8'));
const plans = [
  ['paper', 'background/paper-texture', [627, 1254]],
  ['paper-mobile', 'background/paper-texture', [627, 1254]],
  ['scene', 'background/lantern-scene', [1024]],
  ['scene-mobile', 'background/lantern-scene', [512, 640, 1024]],
  ['left-repeat', 'frame/left-middle-repeat', [160]],
  ['right-repeat', 'frame/right-middle-repeat', [162]],
  ['taiji', 'decorations/hero-taiji', [290, 360, 580, 660, 720, 1320]],
  ['top-scroll', 'frame/top-scroll', [480, 960, 1557]],
  ['bottom-scroll', 'frame/bottom-scroll', [480, 960, 1575]],
  ['left-top', 'frame/left-top', [160]],
  ['left-bottom', 'frame/left-bottom', [160]],
  ['right-top', 'frame/right-top', [162]],
  ['right-bottom', 'frame/right-bottom', [162]],
  ['cherry-top', 'decorations/cherry-branch-top-left', [24, 48, 190, 380]],
  ['cherry-bottom', 'decorations/cherry-branch-bottom-left', [24, 48, 144, 288]],
  ['pine', 'decorations/pine-branch-right', [40, 80]],
  ['landscape', 'decorations/ink-landscape', [200, 400]],
];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const entries = plans.flatMap(([name, source, widths]) => widths.map(width => ({
  source: `public/hexagram-detail/${source}.png`,
  path: `public/hexagram-detail/delivery/${name}-${width}.${name.startsWith('paper') || name.endsWith('-repeat') ? 'webp' : 'avif'}`, width, name, format: name.startsWith('paper') || name.endsWith('-repeat') ? 'webp' : 'avif', status: 'unknown',
})));
const report = { originalTotal: entries.length, states: { pass: 0, deferred: 0, reject: 0, unknown: entries.length }, paperEncoder: { quality: 75, effort: 6 }, encoder: { sharp: sharp.versions.sharp, libheif: sharp.versions.heif, options: { quality: 65, effort: 6, chromaSubsampling: '4:4:4' } }, entries };
const ledger = new URL('docs/design/hexagram-detail/delivery-assets.json', root);
await mkdir(new URL('public/hexagram-detail/delivery/', root), { recursive: true });
await writeFile(ledger, JSON.stringify(report, null, 2) + '\n');
for (const entry of entries) {
  const sourceBytes = await readFile(new URL(entry.source, root));
  const approval = approved.assets.find(asset => asset.path === entry.source);
  entry.sourceSha256 = sha256(sourceBytes);
  if (!approval || approval.status !== 'approved/pass' || approval.sha256 !== entry.sourceSha256) throw new Error(`UNAPPROVED_SOURCE: ${entry.source}`);
  const source = await sharp(sourceBytes).metadata();
  const sourceStats = await sharp(sourceBytes).stats();
  const resized = sharp(sourceBytes).resize({ width: entry.width, withoutEnlargement: true });
  entry.options = entry.name.endsWith('-repeat') ? { lossless: true, effort: 6 } : entry.format === 'webp' ? { ...report.paperEncoder, quality: entry.name === 'paper-mobile' ? 50 : 75 } : { ...report.encoder.options, quality: entry.name === 'scene-mobile' || (entry.name === 'taiji' && entry.width <= 580) ? 30 : 65 };
  const encoded = entry.format === 'webp' ? resized.webp(entry.options) : resized.avif(entry.options);
  await encoded.toFile(new URL(entry.path, root).pathname);
  const bytes = await readFile(new URL(entry.path, root));
  const decoded = await sharp(bytes).metadata();
  if (decoded.width !== entry.width || Math.abs(decoded.height / decoded.width - source.height / source.width) > 1 / entry.width || (!sourceStats.isOpaque && !decoded.hasAlpha)) throw new Error(`DELIVERY_GEOMETRY_OR_ALPHA_INVALID: ${entry.path}`);
  // Decode every output, not only its header, before declaring it valid.
  const decodedPixels = await sharp(bytes).ensureAlpha().raw().toBuffer();
  if (entry.options.lossless) {
    const sourcePixels = await sharp(sourceBytes).ensureAlpha().raw().toBuffer();
    for (let pixel = 0; pixel < sourcePixels.length; pixel += 4) {
      if (sourcePixels[pixel + 3] !== decodedPixels[pixel + 3] || (sourcePixels[pixel + 3] !== 0 && !sourcePixels.subarray(pixel, pixel + 4).equals(decodedPixels.subarray(pixel, pixel + 4)))) throw new Error(`VISIBLE_REPEAT_PIXELS_CHANGED: ${entry.path}`);
    }
    // WebP may canonicalize invisible RGB where alpha is zero; alpha and every visible RGBA pixel must match.
    entry.visiblePixelEquality = true;
    entry.alphaEquality = true;
  }
  Object.assign(entry, { height: decoded.height, hasAlpha: decoded.hasAlpha, bytes: bytes.length, sha256: sha256(bytes), status: 'pass' });
  report.states.unknown--; report.states.pass++;
  await writeFile(ledger, JSON.stringify(report, null, 2) + '\n');
}
if (Object.values(report.states).reduce((sum, count) => sum + count, 0) !== report.originalTotal || report.states.unknown !== 0) throw new Error('DELIVERY_COVERAGE_INVALID');
console.log(JSON.stringify({ ...report, entries: undefined, bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0) }));
