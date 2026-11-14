"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  CheckSquare2,
  Hourglass,
  Target,
} from "lucide-react";
import React, { type ReactNode } from "react";
import type { AiDeepReadingViewModel } from "@/domain/generation/deep-reading-view-model";
import styles from "./ai-deep-reading-result.module.css";
import { GildedTitle } from "@/components/typography/gilded-title";

type Locale = "en" | "zh-Hans";

function formatAskedDate(value: string | undefined, locale: Locale): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "zh-Hans" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: locale === "zh-Hans" ? "long" : "short",
    day: "numeric",
  }).format(date);
}

const copy = {
  en: {
    title: "AI Deep Reading",
    subtitle: "A personalized and in-depth reading for your specific question",
    question: "Your Question",
    asked: "Asked on",
    core: "Core Answer",
    why: "Why This Is the Case",
    whySub: "Why this reading points in this direction.",
    change: "What This Change Can Bring",
    changeSub: "The likely impact of the pattern now unfolding.",
    timing: "When It’s Worth Taking Action",
    timingSub: "The key signals and conditions to look for.",
    actionSignals: "Signals that it’s worth taking action:",
    observeSignals: "More suitable to keep observing if:",
    next: "What You Should Do Now",
    nextSub: "A clear and practical next step for you.",
    cta: "View the Full Hexagram Interpretation",
    ctaSub: "Understand this reading from the I Ching perspective (hexagrams, changing lines, and their meanings).",
    free: "View Free Reading",
    missingQuestion: "Your saved question is unavailable.",
  },
  "zh-Hans": {
    title: "AI 深度解读",
    subtitle: "针对你的具体问题提供个性化、深入的解读",
    question: "你的问题",
    asked: "提问于",
    core: "核心回答",
    why: "为什么会得出这个判断",
    whySub: "为什么这次解读会指向这个方向。",
    change: "这件事可能带来什么变化",
    changeSub: "当前变化继续发展时，最值得关注的影响。",
    timing: "什么情况下值得行动",
    timingSub: "需要观察的关键信号与条件。",
    actionSignals: "值得行动的信号：",
    observeSignals: "更适合继续观察的信号：",
    next: "你现在应该做什么",
    nextSub: "为你整理清晰、实际的下一步。",
    cta: "查看完整卦象解读",
    ctaSub: "从《易经》角度理解本次卦象（本卦、动爻及其含义）。",
    free: "查看免费解卦",
    missingQuestion: "这次已保存的问题暂时无法显示。",
  },
} as const;

function QuestionPanel({
  question,
  createdAt,
  locale,
}: {
  question: string;
  createdAt?: string;
  locale: Locale;
}) {
  const t = copy[locale];
  const askedDate = formatAskedDate(createdAt, locale);
  return (
    <section className={styles.questionPanel} data-core-question-at-cast>
      <div className={styles.ribbon}>{t.question}</div>
      <p className={styles.questionText}>{question || t.missingQuestion}</p>
      {askedDate ? <p className={styles.askedDate}>{t.asked} {askedDate}</p> : null}
    </section>
  );
}

function DeepReadingFrame({
  question,
  createdAt,
  locale,
  children,
}: {
  question: string;
  createdAt?: string;
  locale: Locale;
  children: ReactNode;
}) {
  const t = copy[locale];
  return (
    <main className={styles.page} data-deep-reading-page data-clarity-mask="true">
      <section className={styles.hero}>
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <GildedTitle size="inherit" className={styles.heroTitle}>{t.title}</GildedTitle>
          <p className={styles.heroSubtitle}>{t.subtitle}</p>
        </div>
      </section>
      <div className={styles.content}>
        <QuestionPanel question={question} createdAt={createdAt} locale={locale} />
        {children}
      </div>
    </main>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className={styles.bulletList}>
      {items.map((item, index) => <li key={index}>{item}</li>)}
    </ul>
  );
}

function SectionCard({
  art,
  icon,
  title,
  subtitle,
  children,
  section,
}: {
  art: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
  section: string;
}) {
  return (
    <section className={styles.sectionCard} data-ai-deep-section={section}>
      <div className={styles.artColumn} aria-hidden="true">
        <Image src={art} alt="" fill sizes="(max-width: 800px) 46vw, 27vw" className={styles.sectionArt} />
      </div>
      <div className={styles.sectionIntro}>
        <span className={styles.iconBadge}>{icon}</span>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          <p className={styles.sectionSubtitle}>{subtitle}</p>
        </div>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export function AiDeepReadingResult({
  model,
  question,
  createdAt,
  locale,
  freeHref,
}: {
  model: AiDeepReadingViewModel;
  question: string;
  createdAt?: string;
  locale: Locale;
  freeHref: string;
}) {
  const t = copy[locale];

  return (
    <DeepReadingFrame question={question} createdAt={createdAt} locale={locale}>
      <div data-ai-deep-reading-report data-view-model-schema={model.schemaVersion}>
        <section className={styles.coreAnswer} data-ai-deep-section="core-answer">
          <div className={styles.ribbon}>{t.core}</div>
          <div className={styles.coreCopy}>
            <p className={styles.coreLead}>{model.coreLead}</p>
            {model.coreDetail ? <p className={styles.coreDetail}>{model.coreDetail}</p> : null}
          </div>
        </section>

        <div className={styles.sectionStack}>
          <SectionCard
            art="/ai-deep-reading/reason-lantern-landscape.png"
            icon={<Target aria-hidden="true" />}
            title={t.why}
            subtitle={t.whySub}
            section="reason"
          >
            <BulletList items={model.whyItems} />
          </SectionCard>

          <SectionCard
            art="/ai-deep-reading/change-river-landscape.png"
            icon={<BarChart3 aria-hidden="true" />}
            title={t.change}
            subtitle={t.changeSub}
            section="change"
          >
            <BulletList items={model.changeItems} />
          </SectionCard>

          <SectionCard
            art="/ai-deep-reading/timing-plum-landscape.png"
            icon={<CalendarDays aria-hidden="true" />}
            title={t.timing}
            subtitle={t.timingSub}
            section="timing"
          >
            <div className={styles.signalBlock}>
              <h3 className={styles.signalHeadingGood}>
                <Check aria-hidden="true" /> {t.actionSignals}
              </h3>
              <ul className={styles.signalListGood}>
                {model.actionSignals.map((item, index) => (
                  <li key={index}><Check aria-hidden="true" /><span>{item}</span></li>
                ))}
              </ul>
            </div>
            <div className={styles.signalBlock}>
              <h3 className={styles.signalHeadingObserve}>
                <Hourglass aria-hidden="true" /> {t.observeSignals}
              </h3>
              <BulletList items={model.observeSignals} />
            </div>
          </SectionCard>

          <SectionCard
            art="/ai-deep-reading/next-step-stairs-landscape.png"
            icon={<CheckSquare2 aria-hidden="true" />}
            title={t.next}
            subtitle={t.nextSub}
            section="next-steps"
          >
            <ol className={styles.stepList}>
              {model.nextSteps.map((item, index) => (
                <li key={index}>
                  <span className={styles.stepNumber}>{index + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>

        <section className={styles.footerCta} data-ai-deep-section="full-hexagram">
          <Link href={freeHref} className={styles.ctaButton}>
            <BookOpen aria-hidden="true" />
            <span>{t.cta}</span>
            <ArrowRight aria-hidden="true" />
          </Link>
          <p className={styles.ctaSub}>{t.ctaSub}</p>
          <p className={styles.visuallyHidden} data-deep-reading-disclaimer>{model.disclaimer}</p>
        </section>
      </div>
    </DeepReadingFrame>
  );
}

export function AiDeepReadingState({
  question,
  createdAt,
  locale,
  freeHref,
  children,
}: {
  question: string;
  createdAt?: string;
  locale: Locale;
  freeHref: string;
  children: ReactNode;
}) {
  const t = copy[locale];
  return (
    <DeepReadingFrame question={question} createdAt={createdAt} locale={locale}>
      <section className={styles.stateCard}>
        <div className={styles.stateBody}>{children}</div>
        <Link href={freeHref} className={styles.stateFreeLink}>{t.free}</Link>
      </section>
    </DeepReadingFrame>
  );
}
