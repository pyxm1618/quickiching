import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loadHistory, loadEntitlementBalance } from "@/server/loaders";
import { loadAccountPurchases } from "@/server/account/purchase-loader";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { DeleteAccountControl } from "@/app/(default)/account/delete-account-control";
import { RefundRequestControl } from "@/app/(default)/account/refund-request-control";

export const metadata: Metadata = {
  title: "我的账户 | Quick I Ching",
  description: "查看 Quick I Ching 账户中的深度解读次数、购买记录、账户起卦记录、退款申请与账户删除入口。",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const statusZh = (status: string) => ({ paid: "已付款", pending: "处理中", failed: "失败", refunded: "已退款", partially_refunded: "部分退款" } as Record<string,string>)[status] ?? status.replace(/_/g, " ");

export default async function ChineseAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/zh/signin?callbackURL=%2Fzh%2Faccount");
  const [history, balance, purchases] = await Promise.all([loadHistory(), loadEntitlementBalance(), loadAccountPurchases()]);
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="flex flex-wrap items-baseline justify-between gap-3"><h1 className="font-display text-[clamp(1.8rem,2.6vw,2.4rem)] font-medium tracking-[-0.015em]">我的账户</h1><span className="font-mono text-xs text-[var(--ink-3)]">{user.email}</span></div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="pt-6"><p className="font-mono text-[11px] tracking-[0.14em] text-[var(--bronze)]">可用深度解读次数</p><p className="mt-2 font-display text-4xl font-medium">{balance.available}</p><p className="mt-1 font-sans text-xs text-[var(--ink-3)]">购买成功后有效期为 12 个月</p><Link href="/zh/pricing" className="mt-2 inline-block text-sm font-semibold text-[var(--jade)] hover:underline">购买更多 →</Link></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="font-mono text-[11px] tracking-[0.14em] text-[var(--bronze)]">账户起卦记录</p><p className="mt-2 font-display text-4xl font-medium">{history.length}</p></CardContent></Card>
      </div>
      <h2 className="mt-12 font-display text-xl font-medium">购买记录</h2>
      {purchases.length === 0 ? <p className="mt-3 text-sm text-[var(--ink-3)]">还没有购买记录。<Link href="/zh/pricing" className="ml-1 font-semibold text-[var(--jade)] hover:underline">查看深度解读次数包 →</Link></p> :
        <div className="mt-4 space-y-3">{purchases.map((purchase) => <div key={purchase.id} className="rounded-lg border border-[var(--line)] bg-[var(--paper-raised)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-display font-medium">{purchase.quantity} 次深度解读</p><p className="mt-1 font-mono text-xs text-[var(--ink-3)]">US{(purchase.amountMinor / 100).toFixed(2)} · {statusZh(purchase.status)}{purchase.paidAt ? <> · 付款 {formatDate(purchase.paidAt)}</> : <> · 创建 {formatDate(purchase.createdAt)}</>}</p></div><span className="font-mono text-[10.5px] tracking-[0.06em] text-[var(--ink-3)]">{purchase.quantity} 次包</span></div>
          <RefundRequestControl orderId={purchase.id} orderStatus={purchase.status} existingRefund={purchase.refund} locale="zh-Hans" />
        </div>)}</div>}
      <h2 className="mt-12 font-display text-xl font-medium">账户起卦历史</h2>
      {history.length === 0 ? <p className="mt-3 text-[var(--ink-3)]">还没有账户起卦记录。{" "}<Link href="/zh/methods/three-coin" className="font-semibold text-[var(--jade)] hover:underline">开始三枚铜钱起卦 →</Link></p> :
        <div className="mt-4 divide-y divide-[var(--line)] rounded-lg border border-[var(--line)] bg-[var(--paper-raised)]">{history.map((h) => <Link key={h.id} href={"/zh/readings/three-coin/result?session=" + h.id} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-[var(--ink)]/[0.03]"><div><p className="font-display font-medium">{h.primaryName ?? "尚未揭示的卦象"}</p><p className="mt-0.5 font-mono text-xs text-[var(--ink-3)]">{h.method.replace(/_/g," ")} · {h.scene} · {formatDate(h.createdAt)}</p></div><div className="flex gap-2 font-mono text-[10.5px] tracking-[0.06em]">{h.hasPreview && <span className="rounded-[3px] bg-[var(--jade-wash)] px-2 py-1 text-[var(--jade)]">预览</span>}{h.hasReading && <span className="rounded-[3px] bg-[var(--cinnabar-wash)] px-2 py-1 text-[var(--cinnabar)]">解读</span>}</div></Link>)}</div>}
      <div className="mt-12"><DeleteAccountControl locale="zh-Hans" /><p className="mt-3 text-sm text-[var(--ink-3)]">数据保留规则见<Link href="/zh/privacy" className="mx-1 font-semibold text-[var(--jade)] hover:underline">隐私政策</Link>。</p></div>
    </div>
  );
}
