"use client";

import { useEffect } from "react";
import type { CastingMethod } from "@/domain/casting/types";
import { SealMark } from "@/components/hex/seal-mark";
import { QuestionStep } from "./question-step";
import { RitualStep } from "./ritual-step";
import { RevealStep } from "./reveal-step";
import { ResultStep } from "./result-step";
import { useCastingController } from "./use-casting-controller";

const METHOD_META: Record<CastingMethod, { en: string; zh: string }> = {
  three_coin: { en: "Three-Coin Method", zh: "三枚铜钱" },
  yarrow_stalk: { en: "Yarrow Stalk Method", zh: "蓍草" },
  mei_hua_current_time: { en: "Mei Hua Yi Shu", zh: "梅花易数" },
};

function CrisisStep() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <div className="rounded-lg border-l-4 border-[var(--danger)] bg-[var(--paper-raised)] p-8">
        <h1 className="font-display text-2xl font-medium">Please reach out for support</h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--ink-2)]">
          If you are thinking about harming yourself or someone else, contact local emergency services or an approved crisis resource now. This ritual is paused and is not a substitute for professional care.
        </p>
      </div>
    </div>
  );
}

function ExpiredStep() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-medium">This casting has expired</h1>
      <p className="mt-3 text-sm text-[var(--ink-2)]">Its server deadline has passed. Start a new casting rather than replaying old browser state.</p>
    </div>
  );
}

export function CastingWizard({ method }: { method: CastingMethod }) {
  const controller = useCastingController(method);
  const { state } = controller;
  const chamber = ["input", "ritual", "reveal"].includes(state.phase);

  useEffect(() => {
    if (!chamber) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [chamber]);

  if (state.phase === "result" && state.result) {
    return (
      <ResultStep
        result={state.result}
        riskStatus={state.riskStatus}
        previewText={state.previewText}
        readingReport={state.readingReport}
        pending={state.pending}
        onPreview={controller.generatePreview}
        onReading={controller.generateReading}
      />
    );
  }
  if (state.phase === "crisis") return <CrisisStep />;
  if (state.phase === "expired") return <ExpiredStep />;

  return (
    <div data-realm="chamber" className="chamber-bg fixed inset-0 z-50 overflow-y-auto text-[var(--ink)]">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5">
        <header className="flex items-center justify-between py-5 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]">
          <span className="flex items-center gap-2.5">
            <SealMark size="sm" />
            <span>{METHOD_META[method].en} · <span className="font-cjk normal-case">{METHOD_META[method].zh}</span></span>
          </span>
          <span>{state.castingId ? "Question sealed ✓" : "Preparing"}</span>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center py-8">
          {state.error && (
            <div className="mb-6 w-full max-w-md rounded border border-[var(--danger)] bg-[var(--danger-wash)] px-4 py-3 text-sm text-[var(--danger)]">
              {state.error}
            </div>
          )}
          {state.phase === "input" && (
            <QuestionStep
              scene={state.scene}
              goal={state.goal}
              context={state.context}
              pending={state.pending}
              onSceneChange={controller.setScene}
              onGoalChange={controller.setGoal}
              onContextChange={controller.setContext}
              onSubmit={controller.submitQuestion}
            />
          )}
          {state.phase === "ritual" && (
            <RitualStep
              method={method}
              scene={state.scene}
              goal={state.goal}
              completedSteps={state.completedSteps}
              totalSteps={state.totalSteps || (method === "three_coin" ? 6 : method === "yarrow_stalk" ? 18 : 1)}
              timeZone={state.ianaTimeZone}
              pending={state.pending}
              onTimeZoneChange={controller.setTimeZone}
              onCast={controller.castNext}
            />
          )}
          {state.phase === "reveal" && <RevealStep pending={state.pending} onReveal={controller.reveal} />}
        </div>
        <footer className="py-5 text-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--line-strong)]">
          For entertainment, cultural exploration, and self-reflection only
        </footer>
      </div>
    </div>
  );
}
