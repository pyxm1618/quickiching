import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ThreeCoinRitual, threeCoinExperienceStageForSession } from "./three-coin-ritual";

describe("ThreeCoinRitual formal flow", () => {
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
