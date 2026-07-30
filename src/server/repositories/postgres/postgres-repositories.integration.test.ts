import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPostgresDatabase, type PostgresDatabase } from "@/server/db/client";
import { createPostgresRepositories } from "./index";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;

if (!testDatabaseUrl) {
  describe("PostgreSQL integration credential gate", () => {
    it("reports one explicit TEST_DATABASE_URL blocker", () => {
      expect(testDatabaseUrl).toBeUndefined();
      console.info("POSTGRES_INTEGRATION_BLOCKED: TEST_DATABASE_URL is not supplied");
    });
  });
}

describeDatabase("PostgreSQL transactional repositories", () => {
  let database: PostgresDatabase;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const created = createPostgresDatabase(testDatabaseUrl!);
    database = created.db;
    close = created.close;
  });

  afterAll(async () => {
    await close();
  });

  it("creates one Login Intent and consumes it once in the reveal transaction", async () => {
    const repositories = createPostgresRepositories(database);
    const now = new Date("2026-07-30T00:00:00.000Z");
    const userId = `usr_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
    const castingId = `cas_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
    await repositories.testSupport.createRevealFixture({
      userId,
      castingId,
      anonymousSessionHash: `anon_${crypto.randomUUID()}`,
      now,
    });
    const intent = await repositories.loginIntents.create({
      castingId,
      anonymousSessionHash: `anon_${castingId}`,
      nonceHash: `nonce_${castingId}`,
      nonceKeyVersion: "v1",
      allowedCallbackPath: `/result/${castingId}`,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      now,
    });

    await expect(repositories.reveal.consumeIntentAndReveal({
      intentId: intent.id,
      nonceHash: intent.nonceHash,
      nonceKeyVersion: intent.nonceKeyVersion,
      authenticatedUserId: userId,
      callbackPath: intent.allowedCallbackPath,
      fingerprintCandidates: [{ keyVersion: "v1", fingerprint: `fp_${castingId}` }],
      writeFingerprint: { keyVersion: "v1", fingerprint: `fp_${castingId}` },
      now,
    })).resolves.toMatchObject({ revealed: true, duplicate: false, castingId });

    await expect(repositories.reveal.consumeIntentAndReveal({
      intentId: intent.id,
      nonceHash: intent.nonceHash,
      nonceKeyVersion: intent.nonceKeyVersion,
      authenticatedUserId: userId,
      callbackPath: intent.allowedCallbackPath,
      fingerprintCandidates: [{ keyVersion: "v1", fingerprint: `fp_${castingId}` }],
      writeFingerprint: { keyVersion: "v1", fingerprint: `fp_${castingId}` },
      now,
    })).rejects.toThrow("LOGIN_INTENT_CONSUMED");
  });

  it("serializes two concurrent reservations so one credit cannot be frozen twice", async () => {
    const repositories = createPostgresRepositories(database);
    const fixture = await repositories.testSupport.createEntitlementFixture({
      quantity: 1,
      now: new Date("2026-07-30T00:00:00.000Z"),
    });

    const attempts = await Promise.allSettled([
      repositories.entitlements.reserveForReading(fixture.readingId, fixture.userId, fixture.now),
      repositories.entitlements.reserveForReading(fixture.readingId, fixture.userId, fixture.now),
    ]);
    const fulfilled = attempts.filter((attempt) => attempt.status === "fulfilled");
    expect(fulfilled).toHaveLength(2);
    expect(new Set(fulfilled.map((attempt) => JSON.stringify((attempt as PromiseFulfilledResult<unknown>).value))).size)
      .toBe(1);
  });
});
