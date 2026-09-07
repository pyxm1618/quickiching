export type PaymentCloseoutEnvEntry = {
  key?: unknown;
  target?: unknown;
  value?: unknown;
  type?: unknown;
};

const REQUIRED_PRESENCE_KEYS = Object.freeze([
  "DATABASE_URL",
  "WAFFO_MERCHANT_ID",
  "WAFFO_PRIVATE_KEY",
  "WAFFO_STORE_ID",
  "WAFFO_TEST_PRODUCT_ID_ONE",
  "WAFFO_TEST_PRODUCT_ID_THREE",
  "WAFFO_TEST_PRODUCT_ID_FIVE",
  "PAYMENT_CHECKOUT_URL_KEYS",
  "REFUND_OPERATOR_SECRET",
] as const);

function targetsProduction(target: unknown): boolean {
  return target === "production" || (Array.isArray(target) && target.includes("production"));
}

export function auditPaymentCloseoutStagingEnv(entries: readonly PaymentCloseoutEnvEntry[]): {
  ok: boolean;
  appEnv: "staging" | "invalid" | "unreadable" | "missing";
  waffoEnvironment: "test" | "invalid" | "unreadable" | "missing";
  missingKeys: string[];
  unreadableRequiredValues: string[];
} {
  const production = new Map<string, PaymentCloseoutEnvEntry>();
  for (const entry of entries) {
    if (!targetsProduction(entry.target) || typeof entry.key !== "string" || !entry.key.trim()) continue;
    const key = entry.key.trim();
    if (production.has(key)) throw new Error(`PAYMENT_CLOSEOUT_ENV_DUPLICATE:${key}`);
    production.set(key, entry);
  }

  const missingKeys = REQUIRED_PRESENCE_KEYS.filter((key) => !production.has(key));
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

  const appEnvRaw = exactValue("APP_ENV", "staging");
  const waffoRaw = exactValue("WAFFO_ENVIRONMENT", "test");
  const appEnv = appEnvRaw === "staging" ? "staging" : appEnvRaw;
  const waffoEnvironment = waffoRaw === "test" ? "test" : waffoRaw;

  return {
    ok: missingKeys.length === 0 && unreadableRequiredValues.length === 0
      && appEnv === "staging" && waffoEnvironment === "test",
    appEnv,
    waffoEnvironment,
    missingKeys: [...missingKeys].sort(),
    unreadableRequiredValues: unreadableRequiredValues.sort(),
  };
}
