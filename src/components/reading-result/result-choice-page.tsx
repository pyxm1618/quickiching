import "@/components/public-reading/ritual.css";
import { ResultChoiceClient } from "@/components/reading-result/result-choice-client";
import { visualRuntimeAssets } from "@/lib/visual-runtime-assets";

export async function ResultChoicePage({
  searchParams,
  locale = "en",
}: {
  searchParams?: Promise<{ session?: string }>;
  locale?: "en" | "zh-Hans";
}) {
  const query = searchParams ? await searchParams : undefined;
  const sessionId = query?.session?.trim() || undefined;

  return (
    <div data-realm="chamber" className="ritual-result-scene" data-result-choice-page>
      <link rel="preload" as="image" href={visualRuntimeAssets.resultDesktop} media="(min-width:801px)" fetchPriority="high" />
      <link rel="preload" as="image" href={visualRuntimeAssets.resultMobile} media="(max-width:800px)" fetchPriority="high" />
      <div className="ritual-room" aria-hidden="true" />
      <ResultChoiceClient initialSessionId={sessionId} locale={locale} />
    </div>
  );
}
