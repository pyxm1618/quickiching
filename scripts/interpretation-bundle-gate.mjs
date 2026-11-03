import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { resolveChromeExecutable } from "./browser-runtime.mjs";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const BASE_ORIGIN = new URL(BASE).origin;
// These are stable authored-prose sentinels from four different dynamic catalog chunks.
// The fixture resolves to H13 → H57, so those chunks must load while unrelated H1/H61 stay absent.
const H1_CATALOG_SENTINEL = "Creative force describes a situation with strong capacity to initiate, shape, and sustain movement.";
const H13_CATALOG_SENTINEL = "Fellowship describes cooperation built around a purpose that can be stated in the open.";
const H57_CATALOG_SENTINEL = "Gentle penetration describes influence that becomes effective through repeated, small entry rather than one dramatic push.";
const H61_CATALOG_SENTINEL = "Inner truth describes credibility produced when belief, speech, and conduct become congruent enough that trust does not depend on performance.";

function log(message) {
  console.log(`[Interpretation Bundle Gate] ${message}`);
}

async function loadedJavascript(page) {
  const urls = await page.evaluate(() => [...new Set([
    ...[...document.scripts].map((script) => script.src).filter(Boolean),
    ...performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.includes("/_next/") && name.includes(".js")),
  ])]);
  const sameOriginUrls = urls.filter((url) => new URL(url, BASE).origin === BASE_ORIGIN);
  const payloads = await page.evaluate(async (resourceUrls) => Promise.all(resourceUrls.map(async (url) => {
    const response = await fetch(url);
    return { url, text: await response.text() };
  })), sameOriginUrls);
  return {
    urls: sameOriginUrls,
    bytes: payloads.reduce((sum, payload) => sum + Buffer.byteLength(payload.text), 0),
    combined: payloads.map((payload) => payload.text).join("\n"),
  };
}

async function verifyHomepage(page) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 30_000 });
  const scripts = await loadedJavascript(page);
  for (const sentinel of [H1_CATALOG_SENTINEL, H13_CATALOG_SENTINEL, H57_CATALOG_SENTINEL, H61_CATALOG_SENTINEL]) {
    assert(!scripts.combined.includes(sentinel), `Homepage downloaded V2 interpretation prose: ${sentinel}`);
  }
  log(`HOMEPAGE_JS resources=${scripts.urls.length} bytes=${scripts.bytes}; V2 catalog prose absent`);
}

async function collectProductionChunks(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const absolute = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectProductionChunks(absolute));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(absolute);
    }
  }
  return files;
}

async function verifyInterpretationChunks() {
  const chunksRoot = join(process.cwd(), ".next", "static", "chunks");
  const chunkFiles = await collectProductionChunks(chunksRoot);
  assert(chunkFiles.length > 0, "Next production build emitted no JavaScript chunks");

  const payloads = await Promise.all(chunkFiles.map(async (file) => ({
    file,
    text: await readFile(file, "utf8"),
  })));

  const sentinels = new Map([
    ["H1", H1_CATALOG_SENTINEL],
    ["H13", H13_CATALOG_SENTINEL],
    ["H57", H57_CATALOG_SENTINEL],
    ["H61", H61_CATALOG_SENTINEL],
  ]);
  const matches = new Map();
  for (const [label, sentinel] of sentinels) {
    const files = payloads.filter((payload) => payload.text.includes(sentinel)).map((payload) => payload.file);
    assert(files.length > 0, `Production build is missing ${label} interpretation prose`);
    matches.set(label, files);
  }

  const h13Files = new Set(matches.get("H13"));
  const h57Files = new Set(matches.get("H57"));
  assert([...h13Files].every((file) => !h57Files.has(file)), "H13 and H57 interpretation catalogs collapsed into the same production chunk");

  for (const file of h13Files) {
    const text = payloads.find((payload) => payload.file === file)?.text ?? "";
    assert(!text.includes(H1_CATALOG_SENTINEL), "H13 chunk eagerly contains unrelated H1 prose");
    assert(!text.includes(H61_CATALOG_SENTINEL), "H13 chunk eagerly contains unrelated H61 prose");
  }
  for (const file of h57Files) {
    const text = payloads.find((payload) => payload.file === file)?.text ?? "";
    assert(!text.includes(H1_CATALOG_SENTINEL), "H57 chunk eagerly contains unrelated H1 prose");
    assert(!text.includes(H61_CATALOG_SENTINEL), "H57 chunk eagerly contains unrelated H61 prose");
  }

  log(`PRODUCTION_CHUNKS H13=${[...h13Files].map((file) => relative(process.cwd(), file)).join(",")} H57=${[...h57Files].map((file) => relative(process.cwd(), file)).join(",")}; unrelated H1/H61 prose remains separated`);
}

const { executablePath, usingSystemChrome } = await resolveChromeExecutable(chromium);
const browser = await puppeteer.launch({
  args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});
try {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    await verifyHomepage(page);
    await verifyInterpretationChunks();
  } finally {
    await context.close();
  }
  log("INTERPRETATION BUNDLE BOUNDARY PASS");
} finally {
  await browser.close();
}
