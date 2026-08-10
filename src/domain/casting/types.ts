// Core domain types shared by the credential-free public tools and the future commercial flow.

export type CastingMethod = "three_coin" | "yarrow_stalk" | "mei_hua_current_time";

export const CASTING_METHODS: CastingMethod[] = [
  "three_coin",
  "yarrow_stalk",
  "mei_hua_current_time",
];

// 6 = old yin (changes to yang), 7 = young yang, 8 = young yin, 9 = old yang (changes to yin)
export type LineValue = 6 | 7 | 8 | 9;

export const ALGORITHM_VERSIONS = {
  three_coin: "three-coin-v1",
  yarrow_stalk: "yarrow-zhu-xi-digital-v2",
  mei_hua_current_time: "mei-hua-gregorian-current-time-v2",
} as const;

export const CLASSIC_MAPPING_VERSION = "king-wen-v1";

// Six lines are always stored bottom-up: index 0 = line 1, index 5 = line 6.
export type HexagramResult = {
  lineValuesBottomUp: readonly [LineValue, LineValue, LineValue, LineValue, LineValue, LineValue];
  primaryHexagramNumber: number;
  movingLinePositions: readonly number[];
  relatingHexagramNumber: number | null;
  method: CastingMethod;
  algorithmVersion: string;
  classicMappingVersion: string;
};

// Commercial V2 state machines remain in the repository but are not required by Public SEO V1.
export type CastingLifecycle =
  | "draft"
  | "casting"
  | "awaiting_reveal"
  | "revealed"
  | "expired"
  | "discarded_duplicate"
  | "emergency_blocked"
  | "user_deleted";

export type RiskStatus =
  | "not_checked"
  | "allowed"
  | "professional_decision_blocked"
  | "needs_clarification"
  | "emergency_blocked";

export type PreviewStatus =
  | "not_started"
  | "queued"
  | "generating"
  | "completed"
  | "failed"
  | "blocked";

export type ReadingStatus =
  | "not_started"
  | "reserved"
  | "queued"
  | "generating"
  | "validating"
  | "completed"
  | "failed"
  | "blocked";

export type ReservationStatus = "reserved" | "consumed" | "released" | "expired";

export type QualityReviewStatus =
  | "not_started"
  | "submitted"
  | "supplementing"
  | "in_review"
  | "approved"
  | "rejected";

export const SCENES = [
  "career",
  "relationships",
  "wealth",
  "timing",
  "choices",
  "personal_growth",
  "other",
] as const;
export type Scene = (typeof SCENES)[number];

export const INTERPRETATION_GOALS = [
  "what_do_i_need_to_see_clearly",
  "what_is_blocking_this_situation",
  "what_should_i_understand_about_my_options",
  "what_should_i_pay_attention_to_next",
  "is_the_timing_favorable",
] as const;
export type InterpretationGoal = (typeof INTERPRETATION_GOALS)[number];

export const QUESTION_MIN_CHARS = 20;
export const QUESTION_MAX_CHARS = 1000;
