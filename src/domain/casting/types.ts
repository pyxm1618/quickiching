// Core domain types. Shared across algorithm, persistence, and UI layers.
// Strict typing per technical-design §6. No implicit any.

export type CastingMethod = "three_coin" | "yarrow_stalk" | "mei_hua_current_time";

export const CASTING_METHODS: CastingMethod[] = [
  "three_coin",
  "yarrow_stalk",
  "mei_hua_current_time",
];

// Line values per technical-design §6.1
// 6 = old yin (changes to yang), 7 = young yang, 8 = young yin, 9 = old yang (changes to yin)
export type LineValue = 6 | 7 | 8 | 9;

export const ALGORITHM_VERSIONS = {
  three_coin: "three-coin-v1",
  yarrow_stalk: "yarrow-v1",
  mei_hua_current_time: "mei-hua-v1",
} as const;

export const CLASSIC_MAPPING_VERSION = "king-wen-v1";

// §6.2 Unified result. Six lines stored bottom-up: index 0 = 初爻, index 5 = 上爻.
export type HexagramResult = {
  lineValuesBottomUp: readonly [LineValue, LineValue, LineValue, LineValue, LineValue, LineValue];
  primaryHexagramNumber: number; // 1..64 King Wen
  movingLinePositions: readonly number[]; // 1..6 ascending, unique
  relatingHexagramNumber: number | null; // null when no moving line
  method: CastingMethod;
  algorithmVersion: string;
  classicMappingVersion: string;
};

// §6.3 Orthogonal state machines — never combined into one `status`.
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

// §6.1 Scene / interpretation goal enums (single source of truth)
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

// Allowed public question context length (PRD §6.4)
export const QUESTION_MIN_CHARS = 20;
export const QUESTION_MAX_CHARS = 1000;
