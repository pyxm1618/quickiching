import { cookies } from "next/headers";
import {
  hmac,
  hmacWithKeyMaterial,
  randomToken,
  signCookie,
  verifyCookie,
  verifyHmacWithKeyMaterial,
} from "@/lib/crypto";
import { repo } from "@/server/repository";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";

// Dev/In-memory auth. Production target is Better Auth (Google OAuth + Magic Link), which
// requires OAuth credentials and an email provider (D0 Provisional). This module keeps the
// full flow runnable locally and uses the same cookie/session shape the production layer will.

const ANON_COOKIE = "iching_anon";
const SESSION_COOKIE = "iching_session";
const ANON_KEY_VERSION = "v1";

export type OwnerKey = { version: string; material: string };
export type AnonymousCookieVerification = {
  payload: string;
  source: "current" | "legacy";
  version?: string;
};

export function parseAnonymousOwnerKeys(raw: string): OwnerKey[] | null {
  const candidate = raw.trim();
  if (!candidate) return null;
  const keys = candidate.split(",").map((entry) => {
    const match = /^([A-Za-z0-9][A-Za-z0-9._-]*):(.+)$/.exec(entry.trim());
    return match && match[2].trim() ? { version: match[1], material: match[2].trim() } : null;
  });
  if (!keys.every((key): key is OwnerKey => key !== null)) return null;
  const versions = new Set(keys.map((key) => key.version));
  if (versions.size !== keys.length) return null;
  return keys;
}

export function signAnonymousCookieValue(payload: string, keys: OwnerKey[] | null): string {
  if (!keys) return signCookie(payload);
  const key = keys[0];
  if (!key) throw new Error("ANONYMOUS_OWNER_KEYS_INVALID");
  return `${payload}.${hmacWithKeyMaterial(payload, "anonymous-cookie", key.version, key.material)}`;
}

export function verifyAnonymousCookieValue(
  signed: string,
  keys: OwnerKey[] | null,
): AnonymousCookieVerification | null {
  if (!keys) {
    const payload = verifyCookie(signed);
    return payload ? { payload, source: "legacy" } : null;
  }
  for (const key of keys) {
    const idx = signed.lastIndexOf(".");
    if (idx < 0) return null;
    const payload = signed.slice(0, idx);
    const signature = signed.slice(idx + 1);
    if (verifyHmacWithKeyMaterial(payload, signature, "anonymous-cookie", key.version, key.material)) {
      return { payload, source: "current", version: key.version };
    }
  }
  const legacyPayload = verifyCookie(signed);
  return legacyPayload ? { payload: legacyPayload, source: "legacy" } : null;
}

function runtimeAnonymousOwnerKeys(): OwnerKey[] | null {
  if (!isAuthCapabilityEnabled()) return null;
  const raw = process.env.ANONYMOUS_OWNER_KEYS?.trim();
  const keys = raw ? parseAnonymousOwnerKeys(raw) : null;
  if (!keys) throw new Error("ANONYMOUS_OWNER_KEYS_INVALID");
  return keys;
}

function signAnonymousCookie(payload: string, keys: OwnerKey[] | null): string {
  return signAnonymousCookieValue(payload, keys);
}

function verifyAnonymousCookie(signed: string, keys: OwnerKey[] | null): AnonymousCookieVerification | null {
  return verifyAnonymousCookieValue(signed, keys);
}

function anonymousOwnerHash(token: string, keys: OwnerKey[] | null): string {
  if (!keys) return hmac(token, "anon", ANON_KEY_VERSION);
  const key = keys[0];
  if (!key) throw new Error("ANONYMOUS_OWNER_KEYS_INVALID");
  return hmacWithKeyMaterial(token, "anonymous-owner", key.version, key.material);
}

function setAnonymousCookie(store: Awaited<ReturnType<typeof cookies>>, signed: string): void {
  store.set(ANON_COOKIE, signed, {
    httpOnly: true,
    secure: String(process.env.NODE_ENV) === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function getOrCreateAnonymousHash(): Promise<string> {
  const store = await cookies();
  const keys = runtimeAnonymousOwnerKeys();
  const existing = store.get(ANON_COOKIE)?.value;
  if (existing) {
    const verification = verifyAnonymousCookie(existing, keys);
    if (verification) {
      if (keys && verification.source === "legacy") {
        setAnonymousCookie(store, signAnonymousCookie(verification.payload, keys));
      }
      return verification.payload;
    }
  }
  const token = randomToken(32);
  const payload = anonymousOwnerHash(token, keys);
  setAnonymousCookie(store, signAnonymousCookie(payload, keys));
  return payload;
}

export async function getAnonymousHash(): Promise<string | null> {
  const store = await cookies();
  const keys = runtimeAnonymousOwnerKeys();
  const existing = store.get(ANON_COOKIE)?.value;
  if (!existing) return null;
  const verification = verifyAnonymousCookie(existing, keys);
  if (verification && keys && verification.source === "legacy") {
    setAnonymousCookie(store, signAnonymousCookie(verification.payload, keys));
  }
  return verification?.payload ?? null;
}

export class AuthInfrastructureUnavailableError extends Error {
  readonly code = "AUTH_INFRASTRUCTURE_UNAVAILABLE";

  constructor() {
    super("AUTH_INFRASTRUCTURE_UNAVAILABLE");
    this.name = "AuthInfrastructureUnavailableError";
  }
}

export async function getCurrentUser(options: { allowUnavailable?: boolean } = {}): Promise<{ id: string; email: string } | null> {
  if (isAuthCapabilityEnabled()) {
    try {
      const { headers } = await import("next/headers");
      const { getAuth } = await import("@/server/auth/server");
      const session = await getAuth().api.getSession({ headers: await headers() });
      if (!session?.user) return null;
      return { id: session.user.id, email: session.user.email };
    } catch {
      if (options.allowUnavailable) return null;
      throw new AuthInfrastructureUnavailableError();
    }
  }
  // Public V1 production never falls back to the in-memory identity store.
  // The local branch exists only for legacy dev/test fixtures while Auth is off.
  if (process.env.NODE_ENV === "production") return null;
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const sessionId = verifyCookie(raw);
  if (!sessionId) return null;
  const session = repo.getSession(sessionId);
  if (!session) return null;
  const user = repo.getUser(session.userId);
  if (!user) return null;
  return { id: user.id, email: user.email };
}

export async function devSignIn(email: string): Promise<{ id: string; email: string }> {
  if (process.env.NODE_ENV === "production" || isAuthCapabilityEnabled()) {
    throw new Error("DEV_AUTH_DISABLED");
  }
  let user = repo.getUserByEmail(email);
  if (!user) user = repo.createUser(email);
  const session = repo.createSession(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, signCookie(session.id), {
    httpOnly: true,
    secure: String(process.env.NODE_ENV) === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return { id: user.id, email: user.email };
}

export async function signOut(): Promise<void> {
  if (isAuthCapabilityEnabled()) {
    const { headers } = await import("next/headers");
    const { getAuth } = await import("@/server/auth/server");
    await getAuth().api.signOut({ headers: await headers() });
    return;
  }
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function resolveSession(headers: Headers): Promise<{ user: { id: string; email: string } } | null> {
  if (isAuthCapabilityEnabled()) {
    try {
      const { getAuth } = await import("@/server/auth/server");
      const session = await getAuth().api.getSession({ headers });
      if (!session?.user) return null;
      return { user: { id: session.user.id, email: session.user.email } };
    } catch {
      return null;
    }
  }
  return null;
}
