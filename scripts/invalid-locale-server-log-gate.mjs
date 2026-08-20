import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = process.env.INVALID_LOCALE_LOG_GATE_PORT ?? "3107";
const BASE_URL = `http://${HOST}:${PORT}`;
const START_TIMEOUT_MS = 20_000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(server) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    assert.equal(server.exitCode, null, `Production server exited before becoming ready (${server.exitCode})`);
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await wait(100);
  }
  throw new Error(`Production server did not become ready within ${START_TIMEOUT_MS}ms`);
}

async function stopServer(server) {
  if (server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    once(server, "exit"),
    wait(3_000).then(() => {
      if (server.exitCode === null) server.kill("SIGKILL");
    }),
  ]);
}

const server = spawn("bun", ["run", "start"], {
  env: { ...process.env, HOSTNAME: HOST, PORT },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.setEncoding("utf8");
server.stderr.setEncoding("utf8");
server.stdout.on("data", (chunk) => { serverOutput += chunk; });
server.stderr.on("data", (chunk) => { serverOutput += chunk; });

try {
  await waitForServer(server);
  const response = await fetch(`${BASE_URL}/fr`, { redirect: "manual" });
  assert.equal(response.status, 404, `/fr must return 404, received ${response.status}`);
  await wait(250);
  assert.doesNotMatch(
    serverOutput,
    /NoFallbackError/,
    `Invalid locale navigation emitted an internal Next.js error:\n${serverOutput}`,
  );
  console.log("[Invalid Locale Server Log Gate] PASS: /fr returns 404 without NoFallbackError");
} finally {
  await stopServer(server);
}
