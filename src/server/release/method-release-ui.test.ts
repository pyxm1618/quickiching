import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

describe("casting method release presentation", () => {
  it("uses the server release policy on every public method entry page", async () => {
    for (const file of ["src/app/page.tsx", "src/app/casting-methods/page.tsx"]) {
      const text = await source(file);
      expect(text).toContain("ProductionMethodReleasePolicy");
      expect(text).toContain("releasePolicy.isReleased");
      expect(text).toContain("Pending domain approval");
    }
  });

  it("documents approval variables as empty by default", async () => {
    const environment = await source(".env.example");
    expect(environment).toContain("YARROW_RULESET_APPROVED_VERSION=\n");
    expect(environment).toContain("MEI_HUA_RULESET_APPROVED_VERSION=\n");
    expect(environment).not.toContain("YARROW_RULESET_APPROVED_VERSION=yarrow-v1");
    expect(environment).not.toContain("MEI_HUA_RULESET_APPROVED_VERSION=mei-hua-v1");
  });
});
