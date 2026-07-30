import type { QualityReview, Reading } from "./models";

export interface ReviewRepository {
  getReviewableReading(readingId: string, userId: string): Reading | undefined;
  createQualityReview(input: {
    readingId: string;
    userId: string;
    reason: string;
    responseDueAt: Date;
    now: Date;
  }): QualityReview;
  getQualityReview(reviewId: string): QualityReview | undefined;
  supplementQualityReview(input: {
    reviewId: string;
    userId: string;
    additionalReason: string;
    now: Date;
  }): QualityReview;
  decideQualityReview(input: {
    reviewId: string;
    approved: boolean;
    compensationBatchId: string | null;
    now: Date;
  }): QualityReview;
}
