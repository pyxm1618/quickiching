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

/**
 * Aggregates 3 consecutive Home Mobile Lighthouse samples.
 * Rules:
 * - Exactly 3 samples required; all must be valid without runtime errors or missing metrics.
 * - Performance: median
 * - LCP: median
 * - CLS: max
 * - TBT: max
 * - imageBytes: max
 * - maxImageBytes: max
 * - scriptBytes: max
 */
export function aggregateHomeMobileSamples(samples) {
  assert(Array.isArray(samples) && samples.length === 3, 'Home Mobile requires exactly 3 valid Lighthouse samples');
  const requiredMetrics = ['performance', 'lcp', 'cls', 'tbt', 'imageBytes', 'maxImageBytes', 'scriptBytes'];
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    assert(sample && typeof sample === 'object', `Home Mobile sample #${i + 1} is missing or invalid`);
    assert(!sample.runtimeError, `Home Mobile sample #${i + 1} has runtime error: ${sample.runtimeError}`);
    for (const key of requiredMetrics) {
      assert(
        Number.isFinite(sample[key]) && sample[key] >= 0,
        `Home Mobile sample #${i + 1}: missing or invalid metric ${key} (${sample[key]})`
      );
    }
  }

  const sortedPerformance = samples.map(s => s.performance).sort((a, b) => a - b);
  const sortedLcp = samples.map(s => s.lcp).sort((a, b) => a - b);

  return {
    sampleCount: 3,
    performance: sortedPerformance[1],
    lcp: sortedLcp[1],
    cls: Math.max(...samples.map(s => s.cls)),
    tbt: Math.max(...samples.map(s => s.tbt)),
    imageBytes: Math.max(...samples.map(s => s.imageBytes)),
    maxImageBytes: Math.max(...samples.map(s => s.maxImageBytes)),
    scriptBytes: Math.max(...samples.map(s => s.scriptBytes)),
  };
}

/**
 * Home Mobile regression guard against the post-optimization accepted baseline.
 * Enforces hard budget ceilings and regression formulas without arbitrary magic numbers.
 */
export function assertHomeMobileRegressionGuard(metrics, acceptedBaseline, logWarning = (msg) => console.warn(msg)) {
  assert(acceptedBaseline && typeof acceptedBaseline === 'object', 'Missing accepted baseline for Home Mobile regression guard');
  const requiredKeys = ['performance', 'lcp', 'cls', 'tbt', 'imageBytes', 'maxImageBytes', 'scriptBytes'];
  for (const key of requiredKeys) {
    assert(Number.isFinite(metrics[key]) && metrics[key] >= 0, `HOME_MOBILE: missing/invalid measured ${key}`);
    assert(Number.isFinite(acceptedBaseline[key]) && acceptedBaseline[key] >= 0, `HOME_MOBILE: missing/invalid baseline ${key}`);
  }

  // Hard resource and quality budgets
  assert(metrics.performance >= 90, `HOME_MOBILE: performance score ${metrics.performance} is below hard minimum 90`);
  assert(metrics.cls <= 0.1, `HOME_MOBILE: CLS ${metrics.cls} exceeds hard maximum 0.10`);
  assert(metrics.tbt <= 200, `HOME_MOBILE: TBT ${metrics.tbt}ms exceeds hard maximum 200ms`);
  assert(metrics.imageBytes <= 768 * 1024, `HOME_MOBILE: imageBytes ${metrics.imageBytes} exceeds budget 768KB`);
  assert(metrics.maxImageBytes <= 256 * 1024, `HOME_MOBILE: maxImageBytes ${metrics.maxImageBytes} exceeds budget 256KB`);
  assert(metrics.scriptBytes <= 320 * 1024, `HOME_MOBILE: scriptBytes ${metrics.scriptBytes} exceeds budget 320KB`);

  // Regression guard against accepted baseline
  assert(
    metrics.performance >= acceptedBaseline.performance - 5,
    `HOME_MOBILE: Lighthouse regression >5 points against accepted baseline (measured=${metrics.performance}, baseline=${acceptedBaseline.performance})`
  );
  const maxAllowedLcp = acceptedBaseline.lcp * 1.1 + 100;
  assert(
    metrics.lcp <= maxAllowedLcp,
    `HOME_MOBILE: LCP regression >10% +100ms against accepted baseline (measured=${metrics.lcp.toFixed(1)}ms, maxAllowed=${maxAllowedLcp.toFixed(1)}ms, baseline=${acceptedBaseline.lcp.toFixed(1)}ms)`
  );

  // CWV 2.5s product target warning (does not fail CI, but flags as not CWV Good)
  if (metrics.lcp > PERFORMANCE_TARGETS.lcp) {
    logWarning(
      `[WARNING] HOME_MOBILE median LCP (${metrics.lcp.toFixed(1)}ms) exceeds the 2500ms product target. Regression guard passed within accepted lab tolerance, but this is NOT CWV Good.`
    );
  }
}
