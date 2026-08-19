import type { MeiHuaResult } from "@/domain/casting/mei-hua/algorithm";
import type { ThreeCoinStep } from "@/domain/casting/three-coin/algorithm";
import type { YarrowLineResult } from "@/domain/casting/yarrow/algorithm";
import type { LineValue } from "@/domain/casting/types";

export const PUBLIC_READING_SCHEMA_VERSION = 1 as const;

export type PublicReadingMethod = "three-coin" | "yarrow-stalks" | "mei-hua-yi-shu" | "manual";

export const PUBLIC_READING_METHODS: readonly PublicReadingMethod[] = [
  "three-coin",
  "yarrow-stalks",
  "mei-hua-yi-shu",
  "manual",
] as const;

export const PUBLIC_METHOD_VERSIONS: Record<PublicReadingMethod, string> = {
  "three-coin": "three-coin-v1",
  "yarrow-stalks": "yarrow-zhu-xi-digital-v2",
  "mei-hua-yi-shu": "mei-hua-gregorian-current-time-v2",
  manual: "manual-cast-v1",
};

export type PublicLineTuple = readonly [LineValue, LineValue, LineValue, LineValue, LineValue, LineValue];

export type PublicReadingEvidence =
  | {
      kind: "three-coin";
      steps: readonly ThreeCoinStep[];
    }
  | {
      kind: "yarrow-stalks";
      lines: readonly YarrowLineResult[];
    }
  | {
      kind: "mei-hua-yi-shu";
      calculation: MeiHuaResult;
    }
  | {
      kind: "manual";
      mode: "line-values" | "primary-changing";
      primaryHexagramNumber?: number;
      changingLines?: readonly number[];
    }
  | {
      kind: "history";
      originalMethod: PublicReadingMethod;
    };

export type PublicReading = {
  schemaVersion: typeof PUBLIC_READING_SCHEMA_VERSION;
  id: string;
  createdAt: string;
  method: PublicReadingMethod;
  methodVersion: string;
  question?: string;
  lineValuesBottomUp: PublicLineTuple;
  primaryHexagram: number;
  changingLines: readonly number[];
  relatingHexagram: number | null;
  evidence: PublicReadingEvidence;
};

export type PublicReadingInput = {
  id?: string;
  createdAt?: string;
  method: PublicReadingMethod;
  methodVersion?: string;
  question?: string | null;
  lineValuesBottomUp: readonly number[];
  evidence: PublicReadingEvidence;
};
