import { afterEach, describe, expect, it, vi } from "vitest";
import { MANUAL_SESSION_STORAGE_KEY } from "./method-session-retirement";
import {
  manualReadingFromSealedFacts,
  readManualSealedFacts,
} from "./manual-cast-sealed";
import {
  PENDING_COMPLETED_READING_KEY_PREFIX,
  readPendingCompletedReading,
} from "./pending-completed-reading";
import { performReadingHandoff } from "./reading-handoff";

const MANUAL_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const CREATED_AT = "2026-11-15T01:30:00.000Z";
const FROZEN_QUESTION = "Should I move to Kyoto?";
const LINES = [9, 8, 7, 6, 9, 8] as const;

type StorageMemory = Map<string, string>;

function stubBrowserStorage(): { session: StorageMemory; local: StorageMemory } {
  const session = new Map<string, string>();
  const local = new Map<string, string>();
  const wrap = (memory: StorageMemory) => ({
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
    clear: () => memory.clear(),
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() { return memory.size; },
  });
  vi.stubGlobal("window", {
    sessionStorage: wrap(session),
    localStorage: wrap(local),
  });
  return { session, local };
}

/** A fresh Manual completion whose handoff failed keeps these sealed facts. */
function seedSealedManualSession(session: StorageMemory, questionFields: Record<string, unknown>) {
  session.set(MANUAL_SESSION_STORAGE_KEY, JSON.stringify({
    schemaVersion: 1,
    id: MANUAL_ID,
    createdAt: CREATED_AT,
    started: true,
    ...questionFields,
    data: {
      mode: "line-values",
      lineValuesBottomUp: [...LINES],
      evidence: { kind: "manual", mode: "line-values" },
    },
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("HIGH-002 — Manual sealed recovery keeps the frozen question", () => {
  it("rebuilds the exact completed reading after reload and retries into Pending[A]", () => {
    const { session, local } = stubBrowserStorage();
    seedSealedManualSession(session, {
      question: FROZEN_QUESTION,
      coreQuestionAtCast: FROZEN_QUESTION,
      coreQuestionFrozenAtCast: true,
    });

    // Simulated reload: QuestionFirst sealed state supplies no live question.
    const facts = readManualSealedFacts();
    expect(facts).not.toBeNull();
    expect(facts?.coreQuestionAtCast).toBe(FROZEN_QUESTION);
    expect(facts?.question).toBe(FROZEN_QUESTION);

    const restored = manualReadingFromSealedFacts(facts!, undefined);
    expect(restored).not.toBeNull();
    expect(restored?.question).toBe(FROZEN_QUESTION);
    expect(restored?.id).toBe(MANUAL_ID);
    expect(restored?.createdAt).toBe(CREATED_AT);
    expect(restored?.method).toBe("manual");
    expect(restored?.methodVersion).toBe("manual-cast-v1");
    expect(restored?.lineValuesBottomUp).toEqual([...LINES]);
    expect(restored?.evidence).toEqual({ kind: "manual", mode: "line-values" });

    // Retry Handoff must write the exact same completed reading as Pending[A].
    const outcome = performReadingHandoff(restored!, { dependencies: { navigate: () => {} } });
    expect(outcome.kind).toBe("navigated");
    expect(outcome.kind === "navigated" ? outcome.readingId : null).toBe(MANUAL_ID);

    const rawPending = local.get(`${PENDING_COMPLETED_READING_KEY_PREFIX}${MANUAL_ID}`);
    expect(rawPending).toBeTruthy();
    const raw = JSON.parse(rawPending!);
    expect(raw.readingId).toBe(MANUAL_ID);
    expect(raw.question).toBe(FROZEN_QUESTION);
    expect(raw.lineValuesBottomUp).toEqual([...LINES]);
    expect(raw.evidence).toEqual({ kind: "manual", mode: "line-values" });

    const pending = readPendingCompletedReading(MANUAL_ID);
    expect(pending?.id).toBe(MANUAL_ID);
    expect(pending?.question).toBe(FROZEN_QUESTION);
    expect(pending?.lineValuesBottomUp).toEqual([...LINES]);
    expect(pending?.evidence).toEqual({ kind: "manual", mode: "line-values" });
    expect(pending?.createdAt).toBe(CREATED_AT);

    // The sealed method session is retired by the successful retry.
    expect(session.get(MANUAL_SESSION_STORAGE_KEY) ?? null).toBeNull();
  });

  it("prefers the frozen core question over the plain question", () => {
    const { session } = stubBrowserStorage();
    seedSealedManualSession(session, {
      question: "A draft question",
      coreQuestionAtCast: FROZEN_QUESTION,
      coreQuestionFrozenAtCast: true,
    });
    const reading = manualReadingFromSealedFacts(readManualSealedFacts()!, undefined);
    expect(reading?.question).toBe(FROZEN_QUESTION);
  });

  it("falls back to the plain question and then the caller fallback", () => {
    const { session } = stubBrowserStorage();
    seedSealedManualSession(session, { question: FROZEN_QUESTION, coreQuestionFrozenAtCast: true });
    expect(manualReadingFromSealedFacts(readManualSealedFacts()!, undefined)?.question).toBe(FROZEN_QUESTION);

    session.clear();
    seedSealedManualSession(session, {});
    expect(manualReadingFromSealedFacts(readManualSealedFacts()!, undefined)?.question).toBeUndefined();
    expect(manualReadingFromSealedFacts(readManualSealedFacts()!, "caller fallback")?.question).toBe("caller fallback");
  });
});
