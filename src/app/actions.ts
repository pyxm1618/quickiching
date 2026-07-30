"use server";

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
import { runPreview, runReading, type GenerationInput } from "@/server/ai";
import { buildCastingMethodEvidence } from "@/server/casting-method-evidence";
import type { CastResult, CastingSession } from "@/server/repositories/models";
import { getProduct, PRODUCTS, CURRENCY } from "@/domain/entitlements/pricing";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { randomToken } from "@/lib/crypto";
import { mapKnownDomainError } from "@/server/actions/action-result";
import { DomainError } from "@/server/errors/domain-error";
import { CastingService } from "@/server/services/casting-service";
import { RevealService } from "@/server/services/reveal-service";
import { RiskService } from "@/server/services/risk-service";
import { CastingSnapshotService } from "@/server/services/casting-snapshot-service";
import { QualityReviewService } from "@/server/services/quality-review-service";
import { PrivacyService } from "@/server/services/privacy-service";
import { runtimeConfig } from "@/server/config";
import { actionSchemas, parseActionInput } from "@/server/validation/action-schemas";
import * as z from "zod";

const castingService = new CastingService({
  castingRepository: repo,
  clock: { now: () => new Date() },
  randomSource: { randomBit: cryptoRandomBit, randomInt: cryptoRandomInt },
  riskService: { evaluate: evaluateRisk },
});

const riskService = new RiskService({
  castingRepository,
  evaluator: { evaluate: evaluateRisk },
});

function buildGenerationInput(
  castingId: string,
  session: CastingSession,
  result: CastResult,
  context: string,
): GenerationInput {
  const methodEvidence = buildCastingMethodEvidence({
    session,
    result,
    steps: repo.getSteps(castingId),
  });
  return {
    result: {
      lineValuesBottomUp: [...result.lineValues],
      primaryHexagramNumber: result.primaryHexagramNumber,
      movingLinePositions: [...result.movingLinePositions],
      relatingHexagramNumber: result.relatingHexagramNumber,
      method: session.method,
      algorithmVersion: result.algorithmVersion,
      classicMappingVersion: result.classicMappingVersion,
    },
    methodEvidence,
    scene: session.scene,
    interpretationGoal: session.interpretationGoal,
    context,
  };
}

const castingSnapshotService = new CastingSnapshotService({
  castingRepository,
  readingRepository,
});
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

function mutationFailure<T>(error: unknown): ActionResult<T> {
  if (error instanceof DomainError) return mapKnownDomainError(error, { action: "castingMutation" });
  throw error;
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

async function createCastingSessionActionImpl(unknownInput: unknown): Promise<ActionResult<{ castingId: string; method: CastingMethod; lifecycle: string }>> {
  const parsed = parseBoundaryInput(actionSchemas.createCastingSession, unknownInput, "createCastingSessionAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getOrCreateAnonymousHash();
  const user = await getCurrentUser();
  return ok(castingService.createDraft({
    method: input.method,
    scene: input.scene,
    interpretationGoal: input.interpretationGoal,
    userId: user?.id ?? null,
    anonHash: user ? null : anonHash,
  }));
}

async function getCastingSummaryActionImpl(unknownInput: unknown): Promise<
  ActionResult<{
    lifecycle: string;
    riskStatus: string;
    hasResult: boolean;
    primaryName: string | null;
    primaryNumber: number | null;
    movingLinePositions: number[];
    relatingName: string | null;
    relatingNumber: number | null;
    lineValues: number[];
    algorithmVersion: string;
    classicMappingVersion: string;
    hasPreview: boolean;
    previewText: string | null;
    hasReading: boolean;
  } | null>
> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "getCastingSummaryAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash)) return ok(null);
  const session = repo.getCastingSession(input.castingId)!;
  const canReadResult = repo.canReadRevealedResult(input.castingId, user?.id ?? null);
  const cr = canReadResult ? repo.getCastResult(input.castingId) : undefined;
  const preview = canReadResult ? repo.getPreview(input.castingId) : undefined;
  const reading = canReadResult ? repo.getReadingByCasting(input.castingId) : undefined;
  return ok({
    lifecycle: session.lifecycle,
    riskStatus: session.riskStatus,
    hasResult: canReadResult && !!cr,
    primaryName: cr ? hexagramByNumber(cr.primaryHexagramNumber).englishName : null,
    primaryNumber: cr ? cr.primaryHexagramNumber : null,
    movingLinePositions: cr ? cr.movingLinePositions : [],
    relatingName: cr && cr.relatingHexagramNumber ? hexagramByNumber(cr.relatingHexagramNumber).englishName : null,
    relatingNumber: cr ? cr.relatingHexagramNumber : null,
    lineValues: cr ? cr.lineValues : [],
    algorithmVersion: cr ? cr.algorithmVersion : "",
    classicMappingVersion: cr ? cr.classicMappingVersion : "",
    hasPreview: !!preview && preview.status === "completed",
    previewText: preview?.relevanceStatement ?? null,
    hasReading: !!reading && reading.status === "completed",
  });
}

async function getCastingSnapshotActionImpl(unknownInput: unknown): Promise<ActionResult<ReturnType<CastingSnapshotService["load"]>>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "getCastingSnapshotAction");
  if (isActionFailure(parsed)) return parsed;
  const user = await getCurrentUser();
  const anonHash = await getAnonymousHash();
  return ok(castingSnapshotService.load({
    castingId: parsed.castingId,
    userId: user?.id ?? null,
    anonymousSessionHash: anonHash,
    now: new Date(),
  }));
}

async function signInActionImpl(unknownInput: unknown): Promise<ActionResult<{ email: string }>> {
  const parsed = parseBoundaryInput(actionSchemas.signIn, unknownInput, "signInAction");
  if (isActionFailure(parsed)) return parsed;
  const { email } = parsed;
  await devSignIn(email);
  return ok({ email });
}

async function submitQuestionActionImpl(unknownInput: unknown): Promise<ActionResult<{ riskStatus: string; reasonCode: string; emergency: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.submitQuestion, unknownInput, "submitQuestionAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash)) return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  return ok(castingService.submitQuestion(input.castingId, input.context));
}

async function clarifyQuestionActionImpl(unknownInput: unknown): Promise<ActionResult<{ riskStatus: string; reasonCode: string; emergency: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.clarifyQuestion, unknownInput, "clarifyQuestionAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash)) return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  const decision = riskService.clarifyQuestion(input.castingId, input.context);
  return ok({ riskStatus: decision.status, reasonCode: decision.reasonCode, emergency: decision.status === "emergency_blocked" });
}

async function generateThreeCoinLineActionImpl(unknownInput: unknown): Promise<ActionResult<{ lineIndex: number; completed: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.generateThreeCoinLine, unknownInput, "generateThreeCoinLineAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash)) return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  return ok(await castingService.recordCoinLine(input.castingId, input.lineIndex as 0 | 1 | 2 | 3 | 4 | 5));
}

async function generateYarrowChangeActionImpl(unknownInput: unknown): Promise<ActionResult<{ lineIndex: number; changeIndex: number; completed: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.generateYarrowChange, unknownInput, "generateYarrowChangeAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash)) return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  return ok(castingService.recordYarrowChange(input.castingId, input.lineIndex as 0 | 1 | 2 | 3 | 4 | 5, input.changeIndex as 0 | 1 | 2));
}

async function completeYarrowActionImpl(unknownInput: unknown): Promise<ActionResult<{ completed: true }>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "completeYarrowAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash)) return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  return ok(castingService.completeYarrow(input.castingId));
}

async function createMeiHuaResultActionImpl(unknownInput: unknown): Promise<ActionResult<{ completed: true }>> {
  const parsed = parseBoundaryInput(actionSchemas.createMeiHuaResult, unknownInput, "createMeiHuaResultAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash)) return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  return ok(castingService.recordMeiHua(input.castingId, input.ianaTimeZone));
}

async function revealCastingActionImpl(unknownInput: unknown): Promise<ActionResult<{ revealed: boolean; duplicate: boolean; castingId: string }>> {
  const parsed = parseBoundaryInput(actionSchemas.revealCasting, unknownInput, "revealCastingAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  if (!anonHash || !repo.ownsCasting(input.castingId, null, anonHash)) return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  const config = runtimeConfig();
  if (config.auth !== "dev") throw new DomainError("AUTH_PROVIDER_REQUIRED", "Sign in through the configured authentication provider to reveal this casting.", false);
  const revealService = getRevealService();
  const callbackPath = `/result/${input.castingId}`;
  const intent = revealService.startLoginIntent({ castingId: input.castingId, anonymousSessionHash: anonHash, allowedCallbackPath: callbackPath });
  const user = await devSignIn(input.email);
  return ok(revealService.consumeLoginIntentAndReveal({ intentId: intent.intentId, nonce: intent.nonce, authenticatedUserId: user.id, callbackPath }));
}

async function startPreviewActionImpl(unknownInput: unknown): Promise<ActionResult<{ status: string; relevanceStatement: string | null }>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "startPreviewAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash)) return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  const session = repo.getCastingSession(input.castingId)!;
  if (session.lifecycle !== "revealed") return fail("CASTING_NOT_REVEALED", "Reveal the casting before generating a preview", false);
  const existing = repo.getPreview(input.castingId);
  if (existing?.status === "completed") return ok({ status: "completed", relevanceStatement: existing.relevanceStatement });
  const result = repo.getCastResult(input.castingId);
  if (!result) return fail("RESULT_MISSING", "Cast result missing", false);
  const { context } = riskService.recheckPersonalizedGeneration(input.castingId);
  try {
    const preview = await runPreview(buildGenerationInput(input.castingId, session, result, context));
    const saved = repo.savePreviewSuccess(input.castingId, preview.relevanceStatement);
    return ok({ status: saved.status, relevanceStatement: saved.relevanceStatement });
  } catch (error) {
    repo.savePreviewFailed(input.castingId);
    throw error;
  }
}

async function createCheckoutActionImpl(unknownInput: unknown): Promise<ActionResult<{ orderId: string; checkoutUrl: string; amountUsd: number }>> {
  const parsed = parseBoundaryInput(actionSchemas.createCheckout, unknownInput, "createCheckoutAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in to purchase", false);
  const product = getProduct(input.productId);
  if (!product) return fail("INVALID_PRODUCT", "Unknown product", false);
  const requestId = randomToken(16);
  const order = repo.createOrder({ userId: user.id, productId: product.id, amountUsd: product.unitPriceUsd, currency: CURRENCY, requestId });
  return ok({ orderId: order.id, checkoutUrl: `/checkout/simulate?orderId=${order.id}`, amountUsd: product.unitPriceUsd });
}

async function simulatePaymentActionImpl(unknownInput: unknown): Promise<ActionResult<{ granted: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.simulatePayment, unknownInput, "simulatePaymentAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  const order = repo.getOrder(input.orderId);
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
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  if (!repo.ownsCasting(input.castingId, user.id, anonHash)) return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  const session = repo.getCastingSession(input.castingId)!;
  if (session.lifecycle !== "revealed") return fail("CASTING_NOT_REVEALED", "Reveal the casting first", false);
  const reading = repo.getOrCreateReading(input.castingId);
  if (reading.status === "completed" && reading.report) return ok({ status: "completed", readingId: reading.id, report: reading.report });
  const { context } = riskService.recheckPersonalizedGeneration(input.castingId);
  const freeze = repo.freezeForReading(reading.id, user.id, new Date());
  if ("error" in freeze) {
    if (freeze.error === "ENTITLEMENT_NOT_AVAILABLE") return fail("ENTITLEMENT_NOT_AVAILABLE", "You have no available reading credit", false);
    return fail("READING_ERROR", "Could not start reading", true);
  }
  const result = repo.getCastResult(input.castingId)!;
  try {
    const report = await runReading(buildGenerationInput(input.castingId, session, result, context));
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
  const review = qualityReviewService.submit({ readingId: parsed.readingId, userId: user.id, reason: parsed.reason });
  return ok({ reviewId: review.id, status: review.status, responseDueAt: review.responseDueAt });
}

async function requestCastingDeletionActionImpl(unknownInput: unknown): Promise<ActionResult<{ deleted: boolean; purgeAfter: Date }>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "requestCastingDeletionAction");
  if (isActionFailure(parsed)) return parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  const deleted = privacyService.requestDeletion(parsed.castingId, user.id);
  return ok({ deleted: true, purgeAfter: deleted.purgeAfter! });
}

async function restoreCastingActionImpl(unknownInput: unknown): Promise<ActionResult<{ restored: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "restoreCastingAction");
  if (isActionFailure(parsed)) return parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  privacyService.restore(parsed.castingId, user.id);
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
