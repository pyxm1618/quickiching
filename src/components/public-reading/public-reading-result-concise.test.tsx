import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicReadingResult } from "./public-reading-result";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { buildStaticReading } from "@/domain/public-reading/static-reading";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import type { PublicReadingMethod } from "@/domain/public-reading/types";
import type { LineValue } from "@/domain/casting/types";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));

const variants = {
  still: [7, 7, 7, 7, 7, 7],
  single: [7, 7, 9, 7, 7, 7],
  multiple: [6, 7, 9, 8, 7, 8],
  all: [6, 9, 6, 9, 6, 9],
} satisfies Record<string, LineValue[]>;

for (const method of ["three-coin", "yarrow-stalks", "mei-hua-yi-shu"] as const satisfies readonly PublicReadingMethod[]) {
  describe(`concise Free reading: ${method}`, () => {
    for (const [variant, lines] of Object.entries(variants)) {
      it(`renders ${variant} cast with actual changes and two dedicated deep links`, async () => {
        const reading = buildPublicReading({ id: `${method}-${variant}`, createdAt: "2026-10-31T00:00:00.000Z", method, methodVersion: "test", lineValuesBottomUp: lines, evidence: { kind: "history", originalMethod: method } });
        const primary = await loadHe¶»§q«^