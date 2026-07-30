import type { PostgresDatabase } from "@/server/db/client";
import {
  castingSessions,
  entitlementBatches,
  readings,
  users,
} from "@/server/db/schema";
import { PostgresCastingRepository } from "./casting-repository";
import { PostgresEntitlementRepository } from "./entitlement-repository";
import { PostgresIdentityRepository } from "./identity-repository";
import { PostgresPrivacyRepository } from "./privacy-repository";
import { PostgresReadingRepository } from "./reading-repository";
import {
  PostgresLoginIntentRepository,
  PostgresRevealRepository,
} from "./reveal-repository";
import { PostgresReviewRepository } from "./review-repository";
import { postgresId } from "./helpers";

export function createPostgresRepositories(database: PostgresDatabase) {
  return {
    identity: new PostgresIdentityRepository(database),
    casting: new PostgresCastingRepository(database),
    loginIntents: new PostgresLoginIntentRepository(database),
    reveal: new PostgresRevealRepository(database),
    readings: new PostgresReadingRepository(database),
    entitlements: new PostgresEntitlementRepository(database),
    reviews: new PostgresReviewRepository(database),
    privacy: new PostgresPrivacyRepository(database),
    testSupport: createPostgresTestSupport(database),
  };
}

function createPostgresTestSupport(database: PostgresDatabase) {
  return {
    async createRevealFixture(input: {
      userId: string;
      castingId: string;
      anonymousSessionHash: string;
      now: Date;
    }) {
      await database.insert(users).values({
        id: input.userId,
        email: `${input.userId}@example.test`,
        emailVerified: true,
        createdAt: input.now,
        updatedAt: input.now,
      }).onConflictDoNothing();
      await database.insert(castingSessions).values({
        id: input.castingId,
        userId: null,
        anonymousSessionHash: input.anonymousSessionHash,
        anonymousHashKeyVersion: "v1",
        method: "three_coin",
        lifecycle: "awaiting_reveal",
        riskStatus: "allowed",
        scene: "career",
        interpretationGoal: "what_do_i_need_to_see_clearly",
        algorithmVersion: "three-coin-v1",
        completedAt: input.now,
        revealExpiresAt: new Date(input.now.getTime() + 24 * 60 * 60 * 1000),
        createdAt: input.now,
        updatedAt: input.now,
      });
      return { ...input };
    },

    async createEntitlementFixture(input: { quantity: number; now: Date }) {
      const userId = postgresId("usr");
      const castingId = postgresId("cas");
      const readingId = postgresId("rdg");
      await database.transaction(async (tx) => {
        await tx.insert(users).values({
          id: userId,
          email: `${userId}@example.test`,
          emailVerified: true,
          createdAt: input.now,
          updatedAt: input.now,
        });
        await tx.insert(castingSessions).values({
          id: castingId,
          userId,
          method: "three_coin",
          lifecycle: "revealed",
          riskStatus: "allowed",
          scene: "career",
          interpretationGoal: "what_do_i_need_to_see_clearly",
          algorithmVersion: "three-coin-v1",
          revealedAt: input.now,
          createdAt: input.now,
          updatedAt: input.now,
        });
        await tx.insert(readings).values({
          id: readingId,
          castingId,
          status: "not_started",
          schemaVersion: "reading-v2.1",
          generationEpoch: 0,
          createdAt: input.now,
          updatedAt: input.now,
        });
        await tx.insert(entitlementBatches).values({
          id: postgresId("bat"),
          userId,
          productId: "integration-test",
          quantityTotal: input.quantity,
          quantityAvailable: input.quantity,
          quantityReserved: 0,
          quantityConsumed: 0,
          quantityRevoked: 0,
          expiresAt: new Date(input.now.getTime() + 180 * 24 * 60 * 60 * 1000),
          createdAt: input.now,
          updatedAt: input.now,
        });
      });
      return { userId, castingId, readingId, now: input.now };
    },
  };
}

export type PostgresRepositories = ReturnType<typeof createPostgresRepositories>;
