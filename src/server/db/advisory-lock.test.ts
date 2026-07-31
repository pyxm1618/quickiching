import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";
import { withPostgresAdvisoryTransactionLock } from "./advisory-lock";

function fakeSql(acquired: boolean): Sql {
  const tx = vi.fn(async () => [{ acquired }]);
  return {
    begin: vi.fn(async (operation: (transaction: typeof tx) => unknown) => operation(tx)),
  } as unknown as Sql;
}

describe("PostgreSQL advisory transaction lock", () => {
  it("does not run the protected operation when another dispatcher holds the lock", async () => {
    const operation = vi.fn(async () => "must-not-run");

    await expect(withPostgresAdvisoryTransactionLock(
      fakeSql(false),
      "generation-outbox-dispatch",
      operation,
    )).resolves.toEqual({ acquired: false });
    expect(operation).not.toHaveBeenCalled();
  });

  it("holds the transaction while the protected operation runs", async () => {
    const operation = vi.fn(async () => "completed");

    await expect(withPostgresAdvisoryTransactionLock(
      fakeSql(true),
      "generation-outbox-dispatch",
      operation,
    )).resolves.toEqual({ acquired: true, value: "completed" });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
