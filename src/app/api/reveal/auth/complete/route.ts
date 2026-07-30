import { getCurrentUser } from "@/lib/auth/session";
import { decryptJson } from "@/lib/crypto";
import { fingerprintQuestion, normalizeComposite } from "@/domain/questions/normalize";
import { resolveVersionedKey, resolveWriteKey, runtimeConfig } from "@/server/config";
import { decodeRevealAuthState } from "@/server/auth/reveal-state";
import { hashLoginIntentNonce } from "@/server/auth/login-intent";
import { createPostgresPersistence } from "@/server/repositories/postgres";

export async function GET(request: Request): Promise<Response> {
  const config = runtimeConfig();
  if (config.auth !== "better-auth") return Response.json({ error: "Authentication is not enabled." }, { status: 404 });
  const state = decodeRevealAuthState(new URL(request.url).searchParams.get("state") ?? "");
  if (!state) return Response.json({ error: "Invalid reveal continuation." }, { status: 400 });
  const user = await getCurrentUser();
  if (!user) {
    return Response.redirect(new URL(`/signin?callback=${encodeURIComponent(request.url)}`, config.credentials.publicAppUrl));
  }

  const persistence = createPostgresPersistence(config.credentials.databaseUrl);
  try {
    const rows = await persistence.sql`
      select
        i.nonce_hash, i.nonce_key_version,
        c.id as casting_id, c.scene, c.interpretation_goal,
        q.id as question_id, q.ciphertext, q.iv, q.auth_tag, q.encryption_key_version
      from login_intents i
      join casting_sessions c on c.id = i.casting_session_id
      join question_versions q on q.id = c.current_question_version_id
      where i.id = ${state.intentId}
    `;
    const row = rows[0];
    if (!row) return Response.json({ error: "Reveal continuation not found." }, { status: 404 });
    const context = decryptJson<{ context: string }>({
      v: row.encryption_key_version,
      iv: row.iv,
      tag: row.auth_tag,
      data: row.ciphertext,
    }, "context", `${row.casting_id}:${row.question_id}`).context;
    const composite = normalizeComposite(row.scene, row.interpretation_goal, context);
    const fingerprintCandidates = config.keys.questionFingerprint.read.map((key) => ({
      keyVersion: key.version,
      fingerprint: fingerprintQuestion(composite, key.value, key.version),
    }));
    const writeKey = resolveWriteKey(config.keys.questionFingerprint);
    const nonceKey = resolveVersionedKey(config.keys.sessionSigning, row.nonce_key_version);
    const outcome = await persistence.atomicRepository.consumeLoginIntentAndReveal({
      intentId: state.intentId,
      nonceHash: hashLoginIntentNonce(state.nonce, nonceKey),
      nonceKeyVersion: nonceKey.version,
      authenticatedUserId: user.id,
      callbackPath: state.callbackPath,
      fingerprintCandidates,
      writeFingerprint: {
        keyVersion: writeKey.version,
        fingerprint: fingerprintQuestion(composite, writeKey.value, writeKey.version),
      },
      now: new Date(),
    });
    return Response.redirect(new URL(`/result/${outcome.castingId}`, config.credentials.publicAppUrl));
  } catch {
    return Response.redirect(new URL("/signin?error=reveal-continuation", config.credentials.publicAppUrl));
  } finally {
    await persistence.close();
  }
}
