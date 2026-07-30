import type { CastingSession } from "../models";
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
      session.deletedAt = now;
      session.purgeAfter = new Date(now.getTime() + RECOVERY_WINDOW_MS);
      session.lifecycle = "user_deleted";
      session.updatedAt = now;
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
        session.userId === userId &&
        session.deletedAt != null &&
        session.purgeAfter != null &&
        session.purgeAfter.getTime() > now.getTime(),
    );
    return snapshot(sessions);
  }

  purgeDeletedCasts(now: Date): number {
    return this.store.withLock(() => {
      let purged = 0;
      for (const [castingId, session] of this.store.castingSessions.entries()) {
        if (!session.deletedAt || !session.purgeAfter || session.purgeAfter.getTime() > now.getTime()) continue;
        this.purgeCasting(castingId);
        purged++;
      }
      return purged;
    });
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
