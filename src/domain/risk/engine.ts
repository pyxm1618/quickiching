import type { RiskStatus, Scene } from "../casting/types";

// §11 Deterministic server-side risk engine. Combines:
//   high-risk object + decision action + scene context + exclusion context + emergency expressions.
// Never a single-keyword block. All LLM entrances are gated by this before generation.
// These rules are fail-closed: on any ambiguity we must not silently pass to the LLM in
// a way that violates the boundary; the product path is allowed only when clearly safe.

export const RISK_RULE_VERSION = "risk-v1";

export type RiskDecision = {
  status: RiskStatus;
  ruleVersion: string;
  matchedRuleCodes: string[];
  reasonCode: string; // public, non-sensitive
};

const EMERGENCY_PATTERNS: RegExp[] = [
  /\b(kill myself|suicid\w*|end my life|take my (own )?life|hurt myself|harm myself|self[\s-]?harm|cut myself)\b/i,
  /\b(kill (him|her|them|someone|people)|hurt (him|her|them|someone|people)|harm (him|her|them|others|someone))\b/i,
];

const MEDICAL_OBJECT: RegExp =
  /\b(chemotherap\w*|chemo|medication|medicines?|meds|antidepressant\w*|dosage|dose|prescription|prescribed|drug(s|s treatment)?|surgery|surgical|diagnos\w*|treatment|vaccine|vaccination|mental health (treatment|care))\b/i;

const INVESTMENT_OBJECT: RegExp =
  /\b(bitcoin|crypto(currency)?|stock(s)?|etf|forex|option(s)?|share(s)?|bond(s)?|mutual fund|investment fund)\b/i;

const LEGAL_OBJECT: RegExp =
  /\b(lawsuit|sue|suing|divorce|court case|litigation|custody battle|legal action)\b/i;

const DECISION_ACTION: RegExp =
  /\b(should i|should we|should he|should she|recommend|advise|tell me (to|whether)|is it (wise|ok|safe|right) to|can i|ought i|do you think i should)\b|\b(stop|start|take|buy|sell|quit|leave|accept|file|pursue|settle|begin|switch)\b/i;

const EMPLOYMENT_OR_PROJECT: RegExp =
  /\b(work(ing)? at|company|companies|role|job|career|project|marketing|business|employer)\b/i;

const AMBIGUOUS_HIGH_RISK_REQUEST: RegExp =
  /\b(need guidance|need help|what should i do|what do i do|please help)\b/i;

const DIRECT_INVESTMENT_ACTION: RegExp =
  /\b(buy|sell|invest in|hold|trade)\b.{0,40}\b(bitcoin|crypto(currency)?|stock(s)?|etf|forex|option(s)?|share(s)?|bond(s)?|mutual fund|investment fund)\b/i;

function normalize(text: string): string {
  // NFKC + lowercase for stable matching (Unicode variant cases are covered by tests).
  return text.normalize("NFKC").toLowerCase();
}

export function detectEmergency(text: string): boolean {
  const t = normalize(text);
  return EMERGENCY_PATTERNS.some((re) => re.test(t));
}

// Deterministic evaluation. `scene` is provided to support context-aware exclusion.
export function evaluateRisk(rawQuestion: string, scene: Scene): RiskDecision {
  const t = normalize(rawQuestion);
  const codes: string[] = [];

  if (detectEmergency(t)) {
    return {
      status: "emergency_blocked",
      ruleVersion: RISK_RULE_VERSION,
      matchedRuleCodes: ["emergency_self_or_other_harm"],
      reasonCode: "emergency",
    };
  }

  const hasMedical = MEDICAL_OBJECT.test(t);
  const hasInvestment = INVESTMENT_OBJECT.test(t);
  const hasLegal = LEGAL_OBJECT.test(t);
  const hasAction = DECISION_ACTION.test(t);
  const hasExclusion = EMPLOYMENT_OR_PROJECT.test(t);
  const hasDirectInvestmentAction = DIRECT_INVESTMENT_ACTION.test(t);

  if (hasMedical) codes.push("medical_object");
  if (hasInvestment) codes.push("investment_object");
  if (hasLegal) codes.push("legal_object");
  if (hasAction) codes.push("decision_action");
  if (hasExclusion) codes.push("exclusion_context");

  // Employment/project context is an exclusion only for an employment decision about an
  // industry, never for an explicit instruction to buy or sell an investment.
  const professionalBlock =
    (hasMedical || hasLegal) && hasAction && !hasExclusion ||
    hasInvestment && hasAction && (!hasExclusion || hasDirectInvestmentAction);

  if (professionalBlock) {
    const objectKind = hasMedical ? "medical" : hasInvestment ? "investment" : "legal";
    return {
      status: "professional_decision_blocked",
      ruleVersion: RISK_RULE_VERSION,
      matchedRuleCodes: codes,
      reasonCode: `professional_decision_${objectKind}`,
    };
  }

  // Object present but no decision action => mention only, not a decision request => allowed.
  // (Per §11.1, "chemotherapy" alone must not be blocked.)
  if (hasMedical || hasInvestment || hasLegal) {
    if (AMBIGUOUS_HIGH_RISK_REQUEST.test(t)) {
      return {
        status: "needs_clarification",
        ruleVersion: RISK_RULE_VERSION,
        matchedRuleCodes: codes,
        reasonCode: "high_risk_ambiguous_request",
      };
    }
    return {
      status: "allowed",
      ruleVersion: RISK_RULE_VERSION,
      matchedRuleCodes: codes,
      reasonCode: "high_risk_mention_no_action",
    };
  }

  return {
    status: "allowed",
    ruleVersion: RISK_RULE_VERSION,
    matchedRuleCodes: [],
    reasonCode: "none",
  };
}
