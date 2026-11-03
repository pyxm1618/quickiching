import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

export const PERFORMANCE_GATE_CONFIG = Object.freeze(
  JSON.parse(readFileSync(new URL("../config/performance-gates.json", import.meta.url), "utf8")),
);

export function getPerformanceGateConfig(id) {
  const target = PERFORMANCE_GATE_CONFIG.targets?.[id];
  assert(target, `Unknown performance gate target: ${id}`);
  return target;
}

export const PERFORMANCE_TARGETS = Object.freeze({
  lcp: PERFORMANCE_GATE_CONFIG.productTargets.lcpGoodMs,
  cls: PERFORMANCE_GATE_CONFIG.defaults.clsMax,
  interactionLatency: PERFORMANCE_GATE_CONFIG.productTargets.interactionLatencyMs,
});

function legacyTarget(desktop) {
  return { metrics: PERFORMANCE_GATE_CONFIG.budgetDefaults[desktop ? "desktop" : "mobile"] };
}

// Compatibility API for existing gates. The authoritative values live in
// config/performance-gates.json; callers must not redefine thresholds.
export function assertPerformanceBudget(label, metrics, desktop = false, baseline) {
  const target = legacyTarget(desktop);
  const limits = target.metrics;
  const checks = [
    ["performance", limits.performanceMin, "min"],
    ["lcp", limits.lcpMaxMs, "max"],
    ["cls", limits.clsMax, "max"],
    ["tbt", limits.tbtMaxMs, "max"],
    ["imageBytes", limits.imageBytesMax, "max"],
    ["maxImageBytes", limits.maxImageBytesMax, "max"],
    ["scriptBytes", limits.scriptBytesMax, "max"],
  ];
  for (const [key, limit, direction] of checks) {
    if (limit === null || limit === undefined) continue;
    assert(Number.isFinite(metrics[key]) && metrics[key] >= 0, `${label}: missing/invalid ${key}`);
    assert(
      direction === "min" ? metrics[key] >= limit : metrics[key] <= limit,
      `${label}: ${key}=${metrics[key]} violates ${direction === "min" ? "minimum" : "maximum"} ${limit}`,
    );
  }
  if (baseline) {
    const tolerance = PERFORMANCE_GATE_CONFIG.regressionTolerance;
    assert(metrics.performance >= baseline.performance - tolerance.performancePoints,
      `${label}: Lighthouse regression >${tolerance.performancePoints} points`);
    assert(
      metrics.lcp <= baseline.lcp * (1 + tolerance.lcpPercent / 100) + tolerance.lcpAllowanceMs,
      `${label}: LCP regression >${tolerance.lcpPercent}% +${tolerance.lcpAllowanceMs}ms`,
    );
  }
}

export function metricsFromReport(report) {
  assert(report && !report.runtimeError, `Lighthouse runtime failure: ${report?.runtimeError?.message ?? "missing report"}`);
  const numeric = id => {
    const value = report.audits?.[id]?.numericValue;
    assert(Number.isFinite(value), `Lighthouse missing ${id}`);
    return value;
  };
  const score = report.categories?.performance?.score;
  assert(Number.isFinite(score), "Lighthouse missing performance score");
  const requests = report.audits?.["network-requests"]?.details?.items;
  assert(Array.isArray(requests), "Lighthouse missing network requests");
  const images = requests.filter(item => item.resourceType === "Image");
  const transfer = item => {
    assert(Number.isFinite(item.transferSize), `Missing transferSize: ${item.url}`);
    return item.transferSize;
  };
  return {
    performance: score * 100,
    lcp: numeric("largest-contentful-paint"),
    cls: numeric("cumulative-layout-shift"),
    tbt: numeric("total-blocking-time"),
    imageBytes: images.reduce((sum, item) => sum + transfer(item), 0),
    maxImageBytes: Math.max(0, ...images.map(transfer)),
    scriptBytes: requests.filter(item => item.resourceType === "Script").reduce((sum, item) => sum + transfer(item), 0),
  };
}

export function aggregateHomeMobileSamples(samples) {
  const target = getPerformanceGateConfig("home.mobile");
  const expected = target.samplePolicy.count;
  assert(Array.isArray(samples) && samples.length === expected, `Home Mobile requires exactly ${expected} valid Lighthouse samples`);
  const requiredMetrics = ["performance", "lcp", "cls", "tbt", "imageBytes", "maxImageBytes", "scriptBytes"];
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    assert(sample && typeof sample === "object", `Home Mobile sample #${i + 1} is missing or invalid`);
    assert(!sample.runtimeError, `Home Mobile sample #${i + 1} has runtime error: ${sample.runtimeError}`);
    for (const key of requiredMetrics) {
      assert(Number.isFinite(sample[key]) && sample[key] >= 0,
        `Home Mobile sample #${i + 1}: missing or invalid metric ${key} (${sample[key]})`);
    }
  }
  const sortedPerformance = samples.map(s => s.performance).sort((a, b) => a - b);
  const sortedLcp = samples.map(s => s.lcp).sort((a, b) => a - b);
  const middle = Math.floor(samples.length / 2);
  return {
    sampleCount: samples.length,
    performance: sortedPerformance[middle],
    lcp: sortedLcp[middle],
    cls: Math.max(...samples.map(s => s.cls)),
    tbt: Math.max(...samples.map(s => s.tbt)),
    imageBytes: Math.max(...samples.map(s => s.imageBytes)),
    maxImageBytes: Math.max(...samples.map(s => s.maxImageBytes)),
    scriptBytes: Math.max(...samples.map(s => s.scriptBytes)),
  };
}

export function assertHomeMobileRegressionGuard(metrics, acceptedBaseline, logWarning = (msg) => console.warn(msg)) {
  assert(acceptedBaseline && typeof acceptedBaseline === "object", "Missing accepted baseline for Home Mobile regression guard");
  const target = getPerformanceGateConfig("home.mobile");
  const limits = target.metrics;
  const tolerance = PERFORMANCE_GATE_CONFIG.regressionTolerance;
  const requiredKeys = ["performance", "lcp", "cls", "tbt", "imageBytes", "maxImageBytes", "scriptBytes"];
  for (const key of requiredKeys) {
    assert(Number.isFinite(metrics[key]) && metrics[key] >= 0, `HOME_MOBILE: missing/invalid measured ${key}`);
    assert(Number.isFinite(acceptedBaseline[key]) && acceptedBaseline[key] >= 0, `HOME_MOBILE: missing/invalid baseline ${key}`);
  }

  assert(metrics.performance >= limits.performanceMin, `HOME_MOBILE: performance score ${metrics.performance} is below hard minimum ${limits.performanceMin}`);
  assert(metrics.cls <= limits.clsMax, `HOME_MOBILE: CLS ${metrics.cls} exceeds hard maximum ${limits.clsMax}`);
  assert(metrics.tbt <= limits.tbtMaxMs, `HOME_MOBILE: TBT ${metrics.tbt}ms exceeds hard maximum ${limits.tbtMaxMs}ms`);
  assert(metrics.imageBytes <= limits.imageBytesMax, `HOME_MOBILE: imageBytes ${metrics.imageBytes} exceeds budget ${limits.imageBytesMax}`);
  assert(metrics.maxImageBytes <= limits.maxImageBytesMax, `HOME_MOBILE: maxImageBytes ${metrics.maxImageBytes} exceeds budget ${limits.maxImageBytesMax}`);
  assert(metrics.scriptBytes <= limits.scriptBytesMax, `HOME_MOBILE: scriptBytes ${metrics.scriptBytes} exceeds budget ${limits.scriptBytesMax}`);

  assert(metrics.performance >= acceptedBaseline.performance - tolerance.performancePoints,
    `HOME_MOBILE: Lighthouse regression >${tolerance.performancePoints} points against accepted baseline`);
  const maxAllowedLcp = acceptedBaseline.lcp * (1 + tolerance.lcpPercent / 100) + tolerance.lcpAllowanceMs;
  assert(metrics.lcp <= maxAllowedLcp,
    `HOME_MOBILE: LCP regression >${tolerance.lcpPercent}% +${tolerance.lcpAllowanceMs}ms against accepted baseline`);

  if (metrics.lcp > PERFORMANCE_TARGETS.lcp) {
    logWarning(`[WARNING] HOME_MOBILE median LCP (${metrics.lcp.toFixed(1)}ms) exceeds the ${PERFORMANCE_TARGETS.lcp}ms product target. Regression guard passed within accepted lab tolerance, but this is NOT CWV Good.`);
  }
}
