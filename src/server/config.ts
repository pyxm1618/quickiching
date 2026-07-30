import * as z from "zod";

export type VersionedKey = {
  version: string;
  value: string;
};

type LocalRuntimeConfig = {
  mode: "development" | "test";
  ai: "local";
  auth: "dev";
  payment: "simulated";
  database: "memory";
  workflow: "local";
};

type ProductionRuntimeConfig = {
  mode: "production";
  ai: "ai-sdk";
  auth: "better-auth";
  payment: "creem";
  database: "postgres";
  baseUrl: string;
  credentials: {
    aiGatewayApiKey: string;
    aiModelPreview: string;
    aiModelDeepReading: string;
    aiModelOutputReview: string;
    betterAuthSecret: string;
    betterAuthUrl: string;
    googleClientId: string;
    googleClientSecret: string;
    resendApiKey: string;
    emailFrom: string;
    creemApiKey: string;
    creemWebhookSecret: string;
    creemProductIdOne: string;
    creemProductIdThree: string;
    creemProductIdFive: string;
    databaseUrl: string;
    turnstileSecretKey: string;
    turnstileSiteKey: string;
    publicAppUrl: string;
    workflowAdapterMode: "vercel";
  };
  keys: {
    sessionSigning: VersionedKey[];
    questionFingerprint: VersionedKey[];
    questionEncryption: VersionedKey[];
    resultIntegrity: VersionedKey[];
  };
};

export type RuntimeConfig = LocalRuntimeConfig | ProductionRuntimeConfig;

type RuntimeEnv = Record<string, string | undefined>;

const modeSchema = z.enum(["development", "test", "production"]);

function invalid(message: string, production = false): never {
  throw new Error(`${production ? "PRODUCTION_CONFIG_INVALID" : "CONFIG_INVALID"}: ${message}`);
}

function required(env: RuntimeEnv, name: string): string {
  const parsed = z.string().trim().min(1).safeParse(env[name]);
  if (parsed.success) return parsed.data;
  return invalid(`${name} is required`, true);
}

function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly [T, ...T[]],
  name: string,
  fallback: T | undefined,
  production = false,
): T {
  if (value === undefined && fallback === undefined) return invalid(`${name} is required`, production);
  const parsed = z.enum(allowed).safeParse(value ?? fallback);
  if (parsed.success) return parsed.data;
  return invalid(`${name} must be one of: ${allowed.join(", ")}`, production);
}

function versionedKeySet(env: RuntimeEnv, name: string): VersionedKey[] {
  const raw = required(env, name);
  const entries = raw.split(",").map((entry) => entry.trim());
  const keys: VersionedKey[] = [];
  const versions = new Set<string>();

  for (const entry of entries) {
    const match = /^([A-Za-z0-9][A-Za-z0-9._-]*):(.+)$/.exec(entry);
    if (!match || !match[2].trim() || versions.has(match[1]))
      invalid(`${name} must use version:key entries`, true);
    versions.add(match[1]);
    keys.push({ version: match[1], value: match[2].trim() });
  }

  return keys;
}

function assertPurposeSeparated(keys: ProductionRuntimeConfig["keys"]): void {
  const materials = new Set<string>();
  for (const keySet of Object.values(keys)) {
    for (const key of keySet) {
      if (materials.has(key.value)) invalid("key material must not be reused across purposes", true);
      materials.add(key.value);
    }
  }
}

function loadProductionConfig(env: RuntimeEnv): ProductionRuntimeConfig {
  const ai = oneOf(env.AI_ADAPTER_MODE, ["ai-sdk"] as const, "AI_ADAPTER_MODE", undefined, true);
  const auth = oneOf(env.AUTH_ADAPTER_MODE, ["better-auth"] as const, "AUTH_ADAPTER_MODE", undefined, true);
  const payment = oneOf(env.PAYMENT_ADAPTER_MODE, ["creem"] as const, "PAYMENT_ADAPTER_MODE", undefined, true);
  const database = oneOf(env.DATABASE_ADAPTER_MODE, ["postgres"] as const, "DATABASE_ADAPTER_MODE", undefined, true);
  const workflowAdapterMode = oneOf(
    env.WORKFLOW_ADAPTER_MODE,
    ["vercel"] as const,
    "WORKFLOW_ADAPTER_MODE",
    undefined,
    true,
  );
  const baseUrl = required(env, "APP_BASE_URL");
  if (!z.string().url().safeParse(baseUrl).success) invalid("APP_BASE_URL must be a valid URL", true);
  const publicAppUrl = required(env, "NEXT_PUBLIC_APP_URL");
  if (!z.string().url().safeParse(publicAppUrl).success) invalid("NEXT_PUBLIC_APP_URL must be a valid URL", true);
  const betterAuthUrl = required(env, "BETTER_AUTH_URL");
  if (!z.string().url().safeParse(betterAuthUrl).success) invalid("BETTER_AUTH_URL must be a valid URL", true);
  const emailFrom = required(env, "EMAIL_FROM");
  if (!z.string().email().safeParse(emailFrom.match(/<([^>]+)>$/)?.[1] ?? emailFrom).success)
    invalid("EMAIL_FROM must contain a valid email address", true);
  const databaseUrl = required(env, "DATABASE_URL");
  if (!z.string().url().safeParse(databaseUrl).success || !databaseUrl.startsWith("postgres"))
    invalid("DATABASE_URL must be a PostgreSQL URL", true);

  const keys = {
    sessionSigning: versionedKeySet(env, "SESSION_SIGNING_KEYS"),
    questionFingerprint: versionedKeySet(env, "QUESTION_FINGERPRINT_KEYS"),
    questionEncryption: versionedKeySet(env, "QUESTION_ENCRYPTION_KEYS"),
    resultIntegrity: versionedKeySet(env, "RESULT_INTEGRITY_KEYS"),
  };
  assertPurposeSeparated(keys);

  return {
    mode: "production",
    ai,
    auth,
    payment,
    database,
    baseUrl,
    credentials: {
      aiGatewayApiKey: required(env, "AI_GATEWAY_API_KEY"),
      aiModelPreview: required(env, "AI_MODEL_PREVIEW"),
      aiModelDeepReading: required(env, "AI_MODEL_DEEP_READING"),
      aiModelOutputReview: required(env, "AI_MODEL_OUTPUT_REVIEW"),
      betterAuthSecret: required(env, "BETTER_AUTH_SECRET"),
      betterAuthUrl,
      googleClientId: required(env, "GOOGLE_CLIENT_ID"),
      googleClientSecret: required(env, "GOOGLE_CLIENT_SECRET"),
      resendApiKey: required(env, "RESEND_API_KEY"),
      emailFrom,
      creemApiKey: required(env, "CREEM_API_KEY"),
      creemWebhookSecret: required(env, "CREEM_WEBHOOK_SECRET"),
      creemProductIdOne: required(env, "CREEM_PRODUCT_ID_ONE"),
      creemProductIdThree: required(env, "CREEM_PRODUCT_ID_THREE"),
      creemProductIdFive: required(env, "CREEM_PRODUCT_ID_FIVE"),
      databaseUrl,
      turnstileSecretKey: required(env, "TURNSTILE_SECRET_KEY"),
      turnstileSiteKey: required(env, "NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
      publicAppUrl,
      workflowAdapterMode,
    },
    keys,
  };
}

function loadLocalConfig(env: RuntimeEnv, mode: "development" | "test"): LocalRuntimeConfig {
  return {
    mode,
    ai: oneOf(env.AI_ADAPTER_MODE, ["local"] as const, "AI_ADAPTER_MODE", "local"),
    auth: oneOf(env.AUTH_ADAPTER_MODE, ["dev"] as const, "AUTH_ADAPTER_MODE", "dev"),
    payment: oneOf(env.PAYMENT_ADAPTER_MODE, ["simulated"] as const, "PAYMENT_ADAPTER_MODE", "simulated"),
    database: oneOf(env.DATABASE_ADAPTER_MODE, ["memory"] as const, "DATABASE_ADAPTER_MODE", "memory"),
    workflow: oneOf(env.WORKFLOW_ADAPTER_MODE, ["local"] as const, "WORKFLOW_ADAPTER_MODE", "local"),
  };
}

export function loadRuntimeConfig(env: RuntimeEnv = process.env): RuntimeConfig {
  const parsedMode = modeSchema.safeParse(env.NODE_ENV ?? "development");
  if (!parsedMode.success) invalid("NODE_ENV must be one of: development, test, production");
  if (parsedMode.data === "production") return loadProductionConfig(env);
  return loadLocalConfig(env, parsedMode.data);
}

export function validateRuntimeConfig(env: RuntimeEnv = process.env): RuntimeConfig {
  return loadRuntimeConfig(env);
}

export function runtimeConfig(): RuntimeConfig {
  return loadRuntimeConfig();
}
