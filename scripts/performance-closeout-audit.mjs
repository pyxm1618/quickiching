// Audit a production build with unchanged Lighthouse simulation. Anonymous states are
// recorded explicitly and never substituted for authenticated product acceptance.
import puppeteer from 'puppeteer-core';
import { navigation, desktopConfig } from 'lighthouse';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { assertPerformanceBudget, metricsFromReport } from './performance-budget.mjs';

const output = process.argv[2] || '.artifacts/performance-closeout/audit';
const base = process.env.PUBLIC_V1_TEST_BASE_URL || 'http://127.0.0.1:3046';
const paths = ['/', '/methods/three-coin', '/readings/three-coin/result', '/hexagrams', '/hexagrams/24-return', '/zh/hexagrams', '/zh/hexagrams/24-return', '/my-readings', '/?account=open'];
const selectedPaths = process.env.PERF_PATHS ? paths.filter(path => process.env.PERF_PATHS.split(',').includes(path)) : paths;
const devices = process.env.PERF_MOBILE_ONLY ? [false] : [false, true];
const results = [];
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome'),
  headless: true, args: ['--no-sandbox'],
});
await writeFile(`${output}/environment.json`, JSON.stringify({ node: process.version, browser: await browser.version(), buildId: (await readFile('.next/BUILD_ID', 'utf8')).trim(), base, simulation: 'Lighthouse mobile/desktop defaults; no throttling overrides' }, null, 2));

async function seedCompletedCast(page) {
  await page.goto(`${base}/robots.txt`);
  await page.evaluate(() => sessionStorage.setItem('quickiching:public-v1:three-coin', JSON.stringify(
    [9, 6, 7, 9, 7, 7].map((lineValue, lineIndex) => ({ lineIndex, lineValue,
      coinFaces: lineValue === 9 ? ['yang', 'yang', 'yang'] : lineValue === 6 ? ['yin', 'yin', 'yin'] : ['yang', 'yin', 'yin'], algorithmVersion: 'three-coin-v1' })),
  )));
}

try {
  for (const desktop of devices) for (const path of selectedPaths) {
    const id = `${desktop ? 'desktop' : 'mobile'}-${path === '/' ? 'home' : path.includes('account=') ? 'account' : path.slice(1).replaceAll('/', '-')}`;
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    try {
      await page.setViewport(desktop ? { width: 1350, height: 940, deviceScaleFactor: 1 } : { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
      if (path.includes('/result')) await seedCompletedCast(page);
      const { lhr } = await navigation(page, `${base}${path}`, {
        config: desktop ? desktopConfig : undefined,
        flags: { logLevel: 'error', onlyCategories: ['performance'], disableStorageReset: true },
      });
      await writeFile(`${output}/${id}.json`, JSON.stringify(lhr));
      const metrics = metricsFromReport(lhr);
      const requests = lhr.audits['network-requests'].details.items;
      const observation = await page.evaluate(() => ({
        url: location.href, dialog: !!document.querySelector('dialog[open]'),
        gate: document.querySelector('[data-completed-cast-gate]')?.getAttribute('data-completed-cast-gate'),
        text: document.body.innerText.slice(0, 500), webgl: document.querySelector('[data-renderer]')?.dataset.renderer,
        measures: performance.getEntriesByType('measure').map(entry => ({ name: entry.name, duration: entry.duration })),
        resources: performance.getEntriesByType('resource').map(entry => ({ url: entry.name, size: entry.transferSize, duration: entry.duration })),
      }));
      if (path.includes('/result') && observation.gate !== 'auth-required') throw new Error('Expected actual completed-cast auth gate, not an empty result');
      if (path.includes('account=') && !observation.dialog) throw new Error('Account dialog did not open');
      await page.screenshot({ path: `${output}/${id}.png` });
      let budgetError = null;
      try { assertPerformanceBudget(id, metrics, desktop); } catch (error) { budgetError = String(error); }
      const record = { id, path, desktop, ...metrics, maxImage: metrics.maxImageBytes,
        images: requests.filter(request => request.resourceType === 'Image').map(({ url, transferSize, resourceSize, priority }) => ({ url, transferSize, resourceSize, priority })),
        fonts: requests.filter(request => request.resourceType === 'Font'), observation,
        status: budgetError ? 'FAIL' : 'PASS', budgetError,
        authenticatedAcceptance: path.includes('account=') ? 'DEFERRED: anonymous dialog error state only' : undefined,
      };
      results.push(record);
      console.log(JSON.stringify({ id, performance: metrics.performance, lcp: Math.round(metrics.lcp), cls: metrics.cls, tbt: metrics.tbt, imageBytes: metrics.imageBytes, maxImage: metrics.maxImageBytes, status: record.status }));
    } catch (error) {
      const message = String(error);
      const deferred = path === '/my-readings' && /410/.test(message);
      results.push({ id, status: deferred ? 'DEFERRED' : 'FAIL', error: message });
      console.error(id, message);
    } finally {
      await context.close();
      await writeFile(`${output}/summary.json`, JSON.stringify(results, null, 2));
    }
  }
} finally {
  await browser.close();
  const coverage = { originalTotal: selectedPaths.length * devices.length,
    pass: results.filter(result => result.status === 'PASS').length,
    deferred: results.filter(result => result.status === 'DEFERRED').length,
    reject: results.filter(result => result.status === 'FAIL').length,
    unknown: selectedPaths.length * devices.length - results.length };
  await writeFile(`${output}/coverage.json`, JSON.stringify(coverage, null, 2));
  if (coverage.originalTotal !== coverage.pass + coverage.deferred + coverage.reject + coverage.unknown) throw new Error('Coverage counts do not reconcile');
  if (process.argv.includes('--check') && (coverage.deferred || coverage.reject || coverage.unknown)) process.exitCode = 1;
}
