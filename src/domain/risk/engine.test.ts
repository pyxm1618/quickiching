import { describe, expect, it } from "vitest";
import { evaluateRisk } from "./engine";

function status(question: string, scene: "career" | "wealth" | "other" = "other") {
  return evaluateRisk(question, scene).status;
}

describe("deterministic risk engine goldens", () => {
  it.each([
    "I am going to kill myself tonight.",
    "I plan to end my life.",
    "I want to hurt someone at work.",
    "I am thinking about self-harm.",
  ])("blocks explicit emergency language: %s", (question) => {
    expect(status(question)).toBe("emergency_blocked");
  });

  it.each([
    "Should I change my insulin dose tonight?",
    "Should I stop taking my prescribed medication?",
    "Can I double my antidepressant dosage?",
    "Should I stop chemotherapy even though I work at a hospital?",
  ])("blocks personalized medical decisions even when employment context is present: %s", (question) => {
    expect(status(question, "career")).toBe("professional_decision_blocked");
  });

  it.each([
    "Should I accept the prosecutor's plea deal before court?",
    "Should I plead guilty in this criminal case?",
    "Should I settle the lawsuit this week?",
  ])("blocks personalized legal decisions: %s", (question) => {
    expect(status(question)).toBe("professional_decision_blocked");
  });

  it.each([
    "Should I buy Bitcoin?",
    "Ｓｈｏｕｌｄ I sell my ETF today?",
    "Do you think I should trade these stock options?",
  ])("blocks personalized investment transactions: %s", (question) => {
    expect(status(question, "wealth")).toBe("professional_decision_blocked");
  });

  it.each([
    "I work at a crypto company. Should I accept a product manager role?",
    "Should our pharmaceutical marketing project continue?",
    "Should I take a job at an investment fund?",
  ])("does not misclassify employment or project decisions: %s", (question) => {
    expect(status(question, "career")).toBe("allowed");
  });

  it.each([
    "Chemotherapy is part of the situation and I need guidance.",
    "There is a court case involved. What should I do?",
    "Crypto is involved and I need help understanding the question.",
  ])("requires clarification for ambiguous high-risk mentions: %s", (question) => {
    expect(status(question)).toBe("needs_clarification");
  });

  it.each([
    "What should I understand about communication in this relationship?",
    "What is blocking progress on this ordinary software project?",
    "What signs should I watch before accepting a new non-financial role?",
  ])("allows ordinary reflective questions: %s", (question) => {
    expect(status(question, "career")).toBe("allowed");
  });
});
