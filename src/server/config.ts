import * as z from "zod";
import {
  resolveCommercialCapabilities,
  type CommercialCapabilityConfig,
} from "./capabilities";

type LocalRuntimeConfig = {
  mode: "development" | "test";
  ai: "local";
  auth: "dev";
  payment: "simulated";
  database: "memory";
  workflow: "local";
  capabilities: CommercialCapabilityConfig;
};

type ProductionRuntimeConfig = {
  mode: "production";
  // Public V1 has no production AI adapter. This is deliberately not a local
  // fallback: a commercial AI path must be enabled by a later checkpoint.
  ai: "disabled";
  auth: "disabled";
  // Waffo is the only approved payment target. The capability remains closed
  // until the provider adapter and its separately reviewed credentials exist.
  payment: "waffo";
  database: "disabled";
  workflow: "disabled";
  baseUrl: string;
  publicAppUrl: string;
  capabilities: CommercialCapabilityConfig;
};

export type RuntimeConfig = LocalRuntimeConfig | ProductionRuntimeConfig;

type RuntimeEnv = Record<string, string | undefined>;

const modeSchema = z.enum(["development", "test", "production"]);

function invalid(message: string, production = false): never {
  throw new Error(`${production ? "PRODUCTION_CONFIG_INVALID" : "CONFIG_INVALID"}: ${message}`);
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

function optionalUrl(
  env: RuntimeEnv,
  name: string,
  fallback: string,
  production = false,
): string {
  const candidate = env[name]?.trim() || fallback;
  let isHttp = false;
  try {
    const parsed = new URL(candidate);
    isHttp = (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname.length > 0;
  } catch {
    isHttp = false;
  }
  if (!isHttp) {
    invalid(`${name} must be a valid HTTP or HTTPS URL`, production);
  }
  return candidate;
}

function loadProductionConfig(env: RuntimeEnv): ProductionRuntimeConfig {
  // This is a target selection, not an adapter activation. It must never
  // require Waffo credentials while all commercial capabilities are closed.
  const payment = oneOf(
    env.PAYMENT_ADAPTER_MODE,
    ["waffo"] as const,
    "PAYMENT_ADAPTER_MODE",
    "waffo",
    true,
  );
  const baseUrl = optionalUrl(env, "APP_BASE_URL", "https://www.quickiching.com", true);
  const publicAppUrl = optionalUrl(env, "NEXT_PUBLIC_APP_URL", baseUrl, true);

  return {
    mode: "production",
    ai: "disabled",
    auth: "disabled",
    payment,
    database: "disabled",
    workflow: "disabled",
    baseUrl,
    publicAppUrl,
    capabilities: resolveCommercialCapabilities(env, { production: true }),
  };
}

function loadLocalConfig(env: RuntimeEnv, mode: "development" | "test"): LocalRuntimeConfig {
  return {
    mode,
    ai: oneOf(env.AI_ADAPTER_MODE, ["local"] as const, "AI_ADAPTER_MODE", "local"),
    auth: oneOf(env.AUTH_ADAPTER_MODE, ["dev"] as const, "AUTH_ADAPTER_MODE", "dev"),
    payment: oneOf(
      env.PAYMENT_ADAPTER_MODE,
      ["simulated"] as const,
      "PAYMENT_ADAPTER_MODE",
      "simulated",
    ),
    database: oneOf(
      env.DATABASE_ADAPTER_MODE,
      ["memory"] as const,
      "DATABASE_ADAPTER_MODE",
      "memory",
    ),
    workflow: oneOf(env.WORKFLOW_ADAPTER_MODE, ["local"] as const, "WORKFLOW_ADAPTER_MODE", "local"),
    capabilities: resolveCommercialCapabilities(env),
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
