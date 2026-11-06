import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell, AuthUnavailable } from "@/components/auth/auth-shell";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";
import { validateAuthCallbackURL } from "@/server/auth/callback";

export const metadata: Metadata = {
  title: "注册 | Quick I Ching",
  description: "创建 Quick I Ching 账户，用于“我的解读”与可选深度解读服务。",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ChineseSignUpPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isAuthCapabilityEnabled()) {
    return <AuthUnavailable mode="signup" locale="zh-Hans" />;
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
      <AuthForm mode="signup" callbackURL={callbackURL} initialErrorCode={errorCode} locale="zh-Hans" />
    </AuthShell>
  );
}
