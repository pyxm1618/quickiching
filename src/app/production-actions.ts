"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import type { ActionResult } from "@/lib/action-result";
import { fail, ok } from "@/lib/action-result";
import { hmac } from "@/lib/crypto";
import { getAnonymousHash, getCurrentUser } from "@/lib/auth/session";
import { getProductionAuth } from "@/lib/auth/production-auth";
import { PRODUCTS } from "@/domain/entitlements/pricing";
import { mapKnownDomainError } from "@/server/actions/action-result";
import { runtimeConfig } from "@/server/config";
import { dispatchGenerationOutbox } from "@/server/jobs/generation-dispatcher";
import { CheckoutService } from "@/server/payments/checkout-service";
import { CreemClient } from "@/server/payments/creem-client";
import { getProductionRuntime } from "@/server/runtime/production";
import {
  guardSensitiveRequest,
  type RateLimitDimension,
} from "@/server/security/sensitive-request-guard";
import { actionSchemas, parseActionInput } from "@/server/validation/action-schemas";

const TEN_MINUTES_MS = 10 * 60_000;
const ONE_HOUR_MS = 60 * 60_000;

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

async function boundary<T>(action: string, operation: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await operation();
  } catch (error) {
    return mapKnownDomainError(error, { action });
  }
}

async function owner() {
  const [user, anonymousSessionHash] = await Promise.all([
    getCurrentUser(),
    getAnonymousHash(),
  ]);
  return { user, anonymousSessionHash };
}

async function guard(input: {
  action: string;
  turnstileToken: string | undefined;
  dimensions: RateLimitDimension[];
  requestHeaders?: Headers;
}): Promise<Headers> {
  const runtime = await getProductionRuntime();
  const requestHeaders = input.requestHeaders ?? new Headers(await headers());
  await guardSensitiveRequest({
    action: input.action,
    turnstileToken: input.turnstileToken,
    requestHeaders,
    rateLimiter: runtime.rateLimiter,
    turnstile: runtime.turnstile,
    dimensions: input.dimensions,
    now: new Date(),
  });
  return requestHeaders;
}

async function limit(subject: string, maximum: number, windowMs = 60_000): Promise<ActionResult<never> | null> {
  const runtime = await getProductionRuntime();
  const result = await runtime.rateLimiter.consume({
    key: hmac(subject, "anon"),
    limit: maximum,
    cost: 1,
    windowMs,
    now: new Date(),
  });
  if (result.allowed) return null;
  return fail("RATE_LIMITED", "Too many requests. Please try again later.", true);
}

async function createCastingSessionAction(unknownInput: unknown) {
  return boundary("createCastingSessionAction", async () => {
    const input = parseActionInput(actionSchemas.createCastingSession, unknownInput);
    const { user, anonymousSessionHash } = await owner();
    if (!user && !anonymousSessionHash) return fail("CASTING_OWNER_REQUIRED", "Casting owner is required.", false);
    const ownerKind = user ? "user" as const : "anonymous" as const;
    const ownerValue = user?.id ?? anonymousSessionHash!;
    await guard({
      action: "create_casting",
      turnstileToken: input.turnstileToken,
      dimensions: [{ kind: ownerKind, value: ownerValue, limit: 5, windowMs: TEN_MINUTES_MS }],
    });
    const runtime = await getProductionRuntime();
    return ok(await runtime.application.createDraft({
      method: input.method,
      scene: input.scene,
      interpretationGoal: input.interpretationGoal,
      userId: user?.id ?? null,
      anonymousSessionHash: user ? null : anonymousSessionHash,
    }));
  });
}

async function getCastingSnapshotAction(unknownInput: unknown) {
  return boundary("getCastingSnapshotAction", async () => {
    const input = parseActionInput(actionSchemas.castingId, unknownInput);
    const { user, anonymousSessionHash } = await owner();
    const runtime = await getProductionRuntime();
    return ok(await runtime.application.loadCastingSnapshot({
      castingId: input.castingId,
      userId: user?.id ?? null,
      anonymousSessionHash,
      now: new Date(),
    }));
  });
}

async function getCastingSummaryAction(unknownInput: unknown) {
  return boundary("getCastingSummaryAction", async () => {
    const snapshotResult = await getCastingSnapshotAction(unknownInput);
    if (!snapshotResult.ok) return snapshotResult;
    const snapshot = snapshotResult.value;
    if (!snapshot) return ok(null);
    return ok({
      lifecycle: snapshot.lifecycle,
      riskStatus: snapshot.riskStatus,
      hasResult: snapshot.result != null,
      primaryName: snapshot.result?.primaryName ?? null,
      primaryNumber: snapshot.result?.primaryNumber ?? null,
      movingLinePositions: snapshot.result?.movingLinePositions ?? [],
      relatingName: snapshot.result?.relatingName ?? null,
      relatingNumber: snapshot.result?.relatingNumber ?? null,
      lineValues: snapshot.result?.lineValues ?? [],
      algorithmVersion: snapshot.result?.algorithmVersion ?? "",
      classicMappingVersion: snapshot.result?.classicMappingVersion ?? "",
      hasPreview: snapshot.preview?.status === "completed",
      previewText: snapshot.preview?.relevanceStatement ?? null,
      hasReading: snapshot.reading?.status === "completed",
    });
  });
}

async function signInAction() {
  return fail("AUTH_PROVIDER_REQUIRED", "Use Google or a one-time email link to sign in.", false);
}

async function submitQuestionAction(unknownInput: unknown) {
  return boundary("submitQuestionAction", async () => {
    const input = parseActionInput(actionSchemas.submitQuestion, unknownInput);
    const { user, anonymousSessionHash } = await owner();
    const runtime = await getProductionRuntime();
    return ok(await runtime.application.submitQuestion({
      castingId: input.castingId,
      userId: user?.id ?? null,
      anonymousSessionHash,
      context: input.context,
    }));
  });
}

async function clarifyQuestionAction(unknownInput: unknown) {
  return boundary("clarifyQuestionAction", async () => {
    const input = parseActionInput(actionSchemas.clarifyQuestion, unknownInput);
    const { user, anonymousSessionHash } = await owner();
    const runtime = await getProductionRuntime();
    return ok(await runtime.application.clarifyQuestion({
      castingId: input.castingId,
      userId: user?.id ?? null,
      anonymousSessionHash,
      context: input.context,
    }));
  });
}

async function generateThreeCoinLineAction(unknownInput: unknown) {
  return boundary("generateThreeCoinLineAction", async () => {
    const input = parseActionInput(actionSchemas.generateThreeCoinLine, unknownInput);
    const { user, anonymousSessionHash } = await owner();
    const blocked = await limit(`cast:step:${user?.id ?? anonymousSessionHash ?? "missing"}`, 30);
    if (blocked) return blocked;
    const runtime = await getProductionRuntime();
    return ok(await runtime.application.recordCoinLine({
      castingId: input.castingId,
      userId: user?.id ?? null,
      anonymousSessionHash,
      lineIndex: input.lineIndex as 0 | 1 | 2 | 3 | 4 | 5,
    }));
  });
}

async function generateYarrowChangeAction(unknownInput: unknown) {
  return boundary("generateYarrowChangeAction", async () => {
    const input = parseActionInput(actionSchemas.generateYarrowChange, unknownInput);
    const { user, anonymousSessionHash } = await owner();
    const blocked = await limit(`cast:step:${user?.id ?? anonymousSessionHash ?? "missing"}`, 40);
    if (blocked) return blocked;
    const runtime = await getProductionRuntime();
    return ok(await runtime.application.recordYarrowChange({
      castingId: input.castingId,
      userId: user?.id ?? null,
      anonymousSessionHash,
      lineIndex: input.lineIndex as 0 | 1 | 2 | 3 | 4 | 5,
      changeIndex: input.changeIndex as 0 | 1 | 2,
    }));
  });
}

async function completeYarrowAction(unknownInput: unknown) {
  return boundary("completeYarrowAction", async () => {
    const input = parseActionInput(actionSchemas.castingId, unknownInput);
    const { user, anonymousSessionHash } = await owner();
    const runtime = await getProductionRuntime();
    return ok(await runtime.application.completeYarrow({
      castingId: input.castingId,
      userId: user?.id ?? null,
      anonymousSessionHash,
    }));
  });
}

async function createMeiHuaResultAction(unknownInput: unknown) {
  return boundary("createMeiHuaResultAction", async () => {
    const input = parseActionInput(actionSchemas.createMeiHuaResult, unknownInput);
    const { user, anonymousSessionHash } = await owner();
    const runtime = await getProductionRuntime();
    return ok(await runtime.application.recordMeiHua({
      castingId: input.castingId,
      userId: user?.id ?? null,
      anonymousSessionHash,
      ianaTimeZone: input.ianaTimeZone,
    }));
  });
}

async function revealCastingAction(unknownInput: unknown) {
  return boundary("revealCastingAction", async () => {
    const input = parseActionInput(actionSchemas.revealCasting, unknownInput);
    const { user, anonymousSessionHash } = await owner();
    if (!anonymousSessionHash) return fail("CASTING_NOT_FOUND", "Casting session not found.", false);
    const requestHeaders = await guard({
      action: "reveal_casting",
      turnstileToken: input.turnstileToken,
      dimensions: [
        { kind: "anonymous", value: anonymousSessionHash, limit: 5, windowMs: TEN_MINUTES_MS },
        { kind: "email", value: input.email, limit: 3, windowMs: TEN_MINUTES_MS },
        ...(user ? [{ kind: "user" as const, value: user.id, limit: 5, windowMs: TEN_MINUTES_MS }] : []),
      ],
    });
    const runtime = await getProductionRuntime();
    const callbackPath = `/result/${input.castingId}`;

    if (user) {
      const intent = await runtime.application.startLoginIntent({
        castingId: input.castingId,
        anonymousSessionHash,
        allowedCallbackPath: callbackPath,
      });
      return ok(await runtime.application.consumeLoginIntentAndReveal({
        intentId: intent.intentId,
        nonce: intent.nonce,
        authenticatedUserId: user.id,
        callbackPath,
      }));
    }

    const handoff = await runtime.revealHandoff.start({
      castingId: input.castingId,
      anonymousSessionHash,
      expectedEmail: input.email,
      allowedCallbackPath: callbackPath,
    });
    const auth = await getProductionAuth();
    await auth.api.signInMagicLink({
      body: {
        email: input.email,
        callbackURL: `/reveal/complete?state=${encodeURIComponent(handoff.handoffState)}`,
        errorCallbackURL: "/signin?error=reveal_intent",
      },
      headers: requestHeaders,
    });
    return ok({
      revealed: false,
      duplicate: false,
      castingId: input.castingId,
      authPending: true as const,
    });
  });
}

async function startPreviewAction(unknownInput: unknown) {
  return boundary("startPreviewAction", async () => {
    const input = parseActionInput(actionSchemas.protectedCastingId, unknownInput);
    const user = await getCurrentUser();
    if (!user) return fail("AUTH_REQUIRED", "Please sign in.", false);
    await guard({
      action: "generate_preview",
      turnstileToken: input.turnstileToken,
      dimensions: [{ kind: "user", value: user.id, limit: 10, windowMs: ONE_HOUR_MS }],
    });
    const runtime = await getProductionRuntime();
    const queued = await runtime.generation.enqueuePreview({
      castingId: input.castingId,
      userId: user.id,
      now: new Date(),
    });
    await dispatchGenerationOutbox(10);
    return ok({ status: queued.status, relevanceStatement: null, jobId: queued.jobId });
  });
}

async function startDeepReadingAction(unknownInput: unknown) {
  return boundary("startDeepReadingAction", async () => {
    const input = parseActionInput(actionSchemas.protectedCastingId, unknownInput);
    const user = await getCurrentUser();
    if (!user) return fail("AUTH_REQUIRED", "Please sign in.", false);
    await guard({
      action: "generate_reading",
      turnstileToken: input.turnstileToken,
      dimensions: [{ kind: "user", value: user.id, limit: 5, windowMs: ONE_HOUR_MS }],
    });
    const runtime = await getProductionRuntime();
    const queued = await runtime.generation.enqueueDeepReading({
      castingId: input.castingId,
      userId: user.id,
      now: new Date(),
    });
    await dispatchGenerationOutbox(10);
    return ok({ status: queued.status, readingId: queued.readingId!, report: null, jobId: queued.jobId });
  });
}

async function createCheckoutAction(unknownInput: unknown) {
  return boundary("createCheckoutAction", async () => {
    const input = parseActionInput(actionSchemas.createCheckout, unknownInput);
    const user = await getCurrentUser();
    if (!user) return fail("AUTH_REQUIRED", "Please sign in to purchase.", false);
    await guard({
      action: "create_checkout",
      turnstileToken: input.turnstileToken,
      dimensions: [{ kind: "user", value: user.id, limit: 5, windowMs: TEN_MINUTES_MS }],
    });
    const config = runtimeConfig();
    if (config.mode !== "production") throw new Error("PRODUCTION_CONFIG_REQUIRED");
    const runtime = await getProductionRuntime();
    const service = new CheckoutService({
      orderRepository: {
        createOrder: async (order) => {
          const orderId = id("ord");
          const rows = await runtime.sql`
            insert into orders (
              id, user_id, product_id, amount_usd, currency, request_id, status
            ) values (
              ${orderId}, ${order.userId}, ${order.productId}, ${order.amountUsd},
              ${order.currency}, ${order.requestId}, 'pending'
            ) returning id, request_id, amount_usd
          `;
          return {
            id: rows[0].id,
            requestId: rows[0].request_id,
            amountUsd: Number(rows[0].amount_usd),
          };
        },
      },
      creemClient: new CreemClient({
        apiKey: config.credentials.creemApiKey,
        mode: config.credentials.creemApiKey.startsWith("creem_test_") ? "test" : "production",
      }),
      providerProductIds: {
        one: config.credentials.creemProductIdOne,
        three: config.credentials.creemProductIdThree,
        five: config.credentials.creemProductIdFive,
      },
      appUrl: config.baseUrl,
      requestId: () => id("req"),
    });
    const checkout = await service.create({ user, productId: input.productId });
    return ok({
      orderId: checkout.orderId,
      checkoutUrl: checkout.checkoutUrl,
      amountUsd: checkout.amountUsd,
    });
  });
}

async function simulatePaymentAction() {
  return fail("PAYMENT_SIMULATION_DISABLED", "Payment simulation is disabled.", false);
}

async function submitQualityReviewAction(unknownInput: unknown) {
  return boundary("submitQualityReviewAction", async () => {
    const input = parseActionInput(actionSchemas.submitQualityReview, unknownInput);
    const user = await getCurrentUser();
    if (!user) return fail("AUTH_REQUIRED", "Please sign in.", false);
    const blocked = await limit(`quality-review:${user.id}`, 5, ONE_HOUR_MS);
    if (blocked) return blocked;
    const runtime = await getProductionRuntime();
    return ok(await runtime.qualityReview.submit({
      readingId: input.readingId,
      userId: user.id,
      reason: input.reason,
    }));
  });
}

async function requestCastingDeletionAction(unknownInput: unknown) {
  return boundary("requestCastingDeletionAction", async () => {
    const input = parseActionInput(actionSchemas.castingId, unknownInput);
    const user = await getCurrentUser();
    if (!user) return fail("AUTH_REQUIRED", "Please sign in.", false);
    const blocked = await limit(`privacy:delete-casting:${user.id}`, 10, ONE_HOUR_MS);
    if (blocked) return blocked;
    const runtime = await getProductionRuntime();
    return ok(await runtime.privacy.requestCastingDeletion({
      castingId: input.castingId,
      userId: user.id,
    }));
  });
}

async function restoreCastingAction(unknownInput: unknown) {
  return boundary("restoreCastingAction", async () => {
    const input = parseActionInput(actionSchemas.castingId, unknownInput);
    const user = await getCurrentUser();
    if (!user) return fail("AUTH_REQUIRED", "Please sign in.", false);
    const blocked = await limit(`privacy:restore-casting:${user.id}`, 10, ONE_HOUR_MS);
    if (blocked) return blocked;
    const runtime = await getProductionRuntime();
    return ok(await runtime.privacy.restoreCasting({
      castingId: input.castingId,
      userId: user.id,
    }));
  });
}

export const productionActions = {
  createCastingSessionAction,
  getCastingSummaryAction,
  getCastingSnapshotAction,
  signInAction,
  submitQuestionAction,
  clarifyQuestionAction,
  generateThreeCoinLineAction,
  generateYarrowChangeAction,
  completeYarrowAction,
  createMeiHuaResultAction,
  revealCastingAction,
  startPreviewAction,
  createCheckoutAction,
  simulatePaymentAction,
  startDeepReadingAction,
  submitQualityReviewAction,
  requestCastingDeletionAction,
  restoreCastingAction,
};
