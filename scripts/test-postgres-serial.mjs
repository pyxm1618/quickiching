import { execFileSync, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

function executable(name) {
  try {
    return execFileSync("which", [name], { encoding: "utf8" }).trim();
  } catch {
    throw new Error(`${name} is required for test:postgres:serial`);
  }
}

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`${command} terminated by ${signal}`));
      else if (code !== 0) reject(new Error(`${command} exited with ${code}`));
      else resolve();
    });
  });
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a local PostgreSQL port");
  const port = address.port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const initdb = executable("initdb");
const pgctl = executable("pg_ctl");
const createdb = executable("createdb");
const bun = executable("bun");
const root = await mkdtemp(join(tmpdir(), "quickiching-cp2-postgres-"));
const dataDir = join(root, "data");
const socketDir = join(root, "socket");
const port = await freePort();
const user = "quickiching_test";
const database = "quickiching_test";
const upgradeDatabase = "quickiching_test_upgrade";
const databaseURL = `postgresql://${user}@127.0.0.1:${port}/${database}`;
const upgradeDatabaseURL = `postgresql://${user}@127.0.0.1:${port}/${upgradeDatabase}`;
let started = false;
let exitCode = 0;

try {
  await mkdir(socketDir, { recursive: true });
  await run(initdb, ["-D", dataDir, "-A", "trust", "-U", user, "--no-locale", "--encoding=UTF8"]);
  await run(pgctl, ["-D", dataDir, "-o", `-p ${port} -k ${socketDir}`, "-w", "start"]);
  started = true;
  await run(createdb, ["-h", "127.0.0.1", "-p", String(port), "-U", user, database]);
  await run(createdb, ["-h", "127.0.0.1", "-p", String(port), "-U", user, upgradeDatabase]);
    await run(bun, ["x", "vitest", "run", "--no-file-parallelism", "src/server/db/postgres.integration.test.ts", "src/server/db/cp3-generation.integration.test.ts", "src/server/db/cp3-upgrade.integration.test.ts", "src/server/generation/postgres-repository.integration.test.ts", "src/server/auth/better-auth.integration.test.ts", "src/server/auth/runtime.integration.test.ts"], {
    ...process.env,
    TEST_DATABASE_URL: databaseURL,
    TEST_DATABASE_UPGRADE_URL: upgradeDatabaseURL,
    MIGRATION_DATABASE_URL: databaseURL,
    VITEST_INTEGRATION: "1",
  });
} catch (error) {
  exitCode = 1;
  console.error(error instanceof Error ? error.message : "PostgreSQL serial test failed");
} finally {
  if (started) {
    try {
      await run(pgctl, ["-D", dataDir, "-m", "fast", "-w", "stop"]);
    } catch (error) {
      exitCode = 1;
      console.error(error instanceof Error ? error.message : "Could not stop temporary PostgreSQL");
    }
  }
  await rm(root, { recursive: true, force: true });
}

process.exitCode = exitCode;
