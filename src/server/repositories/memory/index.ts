import type { CastingRepository } from "../casting-repository";
import type { EntitlementRepository } from "../entitlement-repository";
import type { IdentityRepository } from "../identity-repository";
import type { LoginIntentRepository } from "../login-intent-repository";
import type { PrivacyRepository } from "../privacy-repository";
import type { ReadingRepository } from "../reading-repository";
import type { RevealRepository } from "../reveal-repository";
import type { ReviewRepository } from "../review-repository";
import { MemoryCastingRepository } from "./casting-repository";
import { MemoryRepositoryCoordinator } from "./coordinator";
import { MemoryEntitlementRepository } from "./entitlement-repository";
import { createMemoryIdentityRepository } from "./identity-repository";
import { MemoryPrivacyRepository } from "./privacy-repository";
import { MemoryReadingRepository } from "./reading-repository";
import { MemoryRevealRepository } from "./reveal-repository";
import { withMemoryCastResultIntegrity } from "./result-integrity-repository";
import { MemoryReviewRepository } from "./review-repository";
import { MemoryStore } from "./store";

export type LegacyRepositoryCoordinator = {
  completeReadingConsume(reservationId: string, report: Record<string, unknown>): void;
  releaseReading(reservationId: string, expired: boolean): void;
};

export type RepositoryFacade = IdentityRepository &
  CastingRepository &
  ReadingRepository &
  EntitlementRepository &
  ReviewRepository &
  PrivacyRepository &
  LegacyRepositoryCoordinator;

export type MemoryRepositories = {
  identityRepository: IdentityRepository;
  castingRepository: CastingRepository;
  loginIntentRepository: LoginIntentRepository;
  revealRepository: RevealRepository;
  readingRepository: ReadingRepository;
  entitlementRepository: EntitlementRepository;
  reviewRepository: ReviewRepository;
  privacyRepository: PrivacyRepository;
  repo: RepositoryFacade;
};

function createFacade(
  identity: IdentityRepository,
  casting: CastingRepository,
  reading: ReadingRepository,
  entitlement: EntitlementRepository,
  review: ReviewRepository,
  privacy: PrivacyRepository,
  coordinator: MemoryRepositoryCoordinator,
): RepositoryFacade {
  return {
    createUser: (email) => identity.createUser(email),
    getUserByEmail: (email) => identity.getUserByEmail(email),
    getUser: (id) => identity.getUser(id),
    createSession: (userId) => identity.createSession(userId),
    getSession: (sessionId) => identity.getSession(sessionId),
    hasActiveCast: (ownerId, isUser) => casting.hasActiveCast(ownerId, isUser),
    findActiveCasting: (ownerId, isUser) => casting.findActiveCasting(ownerId, isUser),
    createCastingSession: (input) => casting.createCastingSession(input),
    getCastingSession: (castingId) => casting.getCastingSession(castingId),
    ownsCasting: (castingId, userId, anonHash) => casting.ownsCasting(castingId, userId, anonHash),
    canReadRevealedResult: (castingId, userId) => casting.canReadRevealedResult(castingId, userId),
    transitionCasting: (castingId, to) => casting.transitionCasting(castingId, to),
    addQuestionVersion: (input) => casting.addQuestionVersion(input),
    getLatestQuestionContext: (castingSessionId) => casting.getLatestQuestionContext(castingSessionId),
    saveStep: (input) => casting.saveStep(input),
    getOrCreateStep: (input) => casting.getOrCreateStep(input),
    recordCoinStep: (input) => casting.recordCoinStep(input),
    getSteps: (castingSessionId) => casting.getSteps(castingSessionId),
    saveCastResult: (input) => casting.saveCastResult(input),
    getCastResult: (castingSessionId) => casting.getCastResult(castingSessionId),
    recordRiskCheck: (input) => casting.recordRiskCheck(input),
    getRiskDecision: (castingSessionId) => casting.getRiskDecision(castingSessionId),
    acquireQuestionLock: (input) => casting.acquireQuestionLock(input),
    revealWithQuestionLock: (input) => casting.revealWithQuestionLock(input),
    evaluateSessionClocks: (session, now) => casting.evaluateSessionClocks(session, now),
    getOrCreatePreview: (castingSessionId) => reading.getOrCreatePreview(castingSessionId),
    savePreviewSuccess: (castingSessionId, statement) => reading.savePreviewSuccess(castingSessionId, statement),
    savePreviewFailed: (castingSessionId) => reading.savePreviewFailed(castingSessionId),
    getPreview: (castingSessionId) => reading.getPreview(castingSessionId),
    getOrCreateReading: (castingSessionId) => reading.getOrCreateReading(castingSessionId),
    getReading: (readingId) => reading.getReading(readingId),
    getReadingByCasting: (castingSessionId) => reading.getReadingByCasting(castingSessionId),
    markReadingReserved: (readingId, reservationId, now) => reading.markReadingReserved(readingId, reservationId, now),
    completeReading: (readingId, reservationId, report, now) => reading.completeReading(readingId, reservationId, report, now),
    failReading: (readingId, reservationId, now) => reading.failReading(readingId, reservationId, now),
    getBatches: (userId) => entitlement.getBatches(userId),
    grantEntitlement: (input) => entitlement.grantEntitlement(input),
    freezeForReading: (readingId, userId, now) => coordinator.freezeForReading(readingId, userId, now),
    consumeReservation: (reservationId, now) => entitlement.consumeReservation(reservationId, now),
    releaseReservation: (reservationId, expired, now) => entitlement.releaseReservation(reservationId, expired, now),
    createOrder: (input) => entitlement.createOrder(input),
    getOrder: (id) => entitlement.getOrder(id),
    markOrderPaid: (orderId, providerCheckoutId) => entitlement.markOrderPaid(orderId, providerCheckoutId),
    createQualityReview: (input) => review.createQualityReview(input),
    decideQualityReview: (reviewId, approved) => review.decideQualityReview(reviewId, approved),
    listCastsForUser: (userId) => privacy.listCastsForUser(userId),
    requestCastingDeletion: (castingId) => privacy.requestCastingDeletion(castingId),
    listRecoverableDeletedCasts: (userId, now) => privacy.listRecoverableDeletedCasts(userId, now),
    purgeDeletedCasts: (now) => privacy.purgeDeletedCasts(now),
    completeReadingConsume: (reservationId, report) => coordinator.completeReadingConsume(reservationId, report),
    releaseReading: (reservationId, expired) => coordinator.releaseReading(reservationId, expired),
  };
}

export function createMemoryRepositories(store = new MemoryStore()): MemoryRepositories {
  const rawCastingRepository = new MemoryCastingRepository(store);
  const castingRepository = withMemoryCastResultIntegrity(rawCastingRepository, store);
  const identityRepository = createMemoryIdentityRepository(store);
  const revealAdapter = new MemoryRevealRepository(store);
  const readingRepository = new MemoryReadingRepository(store);
  const entitlementRepository = new MemoryEntitlementRepository(store);
  const reviewRepository = new MemoryReviewRepository(store);
  const privacyRepository = new MemoryPrivacyRepository(store);
  const coordinator = new MemoryRepositoryCoordinator(store, readingRepository, entitlementRepository);
  return {
    identityRepository,
    castingRepository,
    loginIntentRepository: revealAdapter,
    revealRepository: revealAdapter,
    readingRepository,
    entitlementRepository,
    reviewRepository,
    privacyRepository,
    repo: createFacade(
      identityRepository,
      castingRepository,
      readingRepository,
      entitlementRepository,
      reviewRepository,
      privacyRepository,
      coordinator,
    ),
  };
}

export { MemoryStore } from "./store";
