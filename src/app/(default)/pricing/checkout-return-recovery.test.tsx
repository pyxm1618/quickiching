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

class MockNode {
  nodeType:number; nodeName:string; childNodes:MockNode[]=[]; parentNode:MockNode|null=null;
  ownerDocument:MockDocument|null=null; nodeValue:string|null=null; private _style:Record<string,string>={};
  constructor(nodeType:number,nodeName:string){this.nodeType=nodeType;this.nodeName=nodeName;}
  appendChild(child:MockNode){child.parentNode=this;this.childNodes.push(child);return child;}
  removeChild(child:MockNode){const idx=this.childNodes.indexOf(child);if(idx!==-1)this.childNodes.splice(idx,1);child.parentNode=null;return child;}
  insertBefore(newChild:MockNode,refChild:MockNode|null){if(!refChild)return this.appendChild(newChild);const idx=this.childNodes.indexOf(refChild);if(idx===-1)return this.appendChild(newChild);newChild.parentNode=this;this.childNodes.splice(idx,0,newChild);return newChild;}
  setAttribute(){} removeAttribute(){} addEventListener(){} removeEventListener(){} get style(){return this._style;}
}
class MockElement extends MockNode { tagName:string; constructor(tagName:string){super(1,tagName.toUpperCase());this.tagName=tagName.toUpperCase();} }
class MockDocument extends MockNode {
  documentElement:MockElement;body:MockElement;activeElement:MockElement|null=null;defaultView:any=null;
  constructor(){super(9,"#document");this.documentElement=new MockElement("html");this.body=new MockElement("body");this.documentElement.appendChild(this.body);}
  createElement(tag:string){const el=new MockElement(tag);el.ownerDocument=this;return el;}
  createElementNS(_ns:string,tag:string){return this.createElement(tag);}
  createTextNode(text:string){const node=new MockNode(3,"#text");node.nodeValue=text;node.ownerDocument=this;return node;}
  createComment(){return new MockNode(8,"#comment");}
}
class MockSessionStorage {
  private store=new Map<string,string>();
  getItem(key:string){return this.store.get(key)??null;}
  setItem(key:string,value:string){this.store.set(key,value);}
  removeItem(key:string){this.store.delete(key);}
  clear(){this.store.clear();}
}
const mockRouter={refresh:vi.fn()};
vi.mock("next/navigation",()=>({useRouter:()=>mockRouter}));
const mockDoc=new MockDocument();const mockStorage=new MockSessionStorage();const mockAssign=vi.fn();
const mockWindow:any={
  get sessionStorage(){return mockStorage;},location:{assign:(url:string)=>mockAssign(url)},
  get setTimeout(){return globalThis.setTimeout;},get clearTimeout(){return globalThis.clearTimeout;},
  HTMLIFrameElement:class HTMLIFrameElement{},
};
mockDoc.defaultView=mockWindow;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;(globalThis as any).React=React;
(globalThis as any).HTMLIFrameElement=class HTMLIFrameElement{};(globalThis as any).Element=MockElement;
(globalThis as any).Node=MockNode;(globalThis as any).document=mockDoc;(globalThis as any).window=mockWindow;

async function flush(){for(let i=0;i<20;i++)await Promise.resolve();}
async function render(root:Root,element:React.ReactElement){await act(async()=>{root.render(element);await flush();});}
async function advance(ms:number){await act(async()=>{await vi.advanceTimersByTimeAsync(ms);await flush();});}

describe("checkout return reconciliation",()=>{
  it("never confirms from orderId alone",()=>{
    expect(resolveCheckoutReturnPhase({orderId:"order-1",context:null,credits:99})).toBe("checking");
    expect(resolveCheckoutReturnPhase({orderId:"order-1",context:{orderId:"other",creditsBeforeCheckout:0,createdAt:1},credits:99})).toBe("checking");
  });
  it("confirms only after matched checkout context observes a real balance increase",()=>{
    const context:CheckoutReturnContext={orderId:"order-1",creditsBeforeCheckout:2,createdAt:1};
    expect(resolveCheckoutReturnPhase({orderId:"order-1",context,credits:2})).toBe("checking");
    expect(resolveCheckoutReturnPhase({orderId:"order-1",context,credits:3})).toBe("confirmed");
  });
  it("enters DELAYED after the bounded confirmation window",()=>{
    const context:CheckoutReturnContext={orderId:"order-1",creditsBeforeCheckout:2,createdAt:1};
    expect(resolveCheckoutReturnPhase({orderId:"order-1",context,credits:2,elapsedMs:CHECKOUT_CONFIRMATION_WINDOW_MS})).toBe("delayed");
  });
});

describe("CheckoutReturnRecovery lifecycle",()=>{
  let container:MockElement;let root:Root;
  beforeEach(()=>{vi.useFakeTimers();mockRouter.refresh.mockClear();mockAssign.mockClear();mockStorage.clear();container=mockDoc.createElement("div");root=createRoot(container as any);});
  afterEach(async()=>{await act(async()=>{root.unmount();await flush();});vi.useRealTimers();});
  it("polls while checking but never auto-redirects after confirmation",async()=>{
    const context:CheckoutReturnContext={returnUrl:"/readings/deep?session=test-casting-123",creditsBeforeCheckout:0,orderId:"ord-test-456",createdAt:Date.now()};
    writeCheckoutReturnContext(mockStorage as unknown as Storage,context);
    await render(root,<CheckoutReturnRecovery credits={0} orderId="ord-test-456" />);
    await advance(5000);
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
    await render(root,<CheckoutReturnRecovery credits={1} orderId="ord-test-456" />);
    await advance(0);
    expect(mockAssign).not.toHaveBeenCalled();
    expect(mockStorage.getItem(CHECKOUT_RETURN_CONTEXT_KEY)).not.toBeNull();
    const count=mockRouter.refresh.mock.calls.length;
    await advance(10000);
    expect(mockRouter.refresh).toHaveBeenCalledTimes(count);
  });
  it("stops automatic polling once confirmation becomes delayed",async()=>{
    const context:CheckoutReturnContext={returnUrl:"/readings/deep?session=test-timeout",creditsBeforeCheckout:0,orderId:"ord-test-timeout",createdAt:Date.now()};
    writeCheckoutReturnContext(mockStorage as unknown as Storage,context);
    await render(root,<CheckoutReturnRecovery credits={0} orderId="ord-test-timeout" />);
    for(let i=0;i<6;i++)await advance(5000);
    const count=mockRouter.refresh.mock.calls.length;
    await advance(5000);
    expect(mockRouter.refresh).toHaveBeenCalledTimes(count);
    expect(mockAssign).not.toHaveBeenCalled();
  });
});
