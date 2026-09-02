/**
 * Payment completion is asynchronous: Waffo notifies our webhook, the webhook
 * writes an outbox row, and a dispatcher grants the credits. Nothing about the
 * buyer returning to the site tells us the order is paid, so the page that is
 * waiting has to ask. This module holds the parts of that wait that are worth
 * testing without a browser.
 */

/** Stop asking after this long. Not a failure — the webhook may simply be slow. */
export const ORDER_POLL_TIMEOUT_MS = 15 * 60_000;
export const ORDER_POLL_BASE_DELAY_MS = 2_000;
export const ORDER_POLL_MAX_DELAY_MS = 15_000;

/**
 * Gentle exponential backoff. The first checks are close together because most
 * webhooks land within seconds; later ones spread out so a slow settlement does
 * not turn into hundreds of requests.
 */
export function nextPollDelayMs(attempt: number): number {
  if (attempt < 1) return ORDER_POLL_BASE_DELAY_MS;
  const delay = ORDER_POLL_BASE_DELAY_MS * Math.pow(1.5, attempt - 1);
  return Math.min(Math.round(delay), ORDER_POLL_MAX_DELAY_MS);
}

export type OrderStatusBody = {
  status: string;
  productKey: string;
  quantity: number;
};

export type OrderProbe =
  | { kind: "paid"; order: OrderStatusBody }
  | { kind: "pending"; order: OrderStatusBody }
  | { kind: "refunded"; order: OrderStatusBody }
  | { kind: "review"; order: OrderStatusBody }
  | { kind: "not_found" }
  | { kind: "unauthorized" }
  | { kind: "unavailable" };

function asOrderBody(body: unknown): OrderStatusBody | null {
  if (!body || typeof body !== "object") return null;
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.status !== "string" || !candidate.status) return null;
  if (typeof candidate.productKey !== "string") return null;
  if (typeof candidate.quantity !== "number" || !Number.isFinite(candidate.quantity)) return null;
  return { status: candidate.status, productKey: candidate.productKey, quantity: candidate.quantity };
}

/**
 * A shape we do not recognise is reported as unavailable rather than guessed
 * at: telling the buyer their payment is still processing is always safe, and
 * inventing "paid" from a malformed body never is.
 */
export function classifyOrderResponse(httpStatus: number, body: unknown): OrderProbe {
  if (httpStatus === 401) return { kind: "unauthorized" };
  if (httpStatus === 404) return { kind: "not_found" };
  if (httpStatus !== 200) return { kind: "unavailable" };

  const order = asOrderBody(body);
  if (!order) return { kind: "unavailable" };

  switch (order.status) {
    case "paid":
      return { kind: "paid", order };
    case "refunded":
      return { kind: "refunded", order };
    case "financial_review":
      return { kind: "review", order };
    case "pending":
    case "checkout_initializing":
    case "checkout_created":
      return { kind: "pending", order };
    default:
      return { kind: "unavailable" };
  }
}

export async function probeOrder(orderId: string, signal?: AbortSignal): Promise<OrderProbe> {
  let response: Response;
  try {
    response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal,
    });
  } catch {
    return { kind: "unavailable" };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return classifyOrderResponse(response.status, body);
}
