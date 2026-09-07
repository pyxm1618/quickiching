import { timingSafeEqual } from "node:crypto";

export function verifyRefundOperatorAuthorization(request: Request, expectedSecret: string): boolean {
  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader?.startsWith("Bearer ")) return false;
  const provided = authHeader.slice(7).trim();
  const expected = expectedSecret.trim();
  if (!provided || !expected) return false;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
