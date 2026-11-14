import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import React from "react";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EnglishMethodPage from "@/app/(default)/methods/three-coin/page";
import ChineseMethodPage from "@/app/(localized)/zh/methods/three-coin/page";

const SRC_ROOT = path.resolve(process.cwd(), "src");
const source = (relative: string) => readFileSync(path.join(SRC_ROOT, relative), "utf8");

function runtimeFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const absolute = path.join(root, entry);
    if (statSync(absolute).isDirectory()) {
      files.push(...runtimeFiles(absolute));
      continue;
    }
    if (!/\.(?:ts|tsx)$/u.test(entry)) continue;
    if (/\.test\.tsx?$/u.test(entry)) continue;
    files.push(absolute);
  }
  return files;
}

function renderPage(element: React.ReactNode): string {
  const classicGlobal = globalThis as typeof globalThis & { React?: typeof React };
  const previousReact = classicGlobal.React;
  classicGlobal.React = React;
  try { return renderToStaticMarkup(element); }
  finally {
    if (previousReact) classicGlobal.React = previousReact;
    else Reflect.deleteProperty(classicGlobal, "React");
  }
}

describe("C8 — Three Coin single entry", () => {
  it("keeps / and /zh as the only active Three Coin product entry", () => {
    for (const relative of ["app/(default)/page.tsx", "app/(localized)/zh/page.tsx"]) {
      const page = source(relative);
      expect(page, relative).toContain("ThreeCoinRitual");
      expect(page, relative).toContain("ThreeCoinTool");
    }
  });

  it.each([
    ["EN", EnglishMethodPage, "/"],
    ["ZH", ChineseMethodPage, "/zh"],
  ] as const)("renders %s /methods/three-coin as SEO detail with no ritual", (_locale, Page, href) => {
    const html = renderPage(<Page />);
    expect(html).not.toContain("data-three-coin-ritual");
    expect(html).not.toContain("data-three-coin-presentation");
    expect(html).not.toContain("hold-button");
    const cta = /<a\b[^>]*data-three-coin-cta[^>]*>/u.exec(html)?.[0] ?? "";
    expect(cta).toContain(`href="${href}"`);
  });

  it("retires ThreeCoinRitualClient instead of leaving a dormant second entry", () => {
    expect(existsSync(path.join(SRC_ROOT, "components/public-reading/three-coin-ritual-client.tsx"))).toBe(false);
    const references = runtimeFiles(SRC_ROOT)
      .filter((file) => readFileSync(file, "utf8").includes("three-coin-ritual-client"))
      .map((file) => path.relative(SRC_ROOT, file));
    expect(references).toEqual([]);
  });

  it("keeps exactly one ThreeCoinTool owner and no duplicate casting implementation", () => {
    const references = runtimeFiles(SRC_ROOT)
      .filter((file) => /export function ThreeCoinTool\b/u.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC_ROOT, file));
    expect(references).toEqual(["components/public-reading/three-coin-tool.tsx"]);
  });
});
