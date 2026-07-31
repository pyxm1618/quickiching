type RuntimeEnv = Record<string, string | undefined>;

export function loadCronSecret(env: RuntimeEnv = process.env): string {
  const secret = env.CRON_SECRET?.trim();
  if (!secret) throw new Error("PRODUCTION_CONFIG_INVALID: CRON_SECRET is required");
  if (secret.length < 32) {
    throw new Error("PRODUCTION_CONFIG_INVALID: CRON_SECRET must be at least 32 characters");
  }
  return secret;
}

export function validateCronConfig(env: RuntimeEnv = process.env): void {
  if ((env.NODE_ENV ?? "development") === "production") loadCronSecret(env);
}
