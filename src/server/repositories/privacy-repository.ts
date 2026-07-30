import type { AccountDeletionRequest, CastingSession } from "./models";

export interface PrivacyRepository {
  listCastsForUser(userId: string): CastingSession[];
  requestCastingDeletion(castingId: string, now?: Date): CastingSession;
  restoreCasting(castingId: string, userId: string, now: Date): CastingSession;
  listRecoverableDeletedCasts(userId: string, now: Date): CastingSession[];
  purgeDeletedCasts(now: Date): number;
  requestAccountDeletion(userId: string, now: Date): AccountDeletionRequest;
  getAccountDeletion(userId: string): AccountDeletionRequest | undefined;
  restoreAccount(userId: string, now: Date): AccountDeletionRequest;
  purgeDeletedAccounts(now: Date): number;
}
