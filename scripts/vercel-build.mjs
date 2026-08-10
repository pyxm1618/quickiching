import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";

const BASE = "http://127.0.0.1:3000";

function log(message) {
  console.log(`[Public V1 Gate] ${message}`);
}

function run(command, args, options = {}) {
  log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...options.env },
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(" ")}`);
  }
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

function lighthouseArgs(outputPath, desktop = false) {
  return [
    BASE,
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

  log(`LIGHTHOUSE_${label} performance=${performance} accessibility=${accessibility} seo=${seo} LCP_ms=${lcp} CLS=${cls.toFixed(4)} TBT_ms=${tbt}`);

  if (accessibility < 90) throw new Error(`${label} Lighthouse accessibility score below 90`);
  if (seo < 90) throw new Error(`${label} Lighthouse SEO score below 90`);
  if (cls > 0.1) throw new Error(`${label} CLS exceeds 0.10`);
  if (performance < 65 || lcp > 4000) throw new Error(`${label} severe performance regression`);
  if (lcp > 2500) log(`WARNING: ${label} lab LCP is above the 2.5s target (${lcp}ms)`);

  return { performance, accessibility, seo, lcp, cls, tbt };
}

log(`Vercel context: env=${process.env.VERCEL_ENV || "unknown"} target=${process.env.VERCEL_TARGET_ENV || "unknown"} ref=${process.env.VERCEL_GIT_COMMIT_REF || "unknown"}`);
log("Running locked package-manager and quality gates");
run("bun", ["run", "lint"]);
run("bun", ["run", "typecheck"]);
run("bun", ["run", "test"]);
log("IndexNow gate is DRY_RUN only; production submission is intentionally forbidden here");
run("bun", ["run", "indexnow"]);
run("bun", ["run", "build"]);

const manifestHash = await fileHash("package.json");
const lockHash = await fileHash("bun.lock");
log("Installing ephemeral browser audit tooling without changing package.json or bun.lock");
run("bun", [
  "install",
  "--no-save",
  "puppeteer-core@25.1.0",
  "@sparticuz/chromium@149.0.0",
  "lighthouse@13.4.1",
]);
if ((await fileHash("package.json")) !== manifestHash || (await fileHash("bun.lock")) !== lockHash) {
  throw new Error("Ephemeral browser tooling changed package.json or bun.lock");
}

const server = spawn("bun", ["run", "start"], {
  env: { ...process.env, PORT: "3000", HOSTNAME: "127.0.0.1" },
  stdio: ["ignore", "inherit", "inherit"],
});

try {
  await waitForServer();
  log("Production Next server is ready; running real Chromium E2E");
  run("node", ["scripts/browser-gate.mjs"], { env: { PUBLIC_V1_TEST_BASE_URL: BASE } });

  const { default: chromium } = await import("@sparticuz/chromium");
  const chromePath = await chromium.executablePath();
  log(`Running Lighthouse with serverless Chromium: ${chromePath}`);
  const lighthouseEnv = { CHROME_PATH: chromePath };
  const mobilePath = "/tmp/quickiching-lighthouse-mobile.json";
  const desktopPath = "/tmp/quickiching-lighthouse-desktop.json";
  run("./node_modules/.bin/lighthouse", lighthouseArgs(mobilePath), { env: lighthouseEnv });
  run("./node_modules/.bin/lighthouse", lighthouseArgs(desktopPath, true), { env: lighthouseEnv });
  await summarizeLighthouse("MOBILE", mobilePath);
  await summarizeLighthouse("DESKTOP", desktopPath);
  log("ALL PUBLIC SEO V1 QUALITY / BUILD / BROWSER / LIGHTHOUSE GATES PASS");
} finally {
  server.kill("SIGTERM");
}
