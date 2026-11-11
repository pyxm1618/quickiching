import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaymentReturnStatus } from "./payment-return-status";

function render(props: Partial<React.ComponentProps<typeof PaymentReturnStatus>> = {}) {
  return renderToStaticMarkup(<PaymentReturnStatus
    phase="checking"
    credits={0}
    locale="en"
    hasReadingReturn={false}
    {...props}
  />);
}

describe("PaymentReturnStatus", () => {
  it("renders a readable CHECKING live status and prevents double-purchase confusion", () => {
    const html = render();
    expect(html).toContain('data-payment-return-state="checking"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Checking your credits");
    expect(html).toContain("do not need to purchase again");
    expect(html).not.toContain("Check Again");
  });

  it("renders CONFIRMED with real balance and explicit Reading return when context exists", () => {
    const html = render({ phase: "confirmed", credits: 3, hasReadingReturn: true });
    expect(html).toContain('data-payment-return-state="confirmed"');
    expect(html).toContain("Current Balance: 3 credits");
    expect(html).toContain("Return to your Reading");
    expect(html).toContain("View Account / Purchase History");
    expect(html).not.toContain("started directly from Pricing");
  });

  it("keeps direct Pricing confirmation on Pricing/account surfaces", () => {
    const html = render({ phase: "confirmed", credits: 5, hasReadingReturn: false });
    expect(html).toContain("Current Balance: 5 credits");
    expect(html).toContain("Back to credit packs");
    expect(html).toContain("started directly from Pricing");
    expect(html).not.toContain("Return to your Reading");
  });

  it("renders DELAYED with Check Again and Account actions, never a purchase CTA", () => {
    const html = render({ phase: "delayed" });
    expect(html).toContain('data-payment-return-state="delayed"');
    expect(html).toContain("Confirmation is taking longer than expected");
    expect(html).toContain("Check Again");
    expect(html).toContain("View Account / Purchase History");
    expect(html).not.toContain("Buy Deep Reading credits");
  });

  it("renders the same status contract in Chinese", () => {
    const html = render({ phase: "delayed", locale: "zh-Hans" });
    expect(html).toContain("确认时间比预期更长");
    expect(html).toContain("再次检查");
    expect(html).toContain("查看账户 / 购买记录");
  });
});
