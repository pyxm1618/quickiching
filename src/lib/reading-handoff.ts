import type { PublicReading, PublicReadingMethod } from "@/domain/public-reading/types";
import { completedPublicReadingPath } from "@/lib/completed-public-reading";
import {
  readPendingCompletedReading,
  writePendingCompletedReading,
} from "@/lib/pending-completed-reading";
import { isMethodSessionRetired, retireMethodSession } from "@/lib/method-session-retirement";

/**
 * C2 / C7 — the single Reading Handoff owner.
 *
 * Transaction order is fixed:
 *   1. build Reading A (caller; identity already exists)
 *   2. write Pending[A]
 *   3. verify the write succeeded
 *   4. retire method session A
 *   5. verify the retirement succeeded
 *   6. replace(/readings/choice?session=A)
 *
 * Navigation never happens before both commits succeed. A failure never mints a
 * new reading id: the caller keeps the exact sealed facts for an exact retry.
 */

export type ReadingHandoffStage = "pending" | "retire";

export type ReadingHandoffOutcome =
  | { kind: "navigated"; readingId: string; href: string }
  | { kind: "failed"; readingId: string; stage: ReadingHandoffStage; code: string };

export type ReadingHandoffDependencies = {
  writePending: (reading: PublicReading) => void;
  readPending: (readingId: string) => PublicReading | null;
  retireSession: (method: PublicReadingMethod) => void;
  isSessionRetired: (method: PublicReadingMethod) => boolean;
  navigate: (href: string) => void;
};

function defaultDependencies(): Pick<
  ReadingHandoffDependencies,
  "writePending" | "readPending" | "retireSession" | "isSessionRetired"
> {
  return {
    writePending: (reading) => {
      writePendingCompletedReading(reading);
    },
    readPending: (readingId) => readPendingCompletedReading(readingId),
    retireSession: retireMethodSession,
    isSessionRetired: isMethodSessionRetired,
  };
}

function errorCode(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function pendingMatches(reading: PublicReading, restored: PublicReading | null): boolean {
  if (!restored) return false;
  return restored.id === reading.id
    && restored.method === reading.method
    && restored.methodVersion === reading.methodVersion
    && restored.createdAt === reading.createdAt
    && restored.lineValuesBottomUp.join(",") === reading.lineValuesBottomUp.join(",")
    && (restored.question ?? "") === (reading.question ?? "");
}

export function performReadingHandoff(
  reading: PublicReading,
  options: { zh?: boolean; dependencies?: Partial<ReadingHandoffDependencies> } = {},
): ReadingHandoffOutcome {
  const deps: ReadingHandoffDependencies = {
    ...defaultDependencies(),
    navigate: () => {},
    ...options.dependencies,
  };
  const readingId = reading.id;

  // 2 + 3 — write Pending[A] and verify the exact record is readable.
  try {
    deps.writePending(reading);
  } catch (error) {
    return { kind: "failed", readingId, stage: "pending", code: errorCode(error, "PENDING_WRITE_FAILED") };
  }

  let restored: PublicReading | null = null;
  try {
    restored = deps.readPending(readingId);
  } catch {
    restored = null;
  }
  if (!pendingMatches(reading, restored)) {
    return { kind: "failed", readingId, stage: "pending", code: "PENDING_VERIFY_FAILED" };
  }

  // 4 + 5 — retire method session A and verify it is gone.
  try {
    deps.retireSession(reading.method);
  } catch (error) {
    return { kind: "failed", readingId, stage: "retire", code: errorCode(error, "SESSION_RETIRE_FAILED") };
  }
  if (!deps.isSessionRetired(reading.method)) {
    return { kind: "failed", readingId, stage: "retire", code: "SESSION_RETIRE_UNVERIFIED" };
  }

  // 6 — non-reentry navigation.
  const href = completedPublicReadingPath(readingId, options.zh === true);
  deps.navigate(href);
  return { kind: "navigated", readingId, href };
}

/**
 * Method adapters call this. The only navigation primitive exposed is `replace`;
 * no adapter may introduce a `push` handoff.
 */
export function completeReadingHandoff(params: {
  reading: PublicReading;
  zh?: boolean;
  router: { replace: (href: string) => void };
  dependencies?: Partial<Omit<ReadingHandoffDependencies, "navigate">>;
}): ReadingHandoffOutcome {
  return performReadingHandoff(params.reading, {
    zh: params.zh,
    dependencies: {
      ...params.dependencies,
      navigate: (href) => params.router.replace(href),
    },
  });
}

export function readingHandoffFailureCopy(outcome: ReadingHandoffOutcome, zh: boolean): string | null {
  if (outcome.kind === "navigated") return null;
  if (zh) {
    return outcome.stage === "pending"
      ? "本次起卦已完成，但结果尚未成功保存。相同的卦象仍然保留，可以重试进入解卦。"
      : "本次起卦已完成，但旧的起卦会话未能安全结束。相同的卦象仍然保留，可以重试。";
  }
  return outcome.stage === "pending"
    ? "This cast is complete, but its result could not be saved yet. The same cast is preserved; retry the handoff."
    : "This cast is complete, but the casting session could not be retired safely. The same cast is preserved; retry.";
}
