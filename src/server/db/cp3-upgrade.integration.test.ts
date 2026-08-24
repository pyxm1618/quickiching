import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const databaseURL = process.env.TEST_DATABASE_UPGRADE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_UPGRADE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 4, prepare: false });
const db = drizzle(sql);
let initialMigrationFolder: string;

describe("CP3 upgrade from a populated CP2 database", () => {
  beforeAll(async () => {
    initialMigrationFolder = await mkdtemp(join("/tmp", "quickiching-cp3-0000-"));
    await mkdir(join(initialMigrationFolder, "meta"));
    await copyFile("drizzle/0000_cp2_auth_identity.sql", join(initialMigrationFolder, "0000_cp2_auth_identity.sql"));
    await copyFile("drizzle/meta/0000_snapshot.json", join(initialMigrationFolder, "meta/0000_snapshot.json"));
    await writeFile(join(initialMigrationFolder, "meta/_journal.json"), JSON.stringify({
      version: "7",
      dialect: "postgresql",
      entries: [{
        idx: 0,
        version: "7",
        when: 1787481005189,
        tag: "0000_cp2_auth_identity",
        breakpoints: true,
      }],
    }));

    await migrate(db, { migrationsFolder: initialMigrationFolder });
    const now = new Date("2026-08-24T00:03:00.000Z").toISOString();
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values ('cp2-upgrade-user', 'CP2 Existing User', 'cp2-upgrade@example.com', true, ${now}, ${now})
    `;
    await sql`
      insert into accounts (
        id, issuer, account_id, provider_id, user_id, created_at, updated_at
      ) values (
        'cp2-upgrade-account', 'https://accounts.google.com', 'cp2-upgrade-subject',
        'google', 'cp2-upgrade-user', ${now}, ${now}
      )
    `;
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
    if (initialMigrationFolder) await rm(initialMigrationFolder, { recursive: true, force: true });
  });

  it("preserves CP2 identity rows while applying the CP3 persistence and repair migrations", async () => {
    const users = await sql<{ id: string; email: string }[]>`
      select id, email from users where id = 'cp2-upgrade-user'
    `;
    const accounts = await sql<{ id: string; user_id: string }[]>`
      select id, user_id from accounts where id = 'cp2-upgrade-account'
    `;
    const migrations = await sql<{ count: string }[]>`
      select count(*)::text as count from drizzle.__drizzle_migrations
    `;
    const repairConstraint = await sql<{ count: string }[]>`
      select count(*)::text as count
      from information_schema.table_constraints
      where table_schema = 'public' and constraint_name = 'generation_reviews_pass_fields_check'
    `;

    expect(users).toEqual([{ id: "cp2-upgrade-user", email: "cp2-upgrade@example.com" }]);
    expect(accounts).toEqual([{ id: "cp2-upgrade-account", user_id: "cp2-upgrade-user" }]);
    expect(migrations[0]?.count).toBe("4");
    expect(repairConstraint[0]?.count).toBe("1");
  });
});
