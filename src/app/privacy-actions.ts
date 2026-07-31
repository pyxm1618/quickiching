"use server";

import * as z from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/session";
import { hmac } from "@/lib/crypto";
import { mapKnownDomainError } from "@/server/actions/action-result";
import { runtimeConfig } from "@/server/config";
import { privacyRepository, castingRepository } from "@/server/repository";
import { PrivacyService } from "@/server/services/privacy-service";

const castingIdSchema = z.object({
  castingId: z.string().trim().min(3).max(160),
}).strict();

const accountDeletionSchema = z.object({
  email: z.string().trim().email().max(320),
  confirmation: z.literal("DELETE MY ACCOUNT"),
}).strict();

const developmentPrivacy = new PrivacyService({
  privacyRepository,
  castingRepository,
  clock: { now: () => new Date() },
});

async function boundary<T>(
  action: string,
  operation: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await operation();
  } catch (error) {
    return mapKnownDomainError(error, { action });
  }
}

async function rateLimit(userId: string, action: string, limit: number, windowMs: number) {
  const runtime = await import("@/server/runtime/production").then((module) => module.getProductionRuntime());
  const outcome = await runtime.rateLimiter.consume({
    key: hmac(`privacy:${action}:${userId}`, "anon"),
    limit,
    cost: 1,
    windowMs,
    now: new Date(),
  });
  if (!outcome.allowed) {
    return fail("RATE_LIMITED", "Too many privacy requests. Please try again later.", true);
  }
  return null;
}

export async function requestCastingDeletionAction(
  unknownInput: unknown,
): Promise<ActionResult<{ deleted: true; purgeAfter: Date }>> {
  return boundary("requestCastingDeletionAction", async () => {
    const input = castingIdSchema.parse(unknownInput);
    const user = await getCurrentUser();
    if (!user) return fail("AUTH_REQUIRED", "Please sign in.", false);

    if (runtimeConfig().mode === "production") {
      const limited = await rateLimit(user.id, "delete-casting", 10, 60 * 60_000);
      if (limited) return limited;
      const runtime = await import("@/server/runtime/production").then((module) => module.getProductionRuntime());
      return ok(await runtime.privacy.requestCastingDeletion({
        castingId: input.castingId,
        userId: user.id,
      }));
    }

    const deleted = developmentPrivacy.requestDeletion(input.castingId, user.id);
    if (!deleted.purgeAfter) {
      return fail("CASTING_DELETE_STATE_INVALID", "The deletion deadline was not created.", true);
    }
    return ok({ deleted: true as const, purgeAfter: deleted.purgeAfter });
  });
}

export async function restoreCastingAction(
  unknownInput: unknown,
): Promise<ActionResult<{ restored: true }>> {
  return boundary("restoreCastingAction", async () => {
    const input = castingIdSchema.parse(unknownInput);
    const user = await getCurrentUser();
    if (!user) return fail("AUTH_REQUIRED", "Please sign in.", false);

    if (runtimeConfig().mode === "production") {
      const limited = await rateLimit(user.id, "restore-casting", 10, 60 * 60_000);
      if (limited) return limited;
      const runtime = await import("@/server/runtime/production").then((module) => module.getProductionRuntime());
      return ok(await runtime.privacy.restoreCasting({
        castingId: input.castingId,
        userId: user.id,
      }));
    }

    developmentPrivacy.restore(input.castingId, user.id);
    return ok({ restored: true as const });
  });
}

export async function requestAccountDeletionAction(
  unknownInput: unknown,
): Promise<ActionResult<{
  deleted: true;
  contentPurgeAfter: Date;
  unusedCreditsRevoked: number;
  openReviewsClosed: number;
  retainedOrderCount: number;
}>> {
  return boundary("requestAccountDeletionAction", async () => {
    const input = accountDeletionSchema.parse(unknownInput);
    const user = await getCurrentUser();
    if (!user) return fail("AUTH_REQUIRED", "Please sign in.", false);
    if (user.email.normalize("NFKC").trim().toLowerCase() !== input.email.toLowerCase()) {
      return fail("ACCOUNT_DELETION_EMAIL_MISMATCH", "The confirmation email does not match this account.", false, "email");
    }
    if (runtimeConfig().mode !== "production") {
      return fail(
        "ACCOUNT_DELETION_PRODUCTION_ONLY",
        "Account deletion is available only with the production database adapter.",
        false,
      );
    }

    const limited = await rateLimit(user.id, "delete-account", 3, 24 * 60 * 60_000);
    if (limited) return limited;
    const runtime = await import("@/server/runtime/production").then((module) => module.getProductionRuntime());
    return ok(await runtime.accountPrivacy.requestDeletion({ userId: user.id }));
  });
}
