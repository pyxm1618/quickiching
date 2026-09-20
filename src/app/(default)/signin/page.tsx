import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";
import { validateAuthCallbackURL } from "@/server/auth/callback";

export const metadata: Metadata = {
  title: "Sign in | Quick I Ching",
  robots: { index: false, follow: false },
};

// Capability state is server-side deployment configuration; never freeze the
// disabled build-time branch into a later Auth-enabled deployment.
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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
  let callbackURL = "/";
  try {
    callbackURL = validateAuthCallbackURL(
      firstParam(params.callbackURL),
      process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    );
  } catch {
    callbackURL = "/";
  }
  const errorCode = firstParam(params.error);

  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:py-20">
      <div className="mb-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--bronze)]">Quick I Ching</p>
        <h1 className="mt-3 font-display text-3xl font-medium text-[var(--ink)]">Sign in to Quick I Ching</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-3)]">Access your readings and account.</p>
      </div>

      <AuthForm mode="signin" callbackURL={callbackURL} initialErrorCode={errorCode} />

      <p className="mt-7 text-center text-sm text-[var(--ink-3)]">
        New to Quick I Ching?{" "}
        <Link
          href={`/signup?callbackURL=${encodeURIComponent(callbackURL)}`}
          className="font-semibold text-[var(--ink)] underline decoration-[var(--line-strong)] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cinnabar)]"
        >
          Sign up
        </Link>
      </p>
    </main>
  );
}
