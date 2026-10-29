import "@/components/public-reading/ritual.css";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { loadCastingView, loadEntitlementBalance } from "@/server/loaders";
import { ThreeCoinResultClient } from "@/components/three-coin-result/three-coin-result-client";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import { zhHansReadingContentFor } from "@/content/mei-hua-yi-shu/zh-Hans";

export const metadata: Metadata = {
  title: "三枚铜钱起卦结果 | Quick I Ching",
  description: "从当前浏览器会话或账户记录恢复本次三枚铜钱起卦的六爻、本卦、动爻、之卦与可选深度解读。",
  robots: { index: false, follow: true },
  openGraph: {
    title: "三枚铜钱起卦结果 | Quick I Ching",
    description: "私密的三枚铜钱起卦结果页面。",
    type: "website",
    siteName: "Quick I Ching",
  },
};
export const dynamic = "force-dynamic";

export default async function ChineseThreeCoinResultPage(props: { searchParams?: Promise<{ session?: string }> }) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const sessionId = searchParams?.session?.trim() || undefined;
  const user = await getCurrentUser({ allowUnavailable: true });
  const [balance, castingView] = await Promise.all([
    user ? loadEntitlementBalance() : Promise.resolve({ available: 0, expiringSoon: 0 }),
    sessionId ? loadCastingView(sessionId) : Promise.resolve(null),
  ]);
  const initialInterpretationBundles = castingView?.result
    ? {
        primary: await loadHexagramInterpretation(castingView.result.primaryHexagramNumber),
        relating: castingView.result.relatingHexagramNumber === null
          ? null
          : await loadHexagramInterpretation(castingView.result.relatingHexagramNumber),
      }
    : undefined;
  const initialLocalizedContent = castingView?.result
    ? zhHansReadingContentFor([
        castingView.result.primaryHexagramNumber,
        ...(castingView.result.relatingHexagramNumber === null ? [] : [castingView.result.relatingHexagramNumber]),
      ])
    : undefined;
  return (
    <div data-realm="chamber" className="ritual-result-scene">
      <div className="ritual-room" aria-hidden="true" />
      <ThreeCoinResultClient
        locale="zh-Hans"
        initialSessionId={sessionId}
        initialUser={user ? { id: user.id, email: user.email } : null}
        initialCredits={balance.available}
        initialInterpretationBundles={initialInterpretationBundles}
        initialLocalizedContent={initialLocalizedContent}
        initialCastingView={castingView ? {
          castingId: castingView.session.id,
          createdAt: castingView.session.createdAt.toISOString(),
          context: castingView.context,
          lineValuesBottomUp: castingView.result?.lineValues ?? null,
          readingReport: (castingView.reading?.report as any) ?? null,
          deepSnapshot: castingView.reading?.snapshot ?? null,
          owns: castingView.owns,
        } : null}
      />
    </div>
  );
}
