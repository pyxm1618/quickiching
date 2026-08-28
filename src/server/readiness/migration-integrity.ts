import migrationIntegrity from "../../../drizzle/migration-integrity.json";

export type AppliedMigration = {
  createdAt: number;
  hash: string;
};

export type MigrationIntegrityStatus =
  | "ok"
  | "migration_missing"
  | "migration_outdated"
  | "migration_sequence_invalid"
  | "migration_hash_mismatch";

export const EXPECTED_COMMERCIAL_MIGRATIONS: readonly AppliedMigration[] = Object.freeze(
  migrationIntegrity.migrations.map((migration) =>
    Object.freeze({
      createdAt: migration.createdAt,
      hash: migration.hash,
    }),
  ),
);

export function checkMigrationIntegrity(
  applied: readonly AppliedMigration[],
): MigrationIntegrityStatus {
  if (applied.length === 0) return "migration_missing";

  const comparableCount = Math.min(applied.length, EXPECTED_COMMERCIAL_MIGRATIONS.length);
  for (let index = 0; index < comparableCount; index += 1) {
    const actual = applied[index]!;
    const expected = EXPECTED_COMMERCIAL_MIGRATIONS[index]!;
    if (actual.createdAt !== expected.createdAt) return "migration_sequence_invalid";
    if (actual.hash !== expected.hash) return "migration_hash_mismatch";
  }

  if (applied.length < EXPECTED_COMMERCIAL_MIGRATIONS.length) return "migration_outdated";
  if (applied.length > EXPECTED_COMMERCIAL_MIGRATIONS.length) return "migration_sequence_invalid";
  return "ok";
}
