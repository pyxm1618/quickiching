"use client";

import { useEffect, useRef, useState } from "react";
import { personalizedInterpretationResponseSchema, PERSONALIZED_REQUEST_SCHEMA_VERSION } from "@/domain/public-reading/personalized";
import { readingFingerprint } from "@/domain/public-reading/reading";
import type { PublicReading } from "@/domain/public-reading/types";
import { TurnstileChallenge, type TurnstileChallengeHandle } from "./turnstile-challenge";

type ViewState = "idle" | "loading" | "success" | "fallback" | "cancelled";
const PERSONALIZED_UI_ENABLED = process.env.NEXT_PUBLIC_PERSONALIZED_INTERPRETATION_ENABLED === "true"
  && Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());

export function PersonalizedInterpretation({ reading }: { reading: PublicReading }) {
  const [state, setState] = useState<ViewState>("idle");
  const [response, setResponse] = useState<ReturnType<typeof personalizedInterpretationResponseSchema.parse> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const turnstileRef = useRef<TurnstileChallengeHandle | null>(null);

  useEffect(() => {
    const challenge = turnstileRef.current;
    abortRef.current?.abort();
    challenge?.cancel();
    abortRef.current = null;
    setState("idle");
    setResponse(null);
    return () => {
      abortRef.current?.abort();
      challenge?.cancel();
    };
  }, [reading.id, reading.question]);

  if (!reading.question) return null;

  async function interpret() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState("loading");
    setResponse(null);

    try {
      const turnstileToken = await turnstileRef.current?.getToken(controller.signal);
      if (controller.signal.aborted) return;
      const result = await fetch("/api/personalized-interpretation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          schemaVersion: PERSONALIZED_REQUEST_SCHEMA_VERSION,
          readingFingerprint: readingFingerprint(reading),
          question: reading.question,
          method: reading.method,
          methodVersion: reading.methodVersion,
          lineValuesBottomUp: reading.lineValuesBottomUp,
          primaryHexagram: reading.primaryHexagram,
          changingLines: reading.changingLines,
          relatingHexagram: reading.relatingHexagram,
          language: "en",
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      });
      if (!result.ok) {
        setState("fallback");
        return;
      }
      const parsed = personalizedInterpretationResponseSchema.safeParse(await result.json() as unknown);
      if (!parsed.success || parsed.data.readingFingerprint !== readingFingerprint(reading)) {
        setState("fallback");
        return;
      }
      setResponse(parsed.data);
      setState("success");
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") setState("cancelled");
      else setState("fallback");
    } finally {
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
    turnstileRef.current?.cancel();
    abortRef.current = null;
    setState("cancelled");
  }

  if (!PERSONALIZED_UI_ENABLED) {
    return (
      <section className="mystic-card-soft mt-5 p-5 sm:p-6" aria-labelledby="personalized-interpretation-title" data-personalized-interpretation data-personalized-disabled>
        <p className="mystic-kicker">Optional · question interpreter</p>
        <h4 id="personalized-interpretation-title" className="mt-2 font-display text-2xl font-normal">Bring the question back in</h4>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-2)]">The optional interpreter is not activated in this environment. Your complete static reading remains available without sending the question anywhere.</p>
      </section>
    );
  }

  return (
    <section className="mystic-card-soft mt-5 p-5 sm:p-6" aria-labelledby="personalized-interpretation-title" data-personalized-interpretation>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mystic-kicker">Optional · question interpreter</p>
          <h4 id="personalized-interpretation-title" className="mt-2 font-display text-2xl font-normal">Bring the question back in</h4>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-2)]">A separate interpreter can reflect on your question using the verified reading facts. It cannot recast, change the hexagrams, or turn the symbols into a prediction. Clicking below sends the full question and reading facts through Vercel AI Gateway to its configured model provider; do not include sensitive information.</p>
        </div>
        <TurnstileChallenge ref={turnstileRef} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {state === "loading" ? (
          <button type="button" onClick={cancel} className="mystic-button-secondary" data-cancel-personalized>Cancel</button>
        ) : (
          <button type="button" onClick={() => void interpret()} className="mystic-button" data-interpret-question>Interpret for my question</button>
        )}
        {state === "loading" ? <span role="status" className="text-sm text-[var(--ink-3)]">Checking the request…</span> : null}
        {state === "cancelled" ? <span role="status" className="text-sm text-[var(--ink-2)]">Cancelled. The complete static reading remains available.</span> : null}
        {state === "fallback" ? <span role="status" className="text-sm text-[var(--ink-2)]">Personalized interpretation is not activated; the complete static reading remains available.</span> : null}
      </div>

      {response ? (
        <div className="mt-7 grid gap-5" data-personalized-response>
          <div><p className="mystic-kicker">Grounded reflection</p><p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{response.summary}</p></div>
          <div className="grid gap-5 md:grid-cols-2">
            <div><h5 className="font-semibold text-[var(--gold-2)]">What supports this</h5><ul className="mt-3 space-y-2 text-sm leading-7 text-[var(--ink-2)]">{response.supports.map((item) => <li key={item} className="border-l border-[var(--gold)]/40 pl-3">{item}</li>)}</ul></div>
            <div><h5 className="font-semibold text-[var(--gold-2)]">What to stay cautious about</h5><ul className="mt-3 space-y-2 text-sm leading-7 text-[var(--ink-2)]">{response.cautions.map((item) => <li key={item} className="border-l border-[var(--cyan)]/40 pl-3">{item}</li>)}</ul></div>
          </div>
          {response.changing ? <div><h5 className="font-semibold text-[var(--gold-2)]">What may be changing</h5><p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{response.changing}</p></div> : null}
          <div><h5 className="font-semibold text-[var(--gold-2)]">Next reflections</h5><ol className="mt-3 grid gap-2 text-sm leading-7 text-[var(--ink-2)] md:grid-cols-3">{response.nextReflections.map((item, index) => <li key={item} className="rounded-xl border border-white/[0.08] p-3"><span className="font-mono text-xs text-[var(--gold-2)]">0{index + 1}</span><p className="mt-1">{item}</p></li>)}</ol></div>
          <p className="border-t border-white/[0.08] pt-4 text-xs leading-6 text-[var(--ink-3)]">{response.disclaimer}</p>
        </div>
      ) : null}
    </section>
  );
}
