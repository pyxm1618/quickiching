"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startDeepReadingAction, startPreviewAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TurnstileChallenge } from "@/components/security/turnstile-challenge";

export function ResultReadingControls(props: {
  castingId: string;
  isAuthed: boolean;
  previewStatus: string | null;
  readingStatus: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [readingToken, setReadingToken] = useState<string | null>(null);
  const [previewResetKey, setPreviewResetKey] = useState(0);
  const [readingResetKey, setReadingResetKey] = useState(0);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const challengeRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const previewComplete = props.previewStatus === "completed";
  const readingComplete = props.readingStatus === "completed";

  useEffect(() => {
    if (!polling || (previewComplete && readingComplete)) return;
    const interval = window.setInterval(() => router.refresh(), 1800);
    const timeout = window.setTimeout(() => setPolling(false), 60_000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [polling, previewComplete, readingComplete, router]);

  useEffect(() => {
    if (previewComplete || readingComplete) setPolling(false);
  }, [previewComplete, readingComplete]);

  function generatePreview() {
    if (challengeRequired && !previewToken) return;
    const token = previewToken ?? undefined;
    setPreviewToken(null);
    setError(null);
    startTransition(async () => {
      const result = await startPreviewAction({ castingId: props.castingId, turnstileToken: token });
      setPreviewResetKey((value) => value + 1);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setPolling(true);
      router.refresh();
    });
  }

  function generateReading() {
    if (challengeRequired && !readingToken) return;
    const token = readingToken ?? undefined;
    setReadingToken(null);
    setError(null);
    startTransition(async () => {
      const result = await startDeepReadingAction({ castingId: props.castingId, turnstileToken: token });
      setReadingResetKey((value) => value + 1);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setPolling(true);
      router.refresh();
    });
  }

  if (previewComplete && readingComplete) return null;
  if (!props.isAuthed) {
    return (
      <Card className="mt-6">
        <CardContent className="pt-6">
          <p className="text-sm text-[var(--ink-2)]">Sign in to generate and reopen your fixed reading.</p>
          <Link
  href={`/signin?callbackURL=${encodeURIComponent(`/result/${props.castingId}`)}`}
  className="mt-3 inline-flex h-9 items-center justify-center rounded bg-[var(--cinnabar)] px-3 text-sm font-semibold text-[var(--primary-foreground)]"
>
  Sign in
</Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
      {!previewComplete && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-display text-lg font-medium">Free fixed preview</h3>
            <p className="mt-1.5 text-sm text-[var(--ink-3)]">
              Generate the one permanent preview associated with this casting.
            </p>
            <TurnstileChallenge
              action="generate_preview"
              resetKey={previewResetKey}
              onToken={setPreviewToken}
            />
            <Button
              size="sm"
              className="mt-3"
              disabled={isPending || polling || (challengeRequired && !previewToken)}
              onClick={generatePreview}
            >
              {isPending || polling ? "Generating…" : "Generate preview"}
            </Button>
          </CardContent>
        </Card>
      )}
      {!readingComplete && (
        <div className="rounded-lg bg-[#221c12] p-6 text-[#f0e7d2]">
          <h3 className="font-display text-lg font-medium">Deep reading</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[#c9bb9c]">
            Ten validated modules tied to the immutable casting snapshot. Generation consumes one credit only after successful delivery.
          </p>
          <TurnstileChallenge
            action="generate_reading"
            resetKey={readingResetKey}
            onToken={setReadingToken}
          />
          <div className="mt-4 flex items-center gap-4">
            <Button
              size="sm"
              disabled={isPending || polling || (challengeRequired && !readingToken)}
              onClick={generateReading}
            >
              {isPending || polling ? "Generating…" : "Use 1 credit"}
            </Button>
            <Link href="/pricing" className="text-sm font-medium text-[#d9a95c] hover:underline">
              Need credits?
            </Link>
          </div>
        </div>
      )}
      {error && (
        <p className="text-sm text-[var(--danger)] md:col-span-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
