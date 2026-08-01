# Quick I Ching Phase A Repair Design

## Goal

Make the local MVP internally safe and deterministic, and make every production-only dependency fail closed. The application must no longer claim that an offline stand-in satisfies a V2.1 production requirement.

## Scope

Phase A fixes all audit findings that are implementable without a provider account, an approved domain rule set, or a production database. It retains the three-method local demonstration flow, but prevents it from being represented as a public-production implementation.

Phase A does not add Better Auth, Creem, PostgreSQL/Drizzle, Vercel Workflow, licensed classic text, or a third-party AI provider. Production configuration will reject startup when any of those capabilities would be required.

## Design decisions

### 1. Authoritative application services

Server Actions become thin transport functions: authenticate the caller, validate the request, call one application service, and map a known domain error to `ActionResult`. They will not generate random values, mutate lifecycle fields, or assemble cross-domain transactions themselves.

Focused services own the following transactions:

- `CastingService`: question submission, ordered idempotent steps, method validation, expiry enforcement, and immutable result completion.
- `RevealService`: idempotent reveal in one critical section, including question fingerprint and duplicate handling.
- `ReadingService`: preview/reading state, reservation finalization, and deterministic output validation.
- `QualityReviewService`: ownership, delivery state, time window, and one-review enforcement.

The in-memory repository remains a development adapter, but exposes domain-specific methods rather than a public mutable `Partial<CastingSession>` patch API.

### 2. Casting integrity

Every casting mutation verifies ownership, expected method, lifecycle, question state, risk state, and server-side expiry. Existing step records are loaded before any random source is called and are returned verbatim.

Three-Coin accepts only the next missing line. Yarrow persists one change at a time and derives its starting count from the preceding persisted change. Mei Hua validates the IANA time zone through `Intl.DateTimeFormat`, persists the first confirmed time calculation, and returns the same record on retry.

Anonymous callers receive only progress until a successful reveal. Result retrieval requires a bound user and `revealed` lifecycle.

### 3. Risk and question immutability

Question submission is permitted only for a draft session. The resulting question version is immutable after the first irreversible step. Risk evaluation receives scene context deliberately, returns `needs_clarification` for ambiguous high-risk mentions, and does not let unrelated employment/project words cancel a direct medical, legal, or investment decision request.

Risk checks retain rule version, matched codes, and reason code in the development repository. Every sensitive generation entry re-evaluates the saved context before work begins and validates the generated output before saving.

### 4. Entitlement correctness

Reservations transition only from `reserved` to exactly one terminal status. Batch validation checks integer, non-negative counters as well as the sum identity. A released or expired reservation is never reused; retry creates a new reservation from a usable batch. Failure decides release versus expiry from the batch expiry at the moment of finalization.

The payment simulator remains local-development only. It records a single completion transaction and cannot run in production mode. Refund, dispute, provider webhook, and durable payment processing remain explicit production blockers rather than simulated features.

### 5. Generation and external boundaries

Local Preview and Reading are development demonstrations, never paid production fulfillment. They receive the question context and method-specific facts, pass deterministic schema/safety checks, and are labelled as local development output.

Production generation, payment, authentication, and persistence modes are rejected by a validated environment configuration until the corresponding implementation and credentials exist. Unknown adapter modes are errors, not fallbacks.

### 6. Recovery, deletion, and UI composition

The wizard loads server-authoritative progress and never trusts session storage for ritual state. It is split into an orchestration hook plus small input, ritual, reveal, result, and report components. Client storage stores only a casting identifier, never a report.

Delete requests are limited to revealed, owned casts. The development repository supports a recovery-window query and a controlled purge operation for tests; account deletion, financial retention, and production audit logging remain production blockers.

### 7. Security and failure behavior

All secrets are required in production. Fingerprint, cookie, result-HMAC, and encryption keys are purpose-separated environment values. AES-GCM uses authenticated additional data containing casting and question-version identifiers. Known errors return specific public codes; unknown errors are recorded and rethrown to the framework boundary rather than silently converted to success-like state.

### 8. Tests and documentation

Tests are added before each behavior change. The suite gains application-service tests for reveal secrecy, step idempotency/order/expiry, yarrow continuity, question immutability, risk counterexamples, entitlement retries, quality-review authorization, deletion recovery, and production configuration rejection.

README, PRD current-state notes, and technical-design implementation notes are reconciled: the two V2.1 documents remain the product/technical source of truth, while README describes the actual local-development boundary and launch blockers accurately. No additional file is added to `docs/`.

## Acceptance criteria

- Replaying any casting mutation returns the persisted record without consuming new randomness.
- Before reveal, an anonymous owner cannot obtain result fields through actions, routes, or loaders.
- Every yarrow change starts from the prior persisted ending count; all six final values use only third changes.
- Casting actions reject wrong method, wrong order, missing/changed question, unsafe risk state, and expired sessions.
- Repeating reveal for the same casting succeeds idempotently; competing same-question casts select one winner without mutating it into a duplicate.
- Batch counters cannot be negative, and released/expired reservations cannot be consumed.
- High-risk direct decisions remain blocked even if the text also mentions work or a project.
- Production mode rejects dev secrets, local generation, simulated payment, and dev authentication.
- Strict type checking, linting, unit/integration tests, and production build pass without interactive setup.
