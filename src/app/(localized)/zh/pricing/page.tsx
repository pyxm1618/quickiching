import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { validateAuthCallbackURL } from "@/server/auth/callback";
import { loadEntitlementBalance } from "@/server/loaders";
import { isCheckoutCapabilityEnabled } from "@/server/payments/capability";
import { buildPricingView } from "@/app/(default)/pricing/pricing-model";
import { PurchaseButton } from "@/app/(default)/pricing/purchase-button";
import { CheckoutReturnRecovery } from "@/app/(default)/pricing/checkout-return-recovery";

export const metadata: Metadata = {
  title: "深度解读次数与价格 | Quick I Ching",
  description: "查看 Quick I Ching 可选个性化深度解读次数包的当前可用状态、价格、有效期与支付说明。",
  robots: { index: false, follow: true },
};
export const dynamic = "force-dynamic";

function validatedReturnUrl(candidate: string | undefined): string | undefined {
  if (!candidate) return undefined;
  const baseUrl = process.env.APP_BASE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  try { return validateAuthCallbackURL(candidate, baseUrl); } catch { return undefined; }
}

export default async function ChinesePricingPage(props: { searchParams?: Promise<{ returnUrl?: string; preview?: string }> }) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const returnUrl = validatedReturnUrl(searchParams?.returnUrl);
  const testPreviewAllowed = process.env.CHINESE_INTERACTIVE_GATE_PRICING_PREVIEW === "1";
  const isPreview = testPreviewAllowed && (searchParams?.preview === "1" || searchParams?.preview === "true");
  const pricing = buildPricingView(isCheckoutCapabilityEnabled() || isPreview);
  const user = await getCurrentUser({ allowUnavailable: true });
  const balance = user ? await loadEntitlementBalance() : { available: 0, expiringSoon: 0 };
  if (!pricing.enabled) {
    return <section className="mx-auto max-w-3xl px-4 py-12 sm:py-16"><p className="font-mono text-[11px] tracking-[0.14em] text-[var(--bronze)]">商业功能 · 当前未启用</p><h1 className="mt-3 font-display text-4xl font-medium tracking-tight">个性化深度解读当前未开放购买</h1><p className="mt-5 text-lg leading-8 text-[var(--ink-2)]">目前免费的四种起卦方法与基础卦象解读仍可完整使用，包括三枚铜钱、蓍草、梅花易数和手动起卦。当前部署没有开放正式支付、解读次数购买或付费深度解读。</p><div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6 text-sm leading-7 text-[var(--ink-2)]"><strong className="text-[var(--ink)]">后续边界：</strong>如果个性化深度解读正式开放，本页会明确展示价格、购买条款与服务状态；未开放前不显示为可购买服务。</div><p className="mt-8 text-sm"><Link href="/zh" className="font-semibold text-[var(--jade)] hover:underline">返回免费中文起卦 →</Link></p></section>;
  }
  return <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16"><p className="font-mono text-[11px] tracking-[0.14em] text-[var(--bronze)]">个性化深度解读</p><h1 className="mt-3 font-display text-4xl font-medium tracking-tight">选择深度解读次数包</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--ink-2)]">免费起卦和基础卦象结果不需要购买。次数只用于当前已开放的可选个性化深度解读，它会结合已揭示的卦象事实、问题背景和解读目标生成额外内容。</p>
    <div className="mt-10 grid gap-5 md:grid-cols-3">{pricing.products.map((product) => <article key={product.id} className="relative rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6">{product.badge ? <p className="mb-3 inline-flex rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-[var(--bronze)]">推荐</p> : null}<h2 className="font-display text-2xl font-medium">{product.quantity} 次深度解读</h2><p className="mt-3 text-3xl font-semibold tracking-tight">{product.total}</p><p className="mt-1 text-sm text-[var(--ink-3)]">每次 {product.perReading} · 美元计价</p><p className="mt-4 min-h-6 text-sm font-medium text-[var(--ink-2)]">{product.quantity === 1 ? "单次使用" : product.quantity === 3 ? "适合阶段性使用" : "适合多次使用"}</p><PurchaseButton productKey={product.id} returnUrl={returnUrl} creditsBeforeCheckout={balance.available} locale="zh-Hans" /></article>)}</div>
    <CheckoutReturnRecovery credits={balance.available} locale="zh-Hans" />
    <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6 text-sm leading-7 text-[var(--ink-2)]">解读次数自成功付款起有效 12 个月。支付前需要登录账户；启动一次付费深度解读时会先冻结一个次数，只有内容成功生成并交付后才正式扣除，生成失败或被安全规则阻断时会释放冻结次数。</div><p className="mt-8 text-sm"><Link href="/zh" className="font-semibold text-[var(--jade)] hover:underline">返回免费中文起卦 →</Link></p>
  </section>;
}
