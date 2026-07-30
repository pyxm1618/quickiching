import type { CastingSession } from "./models";

export interface PrivacyRepository {
  listCastsForUser(userId: string): CastingSession[];
  requestCastingDeletion(castingId: string): void;
  listRecoverableDeletedCasts(userId: string, now: Date): CastingSession[];
  purgeDeletedCasts(now: Date): number;
}
