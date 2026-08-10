import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:3000";
const HOME_TITLE = "I Ching Online — Free Hexagram Reading | Quick I Ching";
const HOME_DESCRIPTION = "Use the I Ching online with three coins, yarrow stalks, or Mei Hua Yi Shu. Cast your hexagram, see changing lines, and get a free basic interpretation.";
const HOME_H1 = "I Ching Online — Cast Your Hexagram";

test.setTimeout(90_000);

test.use({
  baseURL: BASE,
  trace: "retain-on-failure",
  screenshot: "only-on-failure",
});

function collectBrowserFailures(page) {
  const consoleErrors = [];
  const failedResponses = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    try {
      const url = new URL(response.url());
      const base = new URL(BASE);
      if (url.origin === base.origin && response.status() >= 400) {
        failedResponses.push(`${response.status()} ${url.pathname}`);
      }
    } catch {
      // Ignore non-URL browser diagnostics.
    }
  });
  return { consoleErrors, failedResponses };
}

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

async function finishThreeCoin(page) {
  const toss = page.getByRole("button", { name: "Toss three coins" });
  await toss.focus();
  await expect(toss).toBeFocused();
  await page.keyboard.press("Enter");
  for (let index = 1; index < 6; index += 1) await page.getByRole("button", { name: "Toss three coins" }).click();
  await expect(page.getByRole("heading", { name: "Your I Ching reading" })).toBeVisible();
  await expect(page.getByText("Primary Hexagram", { exact: true })).toBeVisible();
  await expect(page.getByText("Changing Lines", { exact: true })).toBeVisible();
  await expect(page.getByText("Relating Hexagram", { exact: true })).toBeVisible();
  await expect(page.getByText(/general interpretive framework for reflection/i)).toBeVisible();
}

async function finishYarrow(page, { verifyResume = false } = {}) {
  const beforeReload = verifyResume ? 4 : 0;
  for (let index = 0; index < beforeReload; index += 1) {
    await page.getByRole("button", { name: /Perform change/ }).click();
  }
  if (verifyResume) {
    await expect(page.getByText("4 / 18 changes", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("4 / 18 changes", { exact: true })).toBeVisible();
  }
  for (let index = beforeReload; index < 18; index += 1) {
    await page.getByRole("button", { name: /Perform change/ }).click();
  }
  await expect(page.getByRole("heading", { name: "Your I Ching reading" })).toBeVisible();
  await expect(page.getByText("Primary Hexagram", { exact: true })).toBeVisible();
  await expect(page.getByText("Changing Lines", { exact: true })).toBeVisible();
  await expect(page.getByText("Relating Hexagram", { exact: true })).toBeVisible();
}

async function finishMeiHua(page) {
  const timeZone = page.getByLabel("IANA timezone");
  await timeZone.fill("Asia/Singapore");
  await page.getByRole("button", { name: "Cast current time" }).click();
  await expect(page.getByRole("heading", { name: "Recorded calculation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your I Ching reading" })).toBeVisible();
  await expect(page.getByText("Primary Hexagram", { exact: true })).toBeVisible();
  await expect(page.getByText("Changing Lines", { exact: true })).toBeVisible();
  await expect(page.getByText("Relating Hexagram", { exact: true })).toBeVisible();
  await expect(page.getByText(/quickiching-gregorian-current-time-v2/i)).toBeVisible();
}

async function assertCleanCoreFlow(page, flow) {
  const failures = collectBrowserFailures(page);
  await flow();
  await expectNoHorizontalOverflow(page);
  expect(failures.consoleErrors, `console errors: ${failures.consoleErrors.join(" | ")}`).toEqual([]);
  expect(failures.failedResponses, `failed responses: ${failures.failedResponses.join(" | ")}`).toEqual([]);
}

test.describe("desktop Public SEO V1 core paths", () => {
  test("homepage renders exact SEO metadata in DOM and completes Three Coin", async ({ page }) => {
    await assertCleanCoreFlow(page, async () => {
      await page.goto("/");
      await expect(page).toHaveTitle(HOME_TITLE);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", HOME_DESCRIPTION);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.quickiching.com/");
      await expect(page.getByRole("heading", { level: 1, name: HOME_H1 })).toBeVisible();
      await finishThreeCoin(page);
      await page.getByRole("button", { name: "New reading" }).click();
      await expect(page.getByText("0 / 6 lines", { exact: true })).toBeVisible();
    });
  });

  test("Yarrow completes 18 changes and resumes after reload", async ({ page }) => {
    await assertCleanCoreFlow(page, async () => {
      await page.goto("/methods/yarrow-stalks");
      await finishYarrow(page, { verifyResume: true });
      await page.getByRole("button", { name: "New reading" }).click();
      await expect(page.getByText("0 / 18 changes", { exact: true })).toBeVisible();
    });
  });

  test("Mei Hua completes current-time cast with explicit convention", async ({ page }) => {
    await assertCleanCoreFlow(page, async () => {
      await page.goto("/methods/mei-hua-yi-shu");
      await finishMeiHua(page);
      await page.getByRole("button", { name: "New reading" }).click();
      await expect(page.getByRole("button", { name: "Cast current time" })).toBeEnabled();
    });
  });
});

test.describe("mobile Public SEO V1", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("375px completes all three free reading paths", async ({ browser }) => {
    for (const [path, finish] of [
      ["/", finishThreeCoin],
      ["/methods/yarrow-stalks", (page) => finishYarrow(page)],
      ["/methods/mei-hua-yi-shu", finishMeiHua],
    ]) {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const page = await context.newPage();
      await assertCleanCoreFlow(page, async () => {
        await page.goto(path);
        await finish(page);
      });
      await context.close();
    }
  });
});

for (const viewport of [
  { width: 320, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`${viewport.width}px homepage/navigation/FAQ/footer has no horizontal overflow`, async ({ browser }) => {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const failures = collectBrowserFailures(page);
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Common Questions About I Ching Online" })).toBeVisible();
    await page.getByText("What is an I Ching reading?", { exact: true }).click();
    await expect(page.getByText(/structured framework for reflection/i)).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(failures.consoleErrors).toEqual([]);
    expect(failures.failedResponses).toEqual([]);
    await context.close();
  });
}

test.describe("HTTP and crawl semantics", () => {
  test("initial HTML exposes exact TDH, intro and crawlable core links", async ({ request }) => {
    const response = await request.get(BASE);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain(`<title>${HOME_TITLE}</title>`);
    expect(html).toContain(`content="${HOME_DESCRIPTION}"`);
    expect(html).toContain(`>${HOME_H1}</h1>`);
    expect(html).toContain('href="/methods/yarrow-stalks"');
    expect(html).toContain('href="/methods/mei-hua-yi-shu"');
    expect(html).toContain('href="/guides/changing-lines"');
    expect(html).toContain('href="/hexagrams"');
  });

  test("sitemap, robots, IndexNow key and noindex pages are served correctly", async ({ request, page }) => {
    const sitemap = await request.get(`${BASE}/sitemap.xml`);
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain("https://www.quickiching.com/methods/three-coin");
    expect(xml).not.toContain("/pricing");
    expect(xml).not.toContain("/three-coin-method");

    const robots = await request.get(`${BASE}/robots.txt`);
    expect(robots.status()).toBe(200);
    const robotsText = await robots.text();
    expect(robotsText).toContain("Sitemap: https://www.quickiching.com/sitemap.xml");
    expect(robotsText).toContain("Disallow: /api/");
    expect(robotsText).not.toContain("Disallow: /signin");

    const key = await request.get(`${BASE}/0458fb9ef2ef723618b52f6861b3b2f7.txt`);
    expect(key.status()).toBe(200);
    expect((await key.text()).trim()).toBe("0458fb9ef2ef723618b52f6861b3b2f7");

    for (const path of ["/pricing", "/help", "/privacy", "/terms", "/acceptable-use"]) {
      await page.goto(path);
      const robotsMeta = page.locator('meta[name="robots"]');
      await expect(robotsMeta).toHaveAttribute("content", /noindex/i);
    }
  });

  test("legacy, host, gone and missing responses use correct HTTP semantics", async ({ request }) => {
    for (const [path, destination] of [
      ["/three-coin-method", "/methods/three-coin"],
      ["/yarrow-stalk-method", "/methods/yarrow-stalks"],
      ["/mei-hua-yi-shu", "/methods/mei-hua-yi-shu"],
      ["/cast/yarrow_stalk", "/methods/yarrow-stalks"],
      ["/cast/mei_hua_current_time", "/methods/mei-hua-yi-shu"],
    ]) {
      const response = await request.get(`${BASE}${path}`, { maxRedirects: 0 });
      expect(response.status()).toBe(308);
      expect(new URL(response.headers().location, BASE).pathname).toBe(destination);
    }

    const bare = await request.get(`${BASE}/guides/changing-lines?source=test`, {
      headers: { host: "quickiching.com" },
      maxRedirects: 0,
    });
    expect(bare.status()).toBe(308);
    expect(bare.headers().location).toBe("https://www.quickiching.com/guides/changing-lines?source=test");

    const alias = await request.get(`${BASE}/hexagrams?source=test`, {
      headers: { host: "ichingcoin.vercel.app" },
      maxRedirects: 0,
    });
    expect(alias.status()).toBe(308);
    expect(alias.headers().location).toBe("https://www.quickiching.com/hexagrams?source=test");

    expect((await request.get(`${BASE}/signin`, { maxRedirects: 0 })).status()).toBe(410);
    expect((await request.get(`${BASE}/account`, { maxRedirects: 0 })).status()).toBe(410);
    expect((await request.get(`${BASE}/checkout/example`, { maxRedirects: 0 })).status()).toBe(410);
    expect((await request.get(`${BASE}/result/not-a-reading`, { maxRedirects: 0 })).status()).toBe(404);
    expect((await request.get(`${BASE}/definitely-missing`, { maxRedirects: 0 })).status()).toBe(404);
  });
});
