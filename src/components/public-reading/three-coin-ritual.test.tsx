import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EnglishMethodPage from "@/app/(default)/methods/three-coin/page";
import ChineseMethodPage from "@/app/(localized)/zh/methods/three-coin/page";
import {
  ThreeCoinRitual,
  threeCoinExperienceStageForSession,
  useThreeCoinRitualContext,
} from "./three-coin-ritual";
import { THREE_COIN_SESSION_STORAGE_KEY } from "@/lib/three-coin-session";
import {
  clearLiveFlowRegistration,
  getLiveFlowRegistration,
  registerLiveFlow,
} from "@/lib/reading-resume";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const originalWindow = globalThis.window;

function installSessionStorage(initialMap: Record<string, string> = {}) {
  const values = new Map<string, string>(Object.entries(initialMap));
  const sessionStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } as Storage;
  (globalThis as any).window = { sessionStorage };
  return sessionStorage;
}

afterEach(() => {
  clearLiveFlowRegistration();
  (globalThis as any).window = originalWindow;
});
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

describe("C8 — Three Coin method page is SEO detail only", () => {
  it.each([
    ["EN", EnglishMethodPage, "/"],
    ["ZH", ChineseMethodPage, "/zh"],
  ] as const)("keeps a single H1, no ritual, and a canonical CTA on the %s method page", (_locale, Page, href) => {
    const html = renderMethodPage(<Page />);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).not.toContain("data-three-coin-ritual");
    expect(html).not.toContain("data-three-coin-presentation");
    expect(html).not.toContain("data-home-stage");
    expect(html).toContain("data-three-coin-method-detail-cta");
    const cta = /<a\b[^>]*data-three-coin-cta[^>]*>/u.exec(html)?.[0] ?? "";
    expect(cta).toContain(`href="${href}"`);
  });
});

describe("ThreeCoinRitual entry authority", () => {
  it("maps a resumed session to the single landing / confirmation / ritual flow", () => {
    expect(threeCoinExperienceStageForSession()).toBe("landing");
    expect(threeCoinExperienceStageForSession({ started: true, question: "Should I take this role?" })).toBe("question-confirm");
    expect(threeCoinExperienceStageForSession({
      started: true,
      question: "Should I take this role?",
      coreQuestionFrozenAtCast: true,
    })).toBe("ritual");
  });

  it("clears the active Three Coin registration when restartQuestion returns to landing", () => {
    const id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const question = "Should I accept the new role?";
    const storage = installSessionStorage({
      [THREE_COIN_SESSION_STORAGE_KEY]: JSON.stringify({
        schemaVersion: 1,
        id,
        createdAt: new Date().toISOString(),
        started: true,
        question,
        coreQuestionFrozenAtCast: false,
      }),
    });
    registerLiveFlow({ method: "three-coin", readingId: id, locale: "en" });

    let exposedContext: ReturnType<typeof useThreeCoinRitualContext> | undefined;
    function Capture() {
      exposedContext = useThreeCoinRitualContext();
      return null;
    }

    renderToStaticMarkup(
      <ThreeCoinRitual>
        <Capture />
      </ThreeCoinRitual>,
    );

    expect(getLiveFlowRegistration()).toMatchObject({
      method: "three-coin",
      readingId: id,
      locale: "en",
      active: true,
    });

    exposedContext?.restartQuestion();

    expect(storage.getItem(THREE_COIN_SESSION_STORAGE_KEY)).toBeNull();
    expect(getLiveFlowRegistration()).toBeNull();
  });

  it("renders the normal landing entry instead of restoring a saved stage", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinRitual>
        <div data-formal-casting-ui>Casting UI</div>
      </ThreeCoinRitual>,
    );
    expect(html).toContain('data-three-coin-ritual="true"');
    expect(html).toContain('data-experience-stage="landing"');
    expect(html).not.toContain("data-ritual-question-context");
    expect(html).toContain("Start Divination");
  });

  it("renders confirmation without the retired generic Three-Coin presentation", () => {
    const html = renderToStaticMarkup(
      <ThreeCoinRitual>
        <div data-formal-casting-ui>Casting UI</div>
      </ThreeCoinRitual>,
    );
    expect(html).not.toContain("Cast six lines, bottom to top");
    expect(html).not.toContain("mystic-card");
  });
});
