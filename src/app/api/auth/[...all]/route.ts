import { getProductionAuth } from "@/lib/auth/production-auth";

export const runtime = "nodejs";

async function route(request: Request, method: "GET" | "POST"): Promise<Response> {
  if (process.env.AUTH_ADAPTER_MODE !== "better-auth") {
    return Response.json({ error: "auth_adapter_disabled" }, { status: 404 });
  }
  const [{ toNextJsHandler }, auth] = await Promise.all([
    import("better-auth/next-js"),
    getProductionAuth(),
  ]);
  const handler = toNextJsHandler(auth)[method];
  return handler(request);
}

export const GET = (request: Request) => route(request, "GET");
export const POST = (request: Request) => route(request, "POST");
