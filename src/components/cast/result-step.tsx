"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { HexagramDisplay } from "@/components/cast/hexagram-display";
import { ReadingStep } from "./reading-step";
import type { CastingSnapshot } from "@/server/services/casting-snapshot-service";

export function ResultStep(props: {
  result: NonNullable<CastingSnapshot["result"]>;
  riskStatus: string;
  previewStatus: string;
  previewText: string | null;
  readingStatus: string;
  readingReport: Record<string, unknown> | null;
  pending: boolean;
  onPreview(): Promise<void>;
  onReading(): Promise<void>;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-6 flex justify-between font-mono text-[11px] uppercase text-[var(--ink-3)]">
        <span>Ritual complete · Revealed</span>
        <span>{props.result.algorithmVersion} · {props.result.classicMappingVersion}</span>
      </div>
      <HexagramDisplay
        lineValues={props.result.lineValues}
        primaryName={props.result.primaryName}
        primaryNumber={props.result.primaryNumber}
        movingLinePositions={props.result.movingLinePositions}
        relatingName={props.result.relatingName}
        relatingNumber={props.result.relatingNumber}
        algorithmVersion={props.result.algorithmVersion}
        classicMappingVersion={props.result.classicMappingVersion}
      />
      {props.riskStatus === "professional_decision_blocked" ? (
        <Card className="mt-6 border-l-4 border-l-[var(--jade)]">
          <CardContent className="pt-6">
            <h3 className="font-display text-lg font-medium">Personalized generation is unavailable</h3>
            <p className="mt-2 text-sm text-[var(--ink-2)]">
              The classic-only result remains available, but this product does not personalize medical, legal, or specific investment decisions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ReadingStep
          previewStatus={props.previewStatus}
          previewText={props.previewText}
          readingStatus={props.readingStatus}
          readingReport={props.readingReport}
          pending={props.pending}
          onPreview={props.onPreview}
          onReading={props.onReading}
        />
      )}
      <div className="mt-8 text-center">
        <Link href="/account" className="text-sm font-medium text-[var(--jade)] hover:underline">View in my history →</Link>
      </div>
    </div>
  );
}
