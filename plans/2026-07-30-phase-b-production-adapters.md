# Quick I Ching Phase B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Phase A development adapters with production-capable PostgreSQL, authentication, payment, and durable-job boundaries while failing closed until each external provider is configured.

**Architecture:** PostgreSQL is the sole source of user-visible state. Server Actions call application services backed by a repository interface; external callbacks enter through signed Route Handlers into idempotent inbox records; long-running work is created transactionally with an Outbox and finalized only when its generation fence still matches.

**Tech Stack:** Next.js 15, TypeScript, Drizzle ORM, Neon PostgreSQL, Better Auth, Creem, Vercel Workflow, Vitest, Zod.

## Global Constraints

- Preserve all 28 PRD requirement IDs and Phase A’s fail-closed behavior.
- Never grant an entitlement from a browser return URL; only a verified payment event may do so.
- No provider credential, approval, or account may be fabricated; unavailable adapters reject startup or requests with a specific public error.
- Use migrations, transactions, idempotency keys, immutable ledger entries, Outbox dispatch, and generation-epoch fencing.
- Keep `docs/` limited to `PRD.md` and `技术设计文档.md`.

---

### Task 1: Production dependency and runtime contract

**Files:** `package.json`, `.env.example`, `src/server/config.ts`, `src/server/config.test.ts`

- [ ] Add Drizzle, PostgreSQL driver, Better Auth, Creem SDK boundary, Workflow SDK, and validation dependencies at lockfile-pinned versions.
- [ ] Add `DATABASE_URL`, provider keys, webhook secrets, workflow and adapter modes to a Zod-validated runtime configuration.
- [ ] Test that each production adapter rejects missing credentials and that local/test modes retain explicit in-memory behavior.

### Task 2: Drizzle schema, migrations, and repository interface

**Files:** `drizzle.config.ts`, `src/server/db/schema.ts`, `src/server/db/client.ts`, `src/server/db/repository.ts`, `drizzle/*`

- [ ] Model users, sessions/accounts, login intents, casts, encrypted question versions, steps, results, risk checks, jobs, attempts, outbox, webhook inbox, orders, entitlement batches, immutable ledger, reservations, reviews, and audit events.
- [ ] Add partial unique indexes for active casts, question locks, one result per cast, one reading per cast, idempotent webhook events, and unique reservation terminals.
- [ ] Write repository integration tests against `DATABASE_URL`; stop before migration/application if no Neon database URL is supplied.

### Task 3: Authentication and Login Intent

**Files:** `src/lib/auth/*`, `src/app/api/auth/[...all]/route.ts`, `src/server/services/reveal-service.ts`

- [ ] Configure Better Auth with Google OAuth and Resend Magic Link adapters behind `AUTH_ADAPTER_MODE=better-auth`.
- [ ] Persist a single-use Login Intent before redirect; validate callback, bind cast and 72-hour lock in one transaction, then consume intent.
- [ ] Test same-browser, different-browser, cancellation, replay, and competing reveal behavior; stop at provider configuration if OAuth/Resend credentials are absent.

### Task 4: Payment provider, webhook Inbox, and entitlement transitions

**Files:** `src/server/payments/*`, `src/app/api/webhooks/creem/route.ts`, `src/server/services/reading-service.ts`

- [ ] Create a Checkout only through the Creem adapter and persist a pending order with a request id.
- [ ] Verify raw-body signatures; persist a unique Inbox event before applying paid/refund/dispute transitions and ledger effects transactionally.
- [ ] Test duplicate delivery, reordered events, invalid signature, refund, dispute, and browser-return-without-webhook; stop at live provider validation if merchant credentials are absent.

### Task 5: Jobs, Outbox, Workflow, and AI finalization fence

**Files:** `src/server/jobs/*`, `src/app/api/jobs/*`, `src/workflows/*`, `src/server/ai/*`

- [ ] Create Preview/Reading jobs and Outbox records in the same transaction as their state changes.
- [ ] Dispatch idempotently, reconcile pending Outbox records, retry bounded failures, and finalize only if job id, epoch, status, result snapshot, and reservation still match.
- [ ] Test dispatch loss, retry, timeout, late success, duplicate execution, output schema failure, and release-versus-expiry of a reservation; stop at Workflow/AI credential validation if absent.

### Task 6: Migration switch, observability, and release gate

**Files:** `src/server/services/*`, `src/app/actions.ts`, `README.md`, `docs/PRD.md`, `docs/技术设计文档.md`

- [ ] Move actions to thin authentication/validation/transport functions over application services.
- [ ] Add structured audit events and readiness checks; remove production paths to Phase A simulators.
- [ ] Run typecheck, unit and database integration tests, production build, migration dry run, webhook replay test, and end-to-end provider smoke tests when credentials are available.
