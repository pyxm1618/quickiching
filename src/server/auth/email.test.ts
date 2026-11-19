import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile, rm } from "node:fs/promises";
import {
  createBrowserGateMagicLinkCaptureTransport,
  createMagicLinkEmailTransport,
} from "./email";

const captureFile = `/tmp/qic-magic-link-capture-${process.pid}.json`;

afterEach(async () => {
  await rm(captureFile, { force: true });
});

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

  it("captures only genuine loopback Better Auth links for the R3 browser fixture", async () => {
    const transport = createBrowserGateMagicLinkCaptureTransport({
      captureFile,
      baseURL: "http://127.0.0.1:3037",
    });
    const url = "http://127.0.0.1:3037/api/auth/magic-link/verify?token=real-generated-token&callbackURL=%2Freadings%2Fresult%3Fsession%3DA";
    await transport.sendMagicLink({
      email: "r3@example.com",
      url,
      token: "real-generated-token",
    });

    await expect(readFile(captureFile, "utf8")).resolves.toBe(JSON.stringify({
      email: "r3@example.com",
      url,
    }));
  });

  it("rejects a non-loopback capture origin and cross-origin captured links", async () => {
    expect(() => createBrowserGateMagicLinkCaptureTransport({
      captureFile,
      baseURL: "https://www.quickiching.com",
    })).toThrow("AUTH_CONFIGURATION_UNAVAILABLE");

    const transport = createBrowserGateMagicLinkCaptureTransport({
      captureFile,
      baseURL: "http://127.0.0.1:3037",
    });
    await expect(transport.sendMagicLink({
      email: "r3@example.com",
      url: "https://evil.example/api/auth/magic-link/verify?token=secret",
      token: "secret",
    })).rejects.toThrow("AUTH_EMAIL_DELIVERY_FAILED");
  });

  it("never logs a staging Magic Link or token", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const send = vi.fn().mockResolvedValue(undefined);
    const transport = createMagicLinkEmailTransport(send);
    const url = "https://staging.quickiching.com/api/auth/magic-link/verify?token=staging-secret-token";

    await transport.sendMagicLink({
      email: "staging-user@example.com",
      url,
      token: "staging-secret-token",
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain("staging-secret-token");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("staging-secret-token");
    log.mockRestore();
    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  it("propagates staging delivery failure instead of reporting false success", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const transport = createMagicLinkEmailTransport(async () => {
      throw new Error("provider included a sensitive transport detail");
    });

    await expect(transport.sendMagicLink({
      email: "staging-user@example.com",
      url: "https://staging.quickiching.com/api/auth/magic-link/verify?token=staging-secret-token",
      token: "staging-secret-token",
    })).rejects.toThrow("AUTH_EMAIL_DELIVERY_FAILED");

    expect(JSON.stringify(warn.mock.calls)).not.toContain("staging-secret-token");
    warn.mockRestore();
    vi.unstubAllEnvs();
  });

});
