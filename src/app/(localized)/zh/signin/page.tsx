import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell, AuthUnavailable } from "@/components/auth/auth-shell";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";
import { validateAuthCallbackURL } from "@/server/auth/callback";

export const metadata: Metadata = {
  title: "登录 | Quick I Ching",
  description: "登录 Quick I Ching 账户，继续查看“我的解读”与可用的深度解读次数。",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ChineseSignInPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isAuthCapabilityEnabled()) {
    return <AuthUnavailable mode="signin" locale="zh-Hans" />;
  }

  const params = await searchParams;
  let callbackURL = "/zh";
  try {
    callbackURL = validateAuthCallbackURL(
      firstParam(params.callbackURL),
      process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    );
  } catch {
    callbackURL = "/zh";
  }
  const errorCode = firstParam(params.error);

  return (
    <AuthShell locale="zh-Hans">
      <AuthForm mode="signin" callbackURL={callbackURL} initialErrorCode={errorCode} locale="zh-Hans" />
    </AuthShell>
  );
}
