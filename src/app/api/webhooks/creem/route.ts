import { runtimeConfig } from "@/server/config";
import { createPostgresPersistence } from "@/server/repositories/postgres";
import { PostgresPaymentRepository } from "@/server/repositories/postgres/payment-repository";
import { CreemPaymentProvider } from "@/server/payments/creem-provider";
import { PaymentEventService } from "@/server/payments/payment-event-service";

export async function POST(request: Request): Promise<Response> {
  const config = runtimeConfig();
  if (config.payment !== "creem") {
    return Response.json({ error: "Payment webhooks are not enabled." }, { status: 404 });
  }
  const signature = request.headers.get("creem-signature");
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });
  const rawBody = await request.text();
  const provider = new CreemPaymentProvider({
    apiKey: config.credentials.creemApiKey,
    webhookSecret: config.credentials.creemWebhookSecret,
    baseUrl: "https://api.creem.io",
  });
  let event;
  try {
    event = provider.verifyAndParseWebhook(rawBody, signature);
  } catch {
    return Response.json({ error: "Invalid webhook signature or payload." }, { status: 400 });
  }

  const persistence = createPostgresPersistence(config.credentials.databaseUrl);
  try {
    const service = new PaymentEventService(new PostgresPaymentRepository(persistence.sql));
    const outcome = await service.process(event);
    return Response.json({ received: true, processed: outcome.processed });
  } finally {
    await persistence.close();
  }
}
