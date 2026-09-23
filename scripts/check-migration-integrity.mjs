import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const drizzleDir = path.join(root, "drizzle");
const journalPath = path.join(drizzleDir, "meta", "_journal.json");
const manifestPath = path.join(drizzleDir, "migration-integrity.json");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function gitBlobSha1(buffer) {
  return createHash("sha1")
    .update(Buffer.from(`blob ${buffer.length}\0`))
    .update(buffer)
    .digest("hex");
}

async function currentMigrations() {
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  if (!Array.isArray(journal.entries)) throw new Error("MIGRATION_JOURNAL_INVALID");

  const sqlFiles = (await readdir(drizzleDir))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();

  if (sqlFiles.length !== journal.entries.length) {
    throw new Error(`MIGRATION_SEQUENCE_MISMATCH: sql=${sqlFiles.length} journal=${journal.entries.length}`);
  }

  const result = [];
  for (let i = 0; i < journal.entries.length; i += 1) {
    const entry = journal.entries[i];
    const expectedFile = `${entry.tag}.sql`;
    if (entry.idx !== i || sqlFiles[i] !== expectedFile) {
      throw new Error(
        `MIGRATION_SEQUENCE_MISMATCH: index=${i} journal=${entry.idx}:${entry.tag} file=${sqlFiles[i] ?? "missing"}`,
      );
    }
    const content = await readFile(path.join(drizzleDir, expectedFile));
    result.push({
      idx: i,
      tag: entry.tag,
      createdAt: Number(entry.when),
      hash: sha256(content),
      gitBlobSha1: gitBlobSha1(content),
    });
  }
  return result;
}

function compare(expected, actual) {
  if (!Array.isArray(expected)) throw new Error("MIGRATION_INTEGRITY_MANIFEST_INVALID");
  if (expected.length !== actual.length) {
    throw new Error(`MIGRATION_INTEGRITY_COUNT_MISMATCH: expected=${expected.length} actual=${actual.length}`);
  }
  for (let i = 0; i < expected.length; i += 1) {
    const left = expected[i];
    const right = actual[i];
    for (const key of ["idx", "tag", "createdAt", "hash", "gitBlobSha1"]) {
      if (left?.[key] !== right?.[key]) {
        throw new Error(
          `MIGRATION_INTEGRITY_MISMATCH: index=${i} field=${key} expected=${String(left?.[key])} actual=${String(right?.[key])}`,
        );
      }
    }
  }
}

const actual = await currentMigrations();
if (process.argv.includes("--print-current")) {
  process.stdout.write(`${JSON.stringify(actual, null, 2)}\n`);
  process.exit(0);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
compare(manifest.migrations, actual);
process.stdout.write(`Migration integrity OK: ${actual.length} ordered migrations verified.\n`);
