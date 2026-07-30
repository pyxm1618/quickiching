import * as z from "zod";
import {
  INTERPRETATION_GOALS,
  QUESTION_MAX_CHARS,
  QUESTION_MIN_CHARS,
  SCENES,
} from "@/domain/casting/types";
import { DomainError } from "@/server/errors/domain-error";

const identifier = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-f0-9]{24}$`));
const castingId = identifier("cas");
const readingId = identifier("rdg");
const orderId = identifier("ord");
const email = z.string().trim().toLowerCase().email();
const questionContext = z.string().trim().min(QUESTION_MIN_CHARS).max(QUESTION_MAX_CHARS);
const reviewReason = z.string().trim().min(1).max(2000);
const ianaTimeZone = z.string().trim().refine((value) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
});

export const actionSchemas = {
  createCastingSession: z.object({
    method: z.enum(["three_coin", "yarrow_stalk", "mei_hua_current_time"]),
    scene: z.enum(SCENES),
    interpretationGoal: z.enum(INTERPRETATION_GOALS),
  }),
  castingId: z.object({ castingId }),
  signIn: z.object({ email }),
  submitQuestion: z.object({ castingId, context: questionContext }),
  generateThreeCoinLine: z.object({ castingId, lineIndex: z.number().int().min(0).max(5) }),
  generateYarrowChange: z.object({
    castingId,
    lineIndex: z.number().int().min(0).max(5),
    changeIndex: z.number().int().min(0).max(2),
  }),
  createMeiHuaResult: z.object({ castingId, ianaTimeZone }),
  revealCasting: z.object({ castingId, email }),
  createCheckout: z.object({ productId: z.enum(["one", "three", "five"]) }),
  simulatePayment: z.object({ orderId }),
  submitQualityReview: z.object({ readingId, reason: reviewReason }),
};

export function parseActionInput<TSchema extends z.ZodTypeAny>(schema: TSchema, unknownInput: unknown): z.infer<TSchema> {
  const parsed = schema.safeParse(unknownInput);
  if (parsed.success) return parsed.data;

  const field = parsed.error.issues[0]?.path[0];
  throw new DomainError(
    "INVALID_ACTION_INPUT",
    "Invalid request input",
    false,
    typeof field === "string" ? field : undefined,
  );
}
