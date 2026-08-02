import { notFound } from "next/navigation";
import { loadCastingView } from "@/server/loaders";
import { HexagramDisplay } from "@/components/cast/hexagram-display";
import { DeleteCastButton } from "@/components/cast/delete-cast-button";
import { ResultReadingControls } from "@/components/cast/result-reading-controls";
import { SealMark } from "@/components/hex/seal-mark";
import { Card, CardContent } from "@/components/ui/card";

const MODULE_TITLES: Record<string, string> = {
  coreSummary: "Core Summary",
  currentStage: "Current Stage",
  primaryHexagramPattern: "Primary Hexagram & Current Pattern",
  changeMechanism: "Changing Lines & Mechanism of Change",
  possibleDirection: "Relating Hexagram & Possible Direction",
  obstaclesAndBlindSpots: "Obstacles & Blind Spots",
  turningConditions: "Turning Conditions",
  conditionalActionDirection: "Conditional Direction for Action",
  uncertaintyAndBoundaries: "Uncertainty & Boundaries",
};

export default async function ResultPage({ params }: { params: Promise<{ castingId: string }> }) {
  const { castingId } = await params;
  const view = await loadCastingView(castingId);
  if (!view) notFound();
  if (!view.owns) notFound();

  if (view.session.lifecycle === "discarded_duplicate") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card>
          <CardContent className="pt-6">
            <h1 className="font-display text-lg font-medium">This cast is locked</h1>
            <p className="mt-2 text-sm text-[var(--ink-3)]">
              The same question was already cast within the last 72 hours. It remains available in
              your history under its first result.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!view.result) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card>
          <CardContent className="pt-6">
            <h1 className="font-display text-lg font-medium">Not yet revealed</h1>
            <p className="mt-2 text-sm text-[var(--ink-3)]">
              This casting has not been completed or revealed yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const r = view.result;

  return (
    <div data-clarity-mask="true" className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink-3)]">
        <span>Ritual complete · Revealed</span>
        <span>
          {r.algorithmVersion} · {r.classicMappingVersion}
        </span>
      </div>

      <HexagramDisplay
        lineValues={r.lineValues}
        primaryName={r.primaryName}
        primaryNumber={r.primaryHexagramNumber}
        movingLinePositions={r.movingLinePositions}
        relatingName={r.relatingName}
        relatingNumber={r.relatingHexagramNumber}
        algorithmVersion={r.algorithmVersion}
        classicMappingVersion={r.classicMappingVersion}
      />

      <ResultReadingControls
        castingId={castingId}
        isAuthed={view.isAuthed}
        previewStatus={view.preview?.status ?? null}
        readingStatus={view.reading?.status ?? null}
      />

      {view.preview?.relevanceStatement && (
        <Card className="relative mt-6">
          <div className="absolute -top-3 right-5">
            <SealMark char="固" size="sm" tilt />
          </div>
          <CardContent className="pt-6">
            <h3 className="font-display text-lg font-medium">Your fixed preview</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">{view.preview.relevanceStatement}</p>
            <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--ink-3)]">
              Fixed for this hexagram · refreshing will not rewrite it
            </p>
          </CardContent>
        </Card>
      )}

      {view.reading?.report && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <h3 className="font-display text-lg font-medium">Deep reading</h3>
            <div className="mt-4 space-y-5">
              {Object.entries(view.reading.report)
                .filter(([k]) => k !== "readingVariant" && k !== "interpretiveBasisReferences")
                .map(([key, value]) => (
                  <div key={key}>
                    <h4 className="font-display text-[15px] font-medium">{MODULE_TITLES[key] ?? key}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--ink-2)]">{String(value)}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 flex justify-end">
        <DeleteCastButton castingId={castingId} />
      </div>
    </div>
  );
}
