import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { evaluateRisk, RISK_RULE_VERSION } from "@/domain/risk/engine";
import type { LineValue } from "@/domain/casting/types";
import { decryptQuestionForGeneration } from "@/server/generation/question-crypto";
import { createResultIntegrityVerifier } from "@/server/generation/integrity";
import { createPostgresCastingRepository } from "./postgres-repository";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql);

const QUESTION = "Should I take the role I was offered in another city next spring?";
const KUN: LineValue[] = [8, 8, 8, 8, 8, 8];
const RETURN: LineValue[] = [9, 8, 8, 8, 8, 8];

type Row = Record<string, any>;

async function seedUser(label: string): Promise<string> {
  const suffix = randomUUID();
  const userId = `claim-${label}-${suffix}`;
  await sql`
    insert into users (id, name, email, email_verified)
    values (${userId}, ${`Claim ${label}`}, ${`${label}-${suffix}@example.com`}, true)
  `;
  return userId;
}

function repository() {
  return createPostgresCastingRepository({ sql, env: process.env });
}

function facts(lineValues: LineValue[] = KUN) {
  return buildHexagramResult({ lineValuesBottomUp: lineValues, method: "three_coin" });
}

function claim(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    userId,
    method: "three_coin" as const,
    scene: "career" as const,
    interpretationGoal: "what_do_i_need_to_see_clearly" as const,
    question: QUESTION,
    facts: facts(),
    risk: evaluateRisk(QUESTION, "career"),
    ...overrides,
  };
}

describe("CP6 attested cast persistence", () => {
  beforeAll(async () => {
    vi.stubEnv("APP_SECRET", "cp6-claim-integration-secret");
    vi.stubEnv("QUESTION_ENCRYPTION_KEYS", "v1:cp6-claim-question-encryption-key");
    vi.stubEnv("QUESTION_FINGERPRINT_KEYS", "v1:cp6-claim-question-fingerprint-key");
    vi.stubEnv("RESULT_INTEGRITY_KEYS", "v1:cp6-claim-result-integrity-key");
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await sql.end({ timeout: 5 });
  });

  it("writes session, question and result in one transaction", async () => {
    const userId = await seedUser("persist");

    const { castingId, reused } = await repository().persistAttestedCast(claim(userId));

    expect(reused).toBe(false);

    const sessions = await sql`
      select user_id, method, lifecycle, cast_origin, risk_status, risk_rule_version,
             scene, interpretation_goal, question_fingerprint, fingerprint_key_version
      from casting_sessions where id = ${castingId}
    ` as Row[];
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      user_id: userId,
      method: "three_coin",
      lifecycle: "revealed",
      cast_origin: "client_attested",
      risk_status: "allowed",
      risk_rule_version: RISK_RULE_VERSION,
      scene: "career",
      interpretation_goal: "what_do_i_need_to_see_clearly",
      fingerprint_key_version: "v1",
    });
    expect(sessions[0]!.question_fingerprint).toBeTruthy();

    const questions = await sql`
      select id, version_number, ciphertext, iv, auth_tag, encryption_key_version,
             fingerprint, fingerprint_key_version, created_reason
      from question_versions where casting_id = ${castingId}
    ` as Row[];
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      version_number: 1,
      encryption_key_version: "v1",
      fingerprint_key_version: "v1",
      created_reason: "initial",
    });
    expect(String(questions[0]!.ciphertext)).not.toContain("role");

    const results = await sql`
      select line_values, primary_hexagram_number, moving_line_positions,
             relating_hexagram_number, method_calculation, algorithm_version,
             classic_mapping_version, result_hmac, result_hmac_key_version
      from cast_results where casting_id = ${castingId}
    ` as Row[];
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      primary_hexagram_number: 2,
      relating_hexagram_number: null,
      algorithm_version: "three-coin-v1",
      classic_mapping_version: "king-wen-v1",
      result_hmac_key_version: "v1",
    });
    expect(results[0]!.line_values.map(Number)).toEqual(KUN);
    expect(results[0]!.moving_line_positions.map(Number)).toEqual([]);
  });

  it("records the cast as client attested rather than server generated", async () => {
    const userId = await seedUser("origin");

    const { castingId } = await repository().persistAttestedCast(claim(userId));

    const rows = await sql`select cast_origin from casting_sessions where id = ${castingId}` as Row[];
    expect(rows[0]!.cast_origin).toBe("client_attested");

    const calculation = (await sql`
      select method_calculation from cast_results where casting_id = ${castingId}
    ` as Row[])[0]!.method_calculation;
    expect(calculation).toMatchObject({ kind: "client_attested" });
  });

  it("stores a question the generation path can decrypt back", async () => {
    const userId = await seedUser("decrypt");

    const { castingId } = await repository().persistAttestedCast(claim(userId));

    const rows = await sql`
      select c.id, q.id as question_version_id, q.ciphertext as question_ciphertext,
             q.iv as question_iv, q.auth_tag as question_auth_tag,
             q.encryption_key_version as question_encryption_key_version, c.scene
      from casting_sessions c
      join question_versions q on q.casting_id = c.id
      where c.id = ${castingId}
    ` as Row[];

    expect(decryptQuestionForGeneration(rows[0]!, process.env)).toBe(QUESTION);
  });

  it("writes a result HMAC the generation verifier accepts", async () => {
    const userId = await seedUser("hmac");
    const computed = facts();

    const { castingId } = await repository().persistAttestedCast(claim(userId, { facts: computed }));

    const rows = await sql`
      select result_hmac, result_hmac_key_version from cast_results where casting_id = ${castingId}
    ` as Row[];
    const verify = createResultIntegrityVerifier(process.env);

    expect(verify({
      facts: {
        method: computed.method,
        algorithmVersion: computed.algorithmVersion,
        classicMappingVersion: computed.classicMappingVersion,
        lineValuesBottomUp: [...computed.lineValuesBottomUp],
        primaryHexagramNumber: computed.primaryHexagramNumber,
        movingLinePositions: [...computed.movingLinePositions],
        relatingHexagramNumber: computed.relatingHexagramNumber,
        readingVariant: "still_hexagram",
      },
      resultHmac: String(rows[0]!.result_hmac),
      resultHmacKeyVersion: String(rows[0]!.result_hmac_key_version),
    } as Parameters<ReturnType<typeof createResultIntegrityVerifier>>[0])).toBe(true);
  });

  it("returns the same casting for an identical resubmission", async () => {
    const userId = await seedUser("idempotent");

    const first = await repository().persistAttestedCast(claim(userId));
    const second = await repository().persistAttestedCast(claim(userId));

    expect(second.castingId).toBe(first.castingId);
    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);

    const rows = await sql`
      select count(*)::integer as total from casting_sessions where user_id = ${userId}
    ` as Row[];
    expect(rows[0]!.total).toBe(1);
  });

  it("does not collapse concurrent identical submissions into duplicate rows", async () => {
    const userId = await seedUser("concurrent");

    const results = await Promise.all([
      repository().persistAttestedCast(claim(userId)),
      repository().persistAttestedCast(claim(userId)),
      repository().persistAttestedCast(claim(userId)),
    ]);

    expect(new Set(results.map((result) => result.castingId)).size).toBe(1);
    const rows = await sql`
      select count(*)::integer as total from casting_sessions where user_id = ${userId}
    ` as Row[];
    expect(rows[0]!.total).toBe(1);
  });

  it("treats a different hexagram from the same question as a new cast", async () => {
    const userId = await seedUser("different-cast");

    const first = await repository().persistAttestedCast(claim(userId));
    const second = await repository().persistAttestedCast(claim(userId, { facts: facts(RETURN) }));

    expect(second.castingId).not.toBe(first.castingId);
    expect(second.reused).toBe(false);

    const rows = await sql`
      select primary_hexagram_number, relating_hexagram_number
      from cast_results where casting_id = ${second.castingId}
    ` as Row[];
    expect(rows[0]).toMatchObject({ primary_hexagram_number: 24, relating_hexagram_number: 2 });
  });

  it("treats a different question with the same hexagram as a new cast", async () => {
    const userId = await seedUser("different-question");
    const otherQuestion = "Should I stay where I am for another year and revisit this later?";

    const first = await repository().persistAttestedCast(claim(userId));
    const second = await repository().persistAttestedCast(claim(userId, {
      question: otherQuestion,
      risk: evaluateRisk(otherQuestion, "career"),
    }));

    expect(second.castingId).not.toBe(first.castingId);
  });

  it("never reuses another reader's cast", async () => {
    const [first, second] = await Promise.all([seedUser("owner-a"), seedUser("owner-b")]);

    const a = await repository().persistAttestedCast(claim(first));
    const b = await repository().persistAttestedCast(claim(second));

    expect(b.castingId).not.toBe(a.castingId);
    expect(b.reused).toBe(false);
  });

  it("records a blocked question with its true risk status", async () => {
    const userId = await seedUser("blocked");
    const question = "Should I stop taking the medication my doctor prescribed for me?";
    const risk = evaluateRisk(question, "other");
    expect(risk.status).toBe("professional_decision_blocked");

    const { castingId } = await repository().persistAttestedCast(claim(userId, {
      question,
      scene: "other" as const,
      risk,
    }));

    const rows = await sql`
      select lifecycle, risk_status, risk_rule_version from casting_sessions where id = ${castingId}
    ` as Row[];
    expect(rows[0]).toMatchObject({
      lifecycle: "revealed",
      risk_status: "professional_decision_blocked",
      risk_rule_version: RISK_RULE_VERSION,
    });
  });

  it("marks an emergency question with the emergency lifecycle", async () => {
    const userId = await seedUser("emergency");
    const question = "I keep thinking I want to kill myself, what does this hexagram say?";
    const risk = evaluateRisk(question, "personal_growth");
    expect(risk.status).toBe("emergency_blocked");

    const { castingId } = await repository().persistAttestedCast(claim(userId, {
      question,
      scene: "personal_growth" as const,
      risk,
    }));

    const rows = await sql`
      select lifecycle, risk_status from casting_sessions where id = ${castingId}
    ` as Row[];
    expect(rows[0]).toMatchObject({
      lifecycle: "emergency_blocked",
      risk_status: "emergency_blocked",
    });
  });

  it("leaves nothing behind when the transaction fails", async () => {
    const userId = await seedUser("rollback");

    // A hexagram number outside 1..64 fails the cast_results check constraint,
    // which is the last of the three inserts: the session and question rows
    // exist inside the transaction and must not survive its rollback.
    await expect(repository().persistAttestedCast(claim(userId, {
      facts: { ...facts(), primaryHexagramNumber: 99 },
    }))).rejects.toThrow();

    const sessions = await sql`
      select count(*)::integer as total from casting_sessions where user_id = ${userId}
    ` as Row[];
    expect(sessions[0]!.total).toBe(0);

    const questions = await sql`
      select count(*)::integer as total from question_versions
      where casting_id in (select id from casting_sessions where user_id = ${userId})
    ` as Row[];
    expect(questions[0]!.total).toBe(0);
  });

  it("defaults pre-existing rows to server_generated", async () => {
    const userId = await seedUser("default-origin");
    const castingId = randomUUID();

    // A row written without naming cast_origin, as every migration before 0011
    // did, must keep the historical meaning rather than silently become attested.
    await sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, scene, interpretation_goal
      ) values (
        ${castingId}, ${userId}, 'three_coin', 'revealed', 'allowed', 'career',
        'what_do_i_need_to_see_clearly'
      )
    `;

    const rows = await sql`select cast_origin from casting_sessions where id = ${castingId}` as Row[];
    expect(rows[0]!.cast_origin).toBe("server_generated");
  });

  it("rejects a cast origin outside the allowed pair", async () => {
    const userId = await seedUser("bad-origin");

    await expect(sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, cast_origin, risk_status, scene, interpretation_goal
      ) values (
        ${randomUUID()}, ${userId}, 'three_coin', 'revealed', 'imported', 'allowed', 'career',
        'what_do_i_need_to_see_clearly'
      )
    `).rejects.toThrow();
  });
});
