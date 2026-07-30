export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json({
    status: "ok",
    service: "ichingcoin",
    timestamp: new Date().toISOString(),
  }, { headers: { "cache-control": "no-store" } });
}
