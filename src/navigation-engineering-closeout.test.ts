import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("navigation engineering closeout", () => {
  it("keeps only the approved scene navigation plus the approved Info-page header variant", () => {
    const header = source("./components/site-header.tsx");
    expect(header).toContain("SceneNavigation");
    expect(header).toContain("InfoPageHeader");
    expect(header).not.toContain("StandardSiteHeader");
    expect(header).not.toContain("createPortal");
    expect(header).not.toContain("nav-drawer");
    expect(header).not.toContain("methodsTriggerRef");
    expect(header).not.toContain("guidesTriggerRef");
  });

  it("uses route-aware language switching in SceneNavigation for non-home routes", () => {
    const navigation = source("./components/scene-navigation.tsx");
    expect(navigation).toContain('import { usePathname } from "next/navigation"');
    expect(navigation).toContain("const pathname = usePathname()");
    expect(navigation).toContain("currentRouteForPath(pathname)");
  });

  it("removes the retired global footer from both locale layouts and from the repository", () => {
    const englishLayout = source("./app/(default)/layout.tsx");
    const chineseLayout = source("./app/(localized)/zh/layout.tsx");
    expect(englishLayout).not.toContain("SiteFooter");
    expect(chineseLayout).not.toContain("SiteFooter");
    expect(existsSync(new URL("./components/site-footer.tsx", import.meta.url))).toBe(false);
  });

  it("removes the old mobile-drawer account variant while preserving the shared account control", () => {
    const userNav = source("./components/auth/user-nav-control.tsx");
    expect(userNav).not.toContain("isMobileDrawer");
    expect(userNav).not.toContain("nav-drawer");
    expect(userNav).toContain("My Readings");
    expect(userNav).toContain("openAccountSurface");
  });

  it("removes old navigation/footer-only dictionary contracts", () => {
    const types = source("./i18n/dictionaries/types.ts");
    expect(types).not.toMatch(/\n\s+nav:\s*\{/u);
    expect(types).not.toMatch(/\n\s+footer:\s*\{/u);
  });

  it("retires the legacy drawer audit and keeps the approved scene-navigation gate", () => {
    expect(existsSync(new URL("../scripts/navigation-audit-gate.mjs", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../scripts/scene-navigation-qa.mjs", import.meta.url))).toBe(true);
    const pkg = JSON.parse(source("../package.json")) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.["gate:navigation"]).toBe("node scripts/scene-navigation-qa.mjs");
  });

  it("does not retire Local History as part of navigation cleanup", () => {
    expect(existsSync(new URL("./app/(default)/history/page.tsx", import.meta.url))).toBe(true);
    expect(existsSync(new URL("./app/(localized)/zh/history/page.tsx", import.meta.url))).toBe(true);
  });
});
