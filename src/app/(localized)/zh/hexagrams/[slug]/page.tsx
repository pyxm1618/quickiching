import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HexagramDetailPageView } from "@/components/hexagram-detail-page";
import { hexagramSeoFor } from "@/content/hexagrams/seo";
import { zhHansHexagramContent } from "@/content/hexagrams/zh-Hans";
import { CLASSICAL_HEXAGRAMS } from "@/domain/public-reading/classical";
import { loadPublicHexagramKnowledge } from "@/domain/public-reading/knowledge";
import { alternateLanguages, canonicalUrl } from "@/i18n/helpers";

type PageProps = { params: Promise<{ slug: string }> };

function entryForSlug(slug: string) {
  return CLASSICAL_HEXAGRAMS.find((hexagram) => hexagram.slug === slug) ?? null;
}

export function generateStaticParams() {
  return CLASSICAL_HEXAGRAMS.map((hexagram) => ({ slug: hexagram.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = entryForSlug(slug);
  if (!entry) return {};
  const seo = hexagramSeoFor(entry.number, "zh-Hans");
  const canonical = canonicalUrl(`/zh/hexagrams/${entry.slug}`);
  return {
    title: { absolute: seo.finalTitle },
    description: seo.finalDescription,
    alternates: { canonical, languages: alternateLanguages(`hexagram:${entry.slug}`) },
    openGraph: { title: seo.finalTitle, description: seo.finalDescription, url: canonical, type: "article", locale: "zh_CN" },
    robots: { index: true, follow: true },
  };
}

export default async function ChineseHexagramDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const entry = entryForSlug(slug);
  if (!entry) notFound();
  const knowledge = await loadPublicHexagramKnowledge(entry.number);
  const sequenceIndex = CLASSICAL_HEXAGRAMS.findIndex((hexagram) => hexagram.number === knowledge.number);
  const previous = sequenceIndex > 0 ? CLASSICAL_HEXAGRAMS[sequenceIndex - 1] : null;
  const next = sequenceIndex >= 0 && sequenceIndex < CLASSICAL_HEXAGRAMS.length - 1 ? CLASSICAL_HEXAGRAMS[sequenceIndex + 1] : null;
  return <HexagramDetailPageView locale="zh-Hans" knowledge={knowledge} seo={hexagramSeoFor(entry.number, "zh-Hans")} content={zhHansHexagramContent(entry.number)} previous={previous} next={next} />;
}
