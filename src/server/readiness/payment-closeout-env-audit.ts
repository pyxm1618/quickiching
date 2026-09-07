export type PaymentCloseoutEnvEntry = {
  key?: unknown;
  target?: unknown;
  value?: unknown;
  type?: unknown;
};

type AuditMode = "staging" | "production";

type AuditResult<M extends AuditMode> = {
  ok: boolean;
  appEnv: M | "invalid" | "unreadable" | "missing";
  waffoEnvironment: M extends "staging" ? "test" | "invalid" | "unreadable" | "missing" : "prod" | "invalid" | "unreadable" | "missing";
  missingKeys: string[];
  unreadableRequiredValues: string[];
};

const BASE_REQUIRED_KEYS = Object.freeze([
  "DATABASE_URL",
  "WAFFO_MERCHANT_ID",
  "WAFFO_PRIVATE_KEY",
  "WAFFO_STORE_ID",
  "PAYMENT_CHECKOUT_URL_KEYS",
  "REFUND_OPERATOR_SECRET",
] as const);

function requiredKeys(mode: AuditMode): readonly string[] {
  return [
    ...BASE_REQUIRED_KEYS,
    mode === "staging" ? "WAFFO_TEST_PRODUCT_ID_ONE" : "WAFFO_PROD_PRODUCT_ID_ONE",
    mode === "staging" ? "WAFFO_TEST_PRODUCT_ID_THREE" : "WAFFO_PROD_PRODUCT_ID_THREE",
    mode === "staging" ? "WAFFO_TEST_PRODUCT_ID_FIVE" : "WAFFO_PROD_PRODUCT_ID_FIVE",
  ];
}

function targetsProduction(target: unknown): boolean {
  return target === "production" || (Array.isArray(target) && target.includes("production"));
}

function auditPaymentCloseoutEnv<M extends AuditMode>(
  entries: readonly PaymentCloseoutEnvEntry[],
  mode: M,
): AuditResult<M> {
  const production = new Map<string, PaymentCloseoutEnvEntry>();
  for (const entry of entries) {
    if (!targetsProduction(entry.target) || typeof entry.key !== "string" || !entry.key.trim()) continue;
    const key = entry.key.trim();
    if (production.has(key)) throw new Error(`PAYMENT_CLOSEOUT_ENV_DUPLICATE:${key}`);
    production.set(key, entry);
  }

  const missingKeys = requiredKeys(mode).filter((key) => !production.has(key));
  const unreadableRequiredValues: string[] = [];

  function exactValue(key: "APP_ENV" | "WAFFO_ENVIRONMENT", expected: string) {
    const entry = production.get(key);
    if (!entry) return "missing" as const;
    if (typeof entry.value !== "string" || !entry.value.trim()) {
      unreadableRequiredValues.push(key);
      return "unreadable" as const;
    }
    return entry.value.trim() === expected ? expected : "invalid" as const;
  }

  const expectedAppEnv = mode;
  const expectedWaffo = mode === "staging" ? "test" : "prod";
  const appEnvRaw = exactValue("APP_ENV", expectedAppEnv);
  const waffoRaw = exactValue("WAFFO_ENVIRONMENT", expectedWaffo);
  const appEnv = appEnvRaw === expectedAppEnv ? expectedAppEnv : appEnvRaw;
  const waffoEnvironment = waffoRaw === expectedWaffo ? expectedWaffo : waffoRaw;

  return {
    ok: missingKeys.length === 0 && unreadableRequiredValues.length === 0
      && appEnv === expectedAppEnv && waffoEnvironment === expectedWaffo,
    appEnv,
    waffoEnvironment,
    missingKeys: [...missingKeys].sort(),
    unreadableRequiredValues: unreadableRequiredValues.sort(),
  } as AuditResult<M>;
}

export function auditPaymentCloseoutStagingEnv(entries: readonly PaymentCloseoutEnvEntry[]): AuditResult<"staging"> {
  return auditPaymentCloseoutEnv(entries, "staging");
}

export function auditPaymentCloseoutProductionEnv(entries: readonly PaymentCloseoutEnvEntry[]): AuditResult<"production"> {
  return auditPaymentCloseoutEnv(entries, "production");
}
