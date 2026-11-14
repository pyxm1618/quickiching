import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const legacy = (...parts: string[]) => parts.join("");

describe("navigation engineering closeout", () => {
  it("keeps only the approved scene navigation plus the approved Info-page header variant", () => {
    const header = source("./components/site-header.tsx");
    expect(header).toContain("SceneNavigation");
    expect(header).toContain("InfoPageHeader");
    expect(header).not.toContain(legacy("Standard", "SiteHeader"));
    expect(header).not.toContain("createPortal");
    expect(header).not.toContain(legacy("nav", "-drawer"));
    expect(header).not.toContain(legacy("methods", "TriggerRef"));
    expect(header).not.toContain(legacy("guides", "TriggerRef"));
  });

  it("resolves language switching from the Surface Contract instead of a route-registry lookup", () => {
    const navigation = source("./components/scene-navigation.tsx");
    expect(navigation).toContain('import { usePathname } from "next/navigation"');
    expect(navigation).toContain("const pathname = usePathname()");
    // Navigation / Surface Authority: locale semantics are centralised so a
    // transactional surface can never fall back to Home on a locale switch.
    expect(navigation).toContain("localeSwitchTarget(");
    expect(navigation).not.toContain("languageSwitchTarget");
  });

  it("removes the retired global footer from both locale layouts and from the repository", () => {
    const englishLayout = source("./app/(default)/layout.tsx");
    const chineseLayout = source("./app/(localized)/zh/layout.tsx");
    expect(englishLayout).not.toContain(legacy("Site", "Footer"));
    expect(chineseLayout).not.toContain(legacy("Site", "Footer"));
    expect(existsSync(new URL("./components/site-footer.tsx", import.meta.url))).toBe(false);
  });

  it("removes the old mobile-drawer account variant while preserving the shared account control", () => {
    const userNav = source("./components/auth/user-nav-control.tsx");
    expect(userNav).not.toContain(legacy("isMobile", "Drawer"));
    expect(userNav).not.toContain(legacy("nav", "-drawer"));
    expect(userNav).toContain("My Readings");
    expect(userNav).toContain("openAccountSurface");
  });

  it("removes old navigation/footer-only dictionary contracts", () => {
    const types = source("./i18n/dictionaries/types.ts");
    expect(types).not.toMatch(/\n\s+nav:\s*\{/u);
    expect(types).not.toMatch(/\n\s+footer:\s*\{/u);
  });

  it("retires the legacy drawer audit and keeps the approved scene-navigation gate", () => {
    expect(existsSync(new URL(legacy("../scripts/navigation", "-audit-gate.mjs"), import.meta.url))).toBe(false);
    expect(existsSync(new URL("../scripts/scene-navigation-qa.mjs", import.meta.url))).toBe(true);
    const pkg = JSON.parse(source("../package.json")) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.["gate:navigation"]).toBe("node scripts/scene-navigation-qa.mjs");
  });

  it("keeps account navigation on the formal My Readings and modal account surfaces", () => {
    const userNav = source("./components/auth/user-nav-control.tsx");
    expect(userNav).toContain('const readingsHref = `${authPrefix}/my-readings`');
    expect(userNav).toContain('openModal("account")');
    expect(userNav).toContain('openModal("settings")');
  });
});
