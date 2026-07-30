"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SealMark } from "@/components/hex/seal-mark";
import { TurnstileWidget } from "@/components/turnstile-widget";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const productionAuth = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  async function initiate(method: "magic-link" | "google") {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      if (!productionAuth) {
        if (method === "google") throw new Error("Google sign-in is enabled only in production.");
        const result = await signInAction({ email });
        if (!result.ok) throw new Error(result.error.message);
        router.push("/account");
        return;
      }
      const response = await fetch("/api/auth/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method,
          email: method === "magic-link" ? email : undefined,
          callbackURL: "/account",
          turnstileToken,
        }),
      });
      const body = await response.json() as { sent?: boolean; url?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Sign-in could not be started.");
      if (body.url) {
        window.location.assign(body.url);
        return;
      }
      setMessage("Check your email for a secure, single-use sign-in link.");
      setTurnstileToken(null);
      setPending(false);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Sign-in could not be started.");
      setTurnstileToken(null);
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
        <CardHeader><CardTitle>Sign in</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-[var(--ink-3)]">
            Use Google or a secure email link. Sign-in links are short-lived and single-use.
          </p>
          {productionAuth && (
            <div className="mb-4"><TurnstileWidget action="login" onToken={setTurnstileToken} /></div>
          )}
          <Button
            type="button"
            variant="outline"
            className="mb-4 w-full"
            disabled={pending || (productionAuth && !turnstileToken)}
            onClick={() => initiate("google")}
          >
            Continue with Google
          </Button>
          <div className="mb-4 flex items-center gap-3 text-xs text-[var(--ink-3)]">
            <span className="h-px flex-1 bg-[var(--line)]" />OR<span className="h-px flex-1 bg-[var(--line)]" />
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void initiate("magic-link"); }} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            {message && <p className="text-sm text-[var(--jade)]">{message}</p>}
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <Button type="submit" disabled={pending || (productionAuth && !turnstileToken)} className="w-full">
              {pending ? "Starting secure sign-in…" : "Email me a sign-in link"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
