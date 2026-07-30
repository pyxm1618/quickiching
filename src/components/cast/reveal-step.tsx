"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SealMark } from "@/components/hex/seal-mark";
import { TurnstileWidget } from "@/components/turnstile-widget";

export function RevealStep(props: {
  castingId: string;
  pending: boolean;
  onReveal(email: string): Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [localPending, setLocalPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const productionAuth = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const pending = props.pending || localPending;

  async function productionReveal(method: "magic-link" | "google") {
    setLocalPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/reveal/auth/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          castingId: props.castingId,
          method,
          email: method === "magic-link" ? email : undefined,
          turnstileToken,
        }),
      });
      const body = await response.json() as { sent?: boolean; url?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Secure reveal could not be started.");
      if (body.url) {
        window.location.assign(body.url);
        return;
      }
      setMessage("Check your email. Open the secure link in any browser to reveal this sealed casting there.");
      setTurnstileToken(null);
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : "Secure reveal could not be started.");
      setTurnstileToken(null);
    } finally {
      setLocalPending(false);
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (productionAuth) void productionReveal("magic-link");
    else void props.onReveal(email);
  };

  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <SealMark char="封" size="lg" tilt />
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--bronze)]">The ritual is complete</p>
      <h2 className="mt-3 font-display text-3xl font-medium">Reveal your result</h2>
      <div className="mt-7 flex w-40 flex-col gap-2" aria-hidden>
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-2 rounded-[1px] bg-[var(--line-strong)]/60" />)}
      </div>
      <p className="mt-6 text-sm leading-relaxed text-[var(--ink-2)]">
        Sign in to bind the sealed casting to your account. The original anonymous browser never receives report access automatically.
      </p>
      {productionAuth && (
        <div className="mt-5 w-full"><TurnstileWidget action="reveal" onToken={setTurnstileToken} /></div>
      )}
      {productionAuth && (
        <Button
          type="button"
          variant="outline"
          disabled={pending || !turnstileToken}
          className="mt-4 w-full"
          onClick={() => productionReveal("google")}
        >
          Continue with Google
        </Button>
      )}
      <form onSubmit={submit} className="mt-4 w-full space-y-4 text-left">
        <div>
          <Label htmlFor="reveal-email">Email</Label>
          <Input id="reveal-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        {message && <p className="text-sm text-[var(--jade)]">{message}</p>}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <Button type="submit" disabled={pending || (productionAuth && !turnstileToken)} size="lg" className="w-full">
          {pending ? "Starting secure reveal…" : productionAuth ? "Email a reveal link" : "Sign in & reveal"}
        </Button>
      </form>
    </div>
  );
}
