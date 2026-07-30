import type { QualityReview } from "../models";
import type { ReviewRepository } from "../review-repository";
import { snapshot } from "./snapshot";
import { memoryId, repositoryError, type MemoryStore } from "./store";

const RESPONSE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type ReviewDecisionInput = {
  reviewId: string;
  approved: boolean;
  compensationBatchId: string | null;
  now: Date;
};

export class MemoryReviewRepository implements ReviewRepository {
  constructor(private readonly store: MemoryStore) {}

  createQualityReview(input: {
    readingId: string;
    userId: string;
    reason: string;
    responseDueAt?: Date;
    now?: Date;
  }): QualityReview {
    return this.store.withLock(() => {
      const reading = this.store.readings.get(input.readingId);
      if (!reading) throw repositoryError("READING_NOT_FOUND");
      const casting = this.store.castingSessions.get(reading.castingSessionId);
      if (!casting || casting.userId !== input.userId || casting.lifecycle !== "revealed") {
        throw repositoryError("QUALITY_REVIEW_FORBIDDEN");
      }
      if (reading.status !== "completed") throw repositoryError("QUALITY_REVIEW_NOT_DELIVERED");
      const existing = [...this.store.qualityReviews.values()].find(
        (review) => review.readingId === input.readingId,
      );
      if (existing) throw repositoryError("QUALITY_REVIEW_ALREADY_SUBMITTED");
      const now = input.now ? new Date(input.now) : new Date();
      const review: QualityReview = {
        id: memoryId("qr"),
        readingId: input.readingId,
        userId: input.userId,
        status: "submitted",
        reason: input.reason,
        responseDueAt: input.responseDueAt
          ? new Date(input.responseDueAt)
          : new Date(now.getTime() + RESPONSE_WINDOW_MS),
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

  decideQualityReview(input: ReviewDecisionInput): QualityReview;
  decideQualityReview(reviewId: string, approved: boolean): QualityReview;
  decideQualityReview(inputOrId: ReviewDecisionInput | string, legacyApproved?: boolean): QualityReview {
    const input: ReviewDecisionInput = typeof inputOrId === "string"
      ? {
          reviewId: inputOrId,
          approved: legacyApproved ?? false,
          compensationBatchId: null,
          now: new Date(),
        }
      : inputOrId;
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
