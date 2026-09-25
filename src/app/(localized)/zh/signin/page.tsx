import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";
import { validateAuthCallbackURL } from "@/server/auth/callback";

export const metadata: Metadata = {
  title: "登录 | Quick I Ching",
  description: "登录 Quick I Ching 账户，继续查看账户起卦记录与可用的深度解读次数。",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
function firstParam(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }

export default async function ChineseSignInPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isAuthCapabilityEnabled()) {
    return <main className="mx-auto max-w-md px-4 py-20" aria-live="polite"><h1 className="font-display text-2xl font-medium">当前无法登录</h1><p className="mt-3 text-sm text-[var(--ink-3)]">当前部署环境没有启用账户登录服务。</p></main>;
  }
  const params = await searchParams;
  let callbackURL = "/zh";
  try { callbackURL = validateAuthCallbackURL(firstParam(params.callbackURL), process.env.BETTER_AUTH_URL ?? "http://localhost:3000"); } catch { callbackURL = "/zh"; }
  const errorCode = firstParam(params.error);
  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:py-20">
      <div className="mb-8 text-center"><p className="font-mono text-[11px] tracking-[0.16em] text-[var(--bronze)]">Quick I Ching</p><h1 className="mt-3 font-display text-3xl font-medium text-[var(--ink)]">登录 Quick I Ching</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-3)]">进入你的账户起卦记录、购买记录与可用服务。</p></div>
      <AuthForm mode="signin" callbackURL={callbackURL} initialErrorCode={errorCode} locale="zh-Hans" />
      <p className="mt-7 text-center text-sm text-[var(--ink-3)]">还没有账户？{" "}<Link href={"/zh/signup?callbackURL=" + encodeURIComponent(callbackURL)} className="font-semibold text-[var(--ink)] underline underline-offset-4">注册</Link></p>
    </main>
  );
}
