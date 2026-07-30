import type { QualityReview } from "../models";
import type { ReviewRepository } from "../review-repository";
import { snapshot } from "./snapshot";
import { memoryId, repositoryError, type MemoryStore } from "./store";

export class MemoryReviewRepository implements ReviewRepository {
  constructor(private readonly store: MemoryStore) {}

  createQualityReview(input: { readingId: string; userId: string; reason: string }): QualityReview {
    const reading = this.store.readings.get(input.readingId);
    if (!reading) throw repositoryError("READING_NOT_FOUND");
    const casting = this.store.castingSessions.get(reading.castingSessionId);
    if (!casting || casting.userId !== input.userId || casting.lifecycle !== "revealed") {
      throw repositoryError("QUALITY_REVIEW_FORBIDDEN");
    }
    if (reading.status !== "completed") throw repositoryError("QUALITY_REVIEW_NOT_DELIVERED");
    const existing = [...this.store.qualityReviews.values()].find((review) => review.readingId === input.readingId);
    if (existing) throw repositoryError("QUALITY_REVIEW_ALREADY_SUBMITTED");
    const now = new Date();
    const review: QualityReview = {
      id: memoryId("qr"),
      readingId: input.readingId,
      userId: input.userId,
      status: "submitted",
      reason: input.reason,
      createdAt: now,
      updatedAt: now,
    };
    this.store.qualityReviews.set(review.id, review);
    return snapshot(review);
  }

  decideQualityReview(reviewId: string, approved: boolean): QualityReview {
    const review = this.store.qualityReviews.get(reviewId);
    if (!review) throw new Error("REVIEW_NOT_FOUND");
    review.status = approved ? "approved" : "rejected";
    review.updatedAt = new Date();
    return snapshot(review);
  }
}
