import type { LinePosition } from "@/domain/interpretation/v2/types";

export type KnowledgeDataClass = "source-derived" | "editorial-derived";
export type EditorialAttribution = "Quick I Ching editorial rendering";

export type SourceDerivedRendering = {
  dataClass: "source-derived";
  editorialAttribution: EditorialAttribution;
  sourceField: "judgment" | "image" | "line" | "use-line";
  hexagramNumber: number;
  linePosition?: LinePosition;
  sourceText: string;
  fixedSourceRevision: number;
  sourceUrl: string;
  editorialRendering: string;
};

export type EditorialDerivedText = {
  dataClass: "editorial-derived";
  text: string;
  basis: string;
};

export type PublicKnowledgeLine = {
  position: LinePosition;
  rendering: SourceDerivedRendering & { sourceField: "line"; linePosition: LinePosition };
  stageState?: EditorialDerivedText;
  modernMeaning: EditorialDerivedText;
  changeDynamic: EditorialDerivedText;
  caution: EditorialDerivedText;
  reflection: EditorialDerivedText;
  synthesis: EditorialDerivedText;
};

export type PublicKnowledgeLineTuple = readonly [
  PublicKnowledgeLine,
  PublicKnowledgeLine,
  PublicKnowledgeLine,
  PublicKnowledgeLine,
  PublicKnowledgeLine,
  PublicKnowledgeLine,
];

export type HexagramSpecificReadingCase = {
  kind: "use-line";
  rendering: SourceDerivedRendering & { sourceField: "use-line" };
};

export type HexagramRelationType = "structural-complement" | "structural-line-reversal";

export type HexagramKnowledgeRelation = {
  sourceHexagram: number;
  relatedHexagram: number;
  relationType: HexagramRelationType;
  explanation: string;
  provenance: {
    dataClass: "editorial-derived";
    verificationBasis: string;
  };
};

export type PublicHexagramKnowledgeDetail = {
  judgment: {
    rendering: SourceDerivedRendering & { sourceField: "judgment" };
    modernInterpretation: EditorialDerivedText;
  };
  image: {
    rendering: SourceDerivedRendering & { sourceField: "image" };
    modernInterpretation: EditorialDerivedText;
  };
  lines: PublicKnowledgeLineTuple;
  specialReadingCases: readonly HexagramSpecificReadingCase[];
  relationships: readonly HexagramKnowledgeRelation[];
};
