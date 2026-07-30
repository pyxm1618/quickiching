import { describe, expect, it } from "vitest";
import { MemoryStore } from "./store";

describe("memory store lock contract", () => {
  it("rejects an asynchronous critical section", () => {
    const store = new MemoryStore();
    const unsafeWithLock = store.withLock.bind(store) as unknown as (operation: () => unknown) => unknown;

    expect(() => unsafeWithLock(async () => undefined)).toThrow("MEMORY_LOCK_REQUIRES_SYNCHRONOUS_CALLBACK");
  });
});
