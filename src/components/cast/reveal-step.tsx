"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SealMark } from "@/components/hex/seal-mark";

export function RevealStep(props: {
  pending: boolean;
  onReveal(email: string): Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void props.onReveal(email);
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
        <Button type="submit" disabled={props.pending} size="lg" className="w-full">
          {props.pending ? "Revealing…" : "Sign in & reveal"}
        </Button>
      </form>
    </div>
  );
}
