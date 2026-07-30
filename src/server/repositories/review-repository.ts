import type { QualityReview } from "./models";

export interface ReviewRepository {
  createQualityReview(input: { readingId: string; userId: string; reason: string }): QualityReview;
  decideQualityReview(reviewId: string, approved: boolean): QualityReview;
}
