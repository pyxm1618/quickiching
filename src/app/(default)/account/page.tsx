import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loadHistory, loadEntitlementBalance } from "@/server/loaders";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const history = await loadHistory();
  const balance = await loadEntitlementBalance();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-[clamp(1.8rem,2.6vw,2.4rem)] font-medium tracking-[-0.015em]">
          My Account
        </h1>
        <span className="font-mono text-xs text-[var(--ink-3)]">{user.email}</span>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">
              Reading credits
            </p>
            <p className="mt-2 font-display text-4xl font-medium">{balance.available}</p>
            <Link href="/pricing" className="mt-2 inline-block text-sm font-semibold text-[var(--jade)] hover:underline">
              Buy more →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--bronze)]">Casts</p>
            <p className="mt-2 font-display text-4xl font-medium">{history.length}</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-12 font-display text-xl font-medium">History</h2>
      {history.length === 0 ? (
        <p className="mt-3 text-[var(--ink-3)]">
          No readings yet.{" "}
          <Link href="/cast/three_coin" className="font-semibold text-[var(--jade)] hover:underline">
            Start a coin reading →
          </Link>
        </p>
      ) : (
        <div className="mt-4 divide-y divide-[var(--line)] rounded-lg border border-[var(--line)] bg-[var(--paper-raised)]">
          {history.map((h) => (
            <Link
              key={h.id}
              href={`/result/${h.id}`}
              className="flex items-center justify-between p-4 transition-colors hover:bg-[var(--ink)]/[0.03]"
            >
              <div>
                <p className="font-display font-medium">{h.primaryName ?? "Unrevealed cast"}</p>
                <p className="mt-0.5 font-mono text-xs text-[var(--ink-3)]">
                  {h.method.replace(/_/g, " ")} · {h.scene} · {formatDate(h.createdAt)}
                </p>
              </div>
              <div className="flex gap-2 font-mono text-[10.5px] uppercase tracking-[0.06em]">
                {h.hasPreview && (
                  <span className="rounded-[3px] bg-[var(--jade-wash)] px-2 py-1 text-[var(--jade)]">Preview</span>
                )}
                {h.hasReading && (
                  <span className="rounded-[3px] bg-[var(--cinnabar-wash)] px-2 py-1 text-[var(--cinnabar)]">Reading</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-10">
        <Link href="/privacy">
          <Button variant="outline">Manage data &amp; delete account</Button>
        </Link>
      </div>
    </div>
  );
}
