import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createOrderStatusReader } from "./order-status";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql);

async function seedUser(label: string): Promise<string> {
  const suffix = randomUUID();
  const userId = `order-status-${label}-${suffix}`;
  await sql`
    insert into users (id, name, email, email_verified)
    values (${userId}, ${`Order ${label}`}, ${`${label}-${suffix}@example.com`}, true)
  `;
  return userId;
}

async function seedOrder(
  userId: string,
  options: { status?: string; productKey?: "one" | "three" | "five" } = {},
): Promise<string> {
  const orderId = randomUUID();
  const status = options.status ?? "paid";
  const productKey = options.productKey ?? "three";
  const money = { one: [1, 299], three: [3, 699], five: [5, 999] }[productKey]!;
  const settled = status === "paid" || status === "refunded";
  await sql`
    insert into payment_orders (
      id, user_id, product_key, quantity, amount_minor, currency, request_id,
      provider, provider_environment, provider_product_id, provider_order_id,
      provider_payment_id, status, paid_at
    ) values (
      ${orderId}, ${userId}, ${productKey}, ${money[0]}, ${money[1]}, 'USD', ${`req-${orderId}`},
      'waffo', 'test', ${`prod-${productKey}`},
      ${settled ? `ord-${orderId}` : null}, ${settled ? `pay-${orderId}` : null},
      ${status}, ${settled ? new Date().toISOString() : null}
    )
  `;
  return orderId;
}

describe("CP6 order status ownership", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("returns the order to the reader who owns it", async () => {
    const userId = await seedUser("owner");
    const orderId = await seedOrder(userId, { productKey: "five" });

    await expect(createOrderStatusReader({ sql }).readOrderForUser(userId, orderId)).resolves.toEqual({
      status: "paid",
      productKey: "five",
      quantity: 5,
    });
  });

  it("does not return another reader's order", async () => {
    const [owner, stranger] = await Promise.all([seedUser("owner-b"), seedUser("stranger")]);
    const orderId = await seedOrder(owner);

    // The stranger holds a real, existing order id — only ownership stops them.
    await expect(createOrderStatusReader({ sql }).readOrderForUser(stranger, orderId)).resolves.toBeNull();
  });

  it("answers a stranger exactly as it answers a missing order", async () => {
    const [owner, stranger] = await Promise.all([seedUser("owner-c"), seedUser("stranger-c")]);
    const orderId = await seedOrder(owner);
    const reader = createOrderStatusReader({ sql });

    const notOwned = await reader.readOrderForUser(stranger, orderId);
    const notExisting = await reader.readOrderForUser(stranger, randomUUID());

    expect(notOwned).toEqual(notExisting);
    expect(notOwned).toBeNull();
  });

  it("reports an unpaid order without inventing a payment", async () => {
    const userId = await seedUser("pending");
    const orderId = await seedOrder(userId, { status: "pending", productKey: "one" });

    await expect(createOrderStatusReader({ sql }).readOrderForUser(userId, orderId)).resolves.toEqual({
      status: "pending",
      productKey: "one",
      quantity: 1,
    });
  });

  it("exposes only status, product key and quantity", async () => {
    const userId = await seedUser("shape");
    const orderId = await seedOrder(userId);

    const view = await createOrderStatusReader({ sql }).readOrderForUser(userId, orderId);

    expect(Object.keys(view ?? {}).sort()).toEqual(["productKey", "quantity", "status"]);
  });
});
