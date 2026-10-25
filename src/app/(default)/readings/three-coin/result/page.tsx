import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { loadCastingView, loadEntitlementBalance } from "@/server/loaders";
import { ThreeCoinResultClient } from "@/components/three-coin-result/three-coin-result-client";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";

export const metadata: Metadata = {
  title: "Your Three-Coin Reading",
  description: "A private Three-Coin I Ching reading restored from the completed cast in this browser session.",
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: "Your Three-Coin Reading",
    description: "A private Three-Coin I Ching reading restored from the completed cast in this browser session.",
    type: "website",
    siteName: "Quick I Ching",
  },
};

export const dynamic = "force-dynamic";

export default async function ThreeCoinResultPage(props: {
  searchParams?: Promise<{ session?: string }>;
}) {
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

  return (
    <div data-realm="chamber">
      <ThreeCoinResultClient
        initialSessionId={sessionId}
        initialUser={user ? { id: user.id, email: user.email } : null}
        initialCredits={balance.available}
        initialInterpretationBundles={initialInterpretationBundles}
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
