import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getProductionRuntime } from "@/server/runtime/production";

const MAX_HANDOFF_STATE_LENGTH = 1024;

function singleState(value: string | string[] | undefined): string | null {
  if (typeof value !== "string" || value.length < 8 || value.length > MAX_HANDOFF_STATE_LENGTH) {
    return null;
  }
  return value;
}

export default async function CompleteRevealPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const { state: rawState } = await searchParams;
  const state = singleState(rawState);
  if (!state) redirect("/signin?error=reveal_intent");

  const user = await getCurrentUser();
  if (!user) {
    const callbackURL = `/reveal/complete?state=${encodeURIComponent(state)}`;
    redirect(`/signin?callbackURL=${encodeURIComponent(callbackURL)}`);
  }

  try {
    const runtime = await getProductionRuntime();
    const outcome = await runtime.revealHandoff.consume({
      handoffState: state,
      authenticatedUserId: user.id,
      authenticatedEmail: user.email,
    });
    redirect(`/result/${outcome.castingId}`);
  } catch (error) {
    // Next.js redirects are implemented as thrown control-flow errors.
    if (
      typeof error === "object"
      && error !== null
      && "digest" in error
      && typeof error.digest === "string"
      && error.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    redirect("/signin?error=reveal_intent");
  }
}
