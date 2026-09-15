import { describe, expect, it } from "vitest";
import { authSchema, authTables, loginIntents, users } from "./auth-schema";

describe("CP2 PostgreSQL auth schema", () => {
  it("exposes the exact Better Auth singular model keys mapped to the canonical tables", () => {
    expect(Object.keys(authSchema).sort()).toEqual(["account", "session", "user", "verification"]);
    expect(authSchema.user).toBe(users);
    expect(authTables).toMatchObject({
      users,
      loginIntents,
    });
    expect(authSchema.account).toBeDefined();
    expect(authSchema.session).toBeDefined();
    expect(authSchema.verification).toBeDefined();
  });

  it("keeps the identity schema separate from deferred payment and AI tables", () => {
    const tableNames = Object.values(authTables).map((table) => table[Symbol.for("drizzle:Name") as never]);
    expect(tableNames).toEqual(expect.arrayContaining(["users", "sessions", "accounts", "verifications", "login_intents"]));
    expect(tableNames).not.toEqual(expect.arrayContaining(["orders", "webhook_inbox", "entitlement_ledger", "generation_jobs"]));
  });
});
