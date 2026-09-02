import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appRoot = new URL(".", import.meta.url).pathname;
const srcRoot = new URL("../", import.meta.url).pathname;
const componentRoot = `${srcRoot}components/`;

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("mobile performance architecture", () => {
  it("does not pull the ThreeCoinTool directly into the homepage route", () => {
    const homepage = source(`${appRoot}(default)/page.tsx`);
    const lazyBoundary = source(`${componentRoot}public-reading/homepage-three-coin-reading.tsx`);

    expect(homepage).toContain("HomepageThreeCoinReading");
    expect(homepage).not.toMatch(/import\s+\{\s*ThreeCoinTool\s*\}/);
    expect(homepage).not.toMatch(/import\s+\{\s*QuestionFirst\s*\}/);
    expect(lazyBoundary).toContain("dynamic(");
    expect(lazyBoundary).toContain('import("@/components/public-reading/three-coin-tool")');
  });

  it("keeps the homepage SEO body in the server route", () => {
    const homepage = source(`${appRoot}(default)/page.tsx`);
    expect(homepage).toContain("HOME_H1");
    expect(homepage).toContain("WEBSITE_STRUCTURED_DATA");
    expect(homepage).toContain("Common Questions About I Ching Online");
    expect(homepage).toContain('data-seo-hub-link="/hexagrams"');
  });

  it("keeps the audited navigation implementation until its interaction contract is split safely", () => {
    const defaultLayout = source(`${appRoot}(default)/layout.tsx`);
    const localizedLayout = source(`${appRoot}(localized)/zh/layout.tsx`);

    expect(defaultLayout).toContain('from "@/components/site-header"');
    expect(localizedLayout).toContain('from "@/components/site-header"');
  });
});
