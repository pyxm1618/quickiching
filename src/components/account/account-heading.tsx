import React from "react";
import { GildedTitle } from "@/components/typography/gilded-title";

export function AccountHeading({ title, subtitle, id }: { title: string; subtitle: string; id?: string }) {
  return <header className="qic-account-heading">
    <h1 id={id}>
      <span className="qic-account-seal" aria-hidden="true">I Ching</span>
      {/* The gilded surface sits on the title span so the red seal keeps its own fill.
          Size is inherited from the h1, which owns the per-surface type scale. */}
      <GildedTitle as="span" size="inherit">{title}</GildedTitle>
    </h1>
    <p id={id ? "qic-account-subtitle" : undefined}>{subtitle}</p>
  </header>;
}
