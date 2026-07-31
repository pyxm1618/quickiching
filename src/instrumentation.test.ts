import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Next instrumentation runtime boundary", () => {
  it("loads Node-only runtime config inside the nodejs branch", () => {
    const source = readFileSync(new URL("./instrumentation.ts", import.meta.url), "utf8");

    expect(source).not.toMatch(/^\s*import\s+.*["']@\/server\/config["'];?\s*$/m);
    expect(source).toContain('if (process.env.NEXT_RUNTIME === "nodejs")');
    expect(source).toContain('await import("@/server/config")');
  });
});
