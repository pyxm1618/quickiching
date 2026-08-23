// Server-only capability resolution. Never import this module from a client component.

export const COMMERCIAL_CAPABILITIES = [
  "auth",
  "aiPreview",
  "checkout",
  "webhookIngestion",
  "paidDeepReading",
  "reconcile",
] as const;

export type CommercialCapability = (typeof COMMERCIAL_CAPABILITIES)[number];

type RuntimeEnv = Record<string, string | undefined>;

type Dependency = {
  name: string;
  expected?: string;
  allowed?: readonly string[];
};

export type CommercialCapabilityDefinition = {
  flag: string;
  implementationAvailable: boolean;
  requirements: readonly Dependency[];
};

export const COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX: Readonly<
  Record<CommercialCapability, CommercialCapabilityDefinition>
> = {
  auth: {
    flag: "COMMERCIAL_V2_AUTH_ENABLED",
    implementationAvailable: false,
    requirements: [
      { name: "AUTH_ADAPTER_MODE", expected: "better-auth" },
      { name: "BETTER_AUTH_SECRET" },
      { name: "BETTER_AUTH_URL" },
      { name: "GOOGLE_CLIENT_ID" },
      { name: "GOOGLE_CLIENT_SECRET" },
      { name: "RESEND_API_KEY" },
      { name: "EMAIL_FROM" },
    ],
  },
  aiPreview: {
    flag: "COMMERCIAL_V2_AI_PREVIEW_ENABLED",
    implementationAvailable: false,
    requirements: [
      { name: "AI_ADAPTER_MODE", expected: "ai-sdk" },
      { name: "AI_GATEWAY_API_KEY" },
      { name: "AI_GATEWAY_BASE_URL" },
      { name: "AI_MODEL_PREVIEW" },
      { name: "AI_MODEL_OUTPUT_REVIEW" },
    ],
  },
  checkout: {
    flag: "COMMERCIAL_V2_CHECKOUT_ENABLED",
    implementationAvailable: false,
    requirements: [
      { name: "PAYMENT_ADAPTER_MODE", expected: "waffo" },
      { name: "WAFFO_MERCHANT_ID" },
      { name: "WAFFO_PRIVATE_KEY" },
      { name: "WAFFO_ENVIRONMENT", allowed: ["test", "production"] },
      { name: "WAFFO_STORE_ID" },
      { name: "WAFFO_PRODUCT_ID_ONE" },
      { name: "WAFFO_PRODUCT_ID_THREE" },
      { name: "WAFFO_PRODUCT_ID_FIVE" },
      { name: "APP_BASE_URL" },
    ],
  },
  webhookIngestion: {
    flag: "COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED",
    implementationAvailable: false,
    requirements: [
      { name: "PAYMENT_ADAPTER_MODE", expected: "waffo" },
      { name: "WAFFO_MERCHANT_ID" },
      { name: "WAFFO_PRIVATE_KEY" },
      { name: "WAFFO_ENVIRONMENT", allowed: ["test", "production"] },
      { name: "WAFFO_STORE_ID" },
    ],
  },
  paidDeepReading: {
    flag: "COMMERCIAL_V2_PAID_DEEP_READING_ENABLED",
    implementationAvailable: false,
    requirements: [
      { name: "AUTH_ADAPTER_MODE", expected: "better-auth" },
      { name: "AI_ADAPTER_MODE", expected: "ai-sdk" },
      { name: "DATABASE_ADAPTER_MODE", expected: "postgres" },
      { name: "WORKFLOW_ADAPTER_MODE", expected: "vercel" },
      { name: "BETTER_AUTH_SECRET" },
      { name: "DATABASE_URL" },
      { name: "AI_GATEWAY_API_KEY" },
      { name: "AI_GATEWAY_BASE_URL" },
      { name: "AI_MODEL_DEEP_READING" },
      { name: "AI_MODEL_OUTPUT_REVIEW" },
      { name: "SESSION_SIGNING_KEYS" },
      { name: "QUESTION_FINGERPRINT_KEYS" },
      { name: "QUESTION_ENCRYPTION_KEYS" },
      { name: "RESULT_INTEGRITY_KEYS" },
    ],
  },
  reconcile: {
    flag: "COMMERCIAL_V2_RECONCILE_ENABLED",
    implementationAvailable: false,
    requirements: [
      { name: "DATABASE_ADAPTER_MODE", expected: "postgres" },
      { name: "WORKFLOW_ADAPTER_MODE", expected: "vercel" },
      { name: "DATABASE_URL" },
      { name: "CRON_SECRET" },
    ],
  },
};

export type CommercialCapabilityStatus = {
  capability: CommercialCapability;
  flag: string;
  requested: boolean;
  enabled: boolean;
  reason:
    | "disabled"
    | "missing_dependencies"
    | "implementation_not_available"
    | "enabled";
  missingDependencies: string[];
};

export type CommercialCapabilityConfig = {
  allDisabled: boolean;
  commercialEnabled: boolean;
  requestedAny: boolean;
  capabilities: Record<CommercialCapability, CommercialCapabilityStatus>;
};

function value(env: RuntimeEnv, name: string): string | undefined {
  const candidate = env[name]?.trim();
  return candidate ? candidate : undefined;
}

function booleanFlag(env: RuntimeEnv, name: string, production: boolean): boolean {
  const raw = value(env, name)?.toLowerCase();
  if (raw === undefined || raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  const prefix = production ? "PRODUCTION_CONFIG_INVALID" : "CONFIG_INVALID";
  throw new Error(`${prefix}: ${name} must be true or false`);
}

function dependencyLabel(dependency: Dependency): string {
  if (dependency.expected) return `${dependency.name}=${dependency.expected}`;
  if (dependency.allowed) return `${dependency.name}=${dependency.allowed.join("|")}`;
  return dependency.name;
}

function missingDependencies(env: RuntimeEnv, definition: CommercialCapabilityDefinition): string[] {
  return definition.requirements
    .filter((dependency) => {
      const actual = value(env, dependency.name);
      if (!actual) return true;
      if (dependency.expected && actual !== dependency.expected) return true;
      if (dependency.allowed && !dependency.allowed.includes(actual)) return true;
      return false;
    })
    .map(dependencyLabel);
}

export function resolveCommercialCapabilities(
  env: RuntimeEnv = process.env,
  options: { production?: boolean } = {},
): CommercialCapabilityConfig {
  const statuses = {} as Record<CommercialCapability, CommercialCapabilityStatus>;

  for (const capability of COMMERCIAL_CAPABILITIES) {
    const definition = COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX[capability];
    const requested = booleanFlag(env, definition.flag, options.production === true);
    const missing = requested ? missingDependencies(env, definition) : [];

    let reason: CommercialCapabilityStatus["reason"] = "disabled";
    if (requested && missing.length > 0) reason = "missing_dependencies";
    else if (requested && !definition.implementationAvailable) reason = "implementation_not_available";
    else if (requested) reason = "enabled";

    statuses[capability] = {
      capability,
      flag: definition.flag,
      requested,
      enabled: reason === "enabled",
      reason,
      missingDependencies: missing,
    };
  }

  const statusList = Object.values(statuses);
  return {
    allDisabled: statusList.every((status) => !status.enabled),
    commercialEnabled: statusList.some((status) => status.enabled),
    requestedAny: statusList.some((status) => status.requested),
    capabilities: statuses,
  };
}
