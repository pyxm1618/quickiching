import { createHash } from "node:crypto";
import type { AccountDeletionRequest, CastingSession } from "../models";
import type { PrivacyRepository } from "../privacy-repository";
import { snapshot } from "./snapshot";
import { repositoryError, type MemoryStore } from "./store";

const RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export class MemoryPrivacyRepository implements PrivacyRepository {
  constructor(private readonly store: MemoryStore) {}

  listCastsForUser(userId: string): CastingSession[] {
    const sessions = [...this.store.castingSessions.values()]
      .filter((session) => session.userId === userId && !session.deletedAt && session.lifecycle !== "discarded_duplicate")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return snapshot(sessions);
  }

  requestCastingDeletion(castingId: string, requestedAt?: Date): CastingSession {
    return this.store.withLock(() => {
      const session = this.store.castingSessions.get(castingId);
      if (!session) throw repositoryError("CASTING_NOT_FOUND");
      if (session.lifecycle !== "revealed") throw repositoryError("CASTING_NOT_DELETABLE");
      const now = requestedAt ? new Date(requestedAt) : new Date();
      this.markCastingDeleted(session, now);
      return snapshot(session);
    });
  }

  restoreCasting(castingId: string, userId: string, now: Date): CastingSession {
    return this.store.withLock(() => {
      const session = this.store.castingSessions.get(castingId);
      if (
        !session
        || session.userId !== userId
        || session.lifecycle !== "user_deleted"
        || !session.deletedAt
        || !session.purgeAfter
        || session.purgeAfter.getTime() <= now.getTime()
      ) {
        throw new Error("DELETION_RECOVERY_CLOSED");
      }
      session.deletedAt = null;
      session.purgeAfter = null;
      session.lifecycle = "revealed";
      session.updatedAt = new Date(now);
      return snapshot(session);
    });
  }

  listRecoverableDeletedCasts(userId: string, now: Date): CastingSession[] {
    const sessions = [...this.store.castingSessions.values()].filter(
      (session) =>
        session.userId === userId
        && session.deletedAt != null
        && session.purgeAfter != null
        && session.purgeAfter.getTime() > now.getTime(),
    );
    return snapshot(sessions);
  }

  purgeDeletedCasts(now: Date): number {
    return this.store.withLock(() => {
      let purged = 0;
      for (const [castingId, session] of this.store.castingSessions.entries()) {
        if (!session.deletedAt || !session.purgeAfter || session.purgeAfter.getTime() > now.getTime()) continue;
        this.purgeCasting(castingId);
        purged += 1;
      }
      return purged;
    });
  }

  requestAccountDeletion(userId: string, now: Date): AccountDeletionRequest {
    return this.store.withLock(() => {
      const user = this.store.users.get(userId);
      if (!user || user.anonymizedAt) throw new Error("ACCOUNT_NOT_FOUND");
      const existing = this.store.accountDeletions.get(userId);
      if (existing && !existing.restoredAt && !existing.purgedAt) return snapshot(existing);

      const requestedAt = new Date(now);
      const purgeAfter = new Date(requestedAt.getTime() + RECOVERY_WINDOW_MS);
      const castingLifecycleSnapshot: AccountDeletionRequest["castingLifecycleSnapshot"] = {};
      for (const session of this.store.castingSessions.values()) {
        if (session.userId !== userId) continue;
        castingLifecycleSnapshot[session.id] = session.lifecycle;
        session.deletedAt = requestedAt;
        session.purgeAfter = purgeAfter;
        session.lifecycle = "user_deleted";
        session.updatedAt = requestedAt;
      }
      for (const [sessionId, session] of this.store.sessions) {
        if (session.userId === userId) this.store.sessions.delete(sessionId);
      }
      user.deletionRequestedAt = requestedAt;
      const request: AccountDeletionRequest = {
        userId,
        requestedAt,
        purgeAfter,
        castingLifecycleSnapshot,
        restoredAt: null,
        purgedAt: null,
      };
      this.store.accountDeletions.set(userId, request);
      return snapshot(request);
    });
  }

  getAccountDeletion(userId: string): AccountDeletionRequest | undefined {
    const request = this.store.accountDeletions.get(userId);
    return request ? snapshot(request) : undefined;
  }

  restoreAccount(userId: string, now: Date): AccountDeletionRequest {
    return this.store.withLock(() => {
      const request = this.store.accountDeletions.get(userId);
      const user = this.store.users.get(userId);
      if (
        !request
        || !user
        || request.restoredAt
        || request.purgedAt
        || request.purgeAfter.getTime() <= now.getTime()
      ) {
        throw new Error("ACCOUNT_DELETION_RECOVERY_CLOSED");
      }
      for (const [castingId, lifecycle] of Object.entries(request.castingLifecycleSnapshot)) {
        const session = this.store.castingSessions.get(castingId);
        if (!session || session.userId !== userId) continue;
        session.lifecycle = lifecycle;
        session.deletedAt = null;
        session.purgeAfter = null;
        session.updatedAt = new Date(now);
      }
      request.restoredAt = new Date(now);
      user.deletionRequestedAt = null;
      return snapshot(request);
    });
  }

  purgeDeletedAccounts(now: Date): number {
    return this.store.withLock(() => {
      let purged = 0;
      for (const request of this.store.accountDeletions.values()) {
        if (request.restoredAt || request.purgedAt || request.purgeAfter.getTime() > now.getTime()) continue;
        const user = this.store.users.get(request.userId);
        if (!user) continue;
        const castingIds = [...this.store.castingSessions.values()]
          .filter((session) => session.userId === request.userId)
          .map((session) => session.id);
        for (const castingId of castingIds) this.purgeCasting(castingId);
        for (const [sessionId, session] of this.store.sessions) {
          if (session.userId === request.userId) this.store.sessions.delete(sessionId);
        }
        const subjectHash = createHash("sha256").update(request.userId).digest("hex").slice(0, 24);
        user.email = `deleted-${subjectHash}@deleted.invalid`;
        user.deletionRequestedAt = null;
        user.anonymizedAt = new Date(now);
        request.purgedAt = new Date(now);
        purged += 1;
      }
      return purged;
    });
  }

  private markCastingDeleted(session: CastingSession, now: Date): void {
    session.deletedAt = new Date(now);
    session.purgeAfter = new Date(now.getTime() + RECOVERY_WINDOW_MS);
    session.lifecycle = "user_deleted";
    session.updatedAt = new Date(now);
  }

  private purgeCasting(castingId: string): void {
    const readingIds = new Set(
      [...this.store.readings.values()]
        .filter((reading) => reading.castingSessionId === castingId)
        .map((reading) => reading.id),
    );
    for (const [id, intent] of this.store.loginIntents) {
      if (intent.castingSessionId === castingId) this.store.loginIntents.delete(id);
    }
    for (const [id, review] of this.store.qualityReviews) {
      if (readingIds.has(review.readingId)) this.store.qualityReviews.delete(id);
    }
    for (const [id, reservation] of this.store.reservations) {
      if (readingIds.has(reservation.readingId)) this.store.reservations.delete(id);
    }
    for (const [id, reading] of this.store.readings) {
      if (reading.castingSessionId === castingId) this.store.readings.delete(id);
    }
    for (const [id, version] of this.store.questionVersions) {
      if (version.castingSessionId === castingId) this.store.questionVersions.delete(id);
    }
    for (const [id, step] of this.store.castingSteps) {
      if (step.castingSessionId === castingId) this.store.castingSteps.delete(id);
    }
    for (const [id, preview] of this.store.previews) {
      if (preview.castingSessionId === castingId) this.store.previews.delete(id);
    }
    for (const [key, lock] of this.store.questionLocks) {
      if (lock.winningCastingId === castingId) this.store.questionLocks.delete(key);
    }
    this.store.castResults.delete(castingId);
    this.store.castingRiskDecisions.delete(castingId);
    this.store.castingSessions.delete(castingId);
  }
}
