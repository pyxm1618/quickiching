import type { Metadata } from "next";
import Link from "next/link";
import "@/components/public-reading/manual-cast.css";
import { ManualCastTool } from "@/components/public-reading/manual-cast-tool";
import { QuestionFirst } from "@/components/public-reading/question-first";
import { ritualBrush } from "@/components/public-reading/ritual-font";
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
    <article className={"manual-cast-page " + ritualBrush.variable}>
      <link rel="preload" as="image" href="/performance/stageDesktop.e37364561615e31f.webp" media="not all and (max-aspect-ratio:11/20)" fetchPriority="high" />
      <link rel="preload" as="image" href="/performance/stagePortrait.bde3e415eb141bc8.webp" media="(min-width:601px) and (max-aspect-ratio:11/20)" fetchPriority="high" />
      <link rel="preload" as="image" href="/performance/stageMobile.285965e6cb8c7840.webp" media="(max-width:600px) and (max-aspect-ratio:11/20)" fetchPriority="low" />
      <section className="manual-cast-stage">
        <div className="manual-cast-room" aria-hidden="true" />
        <div className="manual-cast-frame">
          <header className="manual-cast-title">
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </header>
          <QuestionFirst
            storageKey="quickiching:public-v1:manual-cast"
            dictionary={EN_UI_DICTIONARY}
            deepReadingEligible
            activeQuestionPresentation="hidden"
          >
            <ManualCastTool dictionary={EN_UI_DICTIONARY} />
          </QuestionFirst>
        </div>
      </section>

      <div className="manual-cast-supporting">
        <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2">
          <div><h2 className="font-display text-2xl font-medium">Two equivalent input modes</h2><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Mode A accepts six explicit values—6, 7, 8, or 9—from line 1 at the bottom through line 6 at the top. Mode B accepts a primary hexagram plus zero to six moving positions, then maps stable yin/yang to 8/7 and moving yin/yang to 6/9.</p></div>
          <div><h2 className="font-display text-2xl font-medium">One shared result</h2><p className="mt-4 text-sm leading-7 text-[var(--ink-2)]">Both modes use the same deterministic primary/changing/relating calculation and the same rich result. With no moving lines, no relating hexagram card is created. Nothing is sent to an AI service just to form the hexagram.</p><nav className="mt-5 flex flex-wrap gap-5 text-sm"><Link href="/guides/changing-lines" className="font-semibold text-[var(--jade)] hover:underline">Changing lines</Link><Link href="/hexagrams" className="font-semibold text-[var(--jade)] hover:underline">64 hexagrams</Link></nav></div>
        </section>
      </div>
    </article>
  );
}
