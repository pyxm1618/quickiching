import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_CAPABILITIES,
  COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX,
  resolveCommercialCapabilities,
} from "./capabilities";
import type {
  CommercialCapability,
  CommercialCapabilityDefinition,
} from "./capabilities";

const allCapabilityFlags = Object.fromEntries(
  COMMERCIAL_CAPABILITIES.map((capability) => [
    COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX[capability].flag,
    "true",
  ]),
);

const completeValidEnvironment = {
  ...allCapabilityFlags,
  AUTH_ADAPTER_MODE: "better-auth",
  BETTER_AUTH_SECRET: "better-auth-secret",
  BETTER_AUTH_URL: "https://auth.example.com",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  RESEND_API_KEY: "resend-api-key",
  EMAIL_FROM: "I Ching <noreply@example.com>",
  AI_ADAPTER_MODE: "ai-sdk",
  AI_GATEWAY_API_KEY: "ai-gateway-key",
  AI_GATEWAY_BASE_URL: "https://ai-gateway.example.com/v1",
  AI_MODEL_PREVIEW: "provider/preview-model",
  AI_MODEL_DEEP_READING: "provider/deep-model",
  AI_MODEL_OUTPUT_REVIEW: "provider/review-model",
  PAYMENT_ADAPTER_MODE: "waffo",
  WAFFO_MERCHANT_ID: "merchant-id",
  WAFFO_PRIVATE_KEY: "private-key-material",
  WAFFO_ENVIRONMENT: "test",
  WAFFO_STORE_ID: "store-id",
  WAFFO_PRODUCT_ID_ONE: "product-one",
  WAFFO_PRODUCT_ID_THREE: "product-three",
  WAFFO_PRODUCT_ID_FIVE: "product-five",
  APP_BASE_URL: "https://www.quickiching.com",
  DATABASE_ADAPTER_MODE: "postgres",
  DATABASE_URL: "postgres://user:password@db.example.com:5432/iching",
  WORKFLOW_ADAPTER_MODE: "vercel",
  SESSION_SIGNING_KEYS: "v1:session-signing-secret",
  QUESTION_FINGERPRINT_KEYS: "v1:fingerprint-secret",
  QUESTION_ENCRYPTION_KEYS: "v1:encryption-secret",
  RESULT_INTEGRITY_KEYS: "v1:integrity-secret",
  CRON_SECRET: "cron-secret",
};

type TestDefinitionMap = Record<CommercialCapability, CommercialCapabilityDefinition>;

function cloneDefinitions(
  overrides: Partial<Record<CommercialCapability, Partial<CommercialCapabilityDefinition>>> = {},
): TestDefinitionMap {
  const definitions = {} as TestDefinitionMap;

  for (const capability of COMMERCIAL_CAPABILITIES) {
    const definition = COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX[capability];
    definitions[capability] = {
      ...definition,
      capabilityDependencies: [...definition.capabilityDependencies],
      requirements: definition.requirements.map((requirement) => ({
        ...requirement,
        allowed: requirement.allowed ? [...requirement.allowed] : undefined,
      })),
    };
  }

  for (const [capability, override] of Object.entries(overrides)) {
    const key = capability as CommercialCapability;
    definitions[key] = { ...definitions[key], ...override };
  }

  return definitions;
}

function definitionsWithImplementations(
  ...available: CommercialCapability[]
): TestDefinitionMap {
  const definitions = cloneDefinitions();
  for (const capability of available) {
    definitions[capability] = {
      ...definitions[capability],
      implementationAvailable: true,
    };
  }
  return definitions;
}

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
        invalidDependencies: [],
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

  it("keeps every complete CP1 capability request closed until its implementation exists", () => {
    const result = resolveCommercialCapabilities(completeValidEnvironment);

    expect(result.capabilities.auth).toMatchObject({
      requested: true,
      enabled: false,
      reason: "implementation_not_available",
      blockedDependencies: [],
      missingDependencies: [],
      invalidDependencies: [],
    });
    expect(result.capabilities.webhookIngestion).toMatchObject({
      requested: true,
      enabled: false,
      reason: "implementation_not_available",
      blockedDependencies: [],
      missingDependencies: [],
      invalidDependencies: [],
    });
    expect(result.capabilities.reconcile).toMatchObject({
      requested: true,
      enabled: false,
      reason: "implementation_not_available",
      blockedDependencies: [],
      missingDependencies: [],
      invalidDependencies: [],
    });
    expect(result.capabilities.aiPreview).toMatchObject({
      requested: true,
      enabled: false,
      reason: "blocked_dependencies",
      blockedDependencies: ["auth"],
    });
    expect(result.capabilities.checkout).toMatchObject({
      requested: true,
      enabled: false,
      reason: "blocked_dependencies",
      blockedDependencies: ["auth", "webhookIngestion"],
    });
    expect(result.capabilities.paidDeepReading).toMatchObject({
      requested: true,
      enabled: false,
      reason: "blocked_dependencies",
      blockedDependencies: ["auth"],
    });

    for (const capability of COMMERCIAL_CAPABILITIES) {
      expect(
        COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX[capability].implementationAvailable,
      ).toBe(false);
    }
  });

  it.each(COMMERCIAL_CAPABILITIES)(
    "fails closed when %s is requested without its dependencies",
    (capability) => {
      const flag = COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX[capability].flag;
      const result = resolveCommercialCapabilities({ [flag]: "true" });
      const status = result.capabilities[capability];

      expect(status.requested).toBe(true);
      expect(status.enabled).toBe(false);
      expect(["missing_dependencies", "blocked_dependencies"]).toContain(status.reason);
      expect(
        status.missingDependencies.length + status.blockedDependencies.length,
      ).toBeGreaterThan(0);
    },
  );

  it.each(COMMERCIAL_CAPABILITIES)(
    "reports the exact missing environment dependency for every %s requirement",
    (capability) => {
      const definition = COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX[capability];
      for (const requirement of definition.requirements) {
        const environment: Record<string, string | undefined> = {
          ...completeValidEnvironment,
          [definition.flag]: "true",
        };
        delete environment[requirement.name];

        const status = resolveCommercialCapabilities(environment).capabilities[capability];
        const label = requirement.expected
          ? `${requirement.name}=${requirement.expected}`
          : requirement.allowed
            ? `${requirement.name}=${requirement.allowed.join("|")}`
            : requirement.name;

        expect(status.enabled).toBe(false);
        expect(status.missingDependencies).toContain(label);
      }
    },
  );

  it("requires Auth to use PostgreSQL", () => {
    const environment: Record<string, string | undefined> = {
      ...completeValidEnvironment,
      COMMERCIAL_V2_AUTH_ENABLED: "true",
    };
    delete environment.DATABASE_ADAPTER_MODE;
    delete environment.DATABASE_URL;

    const status = resolveCommercialCapabilities(environment).capabilities.auth;

    expect(status.reason).toBe("missing_dependencies");
    expect(status.missingDependencies).toEqual(
      expect.arrayContaining(["DATABASE_ADAPTER_MODE=postgres", "DATABASE_URL"]),
    );
  });

  it("requires Auth and Webhook readiness for Checkout but keeps Webhook independent of Checkout", () => {
    const checkoutWithoutWebhook = {
      ...completeValidEnvironment,
      COMMERCIAL_V2_CHECKOUT_ENABLED: "true",
      COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "false",
    };
    const checkoutStatus = resolveCommercialCapabilities(checkoutWithoutWebhook).capabilities.checkout;
    expect(checkoutStatus.reason).toBe("blocked_dependencies");
    expect(checkoutStatus.blockedDependencies).toContain("webhookIngestion");

    const webhookWithoutCheckout = {
      ...completeValidEnvironment,
      COMMERCIAL_V2_CHECKOUT_ENABLED: "false",
      COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "true",
    };
    const webhookStatus = resolveCommercialCapabilities(webhookWithoutCheckout).capabilities.webhookIngestion;
    expect(webhookStatus).toMatchObject({
      reason: "implementation_not_available",
      blockedDependencies: [],
      missingDependencies: [],
      invalidDependencies: [],
    });
  });

  it("requires Auth, PostgreSQL and AI for the commercial AI Preview", () => {
    const environment = {
      ...completeValidEnvironment,
      COMMERCIAL_V2_AI_PREVIEW_ENABLED: "true",
      COMMERCIAL_V2_AUTH_ENABLED: "false",
    };
    const status = resolveCommercialCapabilities(environment).capabilities.aiPreview;

    expect(status.reason).toBe("blocked_dependencies");
    expect(status.blockedDependencies).toContain("auth");
  });

  it("requires Auth, AI, PostgreSQL and Workflow for Paid Deep Reading", () => {
    const environment = {
      ...completeValidEnvironment,
      COMMERCIAL_V2_PAID_DEEP_READING_ENABLED: "true",
      COMMERCIAL_V2_AUTH_ENABLED: "false",
      COMMERCIAL_V2_AI_PREVIEW_ENABLED: "false",
    };
    const status = resolveCommercialCapabilities(environment).capabilities.paidDeepReading;

    expect(status.reason).toBe("blocked_dependencies");
    expect(status.blockedDependencies).toEqual(["auth"]);
  });

  it("requires PostgreSQL, Workflow and CRON_SECRET for Reconcile", () => {
    const environment: Record<string, string | undefined> = {
      ...completeValidEnvironment,
      COMMERCIAL_V2_RECONCILE_ENABLED: "true",
    };
    delete environment.CRON_SECRET;

    const status = resolveCommercialCapabilities(environment).capabilities.reconcile;

    expect(status.reason).toBe("missing_dependencies");
    expect(status.missingDependencies).toContain("CRON_SECRET");
  });

  it.each([
    ["BETTER_AUTH_URL", "not-a-url", "BETTER_AUTH_URL", "auth"],
    ["AI_GATEWAY_BASE_URL", "ftp://gateway.example.com", "AI_GATEWAY_BASE_URL", "aiPreview"],
    ["DATABASE_URL", "https://not-postgres.example.com", "DATABASE_URL", "auth"],
    ["EMAIL_FROM", "not-an-email", "EMAIL_FROM", "auth"],
    ["WAFFO_ENVIRONMENT", "sandbox", "WAFFO_ENVIRONMENT=test|production", "checkout"],
    ["AI_MODEL_PREVIEW", "   ", "AI_MODEL_PREVIEW", "aiPreview"],
    ["WAFFO_PRODUCT_ID_ONE", "   ", "WAFFO_PRODUCT_ID_ONE", "checkout"],
  ] as const)("rejects invalid %s without exposing its value", (name, value, label, capability) => {
    const result = resolveCommercialCapabilities({ ...completeValidEnvironment, [name]: value });
    const status = result.capabilities[capability];

    expect(status.enabled).toBe(false);
    expect(status.invalidDependencies).toContain(label);
    if (value.trim()) expect(JSON.stringify(result)).not.toContain(value.trim());
  });

  it("rejects malformed versioned keys and duplicate key material across purposes", () => {
    const malformed = resolveCommercialCapabilities({
      ...completeValidEnvironment,
      SESSION_SIGNING_KEYS: "not-versioned",
    }).capabilities.paidDeepReading;
    expect(malformed.invalidDependencies).toContain("SESSION_SIGNING_KEYS");

    const duplicated = resolveCommercialCapabilities({
      ...completeValidEnvironment,
      QUESTION_FINGERPRINT_KEYS: "v1:session-signing-secret",
    }).capabilities.paidDeepReading;
    expect(duplicated.invalidDependencies).toEqual(
      expect.arrayContaining([
        "SESSION_SIGNING_KEYS",
        "QUESTION_FINGERPRINT_KEYS",
      ]),
    );
  });

  it("rejects malformed capability flags instead of enabling them", () => {
    expect(() =>
      resolveCommercialCapabilities({ COMMERCIAL_V2_AUTH_ENABLED: "yes" }),
    ).toThrow("COMMERCIAL_V2_AUTH_ENABLED must be true or false");
  });

  it("requires final enabled dependencies, not only valid dependency configuration", () => {
    const onlyPreview = resolveCommercialCapabilities(completeValidEnvironment, {
      definitions: definitionsWithImplementations("aiPreview"),
    }).capabilities.aiPreview;
    expect(onlyPreview).toMatchObject({
      enabled: false,
      reason: "blocked_dependencies",
      blockedDependencies: ["auth"],
    });

    const onlyCheckout = resolveCommercialCapabilities(completeValidEnvironment, {
      definitions: definitionsWithImplementations("checkout"),
    }).capabilities.checkout;
    expect(onlyCheckout).toMatchObject({
      enabled: false,
      reason: "blocked_dependencies",
      blockedDependencies: ["auth", "webhookIngestion"],
    });

    const checkoutWithoutWebhook = resolveCommercialCapabilities(completeValidEnvironment, {
      definitions: definitionsWithImplementations("auth", "checkout"),
    }).capabilities.checkout;
    expect(checkoutWithoutWebhook).toMatchObject({
      enabled: false,
      reason: "blocked_dependencies",
      blockedDependencies: ["webhookIngestion"],
    });

    const readyCheckout = resolveCommercialCapabilities(completeValidEnvironment, {
      definitions: definitionsWithImplementations("auth", "webhookIngestion", "checkout"),
    }).capabilities.checkout;
    expect(readyCheckout).toMatchObject({
      enabled: true,
      reason: "enabled",
      blockedDependencies: [],
    });
  });

  it("does not couple Paid Deep Reading to the AI Preview product capability", () => {
    const environment: Record<string, string | undefined> = { ...completeValidEnvironment };
    environment.COMMERCIAL_V2_AI_PREVIEW_ENABLED = "false";
    environment.AI_MODEL_PREVIEW = undefined;

    const result = resolveCommercialCapabilities(environment, {
      definitions: definitionsWithImplementations("auth", "paidDeepReading"),
    });
    const status = result.capabilities.paidDeepReading;

    expect(status).toMatchObject({
      enabled: true,
      reason: "enabled",
      blockedDependencies: [],
      missingDependencies: [],
      invalidDependencies: [],
    });
    expect(status.blockedDependencies).not.toContain("aiPreview");
    expect(status.missingDependencies).not.toContain("AI_MODEL_PREVIEW");
  });

  it("fails closed for cyclic capability dependencies", () => {
    const definitions = cloneDefinitions();
    definitions.auth = {
      ...definitions.auth,
      implementationAvailable: true,
      capabilityDependencies: ["reconcile"],
    };
    definitions.reconcile = {
      ...definitions.reconcile,
      implementationAvailable: true,
      capabilityDependencies: ["auth"],
    };

    const result = resolveCommercialCapabilities(completeValidEnvironment, { definitions });

    expect(result.capabilities.auth.enabled).toBe(false);
    expect(result.capabilities.reconcile.enabled).toBe(false);
    expect(result.capabilities.auth.blockedDependencies).toContain("reconcile");
    expect(result.capabilities.reconcile.blockedDependencies).toContain("auth");
  });

  it("fails closed for unknown capability dependencies", () => {
    const definitions = cloneDefinitions();
    definitions.auth = {
      ...definitions.auth,
      implementationAvailable: true,
      capabilityDependencies: ["not-a-capability" as CommercialCapability],
    };

    const result = resolveCommercialCapabilities(completeValidEnvironment, { definitions });

    expect(result.capabilities.auth).toMatchObject({
      enabled: false,
      reason: "blocked_dependencies",
      blockedDependencies: ["unknown:not-a-capability"],
    });
  });

  it("is independent of capability definition declaration order", () => {
    const forward = cloneDefinitions();
    const reverse = Object.fromEntries(
      [...COMMERCIAL_CAPABILITIES].reverse().map((capability) => [capability, forward[capability]]),
    ) as TestDefinitionMap;
    const environment = {
      ...completeValidEnvironment,
      COMMERCIAL_V2_AUTH_ENABLED: "false",
    };

    const summarize = (result: ReturnType<typeof resolveCommercialCapabilities>) =>
      Object.fromEntries(
        COMMERCIAL_CAPABILITIES.map((capability) => {
          const status = result.capabilities[capability];
          return [capability, {
            enabled: status.enabled,
            reason: status.reason,
            missingDependencies: status.missingDependencies,
            invalidDependencies: status.invalidDependencies,
            blockedDependencies: status.blockedDependencies,
          }];
        }),
      );

    expect(
      summarize(resolveCommercialCapabilities(environment, { definitions: forward })),
    ).toEqual(summarize(resolveCommercialCapabilities(environment, { definitions: reverse })));
  });

  it("keeps the production capability matrix deeply immutable", () => {
    if (false) {
      // @ts-expect-error The production matrix is deeply readonly.
      COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX.checkout.implementationAvailable = true;
    }

    expect(Object.isFrozen(COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX)).toBe(true);
    expect(Object.isFrozen(COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX.checkout)).toBe(true);
    expect(Reflect.set(
      COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX.checkout,
      "implementationAvailable",
      true,
    )).toBe(false);
    expect(COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX.checkout.implementationAvailable).toBe(false);
  });
});
