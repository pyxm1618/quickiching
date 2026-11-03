import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { metricsFromReport } from "../performance-budget.mjs";

const config = JSON.parse(await readFile(new URL("../../config/performance-gates.json", import.meta.url), "utf8"));
const base = process.env.PUBLIC_V1_TEST_BASE_URL ?? "http://127.0.0.1:3001";
const chrome = process.env.CHROME_PATH;
assert(chrome, "CHROME_PATH_REQUIRED");
const targetIds = JSON.parse(process.env.CI_PERFORMANCE_TARGETS || "[]");
assert(Array.isArray(targetIds), "CI_PERFORMANCE_TARGETS must be a JSON array");
const outDir = resolve(".artifacts/ci-lighthouse");
await mkdir(outDir, { recursive: true });

function getByPath(value, path) {
  return path.split(".").reduce((current, key) => current?.[key], value);
}
function runLighthouse(url, target, output) {
  const args = [
    url,
    "--quiet",
    ...(target.device === "desktop" ? ["--preset=desktop"] : []),
    "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage",
    "--only-categories=performance,accessibility,seo",
    "--output=json",
    `--output-path=${output}`,
  ];
  const result = spawnSync("./node_modules/.bin/lighthouse", args, {
    stdio: "inherit",
    env: { ...process.env, CHROME_PATH: chrome },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Lighthouse exited ${result.status} for ${url}`);
}
async function summarize(path) {
  const report = JSON.parse(await readFile(path, "utf8"));
  const resource = metricsFromReport(report);
  return {
    ...resource,
    performance: Math.round((report.categories.performance?.score ?? 0) * 100),
    accessibility: Math.round((report.categories.accessibility?.score ?? 0) * 100),
    seo: Math.round((report.categories.seo?.score ?? 0) * 100),
  };
}
function median(values) {
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted[Math.floor(sorted.length / 2)];
}
function aggregate(samples, selection) {
  if (samples.length === 1 || selection === "single") return samples[0];
  if (selection === "median-lcp") {
    const ordered=[...samples].sort((a,b)=>a.lcp-b.lcp);
    return ordered[Math.floor(ordered.length/2)];
  }
  return {
    performance: median(samples.map(s=>s.performance)),
    accessibility: Math.min(...samples.map(s=>s.accessibility)),
    seo: Math.min(...samples.map(s=>s.seo)),
    lcp: median(samples.map(s=>s.lcp)),
    cls: Math.max(...samples.map(s=>s.cls)),
    tbt: Math.max(...samples.map(s=>s.tbt)),
    imageBytes: Math.max(...samples.map(s=>s.imageBytes)),
    maxImageBytes: Math.max(...samples.map(s=>s.maxImageBytes)),
    scriptBytes: Math.max(...samples.map(s=>s.scriptBytes)),
  };
}
function check(id, metrics, target) {
  const limits = target.metrics;
  const min = (key, value) => {
    if (value === null || value === undefined) return;
    assert(metrics[key] >= value, `${id}: ${key}=${metrics[key]} below ${value}`);
  };
  const max = (key, value) => {
    if (value === null || value === undefined) return;
    assert(metrics[key] <= value, `${id}: ${key}=${metrics[key]} above ${value}`);
  };
  min("performance", limits.performanceMin);
  min("accessibility", limits.accessibilityMin);
  min("seo", limits.seoMin);
  max("lcp", limits.lcpMaxMs);
  max("cls", limits.clsMax);
  max("tbt", limits.tbtMaxMs);
  max("imageBytes", limits.imageBytesMax);
  max("maxImageBytes", limits.maxImageBytesMax);
  max("scriptBytes", limits.scriptBytesMax);
}
async function checkBaseline(id, metrics, target) {
  if (!target.baseline) return;
  const raw = JSON.parse(await readFile(resolve(target.baseline.file), "utf8"));
  const baseline = getByPath(raw, target.baseline.key);
  assert(baseline, `${id}: baseline ${target.baseline.file}#${target.baseline.key} missing`);
  const tolerance = config.regressionTolerance;
  if (Number.isFinite(baseline.performance)) {
    assert(metrics.performance >= baseline.performance - tolerance.performancePoints,
      `${id}: performance regression exceeds ${tolerance.performancePoints} points`);
  }
  if (Number.isFinite(baseline.lcp)) {
    const max = baseline.lcp * (1 + tolerance.lcpPercent / 100) + tolerance.lcpAllowanceMs;
    assert(metrics.lcp <= max, `${id}: LCP regression exceeds ${tolerance.lcpPercent}% + ${tolerance.lcpAllowanceMs}ms`);
  }
}

const results = {};
for (const id of targetIds) {
  const target = config.targets[id];
  assert(target, `Unknown performance target: ${id}`);
  if (target.fixture === "completed-reading") {
    if (!resultGateRan) {
      console.log("[CI Lighthouse] completed-reading targets use the dedicated seeded result-lighthouse gate");
      const result = spawnSync("node", ["scripts/result-lighthouse-gate.mjs"], {
        stdio: "inherit",
        env: { ...process.env, PUBLIC_V1_TEST_BASE_URL: base, CHROME_PATH: chrome },
      });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error("result-lighthouse-gate failed");
      resultGateRan = true;
    }
    results[id] = { delegated: "scripts/result-lighthouse-gate.mjs" };
    continue;
  }

  const url = new URL(target.path, base).toString();
  const warmupCount = target.samplePolicy?.warmupCount ?? 0;
  for (let i=0;i<warmupCount;i++) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${id}: warmup HTTP ${response.status}`);
  }
  const samples=[];
  const count=target.samplePolicy?.count ?? 1;
  for (let i=1;i<=count;i++) {
    const output=resolve(outDir, `${id.replaceAll(".","-")}-${i}.json`);
    runLighthouse(url,target,output);
    samples.push(await summarize(output));
  }
  const metrics=aggregate(samples,target.samplePolicy?.selection ?? "single");
  check(id,metrics,target);
  await checkBaseline(id,metrics,target);
  results[id]={metrics,samplePolicy:target.samplePolicy};
  console.log(`[CI Lighthouse] ${id} PASS ${JSON.stringify(metrics)}`);
}
await writeFile(resolve(outDir,"summary.json"),JSON.stringify(results,null,2));
