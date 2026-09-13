import { timingSafeEqual } from "node:crypto";

export function resolveRefundOperatorSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  const explicit = env.REFUND_OPERATOR_SECRET?.trim() ?? "";
  if (explicit) return explicit;
  if (env.QUICKICHING_DEPLOYMENT_TIER === "staging") {
    return env.APP_SECRET?.trim() ?? "";
  }
  return "";
}

export function verifyRefundOperatorAuthorization(
  request: Request,
  expectedSecret: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader?.startsWith("Bearer ")) return false;
  const provided = authHeader.slice(7).trim();
  if (!provided) return false;

  const validSecrets = [expectedSecret.trim()];
  if (env.QUICKICHING_DEPLOYMENT_TIER === "staging" && env.APP_SECRET?.trim()) {
    validSecrets.push(env.APP_SECRET.trim());
  }

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
