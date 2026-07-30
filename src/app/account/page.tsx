import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  loadEntitlementBalance,
  loadHistory,
  loadRecoverableCasts,
  parseHistoryFilter,
} from "@/server/loaders";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DeleteCastingButton,
  RestoreCastingButton,
} from "@/components/account/casting-lifecycle-buttons";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const params = await searchParams;
  const filter = parseHistoryFilter(params);
  const [history, recoverable, balance] = await Promise.all([
    loadHistory(filter),
    loadRecoverableCasts(),
    loadEntitlementBalance(),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="font-display text-4xl font-medium">Your Account</h1>
      <p className="mt-2 text-sm text-[var(--ink-2)]">Signed in as {user.email}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="pt-6"><p className="font-mono text-xs uppercase text-[var(--ink-3)]">Reading credits</p><p className="mt-2 text-3xl font-semibold">{balance.available}</p><Link href="/pricing" className="mt-3 inline-block text-sm text-[var(--jade)] hover:underline">Buy credits</Link></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="font-mono text-xs uppercase text-[var(--ink-3)]">Expiring within 30 days</p><p className="mt-2 text-3xl font-semibold">{balance.expiringSoon}</p><p className="mt-3 text-xs text-[var(--ink-3)]">Credits expire 180 days after grant.</p></CardContent></Card>
      </div>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="font-display text-2xl font-medium">Casting History</h2><p className="mt-1 text-sm text-[var(--ink-3)]">Only server-owned revealed records appear here.</p></div>
          <form className="flex flex-wrap gap-2" method="get">
            <select name="method" defaultValue={filter.method ?? ""} className="rounded border border-[var(--line)] bg-[var(--paper-raised)] px-3 py-2 text-sm">
              <option value="">All methods</option><option value="three_coin">Three coin</option><option value="yarrow_stalk">Yarrow stalk</option><option value="mei_hua_current_time">Mei Hua</option>
            </select>
            <select name="scene" defaultValue={filter.scene ?? ""} className="rounded border border-[var(--line)] bg-[var(--paper-raised)] px-3 py-2 text-sm">
              <option value="">All scenes</option><option value="career">Career</option><option value="relationships">Relationships</option><option value="wealth">Wealth</option><option value="timing">Timing</option><option value="choices">Choices</option><option value="personal_growth">Personal growth</option><option value="other">Other</option>
            </select>
            <select name="hasReading" defaultValue={filter.hasReading === undefined ? "" : String(filter.hasReading)} className="rounded border border-[var(--line)] bg-[var(--paper-raised)] px-3 py-2 text-sm">
              <option value="">Any report state</option><option value="true">Deep reading delivered</option><option value="false">No deep reading</option>
            </select>
            <Button type="submit" size="sm">Filter</Button>
          </form>
        </div>
        <div className="mt-5 space-y-3">
          {history.length === 0 ? <Card><CardContent className="py-8 text-sm text-[var(--ink-3)]">No castings match these filters.</CardContent></Card> : history.map((item) => (
            <Card key={item.id}><CardContent className="flex items-center justify-between gap-4 py-4">
              <Link href={`/result/${item.id}`} className="min-w-0 flex-1"><p className="font-medium">{item.primaryName ?? "Sealed casting"}</p><p className="mt-1 text-xs text-[var(--ink-3)]">{item.scene.replace(/_/g, " ")} · {item.method.replace(/_/g, " ")} · {item.hasReading ? "deep reading delivered" : item.hasPreview ? "preview delivered" : "classic result"}</p></Link>
              <DeleteCastingButton castingId={item.id} />
            </CardContent></Card>
          ))}
        </div>
      </section>

      {recoverable.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-medium">Recently deleted</h2>
          <p className="mt-1 text-sm text-[var(--ink-3)]">Recover before the server purge deadline.</p>
          <div className="mt-4 space-y-3">{recoverable.map((item) => (
            <Card key={item.id}><CardContent className="flex items-center justify-between gap-4 py-4"><div><p className="font-medium">Deleted casting</p><p className="mt-1 text-xs text-[var(--ink-3)]">Purge after {item.purgeAfter?.toLocaleDateString("en-US")}</p></div><RestoreCastingButton castingId={item.id} /></CardContent></Card>
          ))}</div>
        </section>
      )}
    </main>
  );
}
