import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GildedTitle } from "./gilded-title";

// The Title Typography contract: one shared material class, real DOM text, and the
// caller's heading level. Nothing here may render an image or an extra hidden heading.
describe("GildedTitle", () => {
  it("keeps the page heading as selectable HTML text with the shared material class", () => {
    const html = renderToStaticMarkup(<GildedTitle size="lg">My Readings</GildedTitle>);
    expect(html).toContain("<h1");
    expect(html).toContain("My Readings");
    expect(html).toContain("qic-gilded-title");
    expect(html).toContain("qic-gilded-title--lg");
    expect(html).not.toMatch(/<img|<svg|<canvas|<picture/u);
  });

  it("preserves the heading level chosen by the scene", () => {
    const html = renderToStaticMarkup(<GildedTitle as="h2" size="md">Cast the Coins</GildedTitle>);
    expect(html).toContain("<h2");
    expect(html).not.toContain("<h1");
    expect(html).toContain("qic-gilded-title--md");
  });

  it("leaves sizing to the owning page when size is inherit", () => {
    const html = renderToStaticMarkup(<GildedTitle as="span" size="inherit" className="page-title">My Account</GildedTitle>);
    expect(html).toContain("<span");
    expect(html).toContain("page-title");
    expect(html).not.toContain("qic-gilded-title--");
  });

  it("passes through ids and aria attributes without changing semantics", () => {
    const html = renderToStaticMarkup(
      <GildedTitle id="hexagrams-title" size="lg" aria-labelledby="hub">64 I Ching Hexagrams</GildedTitle>,
    );
    expect(html).toContain('id="hexagrams-title"');
    expect(html).toContain('aria-labelledby="hub"');
    expect(html).toContain("64 I Ching Hexagrams");
  });
});
