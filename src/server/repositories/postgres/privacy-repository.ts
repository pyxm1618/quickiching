import { and, asc, eq, isNotNull, lte } from "drizzle-orm";
import type { PostgresDatabase } from "@/server/db/client";
import {
  castingSessions,
  generationJobs,
  qualityReviews,
  questionLocks,
  readings,
  reservations,
} from "@/server/db/schema";
import { DomainError } from "@/server/errors/domain-error";
import type { AsyncPrivacyRepository } from "./ports";
import { mapCasting } from "./helpers";

const RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export class PostgresPrivacyRepository implements AsyncPrivacyRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async listHistory(userId: string) {
    const rows = await this.database.select().from(castingSessions)
      .where(and(eq(castingSessions.userId, userId), eq(castingSessions.lifecycle, "revealed")))
      .orderBy(asc(castingSessions.createdAt));
    return rows.map(mapCasting);
  }

  async requestDeletion(castingId: string, userId: string, now: Date) {
    const [updated] = await this.database.update(castingSessions).set({
      lifecycle: "user_deleted",
      deletedAt: now,
      purgeAfter: new Date(now.getTime() + RECOVERY_WINDOW_MS),
      updatedAt: now,
    }).where(and(
      eq(castingSessions.id, castingId),
      eq(castingSessions.userId, userId),
      eq(castingSessions.lifecycle, "revealed"),
    )).returning();
    if (!updated) throw new DomainError("CASTING_NOT_DELETABLE", "This casting cannot be deleted.", false);
    return mapCasting(updated);
  }

  async restore(castingId: string, userId: string, now: Date) {
    const [current] = await this.database.select().from(castingSessions).where(and(
      eq(castingSessions.id, castingId),
      eq(castingSessions.userId, userId),
      eq(castingSessions.lifecycle, "user_deleted"),
    )).limit(1);
    if (!current?.purgeAfter || current.purgeAfter.getTime() <= now.getTime()) {
      throw new DomainError("DELETION_RECOVERY_CLOSED", "This casting can no longer be restored.", false);
    }
    const [updated] = await this.database.update(castingSessions).set({
      lifecycle: "revealed",
      deletedAt: null,
      purgeAfter: null,
      updatedAt: now,
    }).where(eq(castingSessions.id, castingId)).returning();
    return mapCasting(updated);
  }

  async purgeDue(now: Date) {
    return this.database.transaction(async (tx) => {
      const due = await tx.select({ id: castingSessions.id }).from(castingSessions)
        .where(and(isNotNull(castingSessions.purgeAfter), lte(castingSessions.purgeAfter, now)))
        .for("update");
      for (const casting of due) {
        const readingRows = await tx.select({ id: readings.id }).from(readings)
          .where(eq(readings.castingId, casting.id));
        for (const reading of readingRows) {
          await tx.delete(qualityReviews).where(eq(qualityReviews.readingId, reading.id));
          await tx.delete(reservations).where(eq(reservations.readingId, reading.id));
        }
        await tx.delete(generationJobs).where(eq(generationJobs.castingId, casting.id));
        await tx.delete(questionLocks).where(eq(questionLocks.winningCastingId, casting.id));
        await tx.delete(castingSessions).where(eq(castingSessions.id, casting.id));
      }
      return due.length;
    });
  }
}
