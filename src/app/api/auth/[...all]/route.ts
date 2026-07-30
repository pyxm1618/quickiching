import { toNextJsHandler } from "better-auth/next-js";
import { runtimeConfig } from "@/server/config";
import { getProductionAuth } from "@/server/auth/better-auth";

async function unavailable(): Promise<Response> {
  return Response.json({ error: "Production authentication is not enabled." }, { status: 404 });
}

export async function GET(request: Request): Promise<Response> {
  const config = runtimeConfig();
  if (config.auth !== "better-auth") return unavailable();
  return toNextJsHandler(getProductionAuth(config)).GET(request);
}

export async function POST(request: Request): Promise<Response> {
  const config = runtimeConfig();
  if (config.auth !== "better-auth") return unavailable();
  return toNextJsHandler(getProductionAuth(config)).POST(request);
}
