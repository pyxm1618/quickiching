import type { Preview, Reading } from "./models";

export interface ReadingRepository {
  getOrCreatePreview(castingSessionId: string): Preview;
  savePreviewSuccess(castingSessionId: string, statement: string): Preview;
  savePreviewFailed(castingSessionId: string): Preview;
  getPreview(castingSessionId: string): Preview | undefined;
  getOrCreateReading(castingSessionId: string): Reading;
  getReading(readingId: string): Reading | undefined;
  getReadingByCasting(castingSessionId: string): Reading | undefined;
  markReadingReserved(readingId: string, reservationId: string, now: Date): Reading;
  completeReading(readingId: string, reservationId: string, report: Record<string, unknown>, now: Date): Reading;
  failReading(readingId: string, reservationId: string, now: Date): Reading;
}
