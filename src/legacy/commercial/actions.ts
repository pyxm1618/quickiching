"use server";

import { type CastingMethod } from "@/domain/casting/types";
import { evaluateRisk } from "@/domain/risk/engine";
import { normalizeComposite, fingerprintQuestion } from "@/domain/questions/normalize";
import { cryptoRandomBit } from "@/domain/casting/three-coin/algorithm";
import { cryptoRandomInt } from "@/domain/casting/yarrow/algorithm";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import { repo } from "@/server/repository";
import { getAnonymousHash, getOrCreateAnonymousHash, getCurrentUser, devSignIn } from "@/lib/auth/session";
import { runPreview, runReading } from "@/server/ai";
import { getProduct, PRODUCTS, CURRENCY } from "@/domain/entitlements/pricing";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { randomToken } from "@/lib/crypto";
import { mapKnownDomainError } from "@/server/actions/action-result";
import { DomainError } from "@/server/errors/domain-error";
import { CastingService } from "@/server/services/casting-service";
import { actionSchemas, parseActionInput } from "@/server/validation/action-schemas";
import * as z from "zod";

const FINGERPRINT_KEY_VERSION = "v1";

const castingService = new CastingService({
  castingRepository: repo,
  clock: { now: () => new Date() },
  randomSource: { randomBit: cryptoRandomBit, randomInt: cryptoRandomInt },
  riskService: { evaluate: evaluateRisk },
});

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

// ---- 1. Create casting session ----
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

// ---- Casting summary for client resume (no sensitive question text) ----
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
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash))
    return ok(null);
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

// ---- Standalone dev sign-in (Better Auth is the production target) ----
async function signInActionImpl(unknownInput: unknown): Promise<ActionResult<{ email: string }>> {
  const parsed = parseBoundaryInput(actionSchemas.signIn, unknownInput, "signInAction");
  if (isActionFailure(parsed)) return parsed;
  const { email } = parsed;
  await devSignIn(email);
  return ok({ email });
}

// ---- 2. Submit question + server-side risk precheck (SAFE-002) ----
async function submitQuestionActionImpl(unknownInput: unknown): Promise<
  ActionResult<{ riskStatus: string; reasonCode: string; emergency: boolean }>
> {
  const parsed = parseBoundaryInput(actionSchemas.submitQuestion, unknownInput, "submitQuestionAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash))
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  return ok(castingService.submitQuestion(input.castingId, input.context));
}

// ---- 3. Three-coin: generate one line (idempotent) ----
async function generateThreeCoinLineActionImpl(unknownInput: unknown): Promise<
  ActionResult<{
    lineIndex: number;
    completed: boolean;
  }>
> {
  const parsed = parseBoundaryInput(actionSchemas.generateThreeCoinLine, unknownInput, "generateThreeCoinLineAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash))
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  return ok(await castingService.recordCoinLine(
    input.castingId,
    input.lineIndex as 0 | 1 | 2 | 3 | 4 | 5,
  ));
}

// ---- 4. Yarrow: generate one change (idempotent) ----
async function generateYarrowChangeActionImpl(unknownInput: unknown): Promise<
  ActionResult<{
    lineIndex: number;
    changeIndex: number;
    completed: boolean;
  }>
> {
  const parsed = parseBoundaryInput(actionSchemas.generateYarrowChange, unknownInput, "generateYarrowChangeAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash))
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  return ok(castingService.recordYarrowChange(
    input.castingId,
    input.lineIndex as 0 | 1 | 2 | 3 | 4 | 5,
    input.changeIndex as 0 | 1 | 2,
  ));
}

// ---- 5. Yarrow: finalize all six lines ----
async function completeYarrowActionImpl(unknownInput: unknown): Promise<
  ActionResult<{ completed: true }>
> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "completeYarrowAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash))
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  return ok(castingService.completeYarrow(input.castingId));
}

// ---- 6. Mei Hua: create result from server time + confirmed timezone ----
async function createMeiHuaResultActionImpl(unknownInput: unknown): Promise<
  ActionResult<{ completed: true }>
> {
  const parsed = parseBoundaryInput(actionSchemas.createMeiHuaResult, unknownInput, "createMeiHuaResultAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash))
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  return ok(castingService.recordMeiHua(input.castingId, input.ianaTimeZone));
}

// ---- 7. Reveal: dev sign-in + atomic bind + 72h lock (AUTH-003, CAST-004) ----
async function revealCastingActionImpl(unknownInput: unknown): Promise<ActionResult<{ revealed: boolean; duplicate: boolean; winningCastingId?: string }>> {
  const parsed = parseBoundaryInput(actionSchemas.revealCasting, unknownInput, "revealCastingAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  if (!repo.ownsCasting(input.castingId, null, anonHash))
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  const session = repo.getCastingSession(input.castingId)!;
  if (session.lifecycle !== "awaiting_reveal")
    return fail("CASTING_NOT_REVEALABLE", "This casting is not ready to be revealed", false);

  const user = await devSignIn(input.email);

  const context = repo.getLatestQuestionContext(input.castingId);
  const composite = normalizeComposite(session.scene, session.interpretationGoal, context);
  const fingerprint = fingerprintQuestion(composite, "question", FINGERPRINT_KEY_VERSION);

  try {
    return ok(repo.revealWithQuestionLock({
      castingId: input.castingId,
      userId: user.id,
      fingerprint,
      keyVersion: FINGERPRINT_KEY_VERSION,
      now: new Date(),
    }));
  } catch (error) {
    return mutationFailure(error);
  }
}

// ---- 8. Preview (RESULT-002) ----
async function startPreviewActionImpl(unknownInput: unknown): Promise<ActionResult<{ status: string; relevanceStatement: string | null }>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "startPreviewAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash))
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  const session = repo.getCastingSession(input.castingId)!;
  if (session.lifecycle !== "revealed")
    return fail("CASTING_NOT_REVEALED", "Reveal the casting before generating a preview", false);
  if (session.riskStatus === "professional_decision_blocked" || session.riskStatus === "emergency_blocked")
    return fail("RISK_BLOCKED", "A personalized preview is not available for this question", false);

  const existing = repo.getPreview(input.castingId);
  if (existing && existing.status === "completed") {
    return ok({ status: "completed", relevanceStatement: existing.relevanceStatement });
  }

  const result = repo.getCastResult(input.castingId);
  if (!result) return fail("RESULT_MISSING", "Cast result missing", false);
  const context = repo.getLatestQuestionContext(input.castingId);

  try {
    const preview = await runPreview({
      result: {
        lineValuesBottomUp: result.lineValues as any,
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
    const saved = repo.savePreviewSuccess(input.castingId, preview.relevanceStatement);
    return ok({ status: saved.status, relevanceStatement: saved.relevanceStatement });
  } catch (error) {
    repo.savePreviewFailed(input.castingId);
    throw error;
  }
}

// ---- 9. Checkout (PAY-001) ----
async function createCheckoutActionImpl(unknownInput: unknown): Promise<ActionResult<{ orderId: string; checkoutUrl: string; amountUsd: number }>> {
  const parsed = parseBoundaryInput(actionSchemas.createCheckout, unknownInput, "createCheckoutAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in to purchase", false);
  const product = getProduct(input.productId);
  if (!product) return fail("INVALID_PRODUCT", "Unknown product", false);

  const requestId = randomToken(16);
  const order = repo.createOrder({
    userId: user.id,
    productId: product.id,
    amountUsd: product.unitPriceUsd,
    currency: CURRENCY,
    requestId,
  });
  // Legacy development-only simulation. The CP1 production Waffo capability is closed.
  const checkoutUrl = `/checkout/simulate?orderId=${order.id}`;
  return ok({ orderId: order.id, checkoutUrl, amountUsd: product.unitPriceUsd });
}

// ---- 10. Dev payment simulation (production Waffo webhook is not implemented in CP1) ----
async function simulatePaymentActionImpl(unknownInput: unknown): Promise<ActionResult<{ granted: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.simulatePayment, unknownInput, "simulatePaymentAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  const order = repo.getOrder(input.orderId);
  if (!order || order.userId !== user.id) return fail("ORDER_NOT_FOUND", "Order not found", false);
  if (order.status === "paid") {
    return ok({ granted: true });
  }
  const product = PRODUCTS[order.productId as keyof typeof PRODUCTS];
  repo.markOrderPaid(order.id, `dev_${randomToken(8)}`);
  repo.grantEntitlement({
    userId: user.id,
    productId: order.productId,
    quantity: product.quantity,
    amountUsd: order.amountUsd,
  });
  return ok({ granted: true });
}

// ---- 11. Start deep reading (consumes one entitlement) ----
async function startDeepReadingActionImpl(unknownInput: unknown): Promise<ActionResult<{ status: string; readingId: string; report: unknown | null }>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "startDeepReadingAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  if (!repo.ownsCasting(input.castingId, user.id, anonHash))
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  const session = repo.getCastingSession(input.castingId)!;
  if (session.lifecycle !== "revealed")
    return fail("CASTING_NOT_REVEALED", "Reveal the casting first", false);
  if (session.riskStatus === "professional_decision_blocked" || session.riskStatus === "emergency_blocked")
    return fail("RISK_BLOCKED", "A deep reading is not available for this question", false);

  const reading = repo.getOrCreateReading(input.castingId);
  if (reading.status === "completed" && reading.report) {
    return ok({ status: "completed", readingId: reading.id, report: reading.report });
  }

  const freeze = repo.freezeForReading(reading.id, user.id, new Date());
  if ("error" in freeze) {
    if (freeze.error === "ENTITLEMENT_NOT_AVAILABLE")
      return fail("ENTITLEMENT_NOT_AVAILABLE", "You have no available reading credit", false);
    return fail("READING_ERROR", "Could not start reading", true);
  }

  const result = repo.getCastResult(input.castingId)!;
  const context = repo.getLatestQuestionContext(input.castingId);
  try {
    const report = await runReading({
      result: {
        lineValuesBottomUp: result.lineValues as any,
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

// ---- 12. Quality review (QUALITY-001/002) ----
async function submitQualityReviewActionImpl(unknownInput: unknown): Promise<ActionResult<{ reviewId: string; status: string }>> {
  const parsed = parseBoundaryInput(actionSchemas.submitQualityReview, unknownInput, "submitQualityReviewAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const user = await getCurrentUser();
  if (!user) return fail("AUTH_REQUIRED", "Please sign in", false);
  try {
    const review = repo.createQualityReview({
      readingId: input.readingId,
      userId: user.id,
      reason: input.reason,
    });
    return ok({ reviewId: review.id, status: review.status });
  } catch (error) {
    if (error instanceof DomainError && error.code === "QUALITY_REVIEW_ALREADY_SUBMITTED") {
      return mapKnownDomainError(
        error,
        { action: "submitQualityReviewAction" },
      );
    }
    throw error;
  }
}

// ---- 13. Deletion request (PRIV-002) ----
async function requestCastingDeletionActionImpl(unknownInput: unknown): Promise<ActionResult<{ deleted: boolean }>> {
  const parsed = parseBoundaryInput(actionSchemas.castingId, unknownInput, "requestCastingDeletionAction");
  if (isActionFailure(parsed)) return parsed;
  const input = parsed;
  const anonHash = await getAnonymousHash();
  const user = await getCurrentUser();
  if (!repo.ownsCasting(input.castingId, user?.id ?? null, anonHash))
    return fail("CASTING_NOT_FOUND", "Casting session not found", false);
  repo.requestCastingDeletion(input.castingId);
  return ok({ deleted: true });
}

export const createCastingSessionAction = withActionErrorBoundary("createCastingSessionAction", createCastingSessionActionImpl);
export const getCastingSummaryAction = withActionErrorBoundary("getCastingSummaryAction", getCastingSummaryActionImpl);
export const signInAction = withActionErrorBoundary("signInAction", signInActionImpl);
export const submitQuestionAction = withActionErrorBoundary("submitQuestionAction", submitQuestionActionImpl);
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
