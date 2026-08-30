// Commercial V2 staging verification gate.
//
// Runs against an ALREADY DEPLOYED staging environment. This is an external
// verifier: it only makes real HTTP requests and reads/seeds the staging
// database directly. It never imports application server code, never adds a
// test-only backdoor, and never relaxes a capability gate.
//
// Three things cannot be automated and are deliberately NOT faked here:
//   1. A real payment. No script can complete a Waffo checkout.
//   2. A webhook delivery. verifyWebhook checks Waffo's PUBLIC key; we hold no
//      private key and must not add a bypass.
//   3. A login. Better Auth uses Google OAuth / magic link.
// Those live in docs/COMMERCIAL_V2_MANUAL_ACCEPTANCE.md and are run by a human.
//
// Usage:
//   STAGING_BASE_URL=https://staging.example.com \
//   STAGING_EXPECTED_CAPABILITIES='auth=on,aiPreview=on,checkout=on,webhookIngestion=on,paidDeepReading=on,reconcile=on' \
//   STAGING_DATABASE_URL=postgresql://... \
//   STAGING_CRON_SECRET=... \
//   STAGING_BETTER_AUTH_SECRET=... \
//   node scripts/commercial-v2-staging-gate.mjs

import { createHmac, randomUUID } from "node:crypto";

const PREFIX = "[Commercial V2 Staging Gate]";

function log(message) {
  console.log(`${PREFIX} ${message}`);
}

// ---------------------------------------------------------------------------
// Secret redaction
//
// Assertion failures must be diagnosable, so we print actual-vs-expected and
// response bodies. Every such string goes through redact() first: any known
// secret value is replaced before it can reach stdout or a CI log.
// ---------------------------------------------------------------------------

const SECRETS = [];

function registerSecret(value, label) {
  const candidate = value?.trim();
  if (candidate && candidate.length >= 8) SECRETS.push({ value: candidate, label });
}

function redact(text) {
  let output = typeof text === "string" ? text : JSON.stringify(text);
  if (output === undefined) return String(text);
  for (const secret of SECRETS) {
    output = output.split(secret.value).join(`<redacted:${secret.label}>`);
  }
  return output;
}

function preview(text, limit = 400) {
  const redacted = redact(text);
  return redacted.length > limit ? `${redacted.slice(0, limit)}… (truncated)` : redacted;
}

// ---------------------------------------------------------------------------
// Result accounting
//
// A gate that reports green because credentials were missing is worse than no
// gate at all, so "skipped" is a first-class, loudly-reported outcome that is
// never folded into "passed".
// ---------------------------------------------------------------------------

const results = { passed: [], failed: [], skipped: [] };

function pass(name) {
  results.passed.push(name);
  log(`PASS  ${name}`);
}

function fail(name, detail) {
  results.failed.push({ name, detail });
  log(`FAIL  ${name}`);
  for (const line of String(detail).split("\n")) log(`      ${line}`);
}

function skip(name, reason) {
  results.skipped.push({ name, reason });
  log(`SKIP  ${name} — ${reason}`);
}

function assertEqual(name, actual, expected) {
  if (actual === expected) {
    pass(name);
    return true;
  }
  fail(name, `expected: ${redact(String(expected))}\nactual:   ${redact(String(actual))}`);
  return false;
}

function assertTrue(name, condition, detail) {
  if (condition) {
    pass(name);
    return true;
  }
  fail(name, detail);
  return false;
}

async function check(name, body) {
  try {
    return await body();
  } catch (error) {
    fail(name, `threw: ${redact(error?.message ?? String(error))}`);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const CAPABILITY_NAMES = [
  "auth",
  "aiPreview",
  "checkout",
  "webhookIngestion",
  "paidDeepReading",
  "reconcile",
];

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseBaseUrl(raw) {
  const url = new URL(raw);
  const isLoopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  // https is mandatory for a real staging host. Loopback over http is allowed
  // so this script's own logic can be validated against `bun run start`.
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new Error(`STAGING_BASE_URL must be https (or http on loopback for local runs), got ${url.protocol}//${url.host}`);
  }
  return { origin: url.origin, isLoopback };
}

// Expected capability states are an input, not a constant: staging may
// legitimately run with a partially-open commercial surface.
function parseExpectedCapabilities(raw) {
  const expected = {};
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const [name, state] = trimmed.split("=").map((part) => part?.trim());
    if (!CAPABILITY_NAMES.includes(name)) {
      throw new Error(`unknown capability "${name}" (expected one of ${CAPABILITY_NAMES.join(", ")})`);
    }
    if (state !== "on" && state !== "off") {
      throw new Error(`capability "${name}" must be "on" or "off", got "${state}"`);
    }
    expected[name] = state === "on";
  }
  const missing = CAPABILITY_NAMES.filter((name) => !(name in expected));
  if (missing.length > 0) {
    throw new Error(`STAGING_EXPECTED_CAPABILITIES must declare all six capabilities; missing: ${missing.join(", ")}`);
  }
  return expected;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 20_000;

async function request(base, path, options = {}) {
  const url = `${base}${path}`;
  const response = await fetch(url, {
    ...options,
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, headers: response.headers, text, json };
}

// The strict same-origin guard (src/server/http/origin-guard.ts) requires all
// three headers. A browser sends them; a legitimate probe must too, otherwise
// every request is rejected as CSRF before reaching the assertion under test.
function sameOriginHeaders(origin, refererPath = "/") {
  return {
    "Origin": origin,
    "Referer": `${origin}${refererPath}`,
    "Sec-Fetch-Site": "same-origin",
  };
}

// ---------------------------------------------------------------------------
// Phase 1.1 — credential-free assertions
// ---------------------------------------------------------------------------

async function phaseHealth(ctx) {
  log("--- health ---");
  await check("GET /api/health returns 200", async () => {
    const response = await request(ctx.origin, "/api/health");
    if (!assertEqual("GET /api/health returns 200", response.status, 200)) return;
    assertEqual("GET /api/health reports status ok", response.json?.status, "ok");
  });
}

async function phaseReady(ctx) {
  log("--- readiness ---");
  const response = await check("GET /api/ready responds", () => request(ctx.origin, "/api/ready"));
  if (!response) return;

  const report = response.json;
  if (!report) {
    fail("GET /api/ready returns JSON", `status ${response.status}, body: ${preview(response.text)}`);
    return;
  }
  pass("GET /api/ready returns JSON");

  assertEqual("/api/ready status", report.status, ctx.expectedReadyStatus);
  assertEqual("/api/ready database.status", report.database?.status, ctx.expectedDatabaseStatus);

  // The runbook says this response is safe to paste into a ticket. Unit tests
  // assert that on the report shape; here we assert it on the real deployment,
  // where a misconfiguration could put a live URL into an error string.
  assertTrue(
    "/api/ready body contains no postgresql:// connection string",
    !response.text.includes("postgresql://") && !response.text.includes("postgres://"),
    "readiness response leaked a database URL scheme",
  );

  const leaked = SECRETS.filter((secret) => response.text.includes(secret.value)).map((secret) => secret.label);
  assertTrue(
    "/api/ready body contains no known secret value",
    leaked.length === 0,
    `readiness response echoed: ${leaked.join(", ")}`,
  );

  for (const name of CAPABILITY_NAMES) {
    const detail = report.capabilities?.[name];
    if (!detail) {
      fail(`/api/ready reports capability ${name}`, "capability missing from readiness report");
      continue;
    }
    const expected = ctx.expectedCapabilities[name];
    const actual = detail.enabled === true;
    if (actual === expected) {
      pass(`capability ${name} is ${expected ? "enabled" : "disabled"}`);
    } else {
      const reason = [
        `reason: ${detail.status}`,
        detail.missingDependencies?.length ? `missingDependencies: ${detail.missingDependencies.join(", ")}` : "",
        detail.invalidDependencies?.length ? `invalidDependencies: ${detail.invalidDependencies.join(", ")}` : "",
        detail.blockedDependencies?.length ? `blockedDependencies: ${detail.blockedDependencies.join(", ")}` : "",
      ].filter(Boolean).join("\n");
      fail(
        `capability ${name} is ${expected ? "enabled" : "disabled"}`,
        `expected enabled: ${expected}\nactual enabled:   ${actual}\n${reason}`,
      );
    }
  }
}

// A closed capability must answer 404 (middleware), an open one must answer 401
// for an anonymous caller. Both are pass conditions for the same probe; which
// one applies is decided by the declared expectation, never guessed from the
// response.
function expectedClosedOrUnauthorized(ctx, capability) {
  return ctx.expectedCapabilities[capability] ? 401 : 404;
}

async function phaseUnauthenticatedBoundaries(ctx) {
  log("--- unauthenticated boundaries ---");
  const headers = sameOriginHeaders(ctx.origin);

  await check("POST /api/checkout without a session", async () => {
    const response = await request(ctx.origin, "/api/checkout", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ productKey: "one", requestId: `gate-${randomUUID()}` }),
    });
    assertEqual(
      "POST /api/checkout without a session",
      response.status,
      expectedClosedOrUnauthorized(ctx, "checkout"),
    );
  });

  const castingProbe = randomUUID();
  await check("POST /api/readings/<uuid>/deep without a session", async () => {
    const response = await request(ctx.origin, `/api/readings/${castingProbe}/deep`, {
      method: "POST",
      headers,
    });
    assertEqual(
      "POST /api/readings/<uuid>/deep without a session",
      response.status,
      expectedClosedOrUnauthorized(ctx, "paidDeepReading"),
    );
  });

  await check("GET /api/readings/<uuid>/deep without a session", async () => {
    const response = await request(ctx.origin, `/api/readings/${castingProbe}/deep`);
    assertEqual(
      "GET /api/readings/<uuid>/deep without a session",
      response.status,
      expectedClosedOrUnauthorized(ctx, "paidDeepReading"),
    );
  });

  // /api/account/delete is probed anonymously only. An authenticated call would
  // really delete the account, so the gate never sends one.
  await check("POST /api/account/delete without a session", async () => {
    const response = await request(ctx.origin, "/api/account/delete", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: "{}",
    });
    assertEqual(
      "POST /api/account/delete without a session",
      response.status,
      expectedClosedOrUnauthorized(ctx, "auth"),
    );
  });

  await check("GET /api/orders/<id> without a session", async () => {
    const response = await request(ctx.origin, `/api/orders/${randomUUID()}`);
    if (response.status === 404) {
      // Distinguishing "route absent" from "capability closed" is not possible
      // from outside: middleware answers 404 for any unenumerated /api path.
      // Report it as unrun rather than claiming a pass.
      skip(
        "GET /api/orders/<id> without a session returns 401",
        "endpoint returned 404 — /api/orders/[orderId] is not deployed yet (P0-1); this assertion did not run",
      );
      return;
    }
    assertEqual("GET /api/orders/<id> without a session returns 401", response.status, 401);
  });
}

async function phaseCrossSite(ctx) {
  log("--- cross-site rejection ---");
  await check("POST /api/checkout from a foreign Origin", async () => {
    const response = await request(ctx.origin, "/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://attacker.example",
        "Referer": "https://attacker.example/",
        "Sec-Fetch-Site": "cross-site",
      },
      body: JSON.stringify({ productKey: "one", requestId: `gate-${randomUUID()}` }),
    });
    // Closed capability short-circuits to 404 before the origin guard runs.
    assertEqual(
      "POST /api/checkout from a foreign Origin is rejected",
      response.status,
      ctx.expectedCapabilities.checkout ? 403 : 404,
    );
  });
}

async function phaseReconcile(ctx) {
  log("--- reconcile authorization ---");

  if (!ctx.expectedCapabilities.reconcile) {
    await check("GET /api/internal/reconcile while closed", async () => {
      const response = await request(ctx.origin, "/api/internal/reconcile");
      assertEqual("GET /api/internal/reconcile while closed returns 404", response.status, 404);
    });
    return;
  }

  await check("GET /api/internal/reconcile without Authorization", async () => {
    const response = await request(ctx.origin, "/api/internal/reconcile");
    assertEqual("GET /api/internal/reconcile without Authorization returns 401", response.status, 401);
  });

  await check("GET /api/internal/reconcile with a wrong secret", async () => {
    const response = await request(ctx.origin, "/api/internal/reconcile", {
      headers: { Authorization: `Bearer ${"w".repeat(48)}` },
    });
    assertEqual("GET /api/internal/reconcile with a wrong secret returns 401", response.status, 401);
  });

  if (!ctx.cronSecret) {
    skip(
      "GET /api/internal/reconcile with the correct secret returns 200",
      "STAGING_CRON_SECRET is not set; this assertion did not run",
    );
    return;
  }

  await check("GET /api/internal/reconcile with the correct secret", async () => {
    const response = await request(ctx.origin, "/api/internal/reconcile", {
      headers: { Authorization: `Bearer ${ctx.cronSecret}` },
    });
    if (!assertEqual("GET /api/internal/reconcile with the correct secret returns 200", response.status, 200)) {
      log(`      body: ${preview(response.text)}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Phase 1.2 / 1.3 — seeded assertions
//
// Seeding is done straight against the staging database because the three
// preconditions (a verified account, a live session, granted credits) are
// produced in reality by OAuth, a real payment and a signed webhook, none of
// which a script may forge. Seeding writes only rows the application itself
// writes, through the same constraints and triggers; nothing is relaxed.
// ---------------------------------------------------------------------------

// Better Auth 1.7.1 stores an opaque session token in `sessions.token` and puts
// a SIGNED copy in the cookie: `<token>.<base64(HMAC-SHA256(token, secret))>`,
// URL-encoded (better-call/dist/crypto.mjs). An unsigned token is rejected
// before any database lookup, so the gate must sign the cookie with the real
// BETTER_AUTH_SECRET. This mints the same session shape a browser login
// produces — it is not an authentication bypass.
function betterAuthSessionCookie(token, secret) {
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  const value = encodeURIComponent(`${token}.${signature}`);
  // The cookie name carries the __Secure- prefix only when the deployment set
  // useSecureCookies (NODE_ENV=production). Sending both names lets the same
  // gate run against a deployed staging host and a local dev server; the server
  // reads whichever name it configured and ignores the other.
  return `__Secure-better-auth.session_token=${value}; better-auth.session_token=${value}`;
}

const PRODUCTS = {
  one: { quantity: 1, amountMinor: 299 },
  three: { quantity: 3, amountMinor: 699 },
  five: { quantity: 5, amountMinor: 999 },
};

async function seedAccount(sql, runId) {
  const userId = `staging-gate-${runId}`;
  const email = `staging-gate+${runId}@quickiching.invalid`;
  await sql`
    insert into users (id, name, email, email_verified)
    values (${userId}, 'Staging Gate', ${email}, true)
  `;

  const sessionToken = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  registerSecret(sessionToken, "SESSION_TOKEN");
  await sql`
    insert into sessions (id, user_id, token, expires_at)
    values (${randomUUID()}, ${userId}, ${sessionToken}, clock_timestamp() + interval '1 hour')
  `;

  return { userId, email, sessionToken };
}

// The product triple (product_key, quantity, amount_minor) is fixed by the
// payment_orders_product_truth_check constraint, and a trigger requires
// quantity_total to equal the order's quantity. Both are honoured here rather
// than worked around.
async function seedPaidOrderWithCredits(sql, userId, productKey) {
  const product = PRODUCTS[productKey];
  const orderId = randomUUID();
  const batchId = randomUUID();

  await sql`
    insert into payment_orders (
      id, user_id, product_key, quantity, amount_minor, currency, request_id,
      provider, provider_environment, provider_product_id,
      provider_order_id, provider_payment_id, status, paid_at
    ) values (
      ${orderId}, ${userId}, ${productKey}, ${product.quantity}, ${product.amountMinor},
      'USD', ${`gate-${randomUUID()}`}, 'waffo', 'test', ${`gate-product-${productKey}`},
      ${`gate-order-${orderId}`}, ${`gate-payment-${orderId}`}, 'paid', clock_timestamp()
    )
  `;
  await sql`
    insert into entitlement_batches (
      id, user_id, order_id, quantity_total, quantity_available, expires_at
    ) values (
      ${batchId}, ${userId}, ${orderId}, ${product.quantity}, ${product.quantity},
      clock_timestamp() + interval '12 months'
    )
  `;
  await sql`
    insert into entitlement_ledger (id, batch_id, order_id, action, quantity, business_key)
    values (${randomUUID()}, ${batchId}, ${orderId}, 'grant', ${product.quantity}, ${`grant:${orderId}`})
  `;

  return { orderId, batchId, quantity: product.quantity };
}

// Six young-yang lines: no moving lines, so the relating hexagram is null and
// the primary hexagram is King Wen #1. Chosen because every downstream value is
// derivable without reimplementing the hexagram mapping in this script.
const STILL_HEXAGRAM_LINES = [7, 7, 7, 7, 7, 7];
const GATE_QUESTION = "Should the staging verification gate proceed with this release candidate?";

// Prefer the real claim endpoint: using it verifies P0-1's endpoint as a side
// effect. Fall back to a direct seed so the rest of the chain is still covered
// before that endpoint ships.
async function createRevealedCasting(ctx, sql, cookie) {
  const response = await request(ctx.origin, "/api/readings/claim", {
    method: "POST",
    headers: { ...sameOriginHeaders(ctx.origin), "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      lineValuesBottomUp: STILL_HEXAGRAM_LINES,
      method: "three_coin",
      question: GATE_QUESTION,
      scene: "choices",
      interpretationGoal: "what_do_i_need_to_see_clearly",
    }),
  });

  if (response.status === 404) {
    skip(
      "POST /api/readings/claim creates a revealed casting",
      "endpoint returned 404 — /api/readings/claim is not deployed yet (P0-1); this assertion did not run, the casting was seeded directly instead",
    );
  } else if (response.status === 201 || response.status === 200) {
    const castingId = response.json?.castingId;
    if (typeof castingId === "string" && castingId) {
      pass("POST /api/readings/claim creates a revealed casting");
      return { castingId, via: "claim" };
    }
    fail("POST /api/readings/claim creates a revealed casting", `no castingId in body: ${preview(response.text)}`);
  } else {
    fail(
      "POST /api/readings/claim creates a revealed casting",
      `expected: 201 or 200\nactual:   ${response.status}\nbody: ${preview(response.text)}`,
    );
  }

  // Direct seed. question_versions is deliberately omitted: it is optional, and
  // omitting it keeps the question-encryption keyring out of this script.
  const castingId = randomUUID();
  await sql`
    insert into casting_sessions (
      id, user_id, method, lifecycle, cast_origin, risk_status, risk_rule_version,
      scene, interpretation_goal
    ) values (
      ${castingId}, ${ctx.seed.userId}, 'three_coin', 'revealed', 'client_attested',
      'allowed', 'staging-gate', 'choices', 'what_do_i_need_to_see_clearly'
    )
  `;
  await sql`
    insert into cast_results (
      casting_id, line_values, primary_hexagram_number, moving_line_positions,
      relating_hexagram_number, method_calculation, algorithm_version,
      classic_mapping_version, result_hmac, result_hmac_key_version
    ) values (
      ${castingId}, ${sql.array(STILL_HEXAGRAM_LINES)}::integer[], 1, '{}'::integer[],
      null, ${sql.json({ source: "staging-gate" })}::jsonb, 'three-coin-v1',
      'king-wen-v1', ${`staging-gate-${castingId}`}, 'staging-gate'
    )
  `;
  return { castingId, via: "direct-seed" };
}

// Every quote the paid reading prints must be byte-identical to the verified
// Wikisource snapshot. A near-miss here is the exact failure mode the
// deterministic layer exists to prevent, so the comparison is verbatim.
function classicalTextMatches(sourceEntry, quote) {
  if (!sourceEntry) return { ok: false, reason: `hexagram ${quote.hexagramNumber} absent from CLASSICAL_SOURCE_TEXT` };
  const candidates = [
    { label: null, text: sourceEntry.judgment },
    { label: null, text: sourceEntry.image },
    ...sourceEntry.lines.map((line) => ({ label: line.label, text: line.text })),
    ...(sourceEntry.useLine ? [{ label: sourceEntry.useLine.label, text: sourceEntry.useLine.text }] : []),
  ];
  const match = candidates.find((candidate) => candidate.text === quote.text);
  if (!match) {
    return {
      ok: false,
      reason: `quote text is not verbatim in the classical snapshot for hexagram ${quote.hexagramNumber}`,
    };
  }
  if (match.label && quote.label !== match.label) {
    return { ok: false, reason: `label mismatch: quote says "${quote.label}", snapshot says "${match.label}"` };
  }
  return { ok: true };
}

async function loadClassicalSource() {
  // Imported straight from the single source of truth so the gate can never
  // drift from what the application ships. Node >= 22.18 strips the types.
  const classical = await import("../src/domain/public-reading/classical-source-data.ts");
  return classical.CLASSICAL_SOURCE_TEXT;
}

function assertReadingReport(report, classicalSource) {
  assertEqual("deep reading schemaVersion is commercial-reading-v2", report?.schemaVersion, "commercial-reading-v2");

  const direction = report?.deterministic?.direction ?? "undetermined";
  assertEqual(
    "generated.verdictEcho equals deterministic.direction (or \"undetermined\")",
    report?.generated?.verdictEcho,
    direction,
  );

  const quotes = report?.deterministic?.quotes;
  if (!Array.isArray(quotes) || quotes.length === 0) {
    fail("deterministic.quotes are verbatim classical source text", "deterministic.quotes is empty or missing");
    return;
  }

  const problems = [];
  for (const quote of quotes) {
    const verdict = classicalTextMatches(classicalSource[quote.hexagramNumber], quote);
    // The quote text is classical public-domain source, not user content, so
    // echoing it in a failure message is safe and is what makes the failure
    // diagnosable.
    if (!verdict.ok) problems.push(`- [${quote.role}] ${quote.label}: ${verdict.reason}\n  quoted: ${quote.text}`);
  }
  assertTrue(
    "deterministic.quotes are verbatim classical source text",
    problems.length === 0,
    `${problems.length} of ${quotes.length} quote(s) failed:\n${problems.join("\n")}`,
  );
}

async function pollDeepReading(ctx, castingId, cookie) {
  const deadline = Date.now() + ctx.deepReadingTimeoutMs;
  let last;
  while (Date.now() < deadline) {
    const response = await request(ctx.origin, `/api/readings/${castingId}/deep`, { headers: { Cookie: cookie } });
    last = response;
    const status = response.json?.status;
    if (status === "completed" || status === "failed" || status === "timed_out") return response;
    await new Promise((resolve) => setTimeout(resolve, ctx.deepReadingPollMs));
  }
  return { ...last, timedOut: true };
}

async function phaseSeededDeepReading(ctx, sql, cookie) {
  log("--- deep reading over a seeded account ---");

  const casting = await createRevealedCasting(ctx, sql, cookie);
  ctx.seed.castingIds.push(casting.castingId);
  log(`casting created via: ${casting.via}`);

  const before = await sql`
    select coalesce(sum(quantity_available), 0)::integer as available
    from entitlement_batches where user_id = ${ctx.seed.userId}
  `;
  const availableBefore = Number(before[0].available);

  const started = await request(ctx.origin, `/api/readings/${casting.castingId}/deep`, {
    method: "POST",
    headers: { ...sameOriginHeaders(ctx.origin), Cookie: cookie },
  });
  if (!assertTrue(
    "POST /api/readings/<castingId>/deep returns 202 or 200",
    started.status === 202 || started.status === 200,
    `expected: 202 or 200\nactual:   ${started.status}\nbody: ${preview(started.text)}`,
  )) return;

  const after = await sql`
    select coalesce(sum(quantity_available), 0)::integer as available
    from entitlement_batches where user_id = ${ctx.seed.userId}
  `;
  assertEqual(
    "requesting a deep reading decrements entitlement_batches.quantity_available by one",
    Number(after[0].available),
    availableBefore - 1,
  );

  const final = await pollDeepReading(ctx, casting.castingId, cookie);
  const status = final?.json?.status;

  if (final?.timedOut) {
    fail(
      "deep reading reaches a terminal state",
      `still ${status ?? "unknown"} after ${ctx.deepReadingTimeoutMs}ms`,
    );
    return;
  }
  if (status !== "completed") {
    fail(
      "deep reading reaches a terminal state",
      `terminal status: ${status}${final?.json?.errorCode ? ` (${final.json.errorCode})` : ""}`,
    );
    return;
  }
  pass("deep reading reaches a terminal state");

  assertReadingReport(final.json.output, ctx.classicalSource);

  const reservations = await sql`
    select status from entitlement_reservations
    where user_id = ${ctx.seed.userId} and casting_id = ${casting.castingId}
  `;
  assertTrue(
    "the reservation for this casting is marked consumed",
    reservations.length === 1 && reservations[0].status === "consumed",
    `reservation states: ${JSON.stringify(reservations.map((row) => row.status))}`,
  );
}

async function phaseInsufficientCredits(ctx, sql, cookie) {
  log("--- exhausted credits ---");

  const remaining = await sql`
    select coalesce(sum(quantity_available), 0)::integer as available
    from entitlement_batches where user_id = ${ctx.seed.userId} and expires_at > clock_timestamp()
  `;
  if (Number(remaining[0].available) !== 0) {
    skip(
      "POST /api/readings/<castingId>/deep returns 402 once credits are exhausted",
      `the seeded account still has ${Number(remaining[0].available)} credit(s); this assertion did not run`,
    );
    return;
  }

  const casting = await createRevealedCasting(ctx, sql, cookie);
  ctx.seed.castingIds.push(casting.castingId);

  const response = await request(ctx.origin, `/api/readings/${casting.castingId}/deep`, {
    method: "POST",
    headers: { ...sameOriginHeaders(ctx.origin), Cookie: cookie },
  });
  assertEqual(
    "POST /api/readings/<castingId>/deep returns 402 once credits are exhausted",
    response.status,
    402,
  );
}

async function phaseWebhookRejection(ctx, sql) {
  log("--- webhook signature rejection ---");

  if (!ctx.expectedCapabilities.webhookIngestion) {
    const response = await request(ctx.origin, "/api/webhooks/waffo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assertEqual("POST /api/webhooks/waffo while closed returns 404", response.status, 404);
    return;
  }

  const before = await sql`select count(*)::integer as total from payment_webhook_inbox`;
  const response = await request(ctx.origin, "/api/webhooks/waffo", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Waffo-Signature": "not-a-valid-signature" },
    body: JSON.stringify({
      id: `gate-${randomUUID()}`,
      type: "order.paid",
      data: { note: "staging gate forged event, must be rejected" },
    }),
  });
  assertEqual("POST /api/webhooks/waffo with an invalid signature returns 401", response.status, 401);

  const after = await sql`select count(*)::integer as total from payment_webhook_inbox`;
  assertEqual(
    "a rejected webhook writes no payment_webhook_inbox row",
    Number(after[0].total),
    Number(before[0].total),
  );
}

async function phaseCheckout(ctx, sql, cookie) {
  log("--- checkout order creation (real Waffo test environment) ---");

  if (!ctx.expectedCapabilities.checkout) {
    skip("authenticated POST /api/checkout creates an order", "checkout capability is declared off; this assertion did not run");
    return;
  }

  const headers = { ...sameOriginHeaders(ctx.origin), "Content-Type": "application/json", Cookie: cookie };
  const requestId = `gate-${randomUUID()}`;

  const first = await request(ctx.origin, "/api/checkout", {
    method: "POST",
    headers,
    body: JSON.stringify({ productKey: "one", requestId }),
  });
  if (!assertEqual("authenticated POST /api/checkout returns 200", first.status, 200)) {
    log(`      body: ${preview(first.text)}`);
    return;
  }

  const { orderId, checkoutUrl, expiresAt } = first.json ?? {};
  // The checkout URL carries a private token in its fragment. Register it
  // before anything can print it.
  registerSecret(checkoutUrl, "CHECKOUT_URL");
  if (orderId) ctx.seed.orderIds.push(orderId);

  assertTrue(
    "checkout response carries orderId, checkoutUrl and expiresAt",
    typeof orderId === "string" && orderId.length > 0
      && typeof checkoutUrl === "string" && checkoutUrl.length > 0
      && typeof expiresAt === "string" && expiresAt.length > 0,
    `orderId: ${typeof orderId}, checkoutUrl: ${typeof checkoutUrl}, expiresAt: ${typeof expiresAt}`,
  );

  if (typeof checkoutUrl === "string") {
    let host = "";
    try {
      host = new URL(checkoutUrl).hostname;
    } catch {
      // Reported by the assertion below; the URL itself is never printed.
    }
    assertTrue(
      `checkoutUrl host belongs to ${ctx.checkoutHostSuffix}`,
      host === ctx.checkoutHostSuffix || host.endsWith(`.${ctx.checkoutHostSuffix}`),
      `checkout URL host did not end with "${ctx.checkoutHostSuffix}" (host withheld: the URL fragment carries a private token)`,
    );
  }

  if (typeof expiresAt === "string") {
    const expiry = Date.parse(expiresAt);
    assertTrue(
      "checkout expiresAt is in the future",
      Number.isFinite(expiry) && expiry > Date.now(),
      `expiresAt: ${expiresAt}, now: ${new Date().toISOString()}`,
    );
  }

  const repeat = await request(ctx.origin, "/api/checkout", {
    method: "POST",
    headers,
    body: JSON.stringify({ productKey: "one", requestId }),
  });
  if (repeat.status === 200) {
    registerSecret(repeat.json?.checkoutUrl, "CHECKOUT_URL");
    assertEqual("repeating the same requestId returns the same orderId", repeat.json?.orderId, orderId);
  } else {
    fail(
      "repeating the same requestId returns the same orderId",
      `expected: 200\nactual:   ${repeat.status}\nbody: ${preview(repeat.text)}`,
    );
  }

  const invalid = await request(ctx.origin, "/api/checkout", {
    method: "POST",
    headers,
    body: JSON.stringify({ productKey: "seven", requestId: `gate-${randomUUID()}` }),
  });
  assertEqual("an unknown productKey is rejected with 400", invalid.status, 400);
}

// ---------------------------------------------------------------------------
// Cleanup
//
// entitlement_ledger and audit_events are append-only by database trigger, and
// deep_reading_results is deletable only under the transaction-local privacy
// erasure flag the product's own account deletion uses. This teardown mirrors
// that sanctioned path exactly; it never disables a trigger. Rows that the
// design deliberately keeps forever — the ledger, the audit trail, and the
// order/batch/user rows their foreign keys pin down — are pseudonymised the
// same way a real account deletion pseudonymises them, and reported below.
// ---------------------------------------------------------------------------

async function cleanup(sql, seed) {
  if (!seed?.userId) return;
  log("--- cleanup ---");

  try {
    await sql.begin(async (transaction) => {
      await transaction`select set_config('quickiching.privacy_erasure', 'on', true)`;

      const castings = transaction`select id from casting_sessions where user_id = ${seed.userId}`;
      await transaction`delete from deep_reading_results where casting_id in (${castings})`;
      await transaction`delete from entitlement_reservations where user_id = ${seed.userId}`;
      await transaction`delete from preview_results where casting_id in (${castings})`;
      await transaction`delete from generation_output_reviews where casting_id in (${castings})`;
      await transaction`
        delete from generation_attempts
        where job_id in (select id from generation_jobs where casting_id in (${castings}))
      `;
      await transaction`delete from generation_jobs where casting_id in (${castings})`;
      await transaction`delete from question_versions where casting_id in (${castings})`;
      await transaction`delete from cast_results where casting_id in (${castings})`;
      await transaction`
        delete from workflow_runs
        where entity_id in (select id::text from casting_sessions where user_id = ${seed.userId})
      `;
      await transaction`delete from casting_sessions where user_id = ${seed.userId}`;
      await transaction`delete from sessions where user_id = ${seed.userId}`;
      await transaction`delete from accounts where user_id = ${seed.userId}`;
    });

    // Attempted separately: these succeed only when no immutable ledger row
    // pins them down, which is the case when no reading was ever requested.
    const residue = [];
    try {
      await sql.begin(async (transaction) => {
        await transaction`delete from entitlement_batches where user_id = ${seed.userId}`;
        await transaction`delete from payment_orders where user_id = ${seed.userId}`;
        await transaction`delete from users where id = ${seed.userId}`;
      });
      log("removed every seeded row, including the seeded user");
    } catch {
      await sql`
        update users
        set name = 'Deleted User', email = ${`staging-gate-deleted_${randomUUID()}@deleted.local`},
            email_verified = false, image = null, updated_at = clock_timestamp()
        where id = ${seed.userId}
      `;
      residue.push("entitlement_ledger (append-only by trigger)");
      residue.push("audit_events (append-only by trigger)");
      residue.push("entitlement_batches / payment_orders / users (pinned by ledger foreign keys)");
      log(`seeded user ${seed.userId} pseudonymised; rows retained by design:`);
      for (const entry of residue) log(`  - ${entry}`);
    }
  } catch (error) {
    // Cleanup failure must be visible, and must not mask an earlier verdict.
    fail("cleanup removes the seeded fixture", redact(error?.message ?? String(error)));
  }
}

async function runSeededPhases(ctx) {
  const { default: postgres } = await import("postgres");
  const sql = postgres(ctx.databaseUrl, { max: 2, onnotice: () => {}, prepare: false });

  try {
    ctx.classicalSource = await loadClassicalSource();
    ctx.seed = await seedAccount(sql, ctx.runId);
    ctx.seed.castingIds = [];
    ctx.seed.orderIds = [];
    log(`seeded user: ${ctx.seed.userId}`);

    const cookie = betterAuthSessionCookie(ctx.seed.sessionToken, ctx.betterAuthSecret);

    await phaseWebhookRejection(ctx, sql);
    await seedPaidOrderWithCredits(sql, ctx.seed.userId, "one");
    await phaseSeededDeepReading(ctx, sql, cookie);
    await phaseInsufficientCredits(ctx, sql, cookie);
    await phaseCheckout(ctx, sql, cookie);
  } finally {
    await cleanup(sql, ctx.seed);
    await sql.end({ timeout: 5 });
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function summarize() {
  log("");
  log("=== summary ===");
  log(`passed:  ${results.passed.length}`);
  log(`skipped: ${results.skipped.length}`);
  log(`failed:  ${results.failed.length}`);

  if (results.skipped.length > 0) {
    log("");
    log("Assertions that DID NOT RUN (this gate is not fully green):");
    for (const entry of results.skipped) log(`  - ${entry.name}: ${entry.reason}`);
  }

  if (results.failed.length > 0) {
    log("");
    log("Failures:");
    for (const entry of results.failed) log(`  - ${entry.name}`);
  }
}

async function main() {
  const baseUrlRaw = requireEnv("STAGING_BASE_URL");
  const { origin, isLoopback } = parseBaseUrl(baseUrlRaw);
  const expectedCapabilities = parseExpectedCapabilities(requireEnv("STAGING_EXPECTED_CAPABILITIES"));

  const cronSecret = process.env.STAGING_CRON_SECRET?.trim() ?? "";
  registerSecret(cronSecret, "CRON_SECRET");
  registerSecret(process.env.STAGING_DATABASE_URL, "DATABASE_URL");
  registerSecret(process.env.STAGING_BETTER_AUTH_SECRET, "BETTER_AUTH_SECRET");

  const ctx = {
    origin,
    isLoopback,
    expectedCapabilities,
    cronSecret,
    runId: randomUUID(),
    databaseUrl: process.env.STAGING_DATABASE_URL?.trim() ?? "",
    betterAuthSecret: process.env.STAGING_BETTER_AUTH_SECRET?.trim() ?? "",
    expectedReadyStatus: process.env.STAGING_EXPECT_READY_STATUS?.trim() || "ready",
    expectedDatabaseStatus: process.env.STAGING_EXPECT_DATABASE_STATUS?.trim() || "ok",
    checkoutHostSuffix: process.env.STAGING_EXPECTED_CHECKOUT_HOST_SUFFIX?.trim() || "waffo.ai",
    deepReadingTimeoutMs: Number(process.env.STAGING_DEEP_READING_TIMEOUT_MS ?? 300_000),
    deepReadingPollMs: Number(process.env.STAGING_DEEP_READING_POLL_MS ?? 3_000),
  };

  log(`target: ${origin}`);
  log(`expected capabilities: ${CAPABILITY_NAMES.map((n) => `${n}=${expectedCapabilities[n] ? "on" : "off"}`).join(", ")}`);

  await phaseHealth(ctx);
  await phaseReady(ctx);
  await phaseUnauthenticatedBoundaries(ctx);
  await phaseCrossSite(ctx);
  await phaseReconcile(ctx);

  const missingForSeeding = [
    ctx.databaseUrl ? "" : "STAGING_DATABASE_URL",
    ctx.betterAuthSecret ? "" : "STAGING_BETTER_AUTH_SECRET",
  ].filter(Boolean);

  if (missingForSeeding.length > 0) {
    // Named individually so a partially-configured run cannot be mistaken for
    // a fully-verified one.
    for (const name of [
      "POST /api/webhooks/waffo with an invalid signature returns 401",
      "a rejected webhook writes no payment_webhook_inbox row",
      "POST /api/readings/<castingId>/deep returns 202 or 200",
      "deep reading reaches a terminal state",
      "deterministic.quotes are verbatim classical source text",
      "generated.verdictEcho equals deterministic.direction (or \"undetermined\")",
      "requesting a deep reading decrements entitlement_batches.quantity_available by one",
      "the reservation for this casting is marked consumed",
      "POST /api/readings/<castingId>/deep returns 402 once credits are exhausted",
      "authenticated POST /api/checkout returns 200",
      "repeating the same requestId returns the same orderId",
      "an unknown productKey is rejected with 400",
    ]) {
      skip(name, `${missingForSeeding.join(" and ")} not set; this assertion did not run`);
    }
  } else {
    await runSeededPhases(ctx);
  }

  summarize();

  if (results.failed.length > 0) {
    log("");
    log("RESULT: FAILED");
    process.exitCode = 1;
    return;
  }
  log("");
  log(
    results.skipped.length > 0
      ? "RESULT: PASSED WITH UNRUN ASSERTIONS (see the list above)"
      : "RESULT: PASSED",
  );
}

main().catch((error) => {
  fail("staging gate run", redact(error?.message ?? String(error)));
  summarize();
  log("");
  log("RESULT: ABORTED — the run stopped before every assertion could execute");
  process.exitCode = 1;
});
