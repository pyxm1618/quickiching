import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";

const appRoot = new URL(".", import.meta.url).pathname;
const defaultLayout = `${appRoot}(default)/layout.tsx`;
const localizedLayout = `${appRoot}(localized)/[locale]/layout.tsx`;
const globalNotFound = `${appRoot}global-not-found.tsx`;
const localizedNotFound = `${appRoot}(localized)/[locale]/not-found.tsx`;
const localizedCatchAll = `${appRoot}(localized)/[locale]/[...slug]/page.tsx`;
const legacyActionSource = new URL("../legacy/commercial/actions.ts", import.meta.url).pathname;

describe("App Router multilingual architecture", () => {
  it("has separate English and localized root layouts", () => {
    expect(existsSync(defaultLayout)).toBe(true);
    expect(existsSync(localizedLayout)).toBe(true);
    expect(readFileSync(defaultLayout, "utf8")).toContain('<html lang="en"');
    expect(readFileSync(localizedLayout, "utf8")).toContain('<html lang="zh-Hans"');
  });

  it("keeps the localized route static and limited to zh", () => {
    expect(readFileSync(localizedLayout, "utf8")).toContain('return [{ locale: "zh" }]');
    expect(readFileSync(localizedLayout, "utf8")).toContain('if (locale !== "zh") notFound()');
    expect(readFileSync(localizedLayout, "utf8")).toContain("export const dynamicParams = false");
    expect(existsSync(localizedCatchAll)).toBe(true);
  });

  it("keeps English global 404 metadata isolated from homepage metadata", async () => {
    expect(existsSync(globalNotFound)).toBe(true);
    const notFoundModule = await import("./global-not-found");
    expect(notFoundModule.metadata.title).toBe("Page Not Found | Quick I Ching");
    expect(notFoundModule.metadata.robots).toEqual({ index: false, follow: false });
    expect(notFoundModule.metadata.alternates).toBeUndefined();
    expect(notFoundModule.metadata.openGraph).not.toHaveProperty("url");
  });

  it("gives localized 404s their own noindex metadata", async () => {
    expect(existsSync(localizedNotFound)).toBe(true);
    const localizedNotFoundModule = await import("./(localized)/[locale]/not-found");
    expect(localizedNotFoundModule.metadata).toBeDefined();
    if (!localizedNotFoundModule.metadata) return;
    expect(localizedNotFoundModule.metadata.title).toEqual({ absolute: "页面不存在 | Quick I Ching" });
    expect(localizedNotFoundModule.metadata.robots).toEqual({ index: false, follow: false });
    expect(localizedNotFoundModule.metadata.alternates).toBeUndefined();
    expect(localizedNotFoundModule.metadata.openGraph).not.toHaveProperty("url");
  });

  it("attaches localized 404 metadata to the catch-all route before notFound()", async () => {
    const catchAllModule = await import("./(localized)/[locale]/[...slug]/page");
    expect(catchAllModule.metadata).toBeDefined();
    if (!catchAllModule.metadata) return;
    expect(catchAllModule.metadata.title).toEqual({ absolute: "页面不存在 | Quick I Ching" });
    expect(catchAllModule.metadata.robots).toEqual({ index: false, follow: false });
  });

  it("keeps Commercial V2 routes and actions outside the Public V1 App Router graph", () => {
    for (const route of [
      `${appRoot}(default)/signin/page.tsx`,
      `${appRoot}(default)/checkout/simulate/page.tsx`,
      `${appRoot}(default)/cast/[method]/page.tsx`,
      `${appRoot}(default)/result/[castingId]/page.tsx`,
    ]) {
      expect(existsSync(route)).toBe(false);
    }
    expect(existsSync(`${appRoot}actions.ts`)).toBe(false);
    expect(existsSync(legacyActionSource)).toBe(true);
  });

  it("permanently redirects English-prefixed paths to unprefixed paths", async () => {
    if (!nextConfig.redirects) throw new Error("Next redirect configuration is missing");
    const redirects = await nextConfig.redirects();
    expect(redirects.find((redirect) => redirect.source === "/en")).toMatchObject({ destination: "/", permanent: true });
    expect(redirects.find((redirect) => redirect.source === "/en/:path*")).toMatchObject({ destination: "/:path*", permanent: true });
  });
});
