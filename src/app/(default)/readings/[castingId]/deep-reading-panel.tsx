"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { readingReportV2Schema, type CommercialReadingReportV2 } from "@/domain/generation/schemas";
import { rememberDeepReadingIntent } from "@/lib/checkout/pending-intent";
import { DeepReadingReport } from "./deep-reading-report";

type Phase =
  | "idle"
  | "starting"
  | "working"
  | "done"
  | "needs_credits"
  | "prohibited"
  | "not_ready"
  | "failed"
  | "signed_out";

const POLL_BASE_MS = 2_000;
const POLL_MAX_MS = 10_000;
/** How long before we stop watching and tell the reader to come back. */
const POLL_DEADLINE_MS = 10 * 60_000;
/** When a generation has run this long, say so rather than looking stuck. */
const SLOW_AFTER_MS = 90_000;

function pollDelayMs(attempt: number): number {
  return Math.min(Math.round(POLL_BASE_MS * Math.pow(1.4, Math.max(0, attempt - 1))), POLL_MAX_MS);
}

function elapsedLabel(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

/** Only a report that validates is rendered; a malformed one is reported as such. */
function parseReport(output: unknown): CommercialReadingReportV2 | null {
  const parsed = readingReportV2Schema.safeParse(output);
  return parsed.success ? parsed.data : null;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body = await response.json();
    return body && typeof body === "object" ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function DeepReadingPanel({
  castingId,
  locale,
  initialReport,
  initialUnreadable,
  riskBlocked,
}: {
  castingId: string;
  locale: "en" | "zh-Hans";
  initialReport: CommercialReadingReportV2 | null;
  initialUnreadable: boolean;
  riskBlocked: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(initialReport ? "done" : riskBlocked ? "prohibited" : "idle");
  const [report, setReport] = useState<CommercialReadingReportV2 | null>(initialReport);
  const [message, setMessage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number>(0);
  const watchingRef = useRef(false);

  const applyOutput = useCallback((output: unknown): boolean => {
    const parsed = parseReport(output);
    if (!parsed) {
      setPhase("failed");
      setMessage("The reading finished but could not be displayed. It has not been lost — please reload, and contact us if it keeps happening.");
      return true;
    }
    setReport(parsed);
    setPhase("done");
    return true;
  }, []);

  // Watches an in-flight generation. Separate from starting it so that a page
  // reloaded mid-generation picks the watch back up.
  const watch = useCallback(() => {
    if (watchingRef.current) return;
    watchingRef.current = true;
    startedAtRef.current = Date.now();
    setElapsedMs(0);

    let cancelled = false;
    const controller = new AbortController();
    const tick = setInterval(() => {
      if (!cancelled) setElapsedMs(Date.now() - startedAtRef.current);
    }, 1_000);

    void (async () => {
      for (let attempt = 1; !cancelled; attempt += 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, pollDelayMs(attempt)));
        if (cancelled) return;

        let response: Response;
        try {
          response = await fetch(`/api/readings/${encodeURIComponent(castingId)}/deep`, {
            credentials: "same-origin",
            cache: "no-store",
            headers: { accept: "application/json", "x-quickiching-locale": locale },
            signal: controller.signal,
          });
        } catch {
          // A dropped request is not an answer; keep waiting until the deadline.
          if (Date.now() - startedAtRef.current > POLL_DEADLINE_MS) break;
          continue;
        }
        if (cancelled) return;

        if (response.status === 401) {
          setPhase("signed_out");
          break;
        }
        const body = await readJson(response);
        const status = String(body.status ?? "");

        if (status === "completed") {
          applyOutput(body.output);
          break;
        }
        if (status === "failed" || status === "timed_out" || status === "dead_letter") {
          setPhase("failed");
          setMessage("The reading did not finish. Your credit has not been spent on a failed run — you can try again.");
          break;
        }
        if (Date.now() - startedAtRef.current > POLL_DEADLINE_MS) {
          setPhase("working");
          setMessage("Still generating. You can leave this page and come back — the reading continues on our side.");
          break;
        }
      }
      clearInterval(tick);
      watchingRef.current = false;
    })();

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(tick);
      watchingRef.current = false;
    };
  }, [applyOutput, castingId, locale]);

  useEffect(() => {
    if (phase !== "working") return;
    return watch();
  }, [phase, watch]);

  async function start() {
    if (phase === "starting" || phase === "working") return;
    setPhase("starting");
    setMessage(null);

    let response: Response;
    try {
      response = await fetch(`/api/readings/${encodeURIComponent(castingId)}/deep`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-quickiching-locale": locale },
      });
    } catch {
      setPhase("failed");
      setMessage("The reading could not be started. No credit was spent.");
      return;
    }

    const body = await readJson(response);

    if (response.ok || response.status === 202) {
      if (String(body.status ?? "") === "completed" && body.output !== undefined) {
        applyOutput(body.output);
        return;
      }
      setPhase("working");
      return;
    }

    switch (response.status) {
      case 402:
        // Remember where to come back to, then send them to buy.
        rememberDeepReadingIntent(castingId);
        setPhase("needs_credits");
        return;
      case 403:
        setPhase("prohibited");
        return;
      case 422:
        setPhase("not_ready");
        setMessage(String(body.error ?? "") === "CASTING_NOT_READY"
          ? "This cast is not in a state that can be read yet."
          : "The question stored with this cast could not be read, so no reading can be generated from it.");
        return;
      case 401:
        setPhase("signed_out");
        return;
      case 404:
        setPhase("failed");
        setMessage("This cast is no longer available on your account.");
        return;
      default:
        setPhase("failed");
        setMessage("The reading could not be started. No credit was spent — please try again.");
    }
  }

  if (phase === "done" && report) {
    return <DeepReadingReport report={report} />;
  }

  return (
    <Card className="mt-8">
      <CardContent className="pt-6">
        {initialUnreadable && phase !== "working" ? (
          <p className="mb-4 text-sm leading-6 text-[var(--danger)]">
            A deep reading is stored for this cast but does not match the format this site can display.
            It has not been deleted. Please contact us rather than paying again.
          </p>
        ) : null}

        {phase === "idle" ? (
          <>
            <p className="font-display text-lg font-medium">Deep reading</p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">
              Spends one reading credit. The judgement, change rule, classical quotations, Ti-Yong relation
              and line positions are derived from this cast by rule; the interpretation is then written
              around the question you asked.
            </p>
            <Button className="mt-4" onClick={() => void start()}>Generate the deep reading</Button>
          </>
        ) : null}

        {phase === "starting" ? (
          <p className="text-sm leading-6 text-[var(--ink-2)]">Starting…</p>
        ) : null}

        {phase === "working" ? (
          <>
            <p className="font-display text-lg font-medium">Writing your reading</p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">
              {message ?? (elapsedMs > SLOW_AFTER_MS
                ? "This one is taking longer than usual. It is still running — you can leave this page and come back to it."
                : "This takes a little while. The page updates itself when it is ready.")}
            </p>
            <p className="mt-2 font-mono text-xs text-[var(--ink-3)]">Elapsed {elapsedLabel(elapsedMs)}</p>
          </>
        ) : null}

        {phase === "needs_credits" ? (
          <>
            <p className="font-display text-lg font-medium">You have no reading credits left</p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">
              Buy credits and you will be brought straight back to this cast.
            </p>
            <a
              className="mt-4 inline-flex h-11 items-center justify-center rounded bg-[var(--cinnabar)] px-5 text-[15px] font-semibold text-[var(--primary-foreground)] hover:bg-[var(--cinnabar-deep)]"
              href="/pricing"
            >
              See reading credits
            </a>
          </>
        ) : null}

        {phase === "prohibited" ? (
          <>
            <p className="font-display text-lg font-medium">No deep reading is offered for this cast</p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">
              The question recorded with this cast falls outside what we will interpret — it belongs with a
              qualified professional rather than an oracle. No credit has been spent, and the cast above stays yours.
            </p>
          </>
        ) : null}

        {phase === "not_ready" || phase === "failed" ? (
          <>
            <p className="font-display text-lg font-medium">
              {phase === "not_ready" ? "This cast cannot be read" : "The reading did not complete"}
            </p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{message}</p>
            {phase === "failed" ? (
              <Button className="mt-4" variant="outline" onClick={() => void start()}>Try again</Button>
            ) : null}
          </>
        ) : null}

        {phase === "signed_out" ? (
          <p className="text-sm leading-7 text-[var(--ink-2)]">
            You were signed out. <a className="font-semibold text-[var(--jade)] hover:underline" href="/signin">Sign in</a> to continue.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
