import { eq } from "drizzle-orm";
import type { PostgresDatabase } from "@/server/db/client";
import { qualityReviews } from "@/server/db/schema";
import type { AsyncReviewRepository } from "./ports";
import { mapReview, postgresId } from "./helpers";

export class PostgresReviewRepository implements AsyncReviewRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async createReview(input: Parameters<AsyncReviewRepository["createReview"]>[0]) {
    const [created] = await this.database.insert(qualityReviews).values({
      id: postgresId("qr"),
      readingId: input.readingId,
      userId: input.userId,
      status: "submitted",
      reason: input.reason,
      responseDueAt: input.responseDueAt,
      createdAt: input.now,
      updatedAt: input.now,
    }).returning();
    return mapReview(created);
  }

  async getReview(reviewId: string) {
    const [row] = await this.database.select().from(qualityReviews)
      .where(eq(qualityReviews.id, reviewId))
      .limit(1);
    return row ? mapReview(row) : undefined;
  }
}
