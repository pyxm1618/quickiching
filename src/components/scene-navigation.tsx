"use client";

import React, { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, Globe, Mail, MessageSquare, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { PrivacySettingsButton } from "@/components/privacy-settings-button";
import { currentRouteForPath, languageSwitchTarget } from "@/i18n/helpers";
import type { ContentLocale } from "@/i18n/config";

const UserNavControl = dynamic(
  () => import("@/components/auth/user-nav-control").then(m => m.UserNavControl),
  { ssr: false }
);

type Panel = "methods" | "info";

export function SceneNavigation({ locale = "en", authEnabled = false }: { locale?: ContentLocale; authEnabled?: boolean }) {
  const zh = locale === "zh-Hans";
  const pathname = usePathname() ?? (zh ? "/zh" : "/");
  const [panel, setPanel] = useState<Panel | null>(null);
  const id = useId();
  const rootRef = useRef<HTMLElement>(null);
  const methodsTrigger = useRef<HTMLButtonElement>(null);
  const infoTrigger = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusRequest = useRef<"first" | "last" | null>(null);
  const localize = (path: string) => zh ? `/zh${path === "/" ? "" : path}` : path;
  const route = currentRouteForPath(pathname);
  const languageHref = route ? languageSwitchTarget(route.id, locale).href : zh ? "/" : "/zh";
  const triggerFor = (name: Panel) => name === "methods" ? methodsTrigger.current : infoTrigger.current;

  useEffect(() => {
    setPanel(null);
  }, [locale]);

  useEffect(() => {
    if (!panel) return;
    function outside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setPanel(null);
    }
    function escape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPanel(null);
        triggerFor(panel!)?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [panel]);

  useEffect(() => {
    if (!panel || !focusRequest.current) return;
    const request = focusRequest.current;
    focusRequest.current = null;
    const frame = requestAnimationFrame(() => {
      const items = panelRef.current?.querySelectorAll<HTMLElement>("section:not([hidden]) a[href],section:not([hidden]) button");
      (request === "first" ? items?.[0] : items?.[items.length - 1])?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [panel]);

  function triggerKey(event: KeyboardEvent<HTMLButtonElement>, name: Panel) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const first = event.key === "ArrowDown";
    if (panel === name) {
      const items = panelRef.current?.querySelectorAll<HTMLElement>("section:not([hidden]) a[href],section:not([hidden]) button");
      (first ? items?.[0] : items?.[items.length - 1])?.focus();
    } else {
      focusRequest.current = first ? "first" : "last";
      setPanel(name);
    }
  }

  function panelKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("section:not([hidden]) a[href],section:not([hidden]) button") ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  const methods = [
    { path: "/methods/yarrow-stalks", image: "yarrow", title: zh ? "蓍草法" : "Yarrow Stalks", description: zh ? "传统四十九根蓍草起卦" : "Traditional 49-stalk method" },
    { path: "/methods/mei-hua-yi-shu", image: "mei-hua", title: zh ? "梅花易数" : "Mei Hua Yi Shu", description: zh ? "根据当前时间起卦" : "Cast from the current time" },
    { path: "/methods/manual-cast", image: "manual", title: zh ? "手动起卦" : "Manual Cast", description: zh ? "输入已知卦象或六爻" : "Enter a known hexagram\nor six lines" },
  ];

  return (
    <header ref={rootRef} className="scene-navigation" data-scene-panel={panel ?? "closed"} aria-label={zh ? "主导航" : "Main navigation"}>
      <div className="scene-utility" onClick={() => setPanel(null)}>
        <div className="scene-languages" data-language-switcher aria-label={zh ? "选择语言" : "Select language"}>
          <Globe aria-hidden="true" />
          <Link href={zh ? languageHref : "/"} prefetch={false} hrefLang="en" lang="en" aria-current={!zh ? "page" : undefined} onClick={() => setPanel(null)}>EN</Link>
          <span aria-hidden="true">/</span>
          <Link href={zh ? "/zh" : languageHref} prefetch={false} hrefLang="zh-Hans" lang="zh-Hans" aria-current={zh ? "page" : undefined} onClick={() => setPanel(null)}>中文</Link>
        </div>
        {authEnabled ? <>
          <span className="scene-utility-divider" aria-hidden="true" />
          <UserNavControl locale={locale} appearance="scene" onItemClick={() => setPanel(null)} />
        </> : null}
      </div>

      <Link href={localize("/")} prefetch={false} className="scene-brand" onClick={() => setPanel(null)}>
        <Image unoptimized src="/navigation/logo.webp" alt="" width={72} height={72} priority />
        <span>Quick I Ching</span>
      </Link>

      <nav className="scene-scrolls" aria-label={zh ? "探索易经" : "Explore the I Ching"}>
        <Link href={localize("/hexagrams")} className="scene-scroll scene-scroll-hexagrams" prefetch={false}>
          <Image src="/navigation/scroll-64-hexagrams-no-text.webp" alt="" width={450} height={675} sizes="(max-width: 800px) 94px, 151px" quality={90} priority fetchPriority="high" decoding="sync" />
          <span>{zh ? "六十四卦" : <>64<br />Hexagrams</>}</span>
        </Link>
        <button ref={methodsTrigger} type="button" className="scene-scroll scene-scroll-methods" aria-expanded={panel === "methods"} aria-controls={`${id}-methods`} onClick={() => setPanel(panel === "methods" ? null : "methods")} onKeyDown={event => triggerKey(event, "methods")}>
          <Image src="/navigation/scroll-other-methods-no-text.webp" alt="" width={338} height={675} sizes="(max-width: 800px) 76px, 122px" quality={90} fetchPriority="low" />
          <span>{zh ? "其他起卦" : <>Other<br />Methods</>}</span>
        </button>
        <button ref={infoTrigger} type="button" className="scene-scroll scene-scroll-info" aria-expanded={panel === "info"} aria-controls={`${id}-info`} onClick={() => setPanel(panel === "info" ? null : "info")} onKeyDown={event => triggerKey(event, "info")}>
          <Image src="/navigation/scroll-info-no-text.webp" alt="" width={338} height={675} sizes="(max-width: 800px) 69px, 111px" quality={90} fetchPriority="low" />
          <span>{zh ? "资讯" : "Info"}</span>
        </button>
        <Image className="scene-scroll-holder" src="/navigation/scroll-holder.webp" alt="" width={220} height={132} sizes="(max-width: 800px) 136px, 220px" quality={90} fetchPriority="low" />
      </nav>

      <div ref={panelRef} className="scene-panels" onKeyDown={panelKey} onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== methodsTrigger.current && event.relatedTarget !== infoTrigger.current) setPanel(null);
      }}>
        <section id={`${id}-methods`} className="scene-panel scene-methods-panel" aria-labelledby={`${id}-methods-title`} hidden={panel !== "methods"}>
          <h2 id={`${id}-methods-title`}>{zh ? "其他起卦方式" : "Other Methods"}</h2>
          <div className="scene-method-cards">
            {methods.map(method => <Link key={method.path} href={localize(method.path)} prefetch={false} onClick={() => setPanel(null)}>
              <Image unoptimized src={`/navigation/method-${method.image}.webp`} alt="" width={458} height={315} />
              <h3>{method.title}</h3><p>{method.description}</p>
            </Link>)}
          </div>
        </section>

        <section id={`${id}-info`} className="scene-panel scene-info-panel" aria-label={zh ? "资讯" : "Info"} hidden={panel !== "info"}>
          <div className="scene-info-columns">
            <div>
              <h2><Image unoptimized src="/navigation/info-guides-badge.webp" alt="" width={71} height={67} />{zh ? "指南" : "Guides"}</h2>
              <Link href={localize("/guides/how-to-ask-the-i-ching")} onClick={() => setPanel(null)}><BookOpen aria-hidden="true" /><span className="scene-guide-label">{zh ? "如何向易经提问" : "How to Ask the I Ching"}</span></Link>
              <Link href={localize("/guides/changing-lines")} onClick={() => setPanel(null)}><Sparkles aria-hidden="true" /><span className="scene-guide-label">{zh ? "变爻" : "Changing Lines"}</span></Link>
              <Link href={localize("/guides/primary-relating-hexagrams")} onClick={() => setPanel(null)}><Settings aria-hidden="true" /><span className="scene-guide-label">{zh ? "本卦与变卦" : "Primary & Relating Hexagrams"}</span></Link>
            </div>
            <div>
              <h2><Image unoptimized src="/navigation/info-support-badge.webp" alt="" width={68} height={67} />{zh ? "帮助与支持" : "Help & Support"}</h2>
              <Link href={localize("/help")} onClick={() => setPanel(null)}><MessageSquare aria-hidden="true" />{zh ? "帮助与支持" : "Help & Support"}</Link>
              <a href="mailto:support@quickiching.com" onClick={() => setPanel(null)}><Mail aria-hidden="true" /><span>{zh ? "联系支持" : "Contact Support"}<small>support@quickiching.com</small></span></a>
            </div>
            <div>
              <h2><Image unoptimized src="/navigation/info-legal-badge.webp" alt="" width={71} height={67} />{zh ? "法律与隐私" : "Legal & Privacy"}</h2>
              <Link href={localize("/privacy")} onClick={() => setPanel(null)}><FileText aria-hidden="true" />{zh ? "隐私政策" : "Privacy Policy"}</Link>
              <Link href={localize("/terms")} onClick={() => setPanel(null)}><FileText aria-hidden="true" />{zh ? "服务条款" : "Terms of Service"}</Link>
              <Link href={localize("/acceptable-use")} onClick={() => setPanel(null)}><ShieldCheck aria-hidden="true" />{zh ? "可接受使用政策" : "Acceptable Use"}</Link>
              <div className="scene-privacy"><Settings aria-hidden="true" /><PrivacySettingsButton locale={locale} label={zh ? "隐私设置" : "Privacy Settings"} className="scene-privacy-button" /></div>
            </div>
          </div>
          <div className="scene-info-note"><p>{zh ? "用于自我反思，并非确定性预测或专业建议。" : "For reflection, not deterministic prediction or professional advice."}</p><p>© {new Date().getFullYear()} Quick I Ching</p></div>
        </section>
      </div>
    </header>
  );
}
