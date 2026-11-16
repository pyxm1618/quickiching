"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, FileText, Mail, MessageSquare, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { PrivacySettingsButton } from "@/components/privacy-settings-button";
import type { ContentLocale } from "@/i18n/config";
import { INFO_LINKS, OTHER_METHOD_LINKS, SUPPORT_EMAIL_LINK } from "@/navigation/discovery-links";
import "@/components/scene-navigation-panels.css";

type Panel = "methods" | "info";

export function SceneNavigationPanels({
  locale,
  panel,
  id,
  onClose,
}: {
  locale: ContentLocale;
  panel: Panel;
  id: string;
  onClose: () => void;
}) {
  const zh = locale === "zh-Hans";
  const localize = (path: string) => zh ? `/zh${path === "/" ? "" : path}` : path;
  const methodPresentation = {
    "/methods/yarrow-stalks": { image: "yarrow", description: zh ? "传统四十九根蓍草起卦" : "Traditional 49-stalk method" },
    "/methods/mei-hua-yi-shu": { image: "mei-hua", description: zh ? "根据当前时间起卦" : "Cast from the current time" },
    "/methods/manual-cast": { image: "manual", description: zh ? "输入已知卦象或六爻" : "Enter a known hexagram\nor six lines" },
  } as const;
  const methods = OTHER_METHOD_LINKS.map((link) => ({
    ...link,
    title: zh ? link.zh : link.en,
    ...methodPresentation[link.path as keyof typeof methodPresentation],
  }));
  const infoLink = (index: number) => {
    const link = INFO_LINKS[index];
    if (!link) throw new Error(`Missing INFO_LINKS entry at index ${index}`);
    return link;
  };
  const howToAskLink = infoLink(0);
  const changingLinesLink = infoLink(1);
  const primaryRelatingLink = infoLink(2);
  const helpLink = infoLink(3);
  const privacyLink = infoLink(4);
  const termsLink = infoLink(5);
  const acceptableUseLink = infoLink(6);
  const infoLabel = (link: { en: string; zh: string }) => zh ? link.zh : link.en;
  const supportEmail = SUPPORT_EMAIL_LINK.href.replace(/^mailto:/u, "");

  if (panel === "methods") {
    return (
      <section id={`${id}-methods`} className="scene-panel scene-methods-panel" aria-labelledby={`${id}-methods-title`}>
        <h2 id={`${id}-methods-title`}>{zh ? "其他起卦方式" : "Other Methods"}</h2>
        <div className="scene-method-cards">
          {methods.map(method => <Link key={method.path} href={localize(method.path)} prefetch={false} onClick={onClose}>
            <Image unoptimized src={`/navigation/method-${method.image}.webp`} alt="" width={458} height={315} />
            <h3>{method.title}</h3><p>{method.description}</p>
          </Link>)}
        </div>
      </section>
    );
  }

  return (
    <section id={`${id}-info`} className="scene-panel scene-info-panel" aria-label={zh ? "资讯" : "Info"}>
      <div className="scene-info-columns">
        <div>
          <h2><Image unoptimized src="/navigation/info-guides-badge.webp" alt="" width={71} height={67} />{zh ? "指南" : "Guides"}</h2>
          <Link href={localize(howToAskLink.path)} onClick={onClose}><BookOpen aria-hidden="true" /><span className="scene-guide-label">{infoLabel(howToAskLink)}</span></Link>
          <Link href={localize(changingLinesLink.path)} onClick={onClose}><Sparkles aria-hidden="true" /><span className="scene-guide-label">{infoLabel(changingLinesLink)}</span></Link>
          <Link href={localize(primaryRelatingLink.path)} onClick={onClose}><Settings aria-hidden="true" /><span className="scene-guide-label">{infoLabel(primaryRelatingLink)}</span></Link>
        </div>
        <div>
          <h2><Image unoptimized src="/navigation/info-support-badge.webp" alt="" width={68} height={67} />{zh ? "帮助与支持" : "Help & Support"}</h2>
          <Link href={localize(helpLink.path)} onClick={onClose}><MessageSquare aria-hidden="true" />{infoLabel(helpLink)}</Link>
          <a href={SUPPORT_EMAIL_LINK.href} onClick={onClose}><Mail aria-hidden="true" /><span>{infoLabel(SUPPORT_EMAIL_LINK)}<small>{supportEmail}</small></span></a>
        </div>
        <div>
          <h2><Image unoptimized src="/navigation/info-legal-badge.webp" alt="" width={71} height={67} />{zh ? "法律与隐私" : "Legal & Privacy"}</h2>
          <Link href={localize(privacyLink.path)} onClick={onClose}><FileText aria-hidden="true" />{infoLabel(privacyLink)}</Link>
          <Link href={localize(termsLink.path)} onClick={onClose}><FileText aria-hidden="true" />{infoLabel(termsLink)}</Link>
          <Link href={localize(acceptableUseLink.path)} onClick={onClose}><ShieldCheck aria-hidden="true" />{infoLabel(acceptableUseLink)}</Link>
          <div className="scene-privacy"><Settings aria-hidden="true" /><PrivacySettingsButton locale={locale} label={zh ? "隐私设置" : "Privacy Settings"} className="scene-privacy-button" /></div>
        </div>
      </div>
      <div className="scene-info-note">
        <p>{zh ? "用于自我反思，并非确定性预测或专业建议。" : "For reflection, not deterministic prediction or professional advice."}</p>
        <p>© {new Date().getFullYear()} Quick I Ching</p>
      </div>
    </section>
  );
}
