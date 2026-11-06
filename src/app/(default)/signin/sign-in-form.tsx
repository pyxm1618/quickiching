"use client";

import { AuthForm } from "@/components/auth/auth-form";

export {
  authErrorMessage,
  runAuthRequest,
} from "@/components/auth/auth-form";

export function SignInForm({ callbackURL }: { callbackURL: string }) {
  return <AuthForm mode="signin" callbackURL={callbackURL} />;
}
