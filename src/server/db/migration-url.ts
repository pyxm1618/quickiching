type MigrationEnvironment = Record<string, string | undefined>;

type MigrationUrlSource = {
  name: "DATABASE_URL_UNPOOLED" | "POSTGRES_TEST_URL";
  value: string;
};

function resolveMigrationUrlSource(env: MigrationEnvironment): MigrationUrlSource {
  const unpooled = env.DATABASE_URL_UNPOOLED?.trim();
  if (unpooled) return { name: "DATABASE_URL_UNPOOLED", value: unpooled };

  const testUrl = env.POSTGRES_TEST_URL?.trim();
  if (testUrl) return { name: "POSTGRES_TEST_URL", value: testUrl };

  throw new Error(
    "MIGRATION_DATABASE_URL_REQUIRED: set DATABASE_URL_UNPOOLED or POSTGRES_TEST_URL",
  );
}

export function resolveMigrationDatabaseUrl(
  env: MigrationEnvironment = process.env,
): string {
  const source = resolveMigrationUrlSource(env);
  let parsed: URL;

  try {
    parsed = new URL(source.value);
  } catch {
    throw new Error(
      `MIGRATION_DATABASE_URL_INVALID: ${source.name} must be a PostgreSQL URL`,
    );
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(
      `MIGRATION_DATABASE_URL_INVALID: ${source.name} must be a PostgreSQL URL`,
    );
  }

  if (parsed.hostname.includes("-pooler.")) {
    throw new Error(
      `MIGRATION_DATABASE_URL_POOLED_FORBIDDEN: ${source.name} must use a direct connection`,
    );
  }

  return source.value;
}
