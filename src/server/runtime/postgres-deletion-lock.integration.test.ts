import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratePostgres, resetPostgresForTests } from "@/server/db/migrate";

const databaseUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("database deletion advisory fence", () => {
  let ownerSql: Sql;
  let contenderSql: Sql;

  beforeAll(async () => {
    ownerSql = postgres(databaseUrl!, { max: 1 });
    contenderSql = postgres(databaseUrl!, { max: 1 });
    await migratePostgres(ownerSql);
  });

  beforeEach(async () => {
    await resetPostgresForTests(ownerSql);
  });

  afterAll(async () => {
    await Promise.all([ownerSql?.end(), contenderSql?.end()]);
  });

  it("rejects a direct deletion while the matching generation lock is held", async () => {
    await ownerSql`insert into users (id, email) values ('usr_lock_fence', 'lock-fence@example.com')`;
    await ownerSql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, scene,
        interpretation_goal, algorithm_version
      ) values (
        'cas_lock_fence', 'usr_lock_fence', 'three_coin', 'revealed',
        'allowed', 'career', 'what_should_i_pay_attention_to_next', 'three-coin-v1'
      )
    `;

    await ownerSql.begin(async (tx) => {
      await tx`
        select pg_advisory_xact_lock(
          hashtextextended('cas_lock_fence:preview', 0)
        )
      `;

      await expect(contenderSql`
        update casting_sessions set
          lifecycle = 'user_deleted',
          deleted_at = clock_timestamp(),
          purge_after = clock_timestamp() + interval '30 days',
          updated_at = clock_timestamp()
        where id = 'cas_lock_fence'
      `).rejects.toThrow("CASTING_DELETE_RETRY");
    });

    expect((await ownerSql`
      select lifecycle from casting_sessions where id = 'cas_lock_fence'
    `)[0].lifecycle).toBe("revealed");
  });
});
