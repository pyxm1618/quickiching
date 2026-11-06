import { ResultRitualStyles } from "@/components/public-reading/result-ritual-styles";
import { visualRuntimeAssets } from "@/lib/visual-runtime-assets";
import { getCurrentUser } from "@/lib/auth/session";
import { loadCastingView, loadEntitlementBalance } from "@/server/loaders";
import { ReadingResultClient } from "@/components/reading-result/reading-result-client";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import { zhHansReadingContentFor } from "@/content/mei-hua-yi-shu/zh-Hans";
import {
  normalizeDeepReadingContext,
  normalizeDeepReadingViewModel,
} from "@/domain/generation/deep-reading-view-model";

// Both pages and all methods share this owner-scoped loader and client.
export async function ReadingPage({ searchParams, locale = "en", pageMode = "free" }: {
  searchParams?: Promise<{ session?: string }>;
  locale?: "en" | "zh-Hans";
  pageMode?: "free" | "deep";
}) {
  const query = searchParams ? await searchParams : undefined;
  const sessionId = query?.session?.trim() || undefined;
  const user = await getCurrentUser({ allowUnavailable: true });
  const [balance, castingView] = await Promise.all([
    user ? loadEntitlementBalance() : Promise.resolve({ available: 0, expiringSoon: 0 }),
    sessionId ? loadCastingView(sessionId) : Promise.resolve(null),
  ]);
  const result = castingView?.result;
  const initialInterpretationBundles = result ? {
    primary: await loadHexagramInterpretation(result.primaryHexagramNumber),
    relating: result.relatingHexagramNumber === null ? null : await loadHexagramInterpretation(result.relatingHexagramNumber),
  } : undefined;
  const initialLocalizedContent = locale === "zh-Hans" && result ? zhHansReadingContentFor([
    result.primaryHexagramNumber,
    ...(result.relatingHexagramNumber === null ? [] : [result.relatingHexagramNumber]),
  ]) : undefined;
  const initialDeepReadingViewModel = castingView?.reading?.report
    ? normalizeDeepReadingViewModel(castingView.reading.report, castingView.reading.snapshot)
    : null;
  const initialDeepReadingContext = normalizeDeepReadingContext(castingView?.reading?.snapshot);
  const client = <ReadingResultClient pageMode={pageMode} locale={locale} initialSessionId={sessionId}
    initialUser={user ? {id:user.id,email:user.email} : null} initialCredits={balance.available}
    initialInterpretationBundles={initialInterpretationBundles} initialLocalizedContent={initialLocalizedContent}
    initialCastingView={castingView ? {
      castingId: castingView.session.id, method: castingView.session.method,
      algorithmVersion: result?.algorithmVersion, methodCalculation: result?.methodCalculation,
      createdAt: castingView.session.createdAt.toISOString(),
      context: castingView.context, lineValuesBottomUp: result?.lineValues ?? null,
      deepReadingViewModel: initialDeepReadingViewModel,
      deepReadingContext: initialDeepReadingContext,
      owns: castingView.owns,
    } : null} />;

  if (pageMode === "deep") return <><ResultRitualStyles />{client}</>;

  return <>
    <ResultRitualStyles />
    <div data-realm="chamber" className="ritual-result-scene">
    <link rel="preload" as="image" href={visualRuntimeAssets.resultDesktop} media="(min-width:801px)" fetchPriority="high" />
    <link rel="preload" as="image" href={visualRuntimeAssets.resultMobile} media="(max-width:800px)" fetchPriority="high" />
    <link rel="preload" as="image" href="/navigation/scroll-64-hexagrams-no-text.webp" media="(max-width:800px)" />
    <div className="ritual-room" aria-hidden="true" />
    {client}
    </div>
  </>;
}
