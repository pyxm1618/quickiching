import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appRoot = new URL(".", import.meta.url).pathname;
const srcRoot = new URL("../", import.meta.url).pathname;
const componentRoot = `${srcRoot}components/`;

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("mobile performance architecture", () => {
  it("keeps the global SiteHeader server-first", () => {
    const header = source(`${componentRoot}site-header.tsx`);
    expect(header.trimStart().startsWith('"use client"')).toBe(false);
  });

  it("does not pull the ThreeCoinTool directly into the homepage route", () => {
    const homepage = source(`${appRoot}(default)/page.tsx`);
    expect(homepage).toContain("LazyThreeCoinTool");
    expect(homepage).not.toMatch(/import\s+\{\s*ThreeCoinTool\s*\}/);
  });

  it("does not statically pull PublicReadingResult into the casting engine", () => {
    const threeCoin = source(`${componentRoot}public-reading/three-coin-tool.tsx`);
    expect(threeCoin).not.toMatch(/import\s+\{\s*PublicReadingResult\s*\}/);
    expect(threeCoin).toContain("LazyPublicReadingResult");
  });
});
