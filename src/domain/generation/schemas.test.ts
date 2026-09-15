import { describe, expect, it } from "vitest";
import {
  deterministicFactsSchema,
  previewOutputSchema,
  readingReportSchema,
} from "./schemas";

const facts = {
  method: "three_coin" as const,
  algorithmVersion: "three-coin-v1",
  classicMappingVersion: "king-wen-v1",
  lineValuesBottomUp: [7, 9, 8, 7, 6, 7] as [7, 9, 8, 7, 6, 7],
  primaryHexagramNumber: 1,
  movingLinePositions: [2, 5],
  relatingHexagramNumber: 44,
  readingVariant: "multiple_moving" as const,
};

describe("CP3 generation schemas", () => {
  it("accepts only the bounded surface Preview output", () => {
    expect(previewOutputSchema.parse({
      schemaVersion: "commercial-preview-v1",
      relevanceStatement: "The question and the pattern share a surface tension.",
      surfaceThemes: ["competing priorities"],
      boundary: "This is perspective, not a prediction or instruction.",
      disclaimer: "Use this as reflection rather than professional advice.",
    })).toMatchObject({ schemaVersion: "commercial-preview-v1" });

    expect(() => previewOutputSchema.parse({
      schemaVersion: "commercial-preview-v1",
      relevanceStatement: "ok",
      surfaceThemes: [],
      boundary: "ok",
      disclaimer: "ok",
    })).toThrow();

    expect(() => previewOutputSchema.parse({
      schemaVersion: "commercial-preview-v1",
      relevanceStatement: "ok",
      surfaceThemes: ["theme"],
      boundary: "ok",
      disclaimer: "ok",
      deepReading: "must not leak",
    })).toThrow();
  });

  it("accepts a complete Reading contract with all ten modules", () => {
    expect(readingReportSchema.parse({
      schemaVersion: "commercial-reading-v1",
      readingVariant: "multiple_moving",
      coreSummary: "summary",
      currentStage: "stage",
      primaryHexagramPattern: "pattern",
      changeMechanism: "change",
      possibleDirection: "direction",
      obstaclesAndBlindSpots: "obstacles",
      turningConditions: "conditions",
      conditionalActionDirection: "conditional",
      uncertaintyAndBoundaries: "boundaries",
      interpretiveBasisReferences: [],
      disclaimer: "perspective only",
    })).toBeDefined();
  });

  it("rejects deterministic facts that are not the fixed cast facts", () => {
    expect(deterministicFactsSchema.parse(facts)).toEqual(facts);
    expect(() => deterministicFactsSchema.parse({
      ...facts,
      primaryHexagramNumber: 2,
    })).not.toThrow();
  });
});
