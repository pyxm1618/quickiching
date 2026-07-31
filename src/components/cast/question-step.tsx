"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { TurnstileChallenge } from "@/components/security/turnstile-challenge";
import {
  INTERPRETATION_GOALS,
  QUESTION_MAX_CHARS,
  QUESTION_MIN_CHARS,
  SCENES,
} from "@/domain/casting/types";

const selectClass =
  "h-11 w-full rounded border border-[var(--line)] bg-[var(--paper-raised)] px-4 text-sm text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cinnabar)]";

export function QuestionStep(props: {
  scene: string;
  goal: string;
  context: string;
  pending: boolean;
  onSceneChange(value: string): void;
  onGoalChange(value: string): void;
  onContextChange(value: string): void;
  onSubmit(turnstileToken?: string): Promise<void>;
}) {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const challengeRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (challengeRequired && !turnstileToken) return;
    const token = turnstileToken ?? undefined;
    setTurnstileToken(null);
    void props.onSubmit(token).finally(() => setResetKey((value) => value + 1));
  };
  return (
    <form onSubmit={submit} className="w-full max-w-md">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--bronze)]">The Question · 问事</p>
      <h1 className="mt-3 font-display text-3xl font-medium">What would you like clarity on?</h1>
      <div className="mt-8 space-y-5">
        <div>
          <Label htmlFor="scene">Situation</Label>
          <select id="scene" value={props.scene} onChange={(event) => props.onSceneChange(event.target.value)} className={selectClass}>
            {SCENES.map((scene) => <option key={scene} value={scene}>{scene.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="goal">Interpretation goal</Label>
          <select id="goal" value={props.goal} onChange={(event) => props.onGoalChange(event.target.value)} className={selectClass}>
            {INTERPRETATION_GOALS.map((goal) => <option key={goal} value={goal}>{goal.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="context">Your specific situation</Label>
          <Textarea
            id="context"
            rows={4}
            value={props.context}
            onChange={(event) => props.onContextChange(event.target.value)}
            placeholder="Describe the situation without names, addresses, or account numbers."
            maxLength={QUESTION_MAX_CHARS}
          />
          <p className="mt-1 font-mono text-[11px] text-[var(--ink-3)]">
            {props.context.length}/{QUESTION_MAX_CHARS} · min {QUESTION_MIN_CHARS}
          </p>
        </div>
        <TurnstileChallenge action="create_casting" resetKey={resetKey} onToken={setTurnstileToken} />
        <p className="border-l-2 border-[var(--cinnabar)] py-1 pl-4 text-sm text-[var(--ink-2)]">
          Casting is free. Sign in after the ritual to reveal and save the result.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={
            props.pending
            || props.context.length < QUESTION_MIN_CHARS
            || (challengeRequired && !turnstileToken)
          }
        >
          {props.pending ? "Preparing ritual…" : "Begin the ritual"}
        </Button>
      </div>
    </form>
  );
}
