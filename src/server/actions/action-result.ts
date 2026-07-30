import { fail, type ActionResult } from "@/lib/action-result";
import { DomainError } from "@/server/errors/domain-error";

export function mapKnownDomainError<T>(error: unknown, context: { action: string }): ActionResult<T> {
  if (error instanceof DomainError)
    return fail(error.code, error.publicMessage, error.retryable, error.field);

  console.error("Unexpected server action error", {
    action: context.action,
    errorName: error instanceof Error ? error.name : typeof error,
  });
  throw error;
}
