import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import type { HexagramResult } from "@/domain/casting/types";
import type { InterpretiveBasisReference } from "@/domain/readings/types";

export const CLASSIC_SOURCE = {
  version: "legge-1899-v1",
  title: "The Sacred Books of China: The Texts of Confucianism, Part II — The Yi King",
  translator: "James Legge",
  publicationYear: 1899,
  series: "Sacred Books of the East, Volume 16",
  rightsStatus: "public_domain_source" as const,
  provenanceUrl: "https://archive.org/details/sacredbooksofchi16legg",
  note: "Controlled source metadata and reference identifiers; interpretive prose is generated separately and never represented as a quotation.",
};

export type ClassicHexagramRecord = {
  sourceVersion: typeof CLASSIC_SOURCE.version;
  hexagramNumber: number;
  englishName: string;
  judgmentReferenceId: string;
  lineReferenceIds: readonly string[];
};

export function classicJudgmentReferenceId(hexagramNumber: number): string {
  return `${CLASSIC_SOURCE.version}:hexagram-${hexagramNumber}:judgment`;
}

export function classicLineReferenceId(hexagramNumber: number, linePosition: number): string {
  return `${CLASSIC_SOURCE.version}:hexagram-${hexagramNumber}:line-${linePosition}`;
}

export function getClassicHexagramRecord(hexagramNumber: number): ClassicHexagramRecord {
  if (!Number.isInteger(hexagramNumber) || hexagramNumber < 1 || hexagramNumber > 64) {
    throw new Error("CLASSIC_HEXAGRAM_NUMBER_INVALID");
  }
  return {
    sourceVersion: CLASSIC_SOURCE.version,
    hexagramNumber,
    englishName: hexagramByNumber(hexagramNumber).englishName,
    judgmentReferenceId: classicJudgmentReferenceId(hexagramNumber),
    lineReferenceIds: [1, 2, 3, 4, 5, 6].map((line) => classicLineReferenceId(hexagramNumber, line)),
  };
}

export function buildClassicReferences(result: HexagramResult): InterpretiveBasisReference[] {
  const references: InterpretiveBasisReference[] = [{
    referenceId: classicJudgmentReferenceId(result.primaryHexagramNumber),
    sourceVersion: CLASSIC_SOURCE.version,
    hexagramNumber: result.primaryHexagramNumber,
    kind: "judgment",
  }];

  for (const linePosition of result.movingLinePositions) {
    references.push({
      referenceId: classicLineReferenceId(result.primaryHexagramNumber, linePosition),
      sourceVersion: CLASSIC_SOURCE.version,
      hexagramNumber: result.primaryHexagramNumber,
      linePosition,
      kind: "line",
    });
  }

  if (result.relatingHexagramNumber != null) {
    references.push({
      referenceId: classicJudgmentReferenceId(result.relatingHexagramNumber),
      sourceVersion: CLASSIC_SOURCE.version,
      hexagramNumber: result.relatingHexagramNumber,
      kind: "relating_judgment",
    });
  }
  return references;
}
