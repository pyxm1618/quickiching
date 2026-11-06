import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell, AuthUnavailable } from "@/components/auth/auth-shell";
import { isAuthCapabilityEnabled } from "@/server/auth/capability";
import { validateAuthCallbackURL } from "@/server/auth/callback";

export const metadata: Metadata = {
  title: "Sign up | Quick I Ching",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isAuthCapabilityEnabled()) {
    return <AuthUnavailable mode="signup" />;
  }

  const params = await searchParams;
  let callbackURL = "/";
  try {
    callbackURL = validateAuthCallbackURL(
      firstParam(params.callbackURL),
      process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    );
  } catch {
    callbackURL = "/";
  }
  const errorCode = firstParam(params.error);

  return (
    <AuthShell>
      <AuthForm mode="signup" callbackURL={callbackURL} initialErrorCode={errorCode} />
    </AuthShell>
  );
}
