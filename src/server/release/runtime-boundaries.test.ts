import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALGORITHM_VERSIONS } from "@/domain/casting/types";
import { ProductionMethodReleasePolicy } from "./method-release";

function source(relativePath: string): string {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8");
}

describe("production release boundaries", () => {
  it("does not treat environment variables as external domain approval evidence", () => {
    const policy = new ProductionMethodReleasePolicy({
      YARROW_RULESET_APPROVED_VERSION: ALGORITHM_VERSIONS.yarrow_stalk,
      MEI_HUA_RULESET_APPROVED_VERSION: ALGORITHM_VERSIONS.mei_hua_current_time,
    });

    expect(policy.isReleased("yarrow_stalk")).toBe(false);
    expect(policy.isReleased("mei_hua_current_time")).toBe(false);
  });

  it("requires the cron authorization secret in validated server startup configuration", () => {
    const cronConfig = source("src/server/cron-config.ts");
    const route = source("src/app/api/internal/generation/reconcile/route.ts");
    const instrumentation = source("src/instrumentation.ts");

    expect(cronConfig).toContain("loadCronSecret");
    expect(cronConfig).toContain("CRON_SECRET must be at least 32 characters");
    expect(route).toContain("loadCronSecret()");
    expect(route).not.toContain("process.env.CRON_SECRET");
    expect(instrumentation).toContain("validateCronConfig()");
  });

  it("derives new anonymous identifiers from the active session-signing write version", () => {
    const session = source("src/lib/auth/session.ts");

    expect(session).not.toContain("ANON_KEY_VERSION");
    expect(session).toContain('hmac(token, "anon")');
  });

  it("pins the Bun runtime used by local installs and CI", () => {
    const workflow = source(".github/workflows/ci.yml");
    const packageJson = JSON.parse(source("package.json")) as { packageManager?: string };

    expect(workflow).not.toContain("bun-version: latest");
    expect(workflow.match(/bun-version: 1\.3\.14/g)?.length).toBe(2);
    expect(packageJson.packageManager).toBe("bun@1.3.14");
  });
});
