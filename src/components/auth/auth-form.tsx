"use client";

import { useState } from "react";
import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { getDictionary } from "@/i18n/dictionaries";
import type { ContentLocale } from "@/i18n/config";

const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [magicLinkClient()],
});

export type AuthMode = "signin" | "signup";
type AuthRequestResult = { error?: unknown | null };

export async function runAuthRequest(
  request: () => Promise<AuthRequestResult>,
): Promise<boolean> {
  try {
    const result = await request();
    return !result.error;
  } catch {
    return false;
  }
}

export function toAbsoluteAuthURL(value: string, origin: string): string {
  const parsedOrigin = new URL(origin).origin;
  const resolved = new URL(value, parsedOrigin);
  if (resolved.origin !== parsedOrigin) throw new Error("AUTH_CALLBACK_INVALID");
  return resolved.toString();
}

export function maskAuthEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  return `${local.slice(0, 1)}***@${domain}`;
}

export function authErrorMessage(errorCode: string | null | undefined, locale: ContentLocale = "en"): {
  message: string;
  requestNewLink: boolean;
} | null {
  if (!errorCode) return null;
  const copy = getDictionary(locale).auth;
  const code = errorCode.trim().toLowerCase();

  if (["invalid_token", "token_expired", "expired_token", "already_used"].includes(code)) {
    return {
      message: copy.invalidLink,
      requestNewLink: true,
    };
  }
  if (["access_denied", "oauth_cancelled", "oauth_canceled", "user_cancelled", "user_canceled"].includes(code)) {
    return {
      message: copy.cancelled,
      requestNewLink: false,
    };
  }
  if (["email_not_verified", "provider_email_unverified"].includes...[truncated]