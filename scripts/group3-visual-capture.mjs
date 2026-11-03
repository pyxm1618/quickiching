import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

const base = process.env.GROUP3_QA_BASE_URL ?? "http://127.0.0.1:3036";
const chrome = process.env.CHROME_PATH;
if (!chrome) throw new Error("CHROME_PATH_REQUIRED");
const root = resolve(process.argv[2] ?? ".artifacts/group3-visual-qa");
await mkdir(root, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const results = [];
async function capture({ name, path, width, height, fullPage = false, hover, scrollAudit = false }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(base + path, { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(() => {
    const decline = [...document.querySelectorAll("button")].find(button => button.textContent?.trim() === "Decline");
    if (decline instanceof HTMLButtonElement) decline.click();
  });
  await new Promise(resolve => setTimeout(resolve, 120));
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
  if (hover) {
    const target = await page.$(hover);
    if (target) await target.hover();
  }
  await new Promise(resolve => setTimeout(resolve, 250));
  const scrollEvidence = [];
  if (scrollAudit) {
    const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const maxY = Math.max(0, documentHeight - height);
    const step = Math.max(1, Math.floor(height * 0.85));
    const positions = [];
    for (let y = 0; y < maxY; y += step) positions.push(y);
    positions.push(maxY);
    for (let index = 0; index < positions.length; index += 1) {
      const y = positions[index];
      await page.evaluate(scrollY => window.scrollTo({ top: scrollY, left: 0, behavior: "instant" }), y);
      await new Promise(resolve => setTimeout(resolve, 140));
      const visible = await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
        const intersectsViewport = element => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
        };
        const visibleImages = [...document.images].filter(intersectsViewport);
        await Promise.all(visibleImages.map(async image => {
          try {
            if (!image.complete) await new Promise(resolve => {
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
            });
            if (typeof image.decode === "function") await image.decode().catch(() => {});
          } catch {}
        }));
        const meaningful = [...document.querySelectorAll("[data-info-page] h1,[data-info-page] h2,[data-info-page] h3,[data-info-page] p,[data-info-page] li,[data-info-page] table,[data-info-page] img,[data-info-page] svg")]
          .filter(intersectsViewport)
          .filter(element => {
            if (element instanceof HTMLImageElement) return element.complete && element.naturalWidth > 0;
            const text = element.textContent?.trim() ?? "";
            return text.length > 0 || element.tagName === "SVG";
          });
        return {
          y: Math.round(scrollY),
          meaningfulVisible: meaningful.length,
          visibleImages: visibleImages.length,
          failedVisibleImages: visibleImages.filter(image => !image.complete || image.naturalWidth <= 0).map(image => image.currentSrc || image.src),
        };
      });
      const shot = resolve(root, `${name}-scroll-${String(index + 1).padStart(2, "0")}.jpg`);
      await page.screenshot({ path: shot, type: "jpeg", quality: 72, fullPage: false });
      scrollEvidence.push({ ...visible, screenshot: shot.split("/").pop() });
    }
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  const audit = await page.evaluate(() => {
    const root = document.documentElement;
    const viewportWidth = root.clientWidth;
    const offenders = [...document.querySelectorAll("body *")].flatMap((element) => {
      const style = getComputedStyle(element);
      if (style.position === "fixed" || style.position === "absolute") return [];
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return [];
      const overflowRight = rect.right - viewportWidth;
      const overflowLeft = -rect.left;
      if (overflowRight > 1 || overflowLeft > 1) {
        return [{ tag: element.tagName, cls: String(element.className ?? "").slice(0,160), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }];
      }
      return [];
    }).slice(0,30);
    const dialog = document.querySelector(".qic-account-dialog")?.getBoundingClientRect();
    const menu = document.querySelector(".qic-user-menu")?.getBoundingClientRect();
    return {
      viewportWidth,
      scrollWidth: root.scrollWidth,
      pageOverflow: root.scrollWidth > viewportWidth + 1,
      offenders,
      dialog: dialog ? { x: Math.round(dialog.x), y: Math.round(dialog.y), width: Math.round(dialog.width), height: Math.round(dialog.height) } : null,
      menu: menu ? { x: Math.round(menu.x), y: Math.round(menu.y), width: Math.round(menu.width), height: Math.round(menu.height) } : null,
    };
  });
  const file = resolve(root, name + ".png");
  await page.screenshot({ path: file, fullPage });
  results.push({ name, path, width, height, fullPage, scrollEvidence, ...audit });
  await page.close();
}

const accountDesktop = [
  ["user-menu-desktop","/group3-visual-qa-local?view=user-menu","[data-user-nav-dropdown] a"],
  ["my-readings-desktop","/group3-visual-qa-local?view=my-readings",".qic-my-readings-scroll li:nth-child(2) .qic-my-reading"],
  ["my-account-desktop","/group3-visual-qa-local?view=account"],
  ["settings-desktop","/group3-visual-qa-local?view=settings"],
  ["refund-desktop","/group3-visual-qa-local?view=refund"],
  ["delete-desktop","/group3-visual-qa-local?view=delete"],
];
for (const [name,path,hover] of accountDesktop) await capture({ name, path, width:1536, height:1024, hover });

for (const width of [390,320]) {
  for (const [key,view] of [["my-readings","my-readings"],["my-account","account"],["settings","settings"],["refund","refund"],["delete","delete"]]) {
    await capture({ name:`${key}-${width}`, path:`/group3-visual-qa-local?view=${view}`, width, height:844 });
  }
}

const infoRoutes = [
  ["how-to-ask","/guides/how-to-ask-the-i-ching"],
  ["changing-lines","/guides/changing-lines"],
  ["primary-relating","/guides/primary-relating-hexagrams"],
  ["help","/help"],
  ["privacy","/privacy"],
  ["terms","/terms"],
  ["acceptable-use","/acceptable-use"],
];
for (const locale of ["en","zh"]) {
  for (const [key,path] of infoRoutes) {
    const localized = locale === "en" ? path : "/zh" + path;
    await capture({ name:`${key}-${locale}-desktop`, path:localized, width:1672, height:941, fullPage:true, scrollAudit:true });
    await capture({ name:`${key}-${locale}-390`, path:localized, width:390, height:844, fullPage:true, scrollAudit:true });
    await capture({ name:`${key}-${locale}-320`, path:localized, width:320, height:844, fullPage:true, scrollAudit:true });
  }
}

await writeFile(resolve(root,"responsive-audit.json"),JSON.stringify(results,null,2));
await browser.close();

const overflow = results.filter(result => result.pageOverflow);
const scrollFailures = results.flatMap(result => (result.scrollEvidence ?? [])
  .filter(entry => entry.meaningfulVisible === 0 || entry.failedVisibleImages.length > 0)
  .map(entry => ({ name: result.name, ...entry })));
if (overflow.length || scrollFailures.length) {
  console.error(JSON.stringify({
    pageOverflow: overflow.map(({name,scrollWidth,viewportWidth,offenders})=>({name,scrollWidth,viewportWidth,offenders})),
    scrollFailures,
  },null,2));
  process.exitCode = 1;
}
console.log(JSON.stringify({ captures: results.length, pageOverflow: overflow.length, scrollFailures: scrollFailures.length },null,2));
