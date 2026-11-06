import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import type { ContentLocale } from "@/i18n/config";
import styles from "./auth-ui.module.css";

type AuthMode = "signin" | "signup";

export function AuthShell({
  children,
  locale = "en",
}: {
  children: React.ReactNode;
  locale?: ContentLocale;
}) {
  return (
    <section className={styles.stage}>
      <div className={styles.card}>
        <div className={styles.brandMedallion}>
          <BrandMark size="lg" locale={locale} priority className={styles.brandMark} />
        </div>
        {children}
      </div>
    </section>
  );
}

export function AuthUnavailable({
  mode,
  locale = "en",
}: {
  mode: AuthMode;
  locale?: ContentLocale;
}) {
  const isChinese = locale === "zh-Hans";
  const prefix = isChinese ? "/zh" : "";
  const retryHref = mode === "signup" ? prefix + "/signup" : prefix + "/signin";
  const homeHref = prefix || "/";
  const title = isChinese
    ? mode === "signup"
      ? "注册暂时不可用"
      : "登录暂时不可用"
    : mode === "signup"
      ? "Sign up is temporarily unavailable"
      : "Sign in is temporarily unavailable";
  const description = isChinese
    ? "请稍后再试。"
    : "Please try again later.";

  return (
    <AuthShell locale={locale}>
      <div className={styles.state} role="status" aria-live="polite">
        <div className={styles.stateIcon} aria-hidden="true">
          <AlertCircle size={42} strokeWidth={1.45} />
        </div>
        <h1 className={styles.stateTitle}>{title}</h1>
        <p className={styles.stateDescription}>{description}</p>
        <div className={styles.stateActions}>
          <Link className={styles.primaryButton} href={retryHref}>
            {isChinese ? "重试" : "Try again"}
          </Link>
          <Link className={styles.textAction} href={homeHref}>
            {isChinese ? "返回首页" : "Return home"}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
