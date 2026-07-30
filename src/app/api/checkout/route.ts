import * as z from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { runtimeConfig } from "@/server/config";
import { repo } from "@/server/repository";
import { createPostgresPersistence } from "@/server/repositories/postgres";
import { CheckoutService } from "@/server/payments/checkout-service";
import { CreemPaymentProvider } from "@/server/payments/creem-provider";
import { TurnstileVerifier } from "@/server/abuse/turnstile";
import { CURRENCY, PRODUCTS } from "@/domain/entitlements/pricing";
import { randomToken } from "@/lib/crypto";

const checkoutSchema = z.object({
  productId: z.enum(["one", "three", "five"]),
  turnstileToken: z.string().max(2048).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid checkout request." }, { status: 400 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const config = runtimeConfig();

  if (config.payment === "simulated") {
    const product = PRODUCTS[parsed.data.productId];
    const order = repo.createOrder({
      userId: user.id,
      productId: product.id,
      amountUsd: product.unitPriceUsd,
      currency: CURRENCY,
      requestId: randomToken(16),
    });
    return Response.json({
      orderId: order.id,
      checkoutUrl: `/checkout/simulate?orderId=${order.id}`,
      amountUsd: product.unitPriceUsd,
    });
  }

  const hostname = new URL(config.credentials.publicAppUrl).hostname;
  const remoteIp = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  await new TurnstileVerifier({ secret: config.credentials.turnstileSecretKey }).verify({
    token: parsed.data.turnstileToken ?? "",
    action: "checkout",
    hostname,
    remoteIp,
    idempotencyKey: crypto.randomUUID(),
  });

  const persistence = createPostgresPersistence(config.credentials.databaseUrl);
  try {
    const provider = new CreemPaymentProvider({
      apiKey: config.credentials.creemApiKey,
      webhookSecret: config.credentials.creemWebhookSecret,
      baseUrl: "https://api.creem.io",
    });
    const service = new CheckoutService({
      sql: persistence.sql,
      provider,
      productIds: {
        one: config.credentials.creemProductIdOne,
        three: config.credentials.creemProductIdThree,
        five: config.credentials.creemProductIdFive,
      },
      appUrl: config.credentials.publicAppUrl,
    });
    return Response.json(await service.create({
      userId: user.id,
      email: user.email,
      productId: parsed.data.productId,
    }));
  } finally {
    await persistence.close();
  }
}
