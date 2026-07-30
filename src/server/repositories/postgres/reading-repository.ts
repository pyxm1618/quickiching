import { eq } from "drizzle-orm";
import type { PostgresDatabase } from "@/server/db/client";
import { previews, readings } from "@/server/db/schema";
import type { AsyncReadingRepository } from "./ports";
import { mapPreview, mapReading, postgresId } from "./helpers";

export class PostgresReadingRepository implements AsyncReadingRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async getPreview(castingId: string) {
    const [row] = await this.database.select().from(previews)
      .where(eq(previews.castingId, castingId))
      .limit(1);
    return row ? mapPreview(row) : undefined;
  }

  async getReading(readingId: string) {
    const [row] = await this.database.select().from(readings)
      .where(eq(readings.id, readingId))
      .limit(1);
    return row ? mapReading(row) : undefined;
  }

  async getReadingByCasting(castingId: string) {
    const [row] = await this.database.select().from(readings)
      .where(eq(readings.castingId, castingId))
      .limit(1);
    return row ? mapReading(row) : undefined;
  }

  async createReading(castingId: string, now: Date) {
    const [row] = await this.database.insert(readings).values({
      id: postgresId("rdg"),
      castingId,
      status: "not_started",
      schemaVersion: "reading-v2.1",
      generationEpoch: 0,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: readings.castingId,
      set: { updatedAt: readings.updatedAt },
    }).returning();
    return mapReading(row);
  }
}
