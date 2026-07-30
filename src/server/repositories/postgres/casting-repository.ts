import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { transition } from "@/domain/casting/lifecycle";
import type { LineValue } from "@/domain/casting/types";
import { decryptJson, encryptJson, hmac } from "@/lib/crypto";
import type { PostgresDatabase } from "@/server/db/client";
import {
  castResults,
  castingSessions,
  castingSteps,
  questionVersions,
  riskChecks,
} from "@/server/db/schema";
import { DomainError } from "@/server/errors/domain-error";
import type { AsyncCastingRepository } from "./ports";
import {
  databaseErrorCode,
  mapCasting,
  mapResult,
  mapStep,
  postgresId,
} from "./helpers";

const HOUR_MS = 60 * 60 * 1000;

export class PostgresCastingRepository implements AsyncCastingRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async createCasting(input: Parameters<AsyncCastingRepository["createCasting"]>[0]) {
    try {
      const [row] = await this.database.insert(castingSessions).values({
        id: postgresId("cas"),
        userId: input.userId,
        anonymousSessionHash: input.anonymousSessionHash,
        anonymousHashKeyVersion: input.anonymousHashKeyVersion,
        method: input.method,
        scene: input.scene,
        interpretationGoal: input.interpretationGoal,
        algorithmVersion: input.algorithmVersion,
        createdAt: input.now,
        updatedAt: input.now,
      }).returning();
      return mapCasting(row);
    } catch (error) {
      if (databaseErrorCode(error) === "23505") {
        throw new DomainError("CASTING_ALREADY_IN_PROGRESS", "A casting is already in progress.", false);
      }
      throw error;
    }
  }

  async getCasting(castingId: string) {
    const [row] = await this.database.select().from(castingSessions)
      .where(and(eq(castingSessions.id, castingId), isNull(castingSessions.deletedAt)))
      .limit(1);
    return row ? mapCasting(row) : undefined;
  }

  async transitionCasting(castingId: string, lifecycle: Parameters<AsyncCastingRepository["transitionCasting"]>[1], now: Date) {
    return this.database.transaction(async (tx) => {
      const [current] = await tx.select().from(castingSessions)
        .where(eq(castingSessions.id, castingId))
        .for("update")
        .limit(1);
      if (!current) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found.", false);
      transition(current.lifecycle, lifecycle);
      const [updated] = await tx.update(castingSessions)
        .set({ lifecycle, updatedAt: now })
        .where(eq(castingSessions.id, castingId))
        .returning();
      return mapCasting(updated);
    });
  }

  async addQuestionVersion(input: Parameters<AsyncCastingRepository["addQuestionVersion"]>[0]) {
    await this.database.transaction(async (tx) => {
      const questionId = postgresId("qv");
      const encrypted = encryptJson(
        { context: input.context },
        "context",
        undefined,
        `${input.castingId}:${questionId}`,
      );
      await tx.insert(questionVersions).values({
        id: questionId,
        castingId: input.castingId,
        versionNumber: input.versionNumber,
        ciphertext: encrypted.data,
        iv: encrypted.iv,
        authTag: encrypted.tag,
        encryptionKeyVersion: encrypted.v,
        createdReason: input.reason,
        createdAt: input.now,
      });
      const updated = await tx.update(castingSessions)
        .set({ currentQuestionVersionId: questionId, updatedAt: input.now })
        .where(eq(castingSessions.id, input.castingId))
        .returning({ id: castingSessions.id });
      if (updated.length !== 1) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found.", false);
    });
  }

  async getLatestQuestionContext(castingId: string) {
    const [row] = await this.database.select().from(questionVersions)
      .where(eq(questionVersions.castingId, castingId))
      .orderBy(desc(questionVersions.versionNumber))
      .limit(1);
    if (!row) return "";
    return decryptJson<{ context: string }>({
      v: row.encryptionKeyVersion,
      iv: row.iv,
      tag: row.authTag,
      data: row.ciphertext,
    }, "context", `${castingId}:${row.id}`).context;
  }

  async recordRisk(input: Parameters<AsyncCastingRepository["recordRisk"]>[0]) {
    return this.database.transaction(async (tx) => {
      const [session] = await tx.select().from(castingSessions)
        .where(eq(castingSessions.id, input.castingId))
        .for("update")
        .limit(1);
      if (!session?.currentQuestionVersionId) {
        throw new DomainError("QUESTION_REQUIRED", "A persisted question is required.", false);
      }
      const [created] = await tx.insert(riskChecks).values({
        id: postgresId("risk"),
        castingId: input.castingId,
        questionVersionId: session.currentQuestionVersionId,
        ruleVersion: input.ruleVersion,
        matchedRuleCodes: input.matchedRuleCodes,
        reasonCode: input.reasonCode,
        status: input.status,
        createdAt: input.now,
      }).returning();
      await tx.update(castingSessions)
        .set({ riskStatus: input.status, updatedAt: input.now })
        .where(eq(castingSessions.id, input.castingId));
      return {
        castingSessionId: created.castingId,
        ruleVersion: created.ruleVersion,
        matchedRuleCodes: created.matchedRuleCodes,
        reasonCode: created.reasonCode,
        status: created.status,
        createdAt: created.createdAt,
      };
    });
  }

  async recordStep(input: Parameters<AsyncCastingRepository["recordStep"]>[0]) {
    return this.database.transaction(async (tx) => {
      const [session] = await tx.select().from(castingSessions)
        .where(eq(castingSessions.id, input.castingId))
        .for("update")
        .limit(1);
      if (!session) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found.", false);
      const inserted = await tx.insert(castingSteps).values({
        id: postgresId("step"),
        castingId: input.castingId,
        stepKind: input.stepKind,
        lineIndex: input.lineIndex,
        changeIndex: input.changeIndex,
        rawRecord: input.rawRecord,
        lineValue: input.lineValue,
        algorithmVersion: session.algorithmVersion,
        createdAt: input.now,
      }).onConflictDoNothing().returning();
      const row = inserted[0] ?? (await tx.select().from(castingSteps).where(and(
        eq(castingSteps.castingId, input.castingId),
        eq(castingSteps.stepKind, input.stepKind),
        eq(castingSteps.lineIndex, input.lineIndex),
        input.changeIndex === null
          ? isNull(castingSteps.changeIndex)
          : eq(castingSteps.changeIndex, input.changeIndex),
      )).limit(1))[0];
      if (!row) throw new Error("CASTING_STEP_IDEMPOTENCY_FAILED");
      if (!session.firstIrreversibleStepAt) {
        await tx.update(castingSessions).set({
          lifecycle: "casting",
          firstIrreversibleStepAt: input.now,
          castingExpiresAt: new Date(input.now.getTime() + 24 * HOUR_MS),
          updatedAt: input.now,
        }).where(eq(castingSessions.id, input.castingId));
      }
      return mapStep(row);
    });
  }

  async getSteps(castingId: string) {
    const rows = await this.database.select().from(castingSteps)
      .where(eq(castingSteps.castingId, castingId))
      .orderBy(asc(castingSteps.lineIndex), asc(castingSteps.changeIndex));
    return rows.map(mapStep);
  }

  async saveResult(input: Parameters<AsyncCastingRepository["saveResult"]>[0]) {
    return this.database.transaction(async (tx) => {
      const [existing] = await tx.select().from(castResults)
        .where(eq(castResults.castingId, input.castingId))
        .limit(1);
      if (existing) return mapResult(existing);
      const [session] = await tx.select().from(castingSessions)
        .where(eq(castingSessions.id, input.castingId))
        .for("update")
        .limit(1);
      if (!session) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found.", false);
      if (input.lineValues.length !== 6) throw new DomainError("CASTING_INCOMPLETE", "Six lines are required.", false);
      const result = buildHexagramResult({
        lineValuesBottomUp: input.lineValues as [LineValue, LineValue, LineValue, LineValue, LineValue, LineValue],
        method: session.method as CastingSessionMethod,
        algorithmVersion: session.algorithmVersion,
      });
      const resultHmac = hmac(JSON.stringify({
        l: result.lineValuesBottomUp,
        p: result.primaryHexagramNumber,
        m: result.movingLinePositions,
        r: result.relatingHexagramNumber,
        a: result.algorithmVersion,
        c: result.classicMappingVersion,
      }), "result");
      const [created] = await tx.insert(castResults).values({
        castingId: input.castingId,
        lineValues: [...input.lineValues],
        primaryHexagramNumber: result.primaryHexagramNumber,
        movingLinePositions: [...result.movingLinePositions],
        relatingHexagramNumber: result.relatingHexagramNumber,
        methodCalculation: input.methodCalculation,
        resultHmac,
        algorithmVersion: result.algorithmVersion,
        classicMappingVersion: result.classicMappingVersion,
        createdAt: input.now,
      }).returning();
      await tx.update(castingSessions).set({
        lifecycle: "awaiting_reveal",
        completedAt: input.now,
        revealExpiresAt: new Date(input.now.getTime() + 24 * HOUR_MS),
        updatedAt: input.now,
      }).where(eq(castingSessions.id, input.castingId));
      return mapResult(created);
    });
  }

  async getResult(castingId: string) {
    const [row] = await this.database.select().from(castResults)
      .where(eq(castResults.castingId, castingId))
      .limit(1);
    return row ? mapResult(row) : undefined;
  }
}

type CastingSessionMethod = Parameters<typeof buildHexagramResult>[0]["method"];
