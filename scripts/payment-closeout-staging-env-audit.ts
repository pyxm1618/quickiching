import { auditPaymentCloseoutStagingEnv, type PaymentCloseoutEnvEntry } from "../src/server/readiness/payment-closeout-env-audit";

const STAGING_PROJECT_ID = "prj_iKtw9xKmIlEfe44gEocgLr2QDLfE";

async function main(): Promise<void> {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  if (!token) throw new Error("VERCEL_TOKEN_UNAVAILABLE");
  if (projectId !== STAGING_PROJECT_ID) throw new Error("STAGING_PROJECT_BINDING_MISMATCH");

  const url = new URL(`https://api.vercel.com/v10/projects/${STAGING_PROJECT_ID}/env`);
  url.searchParams.set("decrypt", "true");
  url.searchParams.set("source", "vercel-cli:pull");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`VERCEL_ENV_FETCH_FAILED:${response.status}`);
  const payload = await response.json() as { envs?: PaymentCloseoutEnvEntry[] };
  if (!Array.isArray(payload.envs)) throw new Error("VERCEL_ENV_RESPONSE_INVALID");

  const audit = auditPaymentCloseoutStagingEnv(payload.envs);
  console.log(JSON.stringify(audit, null, 2));
  if (!audit.ok) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "PAYMENT_CLOSEOUT_STAGING_ENV_AUDIT_FAILED");
  process.exitCode = 1;
});
