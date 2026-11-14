import "@/components/public-reading/ritual.css";
import { ResultChoiceClient } from "@/components/reading-result/result-choice-client";
import { loadCastingView } from "@/server/loaders";
import {
  normalizeReadingSessionId,
  publicReadingFromServerCast,
  publicReadingMethodFromInternal,
} from "@/lib/reading-identity";
import type { PublicReading } from "@/domain/public-reading/types";
import { visualRuntimeAssets } from "@/lib/visual-runtime-assets";

const RESULT_CHOICE_PRELOADS = [
  "/result-choice/question-banner.avif",
  "/result-choice/primary-stone.avif",
  "/result-choice/taiji-transition.avif",
  "/result-choice/changing-stone.avif",
] as const;

export async function ResultChoicePage({
  searchParams,
  locale = "en",
}: {
  searchParams?: Promise<{ session?: string }>;
  locale?: "en" | "zh-Hans";
}) {
  const query = searchParams ? await searchParams : undefined;
  const sessionId = normalizeReadingSessionId(query?.session);

  // C3 / §18: exact owner-scoped server A is the first authority for Choice.
  let initialReading: PublicReading | undefined;
  if (sessionId) {
    const castingView = await loadCastingView(sessionId);
    const result = castingView?.result;
    if (castingView?.owns && result && Array.isArray(result.lineValues) && result.lineValues.length === 6) {
      try {
        initialReading = publicReadingFromServerCast({
          castingId: castingView.session.id,
          createdAt: castingView.session.createdAt.toISOString(),
          method: publicReadingMethodFromInternal(castingView.session.method),
          methodVersion: result.algorithmVersion,
          question: castingView.context || undefined,
          lineValuesBottomUp: result.lineValues,
          methodCalculation: result.methodCalculation,
          internalMethod: castingView.session.method,
        });
      } catch {
        initialReading = undefined;
      }
    }
  }

  return (
    <div data-realm="chamber" className="ritual-result-scene" data-result-choice-page>
      <link rel="preload" as="image" href={visualRuntimeAssets.stageDesktop} media="(min-width:801px)" fetchPriority="high" />
      {RESULT_CHOICE_PRELOADS.map((href) => (
        <link key={href} rel="preload" as="image" href={href} fetchPriority="high" />
      ))}
      <div className="ritual-room" aria-hidden="true" />
      <ResultChoiceClient initialSessionId={sessionId} initialReading={initialReading} locale={locale} />
    </div>
  );
}
