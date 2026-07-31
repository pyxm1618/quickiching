import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function source(file: string): Promise<string> {
  return readFile(path.join(process.cwd(), file), "utf8");
}

describe("production action boundaries", () => {
  it("delegates review and casting privacy mutations to their atomic PostgreSQL services", async () => {
    const text = await source("src/app/production-actions.ts");
    expect(text).toContain("runtime.qualityReview.submit");
    expect(text).toContain("runtime.privacy.requestCastingDeletion");
    expect(text).toContain("runtime.privacy.restoreCasting");
    expect(text).not.toContain("REVIEW_RESPONSE_DAYS");
    expect(text).not.toContain("DELETE_RECOVERY_DAYS");
    expect(text).not.toMatch(/update\s+casting_sessions\s+set\s+lifecycle\s*=\s*'user_deleted'/i);
  });

  it("hashes direct production and privacy rate-limit identities before database persistence", async () => {
    const production = await source("src/app/production-actions.ts");
    const privacy = await source("src/app/privacy-actions.ts");
    expect(production).toContain('key: hmac(subject, "anon")');
    expect(privacy).toContain('key: hmac(`privacy:${action}:${userId}`, "anon")');
    expect(privacy).not.toContain("key: `privacy:${action}:${userId}`");
  });
});
