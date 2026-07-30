import type { RiskStatus, Scene } from "../casting/types";
import {
  EMERGENCY_OTHER_HARM,
  EMERGENCY_SELF_HARM,
  EMPLOYMENT_OR_PROJECT_CONTEXT,
  GENERAL_DECISION_REQUEST,
  INVESTMENT_OBJECT,
  LEGAL_OBJECT,
  MEDICAL_OBJECT,
  VAGUE_HIGH_RISK_REQUEST,
  hasDirectInvestmentDecision,
  hasDirectLegalDecision,
  hasDirectMedicalDecision,
} from "./rules";

export const RISK_RULE_VERSION = "risk-v2";

export type RiskDecision = {
  status: RiskStatus;
  ruleVersion: string;
  matchedRuleCodes: string[];
  reasonCode: string;
};

function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function detectEmergency(text: string): boolean {
  const normalized = normalize(text);
  return [...EMERGENCY_SELF_HARM, ...EMERGENCY_OTHER_HARM].some((pattern) => pattern.test(normalized));
}

export function evaluateRisk(rawQuestion: string, _scene: Scene): RiskDecision {
  const text = normalize(rawQuestion);

  if (EMERGENCY_SELF_HARM.some((pattern) => pattern.test(text))) {
    return {
      status: "emergency_blocked",
      ruleVersion: RISK_RULE_VERSION,
      matchedRuleCodes: ["emergency_self_harm"],
      reasonCode: "emergency",
    };
  }
  if (EMERGENCY_OTHER_HARM.some((pattern) => pattern.test(text))) {
    return {
      status: "emergency_blocked",
      ruleVersion: RISK_RULE_VERSION,
      matchedRuleCodes: ["emergency_other_harm"],
      reasonCode: "emergency",
    };
  }

  const hasMedical = MEDICAL_OBJECT.test(text);
  const hasInvestment = INVESTMENT_OBJECT.test(text);
  const hasLegal = LEGAL_OBJECT.test(text);
  const hasProfessionalObject = hasMedical || hasInvestment || hasLegal;
  const hasEmploymentOrProjectContext = EMPLOYMENT_OR_PROJECT_CONTEXT.test(text);
  const directMedical = hasDirectMedicalDecision(text);
  const directInvestment = hasDirectInvestmentDecision(text);
  const directLegal = hasDirectLegalDecision(text);

  const codes: string[] = [];
  if (hasMedical) codes.push("medical_object");
  if (hasInvestment) codes.push("investment_object");
  if (hasLegal) codes.push("legal_object");
  if (hasEmploymentOrProjectContext) codes.push("employment_or_project_context");
  if (directMedical) codes.push("direct_medical_decision");
  if (directInvestment) codes.push("direct_investment_decision");
  if (directLegal) codes.push("direct_legal_decision");

  if (directMedical || directInvestment || directLegal) {
    const kind = directMedical ? "medical" : directInvestment ? "investment" : "legal";
    return {
      status: "professional_decision_blocked",
      ruleVersion: RISK_RULE_VERSION,
      matchedRuleCodes: codes,
      reasonCode: `professional_decision_${kind}`,
    };
  }

  if (hasProfessionalObject && GENERAL_DECISION_REQUEST.test(text) && !hasEmploymentOrProjectContext) {
    const kind = hasMedical ? "medical" : hasInvestment ? "investment" : "legal";
    return {
      status: "professional_decision_blocked",
      ruleVersion: RISK_RULE_VERSION,
      matchedRuleCodes: [...codes, "general_professional_decision_request"],
      reasonCode: `professional_decision_${kind}`,
    };
  }

  if (hasProfessionalObject && VAGUE_HIGH_RISK_REQUEST.test(text)) {
    return {
      status: "needs_clarification",
      ruleVersion: RISK_RULE_VERSION,
      matchedRuleCodes: [...codes, "ambiguous_professional_context"],
      reasonCode: "high_risk_ambiguous_request",
    };
  }

  if (hasProfessionalObject) {
    return {
      status: "allowed",
      ruleVersion: RISK_RULE_VERSION,
      matchedRuleCodes: codes,
      reasonCode: hasEmploymentOrProjectContext
        ? "employment_or_project_context"
        : "high_risk_mention_no_action",
    };
  }

  return {
    status: "allowed",
    ruleVersion: RISK_RULE_VERSION,
    matchedRuleCodes: [],
    reasonCode: "none",
  };
}
