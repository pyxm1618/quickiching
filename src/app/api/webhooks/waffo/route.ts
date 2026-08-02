import { verifyWebhook } from "@waffo/pancake-ts";
import { runtimeConfig } from "@/server/config";
import { parseWaffoWebhook } from "@/server/payments/waffo-webhook";
import { getPaymentRepository } from "@/server/jobs/payment-dispatcher";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-waffo-signature");
  const config = runtimeConfig();
  if (config.mode !== "production" || config.payment !== "waffo") return new Response("Not found", { status: 404 });
  let verified: unknown;
  try {
    verified = verifyWebhook(rawBody, signature, { environment: config.credentials.waffoEnvironment });
  } catch { return new Response("Invalid signature", { status: 401 }); }
  try {
    const event = parseWaffoWebhook(verified);
    if (event.mode !== config.credentials.waffoEnvironment || event.storeId !== config.credentials.waffoStoreId) return new Response("Rejected", { status: 400 });
    await getPaymentRepository().recordVerifiedDelivery(event, JSON.parse(rawBody));
    return Response.json({ received: true, ignored: !["order.completed", "refund.succeeded", "refund.failed"].includes(event.eventType) });
  } catch (error) {
    console.error("Waffo webhook inbox write failed", { code: error instanceof Error ? error.message : "WAFFO_WEBHOOK_FAILED" });
    return new Response("Retry", { status: 503 });
  }
}
