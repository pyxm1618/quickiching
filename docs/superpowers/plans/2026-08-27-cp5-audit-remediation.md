# CP5 Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every independently confirmed CP5 audit gap without redesigning Commercial V2.

**Architecture:** Keep the existing payment/generation/account architecture. Move shared security invariants to narrow server-only helpers, make state transitions fail closed, add one forward-only DB migration for result-integrity metadata/privacy erasure, and add regression tests plus a remote PostgreSQL gate.

**Tech Stack:** Next.js 15, TypeScript, Bun 1.3.14, Vitest, Drizzle/PostgreSQL, Vercel Workflow, GitHub Actions.

**Spec:** Independent CP5 audit of PR #36, baseline `614ade3e6489ab07ab53dd78fa07c38662fb8309`.

## Global Constraints

- Do not redesign Commercial V2 or introduce a provider/workflow framework.
- Preserve P1-1 exact route gates, P1-6 capability dependencies, and P1-9 DB insertion/immutability defenses.
- Encrypted question failures are fail-closed; unknown keys and invalid ciphertext never produce fabricated user input.
- Request-time `generation_jobs.input_snapshot_hash` is authoritative through claim and finalize.
- Deep-reading integrity covers the persisted output and relevant metadata and stores the signing-key version.
- Running generation leases may only be taken over after expiry.
- Workflow-start failures must not leave a credit reserved while the API reports queued.
- Account deletion removes user-authored question ciphertext and generated reading content while necessary payment/audit records remain de-identified.
- State-changing browser routes require same-origin `Origin`, `Referer`, and `Sec-Fetch-Site` evidence.
- Keep PR #36 Draft until verification is complete.

---

### Task 1: Fail-closed encrypted question loading

**Files:**
- Create: `src/server/generation/question-crypto.ts`
- Create: `src/server/generation/question-crypto.test.ts`
- Modify: `src/server/generation/deep-reading-service.ts`
- Modify: `src/server/workflows/deep-reading-steps.ts`

**Interfaces:**
- Produce `decryptQuestionForGeneration(row, env): string`.
- `question_version_id == null` is the only legitimate no-question fallback path.
- Existing encrypted rows require complete AES-GCM fields and a matching `QUESTION_ENCRYPTION_KEYS` version.

- [ ] Write tests proving valid versioned ciphertext decrypts and missing key/missing ciphertext/wrong key fail with explicit errors.
- [ ] Run focused tests and observe failures against the old duplicated fail-open helpers.
- [ ] Implement the shared helper and replace both duplicated helpers.
- [ ] Run focused tests and typecheck.

### Task 2: Durable workflow start and lease fencing

**Files:**
- Modify: `src/server/workflows/workflow-starter.ts`
- Modify: `src/server/generation/deep-reading-service.ts`
- Modify: `src/server/workflows/deep-reading-steps.ts`
- Modify/add focused unit and PostgreSQL integration tests.
- Modify: `vercel.json`

**Interfaces:**
- Workflow starter records provider-start failure then throws.
- Generation service compensates a definitively failed start in one idempotent transaction before surfacing failure.
- Claim accepts queued jobs or running jobs whose lease is expired; a live running lease is not replaceable.

- [ ] Add regression tests for start failure compensation and active-lease takeover rejection.
- [ ] Observe focused failures.
- [ ] Implement start-failure compensation and guarded lease claim.
- [ ] Change reconciliation cadence from daily to a short operational interval compatible with retry backoff.
- [ ] Run focused tests and PostgreSQL integration coverage.

### Task 3: End-to-end snapshot and result integrity

**Files:**
- Modify: `src/server/generation/integrity.ts`
- Create/modify: `src/server/generation/integrity.test.ts`
- Modify: `src/server/workflows/deep-reading-steps.ts`
- Modify: `src/server/db/deep-reading-schema.ts`
- Create: `drizzle/0010_cp5_audit_remediation.sql`
- Modify: `drizzle/meta/_journal.json`

**Interfaces:**
- Canonical snapshot input is structured JSON, not delimiter concatenation.
- Claim and finalize both compare current state to immutable `generation_jobs.input_snapshot_hash`.
- `calculateDeepReadingResultIntegrity` signs canonical output + facts + casting/job/reservation IDs + schema/prompt/provider/model and returns `{ hmac, version }`.
- `deep_reading_results.integrity_key_version` is required for new rows.

- [ ] Add tests proving output/metadata tampering changes HMAC and signing version is explicit.
- [ ] Add integration assertions for request-time snapshot mismatch at claim/finalize.
- [ ] Implement canonical input/output payloads and DB persistence.
- [ ] Add forward migration for `integrity_key_version`.
- [ ] Run integrity, workflow, migration, and Drizzle checks.

### Task 4: Outbox lease-token failure fence

**Files:**
- Modify: `src/server/payments/postgres-repository.ts`
- Modify: `src/server/payments/postgres-repository.integration.test.ts`

**Interfaces:**
- When a caller supplies an outbox lease token, failure recording requires exact equality with the current persisted token, including rejecting persisted `NULL`.

- [ ] Add stale-token/NULL-token regression test.
- [ ] Observe failure.
- [ ] Tighten the locked-row predicate and guarded update.
- [ ] Run payment/outbox integration tests.

### Task 5: Real account deletion and privacy semantics

**Files:**
- Create: `src/app/api/account/delete/route.ts`
- Create: `src/app/api/account/delete/route.test.ts`
- Create: `src/app/(default)/account/delete-account-control.tsx`
- Modify: `src/app/(default)/account/page.tsx`
- Modify: `src/server/account/postgres-repository.ts`
- Modify: `src/server/account/postgres-account.integration.test.ts`
- Modify: `src/app/(default)/privacy/page.tsx`
- Modify: `drizzle/0010_cp5_audit_remediation.sql`

**Interfaces:**
- Account deletion is authenticated, same-origin, explicitly confirmed by the UI, transactional, and idempotent.
- The migration keeps `deep_reading_results` immutable except when the transaction-local setting `quickiching.privacy_erasure=on` is set by the deletion transaction.
- Delete `question_versions` and `deep_reading_results` for the user's castings; release reservations; remove auth sessions/accounts; anonymize identity/audit linkage.

- [ ] Add DB regression fixture containing encrypted question and deep-reading output.
- [ ] Add route/UI-focused tests for auth, CSRF, and deletion call.
- [ ] Observe failures.
- [ ] Implement controlled erasure and wire the account UI.
- [ ] Update privacy copy to describe encrypted server-side questions, generated output, deletion, and de-identified retention.
- [ ] Run account integration tests and typecheck.

### Task 6: Shared strict same-origin guard

**Files:**
- Create: `src/server/http/origin-guard.ts`
- Create: `src/server/http/origin-guard.test.ts`
- Modify: `src/app/api/checkout/route.ts`
- Modify: `src/app/api/readings/[castingId]/deep/route.ts`
- Modify associated route tests.

**Interfaces:**
- `isStrictSameOriginRequest(request, env)` requires `Sec-Fetch-Site: same-origin`, `Origin`, and `Referer`.
- Both Origin and Referer must match either the visible request origin or one explicitly configured canonical origin.
- Malformed/missing headers fail closed.

- [ ] Add unit matrix for matching/missing/wrong/malformed headers and configured canonical origin.
- [ ] Update route fixtures to include Referer and add negative cases.
- [ ] Observe failures.
- [ ] Replace duplicated route helpers with the shared guard.
- [ ] Run route tests under production-like `APP_BASE_URL`/`BETTER_AUTH_URL` values.

### Task 7: Independent verification gate and handoff record

**Files:**
- Create: `.github/workflows/cp5-commercial-v2.yml`
- Create: `walkthrough.md`

**Interfaces:**
- CI installs Bun 1.3.14 and PostgreSQL client/server tools, then runs lint, typecheck, unit tests, Drizzle check, and `test:postgres:serial` against an ephemeral PostgreSQL instance created by the repository script.

- [ ] Add CI workflow scoped to PR/CP5.
- [ ] Run/observe remote CI and Vercel preview.
- [ ] Confirm migration succeeds from a fresh DB and upgrade fixture.
- [ ] Confirm all original P1 triggers no longer reproduce and legitimate paths remain green.
- [ ] Write `walkthrough.md` with exact SHA, commands, counts, and any remaining uncertainty.
- [ ] Keep PR #36 Draft for independent re-audit.