import { timingSafeEqual } from "node:crypto";

export function resolveRefundOperatorSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  const explicit = env.REFUND_OPERATOR_SECRET?.trim() ?? "";
  if (explicit) return explicit;
  return "";
}

export function verifyRefundOperatorAuthorization(
  request: Request,
  expectedSecret: string,
): boolean {
  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader?.startsWith("Bearer ")) return false;
  const provided = authHeader.slice(7).trim();
  if (!provided) return false;

  const validSecrets = [expectedSecret.trim()];

  const providedBuffer = Buffer.from(provided);
  for (const secret of validSecrets) {
    if (!secret) continue;
    const expectedBuffer = Buffer.from(secret);
    if (
      providedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return true;
    }
  }

  return false;
}
