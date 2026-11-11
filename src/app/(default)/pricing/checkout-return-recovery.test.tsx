import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHECKOUT_RETURN_CONTEXT_KEY,
  writeCheckoutReturnContext,
  type CheckoutReturnContext,
} from "./checkout-return-context";
import {
  CHECKOUT_CONFIRMATION_WINDOW_MS,
  CheckoutReturnRecovery,
  resolveCheckoutReturnPhase,
} from "./checkout-return-recovery";

// Setup minimal DOM shim for React 19 createRoot in Node environment
class MockNode {
  nodeType: number;
  nodeName: string;
  childNodes: MockNode[] = [];
  parentNode: MockNode | null = null;
  ownerDocument: MockDocument | null = null;
  nodeValue: string | null = null;
  private _style: Record<string, string> = {};

  constructor(nodeType: number, nodeName: string) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
  }
  appendChild(child: MockNode) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  removeChild(child: MockNode) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) this.childNodes.splice(idx, 1);
    child.parentNode = null;
    return child;
  }
  insertBefore(newChild: MockNode, refChild: MockNode | null) {
    if (!refChild) return this.appendChild(newChild);
    const idx = this.childNodes.indexOf(refChild);
    if (idx === -1) return this.appendChild(newChild);
    newChild.parentNode = this;
    this.childNodes.splice(idx, 0, newChild);
    return newChild;
  }
  setAttribute() {}
  removeAttribute() {}
  addEventListener() {}
  removeEventListener() {}
  get style() {
    return this._style;
  }
}

class MockElement extends MockNode {
  tagName: string;
  constructor(tagName: string) {
    super(1, tagName.toUpperCase());
    this.tagName = tagName.toUpperCase();
  }
}

class MockDocument extends MockNode {
  documentElement: MockElement;
  body: MockElement;
  activeElement: MockElement | null = null;
  defaultView: any = null;

  constructor() {
    super(9, "#document");
    this.documentElement = new MockElement("html");
    this.body = new MockElement("body");
    this.documentElement.appendChild(this.body);
  }
  createElement(tag: string) {
    const el = new MockElement(tag);
    el.ownerDocument = this;
    return el;
  }
  createElementNS(_ns: string, tag: string) {
    return this.createElement(tag);
  }
  createTextNode(text: string) {
    const node = new MockNode(3, "#text");
    node.nodeValue = text;
    node.ownerDocument = this;
    return node;
  }
  createComment() {
    return new MockNode(8, "#comment");
  }
}

// In-memory sessionStorage mock
class MockSessionStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const mockRouter = {
  refresh: vi.fn(),
  replace: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

// Setup DOM globals before importing component
const mockDoc = new MockDocument();
const mockStorage = new MockSessionStorage();
const mockAssign = vi.fn();

const mockWindow: any = {
  get sessionStorage() {
    return mockStorage;
  },
  location: {
    assign: (url: string) => mockAssign(url),
  },
  get setTimeout() {
    return globalThis.setTimeout;
  },
  get clearTimeout() {
    return globalThis.clearTimeout;
  },
  HTMLIFrameElement: class HTMLIFrameElement {},
};

mockDoc.defaultView = mockWindow;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).React = React;
(globalThis as any).HTMLIFrameElement = class HTMLIFrameElement {};
(globalThis as any).Element = MockElement;
(globalThis as any).Node = MockNode;
(globalThis as any).document = mockDoc;
(globalThis as any).window = mockWindow;

async function flushMicrotasks() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

async function renderAndFlush(root: Root, element: React.ReactElement) {
  await act(async () => {
    root.render(element);
    await flushMicrotasks();
  });
}

async function advanceTimersAndFlush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    await flushMicrotasks();
  });
}

describe("checkout return reconciliation", () => {
  it("never confirms from orderId alone", () => {
    expect(resolveCheckoutReturnPhase({
      orderId: "order-1",
      context: null,
      credits: 99,
    })).toBe("inactive");

    expect(resolveCheckoutReturnPhase({
      orderId: "order-1",
      context: {
        orderId: "other",
        creditsBeforeCheckout: 0,
        createdAt: 1,
        expiresAt: Number.MAX_SAFE_INTEGER,
      },
      credits: 99,
    })).toBe("inactive");
  });

  it("confirms only after a fresh matched checkout context observes a real balance increase", () => {
    const now = 2_000_000;
    const context: CheckoutReturnContext = {
      orderId: "order-1",
      creditsBeforeCheckout: 2,
      createdAt: now - 1,
      expiresAt: now + 60_000,
    };

    expect(resolveCheckoutReturnPhase({
      orderId: "order-1",
      context,
      credits: 2,
      nowMs: now,
    })).toBe("checking");

    expect(resolveCheckoutReturnPhase({
      orderId: "order-1",
      context,
      credits: 3,
      nowMs: now,
    })).toBe("confirmed");
  });

  it("never confirms an expired matched order after an unrelated balance increase", () => {
    const now = 2_000_000;
    const context: CheckoutReturnContext = {
      orderId: "order-old",
      creditsBeforeCheckout: 0,
      createdAt: now - 1_000,
      expiresAt: now - 1,
    };

    expect(resolveCheckoutReturnPhase({
      orderId: "order-old",
      context,
      credits: 99,
      nowMs: now,
    })).toBe("inactive");
  });

  it("enters DELAYED after the bounded confirmation window only for a fresh matched context", () => {
    const context: CheckoutReturnContext = {
      orderId: "order-1",
      creditsBeforeCheckout: 2,
      createdAt: 1,
      expiresAt: Number.MAX_SAFE_INTEGER,
    };

    expect(resolveCheckoutReturnPhase({
      orderId: "order-1",
      context,
      credits: 2,
      elapsedMs: CHECKOUT_CONFIRMATION_WINDOW_MS,
    })).toBe("delayed");
  });
});

describe("CheckoutReturnRecovery actual React component lifecycle", () => {
  let container: MockElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    mockRouter.refresh.mockClear();
    mockRouter.replace.mockClear();
    mockAssign.mockClear();
    mockStorage.clear();
    container = mockDoc.createElement("div");
    root = createRoot(container as any);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await flushMicrotasks();
    });
    vi.useRealTimers();
  });

  it("continuously polls while credits are unchanged, then stops without auto-navigation when credits arrive", async () => {
    const initialContext: CheckoutReturnContext = {
      returnUrl: "/readings/deep?session=test-casting-123",
      creditsBeforeCheckout: 0,
      orderId: "ord-test-456",
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60_000,
    };
    writeCheckoutReturnContext(mockStorage as unknown as Storage, initialContext);

    await renderAndFlush(root, React.createElement(CheckoutReturnRecovery, {
      credits: 0,
      orderId: "ord-test-456",
    }));
    await advanceTimersAndFlush(0);

    expect(mockRouter.refresh).not.toHaveBeenCalled();

    await advanceTimersAndFlush(5000);
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);

    await advanceTimersAndFlush(5000);
    expect(mockRouter.refresh).toHaveBeenCalledTimes(2);

    await advanceTimersAndFlush(5000);
    expect(mockRouter.refresh).toHaveBeenCalledTimes(3);

    await renderAndFlush(root, React.createElement(CheckoutReturnRecovery, {
      credits: 1,
      orderId: "ord-test-456",
    }));
    await advanceTimersAndFlush(0);

    expect(mockStorage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)).not.toBeNull();
    expect(mockAssign).not.toHaveBeenCalled();

    const refreshesAtCompletion = mockRouter.refresh.mock.calls.length;
    await advanceTimersAndFlush(10_000);
    expect(mockRouter.refresh.mock.calls.length).toBe(refreshesAtCompletion);
  });

  it("stops polling after 30s timeout when credits never arrive", async () => {
    const initialContext: CheckoutReturnContext = {
      returnUrl: "/readings/deep?session=test-casting-timeout",
      creditsBeforeCheckout: 0,
      orderId: "ord-test-timeout",
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60_000,
    };
    writeCheckoutReturnContext(mockStorage as unknown as Storage, initialContext);

    await renderAndFlush(root, React.createElement(CheckoutReturnRecovery, {
      credits: 0,
      orderId: "ord-test-timeout",
    }));
    await advanceTimersAndFlush(0);

    for (let i = 0; i < 5; i++) {
      await advanceTimersAndFlush(5000);
    }
    const refreshesBeforeTimeout = mockRouter.refresh.mock.calls.length;
    expect(refreshesBeforeTimeout).toBe(5);

    await advanceTimersAndFlush(6000);
    const refreshesAtTimeout = mockRouter.refresh.mock.calls.length;

    await advanceTimersAndFlush(5000);
    expect(mockRouter.refresh.mock.calls.length).toBe(refreshesAtTimeout);
    expect(mockAssign).not.toHaveBeenCalled();
    expect(mockStorage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)).not.toBeNull();
  });

  it("clears expired matching context and exits the payment-return state", async () => {
    const initialContext: CheckoutReturnContext = {
      returnUrl: "/readings/deep?session=stale-casting",
      creditsBeforeCheckout: 0,
      orderId: "ord-stale",
      createdAt: Date.now() - 60_000,
      expiresAt: Date.now() - 1,
    };
    writeCheckoutReturnContext(mockStorage as unknown as Storage, initialContext);

    await renderAndFlush(root, React.createElement(CheckoutReturnRecovery, {
      credits: 99,
      orderId: "ord-stale",
    }));
    await advanceTimersAndFlush(0);

    expect(mockStorage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)).toBeNull();
    expect(mockRouter.replace).toHaveBeenCalledWith("/pricing");
    expect(mockRouter.refresh).not.toHaveBeenCalled();
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it("clears old schema without expiresAt and exits without reconciliation", async () => {
    mockStorage.setItem(CHECKOUT_RETURN_CONTEXT_KEY, JSON.stringify({
      returnUrl: "/readings/deep?session=legacy",
      creditsBeforeCheckout: 0,
      orderId: "ord-legacy",
      createdAt: Date.now(),
    }));

    await renderAndFlush(root, React.createElement(CheckoutReturnRecovery, {
      credits: 99,
      orderId: "ord-legacy",
    }));
    await advanceTimersAndFlush(0);

    expect(mockStorage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)).toBeNull();
    expect(mockRouter.replace).toHaveBeenCalledWith("/pricing");
    expect(mockRouter.refresh).not.toHaveBeenCalled();
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it("normalizes an expired Chinese return to /zh/pricing without reconciliation", async () => {
    const initialContext: CheckoutReturnContext = {
      creditsBeforeCheckout: 0,
      orderId: "ord-stale-zh",
      createdAt: Date.now() - 60_000,
      expiresAt: Date.now() - 1,
    };
    writeCheckoutReturnContext(mockStorage as unknown as Storage, initialContext);

    await renderAndFlush(root, React.createElement(CheckoutReturnRecovery, {
      credits: 99,
      orderId: "ord-stale-zh",
      locale: "zh-Hans",
    }));
    await advanceTimersAndFlush(0);

    expect(mockStorage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)).toBeNull();
    expect(mockRouter.replace).toHaveBeenCalledWith("/zh/pricing");
    expect(mockRouter.refresh).not.toHaveBeenCalled();
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it("does not reconcile or confirm when the return URL has only an orderId", async () => {
    await renderAndFlush(root, React.createElement(CheckoutReturnRecovery, {
      credits: 99,
      orderId: "ord-url-only",
    }));
    await advanceTimersAndFlush(0);

    expect(mockRouter.replace).toHaveBeenCalledWith("/pricing");
    expect(mockRouter.refresh).not.toHaveBeenCalled();
    expect(mockAssign).not.toHaveBeenCalled();
  });
});
