import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearDeepReadingIntent,
  clearPendingOrder,
  destinationAfterPayment,
  readDeepReadingIntent,
  readPendingOrder,
  rememberDeepReadingIntent,
  rememberPendingOrder,
} from "./pending-intent";

const ORDER = "8b6d8846-cdce-4dde-9744-817b8329a5b6";
const CASTING = "0f1d2f1e-9a3b-4c1d-8e2f-5a6b7c8d9e0f";

type Behaviour = { onGet?: () => never; onSet?: () => never };

/** Minimal sessionStorage stand-in; the suite runs in the node environment. */
function installStorage(behaviour: Behaviour = {}): Map<string, string> {
  const entries = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      behaviour.onGet?.();
      return entries.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      behaviour.onSet?.();
      entries.set(key, value);
    },
    removeItem(key: string) {
      entries.delete(key);
    },
  };
  (globalThis as { window?: unknown }).window = { sessionStorage: storage };
  return entries;
}

let entries: Map<string, string>;

beforeEach(() => {
  entries = installStorage();
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("pending order handoff", () => {
  it("round trips an order id", () => {
    rememberPendingOrder(ORDER);
    expect(readPendingOrder()).toBe(ORDER);
  });

  it("clears on request", () => {
    rememberPendingOrder(ORDER);
    clearPendingOrder();
    expect(readPendingOrder()).toBeNull();
  });

  it("reads null when nothing was stored", () => {
    expect(readPendingOrder()).toBeNull();
  });

  it.each([
    ["a non-uuid", "not-an-order"],
    ["an empty string", ""],
    ["a path traversal attempt", "../../etc/passwd"],
    ["an absolute URL", "https://attacker.example/x"],
  ])("refuses to store %s", (_label, value) => {
    rememberPendingOrder(value);
    expect(readPendingOrder()).toBeNull();
  });

  it("discards a value that was tampered with in storage", () => {
    entries.set("quickiching.pendingOrder", "../../admin");
    expect(readPendingOrder()).toBeNull();
  });

  it("returns null rather than throwing when storage reads are blocked", () => {
    installStorage({ onGet: () => { throw new Error("SecurityError"); } });
    expect(readPendingOrder()).toBeNull();
  });

  it("does not throw when storage rejects a write", () => {
    installStorage({ onSet: () => { throw new Error("QuotaExceededError"); } });
    expect(() => rememberPendingOrder(ORDER)).not.toThrow();
  });

  it("is inert on the server, where there is no window", () => {
    delete (globalThis as { window?: unknown }).window;
    expect(() => rememberPendingOrder(ORDER)).not.toThrow();
    expect(readPendingOrder()).toBeNull();
    expect(() => clearPendingOrder()).not.toThrow();
  });
});

describe("pending deep reading intent", () => {
  it("round trips a casting id", () => {
    rememberDeepReadingIntent(CASTING);
    expect(readDeepReadingIntent()).toBe(CASTING);
  });

  it("clears on request", () => {
    rememberDeepReadingIntent(CASTING);
    clearDeepReadingIntent();
    expect(readDeepReadingIntent()).toBeNull();
  });

  it("keeps the order and reading slots independent", () => {
    rememberPendingOrder(ORDER);
    rememberDeepReadingIntent(CASTING);

    clearPendingOrder();

    expect(readPendingOrder()).toBeNull();
    expect(readDeepReadingIntent()).toBe(CASTING);
  });
});

describe("destination after payment", () => {
  it("returns to the cast the reader was trying to read", () => {
    rememberDeepReadingIntent(CASTING);
    expect(destinationAfterPayment()).toBe(`/readings/${CASTING}`);
  });

  it("falls back to the account page with no stored intent", () => {
    expect(destinationAfterPayment()).toBe("/account");
  });

  it("never builds a destination from a tampered intent", () => {
    entries.set("quickiching.pendingDeepReading", "https://attacker.example");
    expect(destinationAfterPayment()).toBe("/account");
  });
});
