"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { CastingMethod } from "@/domain/casting/types";

function Progress({ total, completed }: { total: number; completed: number }) {
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-1.5" aria-label={`${completed} of ${total} completed`}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={`h-[3px] w-5 rounded-full ${index < completed ? "bg-[var(--bronze)]" : "bg-[var(--line)]"}`} />
      ))}
    </div>
  );
}

export function RitualStep(props: {
  method: CastingMethod;
  scene: string;
  goal: string;
  completedSteps: number;
  totalSteps: number;
  timeZone: string;
  pending: boolean;
  onTimeZoneChange(value: string): void;
  onCast(): Promise<void>;
}) {
  const complete = props.completedSteps >= props.totalSteps;
  const label = props.method === "three_coin"
    ? `Cast line ${Math.min(props.completedSteps + 1, 6)} of 6`
    : props.method === "yarrow_stalk"
      ? `Divide stalks · change ${Math.min(props.completedSteps + 1, 18)} of 18`
      : "Cast with the current time";
  return (
    <div className="flex w-full max-w-md flex-col items-center text-center">
      <div className="mb-8 flex flex-wrap justify-center gap-2 font-mono text-[11px] text-[var(--ink-3)]">
        <span className="rounded-full border border-[var(--line)] px-3 py-1">{props.scene.replace(/_/g, " ")}</span>
        <span className="py-1">{props.goal.replace(/_/g, " ")}</span>
      </div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--bronze)]">
        {complete ? "Ritual complete" : label}
      </p>
      <p className="mt-7 max-w-sm text-sm leading-relaxed text-[var(--ink-2)]">
        Every irreversible step is committed on the server before the interface advances. Hidden line values are not stored in the browser.
      </p>
      {props.method === "mei_hua_current_time" && (
        <div className="mt-6 w-full rounded border border-[var(--line)] bg-[var(--paper-raised)] p-5 text-left">
          <Label htmlFor="tz">Your timezone (IANA)</Label>
          <Input id="tz" value={props.timeZone} onChange={(event) => props.onTimeZoneChange(event.target.value)} />
        </div>
      )}
      <Button onClick={() => void props.onCast()} disabled={props.pending || complete} size="lg" className="mt-8">
        {props.pending ? "Sealing…" : complete ? "Completed" : label}
      </Button>
      <Progress total={props.totalSteps} completed={props.completedSteps} />
    </div>
  );
}
