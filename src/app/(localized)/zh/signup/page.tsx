import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";
import { validateAuthCallbackURL } from "@/server/auth/callback";

export const metadata: Metadata = {
  title: "注册 | Quick I Ching",
  description: "创建 Quick I Ching 账户，用于需要账户的起卦记录与可选深度解读服务。",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
function firstParam(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }

export default async function ChineseSignUpPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isAuthCapabilityEnabled()) {
    return <main className="mx-auto max-w-md px-4 py-20" aria-live="polite"><h1 className="font-display text-2xl font-medium">当前无法注册</h1><p className="mt-3 text-sm text-[var(--ink-3)]">当前部署环境没有启用账户服务。</p></main>;
  }
  const params = await searchParams;
  let callbackURL = "/zh";
  try { callbackURL = validateAuthCallbackURL(firstParam(params.callbackURL), process.env.BETTER_AUTH_URL ?? "http://localhost:3000"); } catch { callbackURL = "/zh"; }
  const errorCode = firstParam(params.error);
  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:py-20">
      <div className="mb-8 text-center"><p className="font-mono text-[11px] tracking-[0.16em] text-[var(--bronze)]">Quick I Ching</p><h1 className="mt-3 font-display text-3xl font-medium text-[var(--ink)]">注册 Quick I Ching</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-3)]">创建账户后，可使用当前部署已开放的账户记录与可选深度解读能力。</p></div>
      <AuthForm mode="signup" callbackURL={callbackURL} initialErrorCode={errorCode} locale="zh-Hans" />
      <p className="mt-7 text-center text-sm text-[var(--ink-3)]">已有账户？{" "}<Link href={"/zh/signin?callbackURL=" + encodeURIComponent(callbackURL)} className="font-semibold text-[var(--ink)] underline underline-offset-4">登录</Link></p>
      <p className="mt-5 text-center text-xs leading-6 text-[var(--ink-3)]">继续即表示你同意<Link href="/zh/terms" className="mx-1 underline">服务条款</Link>并了解<Link href="/zh/privacy" className="mx-1 underline">隐私政策</Link>。</p>
    </main>
  );
}
