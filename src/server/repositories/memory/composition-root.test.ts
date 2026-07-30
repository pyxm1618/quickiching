import { describe, expect, it } from "vitest";

describe("memory repository composition root", () => {
  it("provides an explicit isolated repository factory", async () => {
    const memoryModule = await import("./index").catch(() => ({ createMemoryRepositories: undefined }));

    expect(memoryModule.createMemoryRepositories).toBeTypeOf("function");
    if (typeof memoryModule.createMemoryRepositories !== "function") return;

    const first = memoryModule.createMemoryRepositories();
    const second = memoryModule.createMemoryRepositories();
    const user = first.identityRepository.createUser(`isolated-${crypto.randomUUID()}@example.com`);

    expect(first.castingRepository).toBeDefined();
    expect(first.readingRepository).toBeDefined();
    expect(first.entitlementRepository).toBeDefined();
    expect(first.reviewRepository).toBeDefined();
    expect(first.privacyRepository).toBeDefined();
    expect(first.repo.getUser(user.id)).toEqual(user);
    expect(second.repo.getUser(user.id)).toBeUndefined();
  });
});
