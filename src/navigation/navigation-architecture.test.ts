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
  "components/navigation/content-navigation-shell.tsx",
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

  it("never suppresses the shell or hides it from a page surface", () => {
    expect(filesMatching(/deferredShell/u)).toEqual([]);
    const detail = readFileSync(new URL("../components/hexagram-detail-page.tsx", import.meta.url), "utf8");
    expect(detail).not.toContain("SeoRouteGraph");
    expect(detail).not.toContain("data-language-switcher");
    expect(detail).not.toContain("UserNavControl");
    expect(detail).not.toContain("data-shell-home");
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

  it("keeps Manual shell presentation in the central shell CSS, never in page-owned CSS", () => {
    const manualCss = readFileSync(new URL("../components/public-reading/manual-cast.css", import.meta.url), "utf8");
    const shellCss = readFileSync(new URL("../components/scene-navigation.css", import.meta.url), "utf8");
    expect(manualCss).not.toContain("body:has(.manual-cast-page) > header");
    expect(manualCss).not.toContain("body:has(.manual-cast-page) .scene-utility");
    expect(shellCss).toContain(".scene-navigation[data-navigation-surface='S08']");
  });

  it("makes Other Methods one discovery authority shared by both shell presentations", () => {
    const links = readFileSync(new URL("./discovery-links.ts", import.meta.url), "utf8");
    const scenePanels = readFileSync(new URL("../components/scene-navigation-panels.tsx", import.meta.url), "utf8");
    const contentShell = readFileSync(new URL("../components/navigation/content-navigation-shell.tsx", import.meta.url), "utf8");
    expect(links).toContain("export const OTHER_METHOD_LINKS");
    expect(scenePanels).toContain("OTHER_METHOD_LINKS.map");
    expect(contentShell).toContain("OTHER_METHOD_LINKS.map");
    expect(scenePanels).not.toContain('path: "/methods/yarrow-stalks"');
    expect(contentShell).not.toMatch(/\bMETHOD_LINKS\.map/u);
  });

  it("makes Info one discovery authority shared by both shell presentations", () => {
    const links = readFileSync(new URL("./discovery-links.ts", import.meta.url), "utf8");
    const scenePanels = readFileSync(new URL("../components/scene-navigation-panels.tsx", import.meta.url), "utf8");
    const contentShell = readFileSync(new URL("../components/navigation/content-navigation-shell.tsx", import.meta.url), "utf8");
    expect(links).toContain("export const INFO_LINKS");
    expect(links).toContain("export const SUPPORT_EMAIL_LINK");
    expect(scenePanels).toContain("INFO_LINKS");
    expect(scenePanels).toContain("SUPPORT_EMAIL_LINK");
    expect(contentShell).toContain("INFO_LINKS.map");
    for (const legacyOwner of [
      'localize("/guides/how-to-ask-the-i-ching")',
      'localize("/guides/changing-lines")',
      'localize("/guides/primary-relating-hexagrams")',
      'localize("/help")',
      'localize("/privacy")',
      'localize("/terms")',
      'localize("/acceptable-use")',
      'href="mailto:support@quickiching.com"',
    ]) {
      expect(scenePanels).not.toContain(legacyOwner);
      expect(contentShell).not.toContain(legacyOwner);
    }
  });

  it("makes every shell presentation consume contract capability flags", () => {
    const scene = readFileSync(new URL("../components/scene-navigation.tsx", import.meta.url), "utf8");
    const content = readFileSync(new URL("../components/navigation/content-navigation-shell.tsx", import.meta.url), "utf8");
    const info = readFileSync(new URL("../components/info-pages/info-page-header.tsx", import.meta.url), "utf8");
    for (const source of [scene, content, info]) {
      expect(source).toContain("contract.homeControl");
      expect(source).toContain("contract.localeControl");
      expect(source).toContain("contract.accountControl");
    }
    // Scene + Content are the only presentations that own discovery UI. Info
    // is selected only for contracts whose primaryNavigation is frozen false.
    expect(scene).toContain("contract.primaryNavigation");
    expect(content).toContain("contract.primaryNavigation");
    expect(scene).toContain("contract.accountControl && authEnabled");
    expect(content).toContain("contract.accountControl && authEnabled");
    expect(info).toContain("contract.accountControl && authEnabled");
  });

  it("keeps local flow exits explicit and separate from Start New semantics", () => {
    const yarrow = readFileSync(new URL("../components/public-reading/yarrow-tool.tsx", import.meta.url), "utf8");
    const manual = readFileSync(new URL("../components/public-reading/manual-cast-tool.tsx", import.meta.url), "utf8");
    const result = readFileSync(new URL("../components/reading-result/reading-result-client.tsx", import.meta.url), "utf8");
    const auth = readFileSync(new URL("../components/auth/auth-form.tsx", import.meta.url), "utf8");
    expect(yarrow).toContain("data-flow-exit");
    expect(manual).toContain("data-flow-exit");
    expect(manual).toContain("data-question-restart");
    expect(manual).toContain("questionContext?.restartQuestion()");
    expect(result).toContain("data-reading-exit");
    expect(result).toContain("onNewReading={startNewReading}");
    expect(result).toContain("newReadingLabel");
    expect(auth).toContain("data-auth-exit");
  });
});
