"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SealMark } from "@/components/hex/seal-mark";
import { TurnstileChallenge } from "@/components/security/turnstile-challenge";

export function RevealStep(props: {
  pending: boolean;
  onReveal(email: string, turnstileToken?: string): Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const challengeRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (challengeRequired && !turnstileToken) return;
    void props.onReveal(email, turnstileToken ?? undefined);
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
        Sign in to bind the sealed casting to your account. Result fields remain unavailable until the reveal transaction commits.
      </p>
      <form onSubmit={submit} className="mt-5 w-full space-y-4 text-left">
        <div>
          <Label htmlFor="reveal-email">Email</Label>
          <Input id="reveal-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <TurnstileChallenge action="reveal_casting" onToken={setTurnstileToken} />
        <Button
          type="submit"
          disabled={props.pending || (challengeRequired && !turnstileToken)}
          size="lg"
          className="w-full"
        >
          {props.pending ? "Revealing…" : "Sign in & reveal"}
        </Button>
      </form>
    </div>
  );
}
