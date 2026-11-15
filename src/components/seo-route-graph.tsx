"use client";

import React from "react";
import Link from "next/link";
import type { ContentLocale } from "@/i18n/config";
import { ALL_DISCOVERY_LINKS, SUPPORT_EMAIL_LINK } from "@/navigation/discovery-links";

/**
 * Crawlable route graph.
 *
 * It is an SEO device, not a navigation capability: it is hidden, inert for
 * assistive technology and not focusable, so it adds no visible navigation
 * owner. It exists so every surface keeps the indexable destination graph in
 * its HTML even when the Surface Contract renders a shell without discovery
 * navigation — or no shell at all.
 */
export function SeoRouteGraph({ locale = "en" }: { locale?: ContentLocale }) {
  const zh = locale === "zh-Hans";
  const localize = (path: string) => zh ? `/zh${path === "/" ? "" : path}` : path;
  return (
    <nav hidden aria-hidden="true" data-scene-route-graph>
      <Link href={localize("/")} prefetch={false}>{zh ? "首页" : "Home"}</Link>
      {ALL_DISCOVERY_LINKS.slice(1).map((link) => (
        <Link key={link.path} href={localize(link.path)} prefetch={false}>{zh ? link.zh : link.en}</Link>
      ))}
      <a href={SUPPORT_EMAIL_LINK.href}>{zh ? SUPPORT_EMAIL_LINK.zh : SUPPORT_EMAIL_LINK.en}</a>
    </nav>
  );
}
