/**
 * Two small pieces of browser-local state that survive the trip to the payment
 * page and back. Both are conveniences, never authority: the server decides
 * what a reader owns and what they may read. A private window, cleared storage
 * or a different device simply loses them, and every caller must cope with
 * null rather than assume.
 */

const PENDING_ORDER_KEY = "quickiching.pendingOrder";
const PENDING_DEEP_READING_KEY = "quickiching.pendingDeepReading";

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

function session(): Storage | null {
  try {
    // Reading the property itself throws in browsers configured to block site data.
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function remember(key: string, value: string): void {
  if (!UUID.test(value)) return;
  try {
    session()?.setItem(key, value);
  } catch {
    // Storage is full or blocked; the flow degrades to "check your account".
  }
}

function recall(key: string): string | null {
  let stored: string | null = null;
  try {
    stored = session()?.getItem(key) ?? null;
  } catch {
    return null;
  }
  // Anything that is not a well-formed id is discarded rather than sent to an API.
  return stored && UUID.test(stored) ? stored : null;
}

function forget(key: string): void {
  try {
    session()?.removeItem(key);
  } catch {
    // Nothing to do; a stale value is re-validated on read anyway.
  }
}

/** The order a buyer has just been sent to pay for, so the return page can find it. */
export function rememberPendingOrder(orderId: string): void {
  remember(PENDING_ORDER_KEY, orderId);
}

export function readPendingOrder(): string | null {
  return recall(PENDING_ORDER_KEY);
}

export function clearPendingOrder(): void {
  forget(PENDING_ORDER_KEY);
}

/** The cast a reader was trying to read deeply when they ran out of credits. */
export function rememberDeepReadingIntent(castingId: string): void {
  remember(PENDING_DEEP_READING_KEY, castingId);
}

export function readDeepReadingIntent(): string | null {
  return recall(PENDING_DEEP_READING_KEY);
}

export function clearDeepReadingIntent(): void {
  forget(PENDING_DEEP_READING_KEY);
}

/** Where to send a buyer once their credits have landed. */
export function destinationAfterPayment(): string {
  const castingId = readDeepReadingIntent();
  return castingId ? `/readings/${castingId}` : "/account";
}
