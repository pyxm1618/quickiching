import React from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHECKOUT_RETURN_CONTEXT_KEY,
  writeCheckoutReturnContext,
  type CheckoutReturnContext,
} from "./checkout-return-context";

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

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
(globalThis as any).React = React;
(globalThis as any).HTMLIFrameElement = class HTMLIFrameElement {};
(globalThis as any).Element = MockElement;
(globalThis as any).Node = MockNode;
(globalThis as any).document = mockDoc;
(globalThis as any).window = mockWindow;

import { CheckoutReturnRecovery } from "./checkout-return-recovery";

async function flushMicrotasks() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

describe("CheckoutReturnRecovery actual React component lifecycle", () => {
  let container: MockElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    mockRouter.refresh.mockClear();
    mockAssign.mockClear();
    mockStorage.clear();
    container = mockDoc.createElement("div");
    root = createRoot(container as any);
  });

  afterEach(async () => {
    root.unmount();
    await flushMicrotasks();
    vi.useRealTimers();
  });

  it("continuously polls via router.refresh() when credits unchanged, and navigates when credits arrive later", async () => {
    const initialContext: CheckoutReturnContext = {
      returnUrl: "/readings/three-coin/result?id=test-casting-123",
      creditsBeforeCheckout: 0,
      orderId: "ord-test-456",
      createdAt: Date.now(),
    };
    writeCheckoutReturnContext(mockStorage, initialContext);

    // 1. 初始挂载：credits 为 0（未到账）
    root.render(React.createElement(CheckoutReturnRecovery, { credits: 0 }));
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(mockRouter.refresh).not.toHaveBeenCalled();

    // 2. 推进 1500ms -> 第 1 次轮询 tick 触发
    await vi.advanceTimersByTimeAsync(1500);
    await flushMicrotasks();
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);

    // 3. 再次推进 1500ms -> 第 2 次轮询 tick 触发（证明 credits 没变时依然持续轮询）
    await vi.advanceTimersByTimeAsync(1500);
    await flushMicrotasks();
    expect(mockRouter.refresh).toHaveBeenCalledTimes(2);

    // 4. 再次推进 1500ms -> 第 3 次轮询 tick 触发
    await vi.advanceTimersByTimeAsync(1500);
    await flushMicrotasks();
    expect(mockRouter.refresh).toHaveBeenCalledTimes(3);

    // 5. 额度稍后到账！重新渲染组件：credits 变为 1
    root.render(React.createElement(CheckoutReturnRecovery, { credits: 1 }));
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    // 验证：sessionStorage context 被清除，且通过 location.assign 返回原起卦页
    expect(mockStorage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)).toBeNull();
    expect(mockAssign).toHaveBeenCalledWith("/readings/three-coin/result?id=test-casting-123");
  });

  it("stops polling after 30s timeout when credits never arrive", async () => {
    const initialContext: CheckoutReturnContext = {
      returnUrl: "/readings/three-coin/result?id=test-casting-timeout",
      creditsBeforeCheckout: 0,
      orderId: "ord-test-timeout",
      createdAt: Date.now(),
    };
    writeCheckoutReturnContext(mockStorage, initialContext);

    // 初始挂载
    root.render(React.createElement(CheckoutReturnRecovery, { credits: 0 }));
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    // 推进 28500ms (19 次 1500ms 轮询)
    for (let i = 0; i < 19; i++) {
      await vi.advanceTimersByTimeAsync(1500);
      await flushMicrotasks();
    }
    const refreshesBeforeTimeout = mockRouter.refresh.mock.calls.length;
    expect(refreshesBeforeTimeout).toBe(19);

    // 超过 30s 窗口（推进到 31000ms）
    await vi.advanceTimersByTimeAsync(2500);
    await flushMicrotasks();

    const refreshesAtTimeout = mockRouter.refresh.mock.calls.length;

    // 再次推进 5000ms，验证轮询彻底停止，不再产生新的 refresh 调用
    await vi.advanceTimersByTimeAsync(5000);
    await flushMicrotasks();
    expect(mockRouter.refresh.mock.calls.length).toBe(refreshesAtTimeout);

    // 从未跳转
    expect(mockAssign).not.toHaveBeenCalled();
    // context 保留供从账户历史查看
    expect(mockStorage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)).not.toBeNull();
  });
});
