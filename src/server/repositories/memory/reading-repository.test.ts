import { describe, expect, it } from "vitest";
import { DomainError } from "@/server/errors/domain-error";
import { repo } from "@/server/repository";

function createCasting() {
  return repo.createCastingSession({
    method: "three_coin",
    scene: "career",
    interpretationGoal: "what_do_i_need_to_see_clearly",
    userId: null,
    anonHash: `anon-${crypto.randomUUID()}`,
    algorithmVersion: "three-coin-v1",
  });
}

describe("memory reading repository characterization", () => {
  it("creates one preview and records success and failure", () => {
    const casting = createCasting();
    const preview = repo.getOrCreatePreview(casting.id);

    expect(repo.getOrCreatePreview(casting.id)).toEqual(preview);
    expect(repo.savePreviewSuccess(casting.id, "relevant")).toMatchObject({ status: "completed", relevanceStatement: "relevant" });
    expect(repo.savePreviewFailed(casting.id)).toMatchObject({ status: "failed", relevanceStatement: null });
    expect(preview).toMatchObject({ status: "not_started", relevanceStatement: null });
    expect(repo.getPreview(casting.id)).toMatchObject({ status: "failed", relevanceStatement: null });
  });

  it("creates one reading per casting", () => {
    const casting = createCasting();
    const reading = repo.getOrCreateReading(casting.id);

    expect(repo.getOrCreateReading(casting.id)).toEqual(reading);
    expect(repo.getReading(reading.id)).toEqual(reading);
    expect(repo.getReadingByCasting(casting.id)).toEqual(reading);
  });
});

describe("memory reading repository audited defects", () => {
  it("rejects a preview whose parent casting does not exist", () => {
    expect(() => repo.getOrCreatePreview(`missing-${crypto.randomUUID()}`)).toThrowError(DomainError);
  });

  it("rejects a reading whose parent casting does not exist", () => {
    expect(() => repo.getOrCreateReading(`missing-${crypto.randomUUID()}`)).toThrowError(DomainError);
  });
});
