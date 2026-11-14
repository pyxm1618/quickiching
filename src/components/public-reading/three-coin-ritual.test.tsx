import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EnglishMethodPage from "@/app/(default)/methods/three-coin/page";
import ChineseMethodPage from "@/app/(localized)/zh/methods/three-coin/page";
import { ThreeCoinRitual, threeCoinExperienceStageForSession } from "./three-coin-ritual";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
function renderMethodPage(element: React.ReactNode): string {
  const classicGlobal = globalThis as typeof globalThis & { React?: typeof React };
  const previousReact = classicGlobal.React;
  classicGlobal.React = React;
  try { return renderToStaticMarkup(element); }
  finally {
    if (previousReact) classicGlobal.React = previousReact;
    else Reflect.deleteProperty(classicGlobal, "React");
  }
}

describe("ThreeCoinRitual formal flow", () => {
  it.each([["EN", EnglishMethodPage], ["ZH", ChineseMethodPage]] as const)("keeps a single page H1 and runs no second product on the %s SEO method detail", (_locale, Page) => {
    const html = renderMethodPage(<Page />);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    // V12: the SEO method detail describes the method and hands over to the one
    // canonical product entry; it must never mount a second casting product.
    expect(html).not.toContain('data-three-coin-ritual="true"');
    expect(html).toContain("data-three-coin-canonical-entry");
    expect(html).toContain("data-three-coin-entry-cta");
  });
  it.each([["EN", EnglishMethodPage, "/"], ["ZH", ChineseMethodPage, "/zh"]] as const)("points the %s method detail CTA at the localized canonical entry", (_locale, Page, href) => {
    const html = renderMethodPage(<Page />);
    const cta = html.match(/<a[^>]*data-three-coin-entry-cta[^>]*>/u)?.[0] ?? "";
    expect(cta).toContain(`href="${href}"`);
  });
  it("maps the current session state to the single landing / confirmation / ritual flow", () => {
    expect(threeCoinExperienceStageForSession()).toBe("landing");
    expect(threeCoinExperienceStageForSession({ started: true, question: "Should I take this role?" })).toBe("question-confirm");
    expect(threeCoinExperienceStageForSession({
      started: true,
      question: "Should I take this role?",
      coreQuestionFrozenAtCast: true,
    })).toBe("ritual");
  });

  it("renders confirmation without the retired generic Three-Coin presentation", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinRitual initialSession={{ started: true, question: "Should I take this role?", coreQuestionFrozenAtCast: false }}>
        <div data-formal-casting-ui>Casting UI</div>
      </ThreeCoinRitual>,
    );
    expect(html).toContain('data-three-coin-ritual="true"');
    expect(html).toContain('data-experience-stage="question-confirm"');
    expect(html).toContain("Should I take this role?");
    expect(html).toContain("Cast the Coins");
    expect(html).not.toContain("Cast six lines, bottom to top");
    expect(html).not.toContain("mystic-card");
  });

  it("restores a frozen partial cast directly to the same formal ritual", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinRitual initialSession={{
        started: true,
        question: "Should I take this role?",
        coreQuestionAtCast: "Should I take this role?",
        coreQuestionFrozenAtCast: true,
      }}>
        <div data-formal-casting-ui>Casting UI</div>
      </ThreeCoinRitual>,
    );
    expect(html).toContain('data-experience-stage="ritual"');
    expect(html).toContain("Should I take this role?");
    expect(html).toContain("Casting UI");
    expect(html).toContain("disabled");
  });
});
