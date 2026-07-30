"use server";

import type { ActionResult } from "@/lib/action-result";
import { fail, ok } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth/session";
import { mapKnownDomainError } from "@/server/actions/action-result";
import { castingRepository, privacyRepository } from "@/server/repository";
import { PrivacyService } from "@/server/services/privacy-service";

function privacyService(): PrivacyService {
  return new PrivacyService({
    privacyRepository,
    castingRepository,
    clock: { now: () => new Date() },
  });
}

async function boundary<T>(
  action: string,
  operation: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await operation();
  } catch (error) {
    return mapKnownDomainError(error, { action });
  }
}

export async function requestAccountDeletionAction(): Promise<ActionResult<{
  requestedAt: Date;
  purgeAfter: Date;
}>> {
  return boundary("requestAccountDeletionAction", async () => {
    const user = await getCurrentUser();
    if (!user) return fail("AUTH_REQUIRED", "Please sign in.", false);
    const request = privacyService().requestAccountDeletion(user.id);
    return ok({
      requestedAt: request.requestedAt,
      purgeAfter: request.purgeAfter,
    });
  });
}

export async function restoreAccountAction(): Promise<ActionResult<{
  restoredAt: Date;
}>> {
  return boundary("restoreAccountAction", async () => {
    const user = await getCurrentUser();
    if (!user) return fail("AUTH_REQUIRED", "Please sign in.", false);
    const request = privacyService().restoreAccount(user.id);
    if (!request.restoredAt) throw new Error("ACCOUNT_RESTORE_STATE_INVALID");
    return ok({ restoredAt: request.restoredAt });
  });
}
