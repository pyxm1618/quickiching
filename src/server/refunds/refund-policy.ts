const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type RefundAutoScreen = "clear" | "manual_exception" | "rejected";

export type RefundScreenReasonCode =
  | "REFUND_WINDOW_EXPIRED"
  | "REFUND_ORDER_NOT_PAID"
  | "REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE";

export type RefundScreenResult =
  | { eligible: true; autoScreen: "clear"; reasonCode: null }
  | {
      eligible: true;
      autoScreen: "manual_exception";
      reasonCode: "REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE";
    }
  | {
      eligible: false;
      autoScreen: "rejected";
      reasonCode: "REFUND_WINDOW_EXPIRED" | "REFUND_ORDER_NOT_PAID";
    };

export interface RefundScreenInput {
  paidAt: Date;
  now: Date;
  orderStatus: string;
  quantityTotal: number;
  quantityAvailable: number;
  quantityReserved: number;
  quantityConsumed: number;
  quantityRevoked: number;
}

export function screenRefundApplication(input: RefundScreenInput): RefundScreenResult {
  if (input.orderStatus !== "paid") {
    return {
      eligible: false,
      autoScreen: "rejected",
      reasonCode: "REFUND_ORDER_NOT_PAID",
    };
  }

  const ageMs = input.now.getTime() - input.paidAt.getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > REFUND_WINDOW_MS) {
    return {
      eligible: false,
      autoScreen: "rejected",
      reasonCode: "REFUND_WINDOW_EXPIRED",
    };
  }

  const fullyAvailable =
    input.quantityTotal > 0 &&
    input.quantityAvailable === input.quantityTotal &&
    input.quantityReserved === 0 &&
    input.quantityConsumed === 0 &&
    input.quantityRevoked === 0;

  if (!fullyAvailable) {
    return {
      eligible: true,
      autoScreen: "manual_exception",
      reasonCode: "REFUND_ENTITLEMENTS_NOT_FULLY_AVAILABLE",
    };
  }

  return { eligible: true, autoScreen: "clear", reasonCode: null };
}
