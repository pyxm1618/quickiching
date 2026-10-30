import assert from 'node:assert/strict';

export const PERFORMANCE_TARGETS = Object.freeze({ lcp: 2500, cls: 0.1, interactionLatency: 200 });
// 10% lab LCP tolerance is a CI guard, never a claim of CWV Good or field INP.
export function assertPerformanceBudget(label, metrics, desktop = false, baseline) {
  const limits = { performance: desktop ? 95 : 90, lcp: 2750, cls: 0.1, tbt: 200,
    imageBytes: (desktop ? 1536 : 768) * 1024, maxImageBytes: (desktop ? 768 : 256) * 1024, scriptBytes: 320 * 1024 };
  for (const [key, limit] of Object.entries(limits)) {
    assert(Number.isFinite(metrics[key]) && metrics[key] >= 0, `${label}: missing/invalid ${key}`);
    assert(key === 'performance' ? metrics[key] >= limit : metrics[key] <= limit,
      `${label}: ${key}=${metrics[key]} violates ${key === 'performance' ? 'minimum' : 'maximum'} ${limit}`);
  }
  if (baseline) {
    assert(metrics.performance >= baseline.performance - 5, `${label}: Lighthouse regression >5 points`);
    assert(metrics.lcp <= baseline.lcp * 1.1 + 100, `${label}: LCP regression >10% +100ms`);
  }
}

export function metricsFromReport(report) {
  assert(report && !report.runtimeError, `Lighthouse runtime failure: ${report?.runtimeError?.message ?? 'missing report'}`);
  const numeric = id => {
    const value = report.audits?.[id]?.numericValue;
    assert(Number.isFinite(value), `Lighthouse missing ${id}`);
    return value;
  };
  const score = report.categories?.performance?.score;
  assert(Number.isFinite(score), 'Lighthouse missing performance score');
  const requests = report.audits?.['network-requests']?.details?.items;
  assert(Array.isArray(requests), 'Lighthouse missing network requests');
  const images = requests.filter(item => item.resourceType === 'Image');
  const transfer = item => { assert(Number.isFinite(item.transferSize), `Missing transferSize: ${item.url}`); return item.transferSize; };
  return { performance: score * 100, lcp: numeric('largest-contentful-paint'), cls: numeric('cumulative-layout-shift'), tbt: numeric('total-blocking-time'),
    imageBytes: images.reduce((sum, item) => sum + transfer(item), 0), maxImageBytes: Math.max(0, ...images.map(transfer)),
    scriptBytes: requests.filter(item => item.resourceType === 'Script').reduce((sum, item) => sum + transfer(item), 0) };
}
