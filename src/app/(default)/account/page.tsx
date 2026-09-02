import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loadAccountOverview, AccountDataUnavailableError, type AccountOverviewView } from "@/server/loaders";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { DeleteAccountControl } from "./delete-account-control";

// This page reads the caller's session, so it can only ever be rendered per
// request. Without this, prerendering runs getCurrentUser() with Auth enabled,
// where the headers() bail-out is swallowed by that function's catch and
// resurfaces as AUTH_INFRASTRUCTURE_UNAVAILABLE, failing the build.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  let overview: AccountOverviewView;
  try {
    overview = await loadAccountOverview();
  } catch (error) {
    if (!(error instanceof AccountDataUnavailableError)) throw error;
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="font-display text-[clamp(1.8rem,2.6vw,2.4rem)] font-medium tracking-[-0.015em]">My Account</h1>
        <Card className="mt-8"><CardContent className="pt-6">
          <p className="font-display text-lg font-medium">Your account data can’t be loaded right now</p>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-2)]">
            This is a temporary problem reading your records — your reading credits and history are unchanged.
            Please refresh in a moment.
          </p>
        </CardContent></Card>
      </div>
    );
  }

  const { credits, history } = overview;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-[clamp(1.8rem,2.6vw,2.4rem)] font-medium tracking-[-0.015em]">My Account</h1>
        <span className="font-mono text-xs text-[var(--ink-3)]">{user.email}</span>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="pt-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Reading credits</p>
          <p className="mt-2 font-display text-4xl font-medium">{credits.available}</p>
          <p className="mt-1 font-sans text-xs text-[var(--ink-3)]">Valid for 12 months from purchase</p>
          <Link href="/pricing" className="mt-2 inline-block text-sm font-semibold text-[var(--jade)] hover:underline">Buy more →</Link>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Casts</p>
          <p className="mt-2 font-display text-4xl font-medium">{history.length}</p>
        </CardContent></Card>
      </div>

      <h2 className="mt-12 font-display text-xl font-medium">History</h2>
      {history.length === 0 ? (
        <p className="mt-3 text-[var(--ink-3)]">No readings yet.{" "}
          <Link href="/methods/three-coin" className="font-semibold text-[var(--jade)] hover:underline">Start a coin reading →</Link>
        </p>
      ) : (
        <div className="mt-4 divide-y divide-[var(--line)] rounded-lg border border-[var(--line)] bg-[var(--paper-raised)]">
          {history.map((h) => (
            <Link key={h.id} href={`/readings/three-coin/result?session=${h.id}`}
              className="flex items-center justify-between p-4 transition-colors hover:bg-[var(--ink)]/[0.03]">
              <div>
                <p className="font-display font-medium">{h.primaryName ?? "Unrevealed cast"}</p>
                <p className="mt-0.5 font-mono text-xs text-[var(--ink-3)]">{h.method.replace(/_/g, " ")} · {h.scene} · {formatDate(h.createdAt)}</p>
              </div>
              <div className="flex gap-2 font-mono text-[10.5px] uppercase tracking-[0.06em]">
                {h.hasPreview && <span className="rounded-[3px] bg-[var(--jade-wash)] px-2 py-1 text-[var(--jade)]">Preview</span>}
                {h.hasReading && <span className="rounded-[3px] bg-[var(--cinnabar-wash)] px-2 py-1 text-[var(--cinnabar)]">Reading</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-12">
        <DeleteAccountControl />
        <p className="mt-3 text-sm text-[var(--ink-3)]">See the <Link href="/privacy" className="font-semibold text-[var(--jade)] hover:underline">Privacy Policy</Link> for retention details.</p>
      </div>
    </div>
  );
}
