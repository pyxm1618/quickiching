"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Mail } from "lucide-react";
import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { getDictionary } from "@/i18n/dictionaries";
import type { ContentLocale } from "@/i18n/config";
import styles from "./auth-ui.module.css";

const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [magicLinkClient()],
});

export type AuthMode = "signin" | "signup";
type AuthRequestResult = { error?: unknown | null };
type AuthUiError = {
  heading: string;
  message: string;
  requestNewLink: boolean;
};

const AUTH_PAGE_COPY = {
  en: {
    signInTitle: "Sign in to Quick I Ching",
    signInDescription: "Log in to continue your casting, reading, and account records.",
    signUpTitle: "Sign up for Quick I Ching",
    signUpDescription: "Create your account to save readings and continue across devices.",
    emailPlaceholder: "Enter your email address",
    newTo: "New to Quick I Ching?",
    createAccount: "Create an account",
    alreadyHave: "Already have an account?",
    signInAction: "Sign in",
    sentInstruction: "Open the secure link in the email to continue signing in to Quick I Ching.",
    spamHint: "Check your spam or junk folder if you don't see it.",
    expiredTitle: "This sign-in link has expired",
    invalidLinkTitle: "This sign-in link is no longer valid",
    cancelledTitle: "Sign-in was not completed",
    emailVerificationTitle: "Email verification is required",
    accountLinkTitle: "We couldn't link this account",
    invalidRequestTitle: "This sign-in request is no longer valid",
    genericErrorTitle: "We couldn't complete sign-in",
    requestNewLink: "Request a new sign-in link",
    backToSignIn: "Back to sign in",
    tryAgain: "Try again",
    returnHome: "Return home",
    termsPrefix: "By continuing, you agree to our",
    terms: "Terms",
    privacy: "Privacy",
    and: "and",
  },
  zh: {
    signInTitle: "登录 Quick I Ching",
    signInDescription: "登录后可继续起卦、查看解读与账户记录。",
    signUpTitle: "注册 Quick I Ching",
    signUpDescription: "创建账户以保存解读，并在不同设备上继续使用。",
    emailPlaceholder: "输入你的邮箱地址",
    newTo: "还没有账户？",
    createAccount: "创建账户",
    alreadyHave: "已有账户？",
    signInAction: "登录",
    sentInstruction: "打开邮件中的安全链接，即可继续登录 Quick I Ching。",
    spamHint: "如果没有看到邮件，请检查垃圾邮件或广告邮件文件夹。",
    expiredTitle: "这个登录链接已过期",
    invalidLinkTitle: "这个登录链接已失效",
    cancelledTitle: "登录未完成",
    emailVerificationTitle: "需要验证邮箱",
    accountLinkTitle: "无法连接这个账户",
    invalidRequestTitle: "这次登录请求已失效",
    genericErrorTitle: "无法完成登录",
    requestNewLink: "申请新的登录链接",
    backToSignIn: "返回登录",
    tryAgain: "重试",
    returnHome: "返回首页",
    termsPrefix: "继续即表示你同意我们的",
    terms: "服务条款",
    privacy: "隐私政策",
    and: "并了解",
  },
} as const;

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

function authErrorHeading(errorCode: string | null | undefined, locale: ContentLocale): string {
  const ui = locale === "zh-Hans" ? AUTH_PAGE_COPY.zh : AUTH_PAGE_COPY.en;
  const code = errorCode?.trim().toLowerCase();

  if (["token_expired", "expired_token"].includes(code ?? "")) return ui.expiredTitle;
  if (["invalid_token", "already_used"].includes(code ?? "")) return ui.invalidLinkTitle;
  if (["access_denied", "oauth_cancelled", "oauth_canceled", "user_cancelled", "user_canceled"].includes(code ?? "")) {
    return ui.cancelledTitle;
  }
  if (["email_not_verified", "provider_email_unverified"].includes(code ?? "")) return ui.emailVerificationTitle;
  if (["account_not_linked", "unable_to_link_account", "account_already_linked_to_different_user"].includes(code ?? "")) {
    return ui.accountLinkTitle;
  }
  if (["invalid_callback_request", "state_invalid", "state_mismatch", "state_not_found", "no_callback_url", "invalid_code"].includes(code ?? "")) {
    return ui.invalidRequestTitle;
  }
  return ui.genericErrorTitle;
}

function authPageURL(mode: AuthMode, callbackURL: string, locale: ContentLocale = "en"): string {
  const prefix = locale === "zh-Hans" ? "/zh" : "";
  const route = mode === "signup" ? prefix + "/signup" : prefix + "/signin";
  return route + "?callbackURL=" + encodeURIComponent(callbackURL);
}

function GoogleMark() {
  return (
    <svg className={styles.googleMark} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.27c0-.73-.06-1.27-.2-1.84H12v3.48h5.37a4.6 4.6 0 0 1-1.99 3.02l2.9 2.25c1.7-1.57 3.07-3.9 3.07-6.91Z" />
      <path fill="#34A853" d="M12 21.75c2.61 0 4.8-.86 6.4-2.34l-3.02-2.48c-.82.55-1.93.94-3.38.94-2.52 0-4.66-1.7-5.42-3.99l-3.02 2.33A9.67 9.67 0 0 0 12 21.75Z" />
      <path fill="#FBBC05" d="M6.58 13.88A5.8 5.8 0 0 1 6.25 12c0-.65.11-1.29.32-1.88L3.54 7.77A9.71 9.71 0 0 0 2.5 12c0 1.52.36 2.96 1.05 4.23l3.03-2.35Z" />
      <path fill="#EA4335" d="M12 6.13c1.63 0 3.1.56 4.24 1.65l2.66-2.66C17.29 3.62 14.61 2.25 12 2.25a9.67 9.67 0 0 0-8.45 5.52l3.02 2.35C7.34 7.83 9.48 6.13 12 6.13Z" />
    </svg>
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
  const ui = locale === "zh-Hans" ? AUTH_PAGE_COPY.zh : AUTH_PAGE_COPY.en;
  const initialError = authErrorMessage(initialErrorCode, locale);
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [error, setError] = useState<AuthUiError | null>(
    initialError
      ? {
          heading: authErrorHeading(initialErrorCode, locale),
          message: initialError.message,
          requestNewLink: initialError.requestNewLink,
        }
      : null,
  );
  const [newLinkMode, setNewLinkMode] = useState(initialError?.requestNewLink ?? false);
  const [formMode, setFormMode] = useState<AuthMode>(mode);
  const [pendingAction, setPendingAction] = useState<"google" | "email" | null>(null);
  const errorCallbackURL = authPageURL(formMode, callbackURL, locale);
  const prefix = locale === "zh-Hans" ? "/zh" : "";
  const homeHref = prefix || "/";
  const oppositeMode: AuthMode = formMode === "signin" ? "signup" : "signin";

  async function requestMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("email");
    setError(null);
    try {
      const origin = window.location.origin;
      const absoluteCallbackURL = toAbsoluteAuthURL(callbackURL, origin);
      const absoluteErrorCallbackURL = toAbsoluteAuthURL(errorCallbackURL, origin);
      const ok = await runAuthRequest(() => authClient.signIn.magicLink({
        email,
        callbackURL: absoluteCallbackURL,
        newUserCallbackURL: absoluteCallbackURL,
        errorCallbackURL: absoluteErrorCallbackURL,
      }));
      if (!ok) {
        setError({
          heading: ui.genericErrorTitle,
          message: copy.sendEmailError,
          requestNewLink: false,
        });
        return;
      }
      setSentEmail(email.trim());
      setNewLinkMode(false);
    } finally {
      setPendingAction(null);
    }
  }

  async function signInWithGoogle() {
    setPendingAction("google");
    setError(null);
    setNewLinkMode(false);
    try {
      const origin = window.location.origin;
      const absoluteCallbackURL = toAbsoluteAuthURL(callbackURL, origin);
      const absoluteErrorCallbackURL = toAbsoluteAuthURL(errorCallbackURL, origin);
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: absoluteCallbackURL,
        newUserCallbackURL: absoluteCallbackURL,
        errorCallbackURL: absoluteErrorCallbackURL,
      });
      if (result.error) {
        setError({
          heading: ui.genericErrorTitle,
          message: copy.googleStartError,
          requestNewLink: false,
        });
        return;
      }
      if (result.data?.url) {
        window.location.assign(result.data.url);
        return;
      }
      setError({
        heading: ui.genericErrorTitle,
        message: copy.googleStartError,
        requestNewLink: false,
      });
    } catch {
      setError({
        heading: ui.genericErrorTitle,
        message: copy.googleStartError,
        requestNewLink: false,
      });
    } finally {
      setPendingAction(null);
    }
  }

  if (sentEmail) {
    return (
      <div className={styles.state} aria-live="polite">
        <div className={styles.stateIcon} aria-hidden="true">
          <Mail size={42} strokeWidth={1.45} />
        </div>
        <h1 className={styles.stateTitle}>{copy.checkEmail}</h1>
        <p className={styles.stateLead}>{copy.sentTo}</p>
        <p className={styles.emailPill}>{sentEmail}</p>
        <p className={styles.stateDescription}>{ui.sentInstruction}</p>
        <div className={styles.stateDivider} />
        <button
          type="button"
          onClick={() => {
            setSentEmail(null);
            setEmail("");
            setNewLinkMode(false);
          }}
          className={styles.textAction}
        >
          {copy.differentEmail}
        </button>
        <div className={styles.stateDivider} />
        <p className={styles.stateHint}>{ui.spamHint}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.state} role="alert" aria-live="assertive">
        <div className={styles.stateIcon} aria-hidden="true">
          <AlertCircle size={42} strokeWidth={1.45} />
        </div>
        <h1 className={styles.stateTitle}>{error.heading}</h1>
        <p className={styles.stateDescription}>{error.message}</p>
        <div className={styles.stateActions}>
          {error.requestNewLink ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                setError(null);
                setEmail("");
                setFormMode("signin");
                setNewLinkMode(true);
              }}
            >
              {ui.requestNewLink}
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                setError(null);
                setNewLinkMode(false);
              }}
            >
              {ui.tryAgain}
            </button>
          )}
          {error.requestNewLink ? (
            <Link
              className={styles.textAction}
              href={authPageURL("signin", callbackURL, locale)}
              onClick={() => {
                setError(null);
                setEmail("");
                setFormMode("signin");
                setNewLinkMode(false);
              }}
            >
              {ui.backToSignIn}
            </Link>
          ) : (
            <Link className={styles.textAction} href={homeHref}>
              {ui.returnHome}
            </Link>
          )}
        </div>
      </div>
    );
  }

  const busy = pendingAction !== null;
  const title = formMode === "signin" ? ui.signInTitle : ui.signUpTitle;
  const description = formMode === "signin" ? ui.signInDescription : ui.signUpDescription;

  return (
    <div className={styles.formState}>
      <header className={styles.formHeader}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </header>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        aria-busy={pendingAction === "google"}
        className={styles.googleButton}
      >
        <GoogleMark />
        {pendingAction === "google" ? copy.connectingGoogle : copy.continueGoogle}
      </button>

      <div className={styles.separator} aria-hidden="true">
        <span />
        <em>{copy.separator}</em>
        <span />
      </div>

      <form onSubmit={requestMagicLink} className={styles.form} aria-busy={pendingAction === "email"}>
        <div>
          <label htmlFor={formMode + "-email"} className={styles.label}>
            {copy.emailLabel}
          </label>
          <input
            id={formMode + "-email"}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={ui.emailPlaceholder}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={styles.input}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          aria-busy={pendingAction === "email"}
          className={styles.primaryButton}
        >
          {pendingAction === "email"
            ? copy.sending
            : newLinkMode
              ? copy.sendNewLink
              : copy.continueEmail}
        </button>
      </form>

      <p className={styles.switchLine}>
        {formMode === "signin" ? ui.newTo : ui.alreadyHave}{" "}
        <Link href={authPageURL(oppositeMode, callbackURL, locale)} className={styles.inlineLink}>
          {formMode === "signin" ? ui.createAccount : ui.signInAction}
        </Link>
      </p>

      {formMode === "signup" && (
        <p className={styles.terms}>
          {ui.termsPrefix}{" "}
          <Link href={prefix + "/terms"} className={styles.inlineLink}>{ui.terms}</Link>{" "}
          {ui.and}{" "}
          <Link href={prefix + "/privacy"} className={styles.inlineLink}>{ui.privacy}</Link>.
        </p>
      )}
    </div>
  );
}
