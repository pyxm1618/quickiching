import { DomainError } from "@/server/errors/domain-error";
import type { EntitlementRepository } from "@/server/repositories/entitlement-repository";
import type { ReadingRepository } from "@/server/repositories/reading-repository";
import type { ReviewRepository } from "@/server/repositories/review-repository";

const REVIEW_SUBMISSION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const REVIEW_RESPONSE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export class QualityReviewService {
  constructor(private readonly dependencies: {
    reviewRepository: ReviewRepository;
    readingRepository: ReadingRepository;
    entitlementRepository: EntitlementRepository;
    clock: { now(): Date };
  }) {}

  submit(input: { readingId: string; userId: string; reason: string }) {
    const reading = this.dependencies.readingRepository.getReading(input.readingId);
    if (!reading || reading.status !== "completed") {
      throw new DomainError("QUALITY_REVIEW_NOT_DELIVERED", "This report is not available for review.", false);
    }
    const now = this.dependencies.clock.now();
    if (now.getTime() > reading.updatedAt.getTime() + REVIEW_SUBMISSION_WINDOW_MS) {
      throw new DomainError("QUALITY_REVIEW_WINDOW_CLOSED", "The report review window has closed.", false);
    }
    return this.dependencies.reviewRepository.createQualityReview({
      ...input,
      now,
      responseDueAt: new Date(now.getTime() + REVIEW_RESPONSE_WINDOW_MS),
    });
  }

  supplement(input: { reviewId: string; userId: string; additionalReason: string }) {
    const review = this.requireReview(input.reviewId);
    if (review.userId !== input.userId) {
      throw new DomainError("QUALITY_REVIEW_FORBIDDEN", "This review is not available.", false);
    }
    if (review.status !== "submitted" || review.supplementedAt) {
      throw new DomainError(
        "QUALITY_REVIEW_SUPPLEMENT_CLOSED",
        "This review can no longer be supplemented.",
        false,
      );
    }
    return this.dependencies.reviewRepository.supplementQualityReview({
      ...input,
      now: this.dependencies.clock.now(),
    });
  }

  decide(input: { reviewId: string; approved: boolean }) {
    const review = this.requireReview(input.reviewId);
    if (review.status === "approved" || review.status === "rejected") {
      throw new DomainError("QUALITY_REVIEW_TERMINAL", "This review is already closed.", false);
    }

    let compensationBatchId: string | null = null;
    if (input.approved) {
      const batch = this.dependencies.entitlementRepository.grantEntitlement({
        userId: review.userId,
        productId: "quality-review-compensation",
        quantity: 1,
        amountUsd: 0,
      });
      compensationBatchId = batch.id;
    }
    return this.dependencies.reviewRepository.decideQualityReview({
      reviewId: input.reviewId,
      approved: input.approved,
      compensationBatchId,
      now: this.dependencies.clock.now(),
    });
  }

  private requireReview(reviewId: string) {
    const review = this.dependencies.reviewRepository.getQualityReview(reviewId);
    if (!review) throw new DomainError("QUALITY_REVIEW_NOT_FOUND", "Review not found.", false);
    return review;
  }
}
