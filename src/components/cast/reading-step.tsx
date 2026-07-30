"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const ACTIVE = new Set(["queued", "reserved", "generating", "validating"]);

export function ReadingStep(props: {
  previewStatus: string;
  previewText: string | null;
  readingStatus: string;
  readingReport: Record<string, unknown> | null;
  pending: boolean;
  onPreview(): Promise<void>;
  onReading(): Promise<void>;
}) {
  const previewActive = ACTIVE.has(props.previewStatus);
  const readingActive = ACTIVE.has(props.readingStatus);
  return (
    <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-display text-lg font-medium">Your fixed preview</h3>
          {props.previewText ? (
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">{props.previewText}</p>
          ) : previewActive ? (
            <p className="mt-3 text-sm text-[var(--ink-2)]">Generation is running from the sealed server snapshot. This page will update automatically.</p>
          ) : (
            <Button onClick={() => void props.onPreview()} disabled={props.pending} size="sm" className="mt-3">
              {props.pending ? "Submitting…" : "Generate preview"}
            </Button>
          )}
          <p className="mt-4 font-mono text-[10.5px] uppercase text-[var(--ink-3)]">Fixed for this casting · {props.previewStatus.replaceAll("_", " ")}</p>
        </CardContent>
      </Card>
      <div className="rounded-lg bg-[#221c12] p-6 text-[#f0e7d2]">
        <h3 className="font-display text-lg font-medium">Deep reading</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[#c9bb9c]">
          Ten validated modules tied to the immutable casting snapshot.
        </p>
        {!props.readingReport && (
          readingActive ? (
            <p className="mt-4 text-sm text-[#c9bb9c]">Your credit is reserved while the durable workflow generates and validates the report. It is consumed only after completion.</p>
          ) : (
            <div className="mt-4 flex items-center gap-4">
              <Button onClick={() => void props.onReading()} disabled={props.pending} size="sm">
                {props.pending ? "Submitting…" : "Use 1 credit"}
              </Button>
              <Link href="/pricing" className="text-sm font-medium text-[#d9a95c] hover:underline">Need credits?</Link>
            </div>
          )
        )}
        <p className="mt-4 font-mono text-[10.5px] uppercase text-[#8f8063]">{props.readingStatus.replaceAll("_", " ")}</p>
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
