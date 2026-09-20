"use client";

import { AuthForm, runAuthRequest } from "@/components/auth/auth-form";

export { runAuthRequest };

export function SignInForm({ callbackURL }: { callbackURL: string }) {
  return <AuthForm mode="signin" callbackURL={callbackURL} />;
}
