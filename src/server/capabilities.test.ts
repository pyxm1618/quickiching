import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_CAPABILITIES,
  COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX,
  resolveCommercialCapabilities,
} from "./capabilities";

describe("commercial capability matrix", () => {
  it("defaults every server-side capability to disabled", () => {
    const result = resolveCommercialCapabilities({});

    expect(result.allDisabled).toBe(true);
    expect(result.commercialEnabled).toBe(false);
    expect(result.requestedAny).toBe(false);

    for (const capability of COMMERCIAL_CAPABILITIES) {
      expect(result.capabilities[capability]).toMatchObject({
        capability,
        requested: false,
        enabled: false,
        reason: "disabled",
        missingDependencies: [],
      });
    }
  });

  it("does not treat similarly named browser flags as server capability switches", () => {
    const result = resolveCommercialCapabilities({
      NEXT_PUBLIC_COMMERCIAL_V2_AUTH_ENABLED: "true",
      NEXT_PUBLIC_COMMERCIAL_V2_CHECKOUT_ENABLED: "true",
    });

    expect(result.requestedAny).toBe(false);
    expect(result.capabilities.auth.enabled).toBe(false);
    expect(result.capabilities.checkout.enabled).toBe(false);
  });

  it.each(COMMERCIAL_CAPABILITIES)(
    "fails closed when %s is requested without its dependencies",
    (capability) => {
      const flag = COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX[capability].flag;
      const result = resolveCommercialCapabilities({ [flag]: "true" });
      const status = result.capabilities[capability];

      expect(status.requested).toBe(true);
      expect(status.enabled).toBe(false);
      expect(status.reason).toBe("missing_dependencies");
      expect(status.missingDependencies.length).toBeGreaterThan(0);
    },
  );

  it("requires Waffo explicitly for payment capabilities", () => {
    const result = resolveCommercialCapabilities({
      COMMERCIAL_V2_CHECKOUT_ENABLED: "true",
      PAYMENT_ADAPTER_MODE: "unsupported-provider",
    });

    expect(result.capabilities.checkout.enabled).toBe(false);
    expect(result.capabilities.checkout.missingDependencies).toContain(
      "PAYMENT_ADAPTER_MODE=waffo",
    );
  });

  it("keeps requested capabilities closed until their CP1 implementation exists", () => {
    const result = resolveCommercialCapabilities({
      COMMERCIAL_V2_AUTH_ENABLED: "true",
      AUTH_ADAPTER_MODE: "better-auth",
      BETTER_AUTH_SECRET: "secret",
      BETTER_AUTH_URL: "https://example.com",
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      RESEND_API_KEY: "resend-key",
      EMAIL_FROM: "I Ching <noreply@example.com>",
    });

    expect(result.capabilities.auth).toMatchObject({
      requested: true,
      enabled: false,
      reason: "implementation_not_available",
      missingDependencies: [],
    });
  });

  it("rejects malformed capability flags instead of enabling them", () => {
    expect(() =>
      resolveCommercialCapabilities({ COMMERCIAL_V2_AUTH_ENABLED: "yes" }),
    ).toThrow("COMMERCIAL_V2_AUTH_ENABLED must be true or false");
  });
});
