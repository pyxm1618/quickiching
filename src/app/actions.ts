"use server";

import * as z from "zod";
import { type CastingMethod } from "@/domain/casting/types";
import { evaluateRisk } from "@/domain/risk/engine";
import { cryptoRandomBit } from "@/domain/casting/three-coin/algorithm";
import { cryptoRandomInt } from "@/domain/casting/yarrow/algorithm";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import {
  repo,
  castingRepository,
  loginIntentRepository,
  revealRepository,
  readingRepository,
  entitlementRepository,
  reviewRepository,
  privacyRepository,
} from "@/server/repository";
import { getAnonymousHash, getOrCreateAnonymousHash, getCurrentUser, devSignIn } from "@/lib/auth/session";
import { runPreview, runReading } from "@/server/ai";
import { getProduct, PRODUCTS, CURRENCY } from "@/domain/entitlements/pricing";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { randomToken } from "@/lib/crypto";
import { mapKnownDomainError } from "@/server/actions/action-result";
import { DomainError } from "@/server/errors/domain-error";
import { CastingService } from "@/server/services/casting-service";
import { RevealService } from "@/server/services/reveal-service";
import { RiskService } from "@/server/services/risk-service";
import { CastingSnapshotService, type CastingSnapshot } from "@/server/services/casting-snapshot-service";
import { QualityReviewService } from "@/server/services/quality-review-service";
import { PrivacyService } from "@/server/services/privacy-service";
import { PostgresCastingApplicationService } from "@/server/services/postgres-casting-service";
import { PostgresAccountApplicationService } from "@/server/services/postgres-account-service";
import { createPostgresPersistence } from "@/server/repositories/postgres";
import { dispatchGenerationOutbox } from "@/server/jobs/dispatch-generation";
import { runtimeConfig, type RuntimeConfig } from "@/server/config";
import { actionSchemas, parseActionInput } from "@/server/validation/action-schemas";

const castingService = new CastingService({
  castingRepository: repo,
  clock: { now: () => new Date() },
  randomSource: { randomBit: cryptoRandomBit, randomInt: cryptoRandomInt },
  riskService: { evaluate: evaluateRisk },
});
const riskService = new RiskService({ castingRepository, evaluator: { evaluate: evaluateRisk } });
const castingSnapshotService = new CastingSnapshotService({ castingRepository, readingRepository });
const qualityReviewService = new QualityReviewService({
  reviewRepository,
  readingRepository,
  entitlementRepository,
  clock: { now: () => new Date() },
});
const privacyService = new PrivacyService({
  privacyRepository,
  castingRepository,
  clock: { now: () => new Date() },
});

type ProductionConfig = Extract<RuntimeConfig, { mode: "production" }>;

async function withProductionServices<T>(
  config: ProductionConfig,
  handler: (services: {
    casting: PostgresCastingApplicationService;
    account: PostgresAccountApplicationService;
  }) => Promise<T>,
): Promise<T> {
  const persistence = createPostgresPersistence(config.credentials.databaseUrl);
  try {
    return await handler({
      casting: new PostgresCastingApplicationService({
        sql: persistence.sql,
        atomicRepository: persistence.atomicRepository,
        config,
      }),
      account: new PostgresAccountApplicationService(persistence.sql),
    });
  } finally {
    await persistence.close();
  }
}

function getRevealService(): RevealService {
  const config = runtimeConfig();
  return new RevealService({
    castingRepository,
    loginIntentRepository,
    revealRepository,
    clock: { now: () => new Date() },
    tokenSource: { randomToken: () => randomToken(32) },
    sessionSigningKeys: config.keys.sessionSigning,
    questionFingerprintKeys: config.keys.questionFingerprint,
  });
}

function withActionErrorBoundary<T>(
  action: string,
  handler: (unknownInput: unknown) => Promise<ActionResult<T>>,
): (unknownInput: unknown) => Promise<ActionResult<T>> {
  return async (unknownInput) => {
    try {
      return await handler(unknownInput);
    } catch (error) {
      return mapKnownDomainError(error, { action });
    }
  };
}

function parseBoundaryInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  unknownInput: unknown,
  action: string,
): z.infer<TSchema> | ActionResult<never> {
  try {
    return parseActionInput(schema, unknownInput);
  } catch (error) {
    return mapKnownDomainError(error, { action });
  }
}

function isActionFailure(value: unknown): value is ActionResult<never> {
  return typeof value === "object" && value !== null && "ok" in value;
}

async function owner() {
  const [user, anonymousSessionHash] = await Promise.all([getCurrentUser(), getAnonymousHash()]);
  return { user, anonymousSessionHash };
}

function summaryFromSnapshot(snapshot: CastingSnapshot | null) {
  if (!snapshot) return null;
  return {
    lifecycle: snapshot.lifecycle,
    riskStatus: snapshot.riskStatus,
    hasResult: snapshot.canReadResult && snapshot.result != null,
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
  };
}

async function createCastingSessionActionImpl(unknownInput: unknown): Promise<ActionResult<{ castingId: string; method: CastingMethod; lifecycle: string }>> {
  const parsed = parseBoundaryInput(actionSchemas.createCastingSession, unknownInput, "createCastingSessionAction");
  if (isActionFailure(parsed)) return parsed;
  const anonymousSessionHash = await getOrCreateAnonymousHash();
  const user = await getCurrentUser();
  const config = runtimeConfig();
  if (config.mode === "production") {
    return ok(await withProductionServices(config, ({ casting }) => casting.createDraft({
      method: parsed.method,
      scene: parsed.scene,
      interpretationGoal: parsed.interpretationGoal,
      userId: user?.id ?? null,
      anonymousSessionHash: user ? null : anonymousSessionHash,
      now: new Date(),
    })));
  }
  return ok(castingService.createDraft({
    method: parsed.method,
    scene: parsed.scene,
    interpretationGoal: parsed.interpretationGoal,
    userId: user?.id ?? null,
    anonHash: user ? null : anonymousSessionHash,
  }));
}

async function getCastingSnapshotActionImpl(unknownInput: unknown): Promise<ActionResult<CastingSnapshot | null>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "getCastingSnapshotAction");
  if (isActionFailure(parsed)) return parsed;
  const { user, anonymousSessionHash } = await owner();
  const config = runtimeConfig();
  if (config.mode === "production") {
    return ok(await withProductionServices(config, ({ casting }) => casting.snapshot({
      castingId: parsed.castingId,
      userId: user?.id ?? null,
      anonymousSessionHash,
      now: new Date(),
    })));
  }
  return ok(castingSnapshotService.load({
    castingId: parsed.castingId,
    userId: user?.id ?? null,
    anonymousSessionHash,
    now: new Date(),
  }));
}

async function getCastingSummaryActionImpl(unknownInput: unknown): Promise<ActionResult<ReturnType<typeof summaryFromSnapshot>>> {
  const snapshotResult = await getCastingSnapshotActionImpl(unknownInput);
  if (!snapshotResult.ok) return snapshotResult;
  return ok(summaryFromSnapshot(snapshotResult.value));
}

async function signInActionImpl(unknownInput: unknown): Promise<ActionResult<{ email: string }>> {
  const parsed = parseBoundaryInput(actionSchemas.signIn, unknownInput, "signInAction");
  if (isActionFailure(parsed)) return parsed;
  if (runtimeConfig().mode === "production") {
    throw new DomainError("AUTH_PROVIDER_REQUIRED", "Use Google or a secure email sign-in link.", false);
  }
  await devSignIn(parsed.email);
  return ok({ email: parsed.email });
}

async function submitQuestionActionImpl(unknownInput: unknown): Promise<ActionResult<{ riskStatus: string; reasonCode: string; emergency: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.submitQuestion, unknownInput, "submitQuestionAction");
  if (isActionFailure(parsed)) return parsed;
  const { user, anonymousSessionHash } = await owner();
  const config = runtimeConfig();
  if (config.mode === "production") {
    return ok(await withProductionServices(config, ({ casting }) => casting.submitQuestion({
      castingId: parsed.castingId,
      context: parsed.context,
      userId: user?.id ?? null,
      anonymousSessionHash,
      now: new Date(),
    })));
  }
  if (!repo.ownsCasting(parsed.castingId, user?.id ?? null, anonymousSessionHash)) {
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  }
  return ok(castingService.submitQuestion(parsed.castingId, parsed.context));
}

async function clarifyQuestionActionImpl(unknownInput: unknown): Promise<ActionResult<{ riskStatus: string; reasonCode: string; emergency: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.clarifyQuestion, unknownInput, "clarifyQuestionAction");
  if (isActionFailure(parsed)) return parsed;
  const { user, anonymousSessionHash } = await owner();
  const config = runtimeConfig();
  if (config.mode === "production") {
    return ok(await withProductionServices(config, ({ casting }) => casting.clarifyQuestion({
      castingId: parsed.castingId,
      context: parsed.context,
      userId: user?.id ?? null,
      anonymousSessionHash,
      now: new Date(),
    })));
  }
  if (!repo.ownsCasting(parsed.castingId, user?.id ?? null, anonymousSessionHash)) {
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  }
  const decision = riskService.clarifyQuestion(parsed.castingId, parsed.context);
  return ok({ riskStatus: decision.status, reasonCode: decision.reasonCode, emergency: decision.status === "emergency_blocked" });
}

async function generateThreeCoinLineActionImpl(unknownInput: unknown): Promise<ActionResult<{ lineIndex: number; completed: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.generateThreeCoinLine, unknownInput, "generateThreeCoinLineAction");
  if (isActionFailure(parsed)) return parsed;
  const { user, anonymousSessionHash } = await owner();
  const config = runtimeConfig();
  if (config.mode === "production") {
    return ok(await withProductionServices(config, ({ casting }) => casting.recordCoinLine({
      castingId: parsed.castingId,
      lineIndex: parsed.lineIndex,
      userId: user?.id ?? null,
      anonymousSessionHash,
      now: new Date(),
    })));
  }
  if (!repo.ownsCasting(parsed.castingId, user?.id ?? null, anonymousSessionHash)) return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  return ok(await castingService.recordCoinLine(parsed.castingId, parsed.lineIndex));
}

async function generateYarrowChangeActionImpl(unknownInput: unknown): Promise<ActionResult<{ lineIndex: number; changeIndex: number; completed: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.generateYarrowChange, unknownInput, "generateYarrowChangeAction");
  if (isActionFailure(parsed)) return parsed;
  const { user, anonymousSessionHash } = await owner();
  const config = runtimeConfig();
  if (config.mode === "production") {
    return ok(await withProductionServices(config, ({ casting }) => casting.recordYarrowChange({
      castingId: parsed.castingId,
      lineIndex: parsed.lineIndex,
      changeIndex: parsed.changeIndex,
      userId: user?.id ?? null,
      anonymousSessionHash,
      now: new Date(),
    })));
  }
  if (!repo.ownsCasting(parsed.castingId, user?.id ?? null, anonymousSessionHash)) return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  return ok(castingService.recordYarrowChange(parsed.castingId, parsed.lineIndex, parsed.changeIndex));
}

async function completeYarrowActionImpl(unknownInput: unknown): Promise<ActionResult<{ completed: true }>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "completeYarrowAction");
  if (isActionFailure(parsed)) return parsed;
  const { user, anonymousSessionHash } = await owner();
  const config = runtimeConfig();
  if (config.mode === "production") {
    return ok(await withProductionServices(config, ({ casting }) => casting.completeYarrow({
      castingId: parsed.castingId,
      userId: user?.id ?? null,
      anonymousSessionHash,
      now: new Date(),
    })));
  }
  if (!repo.ownsCasting(parsed.castingId, user?.id ?? null, anonymousSessionHash)) return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  return ok(castingService.completeYarrow(parsed.castingId));
}

async function createMeiHuaResultActionImpl(unknownInput: unknown): Promise<ActionResult<{ completed: true }>> {
  const parsed = parseBoundaryInput(actionSchemas.createMeiHuaResult, unknownInput, "createMeiHuaResultAction");
  if (isActionFailure(parsed)) return parsed;
  const { user, anonymousSessionHash } = await owner();
  const config = runtimeConfig();
  if (config.mode === "production") {
    return ok(await withProductionServices(config, ({ casting }) => casting.recordMeiHua({
      castingId: parsed.castingId,
      ianaTimeZone: parsed.ianaTimeZone,
      userId: user?.id ?? null,
      anonymousSessionHash,
      now: new Date(),
    })));
  }
  if (!repo.ownsCasting(parsed.castingId, user?.id ?? null, anonymousSessionHash)) return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  return ok(castingService.recordMeiHua(parsed.castingId, parsed.ianaTimeZone));
}

async function revealCastingActionImpl(unknownInput: unknown): Promise<ActionResult<{ revealed: boolean; duplicate: boolean; castingId: string }>> {
  const parsed = parseBoundaryInput(actionSchemas.revealCasting, unknownInput, "revealCastingAction");
  if (isActionFailure(parsed)) return parsed;
  if (runtimeConfig().mode === "production") {
    throw new DomainError("AUTH_PROVIDER_REQUIRED", "Use the secure reveal sign-in flow.", false);
  }
  const anonymousSessionHash = await getAnonymousHash();
  if (!anonymousSessionHash || !repo.ownsCasting(parsed.castingId, null, anonymousSessionHash)) {
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  }
  const revealService = getRevealService();
  const callbackPath = `/result/${parsed.castingId}`;
  const intent = revealService.startLoginIntent({
    castingId: parsed.castingId,
    anonymousSessionHash,
    allowedCallbackPath: callbackPath,
  });
  const user = await devSignIn(parsed.email);
  return ok(revealService.consumeLoginIntentAndReveal({
    intentId: intent.intentId,
    nonce: intent.nonce,
    authenticatedUserId: user.id,
    callbackPath,
  }));
}

async function startPreviewActionImpl(unknownInput: unknown): Promise<ActionResult<{ status: string; relevanceStatement: string | null }>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "startPreviewAction");
  if (isActionFailure(parsed)) return parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  const config = runtimeConfig();
  if (config.mode === "production") {
    const result = await withProductionServices(config, ({ casting }) => casting.enqueuePreview({
      castingId: parsed.castingId,
      userId: user.id,
      now: new Date(),
    }));
    try { await dispatchGenerationOutbox(5); } catch { /* cron will retry the durable outbox */ }
    return ok(result);
  }
  const anonymousSessionHash = await getAnonymousHash();
  if (!repo.ownsCasting(parsed.castingId, user.id, anonymousSessionHash)) return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  const session = repo.getCastingSession(parsed.castingId)!;
  if (session.lifecycle !== "revealed") return fail("CASTING_NOT_REVEALED", "Reveal the casting before generating a preview", false);
  const existing = repo.getPreview(parsed.castingId);
  if (existing?.status === "completed") return ok({ status: "completed", relevanceStatement: existing.relevanceStatement });
  const result = repo.getCastResult(parsed.castingId);
  if (!result) return fail("RESULT_MISSING", "Cast result missing", false);
  const { context } = riskService.recheckPersonalizedGeneration(parsed.castingId);
  try {
    const preview = await runPreview({
      result: {
        lineValuesBottomUp: result.lineValues as [6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9],
        primaryHexagramNumber: result.primaryHexagramNumber,
        movingLinePositions: result.movingLinePositions,
        relatingHexagramNumber: result.relatingHexagramNumber,
        method: session.method,
        algorithmVersion: result.algorithmVersion,
        classicMappingVersion: result.classicMappingVersion,
      },
      scene: session.scene,
      interpretationGoal: session.interpretationGoal,
      context,
    });
    const saved = repo.savePreviewSuccess(parsed.castingId, preview.relevanceStatement);
    return ok({ status: saved.status, relevanceStatement: saved.relevanceStatement });
  } catch (error) {
    repo.savePreviewFailed(parsed.castingId);
    throw error;
  }
}

async function createCheckoutActionImpl(unknownInput: unknown): Promise<ActionResult<{ orderId: string; checkoutUrl: string; amountUsd: number }>> {
  const parsed = parseBoundaryInput(actionSchemas.createCheckout, unknownInput, "createCheckoutAction");
  if (isActionFailure(parsed)) return parsed;
  if (runtimeConfig().mode === "production") {
    throw new DomainError("CHECKOUT_ROUTE_REQUIRED", "Use the protected checkout endpoint.", false);
  }
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in to purchase", false);
  const product = getProduct(parsed.productId);
  if (!product) return fail("INVALID_PRODUCT", "Unknown product", false);
  const order = repo.createOrder({
    userId: user.id,
    productId: product.id,
    amountUsd: product.unitPriceUsd,
    currency: CURRENCY,
    requestId: randomToken(16),
  });
  return ok({ orderId: order.id, checkoutUrl: `/checkout/simulate?orderId=${order.id}`, amountUsd: product.unitPriceUsd });
}

async function simulatePaymentActionImpl(unknownInput: unknown): Promise<ActionResult<{ granted: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.simulatePayment, unknownInput, "simulatePaymentAction");
  if (isActionFailure(parsed)) return parsed;
  if (runtimeConfig().mode === "production") throw new DomainError("SIMULATED_PAYMENT_DISABLED", "Simulated payment is disabled.", false);
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  const order = repo.getOrder(parsed.orderId);
  if (!order || order.userId !== user.id) return fail("ORDER_NOT_FOUND", "Order not found", false);
  if (order.status === "paid") return ok({ granted: true });
  const product = PRODUCTS[order.productId as keyof typeof PRODUCTS];
  repo.markOrderPaid(order.id, `dev_${randomToken(8)}`);
  repo.grantEntitlement({ userId: user.id, productId: order.productId, quantity: product.quantity, amountUsd: order.amountUsd });
  return ok({ granted: true });
}

async function startDeepReadingActionImpl(unknownInput: unknown): Promise<ActionResult<{ status: string; readingId: string; report: unknown | null }>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "startDeepReadingAction");
  if (isActionFailure(parsed)) return parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  const config = runtimeConfig();
  if (config.mode === "production") {
    const result = await withProductionServices(config, ({ casting }) => casting.enqueueReading({
      castingId: parsed.castingId,
      userId: user.id,
      now: new Date(),
    }));
    try { await dispatchGenerationOutbox(5); } catch { /* cron will retry the durable outbox */ }
    return ok(result);
  }
  const anonymousSessionHash = await getAnonymousHash();
  if (!repo.ownsCasting(parsed.castingId, user.id, anonymousSessionHash)) return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  const session = repo.getCastingSession(parsed.castingId)!;
  if (session.lifecycle !== "revealed") return fail("CASTING_NOT_REVEALED", "Reveal the casting first", false);
  const reading = repo.getOrCreateReading(parsed.castingId);
  if (reading.status === "completed" && reading.report) return ok({ status: "completed", readingId: reading.id, report: reading.report });
  const { context } = riskService.recheckPersonalizedGeneration(parsed.castingId);
  const freeze = repo.freezeForReading(reading.id, user.id, new Date());
  if ("error" in freeze) {
    if (freeze.error === "ENTITLEMENT_NOT_AVAILABLE") return fail("ENTITLEMENT_NOT_AVAILABLE", "You have no available reading credit", false);
    return fail("READING_ERROR", "Could not start reading", true);
  }
  const result = repo.getCastResult(parsed.castingId)!;
  try {
    const report = await runReading({
      result: {
        lineValuesBottomUp: result.lineValues as [6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9],
        primaryHexagramNumber: result.primaryHexagramNumber,
        movingLinePositions: result.movingLinePositions,
        relatingHexagramNumber: result.relatingHexagramNumber,
        method: session.method,
        algorithmVersion: result.algorithmVersion,
        classicMappingVersion: result.classicMappingVersion,
      },
      scene: session.scene,
      interpretationGoal: session.interpretationGoal,
      context,
    });
    repo.completeReadingConsume(freeze.reservationId, report as unknown as Record<string, unknown>);
    return ok({ status: "completed", readingId: reading.id, report });
  } catch (error) {
    repo.releaseReading(freeze.reservationId, false);
    throw error;
  }
}

async function submitQualityReviewActionImpl(unknownInput: unknown): Promise<ActionResult<{ reviewId: string; status: string; responseDueAt: Date }>> {
  const parsed = parseBoundaryInput(actionSchemas.submitQualityReview, unknownInput, "submitQualityReviewAction");
  if (isActionFailure(parsed)) return parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  const config = runtimeConfig();
  if (config.mode === "production") {
    const review = await withProductionServices(config, ({ account }) => account.submitQualityReview({
      readingId: parsed.readingId,
      userId: user.id,
      reason: parsed.reason,
      now: new Date(),
    }));
    return ok({ reviewId: review.id, status: review.status, responseDueAt: review.responseDueAt });
  }
  const review = qualityReviewService.submit({ readingId: parsed.readingId, userId: user.id, reason: parsed.reason });
  return ok({ reviewId: review.id, status: review.status, responseDueAt: review.responseDueAt });
}

async function requestCastingDeletionActionImpl(unknownInput: unknown): Promise<ActionResult<{ deleted: boolean; purgeAfter: Date }>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "requestCastingDeletionAction");
  if (isActionFailure(parsed)) return parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  const config = runtimeConfig();
  if (config.mode === "production") {
    const deleted = await withProductionServices(config, ({ account }) => account.requestDeletion(parsed.castingId, user.id, new Date()));
    return ok({ deleted: true, purgeAfter: deleted.purgeAfter });
  }
  const deleted = privacyService.requestDeletion(parsed.castingId, user.id);
  return ok({ deleted: true, purgeAfter: deleted.purgeAfter! });
}

async function restoreCastingActionImpl(unknownInput: unknown): Promise<ActionResult<{ restored: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "restoreCastingAction");
  if (isActionFailure(parsed)) return parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  const config = runtimeConfig();
  if (config.mode === "production") {
    await withProductionServices(config, ({ account }) => account.restore(parsed.castingId, user.id, new Date()));
  } else {
    privacyService.restore(parsed.castingId, user.id);
  }
  return ok({ restored: true });
}

export const createCastingSessionAction = withActionErrorBoundary("createCastingSessionAction", createCastingSessionActionImpl);
export const getCastingSummaryAction = withActionErrorBoundary("getCastingSummaryAction", getCastingSummaryActionImpl);
export const getCastingSnapshotAction = withActionErrorBoundary("getCastingSnapshotAction", getCastingSnapshotActionImpl);
export const signInAction = withActionErrorBoundary("signInAction", signInActionImpl);
export const submitQuestionAction = withActionErrorBoundary("submitQuestionAction", submitQuestionActionImpl);
export const clarifyQuestionAction = withActionErrorBoundary("clarifyQuestionAction", clarifyQuestionActionImpl);
export const generateThreeCoinLineAction = withActionErrorBoundary("generateThreeCoinLineAction", generateThreeCoinLineActionImpl);
export const generateYarrowChangeAction = withActionErrorBoundary("generateYarrowChangeAction", generateYarrowChangeActionImpl);
export const completeYarrowAction = withActionErrorBoundary("completeYarrowAction", completeYarrowActionImpl);
export const createMeiHuaResultAction = withActionErrorBoundary("createMeiHuaResultAction", createMeiHuaResultActionImpl);
export const revealCastingAction = withActionErrorBoundary("revealCastingAction", revealCastingActionImpl);
export const startPreviewAction = withActionErrorBoundary("startPreviewAction", startPreviewActionImpl);
export const createCheckoutAction = withActionErrorBoundary("createCheckoutAction", createCheckoutActionImpl);
export const simulatePaymentAction = withActionErrorBoundary("simulatePaymentAction", simulatePaymentActionImpl);
export const startDeepReadingAction = withActionErrorBoundary("startDeepReadingAction", startDeepReadingActionImpl);
export const submitQualityReviewAction = withActionErrorBoundary("submitQualityReviewAction", submitQualityReviewActionImpl);
export const requestCastingDeletionAction = withActionErrorBoundary("requestCastingDeletionAction", requestCastingDeletionActionImpl);
export const restoreCastingAction = withActionErrorBoundary("restoreCastingAction", restoreCastingActionImpl);
