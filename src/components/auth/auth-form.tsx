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
  if (["email_not_verified", "provider_email_unverified"].includes(code)) {
    return {
      message: copy.emailUnverified,
      requestNewLink: false,
    };
  }
  if ([
    "account_not_linked",
    "unable_to_link_account",
    "account_already_linked_to_different_user",
  ].includes(code)) {
    return {
      message: copy.accountLinkFailed,
      requestNewLink: false,
    };
  }
  if ([
    "invalid_callback_request",
    "state_invalid",
    "state_mismatch",
    "state_not_found",
    "no_callback_url",
    "invalid_code",
  ].includes(code)) {
    return {
      message: copy.invalidRequest,
      requestNewLink: false,
    };
  }

  return {
    message: copy.genericError,
    requestNewLink: false,
  };
}

function authPageURL(mode: AuthMode, callbackURL: string, locale: ContentLocale = "en"): string {
  const prefix = locale === "zh-Hans" ? "/zh" : "";
  const route = mode === "signup" ? `${prefix}/signup` : `${prefix}/signin`;
  return `${route}?callbackURL=${encodeURIComponent(callbackURL)}`;
}

function GoogleMark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--paper)] font-sans text-xs font-bold text-[var(--ink)]"
    >
      G
    </span>
  );
}

export function AuthForm({
  mode,
  callbackURL,
  initialErrorCode,
  locale = "en",
}: {
  mode: AuthMode;
  callbackURL: string;
  initialErrorCode?: string | null;
  locale?: ContentLocale;
}) {
  const copy = getDictionary(locale).auth;
  const initialError = authErrorMessage(initialErrorCode, locale);
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError?.message ?? null);
  const [requestNewLink, setRequestNewLink] = useState(initialError?.requestNewLink ?? false);
  const [pendingAction, setPendingAction] = useState<"google" | "email" | null>(null);
  const errorCallbackURL = authPageURL(mode, callbackURL, locale);

  async function requestMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("email");
    setError(null);
    setRequestNewLink(false);
    try {
      const ok = await runAuthRequest(() => authClient.signIn.magicLink({
        email,
        callbackURL,
        newUserCallbackURL: callbackURL,
        errorCallbackURL,
      }));
      if (!ok) {
        setError(copy.sendEmailError);
        return;
      }
      setSentEmail(maskAuthEmail(email));
    } finally {
      setPendingAction(null);
    }
  }

  async function signInWithGoogle() {
    setPendingAction("google");
    setError(null);
    setRequestNewLink(false);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL,
        newUserCallbackURL: callbackURL,
        errorCallbackURL,
      });
      if (result.error) {
        setError(copy.googleStartError);
        return;
      }
      if (result.data?.url) {
        window.location.assign(result.data.url);
        return;
      }
      setError(copy.googleStartError);
    } catch {
      setError(copy.googleStartError);
    } finally {
      setPendingAction(null);
    }
  }

  if (sentEmail) {
    return (
      <div
        className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6 text-center"
        aria-live="polite"
      >
        <h2 className="font-display text-2xl font-medium text-[var(--ink)]">{copy.checkEmail}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-2)]">
          {copy.sentTo}
          <br />
          <strong className="font-semibold text-[var(--ink)]">{sentEmail}</strong>
        </p>
        <p className="mt-2 text-xs text-[var(--ink-3)]">{copy.expires}</p>
        <button
          type="button"
          onClick={() => {
            setSentEmail(null);
            setEmail("");
          }}
          className="mt-5 min-h-11 rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink-2)] transition-colors hover:bg-[var(--ink)]/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cinnabar)]"
        >
          {copy.differentEmail}
        </button>
      </div>
    );
  }

  const busy = pendingAction !== null;

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-4 py-3 text-sm leading-6 text-[var(--danger)]"
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        aria-busy={pendingAction === "google"}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--line)] bg-transparent px-4 py-3 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--ink)]/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cinnabar)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleMark />
        {pendingAction === "google" ? copy.connectingGoogle : copy.continueGoogle}
      </button>

      <div className="flex items-center gap-3 text-xs text-[var(--ink-3)]" aria-hidden="true">
        <span className="h-px flex-1 bg-[var(--line)]" />
        <span>{copy.separator}</span>
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <form onSubmit={requestMagicLink} className="space-y-4" aria-busy={pendingAction === "email"}>
        <div>
          <label htmlFor={`${mode}-email`} className="block text-sm font-medium text-[var(--ink)]">
            {copy.emailLabel}
          </label>
          <input
            id={`${mode}-email`}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition-shadow placeholder:text-[var(--ink-3)] focus:border-[var(--line-strong)] focus-visible:ring-2 focus-visible:ring-[var(--cinnabar)]/30"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full rounded-lg bg-[var(--ink)] px-4 py-3 text-sm font-semibold text-[var(--paper)] transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cinnabar)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingAction === "email"
            ? copy.sending
            : requestNewLink
              ? copy.sendNewLink
              : copy.continueEmail}
        </button>
      </form>
    </div>
  );
}
