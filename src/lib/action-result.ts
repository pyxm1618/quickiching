import { randomToken } from "@/lib/crypto";

// §15.3 Public action result. Never leaks internal exceptions, keys, or sensitive plaintext.
export type PublicApplicationError = {
  code: string;
  message: string;
  field?: string;
  retryable: boolean;
};

export type ActionResult<T> =
  | { ok: true; value: T; requestId: string }
  | { ok: false; error: PublicApplicationError; requestId: string };

export function ok<T>(value: T): ActionResult<T> {
  return { ok: true, value, requestId: randomToken(8) };
}

export function fail<T = never>(
  code: string,
  message: string,
  retryable = false,
  field?: string,
): ActionResult<T> {
  return {
    ok: false,
    error: { code, message, field, retryable },
    requestId: randomToken(8),
  };
}
