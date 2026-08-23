import { and, eq, exists, gt, isNull } from "drizzle-orm";
import { loginIntents, users } from "@/server/db/auth-schema";
import { getAuthDatabaseConnection, type AuthDatabase } from "@/server/db/client";
import { isAuthCapabilityEnabled } from "./capability";
import { validateAuthCallbackURL } from "./callback";

export const LOGIN_INTENT_TTL_SECONDS = 10 * 60;

export type LoginIntentInput = {
  ownerDigest: string;
  targetResource: string;
  castingId?: string | null;
  callbackURL?: string;
  expiresAt?: Date;
};

export type NormalizedLoginIntentInput = {
  ownerDigest: string;
  targetResource: string;
  castingId: string | null;
  callbackPath: string;
  expiresAt: Date;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeLoginIntentInput(
  input: LoginIntentInput,
  baseURL: string,
  now = new Date(),
): NormalizedLoginIntentInput {
  const ownerDigest = input.ownerDigest.trim();
  const targetResource = input.targetResource.trim();
  if (!ownerDigest || !targetResource) throw new Error("LOGIN_INTENT_INVALID");
  const castingId = input.castingId?.trim() || null;
  if (castingId && !isUuid(castingId)) throw new Error("LOGIN_INTENT_INVALID");

  let callbackPath: string;
  try {
    callbackPath = validateAuthCallbackURL(input.callbackURL, baseURL);
  } catch {
    throw new Error("LOGIN_INTENT_INVALID");
  }

  const expiresAt = input.expiresAt ?? new Date(now.getTime() + LOGIN_INTENT_TTL_SECONDS * 1000);
  if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
    throw new Error("LOGIN_INTENT_INVALID");
  }

  return { ownerDigest, targetResource, castingId, callbackPath, expiresAt };
}

export function createLoginIntentRepository(db: AuthDatabase) {
  return {
    async create(input: LoginIntentInput, baseURL: string, now = new Date()) {
      const normalized = normalizeLoginIntentInput(input, baseURL, now);
      const [created] = await db
        .insert(loginIntents)
        .values({
          anonymousHash: normalized.ownerDigest,
          targetResource: normalized.targetResource,
          castingId: normalized.castingId,
          callbackPath: normalized.callbackPath,
          expiresAt: normalized.expiresAt,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return created;
    },

    async consume(input: {
      intentId: string;
      ownerDigest: string;
      targetResource: string;
      castingId?: string | null;
      userId: string;
      now?: Date;
    }) {
      const now = input.now ?? new Date();
      if (
        !isUuid(input.intentId) ||
        !input.ownerDigest ||
        !input.targetResource ||
        !input.userId ||
        (input.castingId !== undefined && input.castingId !== null && !isUuid(input.castingId))
      ) return null;
      const castingCondition = input.castingId
        ? eq(loginIntents.castingId, input.castingId)
        : isNull(loginIntents.castingId);
      const [consumed] = await db.transaction(async (tx) => tx
        .update(loginIntents)
        .set({ consumedAt: now, consumedUserId: input.userId, updatedAt: now })
        .where(and(
          eq(loginIntents.id, input.intentId),
          eq(loginIntents.anonymousHash, input.ownerDigest),
          eq(loginIntents.targetResource, input.targetResource),
          castingCondition,
          isNull(loginIntents.consumedAt),
          gt(loginIntents.expiresAt, now),
          exists(tx.select({ id: users.id }).from(users).where(eq(users.id, input.userId))),
        ))
        .returning());
      return consumed ?? null;
    },
  };
}

export async function createLoginIntent(
  input: LoginIntentInput,
  baseURL: string,
  db?: AuthDatabase,
) {
  if (!isAuthCapabilityEnabled()) throw new Error("AUTH_DISABLED");
  const database = db ?? getAuthDatabaseConnection().db;
  return createLoginIntentRepository(database).create(input, baseURL);
}

export async function consumeLoginIntent(
  input: Parameters<ReturnType<typeof createLoginIntentRepository>["consume"]>[0],
  db?: AuthDatabase,
) {
  if (!isAuthCapabilityEnabled()) throw new Error("AUTH_DISABLED");
  const database = db ?? getAuthDatabaseConnection().db;
  return createLoginIntentRepository(database).consume(input);
}
