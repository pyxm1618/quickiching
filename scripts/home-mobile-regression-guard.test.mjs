import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PERFORMANCE_TARGETS,
  assertPerformanceBudget,
  aggregateHomeMobileSamples,
  assertHomeMobileRegressionGuard,
} from "./performance-budget.mjs";

const ACCEPTED_BASELINE = Object.freeze({
  performance: 91,
  lcp: 3404.8562,
  cls: 0,
  tbt: 9.5,
  imageBytes: 148944,
  maxImageBytes: 59887,
  scriptBytes: 219380,
});

function validSample(overrides = {}) {
  return {
    performance: 91,
    lcp: 3404.8562,
    cls: 0,
    tbt: 9.5,
    imageBytes: 148944,
    maxImageBytes: 59887,
    scriptBytes: 219380,
    ...overrides,
  };
}

describe("Home Mobile Regression Guard & Median-of-3 Aggregation", () => {
  it("PASS: accepts measured samples matching the accepted baseline", () => {
    const samples = [
      validSample({ performance: 91, lcp: 3404.8562 }),
      validSample({ performance: 91, lcp: 3519.5227 }),
      validSample({ performance: 92, lcp: 3369.7856 }),
    ];
    const aggregated = aggregateHomeMobileSamples(samples);
    assert.equal(aggregated.sampleCount, 3);
    assert.equal(aggregated.performance, 91);
    assert.equal(aggregated.lcp, 3404.8562);
    assert.equal(aggregated.cls, 0);

    const warnings = [];
    assertHomeMobileRegressionGuard(aggregated, ACCEPTED_BASELINE, (msg) => warnings.push(msg));
    assert.equal(warnings.length, 1);
    assert(warnings[0].includes("exceeds the 2500ms product target"));
    assert(warnings[0].includes("NOT CWV Good"));
  });

  it("PASS: accepts slight variation within 10% + 100ms allowance", () => {
    // maxAllowed = 3404.8562 * 1.1 + 100 = 3845.34182
    const allowedLcp = 3840;
    const aggregated = validSample({ lcp: allowedLcp, performance: 90 });
    assert.doesNotThrow(() => {
      assertHomeMobileRegressionGuard(aggregated, ACCEPTED_BASELINE);
    });
  });

  it("FAIL: rejects LCP regression exceeding 10% + 100ms allowance", () => {
    // maxAllowed is ~3845.34ms. 3850ms must fail.
    const degradedLcp = 3850;
    const aggregated = validSample({ lcp: degradedLcp });
    assert.throws(
      () => assertHomeMobileRegressionGuard(aggregated, ACCEPTED_BASELINE),
      /LCP regression >10% \+100ms against accepted baseline/
    );
  });

  it("FAIL: rejects Lighthouse performance regression > 5 points against baseline", () => {
    // Baseline is 91 -> regression allowed down to 86, but hard floor is 90.
    // If baseline is 97 and measured is 91 (>5 drop), it must fail.
    const highBaseline = { ...ACCEPTED_BASELINE, performance: 97 };
    const aggregated = validSample({ performance: 91 });
    assert.throws(
      () => assertHomeMobileRegressionGuard(aggregated, highBaseline),
      /Lighthouse regression >5 points against accepted baseline/
    );
  });

  it("FAIL: rejects performance score below hard floor 90", () => {
    const aggregated = validSample({ performance: 89 });
    assert.throws(
      () => assertHomeMobileRegressionGuard(aggregated, ACCEPTED_BASELINE),
      /performance score 89 is below hard minimum 90/
    );
  });

  it("FAIL: rejects CLS > 0.10", () => {
    const aggregated = validSample({ cls: 0.105 });
    assert.throws(
      () => assertHomeMobileRegressionGuard(aggregated, ACCEPTED_BASELINE),
      /CLS 0.105 exceeds hard maximum 0.10/
    );
  });

  it("FAIL: rejects TBT > 200ms", () => {
    const aggregated = validSample({ tbt: 205 });
    assert.throws(
      () => assertHomeMobileRegressionGuard(aggregated, ACCEPTED_BASELINE),
      /TBT 205ms exceeds hard maximum 200ms/
    );
  });

  it("FAIL: rejects imageBytes exceeding 768KB budget", () => {
    const aggregated = validSample({ imageBytes: 768 * 1024 + 1 });
    assert.throws(
      () => assertHomeMobileRegressionGuard(aggregated, ACCEPTED_BASELINE),
      /imageBytes .* exceeds budget 768KB/
    );
  });

  it("FAIL: rejects maxImageBytes exceeding 256KB budget", () => {
    const aggregated = validSample({ maxImageBytes: 256 * 1024 + 1 });
    assert.throws(
      () => assertHomeMobileRegressionGuard(aggregated, ACCEPTED_BASELINE),
      /maxImageBytes .* exceeds budget 256KB/
    );
  });

  it("FAIL: rejects scriptBytes exceeding 320KB budget", () => {
    const aggregated = validSample({ scriptBytes: 320 * 1024 + 1 });
    assert.throws(
      () => assertHomeMobileRegressionGuard(aggregated, ACCEPTED_BASELINE),
      /scriptBytes .* exceeds budget 320KB/
    );
  });

  it("FAIL: rejects when samples count is not exactly 3", () => {
    assert.throws(
      () => aggregateHomeMobileSamples([validSample(), validSample()]),
      /Home Mobile requires exactly 3 valid Lighthouse samples/
    );
    assert.throws(
      () => aggregateHomeMobileSamples([validSample(), validSample(), validSample(), validSample()]),
      /Home Mobile requires exactly 3 valid Lighthouse samples/
    );
  });

  it("FAIL: rejects when any sample has a runtime error", () => {
    const samples = [
      validSample(),
      { runtimeError: "Chrome tab crashed during navigation" },
      validSample(),
    ];
    assert.throws(
      () => aggregateHomeMobileSamples(samples),
      /Home Mobile sample #2 has runtime error/
    );
  });

  it("FAIL: rejects when any sample is missing or has NaN metric", () => {
    const samplesMissingMetric = [
      validSample(),
      validSample({ lcp: NaN }),
      validSample(),
    ];
    assert.throws(
      () => aggregateHomeMobileSamples(samplesMissingMetric),
      /Home Mobile sample #2: missing or invalid metric lcp/
    );
  });

  it("aggregates medians and maximums correctly", () => {
    const samples = [
      validSample({ performance: 91, lcp: 3400, cls: 0.01, tbt: 10, imageBytes: 100000, maxImageBytes: 40000, scriptBytes: 200000 }),
      validSample({ performance: 93, lcp: 3500, cls: 0.05, tbt: 5,  imageBytes: 120000, maxImageBytes: 50000, scriptBytes: 210000 }),
      validSample({ performance: 92, lcp: 3300, cls: 0.02, tbt: 20, imageBytes: 110000, maxImageBytes: 45000, scriptBytes: 190000 }),
    ];
    const agg = aggregateHomeMobileSamples(samples);
    assert.equal(agg.performance, 92); // median of 91, 92, 93
    assert.equal(agg.lcp, 3400);        // median of 3300, 3400, 3500
    assert.equal(agg.cls, 0.05);        // max of 0.01, 0.05, 0.02
    assert.equal(agg.tbt, 20);          // max of 10, 5, 20
    assert.equal(agg.imageBytes, 120000);
    assert.equal(agg.maxImageBytes, 50000);
    assert.equal(agg.scriptBytes, 210000);
  });

  it("CONFIRM: public assertPerformanceBudget still strictly enforces 2750ms for other mobile pages", () => {
    // Confirm other pages are not relaxed and will still fail if LCP > 2750ms
    const otherMobilePage = {
      performance: 92,
      lcp: 2751,
      cls: 0,
      tbt: 0,
      imageBytes: 100000,
      maxImageBytes: 50000,
      scriptBytes: 100000,
    };
    assert.throws(
      () => assertPerformanceBudget("OTHER_MOBILE_PAGE", otherMobilePage, false),
      /violates maximum 2750/
    );
  });
});
