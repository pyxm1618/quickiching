import type { Metadata } from "next";
import "@/components/public-reading/manual-cast.css";
import { ManualCastTool } from "@/components/public-reading/manual-cast-tool";
import { QuestionFirst } from "@/components/public-reading/question-first";
import { GildedTitle } from "@/components/typography/gilded-title";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import { alternateLanguages } from "@/i18n/helpers";

export const metadata: Metadata = {
  title: "Manual I Ching Cast — Enter Lines Online",
  description: "Build a deterministic I Ching reading by entering six line values or choosing a primary hexagram and moving lines. No randomness; the completed cast uses the same saved Free Reading flow as other methods.",
  alternates: { canonical: "/methods/manual-cast", languages: alternateLanguages("manual-cast-method") },
  openGraph: { title: "Manual I Ching Cast — Enter Lines Online", description: "Use Manual Cast to enter an I Ching structure directly and read the same primary, moving-line, and relating result.", url: "/methods/manual-cast", type: "website" },
};

export default function ManualCastPage() {
  const copy = EN_UI_DICTIONARY.manualCast;
  return (
    <article className="manual-cast-page">
      <link rel="preload" as="image" href="/performance/stageDesktop.e37364561615e31f.webp" media="not all and (max-aspect-ratio:11/20)" fetchPriority="high" />
      <link rel="preload" as="image" href="/performance/stagePortrait.bde3e415eb141bc8.webp" media="(min-width:601px) and (max-aspect-ratio:11/20)" fetchPriority="high" />
      <link rel="preload" as="image" href="/performance/stageMobile.285965e6cb8c7840.webp" media="(max-width:600px) and (max-aspect-ratio:11/20)" fetchPriority="low" />
      <section className="manual-cast-stage">
        <div className="manual-cast-room" aria-hidden="true" />
        <div className="manual-cast-frame">
          <header className="manual-cast-title">
            <GildedTitle size="lg">Manual I Ching Cast</GildedTitle>
            <p>{copy.subtitle}</p>
          </header>
          <QuestionFirst
            storageKey="quickiching:public-v1:manual-cast"
            dictionary={EN_UI_DICTIONARY}
            activeQuestionPresentation="hidden"
          >
            <ManualCastTool dictionary={EN_UI_DICTIONARY} />
          </QuestionFirst>
        </div>
      </section>
    </article>
  );
}
