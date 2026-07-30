import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyCookie } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { getProductionRuntime } from "@/server/runtime/production";

const REVEAL_INTENT_COOKIE = "iching_reveal_intent";

type RevealCookie = {
  intentId: string;
  nonce: string;
  callbackPath: string;
  castingId: string;
  expiresAt: string;
};

function parseCookie(raw: string | undefined): RevealCookie | null {
  if (!raw) return null;
  const verified = verifyCookie(raw);
  if (!verified) return null;
  try {
    const value = JSON.parse(Buffer.from(verified, "base64url").toString("utf8")) as RevealCookie;
    if (
      typeof value.intentId !== "string"
      || typeof value.nonce !== "string"
      || typeof value.callbackPath !== "string"
      || typeof value.castingId !== "string"
      || typeof value.expiresAt !== "string"
      || new Date(value.expiresAt).getTime() <= Date.now()
    ) return null;
    return value;
  } catch {
    return null;
  }
}

export default async function CompleteRevealPage() {
  const store = await cookies();
  const reveal = parseCookie(store.get(REVEAL_INTENT_COOKIE)?.value);
  const user = await getCurrentUser();
  store.delete(REVEAL_INTENT_COOKIE);

  if (!reveal) redirect("/signin?error=reveal_intent");
  if (!user) redirect(`/signin?callbackURL=${encodeURIComponent("/reveal/complete")}`);

  try {
    const runtime = await getProductionRuntime();
    const outcome = await runtime.application.consumeLoginIntentAndReveal({
      intentId: reveal.intentId,
      nonce: reveal.nonce,
      authenticatedUserId: user.id,
      callbackPath: reveal.callbackPath,
    });
    redirect(`/result/${outcome.castingId}`);
  } catch {
    redirect(`/result/${reveal.castingId}?auth=error`);
  }
}
