from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one occurrence, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def replace_all(path: str, replacements: list[tuple[str, str]]) -> None:
    text = read(path)
    for old, new in replacements:
        if old not in text:
            raise RuntimeError(f"{path}: missing replacement source {old!r}")
        text = text.replace(old, new)
    write(path, text)


write(
    ".env.example",
    '''# ---- Local defaults ----
NODE_ENV=development
APP_BASE_URL=http://localhost:3000
AI_ADAPTER_MODE=local
AUTH_ADAPTER_MODE=dev
PAYMENT_ADAPTER_MODE=simulated
DATABASE_ADAPTER_MODE=memory
WORKFLOW_ADAPTER_MODE=local
NEXT_PUBLIC_AUTH_ADAPTER_MODE=dev

# ---- Production adapter selection ----
# NODE_ENV=production
# APP_BASE_URL=https://example.com
# AI_ADAPTER_MODE=ai-sdk
# AUTH_ADAPTER_MODE=better-auth
# PAYMENT_ADAPTER_MODE=waffo
# DATABASE_ADAPTER_MODE=postgres
# WORKFLOW_ADAPTER_MODE=vercel
# NEXT_PUBLIC_AUTH_ADAPTER_MODE=better-auth

# ---- Server-only production credentials ----
# Pooled runtime connection for the deployed application.
DATABASE_URL=
# Direct connection for schema migrations only; must not contain -pooler.
DATABASE_URL_UNPOOLED=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
EMAIL_FROM=

AI_GATEWAY_API_KEY=
AI_MODEL_PREVIEW=
AI_MODEL_DEEP_READING=
AI_MODEL_OUTPUT_REVIEW=

# Waffo API keys are environment-bound. Use test for Preview and prod for Production.
WAFFO_ENVIRONMENT=test
WAFFO_MERCHANT_ID=
# PEM private key. Vercel may store literal \\n sequences; runtime normalizes them.
WAFFO_PRIVATE_KEY=
WAFFO_STORE_ID=
WAFFO_PRODUCT_ID_ONE=
WAFFO_PRODUCT_ID_THREE=
WAFFO_PRODUCT_ID_FIVE=

TURNSTILE_SECRET_KEY=
CRON_SECRET=

# Purpose-separated rotation sets. Format: version:key,version:key
# Keep old read keys loaded during rotation. Keep QUESTION_FINGERPRINT_WRITE_VERSION
# cluster-wide and stable until the full 72-hour duplicate window has elapsed.
SESSION_SIGNING_KEYS=
SESSION_SIGNING_WRITE_VERSION=
QUESTION_FINGERPRINT_KEYS=
QUESTION_FINGERPRINT_WRITE_VERSION=
QUESTION_ENCRYPTION_KEYS=
QUESTION_ENCRYPTION_WRITE_VERSION=
RESULT_INTEGRITY_KEYS=
RESULT_INTEGRITY_WRITE_VERSION=

# External domain approvals. Leave blank until dated evidence is archived.
# The only accepted current values are yarrow-v1 and mei-hua-v1.
YARROW_RULESET_APPROVED_VERSION=
MEI_HUA_RULESET_APPROVED_VERSION=

# ---- Public values ----
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
''',
)

# Production configuration.
replace_once("src/server/config.ts", '  payment: "creem";', '  payment: "waffo";')
replace_once(
    "src/server/config.ts",
    '''    creemApiKey: string;
    creemWebhookSecret: string;
    creemProductIdOne: string;
    creemProductIdThree: string;
    creemProductIdFive: string;''',
    '''    waffoEnvironment: "test" | "prod";
    waffoMerchantId: string;
    waffoPrivateKey: string;
    waffoStoreId: string;
    waffoProductIdOne: string;
    waffoProductIdThree: string;
    waffoProductIdFive: string;''',
)
replace_once(
    "src/server/config.ts",
    '''function secretAtLeast(env: RuntimeEnv, name: string, minimumLength: number): string {
  const value = required(env, name);
  if (value.length < minimumLength) {
    invalid(`${name} must be at least ${minimumLength} characters`, true);
  }
  return value;
}
''',
    '''function secretAtLeast(env: RuntimeEnv, name: string, minimumLength: number): string {
  const value = required(env, name);
  if (value.length < minimumLength) {
    invalid(`${name} must be at least ${minimumLength} characters`, true);
  }
  return value;
}

function waffoPrivateKey(env: RuntimeEnv): string {
  const value = required(env, "WAFFO_PRIVATE_KEY").replaceAll("\\\\n", "\\n").trim();
  if (!/^-----BEGIN (?:RSA )?PRIVATE KEY-----[\\s\\S]+-----END (?:RSA )?PRIVATE KEY-----$/.test(value)) {
    invalid("WAFFO_PRIVATE_KEY must be a PEM encoded private key", true);
  }
  return value;
}
''',
)
replace_once(
    "src/server/config.ts",
    '  const payment = oneOf(env.PAYMENT_ADAPTER_MODE, ["creem"] as const, "PAYMENT_ADAPTER_MODE", undefined, true);',
    '''  const payment = oneOf(env.PAYMENT_ADAPTER_MODE, ["waffo"] as const, "PAYMENT_ADAPTER_MODE", undefined, true);
  const waffoEnvironment = oneOf(
    env.WAFFO_ENVIRONMENT,
    ["test", "prod"] as const,
    "WAFFO_ENVIRONMENT",
    undefined,
    true,
  );
  const waffoPrivateKeyValue = waffoPrivateKey(env);''',
)
replace_once(
    "src/server/config.ts",
    '''      creemApiKey: required(env, "CREEM_API_KEY"),
      creemWebhookSecret: required(env, "CREEM_WEBHOOK_SECRET"),
      creemProductIdOne: required(env, "CREEM_PRODUCT_ID_ONE"),
      creemProductIdThree: required(env, "CREEM_PRODUCT_ID_THREE"),
      creemProductIdFive: required(env, "CREEM_PRODUCT_ID_FIVE"),''',
    '''      waffoEnvironment,
      waffoMerchantId: required(env, "WAFFO_MERCHANT_ID"),
      waffoPrivateKey: waffoPrivateKeyValue,
      waffoStoreId: required(env, "WAFFO_STORE_ID"),
      waffoProductIdOne: required(env, "WAFFO_PRODUCT_ID_ONE"),
      waffoProductIdThree: required(env, "WAFFO_PRODUCT_ID_THREE"),
      waffoProductIdFive: required(env, "WAFFO_PRODUCT_ID_FIVE"),''',
)

# Config tests.
waffo_env_block = '''  PAYMENT_ADAPTER_MODE: "waffo",
  WAFFO_ENVIRONMENT: "test",
  WAFFO_MERCHANT_ID: "MER_test_merchant",
  WAFFO_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\ndGVzdC1wcml2YXRlLWtleS1tYXRlcmlhbA==\\n-----END PRIVATE KEY-----",
  WAFFO_STORE_ID: "STO_test_store",
  WAFFO_PRODUCT_ID_ONE: "PROD_one",
  WAFFO_PRODUCT_ID_THREE: "PROD_three",
  WAFFO_PRODUCT_ID_FIVE: "PROD_five",'''
for path in ["src/server/config.test.ts", "src/server/config-public-auth.test.ts"]:
    replace_once(
        path,
        '''  PAYMENT_ADAPTER_MODE: "creem",
  CREEM_API_KEY: "creem-production-key",
  CREEM_WEBHOOK_SECRET: "creem-webhook-secret",
  CREEM_PRODUCT_ID_ONE: "prod_one",
  CREEM_PRODUCT_ID_THREE: "prod_three",
  CREEM_PRODUCT_ID_FIVE: "prod_five",''',
        waffo_env_block,
    )
replace_all(
    "src/server/config.test.ts",
    [
        ('    "CREEM_PRODUCT_ID_ONE",', '    "WAFFO_ENVIRONMENT",\n    "WAFFO_MERCHANT_ID",\n    "WAFFO_PRIVATE_KEY",\n    "WAFFO_STORE_ID",\n    "WAFFO_PRODUCT_ID_ONE",'),
        ('    "CREEM_PRODUCT_ID_THREE",', '    "WAFFO_PRODUCT_ID_THREE",'),
        ('    "CREEM_PRODUCT_ID_FIVE",', '    "WAFFO_PRODUCT_ID_FIVE",'),
        ('      payment: "creem",', '      payment: "waffo",'),
    ],
)
replace_once(
    "src/server/config.test.ts",
    '''  it("rejects a Better Auth secret shorter than 32 characters", () => {''',
    '''  it("rejects a malformed Waffo private key", () => {
    expect(() => loadRuntimeConfig({
      ...productionCredentials,
      WAFFO_PRIVATE_KEY: "not-a-pem-key",
    })).toThrow("PRODUCTION_CONFIG_INVALID: WAFFO_PRIVATE_KEY must be a PEM encoded private key");
  });

  it("rejects a Better Auth secret shorter than 32 characters", () => {''',
)

write(
    "src/server/payments/waffo-client.ts",
    '''import { WaffoPancake } from "@waffo/pancake-ts";

type CheckoutInput = {
  productId: string;
  requestId: string;
  successUrl: string;
  customerEmail: string;
  metadata: Record<string, string>;
};

type WaffoCheckoutSession = {
  sessionId?: unknown;
  checkoutUrl?: unknown;
  expiresAt?: unknown;
};

type WaffoSdk = {
  checkout: {
    createSession(input: Record<string, unknown>): Promise<WaffoCheckoutSession>;
  };
};

function checkoutUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("WAFFO_CHECKOUT_URL_INVALID");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("WAFFO_CHECKOUT_URL_INVALID");
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "checkout.waffo.ai") {
    throw new Error("WAFFO_CHECKOUT_URL_INVALID");
  }
  return parsed.toString();
}

export class WaffoClient {
  private readonly sdk: WaffoSdk;

  constructor(private readonly dependencies: {
    merchantId: string;
    privateKey: string;
    storeId: string;
    sdk?: WaffoSdk;
  }) {
    this.sdk = dependencies.sdk ?? (new WaffoPancake({
      merchantId: dependencies.merchantId,
      privateKey: dependencies.privateKey,
    }) as unknown as WaffoSdk);
  }

  async createCheckout(input: CheckoutInput): Promise<{
    id: string;
    status: string;
    checkoutUrl: string;
    requestId: string;
  }> {
    let session: WaffoCheckoutSession;
    try {
      session = await this.sdk.checkout.createSession({
        storeId: this.dependencies.storeId,
        productId: input.productId,
        productType: "onetime",
        currency: "USD",
        buyerEmail: input.customerEmail,
        successUrl: input.successUrl,
        orderMerchantExternalId: input.metadata.orderId,
        metadata: input.metadata,
      });
    } catch (error) {
      const code = error instanceof Error ? error.name : "UNKNOWN";
      throw new Error(`WAFFO_CHECKOUT_CREATE_FAILED:${code}`);
    }
    if (typeof session.sessionId !== "string" || typeof session.expiresAt !== "string") {
      throw new Error("WAFFO_CHECKOUT_RESPONSE_INVALID");
    }
    return {
      id: session.sessionId,
      status: "pending",
      checkoutUrl: checkoutUrl(session.checkoutUrl),
      requestId: input.requestId,
    };
  }
}
''',
)

write(
    "src/server/payments/waffo-client.test.ts",
    '''import { describe, expect, it, vi } from "vitest";
import { WaffoClient } from "./waffo-client";

const input = {
  productId: "PROD_one",
  requestId: "req_123",
  successUrl: "https://iching.example.com/checkout/success?orderId=ord_123",
  customerEmail: "reader@example.com",
  metadata: {
    orderId: "ord_123",
    userId: "usr_123",
    productId: "one",
    providerProductId: "PROD_one",
    requestId: "req_123",
  },
};

function client(createSession: ReturnType<typeof vi.fn>) {
  return new WaffoClient({
    merchantId: "MER_test",
    privateKey: "unused-in-injected-test-client",
    storeId: "STO_test",
    sdk: { checkout: { createSession } },
  });
}

describe("WaffoClient", () => {
  it("creates an authenticated one-time checkout with server-owned correlation metadata", async () => {
    const createSession = vi.fn().mockResolvedValue({
      sessionId: "cs_123",
      checkoutUrl: "https://checkout.waffo.ai/reader/checkout/cs_123",
      expiresAt: "2026-08-01T12:00:00.000Z",
    });

    await expect(client(createSession).createCheckout(input)).resolves.toEqual({
      id: "cs_123",
      status: "pending",
      checkoutUrl: "https://checkout.waffo.ai/reader/checkout/cs_123",
      requestId: "req_123",
    });
    expect(createSession).toHaveBeenCalledWith({
      storeId: "STO_test",
      productId: "PROD_one",
      productType: "onetime",
      currency: "USD",
      buyerEmail: "reader@example.com",
      successUrl: input.successUrl,
      orderMerchantExternalId: "ord_123",
      metadata: input.metadata,
    });
  });

  it.each([
    "http://checkout.waffo.ai/reader/checkout/cs_123",
    "https://attacker.example/checkout/cs_123",
  ])("rejects an unsafe checkout URL %s", async (url) => {
    const createSession = vi.fn().mockResolvedValue({
      sessionId: "cs_123",
      checkoutUrl: url,
      expiresAt: "2026-08-01T12:00:00.000Z",
    });
    await expect(client(createSession).createCheckout(input)).rejects.toThrow("WAFFO_CHECKOUT_URL_INVALID");
  });

  it("normalizes provider failures without exposing private request details", async () => {
    const createSession = vi.fn().mockRejectedValue(new TypeError("provider details"));
    await expect(client(createSession).createCheckout(input)).rejects.toThrow(
      "WAFFO_CHECKOUT_CREATE_FAILED:TypeError",
    );
  });
});
''',
)

write(
    "src/server/payments/checkout-service.ts",
    '''import { CURRENCY, getProduct, type ProductId } from "@/domain/entitlements/pricing";
import { DomainError } from "@/server/errors/domain-error";

type UserIdentity = { id: string; email: string };
type OrderRecord = { id: string; requestId: string; amountUsd: number };

type CheckoutResult = {
  id: string;
  status: string;
  checkoutUrl: string;
  requestId: string;
};

export class CheckoutService {
  constructor(private readonly dependencies: {
    orderRepository: {
      createOrder(input: {
        userId: string;
        productId: ProductId;
        amountUsd: number;
        currency: string;
        requestId: string;
      }): OrderRecord | Promise<OrderRecord>;
    };
    paymentClient: {
      createCheckout(input: {
        productId: string;
        requestId: string;
        successUrl: string;
        customerEmail: string;
        metadata: Record<string, string>;
      }): Promise<CheckoutResult>;
    };
    providerProductIds: Record<ProductId, string>;
    appUrl: string;
    requestId(): string;
  }) {}

  async create(input: { user: UserIdentity; productId: string }): Promise<{
    orderId: string;
    checkoutId: string;
    checkoutUrl: string;
    amountUsd: number;
  }> {
    const product = getProduct(input.productId);
    if (!product) throw new DomainError("INVALID_PRODUCT", "Unknown product.", false);
    const providerProductId = this.dependencies.providerProductIds[product.id]?.trim();
    if (!providerProductId) {
      throw new DomainError("WAFFO_PRODUCT_NOT_CONFIGURED", "This product is not available.", false);
    }
    const appUrl = new URL(this.dependencies.appUrl);
    if (appUrl.protocol !== "https:") throw new Error("APP_URL_INVALID");
    const requestId = this.dependencies.requestId();
    const order = await this.dependencies.orderRepository.createOrder({
      userId: input.user.id,
      productId: product.id,
      amountUsd: product.unitPriceUsd,
      currency: CURRENCY,
      requestId,
    });
    const successUrl = new URL("/checkout/success", appUrl);
    successUrl.searchParams.set("orderId", order.id);
    const checkout = await this.dependencies.paymentClient.createCheckout({
      productId: providerProductId,
      requestId,
      successUrl: successUrl.toString(),
      customerEmail: input.user.email,
      metadata: {
        orderId: order.id,
        userId: input.user.id,
        productId: product.id,
        providerProductId,
        requestId,
      },
    });
    if (checkout.requestId !== requestId) throw new Error("PAYMENT_REQUEST_ID_MISMATCH");
    return {
      orderId: order.id,
      checkoutId: checkout.id,
      checkoutUrl: checkout.checkoutUrl,
      amountUsd: product.unitPriceUsd,
    };
  }
}
''',
)

write(
    "src/server/payments/checkout-service.test.ts",
    '''import { describe, expect, it, vi } from "vitest";
import { CheckoutService } from "./checkout-service";

const user = { id: "usr_1", email: "reader@example.com" };

describe("CheckoutService", () => {
  it("uses only server product, price, currency and correlation metadata", async () => {
    const createOrder = vi.fn().mockReturnValue({ id: "ord_1", requestId: "req_1", amountUsd: 2.99 });
    const createCheckout = vi.fn().mockResolvedValue({
      id: "cs_1",
      status: "pending",
      checkoutUrl: "https://checkout.waffo.ai/reader/checkout/cs_1",
      requestId: "req_1",
    });
    const service = new CheckoutService({
      orderRepository: { createOrder },
      paymentClient: { createCheckout },
      providerProductIds: { one: "PROD_one", three: "PROD_three", five: "PROD_five" },
      appUrl: "https://iching.example.com",
      requestId: () => "req_1",
    });

    await expect(service.create({ user, productId: "one" })).resolves.toEqual({
      orderId: "ord_1",
      checkoutId: "cs_1",
      checkoutUrl: "https://checkout.waffo.ai/reader/checkout/cs_1",
      amountUsd: 2.99,
    });
    expect(createOrder).toHaveBeenCalledWith({
      userId: "usr_1",
      productId: "one",
      amountUsd: 2.99,
      currency: "USD",
      requestId: "req_1",
    });
    expect(createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      productId: "PROD_one",
      requestId: "req_1",
      customerEmail: "reader@example.com",
      metadata: {
        orderId: "ord_1",
        userId: "usr_1",
        productId: "one",
        providerProductId: "PROD_one",
        requestId: "req_1",
      },
    }));
  });

  it("rejects unknown and unconfigured products before provider calls", async () => {
    const createCheckout = vi.fn();
    const service = new CheckoutService({
      orderRepository: { createOrder: vi.fn() },
      paymentClient: { createCheckout },
      providerProductIds: { one: "", three: "PROD_three", five: "PROD_five" },
      appUrl: "https://iching.example.com",
      requestId: () => "req_1",
    });
    await expect(service.create({ user, productId: "unknown" })).rejects.toThrow("Unknown product");
    await expect(service.create({ user, productId: "one" })).rejects.toThrow("WAFFO_PRODUCT_NOT_CONFIGURED");
    expect(createCheckout).not.toHaveBeenCalled();
  });
});
''',
)

write(
    "src/server/payments/waffo-webhook.ts",
    '''import type {
  CheckoutCompletedEvent,
  PaymentEvent,
  RefundCreatedEvent,
} from "@/server/repositories/postgres/payment-repository";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function moneyMinor(value: unknown): number {
  const raw = typeof value === "number" ? value.toFixed(2) : stringField(value);
  if (!raw || !/^(?:0|[1-9]\\d*)\\.\\d{2}$/.test(raw)) {
    throw new Error("WAFFO_WEBHOOK_AMOUNT_INVALID");
  }
  const [whole, fraction] = raw.split(".");
  const minor = Number(whole) * 100 + Number(fraction);
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error("WAFFO_WEBHOOK_AMOUNT_INVALID");
  return minor;
}

function occurredAt(value: unknown): Date {
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) throw new Error("WAFFO_WEBHOOK_DATE_INVALID");
  return parsed;
}

export function parseWaffoWebhook(
  payload: unknown,
  expected: { storeId: string; environment: "test" | "prod" },
): PaymentEvent | { eventId: string; eventType: string; payload: unknown; ignored: true } {
  const root = record(payload);
  const data = record(root?.data);
  const metadata = record(data?.orderMetadata);
  const deliveryId = stringField(root?.id);
  const providerEventType = stringField(root?.eventType);
  const businessEventId = stringField(root?.eventId);
  const storeId = stringField(root?.storeId);
  const mode = stringField(root?.mode);
  if (!root || !data || !deliveryId || !providerEventType || !businessEventId || !storeId || !mode) {
    throw new Error("WAFFO_WEBHOOK_SCHEMA_INVALID");
  }
  if (storeId !== expected.storeId || mode !== expected.environment) {
    throw new Error("WAFFO_WEBHOOK_CONTEXT_MISMATCH");
  }

  if (!["order.completed", "refund.succeeded", "refund.failed"].includes(providerEventType)) {
    return { eventId: deliveryId, eventType: providerEventType, payload, ignored: true };
  }

  const providerOrderId = stringField(data.orderId);
  const providerTransactionId = stringField(data.paymentId);
  const requestId = stringField(metadata?.requestId);
  const providerProductId = stringField(metadata?.providerProductId);
  const currency = stringField(data.currency);
  if (!providerOrderId || !providerTransactionId || !currency) {
    throw new Error("WAFFO_WEBHOOK_SCHEMA_INVALID");
  }
  const common = {
    eventId: deliveryId,
    providerOrderId,
    providerTransactionId,
    amountMinor: moneyMinor(data.amount),
    currency: currency.toUpperCase(),
    occurredAt: occurredAt(root.timestamp),
    payload,
  };

  if (providerEventType === "order.completed") {
    if (!requestId || !providerProductId) throw new Error("WAFFO_WEBHOOK_SCHEMA_INVALID");
    const event: CheckoutCompletedEvent = {
      ...common,
      eventType: "checkout.completed",
      checkoutId: providerOrderId,
      requestId,
      providerProductId,
    };
    return event;
  }

  const event: RefundCreatedEvent = {
    ...common,
    eventType: "refund.created",
    refundId: businessEventId,
    status: providerEventType === "refund.succeeded" ? "succeeded" : "failed",
  };
  return event;
}
''',
)

write(
    "src/server/payments/waffo-webhook.test.ts",
    '''import { describe, expect, it } from "vitest";
import { parseWaffoWebhook } from "./waffo-webhook";

const expected = { storeId: "STO_test", environment: "test" as const };

function payload(eventType: string) {
  return {
    id: `delivery_${eventType}`,
    timestamp: "2026-08-01T10:00:00.000Z",
    eventType,
    eventId: eventType.startsWith("refund") ? "REF_123" : "PAY_123",
    storeId: "STO_test",
    mode: "test",
    data: {
      orderId: "ORD_123",
      orderStatus: "completed",
      buyerEmail: "reader@example.com",
      currency: "USD",
      amount: eventType.startsWith("refund") ? "1.00" : "2.99",
      orderMetadata: {
        requestId: "req_123",
        providerProductId: "PROD_one",
      },
      paymentId: "PAY_123",
    },
  };
}

describe("parseWaffoWebhook", () => {
  it("maps a verified order.completed delivery into the internal checkout event", () => {
    expect(parseWaffoWebhook(payload("order.completed"), expected)).toMatchObject({
      eventId: "delivery_order.completed",
      eventType: "checkout.completed",
      checkoutId: "ORD_123",
      providerOrderId: "ORD_123",
      providerTransactionId: "PAY_123",
      requestId: "req_123",
      providerProductId: "PROD_one",
      amountMinor: 299,
      currency: "USD",
    });
  });

  it.each([
    ["refund.succeeded", "succeeded"],
    ["refund.failed", "failed"],
  ])("maps %s without granting or revoking before repository reconciliation", (eventType, status) => {
    expect(parseWaffoWebhook(payload(eventType), expected)).toMatchObject({
      eventType: "refund.created",
      refundId: "REF_123",
      status,
      amountMinor: 100,
    });
  });

  it("rejects a delivery from the wrong store or environment", () => {
    expect(() => parseWaffoWebhook({ ...payload("order.completed"), storeId: "STO_other" }, expected))
      .toThrow("WAFFO_WEBHOOK_CONTEXT_MISMATCH");
    expect(() => parseWaffoWebhook({ ...payload("order.completed"), mode: "prod" }, expected))
      .toThrow("WAFFO_WEBHOOK_CONTEXT_MISMATCH");
  });

  it("rejects ambiguous monetary formats", () => {
    const event = payload("order.completed");
    event.data.amount = "2.999";
    expect(() => parseWaffoWebhook(event, expected)).toThrow("WAFFO_WEBHOOK_AMOUNT_INVALID");
  });

  it("acknowledges unsupported signed events without processing them", () => {
    expect(parseWaffoWebhook(payload("subscription.activated"), expected)).toMatchObject({
      ignored: true,
      eventType: "subscription.activated",
    });
  });
});
''',
)

write(
    "src/app/api/webhooks/waffo/route.ts",
    '''import postgres, { type Sql } from "postgres";
import { verifyWebhook } from "@waffo/pancake-ts";
import { PRODUCTS } from "@/domain/entitlements/pricing";
import { runtimeConfig } from "@/server/config";
import { DomainError } from "@/server/errors/domain-error";
import { parseWaffoWebhook } from "@/server/payments/waffo-webhook";
import { PostgresPaymentRepository } from "@/server/repositories/postgres/payment-repository";

export const runtime = "nodejs";

type PaymentGlobal = typeof globalThis & { __ICHING_PAYMENT_SQL__?: Sql };

function productionConfig() {
  const config = runtimeConfig();
  if (config.mode !== "production" || config.payment !== "waffo") throw new Error("WAFFO_NOT_ENABLED");
  return config;
}

function paymentRepository(): PostgresPaymentRepository {
  const config = productionConfig();
  const globalRef = globalThis as PaymentGlobal;
  globalRef.__ICHING_PAYMENT_SQL__ ??= postgres(config.credentials.databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: true,
  });
  return new PostgresPaymentRepository(globalRef.__ICHING_PAYMENT_SQL__, {
    products: {
      [config.credentials.waffoProductIdOne]: {
        internalProductId: "one",
        quantity: PRODUCTS.one.quantity,
        amountUsd: PRODUCTS.one.unitPriceUsd,
      },
      [config.credentials.waffoProductIdThree]: {
        internalProductId: "three",
        quantity: PRODUCTS.three.quantity,
        amountUsd: PRODUCTS.three.unitPriceUsd,
      },
      [config.credentials.waffoProductIdFive]: {
        internalProductId: "five",
        quantity: PRODUCTS.five.quantity,
        amountUsd: PRODUCTS.five.unitPriceUsd,
      },
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-waffo-signature");
  if (!signature) return Response.json({ error: "invalid_signature" }, { status: 401 });
  const config = productionConfig();
  let verified: unknown;
  try {
    verified = verifyWebhook(rawBody, signature, {
      environment: config.credentials.waffoEnvironment,
    });
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  try {
    const event = parseWaffoWebhook(verified, {
      storeId: config.credentials.waffoStoreId,
      environment: config.credentials.waffoEnvironment,
    });
    if ("ignored" in event) return Response.json({ received: true, ignored: true });
    const outcome = await paymentRepository().processEvent(event);
    return Response.json({
      received: true,
      duplicate: outcome.duplicate,
      financialReviewRequired: outcome.financialReviewRequired ?? false,
    });
  } catch (error) {
    const code = error instanceof DomainError
      ? error.code
      : error instanceof Error
        ? error.message.split(":", 1)[0]
        : "WAFFO_WEBHOOK_FAILED";
    console.error("Waffo webhook processing failed", { code });
    const retryable = error instanceof DomainError && error.retryable;
    return Response.json({ error: "webhook_processing_failed" }, { status: retryable ? 503 : 400 });
  }
}
''',
)

# Production checkout composition.
replace_once(
    "src/app/production-actions.ts",
    'import { CreemClient } from "@/server/payments/creem-client";',
    'import { WaffoClient } from "@/server/payments/waffo-client";',
)
replace_once(
    "src/app/production-actions.ts",
    '''      creemClient: new CreemClient({
        apiKey: config.credentials.creemApiKey,
        mode: config.credentials.creemApiKey.startsWith("creem_test_") ? "test" : "production",
      }),
      providerProductIds: {
        one: config.credentials.creemProductIdOne,
        three: config.credentials.creemProductIdThree,
        five: config.credentials.creemProductIdFive,
      },''',
    '''      paymentClient: new WaffoClient({
        merchantId: config.credentials.waffoMerchantId,
        privateKey: config.credentials.waffoPrivateKey,
        storeId: config.credentials.waffoStoreId,
      }),
      providerProductIds: {
        one: config.credentials.waffoProductIdOne,
        three: config.credentials.waffoProductIdThree,
        five: config.credentials.waffoProductIdFive,
      },''',
)

# Provider-neutral repository labels and failed-refund behavior.
text = read("src/server/repositories/postgres/payment-repository.ts")
text = text.replace("CreemPaymentEvent", "PaymentEvent")
text = text.replace("CREEM_ORDER_MISMATCH", "WAFFO_ORDER_MISMATCH")
text = text.replace("CREEM_ORDER_NOT_READY", "WAFFO_ORDER_NOT_READY")
text = text.replace("'creem'", "'waffo'")
old_failed = '''      if (event.eventType === "refund.created" && event.status.toLowerCase() !== "succeeded") {
        await tx`
          update webhook_inbox set order_id = ${order.id}, processed_at = ${event.occurredAt}
          where provider = 'waffo' and event_id = ${event.eventId}
        `;
        return {
          processed: true,
          duplicate: false,
          orderId: order.id,
          financialReviewRequired: Boolean(order.financial_review_required),
        };
      }'''
new_failed = '''      if (event.eventType === "refund.created" && event.status.toLowerCase() !== "succeeded") {
        await tx`
          update orders set
            financial_review_required = true,
            last_provider_event_at = ${event.occurredAt},
            updated_at = ${event.occurredAt}
          where id = ${order.id}
        `;
        await tx`
          update webhook_inbox set order_id = ${order.id}, processed_at = ${event.occurredAt}
          where provider = 'waffo' and event_id = ${event.eventId}
        `;
        return {
          processed: true,
          duplicate: false,
          orderId: order.id,
          financialReviewRequired: true,
        };
      }'''
if text.count(old_failed) != 1:
    raise RuntimeError("payment repository failed-refund branch not found")
text = text.replace(old_failed, new_failed, 1)
write("src/server/repositories/postgres/payment-repository.ts", text)

# Existing integration contracts remain, with Waffo provider identity and error names.
for path in [
    "src/server/repositories/postgres/auth-payments.integration.test.ts",
    "src/server/repositories/postgres/payment-lifecycle.integration.test.ts",
    "src/server/repositories/postgres/payment-privacy.integration.test.ts",
    "src/server/runtime/postgres-account-privacy.integration.test.ts",
    "src/app/actions.ts",
]:
    text = read(path)
    text = text.replace("Creem", "Waffo").replace("CREEM", "WAFFO").replace("creem", "waffo")
    write(path, text)

replace_once(
    "src/server/repositories/postgres/payment-lifecycle.integration.test.ts",
    '''  it("marks a dispute for financial review when consumed credits cannot be revoked", async () => {''',
    '''  it("marks a failed refund for financial review without revoking credits", async () => {
    await repository.processEvent(checkoutEvent());
    const outcome = await repository.processEvent({
      eventId: "evt_refund_failed",
      eventType: "refund.created",
      refundId: "ref_failed",
      status: "failed",
      providerOrderId: "provider_order_lifecycle",
      providerTransactionId: "tran_lifecycle",
      amountMinor: 999,
      currency: "USD",
      occurredAt: new Date("2026-07-31T05:30:00.000Z"),
      payload: { id: "evt_refund_failed" },
    });
    expect(outcome.financialReviewRequired).toBe(true);
    expect((await sql`
      select status, financial_review_required from orders where id = 'ord_payment_lifecycle'
    `)[0]).toMatchObject({ status: "paid", financial_review_required: true });
    expect((await sql`
      select quantity_available, quantity_revoked from entitlement_batches
      where order_id = 'ord_payment_lifecycle'
    `)[0]).toMatchObject({ quantity_available: 5, quantity_revoked: 0 });
  });

  it("marks a dispute for financial review when consumed credits cannot be revoked", async () => {''',
)

# Source contract proving raw-body SDK verification.
replace_once(
    "src/app/production-action-boundaries.test.ts",
    '''  it("hashes direct production and privacy rate-limit identities before database persistence", async () => {''',
    '''  it("uses the official Waffo raw-body webhook verification boundary", async () => {
    const route = await source("src/app/api/webhooks/waffo/route.ts");
    expect(route).toContain("await request.text()");
    expect(route).toContain("x-waffo-signature");
    expect(route).toContain("verifyWebhook(rawBody, signature");
    expect(route).not.toContain("request.json()");
  });

  it("hashes direct production and privacy rate-limit identities before database persistence", async () => {''',
)

# Remove the legacy provider implementation and route.
for path in [
    "src/app/api/webhooks/creem/route.ts",
    "src/server/payments/creem-client.ts",
    "src/server/payments/creem-client.test.ts",
    "src/server/payments/creem-signature.ts",
    "src/server/payments/creem-signature.test.ts",
    "src/server/payments/creem-webhook.ts",
    "src/server/payments/creem-webhook.test.ts",
]:
    target = ROOT / path
    if target.exists():
        target.unlink()

# Inventory is superseded by the executable zero-reference gate.
(ROOT / "docs/creem-inventory.txt").unlink(missing_ok=True)

print("Waffo payment migration patch applied.")
