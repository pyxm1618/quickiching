# I Ching Coin V2.1 Complete Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Every behavior change follows RED → GREEN → REFACTOR. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the local application safe and deterministic, implement every V2.1 production boundary, and leave only credential/account-dependent live smoke tests waiting for operator-provided values.

**Architecture:** Server Actions are thin validated transports over focused application services. Domain services enforce lifecycle and authorization invariants against a repository interface; PostgreSQL is the production source of truth, while the in-memory repository remains an explicit test/local adapter. Authentication, payment, AI, and background execution sit behind narrow provider interfaces, and production startup fails closed until their credentials are present.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zod, Vitest, Drizzle ORM, PostgreSQL, Better Auth, Creem HTTP/Webhook API, Vercel Workflow-compatible job boundary, structured AI provider boundary.

## Global Constraints

- `docs/` remains limited to `PRD.md` and `技术设计文档.md`.
- Preserve all 28 PRD requirement IDs and the orthogonal lifecycle, risk, generation, entitlement, and review states.
- No anonymous response may contain result fields before a successful reveal transaction.
- No browser state is authoritative for ownership, lifecycle, risk, payment, generation, or report content.
- Every external input and generated output is validated with Zod at its boundary.
- Unknown exceptions are logged with non-sensitive context and rethrown; only known domain errors are mapped to public action errors.
- No production adapter may fall back to an in-memory, simulated, or local generator.
- No provider credential, licensed content, or account approval is fabricated.
- Current checkout has no Git metadata; replace commit checkpoints with full verification checkpoints unless Git becomes available.

---

### Task 1: Executable quality gate and runtime configuration

**Files:**
- Modify: `package.json`
- Create: `eslint.config.mjs`
- Modify: `.env.example`
- Modify: `src/server/config.ts`
- Test: `src/server/config.test.ts`

**Interfaces:**
- Produces: `loadRuntimeConfig(env): RuntimeConfig` with discriminated local and production modes.
- Produces: non-interactive `bun run lint`.

- [ ] Write failing tests for missing, malformed, test-mode, reused, and production credentials.
- [ ] Run the focused config tests and verify expected failures.
- [ ] Implement Zod runtime configuration with purpose-separated versioned key sets and explicit adapter modes.
- [ ] Add ESLint flat configuration and replace the interactive lint script.
- [ ] Run config tests, lint, and typecheck to green.

### Task 2: Domain errors and Server Action boundary schemas

**Files:**
- Create: `src/server/errors/domain-error.ts`
- Create: `src/server/validation/action-schemas.ts`
- Create: `src/server/actions/action-result.ts`
- Modify: `src/app/actions.ts`
- Test: `src/server/validation/action-schemas.test.ts`
- Test: `src/server/actions/action-result.test.ts`

**Interfaces:**
- Produces: `DomainError(code, publicMessage, retryable, field?)`.
- Produces: `parseActionInput(schema, unknownInput)` and `mapKnownDomainError(error)`.

- [ ] Write failing tests for invalid casting IDs, methods, indices, time zones, email, question lengths, review reasons, and unexpected exceptions.
- [ ] Verify tests fail because schemas and error mapping do not exist.
- [ ] Implement the smallest Zod schemas and known-error mapping.
- [ ] Make unknown errors observable and rethrow them without leaking user text or secrets.
- [ ] Run focused and full tests.

### Task 3: Focused repository ports and in-memory adapters

**Files:**
- Create: `src/server/repositories/casting-repository.ts`
- Create: `src/server/repositories/reading-repository.ts`
- Create: `src/server/repositories/entitlement-repository.ts`
- Create: `src/server/repositories/review-repository.ts`
- Create: `src/server/repositories/privacy-repository.ts`
- Create: `src/server/repositories/memory/*`
- Reduce: `src/server/repository.ts`
- Test: `src/server/repositories/memory/*.test.ts`

**Interfaces:**
- Produces: domain-specific repository interfaces with no generic mutable patch method.
- Produces: an explicit `createMemoryRepositories()` composition root for tests and local mode.

- [ ] Write characterization tests for every currently valid repository behavior.
- [ ] Add failing tests for null-owner denial, missing-record errors, immutable versions, reservation terminality, and complete purge.
- [ ] Split storage by responsibility without changing valid observable behavior.
- [ ] Remove unused generation-job scaffolding from the local adapter or connect it through the job port.
- [ ] Confirm no file exceeds 800 lines, no function exceeds 150 lines, and no import cycle exists.

### Task 4: Casting application service and deterministic idempotency

**Files:**
- Create: `src/server/services/casting-service.ts`
- Create: `src/server/services/casting-steps.ts`
- Modify: `src/domain/casting/*`
- Test: `src/server/services/casting-service.test.ts`

**Interfaces:**
- Produces: `CastingService.createDraft`, `submitQuestion`, `recordCoinLine`, `recordYarrowChange`, `completeYarrow`, and `recordMeiHua`.
- Consumes: casting repository, clock, random source, risk service.

- [ ] Write failing tests for draft cancellation/expiry, method mismatch, step order, concurrent replay, expiry, immutable question, and result secrecy.
- [ ] Verify each test fails for the audited defect.
- [ ] Implement lifecycle guards and load persisted steps before consuming randomness.
- [ ] Return persisted records on retries and return progress-only anonymous transport models.
- [ ] Run service tests and all algorithm property tests.

### Task 5: Reveal service, Login Intent, and question-lock integrity

**Files:**
- Create: `src/server/services/reveal-service.ts`
- Create: `src/server/auth/login-intent.ts`
- Modify: `src/domain/questions/normalize.ts`
- Test: `src/server/services/reveal-service.test.ts`

**Interfaces:**
- Produces: `startLoginIntent`, `consumeLoginIntentAndReveal`, and idempotent `revealOwnedCasting`.
- Consumes: purpose-separated fingerprint keys and an atomic repository transaction.

- [ ] Write failing tests for anonymous secrecy, logged-in reveal, repeat reveal, expired reveal, wrong browser, replayed intent, and competing same-question casts.
- [ ] Verify hard-coded fingerprint secrets and null ownership fail the tests.
- [ ] Implement single-use intent consumption, expiry checking, user binding, and 72-hour question locking in one transaction.
- [ ] Support versioned fingerprint dual-read/single-write rotation.
- [ ] Run reveal and authorization tests.

### Task 6: Risk engine, clarification, and generation safety gates

**Files:**
- Modify: `src/domain/risk/engine.ts`
- Create: `src/domain/risk/rules.ts`
- Create: `src/server/services/risk-service.ts`
- Modify: `src/components/cast/*`
- Test: `src/domain/risk/engine.test.ts`
- Test: `src/server/services/risk-service.test.ts`

**Interfaces:**
- Produces: deterministic risk evaluation plus a server-side recheck method used by every generation entry.

- [ ] Add failing regression tests for explicit self-harm, other-harm, insulin/medication, plea/court, project/employer false exclusions, ambiguous mentions, and ordinary safe questions.
- [ ] Verify all audited counterexamples fail before implementation.
- [ ] Implement precise rule groups and remove broad exclusion cancellation.
- [ ] Implement clarification and classic-only product paths instead of sending blocked states into ritual generation.
- [ ] Recheck risk immediately before Preview and Reading generation and after generated output validation.
- [ ] Run risk goldens and full tests.

### Task 7: Structured Preview/Reading output and classic-source data

**Files:**
- Create: `src/server/ai/schemas.ts`
- Create: `src/server/ai/output-validator.ts`
- Modify: `src/server/ai/local-adapter.ts`
- Modify: `src/server/ai/index.ts`
- Create: `src/domain/classics/*`
- Modify: `src/components/cast/hexagram-display.tsx`
- Modify: `src/app/result/[castingId]/page.tsx`
- Test: `src/server/ai/*.test.ts`
- Test: `src/domain/classics/*.test.ts`

**Interfaces:**
- Produces: validated ten-module `ReadingReport`, validated `PreviewOutput`, and versioned classic references.

- [ ] Write failing tests proving context, goal, method facts, all ten modules, reference integrity, word limits, and safety rules affect or constrain output.
- [ ] Verify invalid/missing output is rejected before save or entitlement consumption.
- [ ] Implement Zod schemas and deterministic validation order.
- [ ] Make local output explicitly developmental while genuinely using context, goal, method, and moving-line facts.
- [ ] Add a versioned public-domain classic source with provenance and render it in free results.
- [ ] Run AI golden tests and rendering tests.

### Task 8: Server-authoritative recovery and wizard decomposition

**Files:**
- Create: `src/components/cast/use-casting-controller.ts`
- Create: `src/components/cast/question-step.tsx`
- Create: `src/components/cast/ritual-step.tsx`
- Create: `src/components/cast/reveal-step.tsx`
- Create: `src/components/cast/result-step.tsx`
- Create: `src/components/cast/reading-step.tsx`
- Reduce: `src/components/cast/casting-wizard.tsx`
- Modify: `src/server/loaders.ts`
- Test: `src/components/cast/*.test.tsx`

**Interfaces:**
- Produces: a server snapshot containing authoritative progress and display-safe state.
- Client persistence stores only `castingId`.

- [ ] Write failing tests for forged snapshots, reload after each ritual step, yarrow six-line derivation, blocked risk paths, and sensitive storage exclusion.
- [ ] Replace browser-authoritative recovery with server snapshot loading.
- [ ] Extract focused components and rename empty verbs to precise user-action names.
- [ ] Ensure `CastingWizard` and every extracted function remain below 150 lines.
- [ ] Run component, service, and E2E-style route tests.

### Task 9: Entitlement, quality-review, history, and privacy lifecycles

**Files:**
- Create: `src/server/services/entitlement-service.ts`
- Create: `src/server/services/quality-review-service.ts`
- Create: `src/server/services/privacy-service.ts`
- Modify: `src/server/loaders.ts`
- Modify: `src/app/account/page.tsx`
- Modify: `src/app/privacy/page.tsx`
- Test: `src/server/services/{entitlement,quality-review,privacy}-service.test.ts`

**Interfaces:**
- Produces: immutable entitlement transitions, review deadlines/compensation, filterable history, account deletion and recovery-window purge.

- [ ] Write failing tests for expired release, missing reservation, duplicate terminal transitions, review windows, supplementation, compensation, history filters, and complete related-record purge.
- [ ] Implement non-negative counter invariants and immutable ledger events.
- [ ] Implement review lifecycle, deadlines, approval compensation, and UI actions.
- [ ] Implement account deletion with explicit financial-retention separation and complete personal-content purge.
- [ ] Run lifecycle and privacy tests.

### Task 10: PostgreSQL schema, migrations, and transactional repositories

**Files:**
- Modify: `src/server/db/schema.ts`
- Create: `src/server/db/client.ts`
- Create: `src/server/repositories/postgres/*`
- Create: `drizzle/*`
- Modify: `drizzle.config.ts`
- Test: `src/server/repositories/postgres/*.integration.test.ts`

**Interfaces:**
- Produces: PostgreSQL implementations of all repository ports.

- [ ] Write schema tests for partial uniqueness, nullable step identity, one result/reading, idempotent webhook events, immutable ledger, active cast ownership, and reservation terminality.
- [ ] Correct nullable unique semantics with partial indexes or `NULLS NOT DISTINCT` as appropriate.
- [ ] Generate deterministic migrations and add transaction-backed repositories.
- [ ] Add migration dry-run and concurrent integration tests that activate when `TEST_DATABASE_URL` is supplied and otherwise report one explicit credential blocker.
- [ ] Run schema/type/unit tests without a database and integration tests when a URL is available.

### Task 11: Better Auth production adapter

**Files:**
- Create: `src/server/auth/auth.ts`
- Create: `src/app/api/auth/[...all]/route.ts`
- Create: `src/server/auth/providers/*`
- Modify: `src/server/session.ts`
- Test: `src/server/auth/*.test.ts`

**Interfaces:**
- Produces: local test auth and production Better Auth implementations selected only by validated configuration.

- [ ] Write failing contract tests for session lookup, Google OAuth callback, Magic Link single use, Login Intent continuity, CSRF, and open-redirect rejection.
- [ ] Configure Better Auth against the PostgreSQL schema and explicit Google/Resend providers.
- [ ] Keep provider network calls behind testable boundaries and reject production startup without required keys.
- [ ] Run contract tests; defer only live Google/Resend smoke tests when credentials are unavailable.

### Task 12: Creem payment, Webhook Inbox, refund, and dispute

**Files:**
- Create: `src/server/payments/payment-provider.ts`
- Create: `src/server/payments/creem-provider.ts`
- Create: `src/server/services/payment-service.ts`
- Create: `src/app/api/webhooks/creem/route.ts`
- Test: `src/server/payments/*.test.ts`

**Interfaces:**
- Produces: checkout creation and verified raw-body webhook processing with Inbox idempotency.

- [ ] Write failing tests for invalid signatures, duplicate/reordered events, browser return without webhook, paid grant, refund, and dispute revocation.
- [ ] Implement the minimal Creem HTTP adapter without granting from return URLs.
- [ ] Persist Inbox before applying order and ledger transitions in one transaction.
- [ ] Run signed fixture contract tests; defer only live merchant smoke tests when credentials are unavailable.

### Task 13: Durable jobs, Outbox, retry, timeout, and fencing

**Files:**
- Create: `src/server/jobs/job-service.ts`
- Create: `src/server/jobs/outbox-dispatcher.ts`
- Create: `src/server/jobs/job-runner.ts`
- Create: `src/app/api/jobs/*`
- Create: `src/workflows/*`
- Modify: `src/server/services/reading-service.ts`
- Test: `src/server/jobs/*.test.ts`

**Interfaces:**
- Produces: transactional `enqueueGeneration`, idempotent dispatch, bounded retry, timeout, and fenced finalization.

- [ ] Write failing tests for dispatch loss, reconciliation, duplicate execution, retry exhaustion, timeout, late success, epoch replacement, schema rejection, and reservation release-versus-expiry.
- [ ] Create Job and Outbox in the same database transaction.
- [ ] Finalize only when job ID, generation epoch, active status, snapshot hash, and reservation match.
- [ ] Add a local deterministic runner and a production Workflow adapter with no silent fallback.
- [ ] Run fault-injection tests; defer only live deployment smoke tests when provider credentials are unavailable.

### Task 14: Production AI provider and cost/safety controls

**Files:**
- Create: `src/server/ai/ai-provider.ts`
- Create: `src/server/ai/ai-gateway-provider.ts`
- Create: `src/server/ai/prompt-builder.ts`
- Modify: `src/server/ai/index.ts`
- Test: `src/server/ai/ai-provider.contract.test.ts`

**Interfaces:**
- Produces: structured Preview/Reading generation with timeout, retry classification, token limits, redacted telemetry, and schema validation.

- [ ] Write failing contract tests for structured output, timeout, rate limit, malformed response, unsafe output, redaction, and cost ceiling.
- [ ] Implement the AI Gateway-compatible provider and deterministic local provider as separately selected adapters.
- [ ] Reject production startup when the AI provider or model identifier is missing.
- [ ] Run fixture contract tests; defer only live model quality smoke tests when credentials are unavailable.

### Task 15: Thin actions, requirement tracing, and release verification

**Files:**
- Reduce: `src/app/actions.ts`
- Modify: `src/server/loaders.ts`
- Modify: `README.md`
- Modify: `overview.md`
- Modify only current-state sections: `docs/PRD.md`, `docs/技术设计文档.md`
- Create: `src/requirements-traceability.test.ts`

**Interfaces:**
- Produces: thin transport Actions and executable mappings for all 28 requirement IDs.

- [ ] Move orchestration out of Actions into services and keep each Action focused on authentication, parsing, one service call, and known-error mapping.
- [ ] Add executable test-name coverage for every PRD requirement ID and the technical minimum test matrix.
- [ ] Reconcile current-state documentation, test counts, provider blockers, and release gates without creating more files under `docs/`.
- [ ] Run lint, typecheck, all tests, production build, line/function/parameter/cycle checks, migration generation, and credential-free contract tests.
- [ ] Produce a final blocker report containing only absent external credentials, provider approvals, DNS/domain settings, or live database endpoints.

