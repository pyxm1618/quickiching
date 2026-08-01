# Production Preview and Waffo Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining production user-flow blockers, replace Creem completely with Waffo Pancake, and make PR #12 ready for production-like Preview acceptance.

**Architecture:** Keep casting, generation, payment, and entitlement state server-authoritative. Add an authenticated reveal path beside the existing anonymous login-intent path. Isolate Waffo behind a provider client and provider-neutral checkout/repository contracts; accept payment state only from RSA-verified Waffo Webhooks and preserve the existing immutable entitlement ledger.

**Tech Stack:** Next.js 15, React 19, TypeScript, Better Auth, PostgreSQL/Drizzle, Vitest, Playwright, Vercel Workflow, `@waffo/pancake-ts@0.14.0`.

## Global Constraints

- Use only Waffo Pancake official SDK/API contracts documented at `https://docs.waffo.ai/`.
- Never trust product, price, quantity, currency, user ID, or order status from the browser.
- Waffo private keys remain server-only and are never logged.
- Checkout uses fixed server-side product mappings for `one`, `three`, and `five`.
- Payment fulfillment occurs only after a verified `order.completed` Webhook.
- Webhook verification uses the raw request body and `x-waffo-signature`.
- Webhook delivery `id` is the idempotency key.
- Existing applied SQL migrations remain immutable; new schema changes use a forward migration.
- Anonymous casting results remain hidden until authenticated reveal.
- Deep Reading consumes one entitlement only after successful complete delivery.
- Keep `bun install --frozen-lockfile`, lint, typecheck, PostgreSQL tests, Playwright, and production build as mandatory gates.

---

### Task 1: Anonymous owner creation and authenticated reveal

**Files:**
- Modify: `src/app/production-actions.ts`
- Modify: `src/server/runtime/postgres-application.ts`
- Modify: `src/server/repositories/postgres/atomic-repository.ts`
- Test: `src/app/production-action-boundaries.test.ts`
- Test: `src/server/runtime/postgres-reveal-handoff.integration.test.ts`

**Interfaces:**
- Produces: `PostgresApplicationRuntime.revealAuthenticatedCasting({ castingId, authenticatedUserId, anonymousSessionHash })`.
- Produces: `PostgresAtomicRepository.revealOwnedCasting(...)` with the same 72-hour fingerprint lock semantics as login-intent reveal.

- [ ] Add failing tests proving a no-cookie anonymous visitor receives an owner and can create a draft.
- [ ] Add failing PostgreSQL tests proving a logged-in owner can reveal a user-owned casting without an anonymous cookie.
- [ ] Add failing PostgreSQL tests proving a logged-in user with the original anonymous cookie can bind and reveal an anonymous casting.
- [ ] Change production draft creation to call `getOrCreateAnonymousHash()` only when no authenticated user exists.
- [ ] Add authenticated reveal orchestration while preserving duplicate-question locking and ownership checks.
- [ ] Run focused tests, then full lint/typecheck/test/build.

### Task 2: Authentication callback preservation

**Files:**
- Modify: `src/app/signin/page.tsx`
- Test: `src/server/config-public-auth.test.ts` or a focused sign-in source contract test.

**Interfaces:**
- Consumes: `callbackURL` search parameter.
- Produces: a sanitized same-origin application path used by Magic Link, Google OAuth, and local development sign-in.

- [ ] Add a test for accepted relative callback paths and rejected external/protocol-relative paths.
- [ ] Read `callbackURL` with `useSearchParams()` and normalize it to `/account` when invalid.
- [ ] Use the normalized callback for Magic Link, Google OAuth, and local router navigation.
- [ ] Preserve callback information in provider error URLs.
- [ ] Run focused tests, then full quality gates.

### Task 3: Result-page generation and purchase controls

**Files:**
- Create: `src/components/cast/result-reading-controls.tsx`
- Modify: `src/app/result/[castingId]/page.tsx`
- Test: `src/app/production-action-boundaries.test.ts`
- Test: `e2e/public-and-account.spec.mjs`

**Interfaces:**
- Consumes: `startPreviewAction`, `startDeepReadingAction`, `castingId`, existing Preview/Reading state.
- Produces: client controls that generate, poll/reload, show actionable errors, and route users without credits to `/pricing`.

- [ ] Add a failing source/E2E contract proving `/result/[castingId]` exposes Preview and Deep Reading actions.
- [ ] Build a client component with independent Turnstile tokens, pending states, error messages, and `router.refresh()`.
- [ ] Render the component for authenticated revealed results while keeping completed content immutable.
- [ ] Ensure unauthenticated or unauthorized access remains hidden by the server loader.
- [ ] Run focused tests, then full quality gates.

### Task 4: Waffo SDK and production configuration

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `.env.example`
- Modify: `src/server/config.ts`
- Modify: `src/server/config.test.ts`
- Modify: `src/server/release/runtime-boundaries.test.ts`

**Interfaces:**
- Produces credentials: `waffoMerchantId`, `waffoPrivateKey`, `waffoStoreId`, `waffoProductIdOne`, `waffoProductIdThree`, `waffoProductIdFive`.
- Produces payment mode: `waffo`.

- [ ] Add failing configuration tests requiring `PAYMENT_ADAPTER_MODE=waffo` and all server-only Waffo credentials.
- [ ] Add `@waffo/pancake-ts@0.14.0` and regenerate the Bun lockfile without weakening frozen installation.
- [ ] Remove all `CREEM_*` configuration and credential fields.
- [ ] Validate the PEM private key without logging its value.
- [ ] Update production boundary tests and example environment documentation.
- [ ] Run configuration tests and frozen install.

### Task 5: Waffo checkout client

**Files:**
- Create: `src/server/payments/waffo-client.ts`
- Create: `src/server/payments/waffo-client.test.ts`
- Modify: `src/server/payments/checkout-service.ts`
- Modify: `src/server/payments/checkout-service.test.ts`
- Modify: `src/app/production-actions.ts`
- Delete: `src/server/payments/creem-client.ts`
- Delete: `src/server/payments/creem-client.test.ts`

**Interfaces:**
- Produces: `WaffoClient.createCheckout({ storeId, productId, orderMerchantExternalId, successUrl, buyerEmail, metadata })`.
- Returns: `{ id, status, checkoutUrl, orderMerchantExternalId }`.

- [ ] Add failing tests for server-authoritative product mapping, internal order correlation, and HTTPS Waffo checkout URLs.
- [ ] Wrap `WaffoPancake.checkout.createSession()` with bounded error normalization.
- [ ] Send `productType: "onetime"`, `currency: "USD"`, `buyerEmail`, `successUrl`, metadata, and internal order ID.
- [ ] Replace the production checkout composition root and remove all Creem client references.
- [ ] Run payment unit tests and typecheck.

### Task 6: Waffo Webhook ingestion and entitlement lifecycle

**Files:**
- Create: `src/server/payments/waffo-webhook.ts`
- Create: `src/server/payments/waffo-webhook.test.ts`
- Create: `src/app/api/webhooks/waffo/route.ts`
- Delete: `src/app/api/webhooks/creem/route.ts`
- Delete: `src/server/payments/creem-signature.ts`
- Delete: `src/server/payments/creem-signature.test.ts`
- Delete: `src/server/payments/creem-webhook.ts`
- Delete: `src/server/payments/creem-webhook.test.ts`
- Modify: `src/server/repositories/postgres/payment-repository.ts`
- Modify: PostgreSQL payment integration tests.

**Interfaces:**
- Consumes SDK `verifyWebhook(rawBody, signature, { environment })`.
- Produces provider-neutral events for `order.completed`, `refund.succeeded`, and `refund.failed`.

- [ ] Add failing parser tests using the official Waffo envelope fields.
- [ ] Add failing route tests proving `.text()` is used before signature verification and invalid signatures return 401.
- [ ] Add failing PostgreSQL tests for duplicate delivery IDs, exact order/product/currency/amount reconciliation, full and partial refund revocation, and failed-refund review marking.
- [ ] Implement the verified Waffo route and provider-neutral repository processing.
- [ ] Store provider `waffo` in `webhook_inbox`; remove all Creem error codes and audit labels.
- [ ] Run payment and fault-injection tests.

### Task 7: Payment recovery and UI copy

**Files:**
- Modify: `src/app/api/orders/[orderId]/route.ts`
- Modify: `src/components/checkout-status.tsx`
- Modify: `src/components/pricing-buttons.tsx`
- Modify: pricing/account pages containing demo or expiry copy.
- Test: payment status and UI contract tests.

**Interfaces:**
- Produces: server-side order recovery by Waffo `orderMerchantExternalId`/payment query when local status remains pending.

- [ ] Add a failing recovery test for a paid Waffo order whose Webhook was delayed.
- [ ] Query Waffo from the server only and feed the result through the same idempotent repository transition.
- [ ] Remove “DEMO CHECKOUT” and Creem wording.
- [ ] Standardize entitlement validity copy to 12 months.
- [ ] Run focused and full tests.

### Task 8: AI output review enforcement

**Files:**
- Modify: `src/server/ai/ai-sdk-adapter.ts`
- Modify: `src/server/ai/ai-sdk-adapter.test.ts`
- Modify: `src/server/ai/output-validator.ts` as required.

**Interfaces:**
- Consumes: `AI_MODEL_OUTPUT_REVIEW`.
- Produces: a second structured safety/integrity review before generated content is persisted as complete.

- [ ] Add failing tests proving the review model is called and a rejected review fails the job without consuming entitlement.
- [ ] Implement bounded structured review for classical-reference correctness, module completeness, contradictions, and safety boundaries.
- [ ] Preserve deterministic post-validation after model review.
- [ ] Run AI and generation lifecycle tests.

### Task 9: Documentation, deployment, and complete verification

**Files:**
- Modify: `plans/v2-1-release-runbook.md`
- Modify: `docs/release-gates.md`
- Modify: PR #12 description if all technical gates pass.

- [ ] Remove every active Creem reference from source, tests, environment examples, and runbooks; retain historical migration filenames only when renaming would break applied migration history.
- [ ] Document Waffo Test and Production environment separation, Webhook URL, events, and required product IDs.
- [ ] Run `bun install --frozen-lockfile`.
- [ ] Run ordered PostgreSQL migrations from an empty database.
- [ ] Run `bun run lint`.
- [ ] Run `bun run typecheck`.
- [ ] Run `bun run test`.
- [ ] Run Playwright browser E2E.
- [ ] Run `bun run build`.
- [ ] Verify Vercel Preview `/api/health`, `/api/ready`, fresh anonymous casting, Magic Link, Google OAuth, Preview generation, Waffo Test checkout, Deep Reading, refresh/reopen, and delayed Webhook recovery.
- [ ] Keep PR #12 Draft until every automated gate and production-like Preview acceptance item passes.
