import "@/components/public-reading/ritual.css";
import { visualRuntimeAssets } from "@/lib/visual-runtime-assets";
import { getCurrentUser } from "@/lib/auth/session";
import { loadCastingView, loadEntitlementBalance } from "@/server/loaders";
import { ThreeCoinResultClient } from "./three-coin-result-client";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import { zhHansReadingContentFor } from "@/content/mei-hua-yi-shu/zh-Hans";

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
  const client = <ThreeCoinResultClient pageMode={pageMode} locale={locale} initialSessionId={sessionId}
    initialUser={user ? {id:user.id,email:user.email} : null} initialCredits={balance.available}
    initialInterpretationBundles={initialInterpretationBundles} initialLocalizedContent={initialLocalizedContent}
    initialCastingView={castingView ? {
      castingId: castingView.session.id, method: castingView.session.method,
      algorithmVersion: result?.algorithmVersion, createdAt: castingView.session.createdAt.toISOString(),
      context: castingView.context, lineValuesBottomUp: result?.lineValues ?? null,
      readingReport: castingView.reading?.report ?? null, deepSnapshot: castingView.reading?.snapshot ?? null,
      owns: castingView.owns,
    } : null} />;

  if (pageMode === "deep") return client;

  return <div data-realm="chamber" className="ritual-result-scene">
    <link rel="preload" as="image" href={visualRuntimeAssets.resultDesktop} media="(min-width:801px)" fetchPriority="high" />
    <link rel="preload" as="image" href={visualRuntimeAssets.resultMobile} media="(max-width:800px)" fetchPriority="high" />
    <div className="ritual-room" aria-hidden="true" />
    {client}
  </div>;
}
