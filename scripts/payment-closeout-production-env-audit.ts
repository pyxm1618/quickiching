import { auditPaymentCloseoutProductionEnv, type PaymentCloseoutEnvEntry } from "../src/server/readiness/payment-closeout-env-audit";

const PRODUCTION_PROJECT_ID = "prj_pCpeoAys2GOqKZvkbLugYjpJWZBS";
const TEAM_ID = "team_z1b9TTQtbNkr43dzs5JVJPnQ";

async function main(): Promise<void> {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (!token) throw new Error("VERCEL_TOKEN_UNAVAILABLE");
  if (projectId !== PRODUCTION_PROJECT_ID) throw new Error("PRODUCTION_PROJECT_BINDING_MISMATCH");
  if (teamId !== TEAM_ID) throw new Error("PRODUCTION_TEAM_BINDING_MISMATCH");

  const url = new URL(`https://api.vercel.com/v10/projects/${PRODUCTION_PROJECT_ID}/env`);
  url.searchParams.set("teamId", TEAM_ID);
  url.searchParams.set("decrypt", "true");
  url.searchParams.set("source", "vercel-cli:pull");
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`VERCEL_ENV_FETCH_FAILED:${response.status}`);
  const payload = await response.json() as { envs?: PaymentCloseoutEnvEntry[] };
  if (!Array.isArray(payload.envs)) throw new Error("VERCEL_ENV_RESPONSE_INVALID");

  const audit = auditPaymentCloseoutProductionEnv(payload.envs);
  console.log(JSON.stringify(audit, null, 2));
  if (!audit.ok) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "PAYMENT_CLOSEOUT_PRODUCTION_ENV_AUDIT_FAILED");
  process.exitCode = 1;
});
