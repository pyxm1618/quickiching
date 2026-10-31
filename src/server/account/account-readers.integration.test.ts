import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadHistory } from "@/server/loaders";
import { loadSignInMethods } from "./sign-in-method-loader";
import { encryptQuestionForStorage } from "@/server/generation/question-crypto";
import { closeAuthDatabaseConnection } from "@/server/db/client";
const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL required: isolated PostgreSQL only");
const sql = postgres(databaseURL, { max: 4, prepare: false });
const owner = { id: randomUUID(), email: `${randomUUID()}@example.com` };
const other = { id: randomUUID(), email: `${randomUUID()}@example.com` };
const castingIds: string[] = [];
let latestId: string;
describe("Account read-only data integration", () => {
  beforeAll(async () => {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
    vi.stubEnv("DATABASE_ADAPTER_MODE", "postgres"); vi.stubEnv("DATABASE_URL", databaseURL);
    vi.stubEnv("QUESTION_ENCRYPTION_KEYS", "v2:account-fixture-key-two,v1:account-fixture-key-one");
    await sql`insert into users (id, email, name, email_verified) values (${owner.id}, ${owner.email}, 'Reader owner', true), (${other.id}, ${other.email}, 'Other owner', true)`;
    await sql`insert into accounts (id, issuer, account_id, provider_id, user_id) values (${randomUUID()}, 'https://accounts.google.com', ${owner.id}, 'google', ${owner.id})`;
    for (let index = 0; index < 59; index++) {
      const id = randomUUID(); castingIds.push(id);
      const lifecycle = index === 55 ? "draft" : index === 56 ? "casting" : "revealed";
      const userId = index === 57 ? other.id : owner.id;
      await sql`insert into casting_sessions (id, user_id, method, lifecycle, risk_status, scene, interpretation_goal) values (${id}, ${userId}, 'three_coin', ${lifecycle}, 'allowed', 'career', 'guidance')`;
      if (index !== 58) await sql`insert into cast_results (casting_id, line_values, primary_hexagram_number, moving_line_positions, method_calculation, algorithm_version, classic_mapping_version, result_hmac, result_hmac_key_version) values (${id}, ${[7,7,7,7,7,7]}, 1, '{}', '{}', 'three-coin-v1', 'king-wen-v1', 'fixture-hmac', 'v1')`;
      if (index === 0) {
        latestId = id;
        for (const version of [1, 2]) {
          const qid = randomUUID();
          const encrypted = encryptQuestionForStorage({ castingId: id, questionVersionId: qid, question: version === 1 ? "Old question" : "Latest private question" }, { QUESTION_ENCRYPTION_KEYS: version === 1 ? "v1:account-fixture-key-one" : "v2:account-fixture-key-two" });
          await sql`insert into question_versions (id, casting_id, version_number, ciphertext, iv, auth_tag, encryption_key_version, fingerprint_key_version, fingerprint, created_reason) values (${qid}, ${id}, ${version}, ${encrypted.ciphertext}, ${encrypted.iv}, ${encrypted.authTag}, ${encrypted.encryptionKeyVersion}, 'v1', 'fixture', 'initial')`;
        }
      }
    }
  });
  afterAll(async () => { vi.unstubAllEnvs(); await closeAuthDatabaseConnection(); await sql.end({ timeout: 5 }); });
  it("returns all 55 valid owner readings with latest decrypted question, excluding drafts, incomplete results and the other user", async () => {
    const history = await loadHistory(owner);
    expect(history).toHaveLength(55);
    expect(history.find(row => row.id === latestId)?.question).toBe("Latest private question");
    expect(history.find(row => row.id === castingIds[1])?.question).toBeNull();
    for (const excluded of castingIds.slice(55)) expect(history.some(row => row.id === excluded)).toBe(false);
    expect(await loadHistory(null)).toEqual([]);
  });
  it("reads Google and actual no-account-row Magic Link representation without writing", async () => {
    expect(await loadSignInMethods(owner)).toEqual(["Google"]);
    expect(await loadSignInMethods(other)).toEqual(["Email (Magic Link)"]);
    await sql`insert into accounts (id, issuer, account_id, provider_id, user_id) values (${randomUUID()}, 'fixture-email', ${owner.id}, 'email', ${owner.id})`;
    expect(await loadSignInMethods(owner)).toEqual(["Email (Magic Link)", "Google"]);
  });
});
