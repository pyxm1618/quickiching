import { describe, expect, it } from "vitest";
import { ALGORITHM_VERSIONS } from "@/domain/casting/types";
import { createMemoryRepositories, MemoryStore } from "./index";

function createResultFixture() {
  const store = new MemoryStore();
  const repositories = createMemoryRepositories(store);
  const casting = repositories.castingRepository.createCastingSession({
    method: "three_coin",
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
    userId: "usr_owner",
    anonHash: null,
    algorithmVersion: ALGORITHM_VERSIONS.three_coin,
  });
  const result = repositories.castingRepository.saveCastResult({
    castingSessionId: casting.id,
    lineValues: [7, 8, 9, 6, 7, 8],
    methodCalculation: {
      kind: "three-coin",
      rounds: [
        { line: 1, faces: ["heads", "tails", "heads"] },
        { line: 2, faces: ["tails", "tails", "heads"] },
      ],
    },
  });
  return { store, repositories, casting, result };
}

describe("memory cast result integrity", () => {
  it("persists the HMAC key version and verifies a valid result before returning it", () => {
    const { repositories, casting, result } = createResultFixture();

    expect(result.resultHmacKeyVersion).toBe("v1");
    expect(repositories.castingRepository.getCastResult(casting.id)).toEqual(result);
  });

  it.each([
    ["hexagram fields", (stored: Record<string, unknown>) => { stored.primaryHexagramNumber = 1; }],
    ["line values", (stored: Record<string, unknown>) => { stored.lineValues = [6, 6, 6, 6, 6, 6]; }],
    ["method evidence", (stored: Record<string, unknown>) => { stored.methodCalculation = { kind: "forged" }; }],
    ["HMAC key version", (stored: Record<string, unknown>) => { stored.resultHmacKeyVersion = "retired"; }],
  ])("fails closed when stored %s are modified", (_label, mutate) => {
    const { store, repositories, casting } = createResultFixture();
    const stored = store.castResults.get(casting.id);
    if (!stored) throw new Error("fixture result missing");
    mutate(stored as unknown as Record<string, unknown>);

    expect(() => repositories.castingRepository.getCastResult(casting.id))
      .toThrow("CAST_RESULT_INTEGRITY_FAILED");
  });
});
