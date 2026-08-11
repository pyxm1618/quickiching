import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const BASE = process.env.PUBLIC_V1_TEST_BASE_URL || "http://127.0.0.1:3000";
const BRAND_ALT = "Quick I Ching logo";
const BRAND_ASSET = "quick-i-ching-logo-mark.png";

const DESKTOP_PATHS = [
  ["/", "Homepage"],
  ["/methods/three-coin", "Three-Coin"],
  ["/methods/yarrow-stalks", "Yarrow"],
  ["/methods/mei-hua-yi-shu", "Mei Hua"],
  ["/guides/how-to-ask-the-i-ching", "Guide"],
  ["/hexagrams", "Hexagrams"],
];

function log(message) {
  console.log(`[Logo Browser Gate] ${message}`);
}

async function assertImageEndpoint(path, expectedType) {
  const response = await fetch(`${BASE}${path}`);
  assert.equal(response.status, 200, `${path}: expected 200, received ${response.status}`);
  const type = response.headers.get("content-type") || "";
  assert(type.includes(expectedType), `${path}: unexpected content type ${type}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert(bytes.length > 0, `${path}: empty image response`);
}

async function inspectBrandChrome(page, label) {
  await page.waitForSelector(`header img[alt="${BRAND_ALT}"]`, { timeout: 15_000 });
  await page.waitForSelector(`footer img[alt="${BRAND_ALT}"]`, { timeout: 15_000 });

  const state = await page.evaluate(({ alt, asset }) => {
    const header = document.querySelector("header");
    const footer = document.querySelector("footer");
    const headerImage = header?.querySelector(`img[alt="${alt}"]`);
    const footerImage = footer?.querySelector(`img[alt="${alt}"]`);

    const inspectImage = (image) => {
      if (!(image instanceof HTMLImageElement)) return null;
      const rect = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      return {
        currentSrc: image.currentSrc || image.src,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        renderedWidth: rect.width,
        renderedHeight: rect.height,
        backgroundColor: style.backgroundColor,
        objectFit: style.objectFit,
        filter: style.filter,
        complete: image.complete,
        assetMatch: (image.currentSrc || image.src).includes(asset),
      };
    };

    return {
      header: inspectImage(headerImage),
      footer: inspectImage(footerImage),
      headerText: header?.textContent || "",
      footerText: footer?.textContent || "",
      oldHeaderSeal: Boolean(header?.querySelector("span[aria-hidden]")),
      oldFooterSeal: Boolean(footer?.querySelector("span[aria-hidden]")),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  }, { alt: BRAND_ALT, asset: BRAND_ASSET });

  for (const [location, image] of [["header", state.header], ["footer", state.footer]]) {
    assert(image, `${label}: ${location} brand image missing`);
    assert(image.complete, `${label}: ${location} brand image not complete`);
    assert(image.naturalWidth > 0 && image.naturalHeight > 0, `${label}: ${location} brand image failed to decode`);
    assert(image.assetMatch, `${label}: ${location} brand image is not the new mark: ${image.currentSrc}`);
    assert(Math.abs(image.renderedWidth - 32) <= 0.5, `${label}: ${location} logo width changed: ${image.renderedWidth}`);
    assert(Math.abs(image.renderedHeight - 32) <= 0.5, `${label}: ${location} logo height changed: ${image.renderedHeight}`);
    assert.equal(image.backgroundColor, "rgba(0, 0, 0, 0)", `${label}: ${location} logo has a non-transparent presentation background`);
    assert.equal(image.objectFit, "contain", `${label}: ${location} logo object-fit changed`);
    assert(image.filter.includes("invert(1)"), `${label}: ${location} dark-surface inverse presentation is missing`);
  }

  assert(state.headerText.includes("Quick I Ching"), `${label}: visible Header brand text missing`);
  assert(state.footerText.includes("Quick I Ching"), `${label}: visible Footer brand text missing`);
  assert.equal(state.oldHeaderSeal, false, `${label}: old Header SealMark still present`);
  assert.equal(state.oldFooterSeal, false, `${label}: old Footer SealMark still present`);
  assert(state.scrollWidth <= state.clientWidth + 1, `${label}: horizontal overflow ${state.scrollWidth} > ${state.clientWidth}`);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await new Promise((resolve) => setTimeout(resolve, 100));
  const footerVisible = await page.$eval("footer", (node) => {
    const rect = node.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  });
  assert(footerVisible, `${label}: Footer not visible after scroll`);
}

async function runRoute(browser, path, label, viewport) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 30_000 });
    assert(response, `${label}: navigation returned no response`);
    assert.equal(response.status(), 200, `${label}: expected 200, received ${response.status()}`);
    await inspectBrandChrome(page, label);
    assert.deepEqual(consoleErrors, [], `${label}: console errors: ${consoleErrors.join(" | ")}`);
    assert.deepEqual(pageErrors, [], `${label}: page errors: ${pageErrors.join(" | ")}`);
    log(`${label} PASS`);
  } finally {
    await context.close();
  }
}

await assertImageEndpoint("/favicon.ico", "image/x-icon");
await assertImageEndpoint("/favicon-16x16.png", "image/png");
await assertImageEndpoint("/favicon-32x32.png", "image/png");
await assertImageEndpoint("/favicon-48x48.png", "image/png");
await assertImageEndpoint("/icon.png", "image/png");
log("Favicon/icon endpoints PASS");

const executablePath = process.env.CHROME_PATH || await chromium.executablePath();
const usingSystemChrome = Boolean(process.env.CHROME_PATH);
const browser = await puppeteer.launch({
  args: usingSystemChrome ? ["--no-sandbox", "--disable-dev-shm-usage"] : [...chromium.args, "--disable-dev-shm-usage"],
  executablePath,
  headless: true,
});

try {
  const desktop = { width: 1440, height: 1000 };
  for (const [path, name] of DESKTOP_PATHS) {
    await runRoute(browser, path, `Desktop ${name} brand chrome`, desktop);
  }

  await runRoute(browser, "/", "375px Homepage brand/navigation/footer", { width: 375, height: 812 });
} finally {
  await browser.close();
}

log("ALL LOGO / FAVICON BROWSER ACCEPTANCE GATES PASS");
