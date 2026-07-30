import type { Preview, Reading } from "../models";
import type { ReadingRepository } from "../reading-repository";
import { cloneForStorage, snapshot } from "./snapshot";
import { memoryId, repositoryError, type MemoryStore } from "./store";

export class MemoryReadingRepository implements ReadingRepository {
  constructor(private readonly store: MemoryStore) {}

  getOrCreatePreview(castingSessionId: string): Preview {
    return snapshot(this.getOrCreateStoredPreview(castingSessionId));
  }

  savePreviewSuccess(castingSessionId: string, statement: string): Preview {
    const preview = this.getOrCreateStoredPreview(castingSessionId);
    preview.status = "completed";
    preview.relevanceStatement = statement;
    preview.updatedAt = new Date();
    return snapshot(preview);
  }

  savePreviewFailed(castingSessionId: string): Preview {
    const preview = this.getOrCreateStoredPreview(castingSessionId);
    preview.status = "failed";
    preview.relevanceStatement = null;
    preview.updatedAt = new Date();
    return snapshot(preview);
  }

  getPreview(castingSessionId: string): Preview | undefined {
    const preview = [...this.store.previews.values()].find((candidate) => candidate.castingSessionId === castingSessionId);
    return preview ? snapshot(preview) : undefined;
  }

  getOrCreateReading(castingSessionId: string): Reading {
    return snapshot(this.getOrCreateStoredReading(castingSessionId));
  }

  getReading(readingId: string): Reading | undefined {
    const reading = this.store.readings.get(readingId);
    return reading ? snapshot(reading) : undefined;
  }

  getReadingByCasting(castingSessionId: string): Reading | undefined {
    const reading = [...this.store.readings.values()].find((candidate) => candidate.castingSessionId === castingSessionId);
    return reading ? snapshot(reading) : undefined;
  }

  markReadingReserved(readingId: string, reservationId: string, now: Date): Reading {
    return this.store.withLock(() => {
      this.markReadingReservedInTransaction(readingId, reservationId, now);
      return snapshot(this.requireStoredReading(readingId));
    });
  }

  completeReading(
    readingId: string,
    reservationId: string,
    report: Record<string, unknown>,
    now: Date,
  ): Reading {
    return this.store.withLock(() => {
      this.completeReadingInTransaction(readingId, reservationId, report, now);
      return snapshot(this.requireStoredReading(readingId));
    });
  }

  failReading(readingId: string, reservationId: string, now: Date): Reading {
    return this.store.withLock(() => {
      this.failReadingInTransaction(readingId, reservationId, now);
      return snapshot(this.requireStoredReading(readingId));
    });
  }

  /** @internal Used only by the memory composition coordinator inside one store lock. */
  markReadingReservedInTransaction(readingId: string, reservationId: string, now: Date): void {
    const reading = this.requireStoredReading(readingId);
    if (reading.reservationId === reservationId && ["reserved", "completed"].includes(reading.status)) return;
    if (reading.reservationId != null || reading.status === "completed") throw repositoryError("RESERVATION_NOT_ACTIVE");
    reading.reservationId = reservationId;
    reading.status = "reserved";
    reading.updatedAt = new Date(now);
  }

  /** @internal Used only by the memory composition coordinator inside one store lock. */
  completeReadingInTransaction(
    readingId: string,
    reservationId: string,
    report: Record<string, unknown>,
    now: Date,
  ): void {
    const reading = this.requireStoredReading(readingId);
    if (reading.reservationId === reservationId && reading.status === "completed") return;
    if (reading.reservationId !== reservationId || reading.status !== "reserved") {
      throw repositoryError("RESERVATION_NOT_ACTIVE");
    }
    const preparedReport = cloneForStorage(report);
    reading.status = "completed";
    reading.report = preparedReport;
    reading.updatedAt = new Date(now);
  }

  /** @internal Used only by the memory composition coordinator inside one store lock. */
  failReadingInTransaction(readingId: string, reservationId: string, now: Date): void {
    const reading = this.requireStoredReading(readingId);
    if (reading.reservationId == null && reading.status === "failed") return;
    if (reading.reservationId !== reservationId || reading.status !== "reserved") {
      throw repositoryError("RESERVATION_NOT_ACTIVE");
    }
    reading.reservationId = null;
    reading.status = "failed";
    reading.updatedAt = new Date(now);
  }

  private getOrCreateStoredPreview(castingSessionId: string): Preview {
    if (!this.store.castingSessions.has(castingSessionId)) throw repositoryError("CASTING_NOT_FOUND");
    let preview = [...this.store.previews.values()].find((candidate) => candidate.castingSessionId === castingSessionId);
    if (!preview) {
      const now = new Date();
      preview = {
        id: memoryId("prev"),
        castingSessionId,
        status: "not_started",
        relevanceStatement: null,
        schemaVersion: "preview-v1",
        createdAt: now,
        updatedAt: now,
      };
      this.store.previews.set(preview.id, preview);
    }
    return preview;
  }

  private getOrCreateStoredReading(castingSessionId: string): Reading {
    if (!this.store.castingSessions.has(castingSessionId)) throw repositoryError("CASTING_NOT_FOUND");
    let reading = [...this.store.readings.values()].find((candidate) => candidate.castingSessionId === castingSessionId);
    if (!reading) {
      const now = new Date();
      reading = {
        id: memoryId("rdg"),
        castingSessionId,
        status: "not_started",
        reservationId: null,
        report: null,
        schemaVersion: "reading-v1",
        generationEpoch: 0,
        createdAt: now,
        updatedAt: now,
      };
      this.store.readings.set(reading.id, reading);
    }
    return reading;
  }

  private requireStoredReading(readingId: string): Reading {
    const reading = this.store.readings.get(readingId);
    if (!reading) throw new Error("READING_NOT_FOUND");
    return reading;
  }
}
