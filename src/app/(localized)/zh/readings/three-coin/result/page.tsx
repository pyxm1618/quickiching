import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { loadCastingView, loadEntitlementBalance } from "@/server/loaders";
import { ThreeCoinResultClient } from "@/components/three-coin-result/three-coin-result-client";

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
  return (
    <div data-realm="chamber">
      <ThreeCoinResultClient
        locale="zh-Hans"
        initialSessionId={sessionId}
        initialUser={user ? { id: user.id, email: user.email } : null}
        initialCredits={balance.available}
        initialCastingView={castingView ? {
          castingId: castingView.session.id,
          createdAt: castingView.session.createdAt.toISOString(),
          context: castingView.context,
          lineValuesBottomUp: castingView.result?.lineValues ?? null,
          readingReport: (castingView.reading?.report as any) ?? null,
          owns: castingView.owns,
        } : null}
      />
    </div>
  );
}
