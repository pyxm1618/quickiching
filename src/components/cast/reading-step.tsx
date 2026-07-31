"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TurnstileChallenge } from "@/components/security/turnstile-challenge";

export function ReadingStep(props: {
  previewText: string | null;
  readingReport: Record<string, unknown> | null;
  pending: boolean;
  onPreview(turnstileToken?: string): Promise<void>;
  onReading(turnstileToken?: string): Promise<void>;
}) {
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [readingToken, setReadingToken] = useState<string | null>(null);
  const [previewResetKey, setPreviewResetKey] = useState(0);
  const [readingResetKey, setReadingResetKey] = useState(0);
  const challengeRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const generatePreview = () => {
    if (challengeRequired && !previewToken) return;
    const token = previewToken ?? undefined;
    setPreviewToken(null);
    void props.onPreview(token).finally(() => setPreviewResetKey((value) => value + 1));
  };

  const generateReading = () => {
    if (challengeRequired && !readingToken) return;
    const token = readingToken ?? undefined;
    setReadingToken(null);
    void props.onReading(token).finally(() => setReadingResetKey((value) => value + 1));
  };

  return (
    <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-display text-lg font-medium">Your fixed preview</h3>
          {props.previewText ? (
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">{props.previewText}</p>
          ) : (
            <>
              <TurnstileChallenge
                action="generate_preview"
                resetKey={previewResetKey}
                onToken={setPreviewToken}
              />
              <Button
                onClick={generatePreview}
                disabled={props.pending || (challengeRequired && !previewToken)}
                size="sm"
                className="mt-3"
              >
                {props.pending ? "Generating…" : "Generate preview"}
              </Button>
            </>
          )}
          <p className="mt-4 font-mono text-[10.5px] uppercase text-[var(--ink-3)]">Fixed for this casting</p>
        </CardContent>
      </Card>
      <div className="rounded-lg bg-[#221c12] p-6 text-[#f0e7d2]">
        <h3 className="font-display text-lg font-medium">Deep reading</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[#c9bb9c]">
          Ten validated modules tied to the immutable casting snapshot.
        </p>
        {!props.readingReport && (
          <>
            <TurnstileChallenge
              action="generate_reading"
              resetKey={readingResetKey}
              onToken={setReadingToken}
            />
            <div className="mt-4 flex items-center gap-4">
              <Button
                onClick={generateReading}
                disabled={props.pending || (challengeRequired && !readingToken)}
                size="sm"
              >
                {props.pending ? "Generating…" : "Use 1 credit"}
              </Button>
              <Link href="/pricing" className="text-sm font-medium text-[#d9a95c] hover:underline">Need credits?</Link>
            </div>
          </>
        )}
      </div>
      {props.readingReport && (
        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <h3 className="font-display text-lg font-medium">Deep reading</h3>
            <dl className="mt-4 space-y-5">
              {Object.entries(props.readingReport)
                .filter(([, value]) => typeof value === "string")
                .map(([key, value]) => (
                  <div key={key}>
                    <dt className="font-display font-medium">{key.replace(/([A-Z])/g, " $1").trim()}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-[var(--ink-2)]">{String(value)}</dd>
                  </div>
                ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
