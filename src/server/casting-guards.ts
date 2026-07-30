import type { CastingMethod } from "@/domain/casting/types";
import { DomainError } from "@/server/errors/domain-error";
import type { CastingSession, CastingStep } from "./repository";

export function assertCastingMutationAllowed(
  session: CastingSession,
  expectedMethod: CastingMethod,
  now: Date,
): void {
  if (session.method !== expectedMethod) throw new DomainError("CASTING_METHOD_MISMATCH", "This casting cannot be changed in its current state.", false);
  if (!session.currentQuestionVersionId) throw new DomainError("QUESTION_REQUIRED", "This casting cannot be changed in its current state.", false);
  if (session.riskStatus !== "allowed") throw new DomainError("RISK_BLOCKED", "This casting cannot be changed in its current state.", false);
  if (session.lifecycle !== "draft" && session.lifecycle !== "casting") throw new DomainError("CASTING_NOT_ACTIVE", "This casting cannot be changed in its current state.", false);
  if (session.castingExpiresAt && now.getTime() > session.castingExpiresAt.getTime())
    throw new DomainError("CASTING_EXPIRED", "This casting cannot be changed in its current state.", false);
}

export function nextMissingCoinLine(steps: CastingStep[]): number | null {
  for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
    if (!steps.some((step) => step.stepKind === "coin" && step.lineIndex === lineIndex)) return lineIndex;
  }
  return null;
}

export function nextYarrowCoordinate(steps: CastingStep[]): { lineIndex: number; changeIndex: number } | null {
  for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
    for (let changeIndex = 0; changeIndex < 3; changeIndex++) {
      if (!steps.some((step) => step.stepKind === "yarrow_change" && step.lineIndex === lineIndex && step.changeIndex === changeIndex))
        return { lineIndex, changeIndex };
    }
  }
  return null;
}
