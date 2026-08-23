import type { Metadata } from "next";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";
import { validateAuthCallbackURL } from "@/server/auth/callback";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in | Quick I Ching",
  robots: { index: false, follow: false },
};

// Capability state is server-side deployment configuration; never freeze the
// disabled build-time branch into a later Auth-enabled deployment.
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isAuthCapabilityEnabled()) {
    return (
      <main className="mx-auto max-w-md px-4 py-20" aria-live="polite">
        <h1 className="font-display text-2xl font-medium">Sign-in is unavailable</h1>
        <p className="mt-3 text-sm text-[var(--ink-3)]">This service is not enabled in the current environment.</p>
      </main>
    );
  }

  const params = await searchParams;
  const rawCallback = Array.isArray(params.callbackURL) ? params.callbackURL[0] : params.callbackURL;
  let callbackURL = "/";
  try {
    callbackURL = validateAuthCallbackURL(rawCallback, process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
  } catch {
    callbackURL = "/";
  }

  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <div className="mb-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--bronze)]">Quick I Ching</p>
        <h1 className="mt-3 font-display text-3xl font-medium">Sign in</h1>
        <p className="mt-3 text-sm text-[var(--ink-3)]">Continue with Google or use a one-time email link.</p>
      </div>
      <SignInForm callbackURL={callbackURL} />
    </main>
  );
}
