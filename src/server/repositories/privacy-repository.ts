import type { CastingSession } from "./models";

export interface PrivacyRepository {
  listCastsForUser(userId: string): CastingSession[];
  requestCastingDeletion(castingId: string, now?: Date): CastingSession;
  restoreCasting(castingId: string, userId: string, now: Date): CastingSession;
  listRecoverableDeletedCasts(userId: string, now: Date): CastingSession[];
  purgeDeletedCasts(now: Date): number;
}
