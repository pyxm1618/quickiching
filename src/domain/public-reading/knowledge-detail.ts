import { BINARY_TO_KING_WEN, KING_WEN_HEXAGRAMS, TRIGRAM_BITS } from "@/domain/casting/hexagrams/king-wen";
import type { HexagramInterpretationBundle, LinePosition } from "@/domain/interpretation/v2/types";
import type { ClassicalHexagram, ClassicalSource } from "./classical";
import { EDITORIAL_EN_RENDERINGS } from "./editorial-en-renderings";
import type {
  EditorialDerivedText,
  HexagramKnowledgeRelation,
  PublicHexagramKnowledgeDetail,
  PublicKnowledgeLineTuple,
  SourceDerivedRendering,
} from "./knowledge-detail-types";

const EDITORIAL_ATTRIBUTION = "Quick I Ching editorial rendering" as const;
const SIX_LINE_MASK = 0b111111;

function sourceDerived(
  hexagramNumber: number,
  source: ClassicalSource,
  sourceField: SourceDerivedRendering["sourceField"],
  sourceText: string,
  editorialRendering: string,
  linePosition?: LinePosition,
): SourceDerivedRendering {
  return {
    dataClass: "source-derived",
    editorialAttribution: EDITORIAL_ATTRIBUTION,
    sourceField,
    hexagramNumber,
    ...(linePosition ? { linePosition } : {}),
    sourceText,
    fixedSourceRevision: source.textSourceRevision,
    sourceUrl: source.textSourceUrl,
    editorialRendering,
  };
}

function editorialDerived(text: string, basis: string): EditorialDerivedText {
  return { dataClass: "editorial-derived", text, basis };
}

function sixBitPattern(number: number): number {
  const def = KING_WEN_HEXAGRAMS[number - 1];
  if (!def || def.number !== number) throw new Error(`HEXAGRAM_RELATION_SOURCE_MISSING: ${number}`);
  return (TRIGRAM_BITS[def.upper] << 3) | TRIGRAM_BITS[def.lower];
}

function reverseSixBits(value: number): number {
  let reversed = 0;
  for (let index = 0; index < 6; index += 1) {
    if ((value & (1 << index)) !== 0) reversed |= 1 << (5 - index);
  }
  return reversed;
}

function kingWenNumberForPattern(pattern: number): number {
  const number = BINARY_TO_KING_WEN.get(pattern);
  if (!number) throw new Error(`HEXAGRAM_RELATION_TARGET_MISSING: pattern=${pattern}`);
  return number;
}

function structuralRelationships(number: number): readonly HexagramKnowledgeRelation[] {
  const pattern = sixBitPattern(number);
  const relations: HexagramKnowledgeRelation[] = [];

  const complement = kingWenNumberForPattern(pattern ^ SIX_LINE_MASK);
  if (complement !== number) {
    relations.push({
      sourceHexagram: number,
      relatedHexagram: complement,
      relationType: "structural-complement",
      explanation: `Hexagram ${number} becomes Hexagram ${complement} when every yin/yang line is inverted at the same position.`,
      provenance: {
        dataClass: "editorial-derived",
        verificationBasis:
          "Deterministic six-line transform verified from KING_WEN_HEXAGRAMS and TRIGRAM_BITS: bitwise complement across all six positions.",
      },
    });
  }

  const reversed = kingWenNumberForPattern(reverseSixBits(pattern));
  if (reversed !== number) {
    relations.push({
      sourceHexagram: number,
      relatedHexagram: reversed,
      relationType: "structural-line-reversal",
      explanation: `Hexagram ${number} becomes Hexagram ${reversed} when the six line positions are read in reverse order.`,
      provenance: {
        dataClass: "editorial-derived",
        verificationBasis:
          "Deterministic six-line transform verified from KING_WEN_HEXAGRAMS and TRIGRAM_BITS: bottom-to-top positions 1..6 are reversed to 6..1.",
      },
    });
  }

  return relations;
}

export function buildPublicHexagramKnowledgeDetail(
  classical: ClassicalHexagram,
  bundle: HexagramInterpretationBundle,
): PublicHexagramKnowledgeDetail {
  const editorial = EDITORIAL_EN_RENDERINGS[classical.number];
  if (!editorial) throw new Error(`EDITORIAL_RENDERING_MISSING: hexagramNumber=${classical.number}`);
  if (editorial.lines.length !== 6) {
    throw new Error(`EDITORIAL_LINE_RENDERING_COUNT_INVALID: hexagramNumber=${classical.number}`);
  }

  const lines = classical.lines.map((classicalLine, index) => {
    const interpretation = bundle.lines[index];
    const editorialRendering = editorial.lines[index];
    if (!interpretation || interpretation.hexagramNumber !== classical.number || interpretation.position !== classicalLine.position) {
      throw new Error(
        `EDITORIAL_LINE_BINDING_INVALID: hexagramNumber=${classical.number} position=${classicalLine.position}`,
      );
    }
    if (!editorialRendering) {
      throw new Error(
        `EDITORIAL_LINE_RENDERING_MISSING: hexagramNumber=${classical.number} position=${classicalLine.position}`,
      );
    }

    return {
      position: classicalLine.position,
      rendering: sourceDerived(
        classical.number,
        classicalLine.source,
        "line",
        classicalLine.text,
        editorialRendering,
        classicalLine.position,
      ) as SourceDerivedRendering & { sourceField: "line"; linePosition: LinePosition },
      // Stage/state is not newly authored. The existing, line-specific V2 theme is reused
      // so no second line interpretation catalog is created.
      stageState: editorialDerived(
        interpretation.theme,
        `Existing interpretation.v2 line.theme for Hexagram ${classical.number}, line ${classicalLine.position}; reused without re-authoring.`,
      ),
      modernMeaning: editorialDerived(
        interpretation.meaning,
        `Existing interpretation.v2 line.meaning for Hexagram ${classical.number}, line ${classicalLine.position}; reused without re-authoring.`,
      ),
      changeDynamic: editorialDerived(
        interpretation.changeDynamic,
        `Existing interpretation.v2 line.changeDynamic for Hexagram ${classical.number}, line ${classicalLine.position}; reused without re-authoring.`,
      ),
      caution: editorialDerived(
        interpretation.caution,
        `Existing interpretation.v2 line.caution for Hexagram ${classical.number}, line ${classicalLine.position}; reused without re-authoring.`,
      ),
      reflection: editorialDerived(
        interpretation.reflection,
        `Existing interpretation.v2 line.reflection for Hexagram ${classical.number}, line ${classicalLine.position}; reused without re-authoring.`,
      ),
      synthesis: editorialDerived(
        interpretation.synthesisPhrase,
        `Existing interpretation.v2 line.synthesisPhrase for Hexagram ${classical.number}, line ${classicalLine.position}; reused without re-authoring.`,
      ),
    };
  }) as unknown as PublicKnowledgeLineTuple;

  const specialReadingCases =
    classical.useLine && editorial.useLine
      ? [
          {
            kind: "use-line" as const,
            rendering: sourceDerived(
              classical.number,
              classical.useLine.source,
              "use-line",
              classical.useLine.text,
              editorial.useLine,
            ) as SourceDerivedRendering & { sourceField: "use-line" },
          },
        ]
      : [];

  if (Boolean(classical.useLine) !== Boolean(editorial.useLine)) {
    throw new Error(`EDITORIAL_USE_LINE_BINDING_INVALID: hexagramNumber=${classical.number}`);
  }

  return {
    judgment: {
      rendering: sourceDerived(
        classical.number,
        classical.source,
        "judgment",
        classical.judgment,
        editorial.judgment,
      ) as SourceDerivedRendering & { sourceField: "judgment" },
      modernInterpretation: editorialDerived(
        bundle.hexagram.coreMeaning,
        `Existing interpretation.v2 hexagram.coreMeaning for Hexagram ${classical.number}; reused without re-authoring.`,
      ),
    },
    image: {
      rendering: sourceDerived(
        classical.number,
        classical.source,
        "image",
        classical.image,
        editorial.image,
      ) as SourceDerivedRendering & { sourceField: "image" },
      modernInterpretation: editorialDerived(
        bundle.hexagram.structureInterpretation,
        `Existing interpretation.v2 hexagram.structureInterpretation for Hexagram ${classical.number}; reused without re-authoring.`,
      ),
    },
    lines,
    specialReadingCases,
    relationships: structuralRelationships(classical.number),
  };
}
