import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { ResultChoiceClient } from "./result-choice-client";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

const ID_A = "2d0a4f0d-37e8-42bf-9232-9d40518f1e4f";

const reading = buildPublicReading({
  id: ID_A,
  method: "manual",
  lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
  evidence: { kind: "manual", mode: "line-values" },
});

describe("Result Choice identity boundary", () => {
  it("renders the empty state immediately when the session is missing", () => {
    const html = renderToStaticMarkup(<ResultChoiceClient locale="en" />);
    expect(html).toContain("data-result-choice-empty");
    expect(html).not.toContain('data-result-choice="true"');
    expect(html).toContain("No completed cast was found");
  });

  it("does not render a stored reading just because one exists", () => {
    const memory = new Map<string, string>([
      ["quickiching:public-v1:pending-completed-reading:" + ID_A, "irrelevant-for-this-assertion"],
    ]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: () => {},
        removeItem: () => {},
        key: () => null,
        length: memory.size,
      },
    });
    const html = renderToStaticMarkup(<ResultChoiceClient locale="en" />);
    expect(html).toContain("data-result-choice-empty");
    vi.unstubAllGlobals();
  });

  it("renders the exact server reading when the page resolved session A", () => {
    const html = renderToStaticMarkup(
      <ResultChoiceClient locale="en" initialSessionId={ID_A} initialReading={reading} />,
    );
    expect(html).toContain("data-result-choice");
    expect(html).toContain(`data-reading-session="${ID_A}"`);
    expect(html).toContain(`href="/readings/result?session=${ID_A}"`);
  });

  it("shows a restoring state, never another reading, while an exact session resolves", () => {
    const html = renderToStaticMarkup(<ResultChoiceClient locale="en" initialSessionId={ID_A} />);
    expect(html).toContain("Restoring your completed cast");
    expect(html).not.toContain("data-result-choice-empty");
  });
});
