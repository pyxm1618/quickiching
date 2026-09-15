import * as z from "zod";

const emailSchema = z.string().email();

export function normalizeAuthEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!emailSchema.safeParse(normalized).success) throw new Error("AUTH_EMAIL_INVALID");
  return normalized;
}

function parseOrigin(baseURL: string): string {
  let parsed: URL;
  try {
    parsed = new URL(baseURL);
  } catch {
    throw new Error("AUTH_CALLBACK_INVALID");
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error("AUTH_CALLBACK_INVALID");
  }
  return parsed.origin;
}

export function validateAuthCallbackURL(candidate: string | undefined, baseURL: string): string {
  const origin = parseOrigin(baseURL);
  if (candidate === undefined || candidate.trim() === "") return "/";
  if (candidate.trim() !== candidate || candidate.length > 2048) throw new Error("AUTH_CALLBACK_INVALID");

  let decoded = candidate;
  try {
    let stable = false;
    for (let pass = 0; pass < 8; pass += 1) {
      if (/%(?:25)*(?:2f|5c)/i.test(decoded) || decoded.includes("\\") || decoded.startsWith("//")) {
        throw new Error();
      }
      const next = decodeURIComponent(decoded);
      if (next === decoded) {
        stable = true;
        break;
      }
      decoded = next;
    }
    if (!stable || /%(?:25)*(?:2f|5c)/i.test(decoded) || decoded.includes("\\") || decoded.startsWith("//")) {
      throw new Error();
    }
  } catch {
    throw new Error("AUTH_CALLBACK_INVALID");
  }

  let parsed: URL;
  try {
    parsed = new URL(decoded, origin);
  } catch {
    throw new Error("AUTH_CALLBACK_INVALID");
  }
  if (
    parsed.origin !== origin ||
    parsed.username ||
    parsed.password ||
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.pathname.startsWith("//") ||
    parsed.pathname.includes("\\")
  ) {
    throw new Error("AUTH_CALLBACK_INVALID");
  }

  return `${parsed.pathname || "/"}${parsed.search}${parsed.hash}`;
}
