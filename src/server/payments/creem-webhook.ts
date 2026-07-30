import type { CheckoutCompletedEvent } from "@/server/repositories/postgres/payment-repository";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function productId(object: JsonRecord, order: JsonRecord): string | null {
  const direct = stringField(order.product) ?? stringField(object.product);
  if (direct) return direct;
  return stringField(record(order.product)?.id) ?? stringField(record(object.product)?.id);
}

export function parseCreemWebhook(rawBody: string, receivedAt = new Date()):
  | CheckoutCompletedEvent
  | { eventId: string; eventType: string; payload: unknown; ignored: true } {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Error("CREEM_WEBHOOK_JSON_INVALID");
  }
  const root = record(payload);
  const eventId = stringField(root?.id);
  const eventType = stringField(root?.eventType) ?? stringField(root?.type);
  if (!root || !eventId || !eventType) throw new Error("CREEM_WEBHOOK_SCHEMA_INVALID");
  if (eventType !== "checkout.completed") {
    return { eventId, eventType, payload, ignored: true };
  }

  const object = record(root.object) ?? record(root.data);
  const order = record(object?.order);
  const checkoutId = stringField(object?.id);
  const requestId = stringField(object?.request_id);
  const providerProductId = object && order ? productId(object, order) : null;
  const amountMinor = order?.amount;
  const currency = stringField(order?.currency);
  if (
    !object
    || !order
    || !checkoutId
    || !requestId
    || !providerProductId
    || typeof amountMinor !== "number"
    || !Number.isSafeInteger(amountMinor)
    || amountMinor < 0
    || !currency
  ) {
    throw new Error("CREEM_WEBHOOK_SCHEMA_INVALID");
  }

  const created = root.created_at;
  const occurredAt = typeof created === "number"
    ? new Date(created)
    : typeof created === "string"
      ? new Date(created)
      : receivedAt;
  if (Number.isNaN(occurredAt.getTime())) throw new Error("CREEM_WEBHOOK_DATE_INVALID");

  return {
    eventId,
    eventType: "checkout.completed",
    checkoutId,
    requestId,
    providerProductId,
    amountMinor,
    currency: currency.toUpperCase(),
    occurredAt,
    payload,
  };
}
