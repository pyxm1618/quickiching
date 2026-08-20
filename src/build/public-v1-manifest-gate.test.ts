import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const implementation = new URL("./public-v1-manifest-gate.ts", import.meta.url);

describe("Public V1 server-action manifest gate", () => {
  it("rejects legacy actions unless their stable export key is explicitly allowlisted", async () => {
    expect(existsSync(implementation)).toBe(true);
    if (!existsSync(implementation)) return;

    const { assertPublicV1ServerActions, collectServerActions } = await import("./public-v1-manifest-gate");
    const manifest = {
      node: {
        legacyId: {
          filename: "app/actions.ts",
          exportedName: "signInAction",
          workers: { "app/(default)/signin/page": { moduleId: "1", async: false } },
        },
      },
      edge: {},
    };

    expect(collectServerActions(manifest)).toEqual([{
      id: "legacyId",
      key: "app/actions.ts#signInAction",
      filename: "app/actions.ts",
      exportedName: "signInAction",
    }]);
    expect(() => assertPublicV1ServerActions(manifest)).toThrow(/signInAction/);
    expect(() => assertPublicV1ServerActions(manifest, ["app/actions.ts#signInAction"])).not.toThrow();
    expect(() => assertPublicV1ServerActions({ node: {}, edge: {} })).not.toThrow();
  });
});
