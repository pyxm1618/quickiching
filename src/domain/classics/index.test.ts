import { describe, expect, it } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import {
  CLASSIC_SOURCE,
  buildClassicReferences,
  getClassicHexagramRecord,
} from "./index";

describe("versioned classic source catalog", () => {
  it("declares stable public-domain provenance without claiming licensed modern text", () => {
    expect(CLASSIC_SOURCE).toMatchObject({
      version: "legge-1899-v1",
      translator: "James Legge",
      publicationYear: 1899,
      rightsStatus: "public_domain_source",
    });
    expect(CLASSIC_SOURCE.provenanceUrl).toMatch(/^https:\/\//);
  });

  it("contains one controlled record for every King Wen hexagram", () => {
    const records = Array.from({ length: 64 }, (_, index) => getClassicHexagramRecord(index + 1));
    expect(new Set(records.map((record) => record.hexagramNumber)).size).toBe(64);
    expect(new Set(records.map((record) => record.judgmentReferenceId)).size).toBe(64);
    expect(records.every((record) => record.lineReferenceIds.length === 6)).toBe(true);
  });

  it("builds exactly the references required by primary, moving, and relating facts", () => {
    const result = buildHexagramResult({
      lineValuesBottomUp: [9, 8, 7, 8, 7, 8],
      method: "three_coin",
      algorithmVersion: "three-coin-v1",
    });
    const references = buildClassicReferences(result);

    expect(references).toEqual([
      expect.objectContaining({
        referenceId: `legge-1899-v1:hexagram-${result.primaryHexagramNumber}:judgment`,
        kind: "judgment",
        hexagramNumber: result.primaryHexagramNumber,
      }),
      expect.objectContaining({
        referenceId: `legge-1899-v1:hexagram-${result.primaryHexagramNumber}:line-1`,
        kind: "line",
        linePosition: 1,
      }),
      expect.objectContaining({
        referenceId: `legge-1899-v1:hexagram-${result.relatingHexagramNumber}:judgment`,
        kind: "relating_judgment",
        hexagramNumber: result.relatingHexagramNumber,
      }),
    ]);
  });
});
