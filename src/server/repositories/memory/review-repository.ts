import type { QualityReview, Reading } from "../models";
import type { ReviewRepository } from "../review-repository";
import { snapshot } from "./snapshot";
import { memoryId, repositoryError, type MemoryStore } from "./store";

export class MemoryReviewRepository implements ReviewRepository {
  constructor(private readonly store: MemoryStore) {}

  getReviewableReading(readingId: string, userId: string): Reading | undefined {
    const reading = this.store.readings.get(readingId);
    if (!reading) return undefined;
    const casting = this.store.castingSessions.get(reading.castingSessionId);
    if (
      !casting
      || casting.userId !== userId
      || casting.lifecycle !== "revealed"
      || reading.status !== "completed"
    ) {
      return undefined;
    }
    return snapshot(reading);
  }

  createQualityReview(input: {
    readingId: string;
    userId: string;
    reason: string;
    responseDueAt: Date;
    now: Date;
  }): QualityReview {
    return this.store.withLock(() => {
      if (!this.getReviewableReading(input.readingId, input.userId)) {
        throw repositoryError("QUALITY_REVIEW_FORBIDDEN");
      }
      const existing = [...this.store.qualityReviews.values()].find(
        (review) => review.readingId === input.readingId,
      );
      if (existing) throw repositoryError("QUALITY_REVIEW_ALREADY_SUBMITTED");
      const now = new Date(input.now);
      const review: QualityReview = {
        id: memoryId("qr"),
        readingId: input.readingId,
        userId: input.userId,
        status: "submitted",
        reason: input.reason,
        responseDueAt: new Date(input.responseDueAt),
        supplementedAt: null,
        decidedAt: null,
        compensationBatchId: null,
        createdAt: now,
        updatedAt: now,
      };
      this.store.qualityReviews.set(review.id, review);
      return snapshot(review);
    });
  }

  getQualityReview(reviewId: string): QualityReview | undefined {
    const review = this.store.qualityReviews.get(reviewId);
    return review ? snapshot(review) : undefined;
  }

  supplementQualityReview(input: {
    reviewId: string;
    userId: string;
    additionalReason: string;
    now: Date;
  }): QualityReview {
    return this.store.withLock(() => {
      const review = this.store.qualityReviews.get(input.reviewId);
      if (!review) throw new Error("REVIEW_NOT_FOUND");
      if (review.userId !== input.userId) throw repositoryError("QUALITY_REVIEW_FORBIDDEN");
      if (review.status !== "submitted" || review.supplementedAt) {
        throw new Error("QUALITY_REVIEW_SUPPLEMENT_CLOSED");
      }
      review.reason = `${review.reason ?? ""}\n\nSupplement: ${input.additionalReason}`.trim();
      review.status = "supplementing";
      review.supplementedAt = new Date(input.now);
      review.updatedAt = new Date(input.now);
      return snapshot(review);
    });
  }

  decideQualityReview(input: {
    reviewId: string;
    approved: boolean;
    compensationBatchId: string | null;
    now: Date;
  }): QualityReview {
    return this.store.withLock(() => {
      const review = this.store.qualityReviews.get(input.reviewId);
      if (!review) throw new Error("REVIEW_NOT_FOUND");
      if (review.status === "approved" || review.status === "rejected") {
        throw new Error("QUALITY_REVIEW_TERMINAL");
      }
      review.status = input.approved ? "approved" : "rejected";
      review.compensationBatchId = input.compensationBatchId;
      review.decidedAt = new Date(input.now);
      review.updatedAt = new Date(input.now);
      return snapshot(review);
    });
  }
}
