import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { CLASSICAL_HEXAGRAMS } from "./classical";
import { CLASSICAL_SOURCE_SNAPSHOT_SHA256 } from "./classical-source-data";
import { loadPublicHexagramKnowledge } from "./knowledge";

describe("public hexagram knowledge", () => {
  it("keeps exactly 64 fixed classical entity records", () => {
    expect(CLASSICAL_HEXAGRAMS).toHaveLength(64);
    expect(new Set(CLASSICAL_HEXAGRAMS.map((entry) => entry.number)).size).toBe(64);
    expect(new Set(CLASSICAL_HEXAGRAMS.map((entry) => entry.slug)).size).toBe(64);
    for (const entry of CLASSICAL_HEXAGRAMS) {
      expect(entry.slug).toMatch(new RegExp(`^${entry.number}-[a-z0-9-]+$`));
      expect(entry.judgment.length).toBeGreaterThan(0);
      expect(entry.image.length).toBeGreaterThan(0);
      expect(entry.source.textSourceUrl).toMatch(/^https:\/\//);
      expect(entry.source.recordSourceUrl).toMatch(/^https:\/\//);
    }
    expect(new Set(CLASSICAL_HEXAGRAMS.map((entry) => entry.source.textSourceUrl)).size).toBe(64);
  });

  it("locks the corrected classical punctuation and character fixtures", () => {
    expect(CLASSICAL_HEXAGRAMS.find((entry) => entry.number === 3)?.judgment).toBe("屯：元亨，利贞。勿用有攸往，利建侯。");
    expect(CLASSICAL_HEXAGRAMS.find((entry) => entry.number === 2)?.judgment).toBe("坤：元亨。利牝马之贞。君子有攸往，先迷后得主。利西南得朋，东北丧朋。安贞，吉。");
    expect(CLASSICAL_HEXAGRAMS.find((entry) => entry.number === 4)?.judgment).toContain("初筮告");
    expect(CLASSICAL_HEXAGRAMS.find((entry) => entry.number === 4)?.judgment).not.toContain("初噬告");
    expect(CLASSICAL_HEXAGRAMS.find((entry) => entry.number === 41)?.judgment).toContain("利有攸往。曷之用");
    expect(CLASSICAL_HEXAGRAMS.find((entry) => entry.number === 41)?.judgment).not.toContain("利有攸往？");
    expect(CLASSICAL_HEXAGRAMS.find((entry) => entry.number === 63)?.judgment).toContain("亨小。利贞");
    expect(CLASSICAL_HEXAGRAMS.find((entry) => entry.number === 63)?.judgment).not.toContain("亨，小利贞");
    expect(CLASSICAL_HEXAGRAMS.find((entry) => entry.number === 57)?.judgment).toBe("巽：小亨。利有攸往。利见大人。");
  });

  it("matches the fixed 64-record Wikisource zh-Hans revision snapshot", () => {
    const snapshot = CLASSICAL_HEXAGRAMS.map((entry) => {
      const source = entry.source as typeof entry.source & { textSourceRevision?: number };
      const url = new URL(source.textSourceUrl);
      const title = url.searchParams.get("title") ?? decodeURIComponent(url.pathname).replace(/^\/wiki\//, "");
      return {
        number: entry.number,
        path: title.replace(/^周易\//, ""),
        revision: source.textSourceRevision ?? 0,
        judgment: entry.judgment,
        image: entry.image,
      };
    });
    const digest = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

    expect(snapshot).toHaveLength(64);
    expect(snapshot.every((entry) => entry.revision > 0)).toBe(true);
    expect(CLASSICAL_HEXAGRAMS.every((entry) => new URL(entry.source.textSourceUrl).searchParams.get("oldid"))).toBe(true);
    expect(digest).toBe("11e1151c6e83816f31941fc8d0c70918356d319136c3b8bd8fb5a25ce5117e8b");
    expect(CLASSICAL_SOURCE_SNAPSHOT_SHA256).toBe("f5f09f53d48f01e8f1fcef36fe9080f9ed967d0c403bdb4f656d8947f65adb5e");
  });

  it("reuses six authored v2 line records for every entity", async () => {
    for (const entry of CLASSICAL_HEXAGRAMS) {
      const knowledge = await loadPublicHexagramKnowledge(entry.number);
      expect(knowledge.lines).toHaveLength(6);
      expect(knowledge.seoTitle).toContain(String(entry.number));
      expect(knowledge.seoDescription.length).toBeGreaterThan(20);
      expect(knowledge.practicalMeaning.length).toBeGreaterThan(0);
      expect(knowledge.relatedConcepts).toHaveLength(3);
      expect(new Set(knowledge.relatedConcepts).size).toBe(3);
      expect(knowledge.lines.map((line) => line.position)).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });
});
