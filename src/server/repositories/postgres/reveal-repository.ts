import { and, eq, gt, or, sql } from "drizzle-orm";
import type { PostgresDatabase } from "@/server/db/client";
import {
  castingSessions,
  loginIntents,
  questionLocks,
} from "@/server/db/schema";
import { DomainError } from "@/server/errors/domain-error";
import type {
  AsyncLoginIntentRepository,
  AsyncRevealRepository,
} from "./ports";
import { mapIntent, postgresId } from "./helpers";

const HOUR_MS = 60 * 60 * 1000;

export class PostgresLoginIntentRepository implements AsyncLoginIntentRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async create(input: Parameters<AsyncLoginIntentRepository["create"]>[0]) {
    const [created] = await this.database.insert(loginIntents).values({
      id: postgresId("lint"),
      castingId: input.castingId,
      anonymousSessionHash: input.anonymousSessionHash,
      nonceHash: input.nonceHash,
      nonceKeyVersion: input.nonceKeyVersion,
      allowedCallbackPath: input.allowedCallbackPath,
      expiresAt: input.expiresAt,
      createdAt: input.now,
    }).returning();
    return mapIntent(created);
  }

  async get(intentId: string) {
    const [row] = await this.database.select().from(loginIntents)
      .where(eq(loginIntents.id, intentId))
      .limit(1);
    return row ? mapIntent(row) : undefined;
  }
}

export class PostgresRevealRepository implements AsyncRevealRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async consumeIntentAndReveal(input: Parameters<AsyncRevealRepository["consumeIntentAndReveal"]>[0]) {
    return this.database.transaction(async (tx) => {
      const lockKeys = input.fingerprintCandidates
        .map((candidate) => `${input.authenticatedUserId}|${candidate.keyVersion}|${candidate.fingerprint}`)
        .sort();
      for (const lockKey of lockKeys) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
      }

      const [intent] = await tx.select().from(loginIntents)
        .where(eq(loginIntents.id, input.intentId))
        .for("update")
        .limit(1);
      if (!intent) throw new DomainError("LOGIN_INTENT_NOT_FOUND", "This sign-in link is invalid.", false);
      if (intent.consumedAt) throw new DomainError("LOGIN_INTENT_CONSUMED", "This sign-in link has already been used.", false);
      if (intent.expiresAt.getTime() <= input.now.getTime()) {
        throw new DomainError("LOGIN_INTENT_EXPIRED", "This sign-in link has expired.", false);
      }
      if (intent.nonceHash !== input.nonceHash || intent.nonceKeyVersion !== input.nonceKeyVersion) {
        throw new DomainError("LOGIN_INTENT_INVALID", "This sign-in link is invalid.", false);
      }
      if (intent.allowedCallbackPath !== input.callbackPath) {
        throw new DomainError("LOGIN_INTENT_CALLBACK_INVALID", "The sign-in return path is not allowed.", false);
      }

      const [casting] = await tx.select().from(castingSessions)
        .where(eq(castingSessions.id, intent.castingId))
        .for("update")
        .limit(1);
      if (!casting || casting.anonymousSessionHash !== intent.anonymousSessionHash) {
        throw new DomainError("CASTING_NOT_FOUND", "Casting session not found.", false);
      }
      if (casting.lifecycle !== "awaiting_reveal") {
        throw new DomainError("CASTING_NOT_REVEALABLE", "This casting is not ready to reveal.", false);
      }
      if (casting.revealExpiresAt && casting.revealExpiresAt.getTime() <= input.now.getTime()) {
        await tx.update(castingSessions).set({ lifecycle: "expired", updatedAt: input.now })
          .where(eq(castingSessions.id, casting.id));
        throw new DomainError("CASTING_EXPIRED", "This casting is no longer available.", false);
      }

      const candidateConditions = input.fingerprintCandidates.map((candidate) => and(
        eq(questionLocks.userId, input.authenticatedUserId),
        eq(questionLocks.questionFingerprint, candidate.fingerprint),
        eq(questionLocks.fingerprintKeyVersion, candidate.keyVersion),
        gt(questionLocks.lockedUntil, input.now),
      ));
      const existing = candidateConditions.length === 0
        ? []
        : await tx.select().from(questionLocks)
          .where(or(...candidateConditions))
          .for("update")
          .limit(1);

      await tx.update(loginIntents).set({ consumedAt: input.now })
        .where(eq(loginIntents.id, intent.id));

      if (existing[0] && existing[0].winningCastingId !== casting.id) {
        await tx.update(castingSessions).set({
          lifecycle: "discarded_duplicate",
          duplicateOfCastingId: existing[0].winningCastingId,
          updatedAt: input.now,
        }).where(eq(castingSessions.id, casting.id));
        return {
          revealed: false,
          duplicate: true,
          castingId: existing[0].winningCastingId,
        };
      }

      await tx.insert(questionLocks).values({
        userId: input.authenticatedUserId,
        questionFingerprint: input.writeFingerprint.fingerprint,
        fingerprintKeyVersion: input.writeFingerprint.keyVersion,
        winningCastingId: casting.id,
        lockedUntil: new Date(input.now.getTime() + 72 * HOUR_MS),
        createdAt: input.now,
        updatedAt: input.now,
      }).onConflictDoUpdate({
        target: [
          questionLocks.userId,
          questionLocks.questionFingerprint,
          questionLocks.fingerprintKeyVersion,
        ],
        set: {
          winningCastingId: casting.id,
          lockedUntil: new Date(input.now.getTime() + 72 * HOUR_MS),
          updatedAt: input.now,
        },
      });
      await tx.update(castingSessions).set({
        userId: input.authenticatedUserId,
        anonymousSessionHash: null,
        questionFingerprint: input.writeFingerprint.fingerprint,
        fingerprintKeyVersion: input.writeFingerprint.keyVersion,
        revealedAt: input.now,
        lifecycle: "revealed",
        updatedAt: input.now,
      }).where(eq(castingSessions.id, casting.id));
      return { revealed: true, duplicate: false, castingId: casting.id };
    });
  }
}
