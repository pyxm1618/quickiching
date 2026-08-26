import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { authTables, users } from "./auth-schema";
import { createLoginIntentRepository } from "@/server/auth/login-intent";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql, { schema: authTables });

describe("CP2 PostgreSQL migration and auth persistence", () => {
  let userId = "cp2-user-integration";

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    const versionRows = await sql<{ version: string }[]>`select current_setting('server_version_num') as version`;
    expect(Number(versionRows[0]?.version)).toBeGreaterThanOrEqual(160000);
    const tableRows = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('users', 'sessions', 'accounts', 'verifications', 'login_intents')
      order by table_name
    `;
    expect(tableRows.map((row) => row.table_name)).toEqual([
      "accounts",
      "login_intents",
      "sessions",
      "users",
      "verifications",
    ]);
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("re-applies the forward-only migrations without changing their version count", async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    const migrationRows = await sql<{ count: string }[]>`
      select count(*)::text as count
      from drizzle.__drizzle_migrations
    `;
    expect(Number(migrationRows[0]?.count)).toBe(10);
  });

  it("enforces the identity foreign keys, uniqueness, and required indexes in PostgreSQL", async () => {
    const constraintRows = await sql<{ constraint_name: string }[]>`
      select constraint_name
      from information_schema.table_constraints
      where table_schema = 'public'
        and table_name in ('users', 'sessions', 'accounts', 'verifications', 'login_intents')
        and constraint_type in ('FOREIGN KEY', 'UNIQUE')
    `;
    expect(constraintRows.map((row) => row.constraint_name)).toEqual(expect.arrayContaining([
      "users_email_unique",
      "sessions_token_unique",
      "accounts_user_id_users_id_fk",
      "sessions_user_id_users_id_fk",
      "login_intents_consumed_user_id_users_id_fk",
    ]));

    const indexRows = await sql<{ indexname: string }[]>`
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and tablename in ('accounts', 'sessions', 'verifications', 'login_intents')
    `;
    expect(indexRows.map((row) => row.indexname)).toEqual(expect.arrayContaining([
      "accounts_user_id_idx",
      "accounts_issuer_account_id_idx",
      "login_intents_owner_idx",
      "login_intents_expiry_idx",
      "sessions_user_id_idx",
      "verifications_identifier_idx",
    ]));
  });

  it("keeps a reproducible CP1 legacy-draft fixture separate while exposing the CP2 boundary", async () => {
    const legacySchema = "cp1_legacy_draft";
    await sql.unsafe(`drop schema if exists ${legacySchema} cascade`);
    await sql.unsafe(`create schema ${legacySchema}`);
    try {
      await sql.unsafe(`
        create table ${legacySchema}.users (
          id text primary key,
          email text not null unique,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);
      await sql.unsafe(`
        create table ${legacySchema}.login_intents (
          id uuid primary key default gen_random_uuid(),
          casting_id uuid not null,
          anonymous_hash text not null,
          expires_at timestamptz not null,
          consumed_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);
      const legacyColumns = await sql<{ table_name: string; column_name: string }[]>`
        select table_name, column_name
        from information_schema.columns
        where table_schema = ${legacySchema}
        order by table_name, ordinal_position
      `;
      expect(legacyColumns.map((row) => `${row.table_name}.${row.column_name}`)).toEqual(expect.arrayContaining([
        "users.id",
        "users.email",
        "login_intents.casting_id",
        "login_intents.anonymous_hash",
        "login_intents.expires_at",
      ]));
      const cp2Tables = await sql<{ table_name: string }[]>`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name in ('users', 'sessions', 'accounts', 'verifications', 'login_intents')
      `;
      expect(cp2Tables).toHaveLength(5);
    } finally {
      await sql.unsafe(`drop schema ${legacySchema} cascade`);
    }
  });

  it("persists the Better Auth identity boundary and enforces account identity uniqueness", async () => {
    await db.insert(users).values({
      id: userId,
      name: "Integration User",
      email: "integration@example.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(users).values({
      id: "cp2-user-integration-two",
      name: "Second Integration User",
      email: "integration-two@example.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await sql`
      insert into accounts (id, issuer, account_id, provider_id, user_id, created_at, updated_at)
      values ('account-one', 'https://accounts.google.com', 'google-subject-1', 'google', ${userId}, now(), now())
    `;
    await expect(sql`
      insert into accounts (id, issuer, account_id, provider_id, user_id, created_at, updated_at)
      values ('account-two', 'https://accounts.google.com', 'google-subject-1', 'google', 'cp2-user-integration-two', now(), now())
    `).rejects.toThrow();
  });

  it("claims a Login Intent atomically for one owner and one authenticated user", async () => {
    const repository = createLoginIntentRepository(db);
    const intent = await repository.create({
      ownerDigest: "owner-digest-integration",
      targetResource: "casting:integration",
      castingId: "11111111-1111-4111-8111-111111111111",
      callbackURL: "/signin",
    }, "https://www.quickiching.com");

    const [first, second] = await Promise.all([
      repository.consume({
        intentId: intent.id,
        ownerDigest: "owner-digest-integration",
        targetResource: "casting:integration",
        castingId: "11111111-1111-4111-8111-111111111111",
        userId,
      }),
      repository.consume({
        intentId: intent.id,
        ownerDigest: "owner-digest-integration",
        targetResource: "casting:integration",
        castingId: "11111111-1111-4111-8111-111111111111",
        userId,
      }),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect([first, second].filter(Boolean)[0]).toMatchObject({
      id: intent.id,
      consumedUserId: userId,
    });
    await expect(repository.consume({
      intentId: intent.id,
      ownerDigest: "different-owner",
      targetResource: "casting:integration",
      castingId: "11111111-1111-4111-8111-111111111111",
      userId,
    })).resolves.toBeNull();

    const guarded = await repository.create({
      ownerDigest: "owner-digest-guarded",
      targetResource: "casting:guarded",
      castingId: "22222222-2222-4222-8222-222222222222",
      callbackURL: "/signin",
    }, "https://www.quickiching.com");
    await expect(repository.consume({
      intentId: guarded.id,
      ownerDigest: "wrong-owner",
      targetResource: "casting:guarded",
      castingId: "22222222-2222-4222-8222-222222222222",
      userId,
    })).resolves.toBeNull();
    await expect(repository.consume({
      intentId: guarded.id,
      ownerDigest: "owner-digest-guarded",
      targetResource: "casting:wrong",
      castingId: "22222222-2222-4222-8222-222222222222",
      userId,
    })).resolves.toBeNull();
    await expect(repository.consume({
      intentId: guarded.id,
      ownerDigest: "owner-digest-guarded",
      targetResource: "casting:guarded",
      castingId: "33333333-3333-4333-8333-333333333333",
      userId,
    })).resolves.toBeNull();
    await expect(repository.consume({
      intentId: guarded.id,
      ownerDigest: "owner-digest-guarded",
      targetResource: "casting:guarded",
      castingId: "22222222-2222-4222-8222-222222222222",
      userId: "missing-authenticated-user",
    })).resolves.toBeNull();
    const unchanged = await sql<{ consumed_at: Date | null; consumed_user_id: string | null }[]>`
      select consumed_at, consumed_user_id from login_intents where id = ${guarded.id}
    `;
    expect(unchanged[0]).toMatchObject({ consumed_at: null, consumed_user_id: null });
    await expect(repository.consume({
      intentId: guarded.id,
      ownerDigest: "owner-digest-guarded",
      targetResource: "casting:guarded",
      castingId: "22222222-2222-4222-8222-222222222222",
      userId,
    })).resolves.toMatchObject({ consumedUserId: userId });

    const expiring = await repository.create({
      ownerDigest: "owner-digest-expiring",
      targetResource: "casting:expiring",
      castingId: "44444444-4444-4444-8444-444444444444",
      callbackURL: "/signin",
      expiresAt: new Date(Date.now() + 1000),
    }, "https://www.quickiching.com");
    await expect(repository.consume({
      intentId: expiring.id,
      ownerDigest: "owner-digest-expiring",
      targetResource: "casting:expiring",
      castingId: "44444444-4444-4444-8444-444444444444",
      userId,
      now: new Date(Date.now() + 2000),
    })).resolves.toBeNull();
  });
});
