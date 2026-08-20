import { describe, expect, it } from "vitest";
import { TRIGRAM_BITS, KING_WEN_HEXAGRAMS } from "@/domain/casting/hexagrams/king-wen";
import { CLASSICAL_HEXAGRAMS, type ClassicalHexagram } from "./classical";

type ClassicalLine = {
  position: number;
  label: string;
  text: string;
  source: ClassicalHexagram["source"];
};

type ClassicalUseLine = {
  label: "用九" | "用六";
  text: string;
  source: ClassicalHexagram["source"];
};

type ClassicalHexagramWithLines = ClassicalHexagram & {
  lines: readonly [ClassicalLine, ClassicalLine, ClassicalLine, ClassicalLine, ClassicalLine, ClassicalLine];
  useLine?: ClassicalUseLine;
  variantName?: string;
};

const records = CLASSICAL_HEXAGRAMS as readonly ClassicalHexagramWithLines[];

function expectedLineLabel(number: number, position: number): string {
  const hexagram = KING_WEN_HEXAGRAMS[number - 1];
  if (!hexagram) throw new Error(`HEXAGRAM_MISSING: ${number}`);
  const binary = (TRIGRAM_BITS[hexagram.upper] << 3) | TRIGRAM_BITS[hexagram.lower];
  const isYang = (binary & (1 << (position - 1))) !== 0;
  const prefix = position === 1 ? "初" : position === 6 ? "上" : "";
  const suffix = position === 1 || position === 6 ? "" : ["", "", "二", "三", "四", "五"][position];
  return `${prefix}${isYang ? "九" : "六"}${suffix}`;
}

describe("classical changing-line data", () => {
  it("contains six ordered ordinary lines for every one of the 64 hexagrams", () => {
    const ordinaryLines = records.flatMap((entry) => entry.lines);

    expect(records).toHaveLength(64);
    expect(ordinaryLines).toHaveLength(384);
    for (const entry of records) {
      expect(entry.lines.map((line) => line.position)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(new Set(entry.lines.map((line) => line.position)).size).toBe(6);
      for (const line of entry.lines) {
        expect(line.label).toBe(expectedLineLabel(entry.number, line.position));
        expect(line.text.trim()).not.toBe("");
        expect(line.source.textSourceRevision).toBe(entry.source.textSourceRevision);
        expect(line.source.textSourceUrl).toContain(`oldid=${entry.source.textSourceRevision}`);
      }
    }
  });

  it("models 乾用九 and 坤用六 as separate appendices", () => {
    expect(records.find((entry) => entry.number === 1)?.useLine).toMatchObject({
      label: "用九",
      text: "见群龙无首，吉。",
    });
    expect(records.find((entry) => entry.number === 2)?.useLine).toMatchObject({
      label: "用六",
      text: "利永贞。",
    });
    expect(records.filter((entry) => entry.useLine).map((entry) => entry.number)).toEqual([1, 2]);
  });

  it("keeps auditable fixed-source metadata on every ordinary line", () => {
    for (const entry of records) {
      for (const line of entry.lines) {
        expect(line.source.work).toBe("周易");
        expect(line.source.textSourceUrl).toMatch(/^https:\/\/zh\.wikisource\.org\/w\/index\.php\?title=/);
        expect(line.source.textSourceRevision).toBeGreaterThan(0);
        expect(line.source.textStatus).toContain("fixed Wikisource revision");
      }
    }
  });

  it("uses 遁 as the primary display name while retaining 遯 only as variant metadata", () => {
    const retreat = records.find((entry) => entry.number === 33);
    expect(retreat?.chineseName).toBe("遁");
    expect(retreat?.variantName).toBe("遯");
    expect(retreat?.chineseName).not.toContain("、");
  });

  it("locks the representative source text used by the moving-line renderer", () => {
    expect(records.find((entry) => entry.number === 1)?.lines[0]).toMatchObject({ label: "初九", text: "潜龙勿用。" });
    expect(records.find((entry) => entry.number === 2)?.lines[0]).toMatchObject({ label: "初六", text: "履霜，坚冰至。" });
  });
});
