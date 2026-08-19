import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import type { CastingMethod, LineValue } from "@/domain/casting/types";
import { normalizePublicQuestion } from "./question";
import {
  PUBLIC_METHOD_VERSIONS,
  PUBLIC_READING_SCHEMA_VERSION,
  type PublicLineTuple,
  type PublicReading,
  type PublicReadingEvidence,
  type PublicReadingInput,
  type PublicReadingMethod,
} from "./types";

const INTERNAL_METHODS: Record<Exclude<PublicReadingMethod, "manual">, CastingMethod> = {
  "three-coin": "three_coin",
  "yarrow-stalks": "yarrow_stalk",
  "mei-hua-yi-shu": "mei_hua_current_time",
};

function asPublicLineTuple(values: readonly number[]): PublicLineTuple {
  if (values.length !== 6) throw new Error("PUBLIC_READING_INVALID_LINE_COUNT");
  for (const value of values) {
    if (value !== 6 && value !== 7 && value !== 8 && value !== 9) {
      throw new Error(`PUBLIC_READING_INVALID_LINE_VALUE: ${value}`);
    }
  }
  return [
    values[0] as LineValue,
    values[1] as LineValue,
    values[2] as LineValue,
    values[3] as LineValue,
    values[4] as LineValue,
    values[5] as LineValue,
  ];
}

let fallbackIdCounter = 0;

function makeId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  fallbackIdCounter += 1;
  return `reading-${Date.now()}-${fallbackIdCounter}`;
}

function assertEvidenceMatchesMethod(method: PublicReadingMethod, evidence: PublicReadingEvidence): void {
  if (evidence.kind === "history") {
    if (evidence.originalMethod !== method) throw new Error("PUBLIC_READING_HISTORY_METHOD_MISMATCH");
    return;
  }
  if (method !== evidence.kind) throw new Error("PUBLIC_READING_EVIDENCE_METHOD_MISMATCH");
}

function assertManualEvidenceMatchesResult(
  evidence: Extract<PublicReadingEvidence, { kind: "manual" }>,
  primaryHexagram: number,
  changingLines: readonly number[],
): void {
  if (evidence.mode !== "primary-changing") return;
  if (evidence.primaryHexagramNumber !== primaryHexagram) {
    throw new Error("MANUAL_PRIMARY_HEXAGRAM_MISMATCH");
  }
  if (JSON.stringify(evidence.changingLines ?? []) !== JSON.stringify(changingLines)) {
    throw new Error("MANUAL_CHANGING_LINES_MISMATCH");
  }
}

export function buildPublicReading(input: PublicReadingInput): PublicReading {
  assertEvidenceMatchesMethod(input.method, input.evidence);
  const lineValuesBottomUp = asPublicLineTuple(input.lineValuesBottomUp);
  const question = normalizePublicQuestion(input.question);
  const internalMethod = input.method === "manual" ? "three_coin" : INTERNAL_METHODS[input.method];
  const methodVersion = input.methodVersion ?? PUBLIC_METHOD_VERSIONS[input.method];
  const computed = buildHexagramResult({
    lineValuesBottomUp: lineValuesBottomUp as readonly LineValue[],
    method: internalMethod,
    algorithmVersion: methodVersion,
  });

  assertManualEvidenceMatchesResult(input.evidence.kind === "manual" ? input.evidence : { kind: "manual", mode: "line-values" }, computed.primaryHexagramNumber, computed.movingLinePositions);

  return {
    schemaVersion: PUBLIC_READING_SCHEMA_VERSION,
    id: input.id ?? makeId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    method: input.method,
    methodVersion,
    ...(question ? { question } : {}),
    lineValuesBottomUp,
    primaryHexagram: computed.primaryHexagramNumber,
    changingLines: computed.movingLinePositions,
    relatingHexagram: computed.relatingHexagramNumber,
    evidence: input.evidence,
  };
}

export function readingFingerprint(reading: Pick<PublicReading, "schemaVersion" | "method" | "methodVersion" | "lineValuesBottomUp" | "primaryHexagram" | "changingLines" | "relatingHexagram">): string {
  return [
    "public-reading-fingerprint-v1",
    reading.schemaVersion,
    reading.method,
    reading.methodVersion,
    reading.lineValuesBottomUp.join(","),
    reading.primaryHexagram,
    reading.changingLines.join(","),
    reading.relatingHexagram ?? "none",
  ].join("|");
}
