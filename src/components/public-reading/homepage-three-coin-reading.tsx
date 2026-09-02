"use client";

import dynamic from "next/dynamic";
import { QuestionFirst } from "@/components/public-reading/question-first";

const LazyThreeCoinTool = dynamic(
  () => import("@/components/public-reading/three-coin-tool").then((module) => module.ThreeCoinTool),
  {
    loading: () => (
      <div className="mystic-card-soft p-5 text-sm text-[var(--ink-2)]" role="status">
        Preparing the Three-Coin casting tool…
      </div>
    ),
  },
);

export function HomepageThreeCoinReading() {
  return (
    <QuestionFirst
      storageKey="quickiching:public-v1:three-coin"
      legacyStorageKeys={["quickiching:question:home-three-coin", "quickiching:question:three-coin"]}
    >
      <LazyThreeCoinTool compactIntro />
    </QuestionFirst>
  );
}
