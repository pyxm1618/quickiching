"use client";

import Link from "next/link";
import { ArrowRight, Check, UserRound } from "lucide-react";
import React, { useEffect, useState } from "react";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import { RitualRevealTransition } from "@/components/public-reading/ritual-reveal-transition";
import { buildResultSigninHref } from "@/lib/commercial-navigation";
import { readCompletedPublicReading } from "@/lib/completed-public-reading";
import type { PublicReading } from "@/domain/public-reading/types";
import styles from "@/components/three-coin-result/result-page.module.css";

type LocalState =
  | { kind: "loading" }
  | { kind: "ready"; reading: PublicReading }
  | { kind: "empty" };

export function UnauthenticatedReadingResultClient({
  initialSessionId,
  pageMode = "free",
  locale = "en",
}: {
  initialSessionId?: string;
  pageMode?: "free" | "deep";
  locale?: "en" | "zh-Hans";
}) {
  const zh = locale === "zh-Hans";
  const t = (en: string, cn: string) => zh ? cn : en;
  const [state, setState] = useState<LocalState>({ kind: "loading" });

  useEffect(() => {
    const reading = readCompletedPublicReading(initialSessionId);
    setState(reading ? { kind: "ready", reading } : { kind: "empty" });
  }, [initialSessionId]);

  if (state.kind === "loading") {
    return (
      <div className="sr-only" role="status" aria-label={t("Loading your completed reading", "正在恢复已完成的起卦结果")}>
        {t("Restoring your sealed reading…", "正在恢复已经落定的起卦结果…")}
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div className={`${styles.page} mx-auto w-full max-w-[1180px] px-4 sm:px-6`}>
        <section className={styles.emptyState} aria-labelledby="empty-reading-title">
          <p className="mystic-kicker">{t("Reading", "解卦")}</p>
          <h1 id="empty-reading-title" className="mt-3 font-display text-4xl font-normal tracking-[-0.04em] text-white sm:text-5xl">
            {t("No completed reading found", "没有找到已完成的起卦")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[var(--ink-2)] sm:text-base">
            {t("Complete a casting method before opening its saved result.", "请先完成一种起卦方式，再打开已完成的解卦结果。")}
          </p>
          <Link href={zh ? "/zh" : "/"} className={`${styles.newReadingButton} mt-7`}>
            {t("Start a New Reading", "重新起一卦")}
          </Link>
        </section>
      </div>
    );
  }

  const prefix = zh ? "/zh" : "";
  const id = state.reading.id;
  const freePath = `${prefix}/readings/result?session=${encodeURIComponent(id)}`;
  const deepPath = `${prefix}/readings/deep?session=${encodeURIComponent(id)}`;
  const primaryPath = pageMode === "deep" ? deepPath : freePath;
  const alternatePath = pageMode === "deep" ? freePath : deepPath;
  const signinHref = buildResultSigninHref(primaryPath, locale);
  const alternateSigninHref = buildResultSigninHref(alternatePath, locale);

  return (
    <RitualRevealTransition stage="gate">
      <div className="ritual-save-gate" data-completed-cast-gate="auth-required">
        <section className="ritual-gate-card" aria-labelledby="completed-cast-title">
          <div className="ritual-gate-complete-mark" aria-hidden="true"><Check /></div>
          <p className="ritual-gate-complete">{t("Your six lines are complete", "六爻已经完成")}</p>
          <h1 id="completed-cast-title">{t("Save Your Reading", "保存本次起卦")}</h1>
          <p className="ritual-gate-description">
            {t("Sign in to save this reading and", "登录以保存本次起卦，")}<br />
            {t("continue to view the full result.", "继续查看完整结果。")}
          </p>
          <div className="sr-only" data-completed-six-lines>
            <HexagramLines lines={[...state.reading.lineValuesBottomUp]} sealedCount={6} size="lg" showLabels locale={locale} />
          </div>
          <div className="ritual-gate-action" data-auth-required-before-reveal>
            <Link
              href={signinHref}
              prefetch={false}
              className="ritual-gate-signin"
              data-auth-reading-intent={pageMode}
              onClick={(event) => {
                if (event.currentTarget.closest(".ritual-gate-card")?.getAnimations().some((animation) => animation.playState === "running")) {
                  event.preventDefault();
                }
              }}
              aria-label={pageMode === "deep"
                ? t("Sign in and continue to Deep Reading", "登录并继续深度解读")
                : t("Sign in to save and reveal this reading", "登录、保存并查看本次卦象")}
            >
              <UserRound aria-hidden="true" />
              {pageMode === "deep"
                ? t("Sign In for Deep Reading", "登录并继续深度解读")
                : t("Sign In to Save & Reveal", "登录、保存并查看")}
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link
              href={alternateSigninHref}
              prefetch={false}
              className="mt-3 inline-flex text-sm underline underline-offset-4"
              data-auth-reading-alternate-intent={pageMode === "deep" ? "free" : "deep"}
            >
              {pageMode === "deep"
                ? t("Use Free Reading instead", "改为查看免费解卦")
                : t("Continue to Deep Reading instead", "改为继续深度解读")}
            </Link>
          </div>
        </section>
      </div>
    </RitualRevealTransition>
  );
}
