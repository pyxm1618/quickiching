import { cookies, headers } from "next/headers";
import { randomToken, signCookie, verifyCookie, hmac } from "@/lib/crypto";
import { repo } from "@/server/repository";
import { runtimeConfig } from "@/server/config";
import { getProductionAuth } from "@/server/auth/better-auth";

const ANON_COOKIE = "iching_anon";
const SESSION_COOKIE = "iching_session";
const ANON_KEY_VERSION = "v1";

export async function getOrCreateAnonymousHash(): Promise<string> {
  const store = await cookies();
  const existing = store.get(ANON_COOKIE)?.value;
  if (existing) {
    const payload = verifyCookie(existing);
    if (payload) return payload;
  }
  const token = randomToken(32);
  const payload = hmac(token, "anon", ANON_KEY_VERSION);
  const signed = signCookie(payload);
  store.set(ANON_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return payload;
}

export async function getAnonymousHash(): Promise<string | null> {
  const store = await cookies();
  const existing = store.get(ANON_COOKIE)?.value;
  if (!existing) return null;
  return verifyCookie(existing);
}

export async function getCurrentUser(): Promise<{ id: string; email: string } | null> {
  const config = runtimeConfig();
  if (config.auth === "better-auth") {
    const session = await getProductionAuth(config).api.getSession({ headers: await headers() });
    return session?.user ? { id: session.user.id, email: session.user.email } : null;
  }

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
  if (runtimeConfig().auth !== "dev") throw new Error("DEV_SIGN_IN_DISABLED");
  let user = repo.getUserByEmail(email);
  if (!user) user = repo.createUser(email);
  const session = repo.createSession(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, signCookie(session.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return { id: user.id, email: user.email };
}

export async function signOut(): Promise<void> {
  const config = runtimeConfig();
  if (config.auth === "better-auth") {
    await getProductionAuth(config).api.signOut({ headers: await headers() });
    return;
  }
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
