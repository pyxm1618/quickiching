import { runtimeConfig } from "@/server/config";
import { hasValidBearerSecret } from "@/server/http/bearer-secret";
import { dispatchGenerationOutbox } from "@/server/jobs/dispatch-generation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function dispatch(request: Request): Promise<Response> {
  const config = runtimeConfig();
  if (config.mode !== "production" || !hasValidBearerSecret(request, config.credentials.cronSecret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const result = await dispatchGenerationOutbox(20);
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}

export const GET = dispatch;
export const POST = dispatch;
