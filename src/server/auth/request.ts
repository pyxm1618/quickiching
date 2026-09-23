import { normalizeAuthEmail, validateAuthCallbackURL } from "./callback";

const callbackFields = ["callbackURL", "newUserCallbackURL", "errorCallbackURL"] as const;

export function normalizeAuthRequestBody(
  body: Record<string, unknown>,
  baseURL: string,
): Record<string, unknown> {
  const normalized = { ...body };
  if (typeof normalized.email === "string") normalized.email = normalizeAuthEmail(normalized.email);
  for (const field of callbackFields) {
    const value = normalized[field];
    if (value === undefined) continue;
    if (typeof value !== "string") throw new Error("AUTH_CALLBACK_INVALID");
    normalized[field] = validateAuthCallbackURL(value, baseURL);
  }
  return normalized;
}
