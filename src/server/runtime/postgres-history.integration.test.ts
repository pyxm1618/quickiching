import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";
import { PostgresHistoryService } from "./postgres-history";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("PostgreSQL history pagination", () => {
  let sql: Sql;
  let history: PostgresHistoryService;

  beforeAll(async () => {
    sql = postgres(databaseUrl!, { max: 10 });
    await migratePostgres(sql);
    history = new PostgresHistoryService(sql);
  });

  beforeEach(async () => {
    await resetPostgresForTests(sql);
    await sql`
      insert into users (id, email) values
        ('usr_history', 'history@example.com'),
        ('usr_history_other', 'other-history@example.com')
    `;
    await sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, scene, interpretation_goal,
        algorithm_version, revealed_at, created_at, updated_at
      ) values
        ('cas_history_c', 'usr_history', 'mei_hua_current_time', 'revealed', 'allowed',
          'timing', 'is_the_timing_favorable', 'mei-hua-current-time-v1',
          '2026-07-31T03:00:00Z', '2026-07-31T03:00:00Z', '2026-07-31T03:00:00Z'),
        ('cas_history_b', 'usr_history', 'yarrow_stalk', 'revealed', 'allowed',
          'career', 'what_should_i_pay_attention_to_next', 'yarrow-v1',
          '2026-07-31T02:00:00Z', '2026-07-31T02:00:00Z', '2026-07-31T02:00:00Z'),
        ('cas_history_a', 'usr_history', 'three_coin', 'revealed', 'allowed',
          'career', 'what_should_i_pay_attention_to_next', 'three-coin-v1',
          '2026-07-31T01:00:00Z', '2026-07-31T01:00:00Z', '2026-07-31T01:00:00Z'),
        ('cas_history_other', 'usr_history_other', 'three_coin', 'revealed', 'allowed',
          'career', 'what_should_i_pay_attention_to_next', 'three-coin-v1',
          '2026-07-31T04:00:00Z', '2026-07-31T04:00:00Z', '2026-07-31T04:00:00Z')
    `;
    await sql`
      insert into cast_results (
        casting_session_id, line_values, primary_hexagram_number, moving_line_positions,
        relating_hexagram_number, method_calculation, result_hmac, result_hmac_key_version,
        algorithm_version, classic_mapping_version
      ) values (
        'cas_history_a', ${sql.json([9, 8, 7, 8, 7, 8] as never)}, 24,
        ${sql.json([1] as never)}, 2, ${sql.json({ kind: 'three-coin' } as never)},
        'history-test-hmac', 'v1', 'three-coin-v1', 'king-wen-v1'
      )
    `;
    await sql`
      insert into previews (id, casting_session_id, status, relevance_statement, schema_version)
      values ('prev_history_a', 'cas_history_a', 'completed', 'A fixed preview.', 'preview-v1')
    `;
    await sql`
      insert into readings (id, casting_session_id, status, report, schema_version, generation_epoch)
      values (
        'rdg_history_a', 'cas_history_a', 'completed',
        ${sql.json({ coreSummary: 'delivered' } as never)}, 'reading-v1', 1
      )
    `;
  });

  afterAll(async () => {
    if (sql) await sql.end();
  });

  it("uses a stable created-at and id cursor without leaking another user's rows", async () => {
    const first = await history.list({ userId: "usr_history", filter: { limit: 2 } });
    expect(first.items.map((item) => item.id)).toEqual(["cas_history_c", "cas_history_b"]);
    expect(first.nextCursor).toBeTruthy();

    const second = await history.list({
      userId: "usr_history",
      filter: { limit: 2, cursor: first.nextCursor! },
    });
    expect(second.items.map((item) => item.id)).toEqual(["cas_history_a"]);
    expect(second.nextCursor).toBeNull();
    expect([...first.items, ...second.items].some((item) => item.id === "cas_history_other")).toBe(false);
  });

  it("filters in PostgreSQL and returns result, delivery, and audit statuses", async () => {
    const page = await history.list({
      userId: "usr_history",
      filter: { method: "three_coin", scene: "career", hasReading: true },
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: "cas_history_a",
      primaryHexagramNumber: 24,
      movingLinePositions: [1],
      relatingHexagramNumber: 2,
      algorithmVersion: "three-coin-v1",
      classicMappingVersion: "king-wen-v1",
      previewStatus: "completed",
      readingId: "rdg_history_a",
      readingStatus: "completed",
    });
    expect(page.items[0].methodCalculation).toEqual({ kind: "three-coin" });
  });

  it("rejects malformed cursors before querying another page", async () => {
    await expect(history.list({
      userId: "usr_history",
      filter: { cursor: "not-a-valid-cursor" },
    })).rejects.toMatchObject({ code: "HISTORY_CURSOR_INVALID", field: "cursor" });
  });
});
