import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QuestionFirst, useQuestionFirstContext } from "./question-first";
import { patchPublicReadingSession, readPublicReadingSessionState } from "@/lib/public-reading-session";

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

describe("QuestionFirst component question freeze regressions", () => {
  beforeEach(() => {
    installSessionStorage();
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it("renders New Question button when started but not yet frozen", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    installSessionStorage({
      "test-reading": JSON.stringify({
        schemaVersion: 1,
        id: "r1",
        createdAt: new Date().toISOString(),
        started: true,
        question: "Is this job offer right for me?",
        coreQuestionFrozenAtCast: false,
      }),
    });

    const html = renderToStaticMarkup(
      <QuestionFirst
        storageKey="test-reading"
        initialSession={{ started: true, question: "Is this job offer right for me?", coreQuestionFrozenAtCast: false }}
      >
        <div>Casting UI</div>
      </QuestionFirst>,
    );

    expect(html).toContain("New question");
    expect(html).toContain("Casting UI");
  });

  it("hides New Question button when core question is frozen at cast", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    installSessionStorage({
      "test-reading": JSON.stringify({
        schemaVersion: 1,
        id: "r1",
        createdAt: new Date().toISOString(),
        started: true,
        question: "Is this job offer right for me?",
        coreQuestionAtCast: "Is this job offer right for me?",
        coreQuestionFrozenAtCast: true,
      }),
    });

    const html = renderToStaticMarkup(
      <QuestionFirst
        storageKey="test-reading"
        initialSession={{
          started: true,
          question: "Is this job offer right for me?",
          coreQuestionAtCast: "Is this job offer right for me?",
          coreQuestionFrozenAtCast: true,
        }}
      >
        <div>Casting UI</div>
      </QuestionFirst>,
    );

    expect(html).not.toContain("New Question");
    expect(html).toContain("This core question is locked to this cast");
  });

  it("prevents restartQuestion from clearing session when core question is frozen", async () => {
    const key = "test-reading-frozen";
    installSessionStorage();
    patchPublicReadingSession(key, {
      started: true,
      question: "My Frozen Question",
      coreQuestionAtCast: "My Frozen Question",
      coreQuestionFrozenAtCast: true,
    });

    let exposedContext: ReturnType<typeof useQuestionFirstContext>;
    function Capture() {
      exposedContext = useQuestionFirstContext();
      return null;
    }

    const { renderToStaticMarkup } = await import("react-dom/server");
    renderToStaticMarkup(
      <QuestionFirst storageKey={key}>
        <Capture />
      </QuestionFirst>,
    );

    // Call restartQuestion when frozen
    exposedContext?.restartQuestion();

    // Verify session state remained locked and was not deleted or reset
    const state = readPublicReadingSessionState(key);
    expect(state.started).toBe(true);
    expect(state.coreQuestionFrozenAtCast).toBe(true);
    expect(state.coreQuestionAtCast).toBe("My Frozen Question");
  });
});
