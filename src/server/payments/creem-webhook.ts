import type {
  CheckoutCompletedEvent,
  CreemPaymentEvent,
  DisputeCreatedEvent,
  RefundCreatedEvent,
} from "@/server/repositories/postgres/payment-repository";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function occurredAt(root: JsonRecord, receivedAt: Date): Date {
  const created = root.created_at;
  const value = typeof created === "number"
    ? new Date(created)
    : typeof created === "string"
      ? new Date(created)
      : receivedAt;
  if (Number.isNaN(value.getTime())) throw new Error("CREEM_WEBHOOK_DATE_INVALID");
  return value;
}

function checkoutProductId(object: JsonRecord, order: JsonRecord): string | null {
  const direct = stringField(order.product) ?? stringField(object.product);
  if (direct) return direct;
  return stringField(record(order.product)?.id) ?? stringField(record(object.product)?.id);
}

function parseCheckoutCompleted(
  root: JsonRecord,
  eventId: string,
  receivedAt: Date,
  payload: unknown,
): CheckoutCompletedEvent {
  const object = record(root.object) ?? record(root.data);
  const order = record(object?.order);
  const transaction = record(object?.transaction) ?? record(order?.transaction);
  const checkoutId = stringField(object?.id);
  const requestId = stringField(object?.request_id);
  const providerOrderId = stringField(order?.id);
  const providerProductId = object && order ? checkoutProductId(object, order) : null;
  const amountMinor = nonNegativeInteger(order?.amount);
  const currency = stringField(order?.currency);
  if (
    !object
    || !order
    || !checkoutId
    || !requestId
    || !providerOrderId
    || !providerProductId
    || amountMinor === null
    || !currency
  ) {
    throw new Error("CREEM_WEBHOOK_SCHEMA_INVALID");
  }
  return {
    eventId,
    eventType: "checkout.completed",
    checkoutId,
    providerOrderId,
    providerTransactionId: stringField(transaction?.id),
    requestId,
    providerProductId,
    amountMinor,
    currency: currency.toUpperCase(),
    occurredAt: occurredAt(root, receivedAt),
    payload,
  };
}

function transactionOrderId(transaction: JsonRecord | null): string | null {
  const direct = stringField(transaction?.order);
  if (direct) return direct;
  return stringField(record(transaction?.order)?.id);
}

function parseRefund(
  root: JsonRecord,
  eventId: string,
  receivedAt: Date,
  payload: unknown,
): RefundCreatedEvent {
  const object = record(root.object) ?? record(root.data);
  const transaction = record(object?.transaction);
  const refundId = stringField(object?.id);
  const status = stringField(object?.status);
  const amountMinor = nonNegativeInteger(object?.refund_amount);
  const currency = stringField(object?.refund_currency);
  const providerTransactionId = stringField(transaction?.id);
  const providerOrderId = transactionOrderId(transaction);
  if (
    !object
    || !transaction
    || !refundId
    || !status
    || amountMinor === null
    || !currency
    || !providerTransactionId
    || !providerOrderId
  ) {
    throw new Error("CREEM_WEBHOOK_SCHEMA_INVALID");
  }
  return {
    eventId,
    eventType: "refund.created",
    refundId,
    status,
    providerOrderId,
    providerTransactionId,
    amountMinor,
    currency: currency.toUpperCase(),
    occurredAt: occurredAt(root, receivedAt),
    payload,
  };
}

function parseDispute(
  root: JsonRecord,
  eventId: string,
  receivedAt: Date,
  payload: unknown,
): DisputeCreatedEvent {
  const object = record(root.object) ?? record(root.data);
  const transaction = record(object?.transaction);
  const disputeId = stringField(object?.id);
  const amountMinor = nonNegativeInteger(object?.amount);
  const currency = stringField(object?.currency);
  const providerTransactionId = stringField(transaction?.id);
  const providerOrderId = transactionOrderId(transaction);
  if (
    !object
    || !transaction
    || !disputeId
    || amountMinor === null
    || !currency
    || !providerTransactionId
    || !providerOrderId
  ) {
    throw new Error("CREEM_WEBHOOK_SCHEMA_INVALID");
  }
  return {
    eventId,
    eventType: "dispute.created",
    disputeId,
    providerOrderId,
    providerTransactionId,
    amountMinor,
    currency: currency.toUpperCase(),
    occurredAt: occurredAt(root, receivedAt),
    payload,
  };
}

export function parseCreemWebhook(rawBody: string, receivedAt = new Date()):
  | CreemPaymentEvent
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

  switch (eventType) {
    case "checkout.completed":
      return parseCheckoutCompleted(root, eventId, receivedAt, payload);
    case "refund.created":
      return parseRefund(root, eventId, receivedAt, payload);
    case "dispute.created":
      return parseDispute(root, eventId, receivedAt, payload);
    default:
      return { eventId, eventType, payload, ignored: true };
  }
}
