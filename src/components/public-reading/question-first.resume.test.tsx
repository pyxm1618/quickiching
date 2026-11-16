import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  QuestionFirst,
  useQuestionFirstResumeBoundary,
} from "./question-first";
import { YARROW_SESSION_STORAGE_KEY } from "@/lib/method-session-retirement";

function BoundaryProbe() {
  const boundary = useQuestionFirstResumeBoundary();
  return <span data-resume-probe={String(boundary.resumeRequested)} />;
}

describe("C1 — QuestionFirst passive resume boundary", () => {
  it("renders the normal question entry and does not mount the method adapter", () => {
    const html = renderToStaticMarkup(
      <QuestionFirst storageKey={YARROW_SESSION_STORAGE_KEY} resumeMethod="yarrow-stalks">
        <span data-method-adapter="yarrow" />
      </QuestionFirst>,
    );
    expect(html).toContain("data-question-first");
    expect(html).toContain("textarea");
    expect(html).toContain(`id="${YARROW_SESSION_STORAGE_KEY}-question"`);
    expect(html).not.toContain("data-method-adapter");
    // The active-question stage is the passive restore target and must not appear.
    expect(html).not.toContain(`id="${YARROW_SESSION_STORAGE_KEY}-active-question"`);
  });

  it("exposes a non-resumed boundary to its children by default", () => {
    const html = renderToStaticMarkup(<BoundaryProbe />);
    expect(html).toContain('data-resume-probe="false"');
  });

  it("never writes a passively restored session state into the UI stage", () => {
    const source = readFileSync(new URL("./question-first.tsx", import.meta.url), "utf8");
    const mountEffect = /useEffect\(\(\) => \{[\s\S]*?\}, \[resumeMethod, storageKey\]\);/u.exec(source)?.[0] ?? "";
    expect(mountEffect).toContain("detectMethodResume");
    expect(mountEffect).toContain("setResumeState(detected)");
    expect(mountEffect).toContain('detected.kind === "sealed"');
    expect(mountEffect).not.toContain("setQuestionState");
    expect(mountEffect).not.toContain("setDraft");

    // Current-main C9 authority is the shared reading-resume hook. It invokes
    // the same explicit Resume primitive; it does not passively restore UI state.
    expect(source).toContain("useLocaleContinuationActivation({");
    expect(source).toContain("activate: () => requestResume()");
    const requestResume = /function requestResume\(\) \{[\s\S]*?\n  \}/u.exec(source)?.[0] ?? "";
    expect(requestResume).toContain("detectMethodResume");
    expect(requestResume).toContain("readPublicReadingSessionState");
    expect(requestResume).toContain("setQuestionState");
    expect(requestResume).toContain("setResumeRequested(true)");
    expect(source).toContain("resumeRequested");
  });

  it("keeps the explicit-injection prop for tests without making it a passive restore", () => {
    const html = renderToStaticMarkup(
      <QuestionFirst
        storageKey="explicit-injected-session"
        resumeMethod="manual"
        initialSession={{ started: true, question: "Injected by the caller" }}
      >
        <span data-method-adapter="manual" />
      </QuestionFirst>,
    );
    expect(html).toContain("data-method-adapter");
    expect(html).toContain("Injected by the caller");
  });
});
