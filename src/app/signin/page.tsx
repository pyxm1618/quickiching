"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInAction } from "@/app/actions";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SealMark } from "@/components/hex/seal-mark";

const productionAuth = process.env.NEXT_PUBLIC_AUTH_ADAPTER_MODE === "better-auth";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);

    if (productionAuth) {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: "/account",
        errorCallbackURL: "/signin?error=magic_link",
      });
      if (result.error) {
        setError("The sign-in link could not be sent. Please try again.");
        setPending(false);
        return;
      }
      setNotice("Check your email. The sign-in link expires in 10 minutes and works once.");
      setPending(false);
      return;
    }

    const result = await signInAction({ email });
    if (result.ok) {
      router.push("/account");
      return;
    }
    setError(result.error.message);
    setPending(false);
  }

  async function signInWithGoogle() {
    setPending(true);
    setError(null);
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/account",
      errorCallbackURL: "/signin?error=google",
    });
    if (result.error) {
      setError("Google sign-in could not be started. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <SealMark size="lg" tilt />
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--bronze)]">
          Sign in to your account
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-[var(--ink-3)]">
            {productionAuth
              ? "Use a one-time email link or Google. No password is stored by this application."
              : "Local development sign-in by email."}
          </p>
          {productionAuth && (
            <>
              <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={signInWithGoogle}>
                Continue with Google
              </Button>
              <div className="my-4 flex items-center gap-3 text-xs text-[var(--ink-3)]">
                <span className="h-px flex-1 bg-[var(--line)]" />
                <span>or</span>
                <span className="h-px flex-1 bg-[var(--line)]" />
              </div>
            </>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            {notice && <p className="text-sm text-[var(--jade)]">{notice}</p>}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Working…" : productionAuth ? "Email me a sign-in link" : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
