import { describe, expect, it } from "vitest";
import {
  deepReadingContextEnrichmentSchema,
  deepReadingContextSnapshotSchema,
  validateDeepReadingEvidence,
  type DeepReadingKnowledgeBundle,
  type DeepReadingContextEnrichment,
  type DeepReadingContextSnapshot,
} from "./deep-reading-contract";
import {
  decryptDeepReadingContextSnapshot,
  encryptDeepReadingContextSnapshot,
} from "@/server/generation/deep-reading-snapshot";
import { calculateDeepReadingContextSnapshotHash } from "@/server/generation/integrity";

const validEnrichment: DeepReadingContextEnrichment = {
  contextNotes: "My team has delayed the review twice, and I need to decide what to prepare before Friday.",
  options: ["Ask for a written timeline", "Wait for the scheduled review"],
  constraints: ["I cannot change teams this quarter"],
  concerns: ["I do not want to damage a working relationship"],
  interpretationGoal: "what_do_i_need_to_see_clearly",
  locale: "en",
};

const knowledge: DeepReadingKnowledgeBundle = {
  version: "quickiching-knowledge-v1",
  primary: {
    number: 47,
    name: "Oppression",
    chineseName: "困",
    judgment: "困：亨，贞，大人吉，无咎。",
    image: "泽无水，困。君子以致命遂志。",
    interpretation: {
      coreTheme: "Constraints",
      coreMeaning: "A situation under pressure",
      strength: "Persistence",
      challenge: "Limited resources",
      orientation: "Work within real limits",
      structureInterpretation: "Water below the lake",
      transitionTheme: "Pressure changing the structure",
      stabilityTheme: "Recognize what remains available",
    },
  },
  changingLines: [{
    position: 2,
    lineValue: 9,
    classicalText: "困于酒食，朱绂方来。",
    theme: "Help arrives",
    meaning: "Support may be near",
    changeDynamic: "Wait for reliable evidence",
    caution: "Do not assume support is guaranteed",
    reflection: "What commitment has actually been made?",
    synthesisPhrase: "Check whether help has become concrete",
  }],
  relating: {
    number: 45,
    name: "Gathering Together",
    chineseName: "萃",
    judgment: "萃：亨。王假有庙。",
    image: "泽上于地，萃。",
    coreMeaning: "People or resources coming together",
    orientation: "Look for credible coordination",
  },
  structuralChange: "The changing second line moves the cast from 47 toward 45.",
  evidence: [
    { id: "primary.judgment", source: "king_wen_judgment", hexagramNumber: 47, content: "困：亨，贞，大人吉，无咎。" },
    { id: "primary.line.2", source: "king_wen_line", hexagramNumber: 47, linePosition: 2, content: "困于酒食，朱绂方来。" },
    { id: "relating.judgment", source: "relating_judgment", hexagramNumber: 45, content: "萃：亨。王假有庙。" },
  ],
};
const castScope = {
  primaryHexagramNumber: 47,
  relatingHexagramNumber: 45,
  movingLinePositions: [2],
  readingVariant: "standard" as const,
};

const snapshot: DeepReadingContextSnapshot = {
  schemaVersion: "deep-reading-context-v1",
  coreQuestionAtCast: "Should I ask my manager for a written timeline?",
  context: validEnrichment,
  scene: "career",
  castMethod: "three_coin",
  methodVersion: "three-coin-v1",
  facts: {
    method: "three_coin",
    algorithmVersion: "three-coin-v1",
    classicMappingVersion: "king-wen-v1",
    lineValuesBottomUp: [7, 9, 8, 7, 8, 7] as const,
    primaryHexagramNumber: 47,
    movingLinePositions: [2],
    relatingHexagramNumber: 45,
    readingVariant: "standard",
  },
  snapshotAt: "2026-09-25T00:00:00.000Z",
  knowledgeVersion: "quickiching-knowledge-v1",
  risk: { status: "allowed", ruleVersion: "risk-v2", reasonCode: "none" },
  knowledge,
};

function report(references: Array<{ evidenceId: string; hexagramNumber?: number }>) {
  return {
    schemaVersion: "deep-reading-v2",
    readingVariant: "standard",
    directAnswer: "The cast points toward asking for clarity, while treating the response as something to verify rather than assume.",
    situationMapping: "The stated delays resemble the pressure in the primary pattern; the changing line makes concrete support the question to check.",
    keyTensions: ["Seeking clarity while preserving a working relationship"],
    conditionalDirection: "If a written timeline is offered and followed, it would support a more coordinated interpretation.",
    signalsToWatch: ["Whether the manager names an owner and a date for the next review"],
    practicalReflection: "A low-risk next step is to ask what information would make Friday's review useful, then compare the reply with what happens.",
    uncertaintyAndBoundaries: "The cast cannot establish your manager's intentions or predict the review outcome; those facts remain unknown.",
    interpretiveBasisReferences: references,
    disclaimer: "Use this as reflection, not as a substitute for your own judgment.",
  };
}

describe("Deep Reading input and evidence contract", () => {
  it("requires a real core question and enough situation context before generation", () => {
    expect(deepReadingContextEnrichmentSchema.safeParse(validEnrichment).success).toBe(true);
    expect(deepReadingContextEnrichmentSchema.safeParse({
      ...validEnrichment,
      contextNotes: "",
      options: [],
      constraints: [],
      concerns: [],
    }).success).toBe(false);
  });

  it("rejects a question too short to identify one specific concern", () => {
    expect(deepReadingContextSnapshotSchema.safeParse({ ...snapshot, coreQuestionAtCast: "Should?" }).success).toBe(false);
    expect(deepReadingContextSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it("accepts references only when they exist in the cast-scoped knowledge bundle", () => {
    expect(validateDeepReadingEvidence(report([{ evidenceId: "primary.line.2" }]), knowledge, castScope))
      .toEqual({ valid: true, invalidEvidenceIds: [] });
    expect(validateDeepReadingEvidence(report([{ evidenceId: "primary.line.6" }]), knowledge, castScope))
      .toEqual({ valid: false, invalidEvidenceIds: ["primary.line.6"] });
  });

  it("fails closed when a report omits all evidence references", () => {
    expect(validateDeepReadingEvidence(report([]), knowledge, castScope))
      .toEqual({ valid: false, invalidEvidenceIds: ["EVIDENCE_REQUIRED"] });
    expect(validateDeepReadingEvidence({ ...report([]), interpretiveBasisReferences: undefined }, knowledge, castScope))
      .toEqual({ valid: false, invalidEvidenceIds: ["EVIDENCE_REQUIRED"] });
  });

  it("rejects a variant label that does not describe the deterministic cast", () => {
    expect(validateDeepReadingEvidence({
      ...report([{ evidenceId: "primary.line.2" }]),
      readingVariant: "still_hexagram",
    }, knowledge, castScope)).toEqual({ valid: false, invalidEvidenceIds: ["READING_VARIANT_MISMATCH"] });
  });

  it("never permits evidence from an unrelated hexagram or an inactive line", () => {
    const wrongHexagram: DeepReadingKnowledgeBundle = {
      ...knowledge,
      evidence: [{ id: "primary.judgment", source: "king_wen_judgment", hexagramNumber: 1, content: "乾：元亨利贞。" }],
    };
    expect(validateDeepReadingEvidence(report([{ evidenceId: "primary.judgment" }]), wrongHexagram, castScope))
      .toEqual({ valid: false, invalidEvidenceIds: ["primary.judgment"] });
  });

  it("encrypts the immutable context snapshot and gives retries a stable keyed hash", () => {
    const env = {
      QUESTION_ENCRYPTION_KEYS: "v1:context-key-material",
      RESULT_INTEGRITY_KEYS: "v2:integrity-key-material",
    };
    const encrypted = encryptDeepReadingContextSnapshot("cast-1", snapshot, env);
    expect(encrypted.ciphertext).not.toContain(snapshot.coreQuestionAtCast);
    expect(decryptDeepReadingContextSnapshot("cast-1", encrypted, env)).toEqual(snapshot);
    expect(calculateDeepReadingContextSnapshotHash(snapshot, env))
      .toBe(calculateDeepReadingContextSnapshotHash(snapshot, env));
    expect(calculateDeepReadingContextSnapshotHash({
      ...snapshot,
      context: { ...validEnrichment, contextNotes: "A different situation that changes the available evidence." },
    }, env)).not.toBe(calculateDeepReadingContextSnapshotHash(snapshot, env));
  });
});
