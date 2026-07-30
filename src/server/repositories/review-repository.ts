import type { QualityReview } from "./models";

export interface ReviewRepository {
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
