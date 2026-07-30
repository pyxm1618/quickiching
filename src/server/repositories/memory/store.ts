import { randomBytes } from "node:crypto";
import type { EntitlementBatch, LedgerEntry } from "@/domain/entitlements/batch";
import { DomainError } from "@/server/errors/domain-error";
import type {
  CastResult,
  CastingRiskDecision,
  CastingSession,
  CastingStep,
  LoginIntent,
  Order,
  Preview,
  QualityReview,
  QuestionLock,
  QuestionVersion,
  Reading,
  Reservation,
  Session,
  User,
} from "../models";

type RecoverableRepositoryCode =
  | "CASTING_ALREADY_IN_PROGRESS"
  | "CASTING_NOT_DELETABLE"
  | "CASTING_NOT_FOUND"
  | "CASTING_NOT_REVEALABLE"
  | "LOGIN_INTENT_CALLBACK_INVALID"
  | "LOGIN_INTENT_CONSUMED"
  | "LOGIN_INTENT_EXPIRED"
  | "LOGIN_INTENT_INVALID"
  | "LOGIN_INTENT_NOT_FOUND"
  | "ORDER_NOT_FOUND"
  | "QUALITY_REVIEW_ALREADY_SUBMITTED"
  | "QUALITY_REVIEW_FORBIDDEN"
  | "QUALITY_REVIEW_NOT_DELIVERED"
  | "READING_NOT_FOUND"
  | "REPO_LOCK_CONTENTION"
  | "RESERVATION_NOT_ACTIVE";

export function repositoryError(code: RecoverableRepositoryCode): DomainError {
  switch (code) {
    case "CASTING_ALREADY_IN_PROGRESS":
    case "CASTING_NOT_FOUND":
    case "CASTING_NOT_REVEALABLE":
      return new DomainError(code, "This casting cannot be changed in its current state.", false);
    case "CASTING_NOT_DELETABLE":
      return new DomainError(code, "This casting cannot be deleted in its current state.", false);
    case "LOGIN_INTENT_CALLBACK_INVALID":
      return new DomainError(code, "The sign-in return path is not allowed.", false, "callbackPath");
    case "LOGIN_INTENT_CONSUMED":
      return new DomainError(code, "This sign-in link has already been used.", false);
    case "LOGIN_INTENT_EXPIRED":
      return new DomainError(code, "This sign-in link has expired.", false);
    case "LOGIN_INTENT_INVALID":
    case "LOGIN_INTENT_NOT_FOUND":
      return new DomainError(code, "This sign-in link is invalid.", false);
    case "ORDER_NOT_FOUND":
      return new DomainError(code, "Order not found", false);
    case "QUALITY_REVIEW_ALREADY_SUBMITTED":
      return new DomainError(code, "This report already has a review", false);
    case "QUALITY_REVIEW_FORBIDDEN":
    case "QUALITY_REVIEW_NOT_DELIVERED":
    case "READING_NOT_FOUND":
      return new DomainError(code, "This review is not available.", false);
    case "REPO_LOCK_CONTENTION":
    case "RESERVATION_NOT_ACTIVE":
      return new DomainError(code, "Please retry this request.", true);
    default: {
      const exhaustive: never = code;
      return exhaustive;
    }
  }
}

export function memoryId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export class MemoryStore {
  readonly users = new Map<string, User>();
  readonly sessions = new Map<string, Session>();
  readonly loginIntents = new Map<string, LoginIntent>();
  readonly castingSessions = new Map<string, CastingSession>();
  readonly questionVersions = new Map<string, QuestionVersion>();
  readonly castingSteps = new Map<string, CastingStep>();
  readonly castResults = new Map<string, CastResult>();
  readonly castingRiskDecisions = new Map<string, CastingRiskDecision>();
  readonly questionLocks = new Map<string, QuestionLock>();
  readonly previews = new Map<string, Preview>();
  readonly readings = new Map<string, Reading>();
  readonly reservations = new Map<string, Reservation>();
  readonly entitlementBatches = new Map<string, EntitlementBatch>();
  readonly entitlementLedger: LedgerEntry[] = [];
  readonly orders = new Map<string, Order>();
  readonly qualityReviews = new Map<string, QualityReview>();
  private mutexBusy = false;

  withLock<T>(
    operation: () => T,
    ...asyncCallbackIsForbidden: T extends PromiseLike<unknown> ? [never] : []
  ): T {
    void asyncCallbackIsForbidden;
    if (this.mutexBusy) throw repositoryError("REPO_LOCK_CONTENTION");
    this.mutexBusy = true;
    try {
      const result = operation();
      if (typeof result === "object" && result !== null && "then" in result) {
        throw new Error("MEMORY_LOCK_REQUIRES_SYNCHRONOUS_CALLBACK");
      }
      return result;
    } finally {
      this.mutexBusy = false;
    }
  }
}
