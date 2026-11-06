"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, FileText, Mail, MessageSquare, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { PrivacySettingsButton } from "@/components/privacy-settings-button";
import type { ContentLocale } from "@/i18n/config";
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
  const methods = [
    { path: "/methods/yarrow-stalks", image: "yarrow", title: zh ? "蓍草法" : "Yarrow Stalks", description: zh ? "传统四十九根蓍草起卦" : "Traditional 49-stalk method" },
    { path: "/methods/mei-hua-yi-shu", image: "mei-hua", title: zh ? "梅花易数" : "Mei Hua Yi Shu", description: zh ? "根据当前时间起卦" : "Cast from the current time" },
    { path: "/methods/manual-cast", image: "manual", title: zh ? "手动起卦" : "Manual Cast", description: zh ? "输入已知卦象或六爻" : "Enter a known hexagram\nor six lines" },
  ];

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
          <Link href={localize("/guides/how-to-ask-the-i-ching")} onClick={onClose}><BookOpen aria-hidden="true" /><span className="scene-guide-label">{zh ? "如何向易经提问" : "How to Ask the I Ching"}</span></Link>
          <Link href={localize("/guides/changing-lines")} onClick={onClose}><Sparkles aria-hidden="true" /><span className="scene-guide-label">{zh ? "变爻" : "Changing Lines"}</span></Link>
          <Link href={localize("/guides/primary-relating-hexagrams")} onClick={onClose}><Settings aria-hidden="true" /><span className="scene-guide-label">{zh ? "本卦与变卦" : "Primary & Relating Hexagrams"}</span></Link>
        </div>
        <div>
          <h2><Image unoptimized src="/navigation/info-support-badge.webp" alt="" width={68} height={67} />{zh ? "帮助与支持" : "Help & Support"}</h2>
          <Link href={localize("/help")} onClick={onClose}><MessageSquare aria-hidden="true" />{zh ? "帮助与支持" : "Help & Support"}</Link>
          <a href="mailto:support@quickiching.com" onClick={onClose}><Mail aria-hidden="true" /><span>{zh ? "联系支持" : "Contact Support"}<small>support@quickiching.com</small></span></a>
        </div>
        <div>
          <h2><Image unoptimized src="/navigation/info-legal-badge.webp" alt="" width={71} height={67} />{zh ? "法律与隐私" : "Legal & Privacy"}</h2>
          <Link href={localize("/privacy")} onClick={onClose}><FileText aria-hidden="true" />{zh ? "隐私政策" : "Privacy Policy"}</Link>
          <Link href={localize("/terms")} onClick={onClose}><FileText aria-hidden="true" />{zh ? "服务条款" : "Terms of Service"}</Link>
          <Link href={localize("/acceptable-use")} onClick={onClose}><ShieldCheck aria-hidden="true" />{zh ? "可接受使用政策" : "Acceptable Use"}</Link>
          <div className="scene-privacy"><Settings aria-hidden="true" /><PrivacySettingsButton locale={locale} label={zh ? "隐私设置" : "Privacy Settings"} className="scene-privacy-button" /></div>
        </div>
      </div>
      <div className="scene-info-note"><p>{zh ? "用于自我反思，并非确定性预测或专业建议。" : "For reflection, not deterministic prediction or professional advice."}</p><p>© {new Date().getFullYear()} Quick I Ching</p></div>
    </section>
  );
}
