import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";

const appRoot = new URL(".", import.meta.url).pathname;
const defaultLayout = `${appRoot}(default)/layout.tsx`;
const localizedLayout = `${appRoot}(localized)/[locale]/layout.tsx`;

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
  });

  it("permanently redirects English-prefixed paths to unprefixed paths", async () => {
    if (!nextConfig.redirects) throw new Error("Next redirect configuration is missing");
    const redirects = await nextConfig.redirects();
    expect(redirects.find((redirect) => redirect.source === "/en")).toMatchObject({ destination: "/", permanent: true });
    expect(redirects.find((redirect) => redirect.source === "/en/:path*")).toMatchObject({ destination: "/:path*", permanent: true });
  });
});
