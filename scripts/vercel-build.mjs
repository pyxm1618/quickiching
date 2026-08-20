import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";

const BASE = "http://127.0.0.1:3000";

function log(message) {
  console.log(`[Public V1 + Free Reading V2 Gate] ${message}`);
}

function run(command, args, options = {}) {
  log(`$ ${command} ${args.join(" ")}`);
  const { env: extraEnv = {}, ...spawnOptions } = options;
  const result = spawnSync(command, args, {
    ...spawnOptions,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(" ")}`);
  }
}

function findSystemChrome() {
  for (const command of [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ]) {
    const result = spawnSync("which", [command], { encoding: "utf8" });
    const path = result.status === 0 ? result.stdout.trim() : "";
    if (path) return path;
  }
  return null;
}

async function fileHash(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function waitForServer() {
  for (let attempt = 1; attempt <= 80; attempt += 1) {
    try {
      const response = await fetch(BASE);
      if (response.ok) return;
    } catch {
      // Production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Production Next server did not become ready");
}

function lighthouseArgs(url, outputPath, desktop = false) {
  return [
    url,
    "--quiet",
    ...(desktop ? ["--preset=desktop"] : []),
    "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage",
    "--only-categories=performance,accessibility,seo",
    "--output=json",
    `--output-path=${outputPath}`,
  ];
}

async function summarizeLighthouse(label, path) {
  const report = JSON.parse(await readFile(path, "utf8"));
  const performance = Math.round(report.categories.performance.score * 100);
  const accessibility = Math.round(report.categories.accessibility.score * 100);
  const seo = Math.round(report.categories.seo.score * 100);
  const lcp = Math.round(report.audits["largest-contentful-paint"].numericValue);
  const cls = Number(report.audits["cumulative-layout-shift"].numericValue);
  const tbt = Math.round(report.audits["total-blocking-time"].numericValue);
  const lcpElement = report.audits["largest-contentful-paint-element"]?.details?.items?.[0]?.node?.snippet;

  log(`LIGHTHOUSE_${label} performance=${performance} accessibility=${accessibility} seo=${seo} LCP_ms=${lcp} CLS=${cls.toFixed(4)} TBT_ms=${tbt}`);
  if (lcpElement) log(`LIGHTHOUSE_${label}_LCP_ELEMENT ${lcpElement}`);
  if (lcp > 2500) log(`WARNING: ${label} lab LCP is above the 2.5s target (${lcp}ms)`);

  return { label, performance, accessibility, seo, lcp, cls, tbt };
}

function assertLighthouse(metrics) {
  const failures = [];
  for (const result of metrics) {
    if (result.accessibility < 90) failures.push(`${result.label} Lighthouse accessibility score below 90`);
    if (result.seo < 90) failures.push(`${result.label} Lighthouse SEO score below 90`);
    if (result.cls > 0.1) failures.push(`${result.label} CLS exceeds 0.10`);
    if (result.performance < 65 || result.lcp > 4000) failures.push(`${result.label} severe performance regression`);
  }
  if (failures.length > 0) throw new Error(failures.join("; "));
}

log(`Vercel context: env=${process.env.VERCEL_ENV || "unknown"} target=${process.env.VERCEL_TARGET_ENV || "unknown"} ref=${process.env.VERCEL_GIT_COMMIT_REF || "unknown"}`);
log("Running locked package-manager and quality gates");
run("bun", ["run", "lint"]);
run("bun", ["run", "typecheck"]);
run("bun", ["run", "test"]);
log("IndexNow gate is DRY_RUN only; production submission is intentionally forbidden here");
run("bun", ["run", "indexnow"]);
run("bun", ["run", "build"]);
run("bun", ["scripts/public-v1-server-action-gate.ts"]);
run("node", ["scripts/invalid-locale-server-log-gate.mjs"]);

const manifestHash = await fileHash("package.json");
const lockHash = await fileHash("bun.lock");
log("Installing ephemeral browser audit tooling without changing package.json or bun.lock");
const browserAuditCacheDir = process.env.BUN_AUDIT_CACHE_DIR || "/tmp/quickiching-bun-cache";
run("bun", [
  "install",
  "--no-save",
  `--cache-dir=${browserAuditCacheDir}`,
  "puppeteer-core@25.1.0",
  "@sparticuz/chromium@149.0.0",
  "lighthouse@13.4.1",
]);
if ((await fileHash("package.json")) !== manifestHash || (await fileHash("bun.lock")) !== lockHash) {
  throw new Error("Ephemeral browser tooling changed package.json or bun.lock");
}

const systemChromePath = findSystemChrome();
const { default: chromium } = await import("@sparticuz/chromium");
const chromePath = systemChromePath ?? await chromium.executablePath();
log(`Browser audit Chrome: ${chromePath} (${systemChromePath ? "system runner" : "serverless fallback"})`);

log("Capturing homepage SEO baseline from the verified production main deployment");
run("node", ["scripts/homepage-seo-audit.mjs"], {
  env: {
    PUBLIC_V1_TEST_BASE_URL: "https://www.quickiching.com",
    CHROME_PATH: chromePath,
    SEO_AUDIT_LABEL: "BEFORE",
  },
});

const server = spawn("bun", ["run", "start"], {
  env: { ...process.env, PORT: "3000", HOSTNAME: "127.0.0.1" },
  stdio: ["ignore", "inherit", "inherit"],
});

try {
  await waitForServer();
  const browserEnv = { PUBLIC_V1_TEST_BASE_URL: BASE, CHROME_PATH: chromePath };
  log("Production Next server is ready; running homepage SEO semantic audit");
  run("node", ["scripts/homepage-seo-audit.mjs"], {
    env: { ...browserEnv, SEO_AUDIT_LABEL: "AFTER", SEO_AUDIT_ASSERT: "1" },
  });

  log("Running real Chromium E2E and on-page SEO acceptance");
  run("bun", ["run", "seo:registry"]);
  run("bun", ["run", "seo:density"], {
    env: { ...browserEnv, HEXAGRAM_SEO_AUDIT_BASE_URL: BASE, HEXAGRAM_SEO_AUDIT_OUTPUT_DIR: "/tmp/quickiching-hexagram-seo-density" },
  });
  run("bun", ["run", "seo:browser"], { env: { ...browserEnv, HEXAGRAM_SEO_BROWSER_BASE_URL: BASE } });
  run("node", ["scripts/browser-gate.mjs"], { env: browserEnv });
  run("node", ["scripts/on-page-seo-browser-gate.mjs"], { env: browserEnv });
  run("node", ["scripts/three-coin-v2-browser-gate.mjs"], { env: browserEnv });
  run("node", ["scripts/multilingual-browser-gate.mjs"], { env: { MULTILINGUAL_TEST_BASE_URL: BASE, CHROME_PATH: chromePath } });
  run("node", ["scripts/public-p0-browser-gate.mjs"], { env: browserEnv });
  run("node", ["scripts/interpretation-bundle-gate.mjs"], { env: browserEnv });
  run("node", ["scripts/logo-browser-gate.mjs"], { env: browserEnv });

  log(`Running homepage Lighthouse with Chrome: ${chromePath}`);
  const lighthouseEnv = { CHROME_PATH: chromePath };
  const mobilePath = "/tmp/quickiching-lighthouse-mobile.json";
  const desktopPath = "/tmp/quickiching-lighthouse-desktop.json";
  const guideMobilePath = "/tmp/quickiching-lighthouse-guide-mobile.json";
  run("./node_modules/.bin/lighthouse", lighthouseArgs(BASE, mobilePath), { env: lighthouseEnv });
  run("./node_modules/.bin/lighthouse", lighthouseArgs(BASE, desktopPath, true), { env: lighthouseEnv });
  run("./node_modules/.bin/lighthouse", lighthouseArgs(`${BASE}/guides/how-to-ask-the-i-ching`, guideMobilePath), { env: lighthouseEnv });
  const mobile = await summarizeLighthouse("HOME_MOBILE", mobilePath);
  const desktop = await summarizeLighthouse("HOME_DESKTOP", desktopPath);
  const guideMobile = await summarizeLighthouse("HOW_TO_ASK_MOBILE", guideMobilePath);
  assertLighthouse([mobile, desktop, guideMobile]);

  log("Running populated Three-Coin result Lighthouse with preserved sessionStorage");
  run("node", ["scripts/result-lighthouse-gate.mjs"], { env: browserEnv });
  log("Running Public P0 before/after Lighthouse coverage for home, Three-Coin, populated unified result, hub, detail, and History");
  run("node", ["scripts/public-p0-lighthouse-gate.mjs"], {
    env: { ...browserEnv, PUBLIC_V1_LIGHTHOUSE_BASELINE_URL: process.env.PUBLIC_V1_LIGHTHOUSE_BASELINE_URL || "https://www.quickiching.com" },
  });
  log("ALL PUBLIC SEO V1 + PUBLIC READING P0 + THREE-COIN FREE READING V2 + ON-PAGE SEO QUALITY / BUILD / BROWSER / BUNDLE / LIGHTHOUSE GATES PASS");
} finally {
  server.kill("SIGTERM");
}
