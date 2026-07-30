import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  loadAccountDeletion,
  loadEntitlementBalance,
  loadHistoryPage,
  loadRecoverableCasts,
  parseHistoryFilter,
} from "@/server/loaders";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DeleteCastingButton,
  RequestAccountDeletionButton,
  RestoreAccountButton,
  RestoreCastingButton,
} from "@/components/account/casting-lifecycle-buttons";

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function historyHref(
  params: Record<string, string | string[] | undefined>,
  cursor: string,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "cursor") continue;
    if (typeof value === "string" && value) next.set(key, value);
  }
  next.set("cursor", cursor);
  return `/account?${next.toString()}`;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const params = await searchParams;
  const filter = parseHistoryFilter(params);
  const [historyPage, recoverable, balance, accountDeletion] = await Promise.all([
    loadHistoryPage(filter),
    loadRecoverableCasts(),
    loadEntitlementBalance(),
    loadAccountDeletion(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="font-display text-4xl font-medium">Your Account</h1>
      <p className="mt-2 text-sm text-[var(--ink-2)]">Signed in as {user.email}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="font-mono text-xs uppercase text-[var(--ink-3)]">Reading credits</p>
            <p className="mt-2 text-3xl font-semibold">{balance.available}</p>
            <Link href="/pricing" className="mt-3 inline-block text-sm text-[var(--jade)] hover:underline">
              Buy credits
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="font-mono text-xs uppercase text-[var(--ink-3)]">Expiring within 30 days</p>
            <p className="mt-2 text-3xl font-semibold">{balance.expiringSoon}</p>
            <p className="mt-3 text-xs text-[var(--ink-3)]">Credits expire 180 days after grant.</p>
          </CardContent>
        </Card>
      </div>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-medium">Casting History</h2>
            <p className="mt-1 text-sm text-[var(--ink-3)]">
              Server-authoritative questions, results, entitlement changes, and review outcomes.
            </p>
          </div>
          <form className="flex flex-wrap gap-2" method="get">
            <select name="method" defaultValue={filter.method ?? ""} className="rounded border border-[var(--line)] bg-[var(--paper-raised)] px-3 py-2 text-sm">
              <option value="">All methods</option>
              <option value="three_coin">Three coin</option>
              <option value="yarrow_stalk">Yarrow stalk</option>
              <option value="mei_hua_current_time">Mei Hua</option>
            </select>
            <select name="scene" defaultValue={filter.scene ?? ""} className="rounded border border-[var(--line)] bg-[var(--paper-raised)] px-3 py-2 text-sm">
              <option value="">All scenes</option>
              <option value="career">Career</option>
              <option value="relationships">Relationships</option>
              <option value="wealth">Wealth</option>
              <option value="timing">Timing</option>
              <option value="choices">Choices</option>
              <option value="personal_growth">Personal growth</option>
              <option value="other">Other</option>
            </select>
            <select name="hasReading" defaultValue={filter.hasReading === undefined ? "" : String(filter.hasReading)} className="rounded border border-[var(--line)] bg-[var(--paper-raised)] px-3 py-2 text-sm">
              <option value="">Any report state</option>
              <option value="true">Deep reading delivered</option>
              <option value="false">No deep reading</option>
            </select>
            <input type="hidden" name="limit" value={filter.limit ?? 20} />
            <Button type="submit" size="sm">Filter</Button>
          </form>
        </div>

        <div className="mt-5 space-y-4">
          {historyPage.items.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-sm text-[var(--ink-3)]">
                No castings match these filters.
              </CardContent>
            </Card>
          ) : historyPage.items.map((item) => (
            <Card key={item.castingId}>
              <CardContent className="py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link href={`/result/${item.castingId}`} className="font-medium hover:underline">
                      {item.questionContext}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--ink-3)]">
                      {label(item.scene)} · {label(item.interpretationGoal)} · {label(item.method)} · {item.createdAt.toLocaleString("en-US")}
                    </p>
                  </div>
                  <DeleteCastingButton castingId={item.castingId} />
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase text-[var(--ink-3)]">Original result</dt>
                    <dd className="mt-1">
                      {item.result
                        ? `Primary ${item.result.primaryHexagramNumber}; lines ${item.result.lineValues.join("-")}; moving ${item.result.movingLinePositions.join(", ") || "none"}; relating ${item.result.relatingHexagramNumber ?? "none"}`
                        : "No persisted result"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-[var(--ink-3)]">Delivery</dt>
                    <dd className="mt-1">
                      Preview: {item.previewStatus ?? "none"}; reading: {item.readingStatus ?? "none"}; review: {item.qualityReview?.status ?? "none"}
                    </dd>
                  </div>
                </dl>

                {item.result && (
                  <details className="mt-4 rounded border border-[var(--line)] p-3 text-xs">
                    <summary className="cursor-pointer font-medium">Persisted method evidence</summary>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-[var(--ink-2)]">
                      {JSON.stringify(item.result.methodCalculation, null, 2)}
                    </pre>
                    <p className="mt-2 text-[var(--ink-3)]">
                      Algorithm {item.result.algorithmVersion}; mapping {item.result.classicMappingVersion}
                    </p>
                  </details>
                )}

                <details className="mt-3 rounded border border-[var(--line)] p-3 text-xs">
                  <summary className="cursor-pointer font-medium">Entitlement and review audit</summary>
                  <ul className="mt-3 space-y-1 text-[var(--ink-2)]">
                    {item.entitlementChanges.length === 0 ? (
                      <li>No entitlement changes for this casting.</li>
                    ) : item.entitlementChanges.map((entry) => (
                      <li key={entry.id}>
                        {entry.createdAt.toLocaleString("en-US")} · {entry.action} · {entry.quantity}
                        {entry.reviewId ? ` · review ${entry.reviewId}` : ""}
                      </li>
                    ))}
                  </ul>
                  {item.qualityReview?.compensationBatchId && (
                    <p className="mt-2">Compensation batch: {item.qualityReview.compensationBatchId}</p>
                  )}
                </details>
              </CardContent>
            </Card>
          ))}
        </div>

        {historyPage.nextCursor && (
          <div className="mt-5">
            <Button asChild variant="outline">
              <Link href={historyHref(params, historyPage.nextCursor)}>Next page</Link>
            </Button>
          </div>
        )}
      </section>

      {recoverable.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium">Recently deleted</h2>
          <p className="mt-1 text-sm text-[var(--ink-3)]">Recover before the server purge deadline.</p>
          <div className="mt-4 space-y-3">
            {recoverable.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-medium">Deleted casting</p>
                    <p className="mt-1 text-xs text-[var(--ink-3)]">
                      Purge after {item.purgeAfter?.toLocaleDateString("en-US")}
                    </p>
                  </div>
                  <RestoreCastingButton castingId={item.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-16 border-t border-[var(--line)] pt-8">
        <h2 className="font-display text-2xl font-medium">Account deletion</h2>
        {accountDeletion ? (
          <Card className="mt-4">
            <CardContent className="py-5">
              <p className="text-sm">
                Account deletion was requested on {accountDeletion.requestedAt.toLocaleString("en-US")}.
                Personal content is scheduled for permanent purge after {accountDeletion.purgeAfter.toLocaleString("en-US")}.
              </p>
              <div className="mt-4"><RestoreAccountButton /></div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-4 border-[var(--danger)]/40">
            <CardContent className="py-5">
              <p className="text-sm text-[var(--ink-2)]">
                This revokes all sessions immediately. You may restore the account for 30 days. After that,
                personal questions, casting records, reports, and reviews are permanently purged; legally required
                financial audit records are retained under an anonymized subject.
              </p>
              <div className="mt-4"><RequestAccountDeletionButton /></div>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
