import { randomUUID } from "node:crypto";
import * as z from "zod";
import { getAnonymousHash } from "@/lib/auth/session";
import { randomToken } from "@/lib/crypto";
import { resolveWriteKey, runtimeConfig } from "@/server/config";
import { createPostgresPersistence } from "@/server/repositories/postgres";
import { hashLoginIntentNonce } from "@/server/auth/login-intent";
import { encodeRevealAuthState } from "@/server/auth/reveal-state";
import { getProductionAuth } from "@/server/auth/better-auth";
import { TurnstileVerifier } from "@/server/abuse/turnstile";

const schema = z.object({
  castingId: z.string().regex(/^cas_[a-f0-9]{24,32}$/),
  method: z.enum(["magic-link", "google"]),
  email: z.string().email().optional(),
  turnstileToken: z.string().max(2048),
}).refine((value) => value.method !== "magic-link" || Boolean(value.email), {
  path: ["email"],
  message: "Email is required.",
});

export async function POST(request: Request): Promise<Response> {
  const config = runtimeConfig();
  if (config.auth !== "better-auth") {
    return Response.json({ error: "Production authentication is not enabled." }, { status: 404 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid reveal sign-in request." }, { status: 400 });
  const anonymousSessionHash = await getAnonymousHash();
  if (!anonymousSessionHash) return Response.json({ error: "Casting ownership could not be verified." }, { status: 403 });

  const hostname = new URL(config.credentials.publicAppUrl).hostname;
  const remoteIp = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  try {
    await new TurnstileVerifier({ secret: config.credentials.turnstileSecretKey }).verify({
      token: parsed.data.turnstileToken,
      action: "reveal",
      hostname,
      remoteIp,
      idempotencyKey: randomUUID(),
    });
  } catch {
    return Response.json({ error: "Human verification failed." }, { status: 400 });
  }

  const persistence = createPostgresPersistence(config.credentials.databaseUrl);
  try {
    const rows = await persistence.sql`
      select id, anonymous_session_hash, lifecycle, reveal_expires_at
      from casting_sessions where id = ${parsed.data.castingId}
    `;
    const casting = rows[0];
    if (
      !casting
      || casting.anonymous_session_hash !== anonymousSessionHash
      || casting.lifecycle !== "awaiting_reveal"
      || (casting.reveal_expires_at && new Date(casting.reveal_expires_at).getTime() <= Date.now())
    ) {
      return Response.json({ error: "Casting cannot be revealed." }, { status: 409 });
    }

    const intentId = `lin_${randomUUID().replaceAll("-", "")}`;
    const nonce = randomToken(32);
    const nonceKey = resolveWriteKey(config.keys.sessionSigning);
    const nonceHash = hashLoginIntentNonce(nonce, nonceKey);
    const callbackPath = `/result/${parsed.data.castingId}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await persistence.sql`
      insert into login_intents (
        id, casting_session_id, anonymous_session_hash, nonce_hash,
        nonce_key_version, allowed_callback_path, expires_at, created_at
      ) values (
        ${intentId}, ${parsed.data.castingId}, ${anonymousSessionHash}, ${nonceHash},
        ${nonceKey.version}, ${callbackPath}, ${expiresAt}, now()
      )
    `;
    const state = encodeRevealAuthState({ intentId, nonce, callbackPath });
    const authenticationCallback = `/api/reveal/auth/complete?state=${encodeURIComponent(state)}`;
    const auth = getProductionAuth(config);
    if (parsed.data.method === "magic-link") {
      await auth.api.signInMagicLink({
        body: {
          email: parsed.data.email!,
          callbackURL: authenticationCallback,
          errorCallbackURL: `/signin?error=reveal-magic-link`,
          metadata: { loginIntentId: intentId },
        },
        headers: request.headers,
      });
      return Response.json({ sent: true });
    }
    const result = await auth.api.signInSocial({
      body: {
        provider: "google",
        callbackURL: authenticationCallback,
        errorCallbackURL: "/signin?error=reveal-google",
        disableRedirect: true,
      },
      headers: request.headers,
    });
    return Response.json({ url: result.url });
  } finally {
    await persistence.close();
  }
}
