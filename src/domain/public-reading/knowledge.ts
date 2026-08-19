import { classicalHexagramByNumber, type ClassicalHexagram } from "./classical";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import type { HexagramInterpretation, LineInterpretation } from "@/domain/interpretation/v2/types";

export type PublicHexagramKnowledge = ClassicalHexagram & {
  seoTitle: string;
  seoDescription: string;
  practicalMeaning: string;
  relatedConcepts: readonly [string, string, string];
  interpretation: HexagramInterpretation;
  lines: readonly [LineInterpretation, LineInterpretation, LineInterpretation, LineInterpretation, LineInterpretation, LineInterpretation];
};

export async function loadPublicHexagramKnowledge(number: number): Promise<PublicHexagramKnowledge> {
  const [classical, bundle] = await Promise.all([
    Promise.resolve(classicalHexagramByNumber(number)),
    loadHexagramInterpretation(number),
  ]);
  return {
    ...classical,
    seoTitle: `Hexagram ${classical.number} ${classical.chineseName} · ${classical.englishName}`,
    seoDescription: `${classical.judgment} ${classical.image} Explore the primary meaning, six changing-line anchors, and classical source metadata for Hexagram ${classical.number}.`,
    practicalMeaning: bundle.hexagram.orientation,
    relatedConcepts: [
      `Lower trigram · ${classical.trigrams.lower}`,
      `Upper trigram · ${classical.trigrams.upper}`,
      bundle.hexagram.coreTheme,
    ],
    interpretation: bundle.hexagram,
    lines: bundle.lines,
  };
}
