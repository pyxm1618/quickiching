import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { buildBasicReading } from "@/domain/interpretation/basic";
import { lineStructureDescription } from "@/domain/casting/hexagrams/compute";
import { getCurrentUser } from "@/lib/auth/session";
import { isPaidDeepReadingCapabilityEnabled } from "@/server/generation/deep-reading-capability";
import { createProductionReadingPageReader, type ReadingPageView } from "@/server/casting/reading-page-reader";
import { formatDate } from "@/lib/utils";
import { DeepReadingPanel } from "./deep-reading-panel";

export const metadata: Metadata = {
  title: "Your reading",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = {
  three_coin: "Three Coin",
  yarrow_stalk: "Yarrow Stalk",
  mei_hua_current_time: "Mei Hua Yi Shu",
};

const SCENE_LABEL: Record<string, string> = {
  career: "Career",
  relationships: "Relationships",
  wealth: "Wealth",
  timing: "Timing",
  choices: "Choices",
  personal_growth: "Personal growth",
  other: "Other",
};

function labelled(table: Record<string, string>, key: string): string {
  return table[key] ?? key.replace(/_/gu, " ");
}

/**
 * States plainly where the six line values came from. A cast the browser made
 * and submitted is not the same evidence as one produced under our control, and
 * saying so is cheaper than pretending otherwise.
 */
function ProvenanceNote({ origin }: { origin: ReadingPageView["castOrigin"] }) {
  if (origin === "client_attested") {
    return (
      <p className="mt-3 text-xs leading-6 text-[var(--ink-3)]">
        This cast was generated in your browser and submitted here. We recomputed the hexagram, moving
        lines and relating hexagram from the six line values you sent, but we cannot vouch for how those
        values were drawn.
      </p>
    );
  }
  return (
    <p className="mt-3 text-xs leading-6 text-[var(--ink-3)]">
      The six line values for this cast were produced on our server.
    </p>
  );
}

export default async function ReadingPage({
  params,
}: {
  params: Promise<{ castingId: string }>;
}) {
  if (!isPaidDeepReadingCapabilityEnabled()) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { castingId } = await params;

  let view: ReadingPageView | null;
  try {
    const reader = await createProductionReadingPageReader();
    view = await reader.readForUser(user.id, castingId);
  } catch {
    // An unreadable store is said out loud rather than shown as an empty reading.
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-[clamp(1.8rem,2.6vw,2.4rem)] font-medium tracking-[-0.015em]">Your reading</h1>
        <Card className="mt-8"><CardContent className="pt-6">
          <p className="font-display text-lg font-medium">This reading can’t be loaded right now</p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
            This is a temporary problem reading your records — nothing about your cast or your credits has changed.
            Please refresh in a moment.
          </p>
        </CardContent></Card>
      </div>
    );
  }

  if (!view) notFound();

  const basic = buildBasicReading(view.facts);
  const report = view.deepReading.state === "ready" ? view.deepReading.report : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">
        {labelled(METHOD_LABEL, view.method)} · {labelled(SCENE_LABEL, view.scene)} · {formatDate(view.createdAt)}
      </p>
      <h1 className="mt-3 font-display text-[clamp(1.8rem,2.6vw,2.4rem)] font-medium tracking-[-0.015em]">
        {basic.primary.number} · {basic.primary.englishName}
        {basic.relating ? <> → {basic.relating.number} · {basic.relating.englishName}</> : null}
      </h1>

      <Card className="mt-6"><CardContent className="pt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">The cast</p>
        <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{lineStructureDescription(view.facts)}</p>
        <p className="mt-2 font-mono text-xs text-[var(--ink-3)]">
          {view.facts.algorithmVersion} · {view.facts.classicMappingVersion}
        </p>
        <ProvenanceNote origin={view.castOrigin} />
      </CardContent></Card>

      <h2 className="mt-10 font-display text-xl font-medium tracking-[-0.01em]">Free interpretation</h2>
      <p className="mt-1.5 text-xs leading-6 text-[var(--ink-3)]">
        The same static reading every visitor gets for this hexagram — it does not use your question.
      </p>
      <Card className="mt-4"><CardContent className="pt-6">
        <p className="font-display text-base font-medium">{basic.primaryInterpretation.theme}</p>
        <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{basic.primaryInterpretation.summary}</p>
        <p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">{basic.changeExplanation}</p>
        {basic.relating && basic.relatingInterpretation ? (
          <>
            <p className="mt-4 font-display text-base font-medium">
              Relating: {basic.relating.englishName} — {basic.relatingInterpretation.theme}
            </p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-2)]">{basic.relatingInterpretation.summary}</p>
          </>
        ) : null}
      </CardContent></Card>

      <h2 className="mt-12 font-display text-xl font-medium tracking-[-0.01em]">Deep reading</h2>
      <DeepReadingPanel
        castingId={view.castingId}
        locale="en"
        initialReport={report}
        initialUnreadable={view.deepReading.state === "unreadable"}
        riskBlocked={view.riskStatus !== "allowed"}
      />

      <p className="mt-10 text-sm leading-7 text-[var(--ink-2)]">
        <Link href="/account" className="font-semibold text-[var(--jade)] hover:underline">Back to my account</Link>.
      </p>
    </div>
  );
}
