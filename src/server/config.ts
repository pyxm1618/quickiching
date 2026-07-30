import { createHash } from "node:crypto";
import * as z from "zod";

export type VersionedKey = {
  version: string;
  value: string;
};

export type VersionedKeySet = {
  writeVersion: string;
  read: VersionedKey[];
};

export type RuntimeKeys = {
  sessionSigning: VersionedKeySet;
  questionFingerprint: VersionedKeySet;
  questionEncryption: VersionedKeySet;
  resultIntegrity: VersionedKeySet;
};

type LocalRuntimeConfig = {
  mode: "development" | "test";
  ai: "local";
  auth: "dev";
  payment: "simulated";
  database: "memory";
  workflow: "local";
  keys: RuntimeKeys;
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
  keys: RuntimeKeys;
};

export type RuntimeConfig = LocalRuntimeConfig | ProductionRuntimeConfig;

type RuntimeEnv = Record<string, string | undefined>;

const modeSchema = z.enum(["development", "test", "production"]);
const MINIMUM_KEY_BYTES = 32;
const MINIMUM_KEY_ENTROPY_BITS_PER_BYTE = 3.5;
const MINIMUM_UNIQUE_KEY_BYTES = 16;
const PLACEHOLDER_MATERIAL = /(?:change[-_ ]?me|replace[-_ ]?me|placeholder|example|dummy|sample|password|secret|development|local[-_ ]?key|test[-_ ]?key|your[-_ ]?key|todo)/i;

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

function decodeBase64Strict(payload: string): Buffer | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload) || payload.length % 4 !== 0) return null;
  const decoded = Buffer.from(payload, "base64");
  return decoded.toString("base64") === payload ? decoded : null;
}

function decodeHexStrict(payload: string): Buffer | null {
  if (!/^[A-Fa-f0-9]+$/.test(payload) || payload.length % 2 !== 0) return null;
  return Buffer.from(payload, "hex");
}

function decodeEncodedKeyMaterial(value: string): Buffer | null {
  if (value.startsWith("base64:")) return decodeBase64Strict(value.slice("base64:".length));
  if (value.startsWith("hex:")) return decodeHexStrict(value.slice("hex:".length));
  return null;
}

function entropyBitsPerByte(bytes: Buffer): number {
  const counts = new Map<number, number>();
  for (const byte of bytes) counts.set(byte, (counts.get(byte) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / bytes.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

function containsPlaceholderMaterial(bytes: Buffer): boolean {
  if ([...bytes].some((byte) => byte < 0x20 || byte > 0x7e)) return false;
  return PLACEHOLDER_MATERIAL.test(bytes.toString("ascii"));
}

function validateKeyMaterial(value: string, keysName: string, version: string): Buffer {
  if (!value.startsWith("base64:") && !value.startsWith("hex:")) {
    invalid(`${keysName} key ${version} must use base64: or hex: encoding`, true);
  }
  const material = decodeEncodedKeyMaterial(value);
  if (!material) invalid(`${keysName} key ${version} has invalid encoded material`, true);
  if (material.length < MINIMUM_KEY_BYTES) {
    invalid(`${keysName} key ${version} must decode to at least ${MINIMUM_KEY_BYTES} bytes`, true);
  }
  if (containsPlaceholderMaterial(material)) {
    invalid(`${keysName} key ${version} contains placeholder material`, true);
  }
  const uniqueBytes = new Set(material).size;
  if (
    uniqueBytes < MINIMUM_UNIQUE_KEY_BYTES
    || entropyBitsPerByte(material) < MINIMUM_KEY_ENTROPY_BITS_PER_BYTE
  ) {
    invalid(`${keysName} key ${version} does not contain sufficient entropy`, true);
  }
  return material;
}

function versionedKeySet(env: RuntimeEnv, keysName: string, writeVersionName: string): VersionedKeySet {
  const raw = required(env, keysName);
  const entries = raw.split(",").map((entry) => entry.trim());
  const read: VersionedKey[] = [];
  const versions = new Set<string>();

  for (const entry of entries) {
    const match = /^([A-Za-z0-9][A-Za-z0-9._-]*):(.+)$/.exec(entry);
    if (!match || !match[2].trim() || versions.has(match[1])) {
      invalid(`${keysName} must use unique version:key entries`, true);
    }
    const version = match[1];
    const value = match[2].trim();
    validateKeyMaterial(value, keysName, version);
    versions.add(version);
    read.push({ version, value });
  }

  const writeVersion = required(env, writeVersionName);
  if (!versions.has(writeVersion)) {
    invalid(`${writeVersionName} must reference a version in ${keysName}`, true);
  }
  return { writeVersion, read };
}

function assertPurposeSeparated(keys: RuntimeKeys, production: boolean): void {
  const materials = new Set<string>();
  for (const keySet of Object.values(keys)) {
    for (const key of keySet.read) {
      const material = production
        ? decodeEncodedKeyMaterial(key.value)
        : Buffer.from(key.value, "utf8");
      if (!material) invalid(`key ${key.version} has invalid encoded material`, production);
      const fingerprint = createHash("sha256").update(material).digest("hex");
      if (materials.has(fingerprint)) invalid("key material must not be reused across purposes", production);
      materials.add(fingerprint);
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
  if (!z.string().email().safeParse(emailFrom.match(/<([^>]+)>$/)?.[1] ?? emailFrom).success) {
    invalid("EMAIL_FROM must contain a valid email address", true);
  }
  const databaseUrl = required(env, "DATABASE_URL");
  if (!z.string().url().safeParse(databaseUrl).success || !databaseUrl.startsWith("postgres")) {
    invalid("DATABASE_URL must be a PostgreSQL URL", true);
  }

  const keys: RuntimeKeys = {
    sessionSigning: versionedKeySet(env, "SESSION_SIGNING_KEYS", "SESSION_SIGNING_WRITE_VERSION"),
    questionFingerprint: versionedKeySet(
      env,
      "QUESTION_FINGERPRINT_KEYS",
      "QUESTION_FINGERPRINT_WRITE_VERSION",
    ),
    questionEncryption: versionedKeySet(
      env,
      "QUESTION_ENCRYPTION_KEYS",
      "QUESTION_ENCRYPTION_WRITE_VERSION",
    ),
    resultIntegrity: versionedKeySet(env, "RESULT_INTEGRITY_KEYS", "RESULT_INTEGRITY_WRITE_VERSION"),
  };
  assertPurposeSeparated(keys, true);

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

function localKeySet(purpose: string): VersionedKeySet {
  const version = "v1";
  return {
    writeVersion: version,
    read: [{ version, value: `local-${purpose}-key-material-never-use-in-production` }],
  };
}

function loadLocalConfig(env: RuntimeEnv, mode: "development" | "test"): LocalRuntimeConfig {
  const keys: RuntimeKeys = {
    sessionSigning: localKeySet("session-signing"),
    questionFingerprint: localKeySet("question-fingerprint"),
    questionEncryption: localKeySet("question-encryption"),
    resultIntegrity: localKeySet("result-integrity"),
  };
  assertPurposeSeparated(keys, false);
  return {
    mode,
    ai: oneOf(env.AI_ADAPTER_MODE, ["local"] as const, "AI_ADAPTER_MODE", "local"),
    auth: oneOf(env.AUTH_ADAPTER_MODE, ["dev"] as const, "AUTH_ADAPTER_MODE", "dev"),
    payment: oneOf(env.PAYMENT_ADAPTER_MODE, ["simulated"] as const, "PAYMENT_ADAPTER_MODE", "simulated"),
    database: oneOf(env.DATABASE_ADAPTER_MODE, ["memory"] as const, "DATABASE_ADAPTER_MODE", "memory"),
    workflow: oneOf(env.WORKFLOW_ADAPTER_MODE, ["local"] as const, "WORKFLOW_ADAPTER_MODE", "local"),
    keys,
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

export function resolveVersionedKey(keySet: VersionedKeySet, version: string): VersionedKey {
  const key = keySet.read.find((candidate) => candidate.version === version);
  if (!key) throw new Error(`KEY_VERSION_UNAVAILABLE: ${version}`);
  return key;
}

export function resolveWriteKey(keySet: VersionedKeySet): VersionedKey {
  return resolveVersionedKey(keySet, keySet.writeVersion);
}
