import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const terms = source("src/app/terms/page.tsx");
const privacy = source("src/app/privacy/page.tsx");
const footer = source("src/components/site-footer.tsx");

describe("public legal pages", () => {
  it("publishes the verified operator and support details", () => {
    for (const page of [terms, privacy]) {
      expect(page).toContain("Wang Yufei");
      expect(page).toContain("China");
      expect(page).toContain("support@quickiching.com");
    }
    expect(footer).toContain("support@quickiching.com");
  });

  it("states the implemented credit, payment, refund, and AI model", () => {
    expect(terms).toContain("Waffo Pancake");
    expect(terms).toContain("12 months");
    expect(terms).toContain("7 days");
    expect(terms).toContain("replacement credit");
    expect(terms).toContain("not a subscription");
    expect(terms).toContain("AI-generated");
  });

  it("states privacy, analytics-consent, and deletion boundaries", () => {
    expect(privacy).toContain("Waffo Pancake");
    expect(privacy).toContain("Google Analytics");
    expect(privacy).toContain("Microsoft Clarity");
    expect(privacy).toContain("optional analytics");
    expect(privacy).toContain("30 days");
    expect(privacy).toContain("24 hours");
    expect(privacy).toContain("do not sell");
  });

  it("removes launch-review placeholders", () => {
    expect(terms).not.toMatch(/draft|G-08 pending/i);
    expect(privacy).not.toMatch(/draft|launch review/i);
  });
});
