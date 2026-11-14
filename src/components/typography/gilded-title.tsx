import React, { type ComponentPropsWithoutRef } from "react";
// The material stylesheet is imported once from the root layouts (next to globals.css)
// so it merges into the route's existing global bundle instead of adding a second
// render-blocking request on first paint.

export type GildedTitleSize = "xl" | "lg" | "md" | "inherit";

export type GildedTitleProps = Omit<ComponentPropsWithoutRef<"h1">, "className"> & {
  /** Heading level is a semantic choice owned by the page; it is never changed here. */
  as?: "h1" | "h2" | "span";
  /**
   * `xl` / `lg` / `md` pick a shared clamp tier. `inherit` keeps the size the
   * surrounding heading already defines (used where a surface has tuned sizes
   * and breakpoints that must not move).
   */
  size?: GildedTitleSize;
  className?: string;
};

/**
 * The single title implementation for Quick I Ching.
 *
 * The metal (font, gradient, stroke, highlight, shadow, glow) lives once in
 * `gilded-title.css`. Callers may only pass layout/size classes and normal
 * heading attributes, so the same material renders on every page without a
 * second stylesheet copying the gradient.
 */
export function GildedTitle({ as = "h1", size = "lg", className, children, ...rest }: GildedTitleProps) {
  const Tag = as;
  const sizeClass = size === "inherit" ? null : `qic-gilded-title--${size}`;
  return (
    <Tag {...rest} className={["qic-gilded-title", sizeClass, className].filter(Boolean).join(" ")}>
      {children}
    </Tag>
  );
}
