export const EMERGENCY_SELF_HARM = [
  /\b(i (?:am going to|plan to|want to|might|will) )?(?:kill myself|end my life|take my own life|hurt myself|harm myself|cut myself)\b/i,
  /\b(?:suicidal|suicide plan|self[\s-]?harm(?:ing)?|overdose to die)\b/i,
];

export const EMERGENCY_OTHER_HARM = [
  /\b(i (?:am going to|plan to|want to|might|will) )?(?:kill|hurt|harm|attack) (?:him|her|them|someone|people|myself and others)\b/i,
];

export const MEDICAL_OBJECT = /\b(?:chemotherap\w*|chemo|insulin|medication|medicines?|meds|antidepressant\w*|dosage|dose|prescription|prescribed|surgery|surgical|diagnos\w*|treatment|vaccine|vaccination|therapy|mental health (?:treatment|care))\b/i;
export const INVESTMENT_OBJECT = /\b(?:bitcoin|crypto(?:currency)?|stocks?|etf|forex|options?|shares?|bonds?|mutual fund|investment fund)\b/i;
export const LEGAL_OBJECT = /\b(?:lawsuit|sue|suing|divorce|court(?: case)?|criminal case|litigation|custody(?: battle)?|legal action|plea deal|plead guilty|prosecutor|settlement|appeal)\b/i;

export const GENERAL_DECISION_REQUEST = /\b(?:should i|should we|should he|should she|recommend|advise|tell me (?:to|whether)|is it (?:wise|ok|safe|right) to|can i|ought i|do you think i should|what should i do)\b/i;
export const VAGUE_HIGH_RISK_REQUEST = /\b(?:need guidance|need help|what should i do|what do i do|please help|help me understand)\b/i;
export const EMPLOYMENT_OR_PROJECT_CONTEXT = /\b(?:work(?:ing)? at|company|companies|role|job|career|project|marketing|business|employer|industry|product manager|hospital)\b/i;

const MEDICAL_ACTION = /\b(?:stop|start|take|skip|change|increase|decrease|double|reduce|adjust|switch|continue|undergo|have|refuse)\b/i;
const INVESTMENT_ACTION = /\b(?:buy|sell|invest(?: in)?|hold|trade|short|purchase|liquidate)\b/i;
const LEGAL_ACTION = /\b(?:accept|reject|plead|file|pursue|settle|appeal|sign|contest|withdraw)\b/i;

function appearsNear(text: string, first: RegExp, second: RegExp, distance = 80): boolean {
  const firstMatch = first.exec(text);
  const secondMatch = second.exec(text);
  if (!firstMatch || !secondMatch) return false;
  return Math.abs(firstMatch.index - secondMatch.index) <= distance;
}

export function hasDirectMedicalDecision(text: string): boolean {
  return MEDICAL_OBJECT.test(text) && (
    appearsNear(text, MEDICAL_OBJECT, MEDICAL_ACTION)
    || GENERAL_DECISION_REQUEST.test(text) && MEDICAL_ACTION.test(text)
  );
}

export function hasDirectInvestmentDecision(text: string): boolean {
  return INVESTMENT_OBJECT.test(text) && appearsNear(text, INVESTMENT_OBJECT, INVESTMENT_ACTION);
}

export function hasDirectLegalDecision(text: string): boolean {
  return LEGAL_OBJECT.test(text) && (
    appearsNear(text, LEGAL_OBJECT, LEGAL_ACTION)
    || GENERAL_DECISION_REQUEST.test(text) && /\b(?:divorce|lawsuit|custody|court|criminal case)\b/i.test(text)
  );
}
