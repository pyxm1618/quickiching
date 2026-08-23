import { describe, expect, it, vi } from "vitest";
import { createMagicLinkEmailTransport } from "./email";

describe("Magic Link email transport", () => {
  it("is injectable for tests and sends the expected message without logging secrets", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const transport = createMagicLinkEmailTransport(send);

    const hostileURL = "https://www.quickiching.com/api/auth/magic-link/verify?token=secret-token&next=\"'><img src=x>";
    await transport.sendMagicLink({
      email: "user@example.com",
      url: hostileURL,
      token: "secret-token",
    });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: ["user@example.com"],
      subject: "Your Quick I Ching sign-in link",
    }));
    expect(JSON.stringify(send.mock.calls)).toContain("secret-token");
    const message = send.mock.calls[0]![0]!;
    expect(message.html).toContain("&quot;");
    expect(message.html).toContain("&gt;");
    expect(message.html).not.toContain(`href="${hostileURL}"`);
  });

  it("turns provider delivery failures into a stable safe error", async () => {
    const transport = createMagicLinkEmailTransport(async () => {
      throw new Error("provider secret and token should not escape");
    });

    await expect(transport.sendMagicLink({
      email: "user@example.com",
      url: "https://www.quickiching.com/link?token=secret-token",
      token: "secret-token",
    })).rejects.toThrow("AUTH_EMAIL_DELIVERY_FAILED");
  });
});
