"use client";

import { useState } from "react";
import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
  baseURL: "/api/auth",
  plugins: [magicLinkClient()],
});

type AuthRequestResult = { error?: unknown | null };

export async function runAuthRequest(
  request: () => Promise<AuthRequestResult>,
): Promise<boolean> {
  try {
    const result = await request();
    return !result.error;
  } catch {
    return false;
  }
}

export function SignInForm({ callbackURL }: { callbackURL: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const ok = await runAuthRequest(() => authClient.signIn.magicLink({ email, callbackURL }));
      if (!ok) {
        setError("We could not start sign-in. Please try again.");
      } else {
        setMessage("If that email is eligible, a one-time sign-in link has been sent.");
      }
    } finally {
      setPending(false);
    }
  }

  async function signInWithGoogle() {
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL });
      if (result.error) {
        setError("We could not start Google sign-in. Please try again.");
        return;
      }
      if (result.data?.url) window.location.assign(result.data.url);
      else setError("We could not start Google sign-in. Please try again.");
    } catch {
      setError("We could not start Google sign-in. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={pending}
        className="w-full rounded-md border border-[var(--line)] px-4 py-3 text-sm font-semibold hover:bg-[var(--ink)]/[0.03] disabled:opacity-60"
      >
        Continue with Google
      </button>
      <div className="flex items-center gap-3 text-xs text-[var(--ink-3)]" aria-hidden="true">
        <span className="h-px flex-1 bg-[var(--line)]" />
        <span>or</span>
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>
      <form onSubmit={requestMagicLink} className="space-y-4">
        <div>
          <label htmlFor="signin-email" className="block text-sm font-medium">Email</label>
          <input
            id="signin-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-sm"
          />
        </div>
        {message && <p role="status" className="text-sm text-[var(--jade)]">{message}</p>}
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-[var(--ink)] px-4 py-3 text-sm font-semibold text-[var(--paper)] disabled:opacity-60"
        >
          {pending ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
    </div>
  );
}
