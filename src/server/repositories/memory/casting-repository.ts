import { evaluateClocks, transition as lifecycleTransition } from "@/domain/casting/lifecycle";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import type { CastingLifecycle, LineValue, RiskStatus } from "@/domain/casting/types";
import { decryptJson, encryptJson, hmac } from "@/lib/crypto";
import type {
  CastingRepository,
  CreateCastingSessionInput,
  RecordCoinStepInput,
  RecordCoinStepOutcome,
} from "../casting-repository";
import type { CastResult, CastingSession, CastingStep, QuestionLock, QuestionVersion } from "../models";
import { cloneForStorage, snapshot } from "./snapshot";
import { memoryId, repositoryError, type MemoryStore } from "./store";

const KEY_VERSION = "v1";
const HOUR_MS = 3600 * 1000;

export class MemoryCastingRepository implements CastingRepository {
  constructor(private readonly store: MemoryStore) {}

  hasActiveCast(ownerId: string, isUser: boolean): boolean {
    return this.findActiveCasting(ownerId, isUser) != null;
  }

  findActiveCasting(ownerId: string, isUser: boolean): CastingSession | undefined {
    for (const session of this.store.castingSessions.values()) {
      if (session.deletedAt) continue;
      const matches = isUser ? session.userId === ownerId : session.anonymousSessionHash === ownerId;
      if (matches && ["draft", "casting", "awaiting_reveal"].includes(session.lifecycle)) return snapshot(session);
    }
    return undefined;
  }

  createCastingSession(input: CreateCastingSessionInput): CastingSession {
    return this.store.withLock(() => {
      const ownerId = input.userId ?? input.anonHash ?? "";
      if (this.hasActiveCast(ownerId, input.userId != null)) throw repositoryError("CASTING_ALREADY_IN_PROGRESS");
      const now = new Date();
      const session: CastingSession = {
        id: memoryId("cas"),
        userId: input.userId,
        anonymousSessionHash: input.anonHash,
        anonymousHashKeyVersion: input.anonHash ? KEY_VERSION : null,
        method: input.method,
        lifecycle: "draft",
        riskStatus: "not_checked",
        scene: input.scene,
        interpretationGoal: input.interpretationGoal,
        currentQuestionVersionId: null,
        questionFingerprint: null,
        fingerprintKeyVersion: null,
        algorithmVersion: input.algorithmVersion,
        firstIrreversibleStepAt: null,
        castingExpiresAt: null,
        completedAt: null,
        revealExpiresAt: null,
        revealedAt: null,
        duplicateOfCastingId: null,
        deletedAt: null,
        purgeAfter: null,
        createdAt: now,
        updatedAt: now,
      };
      this.store.castingSessions.set(session.id, session);
      return snapshot(session);
    });
  }

  getCastingSession(castingId: string): CastingSession | undefined {
    const session = this.store.castingSessions.get(castingId);
    if (!session || session.deletedAt) return undefined;
    return snapshot(session);
  }

  ownsCasting(castingId: string, userId: string | null, anonHash: string | null): boolean {
    const session = this.store.castingSessions.get(castingId);
    if (!session || session.deletedAt) return false;
    if (userId != null) return session.userId === userId;
    if (anonHash != null) return session.anonymousSessionHash === anonHash;
    return false;
  }

  canReadRevealedResult(castingId: string, userId: string | null): boolean {
    const session = this.store.castingSessions.get(castingId);
    return !!session && !session.deletedAt && session.lifecycle === "revealed" && !!userId && session.userId === userId;
  }

  transitionCasting(castingId: string, to: CastingLifecycle): CastingSession {
    const session = this.store.castingSessions.get(castingId);
    if (!session) throw repositoryError("CASTING_NOT_FOUND");
    session.lifecycle = lifecycleTransition(session.lifecycle, to);
    session.updatedAt = new Date();
    return snapshot(session);
  }

  addQuestionVersion(input: {
    castingSessionId: string;
    context: string;
    versionNumber: number;
    reason: string;
  }): Readonly<QuestionVersion> {
    const session = this.store.castingSessions.get(input.castingSessionId);
    if (!session) throw repositoryError("CASTING_NOT_FOUND");
    const duplicate = [...this.store.questionVersions.values()].some(
      (version) => version.castingSessionId === input.castingSessionId && version.versionNumber === input.versionNumber,
    );
    if (duplicate) throw new Error("QUESTION_VERSION_ALREADY_EXISTS");
    const questionVersionId = memoryId("qv");
    const blob = encryptJson(
      { context: input.context },
      "context",
      KEY_VERSION,
      `${input.castingSessionId}:${questionVersionId}`,
    );
    const questionVersion: QuestionVersion = {
      id: questionVersionId,
      castingSessionId: input.castingSessionId,
      versionNumber: input.versionNumber,
      ciphertext: blob.data,
      iv: blob.iv,
      authTag: blob.tag,
      encryptionKeyVersion: blob.v,
      createdReason: input.reason,
      createdAt: new Date(),
    };
    this.store.questionVersions.set(questionVersion.id, questionVersion);
    session.currentQuestionVersionId = questionVersion.id;
    session.updatedAt = new Date();
    return snapshot(questionVersion);
  }

  getLatestQuestionContext(castingSessionId: string): string {
    let latest: QuestionVersion | null = null;
    for (const version of this.store.questionVersions.values()) {
      if (version.castingSessionId !== castingSessionId) continue;
      if (!latest || version.versionNumber > latest.versionNumber) latest = version;
    }
    if (!latest) return "";
    const blob = { v: latest.encryptionKeyVersion, iv: latest.iv, tag: latest.authTag, data: latest.ciphertext };
    return decryptJson<{ context: string }>(blob, "context", `${castingSessionId}:${latest.id}`).context;
  }

  saveStep(input: {
    castingSessionId: string;
    stepKind: string;
    lineIndex: number;
    changeIndex: number | null;
    rawRecord: unknown;
    lineValue: LineValue | null;
  }): CastingStep {
    return this.getOrCreateStep({
      castingSessionId: input.castingSessionId,
      stepKind: input.stepKind,
      lineIndex: input.lineIndex,
      changeIndex: input.changeIndex,
      create: () => ({ rawRecord: input.rawRecord, lineValue: input.lineValue }),
    });
  }

  getOrCreateStep(input: {
    castingSessionId: string;
    stepKind: string;
    lineIndex: number;
    changeIndex: number | null;
    create: () => { rawRecord: unknown; lineValue: LineValue | null };
  }): CastingStep {
    return this.store.withLock(() => {
      const existing = [...this.store.castingSteps.values()].find(
        (step) =>
          step.castingSessionId === input.castingSessionId &&
          step.stepKind === input.stepKind &&
          step.lineIndex === input.lineIndex &&
          step.changeIndex === (input.changeIndex ?? null),
      );
      if (existing) return snapshot(existing);
      const session = this.store.castingSessions.get(input.castingSessionId);
      if (!session) throw repositoryError("CASTING_NOT_FOUND");
      const created = input.create();
      const now = new Date();
      if (session.firstIrreversibleStepAt == null) {
        session.firstIrreversibleStepAt = now;
        session.castingExpiresAt = new Date(now.getTime() + 24 * HOUR_MS);
        if (session.lifecycle === "draft") session.lifecycle = "casting";
      }
      const step: CastingStep = {
        id: memoryId("step"),
        castingSessionId: input.castingSessionId,
        stepKind: input.stepKind,
        lineIndex: input.lineIndex,
        changeIndex: input.changeIndex ?? null,
        rawRecord: cloneForStorage(created.rawRecord),
        lineValue: created.lineValue,
        algorithmVersion: session.algorithmVersion,
        createdAt: now,
      };
      this.store.castingSteps.set(step.id, step);
      session.updatedAt = now;
      return snapshot(step);
    });
  }

  getSteps(castingSessionId: string): CastingStep[] {
    const steps = [...this.store.castingSteps.values()]
      .filter((step) => step.castingSessionId === castingSessionId)
      .sort((a, b) => a.lineIndex - b.lineIndex || (a.changeIndex ?? 0) - (b.changeIndex ?? 0));
    return snapshot(steps);
  }

  async recordCoinStep(input: RecordCoinStepInput): Promise<RecordCoinStepOutcome> {
    return this.store.withLock(() => {
      const session = this.store.castingSessions.get(input.castingSessionId);
      if (!session) throw repositoryError("CASTING_NOT_FOUND");
      const existing = [...this.store.castingSteps.values()].find(
        (step) => step.castingSessionId === input.castingSessionId
          && step.stepKind === "coin"
          && step.lineIndex === input.lineIndex,
      );
      const now = new Date();
      const created = existing ? undefined : input.create();
      const step: CastingStep = existing ?? {
        id: memoryId("step"),
        castingSessionId: input.castingSessionId,
        stepKind: "coin",
        lineIndex: input.lineIndex,
        changeIndex: null,
        rawRecord: cloneForStorage(created!.rawRecord),
        lineValue: created!.lineValue,
        algorithmVersion: session.algorithmVersion,
        createdAt: now,
      };
      const coinSteps = [...this.store.castingSteps.values()]
        .filter((candidate) => candidate.castingSessionId === input.castingSessionId && candidate.stepKind === "coin");
      if (!existing) coinSteps.push(step);
      let result = this.store.castResults.get(input.castingSessionId);
      if (!result && coinSteps.length === 6) {
        const lineValues = [0, 1, 2, 3, 4, 5].map(
          (lineIndex) => coinSteps.find((candidate) => candidate.lineIndex === lineIndex)!.lineValue!,
        );
        result = this.buildCastResult(session, lineValues, {
          kind: "three-coin",
          steps: coinSteps.map((candidate) => candidate.rawRecord),
        }, now);
      }

      if (!existing) {
        this.store.castingSteps.set(step.id, step);
        if (session.firstIrreversibleStepAt == null) {
          session.firstIrreversibleStepAt = now;
          session.castingExpiresAt = new Date(now.getTime() + 24 * HOUR_MS);
          if (session.lifecycle === "draft") session.lifecycle = "casting";
        }
      }
      if (result && !this.store.castResults.has(input.castingSessionId)) {
        this.store.castResults.set(input.castingSessionId, result);
        session.completedAt = now;
        session.revealExpiresAt = new Date(now.getTime() + 24 * HOUR_MS);
        if (session.lifecycle === "casting") session.lifecycle = "awaiting_reveal";
      }
      session.updatedAt = now;
      return { step: snapshot(step), completed: result != null };
    });
  }

  saveCastResult(input: {
    castingSessionId: string;
    lineValues: LineValue[];
    methodCalculation: unknown;
  }): CastResult {
    return this.store.withLock(() => {
      const session = this.store.castingSessions.get(input.castingSessionId);
      if (!session) throw repositoryError("CASTING_NOT_FOUND");
      const existing = this.store.castResults.get(input.castingSessionId);
      if (existing) return snapshot(existing);
      const now = new Date();
      const castResult = this.buildCastResult(session, input.lineValues, input.methodCalculation, now);
      this.store.castResults.set(input.castingSessionId, castResult);
      session.completedAt = now;
      session.revealExpiresAt = new Date(now.getTime() + 24 * HOUR_MS);
      if (session.lifecycle === "casting") session.lifecycle = "awaiting_reveal";
      session.updatedAt = now;
      return snapshot(castResult);
    });
  }

  getCastResult(castingSessionId: string): CastResult | undefined {
    const result = this.store.castResults.get(castingSessionId);
    return result ? snapshot(result) : undefined;
  }

  recordRiskCheck(input: {
    castingSessionId: string;
    ruleVersion: string;
    matchedRuleCodes: string[];
    reasonCode: string;
    status: RiskStatus;
  }): void {
    const session = this.store.castingSessions.get(input.castingSessionId);
    if (!session) throw repositoryError("CASTING_NOT_FOUND");
    session.riskStatus = input.status;
    session.updatedAt = new Date();
    this.store.castingRiskDecisions.set(input.castingSessionId, {
      castingSessionId: input.castingSessionId,
      ruleVersion: input.ruleVersion,
      matchedRuleCodes: [...input.matchedRuleCodes],
      reasonCode: input.reasonCode,
      status: input.status,
      createdAt: new Date(),
    });
  }

  getRiskDecision(castingSessionId: string) {
    const decision = this.store.castingRiskDecisions.get(castingSessionId);
    return decision ? snapshot(decision) : undefined;
  }

  acquireQuestionLock(input: {
    userId: string;
    fingerprint: string;
    keyVersion: string;
    winningCastingId: string;
    now: Date;
  }): { won: boolean; winningCastingId: string } {
    return this.store.withLock(() => {
      const key = `${input.userId}|${input.fingerprint}`;
      const existing = this.store.questionLocks.get(key);
      if (existing && existing.lockedUntil.getTime() > input.now.getTime()) {
        return { won: false, winningCastingId: existing.winningCastingId };
      }
      if (existing) {
        existing.winningCastingId = input.winningCastingId;
        existing.lockedUntil = new Date(input.now.getTime() + 72 * HOUR_MS);
        existing.updatedAt = new Date(input.now);
        return { won: true, winningCastingId: input.winningCastingId };
      }
      this.store.questionLocks.set(key, this.newQuestionLock(input));
      return { won: true, winningCastingId: input.winningCastingId };
    });
  }

  revealWithQuestionLock(input: {
    castingId: string;
    userId: string;
    fingerprint: string;
    keyVersion: string;
    now: Date;
  }): { revealed: boolean; duplicate: boolean; winningCastingId?: string } {
    return this.store.withLock(() => {
      const session = this.store.castingSessions.get(input.castingId);
      if (!session) throw repositoryError("CASTING_NOT_FOUND");
      if (session.lifecycle === "revealed" && session.userId === input.userId) return { revealed: true, duplicate: false };
      if (session.lifecycle !== "awaiting_reveal") throw repositoryError("CASTING_NOT_REVEALABLE");
      const key = `${input.userId}|${input.fingerprint}`;
      const existing = this.store.questionLocks.get(key);
      if (existing && existing.lockedUntil.getTime() > input.now.getTime()) {
        session.lifecycle = "discarded_duplicate";
        session.duplicateOfCastingId = existing.winningCastingId;
        session.updatedAt = new Date(input.now);
        return { revealed: false, duplicate: true, winningCastingId: existing.winningCastingId };
      }
      this.store.questionLocks.set(key, this.newQuestionLock({ ...input, winningCastingId: input.castingId }));
      session.userId = input.userId;
      session.anonymousSessionHash = null;
      session.questionFingerprint = input.fingerprint;
      session.fingerprintKeyVersion = input.keyVersion;
      session.revealedAt = new Date(input.now);
      session.lifecycle = "revealed";
      session.updatedAt = new Date(input.now);
      return { revealed: true, duplicate: false };
    });
  }

  evaluateSessionClocks(session: CastingSession, now: Date) {
    return evaluateClocks({
      firstIrreversibleStepAt: session.firstIrreversibleStepAt,
      castingExpiresAt: session.castingExpiresAt,
      completedAt: session.completedAt,
      revealExpiresAt: session.revealExpiresAt,
      now,
    });
  }

  private newQuestionLock(input: {
    userId: string;
    fingerprint: string;
    keyVersion: string;
    winningCastingId: string;
    now: Date;
  }): QuestionLock {
    return {
      userId: input.userId,
      questionFingerprint: input.fingerprint,
      fingerprintKeyVersion: input.keyVersion,
      winningCastingId: input.winningCastingId,
      lockedUntil: new Date(input.now.getTime() + 72 * HOUR_MS),
      createdAt: new Date(input.now),
      updatedAt: new Date(input.now),
    };
  }

  private buildCastResult(
    session: CastingSession,
    lineValues: LineValue[],
    methodCalculation: unknown,
    now: Date,
  ): CastResult {
    const result = buildHexagramResult({
      lineValuesBottomUp: lineValues,
      method: session.method,
      algorithmVersion: session.algorithmVersion,
    });
    const hmacInput = JSON.stringify({
      l: result.lineValuesBottomUp,
      p: result.primaryHexagramNumber,
      m: result.movingLinePositions,
      r: result.relatingHexagramNumber,
      a: result.algorithmVersion,
      c: result.classicMappingVersion,
    });
    return {
      castingSessionId: session.id,
      lineValues: [...lineValues],
      primaryHexagramNumber: result.primaryHexagramNumber,
      movingLinePositions: [...result.movingLinePositions],
      relatingHexagramNumber: result.relatingHexagramNumber,
      methodCalculation: cloneForStorage(methodCalculation),
      resultHmac: hmac(hmacInput, "result", KEY_VERSION),
      algorithmVersion: result.algorithmVersion,
      classicMappingVersion: result.classicMappingVersion,
      createdAt: now,
    };
  }
}
