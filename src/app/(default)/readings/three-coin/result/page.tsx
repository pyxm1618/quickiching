import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { loadCastingView, loadEntitlementBalance } from "@/server/loaders";
import { ThreeCoinResultClient } from "@/components/three-coin-result/three-coin-result-client";

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

  return (
    <div data-realm="chamber">
      <ThreeCoinResultClient
        initialSessionId={sessionId}
        initialUser={user ? { id: user.id, email: user.email } : null}
        initialCredits={balance.available}
        initialCastingView={castingView ? {
          castingId: castingView.session.id,
          context: castingView.context,
          lineValuesBottomUp: castingView.result?.lineValues ?? null,
          readingReport: (castingView.reading?.report as any) ?? null,
          owns: castingView.owns,
        } : null}
      />
    </div>
  );
}
