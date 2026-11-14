import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = new URL("../", import.meta.url).pathname;

function walk(directory: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(?:ts|tsx|css)$/u.test(entry)) out.push(full);
  }
  return out;
}

/** Production sources only: tests assert intent, they are not shipped behaviour. */
function productionSources(): { path: string; source: string }[] {
  return walk(SRC)
    .filter((path) => !/\.test\.(?:ts|tsx)$/u.test(path))
    .map((path) => ({ path: relative(SRC, path), source: readFileSync(path, "utf8") }));
}

const SOURCES = productionSources();

function filesMatching(pattern: RegExp): string[] {
  return SOURCES.filter((file) => pattern.test(file.source)).map((file) => file.path);
}

const SHELL_PRESENTATIONS = new Set([
  "components/site-header.tsx",
  "components/scene-navigation.tsx",
  "components/scene-navigation-panels.tsx",
  "components/info-pages/info-page-header.tsx",
]);

describe("Navigation / Surface Authority architecture", () => {
  it("keeps one shell-owned locale control: no surface renders its own language switcher", () => {
    const owners = filesMatching(/data-language-switcher/u).filter((path) => !SHELL_PRESENTATIONS.has(path));
    // The privacy/consent control is not a locale switcher and is excluded by
    // the attribute name; anything left here is a second locale owner.
    expect(owners).toEqual([]);
  });

  it("keeps one shell-owned account control", () => {
    const importers = SOURCES
      .filter((file) => /from "@\/components\/auth\/user-nav-control"/u.test(file.source))
      .map((file) => file.path)
      .filter((path) => !SHELL_PRESENTATIONS.has(path) && !path.startsWith("components/account/"));
    expect(importers).toEqual([]);
  });

  it("keeps one shell-owned Home capability", () => {
    const owners = filesMatching(/data-shell-home/u).filter((path) => !SHELL_PRESENTATIONS.has(path));
    expect(owners).toEqual([]);
  });

  it("allows no page-owned DOM manipulation of the global shell", () => {
    expect(filesMatching(/querySelector(?:<[^>]+>)?\(\s*["'`]body > header/u)).toEqual([]);
    expect(filesMatching(/querySelector(?:<[^>]+>)?\(\s*["'`]body > (?:main|footer)/u)).toEqual([]);
    expect(filesMatching(/style\.display\s*=\s*["']none["']/u)).toEqual([]);
  });

  it("allows no page CSS to hide or remove shell navigation", () => {
    expect(filesMatching(/\.scene-navigation\s*\{[^}]*display:\s*none/u)).toEqual([]);
    expect(filesMatching(/>\s*:global\((?:header|footer)\)[^{]*\{[^}]*display:\s*none/u)).toEqual([]);
    expect(filesMatching(/:global\(body\)[^{]*:has\([^)]*\)[^{]*\.scene-(?:navigation|brand|scrolls|utility)[^}]*display:\s*none/u)).toEqual([]);
    expect(filesMatching(/:has\([^)]*\)\s*>\s*(?:header|:global\(header\))[^{]*\{[^}]*display:\s*none/u)).toEqual([]);
  });

  it("resolves the Surface Contract only in the shell", () => {
    const resolvers = filesMatching(/resolveSurfaceContract/u)
      .filter((path) => path !== "navigation/surface-contract.ts" && path !== "components/site-header.tsx");
    expect(resolvers).toEqual([]);
  });

  it("mounts both locale layouts through the one shell and the shared flow-state provider", () => {
    for (const path of ["../app/(default)/layout.tsx", "../app/(localized)/zh/layout.tsx"]) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain("NavigationSurfaceProvider");
      expect(source).toContain("<SiteHeader");
      expect(source).not.toContain("SceneNavigation");
      expect(source).not.toContain("InfoPageHeader");
    }
  });
});
