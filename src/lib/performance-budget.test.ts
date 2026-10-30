import { describe, it, expect } from 'vitest';
import { assertPerformanceBudget, metricsFromReport } from '../../scripts/performance-budget.mjs';
const good = { performance: 99, lcp: 900, cls: 0, tbt: 0, imageBytes: 200_000, maxImageBytes: 100_000, scriptBytes: 200_000 };
describe('performance release regression guard', () => {
  it('accepts a measured good page', () => expect(() => assertPerformanceBudget('page', good)).not.toThrow());
  it.each([{lcp:3800},{performance:65},{cls:0.11},{tbt:250},{imageBytes:900_000},{maxImageBytes:300_000},{scriptBytes:400_000}])('rejects regression %j', regression => {
    expect(() => assertPerformanceBudget('page', {...good,...regression})).toThrow();
  });
  it('does not turn missing or runtime-error reports into zero values', () => {
    expect(() => metricsFromReport({runtimeError:{message:'410'}})).toThrow();
    expect(() => metricsFromReport({audits:{},categories:{performance:{score:1}}})).toThrow();
  });
  it('compares only the same device and catches Lighthouse regression', () => {
    expect(() => assertPerformanceBudget('page', {...good,performance:90}, false, good)).toThrow();
  });
});
