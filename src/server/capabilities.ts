import * as z from "zod";

// Server-only capability resolution. Never import this module from a client component.

export const COMMERCIAL_CAPABILITIES = Object.freeze([
  "auth",
  "aiPreview",
  "checkout",
  "webhookIngestion",
  "paidDeepReading",
  "reconcile",
] as const);

export type CommercialCapability = (typeof COMMERCIAL_CAPABILITIES)[number];

type RuntimeEnv = Record<string, string | undefined>;

export type CapabilityRequirementFormat =
  | "nonBlank"
  | "httpUrl"
  | "postgresUrl"
  | "email"
  | "versionedKey";

export type CapabilityRequirement = {
  readonly name: string;
  readonly expected?: string;
  readonly allowed?: readonly string[];
  readonly format?: CapabilityRequirementFormat;
};

export type CommercialCapabilityDefinition = {
  readonly flag: string;
  readonly implementationAvailable: boolean;
  readonly capabilityDependencies: readonly CommercialCapability[];
  readonly requirements: readonly CapabilityRequirement[];
};

export type CommercialCapabilityDefinitionMap = Readonly<
  Record<CommercialCapability, CommercialCapabilityDefinition>
>;

const databaseRequirements: readonly CapabilityRequirement[] = [
  { name: "DATABASE_ADAPTER_MODE", expected: "postgres" },
  { name: "DATABASE_URL", format: "postgresUrl" },
];

const authRequirements: readonly CapabilityRequirement[] = [
  { name: "AUTH_ADAPTER_MODE", expected: "better-auth" },
  ...databaseRequirements,
  { name: "BETTER_AUTH_SECRET", format: "nonBlank" },
  { name: "BETTER_AUTH_URL", format: "httpUrl" },
  { name: "GOOGLE_CLIENT_ID", format: "nonBlank" },
  { name: "GOOGLE_CLIENT_SECRET", format: "nonBlank" },
  { name: "RESEND_API_KEY", format: "nonBlank" },
  { name: "EMAIL_FROM", format: "email" },
];

const sharedAiRequirements: readonly CapabilityRequirement[] = [
  { name: "AI_ADAPTER_MODE", expected: "ai-sdk" },
  ...databaseRequirements,
  { name: "AI_GATEWAY_API_KEY", format: "nonBlank" },
  { name: "AI_GATEWAY_BASE_URL", format: "httpUrl" },
  { name: "AI_MODEL_OUTPUT_REVIEW", format: "nonBlank" },
];

const aiPreviewRequirements: readonly CapabilityRequirement[] = [
  ...sharedAiRequirements,
  { name: "AI_MODEL_PREVIEW", format: "nonBlank" },
];

const waffoRequirements: readonly CapabilityRequirement[] = [
  { name: "PAYMENT_ADAPTER_MODE", expected: "waffo" },
  { name: "WAFFO_MERCHANT_ID", format: "nonBlank" },
  { name: "WAFFO_PRIVATE_KEY", format: "nonBlank" },
  { name: "WAFFO_ENVIRONMENT", allowed: ["test", "production"], format: "nonBlank" },
  { name: "WAFFO_STORE_ID", format: "nonBlank" },
];

const keyRequirements: readonly CapabilityRequirement[] = [
  { name: "SESSION_SIGNING_KEYS", format: "versionedKey" },
  { name: "QUESTION_FINGERPRINT_KEYS", format: "versionedKey" },
  { name: "QUESTION_ENCRYPTION_KEYS", format: "versionedKey" },
  { name: "RESULT_INTEGRITY_KEYS", format: "versionedKey" },
];

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;

  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

export const COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX: CommercialCapabilityDefinitionMap = deepFreeze({
  auth: {
    flag: "COMMERCIAL_V2_AUTH_ENABLED",
    implementationAvailable: false,
    capabilityDependencies: [],
    requirements: authRequirements,
  },
  aiPreview: {
    flag: "COMMERCIAL_V2_AI_PREVIEW_ENABLED",
    implementationAvailable: false,
    capabilityDependencies: ["auth"],
    requirements: aiPreviewRequirements,
  },
  checkout: {
    flag: "COMMERCIAL_V2_CHECKOUT_ENABLED",
    implementationAvailable: false,
    capabilityDependencies: ["auth", "webhookIngestion"],
    requirements: [
      ...databaseRequirements,
      ...waffoRequirements,
      { name: "APP_BASE_URL", format: "httpUrl" },
      { name: "WAFFO_PRODUCT_ID_ONE", format: "nonBlank" },
      { name: "WAFFO_PRODUCT_ID_THREE", format: "nonBlank" },
      { name: "WAFFO_PRODUCT_ID_FIVE", format: "nonBlank" },
    ],
  },
  webhookIngestion: {
    flag: "COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED",
    implementationAvailable: false,
    capabilityDependencies: [],
    requirements: [...databaseRequirements, ...waffoRequirements],
  },
  paidDeepReading: {
    flag: "COMMERCIAL_V2_PAID_DEEP_READING_ENABLED",
    implementationAvailable: false,
    capabilityDependencies: ["auth"],
    requirements: [
      ...sharedAiRequirements,
      { name: "WORKFLOW_ADAPTER_MODE", expected: "vercel" },
      { name: "BETTER_AUTH_SECRET", format: "nonBlank" },
      { name: "AI_MODEL_DEEP_READING", format: "nonBlank" },
      ...keyRequirements,
    ],
  },
  reconcile: {
    flag: "COMMERCIAL_V2_RECONCILE_ENABLED",
    implementationAvailable: false,
    capabilityDependencies: [],
    requirements: [
      ...databaseRequirements,
      { name: "WORKFLOW_ADAPTER_MODE", expected: "vercel" },
      { name: "CRON_SECRET", format: "nonBlank" },
    ],
  },
});

export type CommercialCapabilityStatus = {
  capability: CommercialCapability;
  flag: string;
  requested: boolean;
  enabled: boolean;
  reason:
    | "disabled"
    | "missing_dependencies"
    | "invalid_dependencies"
    | "blocked_dependencies"
    | "implementation_not_available"
    | "enabled";
  missingDependencies: string[];
  invalidDependencies: string[];
  blockedDependencies: string[];
};

export type CommercialCapabilityConfig = {
  allDisabled: boolean;
  commercialEnabled: boolean;
  requestedAny: boolean;
  capabilities: Record<CommercialCapability, CommercialCapabilityStatus>;
};

type RequirementInspection = {
  missingDependencies: string[];
  invalidDependencies: string[];
};

type CapabilityEvaluation = {
  requested: boolean;
  inspection: RequirementInspection;
};

export type ResolveCommercialCapabilitiesOptions = {
  readonly production?: boolean;
  readonly definitions?: CommercialCapabilityDefinitionMap;
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

function dependencyLabel(dependency: CapabilityRequirement): string {
  if (dependency.expected) return `${dependency.name}=${dependency.expected}`;
  if (dependency.allowed) return `${dependency.name}=${dependency.allowed.join("|")}`;
  return dependency.name;
}

function isHttpUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function isPostgresUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return (parsed.protocol === "postgres:" || parsed.protocol === "postgresql:") && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function isEmail(candidate: string): boolean {
  const address = candidate.match(/<([^<>]+)>$/)?.[1] ?? candidate;
  return z.string().email().safeParse(address).success;
}

function parseVersionedKeySet(candidate: string): { version: string; material: string }[] | null {
  const entries = candidate.split(",").map((entry) => entry.trim());
  if (entries.length === 0 || entries.some((entry) => entry.length === 0)) return null;

  const versions = new Set<string>();
  const keys: { version: string; material: string }[] = [];
  for (const entry of entries) {
    const match = /^([A-Za-z0-9][A-Za-z0-9._-]*):(.+)$/.exec(entry);
    if (!match || versions.has(match[1]) || !match[2].trim()) return null;
    versions.add(match[1]);
    keys.push({ version: match[1], material: match[2].trim() });
  }
  return keys;
}

function requirementSatisfied(candidate: string, requirement: CapabilityRequirement): boolean {
  if (requirement.expected && candidate !== requirement.expected) return false;
  if (requirement.allowed && !requirement.allowed.includes(candidate)) return false;

  switch (requirement.format) {
    case "httpUrl":
      return isHttpUrl(candidate);
    case "postgresUrl":
      return isPostgresUrl(candidate);
    case "email":
      return isEmail(candidate);
    case "versionedKey":
      return parseVersionedKeySet(candidate) !== null;
    case "nonBlank":
    case undefined:
      return true;
  }
}

function inspectRequirements(
  env: RuntimeEnv,
  requirements: readonly CapabilityRequirement[],
): RequirementInspection {
  const missingDependencies: string[] = [];
  const invalidDependencies: string[] = [];

  for (const requirement of requirements) {
    const rawCandidate = env[requirement.name];
    if (rawCandidate === undefined) {
      missingDependencies.push(dependencyLabel(requirement));
      continue;
    }
    const candidate = rawCandidate.trim();
    if (!candidate) {
      invalidDependencies.push(dependencyLabel(requirement));
      continue;
    }
    if (!requirementSatisfied(candidate, requirement)) {
      invalidDependencies.push(dependencyLabel(requirement));
    }
  }

  const keyNames = requirements
    .filter((requirement) => requirement.format === "versionedKey")
    .map((requirement) => requirement.name);
  if (keyNames.length > 1) {
    const materials = new Map<string, string>();
    for (const name of keyNames) {
      const candidate = value(env, name);
      const parsed = candidate ? parseVersionedKeySet(candidate) : null;
      if (!parsed) continue;
      for (const key of parsed) {
        const previousName = materials.get(key.material);
        if (previousName) {
          if (!invalidDependencies.includes(previousName)) invalidDependencies.push(previousName);
          if (!invalidDependencies.includes(name)) invalidDependencies.push(name);
        }
        materials.set(key.material, name);
      }
    }
  }

  return { missingDependencies, invalidDependencies };
}

function isCommercialCapability(candidate: string): candidate is CommercialCapability {
  return (COMMERCIAL_CAPABILITIES as readonly string[]).includes(candidate);
}

function emptyRequirementInspection(): RequirementInspection {
  return { missingDependencies: [], invalidDependencies: [] };
}

function createBlockedStatus(
  capability: CommercialCapability,
  definition: CommercialCapabilityDefinition | undefined,
  requested: boolean,
  blockedDependencies: string[],
): CommercialCapabilityStatus {
  return {
    capability,
    flag: definition?.flag ?? "",
    requested,
    enabled: false,
    reason: "blocked_dependencies",
    missingDependencies: [],
    invalidDependencies: [],
    blockedDependencies,
  };
}

export function resolveCommercialCapabilities(
  env: RuntimeEnv = process.env,
  options: ResolveCommercialCapabilitiesOptions = {},
): CommercialCapabilityConfig {
  const definitions = options.definitions ?? COMMERCIAL_CAPABILITY_DEPENDENCY_MATRIX;
  const preliminary = {} as Record<CommercialCapability, CapabilityEvaluation>;

  for (const capability of COMMERCIAL_CAPABILITIES) {
    const definition = definitions[capability];
    if (!definition) {
      preliminary[capability] = {
        requested: false,
        inspection: emptyRequirementInspection(),
      };
      continue;
    }

    const requested = booleanFlag(env, definition.flag, options.production === true);
    preliminary[capability] = {
      requested,
      inspection: requested
        ? inspectRequirements(env, definition.requirements)
        : emptyRequirementInspection(),
    };
  }

  const statuses = {} as Record<CommercialCapability, CommercialCapabilityStatus>;
  const resolving = new Set<CommercialCapability>();

  const evaluate = (capability: CommercialCapability): CommercialCapabilityStatus => {
    const cached = statuses[capability];
    if (cached) return cached;

    const definition = definitions[capability];
    const current = preliminary[capability] ?? {
      requested: false,
      inspection: emptyRequirementInspection(),
    };

    if (resolving.has(capability)) {
      return createBlockedStatus(capability, definition, current.requested, [`cycle:${capability}`]);
    }

    resolving.add(capability);
    const missingDependencies = [...current.inspection.missingDependencies];
    const invalidDependencies = [...current.inspection.invalidDependencies];
    const blockedDependencies: string[] = [];

    if (current.requested && definition) {
      for (const dependency of definition.capabilityDependencies) {
        if (!isCommercialCapability(dependency) || !definitions[dependency]) {
          blockedDependencies.push(`unknown:${String(dependency)}`);
          continue;
        }

        const dependencyStatus = evaluate(dependency);
        if (!dependencyStatus.enabled) blockedDependencies.push(dependency);
      }
    }

    let reason: CommercialCapabilityStatus["reason"] = "disabled";
    if (current.requested && invalidDependencies.length > 0) reason = "invalid_dependencies";
    else if (current.requested && missingDependencies.length > 0) reason = "missing_dependencies";
    else if (current.requested && blockedDependencies.length > 0) reason = "blocked_dependencies";
    else if (current.requested && !definition?.implementationAvailable) reason = "implementation_not_available";
    else if (current.requested && definition) reason = "enabled";
    else if (current.requested) reason = "blocked_dependencies";

    const status: CommercialCapabilityStatus = {
      capability,
      flag: definition?.flag ?? "",
      requested: current.requested,
      enabled: reason === "enabled",
      reason,
      missingDependencies,
      invalidDependencies,
      blockedDependencies,
    };
    resolving.delete(capability);
    statuses[capability] = status;
    return status;
  };

  for (const capability of COMMERCIAL_CAPABILITIES) evaluate(capability);

  const statusList = Object.values(statuses);
  return {
    allDisabled: statusList.every((status) => !status.enabled),
    commercialEnabled: statusList.some((status) => status.enabled),
    requestedAny: statusList.some((status) => status.requested),
    capabilities: statuses,
  };
}
